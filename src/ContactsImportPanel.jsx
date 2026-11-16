import React, { useState } from "react";
import { duplicateContact } from "./crm";
import { IMPORT_COLUMNS, parseContactCSV } from "./contactImport";

const tone = { color: "#5B626B", fontSize: 12, lineHeight: 1.5 };
const action = { border: "1px solid #D9DED8", background: "#FFF", padding: "9px 12px", borderRadius: 8, cursor: "pointer", color: "#17212A", fontSize: 13 };

function downloadModel() {
  const data = "\uFEFF" + IMPORT_COLUMNS.join(";") + "\r\n";
  const url = URL.createObjectURL(new Blob([data], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "modelo-importacao-contatos-elo.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function ContactsImportPanel({ contacts, onImport, onClose }) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [outcome, setOutcome] = useState(null);

  const chooseFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setPreview(null);
    setOutcome(null);
    if (!/\.csv$/i.test(file.name)) {
      setError("Exporte a planilha como CSV UTF-8 (.csv) antes de importar.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError("O arquivo excede 3 MB. Divida a planilha em partes menores.");
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      let csv = new TextDecoder("utf-8").decode(buffer);
      if (csv.includes("\uFFFD")) csv = new TextDecoder("windows-1252").decode(buffer);
      const parsed = parseContactCSV(csv);
      const valid = [], issues = [...parsed.issues];
      parsed.rows.forEach((row) => {
        const duplicate = duplicateContact(row, [...contacts, ...valid]);
        if (duplicate) issues.push({ line: row.line, reason: "Telefone ou e-mail já cadastrado (ou repetido na planilha)." });
        else valid.push(row);
      });
      if (parsed.total > 5000) { setError("Importe no máximo 5.000 linhas por vez."); return; }
      setPreview({ ...parsed, rows: valid, issues });
    } catch (failure) {
      setError(failure?.message || "Não foi possível ler o arquivo CSV.");
    }
  };

  const importSelected = async () => {
    if (!preview?.rows.length || importing) return;
    setImporting(true);
    setError("");
    try {
      const result = await onImport(preview.rows);
      setOutcome(result);
      setPreview(null);
    } catch (failure) {
      setError(failure?.message || "Erro inesperado na importação.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={{ maxWidth: 680 }}>
      <p style={tone}>Importe contatos de uma planilha do Excel ou Google Planilhas. Exporte como <strong>CSV UTF-8</strong> (separado por ponto e vírgula ou vírgula), depois selecione o arquivo. Nenhum registro será alterado antes da confirmação.</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <button type="button" style={action} onClick={downloadModel}>Baixar modelo da planilha</button>
        <label style={{ ...action, background: "#EAF8EF", borderColor: "#A3D8B6", fontWeight: 650, cursor: importing ? "wait" : "pointer" }}>
          Selecionar arquivo CSV
          <input type="file" accept=".csv,text/csv" onChange={chooseFile} disabled={importing} style={{ display: "none" }} />
        </label>
      </div>
      <p style={tone}>Obrigatórios: <strong>Nome e Telefone</strong>. O restante é opcional: datas, status, observações, próximo contato, empresa, e-mail, origem e valor. Datas em DD/MM/AAAA ou AAAA-MM-DD. Sem status, o contato entra como Novo lead.</p>
      <p style={tone}>Para proteger a sua lista, telefones e e-mails duplicados são ignorados; dados existentes nunca são sobrescritos. Linhas inválidas são mostradas antes da importação.</p>

      {error && <div role="alert" style={{ color: "#AE3429", background: "#FFF1EF", borderRadius: 7, padding: 10, marginTop: 12 }}>{error}</div>}
      {preview && (
        <div style={{ borderTop: "1px solid #E6EAE5", paddingTop: 14, marginTop: 12 }}>
          <div style={{ fontSize: 13, marginBottom: 8 }}><strong>{preview.rows.length} prontos para importar</strong> · {preview.issues.length} linha(s) ignorada(s) · {preview.total} no arquivo</div>
          {preview.ignoredColumns.length > 0 && <p style={tone}>Colunas não reconhecidas (não serão importadas): {preview.ignoredColumns.join(", ")}</p>}
          {preview.rows.length > 0 && (
            <div style={{ maxHeight: 180, overflow: "auto", border: "1px solid #E3E6E1", borderRadius: 8, marginBottom: 10 }}>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", textAlign: "left" }}>
                <thead><tr><th style={{ padding: 8 }}>Linha</th><th style={{ padding: 8 }}>Nome</th><th style={{ padding: 8 }}>Telefone</th><th style={{ padding: 8 }}>Status</th><th style={{ padding: 8 }}>Próximo contato</th></tr></thead>
                <tbody>{preview.rows.slice(0, 100).map((r) => (
                  <tr key={r.line}><td style={{ padding: 7 }}>{r.line}</td><td style={{ padding: 7 }}>{r.name}</td><td style={{ padding: 7 }}>{r.phone}</td><td style={{ padding: 7 }}>{r.stage}</td><td style={{ padding: 7 }}>{r.next_reminder_date || "—"}</td></tr>
                ))}</tbody>
              </table>
              {preview.rows.length > 100 && <p style={{ ...tone, padding: 8 }}>Mostrando os primeiros 100 registros.</p>}
            </div>
          )}
          {preview.issues.length > 0 && (
            <details style={{ marginBottom: 10 }}>
              <summary style={{ cursor: "pointer", fontSize: 13 }}>Ver {preview.issues.length} linhas ignoradas</summary>
              <div role="status" style={{ maxHeight: 150, overflow: "auto", padding: 8, fontSize: 12, color: "#9D483F" }}>
                {preview.issues.slice(0, 200).map((issue, i) => <p key={i}>Linha {issue.line}: {issue.reason}</p>)}
                {preview.issues.length > 200 && <p>Exibindo os primeiros 200 avisos.</p>}
              </div>
            </details>
          )}
          <button type="button" disabled={!preview.rows.length || importing} style={{ ...action, background: "#22C55E", border: "none", fontWeight: 700, opacity: importing ? .6 : 1 }} onClick={importSelected}>
            {importing ? "Importando registros…" : "Confirmar importação de " + preview.rows.length + " contatos"}
          </button>
        </div>
      )}
      {outcome && (
        <div role="status" style={{ borderTop: "1px solid #E3E6E1", paddingTop: 12 }}>
          <strong>{outcome.created} contatos importados.</strong>
          {outcome.errors?.length > 0 && <p style={{ ...tone, color: "#A33A30" }}>Ocorreram {outcome.errors.length} problemas: {outcome.errors.slice(0, 8).join("; ")}{outcome.errors.length > 8 ? "…" : ""}</p>}
          <p style={tone}>As datas e os lembretes dos registros criados já foram salvos. Confirme os dados na lista de Contatos.</p>
          <button type="button" style={action} onClick={onClose}>Fechar</button>
        </div>
      )}
    </div>
  );
}
