import test from "node:test";
import assert from "node:assert/strict";
import { parseContactCSV, parseImportDate, splitCSV } from "../src/contactImport.js";

test("Portuguese CSV handles semicolons, quoted multiline notes and optional dates", () => {
  const content = [
    "Nome;Telefone;Data do primeiro contato;Data do último contato;Status;Observação;Próximo contato",
    'Ana;+55 11 99999-8888;15/11/2026;16/11/2026;Proposta enviada;"Falou sobre pacote; pediu retorno";20/11/2026',
    'Bruno;(19) 99999-1111;;;Novo lead;"Primeira conversa\nAguardando retorno";',
  ].join("\r\n");
  const parsed = parseContactCSV(content);
  assert.equal(parsed.total, 2);
  assert.equal(parsed.issues.length, 0);
  assert.equal(parsed.rows[0].stage, "proposta");
  assert.equal(parsed.rows[0].first_contact_date, "2026-11-15");
  assert.equal(parsed.rows[0].last_contact_date, "2026-11-16");
  assert.equal(parsed.rows[0].next_reminder_date, "2026-11-20");
  assert.equal(parsed.rows[0].notes, "Falou sobre pacote; pediu retorno");
  assert.equal(parsed.rows[1].stage, "novo");
  assert.equal(parsed.rows[1].first_contact_date, "");
  assert.equal(parsed.rows[1].notes, "Primeira conversa\nAguardando retorno");
});

test("Comma CSV with accent-insensitive names and dates", () => {
  const parsed = parseContactCSV("nome,whatsapp,status,proximo contato\nJoão,19988887777,Em negociação,2026-11-20");
  assert.equal(parsed.issues.length, 0);
  assert.equal(parsed.rows[0].stage, "negociacao");
  assert.equal(parsed.rows[0].next_reminder_date, "2026-11-20");
});

test("Invalid lines are excluded rather than imported", () => {
  const parsed = parseContactCSV("Nome;Telefone;Status;Próximo contato\n;11999998888;;\nAna;123;Novo;\nBob;11988887777;Inexistente;\nCarol;11999996666;Novo;31/02/2026\nDani;11999995555;Novo;");
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.issues.length, 4);
  assert.equal(parsed.rows[0].name, "Dani");
});

test("Dates reject invalid days and ambiguous formats", () => {
  assert.equal(parseImportDate("2026-02-29"), null);
  assert.equal(parseImportDate("29/02/2024"), "2024-02-29");
  assert.equal(parseImportDate("11/16/2026"), null);
  assert.equal(parseImportDate(""), "");
});
test("quoted delimiters and escaped double quotes remain in cell", () => {
  const rows = splitCSV('Nome;Telefone;Observação\n"Ana; B";11999998888;"Ela disse ""sim""."');
  assert.equal(rows[1][0], "Ana; B");
  assert.equal(rows[1][2], 'Ela disse "sim".');
});
