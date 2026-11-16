import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const input = { width: "100%", padding: "9px 10px", boxSizing: "border-box", font: "inherit", border: "1px solid #DFE1DC", borderRadius: 6, background: "#FFF" };
const label = { display: "block", fontSize: 12, color: "#5B626B", marginBottom: 6 };
const box = { padding: 12, border: "1px solid #E5E8E3", borderRadius: 8, marginTop: 10, background: "#FBFCFA" };
const format = (date) => date ? date.slice(0, 10).split("-").reverse().join("/") : "—";
const today = () => {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
};

export default function ContactHistory({ contact, stages, onRecorded }) {
  const [interactions, setInteractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [stage, setStage] = useState(contact.stage || "novo");
  const [nextDate, setNextDate] = useState(contact.next_reminder_date || "");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    supabase.from("contact_interactions")
      .select("id, occurred_at, note, from_stage, to_stage, next_contact_date, created_at")
      .eq("organization_id", contact.organization_id)
      .eq("contact_id", contact.id)
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false })
      .then(({ data, error: failure }) => {
        if (!active) return;
        setLoading(false);
        if (failure) setError("Histórico indisponível. Verifique se a migração do banco foi aplicada.");
        else setInteractions(data || []);
      });
    return () => { active = false; };
  }, [contact.id, contact.organization_id]);

  useEffect(() => {
    setStage(contact.stage || "novo");
    setNextDate(contact.next_reminder_date || "");
  }, [contact.stage, contact.next_reminder_date]);

  const save = async (event) => {
    event.preventDefault();
    if (!date || !note.trim()) { setError("Preencha a data e a observação do contato."); return; }
    setSubmitting(true); setError("");
    try {
      const { error: failure } = await supabase.rpc("record_elo_contact_interaction", {
        p_contact_id: contact.id,
        p_occurred_at: date,
        p_note: note.trim(),
        p_new_stage: stage,
        p_next_contact_date: nextDate || null,
      });
      if (failure) throw failure;
      const { data, error: readFailure } = await supabase.from("contact_interactions")
        .select("id, occurred_at, note, from_stage, to_stage, next_contact_date, created_at")
        .eq("organization_id", contact.organization_id)
        .eq("contact_id", contact.id)
        .order("occurred_at", { ascending: false })
        .order("created_at", { ascending: false });
      if (readFailure) throw readFailure;
      setInteractions(data || []);
      setNote(""); setDate(today());
      await onRecorded?.();
    } catch (failure) {
      setError(failure.message || "Não foi possível registrar a interação.");
    } finally { setSubmitting(false); }
  };
  const stageLabel = (id) => stages.find((item) => item.id === id)?.label || id || "—";

  return (
    <section style={{ marginTop: 18 }}>
      <h3 style={{ fontSize: 14, margin: "4px 0 8px" }}>Histórico de contatos</h3>
      <p style={{ fontSize: 12, color: "#66717C", lineHeight: 1.5 }}>
        Registre cada conversa, atendimento ou tentativa de contato, a evolução do funil e o próximo retorno. As observações anteriores ficam preservadas.
      </p>
      <form onSubmit={save} style={box}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 135px" }}><label style={label} htmlFor="interaction-date">Data do contato</label><input id="interaction-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} style={input} /></div>
          <div style={{ flex: "1 1 145px" }}><label style={label} htmlFor="interaction-stage">Status após contato</label>
            <select id="interaction-stage" style={input} value={stage} onChange={(e) => setStage(e.target.value)}>
              {stages.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
            </select>
          </div>
          <div style={{ flex: "1 1 145px" }}><label style={label} htmlFor="interaction-next">Próximo contato</label><input id="interaction-next" type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} style={input} /></div>
        </div>
        <label style={{ ...label, marginTop: 10 }} htmlFor="interaction-note">Observação desta interação *</label>
        <textarea id="interaction-note" style={{ ...input, minHeight: 82, resize: "vertical" }} value={note} required placeholder="O que foi conversado? Qual foi a resposta? Quais são os próximos passos?" onChange={(e) => setNote(e.target.value)} />
        <button type="submit" disabled={submitting} style={{ marginTop: 10, cursor: submitting ? "wait" : "pointer", padding: "9px 13px", borderRadius: 7, background: "#22C55E", color: "#0D0C1F", fontWeight: 700, border: 0 }}>
          {submitting ? "Registrando…" : "Registrar interação"}
        </button>
      </form>
      {error && <div role="alert" style={{ ...box, color: "#A33128", background: "#FFF1EF" }}>{error}</div>}
      {loading ? <p style={{ fontSize: 12, color: "#65707A" }}>Carregando histórico…</p> :
        interactions.length === 0 ? <p style={{ fontSize: 12, color: "#65707A" }}>Nenhuma interação registrada ainda.</p> :
          <ol style={{ margin: "12px 0 0", paddingLeft: 20 }}>
            {interactions.map((entry) => (
              <li key={entry.id} style={{ padding: "0 0 12px 5px", marginBottom: 10, borderBottom: "1px solid #E6E8E4", fontSize: 12.5, lineHeight: 1.6 }}>
                <strong>{format(entry.occurred_at)}</strong>
                <div style={{ color: "#56626E" }}>{stageLabel(entry.from_stage)} → {stageLabel(entry.to_stage)}</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{entry.note}</div>
                {entry.next_contact_date && <div style={{ color: "#137D3B" }}>Próximo contato programado: {format(entry.next_contact_date)}</div>}
              </li>
            ))}
          </ol>}
    </section>
  );
}
