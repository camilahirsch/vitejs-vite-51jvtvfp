import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const OPTIONS = [
  { value: "free", label: "Gratuito permanente" },
  { value: "courtesy", label: "Cortesia temporária" },
  { value: "paid", label: "Pago (controle manual)" },
  { value: "trial", label: "Período de teste" },
  { value: "blocked", label: "Bloqueado" },
];

const field = { padding: "9px 11px", border: "1px solid #D9DED9", borderRadius: 7, background: "#FFF", fontSize: 13, minWidth: 0, color: "#17212A" };
const button = { padding: "10px 14px", border: 0, borderRadius: 8, background: "#22C55E", color: "#0D0C1F", fontWeight: 700, cursor: "pointer" };
const secondary = { ...button, background: "#FFFFFF", border: "1px solid #DDE2DD", fontWeight: 500 };
const futureDate = () => {
  const day = new Date();
  day.setDate(day.getDate() + 30);
  return [day.getFullYear(), String(day.getMonth() + 1).padStart(2, "0"), String(day.getDate()).padStart(2, "0")].join("-");
};
const isTimed = (mode) => mode === "trial" || mode === "courtesy";
const labelFor = (mode) => OPTIONS.find((o) => o.value === mode)?.label || mode;

export default function AdminAccessPanel({ onRefreshAccess }) {
  const [accounts, setAccounts] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: failure } = await supabase.rpc("elo_admin_accounts");
    setLoading(false);
    if (failure) {
      setError("Não foi possível carregar as contas. Verifique sua permissão de administrador e a migração do Supabase. " + failure.message);
      return;
    }
    setAccounts(data || []);
    setDrafts(Object.fromEntries((data || []).map((account) => [
      account.organization_id,
      { mode: account.mode, expires_on: account.expires_on || (isTimed(account.mode) ? futureDate() : "") },
    ])));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => accounts.filter((account) =>
    [account.organization_name, account.member_summary].some((v) =>
      String(v || "").toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"))
    )
  ), [accounts, search]);

  const setDraft = (id, next) => {
    setDrafts((previous) => ({ ...previous, [id]: { ...previous[id], ...next } }));
    setSuccess("");
  };

  const save = async (account) => {
    if (busy) return;
    const draft = drafts[account.organization_id];
    if (!draft) return;
    const expires = isTimed(draft.mode) ? draft.expires_on : null;
    if (isTimed(draft.mode) && !expires) {
      setError("Informe o vencimento para teste ou cortesia.");
      return;
    }
    if (draft.mode === "blocked" && account.mode !== "blocked" &&
      !window.confirm("Bloquear a organização " + account.organization_name + "? Os dados serão preservados, mas seus integrantes perderão acesso ao CRM.")) return;

    setBusy(account.organization_id);
    setError("");
    setSuccess("");
    const { error: failure } = await supabase.rpc("elo_admin_set_access", {
      p_organization_id: account.organization_id,
      p_mode: draft.mode,
      p_expires_on: expires,
    });
    if (failure) {
      setError("Não foi possível salvar a alteração: " + failure.message);
      setBusy("");
      return;
    }
    setSuccess("Acesso de " + account.organization_name + " atualizado.");
    await load();
    await onRefreshAccess?.();
    setBusy("");
  };

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ fontSize: 21, fontWeight: 650, margin: "0 0 5px" }}>Gestão de acessos</h1>
      <p style={{ fontSize: 13, color: "#67717C", lineHeight: 1.6, margin: "0 0 18px" }}>
        Painel exclusivo da administração Hirsch. Defina quem usa o Elo gratuitamente, por cortesia, durante o teste ou com acesso pago.
        A modalidade é da <strong>organização</strong> — seus integrantes compartilham a mesma condição de acesso.
      </p>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <input aria-label="Pesquisar organizações ou integrantes" value={search}
          onChange={(e) => setSearch(e.target.value)} style={{ ...field, flex: "1 1 250px" }}
          placeholder="Buscar empresa ou integrante…" />
        <button type="button" style={secondary} onClick={load} disabled={loading || !!busy}>Atualizar lista</button>
      </div>
      <p style={{ fontSize: 12, color: "#66717B", margin: "0 0 12px" }}>
        {accounts.length} organizações cadastradas · {accounts.filter((a) => a.allowed).length} com acesso habilitado
      </p>
      <p style={{ fontSize: 12, color: "#66717B", lineHeight: 1.6 }}>
        <strong>Pago</strong> indica autorização comercial manual, não cobrança automática. Em teste ou cortesia, o acesso termina na data escolhida.
        Bloquear não exclui contatos nem tarefas.
      </p>

      {error && <div role="alert" style={{ color: "#AB3228", padding: 10, background: "#FFF0EE", borderRadius: 8, marginBottom: 12 }}>{error}</div>}
      {success && <div role="status" style={{ color: "#16783C", padding: 10, background: "#E8F8EE", borderRadius: 8, marginBottom: 12 }}>{success}</div>}
      {loading ? <p style={{ fontSize: 13 }}>Carregando contas…</p> : filtered.length === 0 ?
        <p style={{ fontSize: 13 }}>Nenhuma organização encontrada.</p> :
        <div style={{ display: "grid", gap: 12 }}>
          {filtered.map((account) => {
            const draft = drafts[account.organization_id];
            if (!draft) return null;
            const changed = !account.has_override || draft.mode !== account.mode || (isTimed(draft.mode) && draft.expires_on !== (account.expires_on || ""));
            return (
              <section key={account.organization_id} style={{ border: "1px solid #E3E7E2", background: "#FFF", borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#17212A" }}>{account.organization_name || "Organização sem nome"}</div>
                    <div style={{ fontSize: 12, color: "#68747C", marginTop: 4 }}>
                      {account.members} integrante(s): {account.member_summary || "Nenhum perfil"}
                    </div>
                    {!account.has_override && <div style={{ fontSize: 11, color: "#897135", marginTop: 4 }}>Modalidade herdada das regras antigas · ainda sem definição manual</div>}
                  </div>
                  <div style={{
                    fontSize: 11.5, fontWeight: 650, borderRadius: 20, border: "1px solid #D9E0DB",
                    padding: "5px 8px", color: account.allowed ? "#16763F" : "#B44533"
                  }}>
                    {account.allowed ? "Acesso liberado" : "Sem acesso"} · {labelFor(account.mode)}
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 13, alignItems: "end" }}>
                  <label style={{ fontSize: 12, flex: "1 1 190px", display: "grid", gap: 5, color: "#5B6670" }}>
                    Modalidade
                    <select value={draft.mode} style={field} onChange={(e) => {
                      const mode = e.target.value;
                      setDraft(account.organization_id, {
                        mode,
                        expires_on: isTimed(mode) ? (draft.expires_on || futureDate()) : "",
                      });
                    }}>
                      {OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  {isTimed(draft.mode) && (
                    <label style={{ fontSize: 12, flex: "1 1 155px", display: "grid", gap: 5, color: "#5B6670" }}>
                      Data final do acesso
                      <input type="date" style={field} value={draft.expires_on} onChange={(e) => setDraft(account.organization_id, { expires_on: e.target.value })} />
                    </label>
                  )}
                  <button type="button" style={{ ...button, opacity: busy || !changed ? 0.6 : 1 }}
                    disabled={!!busy || !changed} onClick={() => save(account)}>
                    {busy === account.organization_id ? "Salvando…" : "Salvar acesso"}
                  </button>
                </div>
              </section>
            );
          })}
        </div>}
      <p style={{ fontSize: 12, color: "#697581", lineHeight: 1.6, marginTop: 15 }}>
        Para convidar uma nova integrante com login próprio, será necessário criar o fluxo seguro de convites e associá-la à organização correta.
        Esta versão administra os acessos das organizações já cadastradas.
      </p>
    </div>
  );
}
