// Leitura local de CSV exportado pelo Excel ou Google Planilhas.
// Nenhum dado é enviado ao servidor antes da confirmação na interface.
const HEADERS = {
  name: ["nome", "nome completo", "contato", "cliente", "prospect"],
  phone: ["telefone", "celular", "whatsapp", "fone", "numero", "numero de telefone"],
  first_contact_date: ["data do primeiro contato", "primeiro contato", "data de inicio do contato", "data inicio contato", "inicio do contato"],
  last_contact_date: ["data do ultimo contato", "ultimo contato", "data ultimo contato", "ultima interacao"],
  next_reminder_date: ["proximo contato", "data do proximo contato", "retorno", "proximo retorno", "lembrete"],
  stage: ["etapa", "status", "status atual", "etapa do funil", "situacao"],
  notes: ["observacao", "observacoes", "anotacoes", "notas", "historico inicial"],
  company: ["empresa", "negocio", "organizacao"],
  email: ["email", "e mail", "correio eletronico"],
  lead_source: ["origem", "origem do lead", "fonte"],
  value: ["valor", "valor estimado", "valor da oportunidade"],
};
export const IMPORT_FIELDS = Object.keys(HEADERS);
export const IMPORT_COLUMNS = ["Nome", "Telefone", "Data do primeiro contato", "Data do último contato", "Status", "Observação", "Próximo contato", "Empresa", "E-mail", "Origem", "Valor estimado"];
const STAGE_ALIASES = {
  novo: ["novo", "novo lead", "lead novo"],
  contato_feito: ["contato feito", "contatado", "em contato"],
  qualificado: ["qualificado", "lead qualificado"],
  proposta: ["proposta", "proposta enviada"],
  negociacao: ["negociacao", "em negociacao", "negociando"],
  ganho: ["ganho", "fechado", "venda concluida", "cliente"],
  perdido: ["perdido", "perda", "nao convertido"],
};
const SOURCE_ALIASES = {
  indicacao: ["indicacao"],
  redes_sociais: ["redes sociais", "instagram", "facebook"],
  google_ads: ["google anuncios", "google ads", "anuncios google"],
  site: ["site"],
  whatsapp: ["whatsapp"],
  evento: ["evento"],
  outro: ["outro"],
};
export function normalizedLabel(value) {
  return String(value ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function resolveValue(value, aliases) {
  const normalized = normalizedLabel(value);
  if (!normalized) return "";
  const result = Object.entries(aliases).find(([key, variants]) =>
    normalizedLabel(key) === normalized || variants.some((variant) => normalizedLabel(variant) === normalized));
  return result ? result[0] : null;
}

function detectDelimiter(firstLine) {
  const counts = { ";": 0, ",": 0, "\t": 0 };
  let quoted = false;
  for (let i = 0; i < firstLine.length; i++) {
    if (firstLine[i] === '"') {
      if (quoted && firstLine[i + 1] === '"') { i++; continue; }
      quoted = !quoted;
    } else if (!quoted && Object.prototype.hasOwnProperty.call(counts, firstLine[i])) {
      counts[firstLine[i]]++;
    }
  }
  return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
}

export function splitCSV(text) {
  const source = String(text || "").replace(/^\uFEFF/, "").replace(/^sep=([;,\t])\r?\n/i, "");
  const delimiter = detectDelimiter(source.split(/\r?\n/, 1)[0] || "");
  const rows = [];
  let cells = [], value = "", quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && char === delimiter) {
      cells.push(value); value = "";
    } else if (!quoted && (char === "\r" || char === "\n")) {
      cells.push(value);
      if (cells.some((c) => c.trim())) rows.push(cells);
      cells = []; value = "";
      if (char === "\r" && source[i + 1] === "\n") i++;
    } else value += char;
  }
  if (quoted) throw new Error("O arquivo CSV contém aspas sem fechamento.");
  cells.push(value);
  if (cells.some((c) => c.trim())) rows.push(cells);
  return rows;
}

export function parseImportDate(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  let y, m, d;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (iso) [, y, m, d] = iso;
  else if (local) [, d, m, y] = local;
  else return null;
  const year = Number(y), month = Number(m), day = Number(d);
  const test = new Date(Date.UTC(year, month - 1, day));
  if (test.getUTCFullYear() !== year || test.getUTCMonth() !== month - 1 || test.getUTCDate() !== day) return null;
  return String(year).padStart(4, "0") + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
}

function parseMoney(value) {
  const text = String(value || "").trim();
  if (!text) return 0;
  let clean = text.replace(/[R$\s]/gi, "");
  if (clean.includes(",")) clean = clean.replace(/\./g, "").replace(",", ".");
  const result = Number(clean);
  return Number.isFinite(result) && result >= 0 ? result : null;
}

export function parseContactCSV(text) {
  const all = splitCSV(text);
  if (!all.length) throw new Error("A planilha está vazia.");
  const fields = all[0].map((header) => Object.entries(HEADERS)
    .find(([, variants]) => variants.some((alias) => normalizedLabel(alias) === normalizedLabel(header)))?.[0] || null);
  if (!fields.includes("name") || !fields.includes("phone")) {
    throw new Error("A primeira linha precisa ter as colunas Nome e Telefone.");
  }
  const issues = [], rows = [];
  all.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const obj = {};
    cells.forEach((value, idx) => { if (fields[idx]) obj[fields[idx]] = String(value).trim(); });
    const name = String(obj.name || "").trim();
    const phone = String(obj.phone || "").trim();
    const digits = phone.replace(/\D/g, "");
    const dates = {};
    for (const key of ["first_contact_date", "last_contact_date", "next_reminder_date"]) {
      const parsed = parseImportDate(obj[key]);
      if (parsed === null) {
        issues.push({ line, reason: "Data inválida em " + key + ": use DD/MM/AAAA ou AAAA-MM-DD." });
        return;
      }
      dates[key] = parsed;
    }
    if (!name) { issues.push({ line, reason: "Nome obrigatório." }); return; }
    if (digits.length < 8 || digits.length > 15 || /^(\d)\1+$/.test(digits)) {
      issues.push({ line, reason: "Telefone inválido. Inclua DDD e mantenha a coluna como texto." }); return;
    }
    const stage = resolveValue(obj.stage, STAGE_ALIASES);
    if (stage === null) { issues.push({ line, reason: "Status não reconhecido: " + obj.stage }); return; }
    const lead_source = resolveValue(obj.lead_source, SOURCE_ALIASES);
    if (lead_source === null) { issues.push({ line, reason: "Origem não reconhecida: " + obj.lead_source }); return; }
    const value = parseMoney(obj.value);
    if (value === null) { issues.push({ line, reason: "Valor inválido." }); return; }
    if (obj.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(obj.email)) {
      issues.push({ line, reason: "E-mail inválido." }); return;
    }
    rows.push({
      line, name, phone, company: obj.company || "", email: obj.email || "",
      value, stage: stage || "novo", lead_source: lead_source || null,
      notes: obj.notes || "", ...dates,
    });
  });
  return { rows, issues, total: all.length - 1, ignoredColumns: all[0].filter((_, i) => !fields[i]) };
}
