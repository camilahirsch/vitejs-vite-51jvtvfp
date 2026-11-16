import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const field = { width: "100%", padding: "9px 10px", boxSizing: "border-box", font: "inherit", border: "1px solid #DDE3DF", borderRadius: 8, background: "#FFF" };
const lbl = { display: "block", marginBottom: 5, fontSize: 12, color: "#64707B" };
const btn = { background: "#22C55E", border: 0, borderRadius: 8, fontWeight: 650, padding: "10px 14px", cursor: "pointer" };
const kinds = [
  ["whatsapp", "WhatsApp"], ["ligacao", "Ligação"], ["email", "E-mail"], ["reuniao", "Reunião"],
  ["cobranca", "Cobrança / financeiro"], ["outro", "Outro contato"]
];
const dateNow = () => {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-");
};
const niceDate = (d) => d ? d.slice(0,10).split("-").reverse().join("/") : "—";

export default function ContactHistory({ contact, stages, onRecorded }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(dateNow);
  const [kind, setKind] = useState("whatsapp");
  const [note, setNote] = useState("");
  const [stage, setStage] = useState(contact.stage || "novo");
  const [nextContact, setNextContact] = useState(contact.next_reminder_date || "");

  async function load() {
    const { data, error: failure } = await supabase.from("contact_interactions")
      .select("id,occurred_at,kind,note,from_stage,to_stage,next_contact_date,created_at")
      .eq("organization_id", contact.organization_id)
      .eq("contact_id", contact.id)
      .order("occurred_at", { ascending:false })
      .order("created_at", { ascending:false })
      .limit(500);
    if (failure) setError("Não foi possível carregar o histórico: " + failure.message);
    else { setRows(data || []); setError(""); }
    setLoading(false);
  }
  useEffect(() => {
    let valid = true;
    setLoading(true);
    supabase.from("contact_interactions")
      .select("id,occurred_at,kind,note,from_stage,to_stage,next_contact_date,created_at")
      .eq("organization_id", contact.organization_id).eq("contact_id", contact.id)
      .order("occurred_at", { ascending:false }).order("created_at", { ascending:false }).limit(500)
      .then(({data,error:failure}) => {
        if (!valid) return;
        setLoading(false);
        if (failure) setError("Não foi possível carregar o histórico: " + failure.message);
        else { setRows(data || []); setError(""); }
      });
    return () => { valid = false; };
  }, [contact.id, contact.organization_id]);
  useEffect(() => { setStage(contact.stage || "novo"); setNextContact(contact.next_reminder_date || ""); }, [contact.id,contact.stage,contact.next_reminder_date]);

  const save = async (e) => {
    e.preventDefault();
    if (!date || !note.trim()) { setError("Informe a data e uma observação sobre a interação."); return; }
    setSaving(true); setError("");
    const { error: failure } = await supabase.rpc("elo_record_contact_interaction", {
      p_contact_id: contact.id, p_occurred_at:date, p_kind:kind,
      p_note:note.trim(), p_new_stage:stage, p_next_contact_date:nextContact || null,
    });
    if (failure) { setError("Não foi possível salvar: " + failure.message); setSaving(false); return; }
    setNote("");
    await load();
    await onRecorded?.({ stage, last_contact_date: date, next_reminder_date: nextContact || "" });
    setSaving(false);
  };
  const stageName = (v) => stages.find(s => s.id === v)?.label || v || "—";
  return (
    <section style={{ paddingTop: 14, borderTop: "1px solid #E5E9E5", marginTop: 14 }}>
      <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>Histórico de interações</h3>
      <p style={{ fontSize: 12, color: "#65717A", lineHeight: 1.5, margin: "0 0 12px" }}>
        Registre cada conversa e veja o que foi combinado antes de retomar o contato. Os registros anteriores não são sobrescritos.
      </p>
      <form onSubmit={save} style={{ borderRadius: 10, background: "#F8FAF8", padding: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 9 }}>
          <label style={lbl}>Data da interação<input type="date" value={date} required onChange={e=>setDate(e.target.value)} style={field}/></label>
          <label style={lbl}>Tipo de contato<select value={kind} onChange={e=>setKind(e.target.value)} style={field}>{kinds.map(([id,title])=><option value={id} key={id}>{title}</option>)}</select></label>
          <label style={lbl}>Novo status<select value={stage} onChange={e=>setStage(e.target.value)} style={field}>{stages.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
          <label style={lbl}>Próximo contato<input type="date" value={nextContact} onChange={e=>setNextContact(e.target.value)} style={field}/></label>
        </div>
        <label style={{...lbl,marginTop: 9}}>Observação desta interação *<textarea required rows={3} value={note} onChange={e=>setNote(e.target.value)}
          style={{...field,resize:"vertical"}} placeholder="O que foi conversado? O que a pessoa respondeu? Qual será o próximo passo?"/></label>
        <button type="submit" disabled={saving} style={{...btn, opacity:saving?.65:1}}>{saving?"Salvando…":"Registrar interação"}</button>
      </form>
      {error && <p role="alert" style={{color:"#AE3429",fontSize:12}}>{error}</p>}
      <h4 style={{ fontSize: 13, margin:"16px 0 6px" }}>Últimas observações</h4>
      {loading ? <p style={{fontSize:12}}>Carregando…</p> : rows.length===0 ? <p style={{fontSize:12,color:"#65717A"}}>Nenhuma interação registrada ainda.</p> :
      <ol style={{margin:"0 0 4px",paddingLeft:21}}>
        {rows.map(row=> <li key={row.id} style={{fontSize:12, marginBottom:12, paddingBottom:10, borderBottom:"1px solid #EEF0ED",lineHeight:1.5}}>
          <strong>{niceDate(row.occurred_at)} · {kinds.find(k=>k[0]===row.kind)?.[1]||row.kind}</strong>
          <div style={{color:"#596674"}}>{stageName(row.from_stage)} → {stageName(row.to_stage)}</div>
          <p style={{whiteSpace:"pre-wrap",margin:"5px 0"}}>{row.note}</p>
          {row.next_contact_date && <div style={{color:"#177C40"}}>Próximo contato: {niceDate(row.next_contact_date)}</div>}
        </li>)}
      </ol>}
    </section>
  );
}