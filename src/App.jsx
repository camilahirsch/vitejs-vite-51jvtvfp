import React, { useState, useEffect, useCallback } from "react";
import {
  LayoutGrid,
  Users,
  Columns3,
  CheckSquare,
  Plus,
  X,
  Search,
  Trash2,
  Phone,
  Mail,
  Building2,
  Pencil,
  Calendar,
  Circle,
  CheckCircle2,
  LogOut,
  Bell,
  TrendingUp,
  ChevronDown,
  Settings,
  User,
  HelpCircle,
  Layers,
  Receipt,
} from "lucide-react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { supabase } from "./supabaseClient";

/* ============================================================
   COBRANÇA (ainda não ativada)
   Quando decidir o preço, crie um Payment Link no Stripe
   (dashboard.stripe.com > Payment Links) e cole a URL abaixo.
   Enquanto ficar como está ("#"), o botão "Assinar agora" não
   faz nada de verdade — é só um placeholder visual.
   ============================================================ */
const STRIPE_PAYMENT_LINK = "#";
const TRIAL_DAYS = 7;

function daysLeft(trialEndsAt) {
  if (!trialEndsAt) return null;
  const end = new Date(trialEndsAt).getTime();
  const now = Date.now();
  return Math.ceil((end - now) / (24 * 3600 * 1000));
}

const STAGES = [
  { id: "novo", label: "Novo lead", color: "#94A3B8" },
  { id: "contato_feito", label: "Contato feito", color: "#60A5FA" },
  { id: "qualificado", label: "Qualificado", color: "#38BDF8" },
  { id: "proposta", label: "Proposta enviada", color: "#4ADE80" },
  { id: "negociacao", label: "Em negociação", color: "#22C55E" },
  { id: "ganho", label: "Ganho", color: "#15803D" },
  { id: "perdido", label: "Perda", color: "#DC2626" },
];

const stageInfo = (id) => STAGES.find((s) => s.id === id) || STAGES[0];

const LEAD_SOURCES = [
  { id: "", label: "Não informado" },
  { id: "indicacao", label: "Indicação" },
  { id: "redes_sociais", label: "Redes sociais" },
  { id: "google_ads", label: "Google / Anúncios" },
  { id: "site", label: "Site" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "evento", label: "Evento" },
  { id: "outro", label: "Outro" },
];

const leadSourceLabel = (id) => (LEAD_SOURCES.find((s) => s.id === id) || LEAD_SOURCES[0]).label;

function monthKey(dateStr) {
  if (!dateStr) return null;
  return dateStr.slice(0, 7); // "YYYY-MM"
}

function monthLabel(key) {
  const [y, m] = key.split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[Number(m) - 1]}/${y.slice(2)}`;
}

function lastMonthKeys(n) {
  const keys = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

function fmtMoney(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(d) {
  if (!d) return "";
  const datePart = d.slice(0, 10);
  const [y, m, day] = datePart.split("-");
  return `${day}/${m}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function withinDays(dateStr, days) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  return diff >= 0 && diff <= days * 24 * 3600 * 1000;
}

function isSameMonth(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

const DATE_RANGE_OPTIONS = [
  { id: "today", label: "Hoje" },
  { id: "7d", label: "Últimos 7 dias" },
  { id: "30d", label: "Últimos 30 dias" },
  { id: "month", label: "Este mês" },
  { id: "all", label: "Todo o período" },
];

function inDateRange(dateStr, mode, from, to) {
  if (!dateStr) return false;
  if (mode === "all") return true;
  if (mode === "today") return dateStr.slice(0, 10) === todayISO();
  if (mode === "7d") return withinDays(dateStr, 7);
  if (mode === "30d") return withinDays(dateStr, 30);
  if (mode === "month") return isSameMonth(dateStr);
  if (mode === "custom") {
    const d = dateStr.slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  }
  return true;
}

function dateRangeLabel(mode, from, to) {
  if (mode === "custom") {
    if (from && to) return `${fmtDateFull(from)} → ${fmtDateFull(to)}`;
    if (from) return `A partir de ${fmtDateFull(from)}`;
    if (to) return `Até ${fmtDateFull(to)}`;
    return "Período personalizado";
  }
  const opt = DATE_RANGE_OPTIONS.find((o) => o.id === mode);
  return opt ? opt.label : "Todo o período";
}

function fmtDateFull(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

function reminderState(dateStr) {
  if (!dateStr) return null;
  const today = todayISO();
  if (dateStr < today) return "vencido";
  if (dateStr === today) return "hoje";
  return "futuro";
}

/* ============================================================
   APP RAIZ
   ============================================================ */

export default function EloCRM() {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [org, setOrg] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [tab, setTab] = useState("painel");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      setProfile(data || null);
    })();
  }, [session]);

  useEffect(() => {
    if (!profile) {
      setOrg(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("organizations")
        .select("id, name, trial_ends_at, subscription_status")
        .eq("id", profile.organization_id)
        .single();
      setOrg(data || null);
    })();
  }, [profile]);

  const loadData = useCallback(async () => {
    if (!profile) return;
    const [{ data: c }, { data: t }] = await Promise.all([
      supabase.from("contacts").select("*").order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").order("due_date", { ascending: true }),
    ]);
    setContacts(c || []);
    setTasks(t || []);
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel("elo-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contacts", filter: `organization_id=eq.${profile.organization_id}` },
        loadData
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `organization_id=eq.${profile.organization_id}` },
        loadData
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [profile, loadData]);

  const addContact = async (contact) => {
    const { error } = await supabase.from("contacts").insert({
      organization_id: profile.organization_id,
      created_by: profile.id,
      name: contact.name,
      company: contact.company,
      email: contact.email,
      phone: contact.phone,
      value: Number(contact.value) || 0,
      stage: contact.stage,
      notes: contact.notes,
      last_contact_date: contact.last_contact_date || null,
      next_reminder_date: contact.next_reminder_date || null,
      loss_reason: contact.loss_reason || null,
      lead_source: contact.lead_source || null,
    });
    if (error) return error;
    loadData();
    return null;
  };

  const editContact = async (id, patch) => {
    const previous = contacts.find((c) => c.id === id);
    const { error } = await supabase.from("contacts").update(patch).eq("id", id);
    if (error) return error;
    if (patch.stage && previous && patch.stage !== previous.stage) {
      await supabase.from("deal_stage_history").insert({
        contact_id: id,
        organization_id: profile.organization_id,
        from_stage: previous.stage,
        to_stage: patch.stage,
        changed_by: profile.id,
      });
    }
    loadData();
    return null;
  };

  const removeContact = async (id) => {
    await supabase.from("contacts").delete().eq("id", id);
    loadData();
  };

  const addTask = async (task) => {
    await supabase.from("tasks").insert({
      organization_id: profile.organization_id,
      created_by: profile.id,
      contact_id: task.contact_id || null,
      title: task.title,
      due_date: task.due_date || null,
    });
    loadData();
  };

  const toggleTask = async (id, done) => {
    await supabase.from("tasks").update({ done: !done }).eq("id", id);
    loadData();
  };

  const removeTask = async (id) => {
    await supabase.from("tasks").delete().eq("id", id);
    loadData();
  };

  if (session === undefined) return <LoadingScreen text="Carregando…" />;
  if (!session) return <AuthScreen />;
  if (!profile || !org) return <LoadingScreen text="Preparando sua conta…" />;

  const remaining = daysLeft(org.trial_ends_at);
  const isActive = org.subscription_status === "active";
  const trialExpired = !isActive && remaining !== null && remaining <= 0;

  if (trialExpired) {
    return <Paywall />;
  }

  return (
    <div style={styles.app}>
      <style>{globalCss}</style>
      <Sidebar tab={tab} setTab={setTab} />
      <div style={styles.main}>
        {!isActive && remaining !== null && <TrialBanner daysLeft={remaining} />}
        {tab === "painel" && <Painel contacts={contacts} tasks={tasks} />}
        {tab === "contatos" && (
          <Contatos contacts={contacts} onAdd={addContact} onEdit={editContact} onRemove={removeContact} />
        )}
        {tab === "funil" && <Funil contacts={contacts} onEdit={editContact} />}
        {tab === "graficos" && <Graficos contacts={contacts} />}
        {tab === "tarefas" && (
          <Tarefas tasks={tasks} contacts={contacts} onAdd={addTask} onToggle={toggleTask} onRemove={removeTask} />
        )}
        {tab === "dados" && <Dados profile={profile} org={org} email={session?.user?.email} />}
        {tab === "ajuda" && <Ajuda />}
        {tab === "planos" && <Planos org={org} remaining={remaining} isActive={isActive} />}
        {tab === "pagamentos" && <Pagamentos org={org} isActive={isActive} />}
      </div>
    </div>
  );
}

function TrialBanner({ daysLeft }) {
  return (
    <div style={styles.trialBanner}>
      <span>
        {daysLeft > 0
          ? `Seu período de teste termina em ${daysLeft} dia${daysLeft === 1 ? "" : "s"}.`
          : "Seu período de teste termina hoje."}
      </span>
      <a href={STRIPE_PAYMENT_LINK} style={styles.trialBannerLink}>
        Assinar agora
      </a>
    </div>
  );
}

function Paywall() {
  return (
    <div style={styles.authWrap}>
      <style>{globalCss}</style>
      <div style={styles.authCard}>
        <div style={styles.brand}>
          <span style={styles.brandMark}>●</span>
          <span style={{ color: "#1C2127" }}>Elo</span>
        </div>
        <p style={{ fontSize: 13.5, color: "#5B626B", lineHeight: 1.5, marginBottom: 18 }}>
          Seu período de teste grátis acabou. Assine para continuar usando o Elo e manter acesso aos seus
          contatos, funil e tarefas.
        </p>
        <a
          href={STRIPE_PAYMENT_LINK}
          style={{ ...styles.primaryBtn, width: "100%", justifyContent: "center", textDecoration: "none" }}
        >
          Assinar agora
        </a>
        <button
          style={{ ...styles.secondaryBtn, width: "100%", justifyContent: "center", marginTop: 10 }}
          onClick={() => supabase.auth.signOut()}
        >
          Sair
        </button>
      </div>
    </div>
  );
}

function LoadingScreen({ text }) {
  return (
    <div style={{ ...styles.app, alignItems: "center", justifyContent: "center" }}>
      <style>{globalCss}</style>
      <div style={{ color: "#5B626B", fontSize: 14 }}>{text}</div>
    </div>
  );
}

/* ============================================================
   LOGIN / CADASTRO
   ============================================================ */

function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    setInfo("");
    setLoading(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, company_name: companyName } },
      });
      if (error) setError(error.message);
      else setInfo("Conta criada. Se a confirmação por e-mail estiver ativa, verifique sua caixa de entrada.");
    }
    setLoading(false);
  };

  return (
    <div style={styles.authPage}>
      <style>{globalCss}</style>

      <div style={styles.authBrandPanel} className="elo-auth-brand">
        <div style={styles.authBrandContent}>
          <div style={styles.brand}>
            <span style={styles.brandMark}>●</span>
            <span style={{ color: "#FFFFFF" }}>Elo</span>
          </div>
          <div style={styles.authByHirsch}>by Hirsch</div>
          <h1 style={styles.authPitchTitle}>Um sistema simples para quem cuida do negócio sozinho.</h1>
          <p style={styles.authPitchSub}>
            O Elo existe para facilitar o dia a dia de pequenos empreendedores: uma ferramenta rápida e direta,
            sem complicação, para você enxergar seus contatos, seu funil e suas tarefas com clareza — e continuar
            focado em vender.
          </p>
          <div style={styles.authPitchList}>
            <div style={styles.authPitchItem}>
              <CheckCircle2 size={16} style={styles.authPitchIcon} />
              <span>Visão clara do seu negócio em um só lugar</span>
            </div>
            <div style={styles.authPitchItem}>
              <CheckCircle2 size={16} style={styles.authPitchIcon} />
              <span>Rápido de usar, sem curva de aprendizado</span>
            </div>
            <div style={styles.authPitchItem}>
              <CheckCircle2 size={16} style={styles.authPitchIcon} />
              <span>Pensado para quem trabalha sozinho ou em equipes pequenas</span>
            </div>
          </div>
          <div style={styles.authSupportNote}>Suporte próximo, sempre que você precisar.</div>
        </div>
      </div>

      <div style={styles.authFormPanel}>
        <div style={styles.authCard}>
          <div style={styles.authTabs}>
            <button style={{ ...styles.authTab, ...(mode === "login" ? styles.authTabActive : {}) }} onClick={() => setMode("login")}>
              Entrar
            </button>
            <button style={{ ...styles.authTab, ...(mode === "signup" ? styles.authTabActive : {}) }} onClick={() => setMode("signup")}>
              Criar conta
            </button>
          </div>

          {mode === "signup" && (
            <>
              <Field label="Seu nome">
                <input style={styles.input} value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </Field>
              <Field label="Nome da empresa">
                <input style={styles.input} value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </Field>
            </>
          )}
          <Field label="E-mail">
            <input style={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Senha">
            <input style={styles.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
          </Field>

          {error && <div style={styles.authError}>{error}</div>}
          {info && <div style={styles.authInfo}>{info}</div>}

          <button style={{ ...styles.primaryBtn, width: "100%", justifyContent: "center", marginTop: 6 }} onClick={submit} disabled={loading}>
            {loading ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   SIDEBAR
   ============================================================ */

function Sidebar({ tab, setTab }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const items = [
    { id: "painel", label: "Painel", icon: LayoutGrid },
    { id: "contatos", label: "Contatos", icon: Users },
    { id: "funil", label: "Funil", icon: Columns3 },
    { id: "graficos", label: "Gráficos", icon: TrendingUp },
    { id: "tarefas", label: "Tarefas", icon: CheckSquare },
  ];
  const settingsItems = [
    { id: "dados", label: "Dados", icon: User },
    { id: "ajuda", label: "Ajuda", icon: HelpCircle },
    { id: "planos", label: "Planos", icon: Layers },
    { id: "pagamentos", label: "Pagamentos", icon: Receipt },
  ];
  const settingsActive = settingsItems.some((it) => it.id === tab);

  return (
    <div style={styles.sidebar} className="elo-sidebar">
      <div style={styles.brand}>
        <span style={styles.brandMark}>●</span>
        <span>Elo</span>
      </div>
      <nav style={styles.nav} className="elo-nav">
        {items.map((it) => {
          const Icon = it.icon;
          const active = tab === it.id;
          return (
            <button key={it.id} onClick={() => setTab(it.id)} style={{ ...styles.navBtn, ...(active ? styles.navBtnActive : {}) }}>
              <Icon size={17} strokeWidth={2} />
              <span className="elo-nav-label">{it.label}</span>
            </button>
          );
        })}
      </nav>

      <div style={styles.sidebarBottom}>
        {settingsOpen && (
          <div style={styles.settingsMenu}>
            {settingsItems.map((it) => {
              const Icon = it.icon;
              const active = tab === it.id;
              return (
                <button
                  key={it.id}
                  onClick={() => {
                    setTab(it.id);
                    setSettingsOpen(false);
                  }}
                  style={{ ...styles.settingsMenuItem, ...(active ? styles.settingsMenuItemActive : {}) }}
                >
                  <Icon size={15} strokeWidth={2} />
                  <span>{it.label}</span>
                </button>
              );
            })}
          </div>
        )}
        <button
          style={{ ...styles.navBtn, ...(settingsActive ? styles.navBtnActive : {}) }}
          onClick={() => setSettingsOpen((v) => !v)}
        >
          <Settings size={17} strokeWidth={2} />
          <span className="elo-nav-label">Configurações</span>
        </button>
        <button style={styles.logoutBtn} onClick={() => supabase.auth.signOut()}>
          <LogOut size={15} />
          <span className="elo-nav-label">Sair</span>
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   PAINEL
   ============================================================ */

function Painel({ contacts, tasks }) {
  const [rangeMode, setRangeMode] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const scoped = contacts.filter((c) => inDateRange(c.created_at, rangeMode, customFrom, customTo));

  const open = scoped.filter((c) => c.stage !== "ganho" && c.stage !== "perdido");
  const won = scoped.filter((c) => c.stage === "ganho");
  const lost = scoped.filter((c) => c.stage === "perdido");
  const pendingTasks = tasks.filter((t) => !t.done);
  const pipelineValue = open.reduce((s, c) => s + Number(c.value || 0), 0);
  const wonValue = won.reduce((s, c) => s + Number(c.value || 0), 0);
  const closedTotal = won.length + lost.length;
  const conversionRate = closedTotal === 0 ? null : (won.length / closedTotal) * 100;

  const dueReminders = scoped
    .filter((c) => c.next_reminder_date && reminderState(c.next_reminder_date) !== "futuro")
    .sort((a, b) => a.next_reminder_date.localeCompare(b.next_reminder_date));

  const chartData = STAGES.map((s) => ({
    name: s.label,
    valor: scoped.filter((c) => c.stage === s.id).reduce((sum, c) => sum + Number(c.value || 0), 0),
    color: s.color,
  }));

  return (
    <div>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.h1}>Painel</h1>
          <p style={styles.sub}>Como está o seu negócio agora.</p>
        </div>
        <DateRangePicker
          mode={rangeMode}
          from={customFrom}
          to={customTo}
          onChangeMode={setRangeMode}
          onChangeFrom={setCustomFrom}
          onChangeTo={setCustomTo}
        />
      </div>

      <div style={styles.cardsRow}>
        <MetricCard label="Contatos no período" value={scoped.length} />
        <MetricCard label="Em negociação" value={fmtMoney(pipelineValue)} />
        <MetricCard label="Fechado (ganho)" value={fmtMoney(wonValue)} accent="#3C8558" />
        <MetricCard
          label="Taxa de conversão"
          value={conversionRate === null ? "—" : `${conversionRate.toFixed(0)}%`}
          accent="#2F6F63"
        />
        <MetricCard label="Tarefas pendentes" value={pendingTasks.length} />
      </div>

      <div style={styles.panel}>
        <div style={styles.panelHeader}>Valor por etapa do funil</div>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="#E7E8E3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#5B626B" }} interval={0} angle={-12} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11, fill: "#5B626B" }} tickFormatter={(v) => `R$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
              <Tooltip formatter={(v) => fmtMoney(v)} contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #DFE1DC" }} />
              <Bar dataKey="valor" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={styles.panel}>
        <div style={styles.panelHeader}>
          <Bell size={13} style={{ marginRight: 6, verticalAlign: -2 }} />
          Lembretes de contato
        </div>
        {dueReminders.length === 0 ? (
          <EmptyRow text="Nenhum lembrete vencido ou para hoje." />
        ) : (
          dueReminders.slice(0, 6).map((c) => {
            const state = reminderState(c.next_reminder_date);
            return (
              <div key={c.id} style={styles.taskRowMini}>
                <Circle size={7} fill={state === "vencido" ? "#B5493A" : "#B8823A"} color={state === "vencido" ? "#B5493A" : "#B8823A"} />
                <span style={{ flex: 1 }}>{c.name}</span>
                <span style={{ ...styles.taskMiniDate, color: state === "vencido" ? "#B5493A" : "#9AA0A6" }}>
                  {state === "vencido" ? "Venceu " : "Hoje "}
                  {fmtDate(c.next_reminder_date)}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div style={styles.panel}>
        <div style={styles.panelHeader}>Próximas tarefas</div>
        {pendingTasks.length === 0 ? (
          <EmptyRow text="Nenhuma tarefa pendente." />
        ) : (
          pendingTasks
            .slice()
            .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))
            .slice(0, 5)
            .map((t) => {
              const c = contacts.find((c) => c.id === t.contact_id);
              return (
                <div key={t.id} style={styles.taskRowMini}>
                  <Circle size={7} fill="#B8823A" color="#B8823A" />
                  <span style={{ flex: 1 }}>{t.title}</span>
                  {c && <span style={styles.taskMiniContact}>{c.name}</span>}
                  <span style={styles.taskMiniDate}>{fmtDate(t.due_date)}</span>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, accent }) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={{ ...styles.metricValue, color: accent || "#1C2127" }}>{value}</div>
    </div>
  );
}

function EmptyRow({ text }) {
  return <div style={styles.emptyRow}>{text}</div>;
}

function DateRangePicker({ mode, from, to, onChangeMode, onChangeFrom, onChangeTo }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={styles.datePicker}>
      <button style={styles.dateBtn} onClick={() => setOpen((v) => !v)}>
        <Calendar size={14} />
        <span>{dateRangeLabel(mode, from, to)}</span>
        <ChevronDown size={14} style={styles.dateChev} />
      </button>
      {open && (
        <>
          <div style={styles.dateBackdrop} onClick={() => setOpen(false)} />
          <div style={styles.dateDropdown}>
            {DATE_RANGE_OPTIONS.map((opt) => (
              <div
                key={opt.id}
                style={{ ...styles.dateOpt, ...(mode === opt.id ? styles.dateOptActive : {}) }}
                onClick={() => {
                  onChangeMode(opt.id);
                  setOpen(false);
                }}
              >
                {opt.label}
              </div>
            ))}
            <div style={styles.dateCustom}>
              <div style={styles.dateCustomLabel}>PERÍODO PERSONALIZADO</div>
              <div style={styles.dateInputs}>
                <input
                  type="date"
                  style={styles.dateInput}
                  value={from}
                  onChange={(e) => {
                    onChangeFrom(e.target.value);
                    onChangeMode("custom");
                  }}
                />
                <span style={{ color: "#9CA3AF" }}>→</span>
                <input
                  type="date"
                  style={styles.dateInput}
                  value={to}
                  onChange={(e) => {
                    onChangeTo(e.target.value);
                    onChangeMode("custom");
                  }}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================
   CONTATOS
   ============================================================ */

function Contatos({ contacts, onAdd, onEdit, onRemove }) {
  const [query, setQuery] = useState("");
  const [dateMode, setDateMode] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [reminderOnly, setReminderOnly] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = contacts.filter((c) => {
    const q = query.toLowerCase();
    const matchesQuery = c.name.toLowerCase().includes(q) || (c.company || "").toLowerCase().includes(q);
    if (!matchesQuery) return false;

    if (!inDateRange(c.created_at, dateMode, customFrom, customTo)) return false;

    if (reminderOnly) {
      const state = c.next_reminder_date ? reminderState(c.next_reminder_date) : null;
      if (state !== "vencido" && state !== "hoje") return false;
    }
    return true;
  });

  const openNew = () => {
    setEditing({
      name: "",
      company: "",
      email: "",
      phone: "",
      value: "",
      stage: "novo",
      notes: "",
      last_contact_date: "",
      next_reminder_date: "",
      loss_reason: "",
      lead_source: "",
    });
    setShowForm(true);
    setSaveError("");
  };

  const openEdit = (c) => {
    setEditing({ ...c });
    setShowForm(true);
    setSaveError("");
  };

  const save = async () => {
    if (!editing.name.trim()) return;
    setSaving(true);
    setSaveError("");
    let error = null;
    if (editing.id) {
      const { id, created_at, organization_id, created_by, ...patch } = editing;
      error = await onEdit(id, patch);
    } else {
      error = await onAdd(editing);
    }
    setSaving(false);
    if (error) {
      setSaveError(error.message || "Não foi possível salvar o contato.");
      return;
    }
    setShowForm(false);
    setEditing(null);
  };

  return (
    <div>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.h1}>Contatos</h1>
          <p style={styles.sub}>{contacts.length} no total</p>
        </div>
        <button style={styles.primaryBtn} onClick={openNew}>
          <Plus size={16} /> Novo contato
        </button>
      </div>

      <div style={styles.filterRow}>
        <div style={styles.searchBar}>
          <Search size={15} color="#9AA0A6" />
          <input placeholder="Buscar por nome ou empresa…" value={query} onChange={(e) => setQuery(e.target.value)} style={styles.searchInput} />
        </div>
        <DateRangePicker
          mode={dateMode}
          from={customFrom}
          to={customTo}
          onChangeMode={setDateMode}
          onChangeFrom={setCustomFrom}
          onChangeTo={setCustomTo}
        />
        <button
          style={{ ...styles.filterToggle, ...(reminderOnly ? styles.filterToggleActive : {}) }}
          onClick={() => setReminderOnly((v) => !v)}
        >
          <Bell size={13} /> Só lembretes pendentes
        </button>
      </div>

      <div style={styles.panel}>
        {filtered.length === 0 ? (
          <EmptyRow text="Nenhum contato encontrado." />
        ) : (
          filtered.map((c) => {
            const state = c.next_reminder_date ? reminderState(c.next_reminder_date) : null;
            return (
              <div key={c.id} style={styles.contactRow}>
                <div style={{ ...styles.stageTab, background: stageInfo(c.stage).color }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.contactName}>{c.name}</div>
                  <div style={styles.contactMeta}>
                    <Building2 size={12} /> {c.company || "—"}
                  </div>
                </div>
                <div style={styles.contactContactInfo} className="elo-hide-narrow">
                  {c.email && (
                    <div style={styles.contactMeta}>
                      <Mail size={12} /> {c.email}
                    </div>
                  )}
                  {c.phone && (
                    <div style={styles.contactMeta}>
                      <Phone size={12} /> {c.phone}
                    </div>
                  )}
                </div>
                <div style={styles.datesCol} className="elo-hide-narrow">
                  <div style={styles.dateLine}>Entrada: {fmtDate(c.created_at)}</div>
                  {c.last_contact_date && <div style={styles.dateLine}>Últ. contato: {fmtDate(c.last_contact_date)}</div>}
                  {c.next_reminder_date && (
                    <div style={{ ...styles.dateLine, color: state === "vencido" ? "#B5493A" : state === "hoje" ? "#B8823A" : "#6B7178" }}>
                      <Bell size={10} style={{ marginRight: 3, verticalAlign: -1 }} />
                      {fmtDate(c.next_reminder_date)}
                    </div>
                  )}
                </div>
                <div style={styles.contactValue}>{fmtMoney(c.value)}</div>
                <span style={{ ...styles.badge, color: stageInfo(c.stage).color, borderColor: stageInfo(c.stage).color }}>
                  {stageInfo(c.stage).label}
                </span>
                <button style={styles.iconBtn} onClick={() => openEdit(c)}>
                  <Pencil size={14} />
                </button>
                <button style={styles.iconBtn} onClick={() => onRemove(c.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {showForm && (
        <Modal onClose={() => setShowForm(false)} title={editing.id ? "Editar contato" : "Novo contato"}>
          <Field label="Nome">
            <input style={styles.input} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus />
          </Field>
          <Field label="Empresa">
            <input style={styles.input} value={editing.company} onChange={(e) => setEditing({ ...editing, company: e.target.value })} />
          </Field>
          <div style={styles.fieldRow}>
            <Field label="E-mail">
              <input style={styles.input} value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
            </Field>
            <Field label="Telefone">
              <input style={styles.input} value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
            </Field>
          </div>
          <div style={styles.fieldRow}>
            <Field label="Valor estimado (R$)">
              <input style={styles.input} type="number" value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} />
            </Field>
            <Field label="Etapa">
              <select style={styles.input} value={editing.stage} onChange={(e) => setEditing({ ...editing, stage: e.target.value })}>
                {STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Origem do lead">
            <select
              style={styles.input}
              value={editing.lead_source || ""}
              onChange={(e) => setEditing({ ...editing, lead_source: e.target.value })}
            >
              {LEAD_SOURCES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>

          {editing.id && (
            <Field label="Data de entrada">
              <input style={{ ...styles.input, color: "#9AA0A6" }} value={fmtDate(editing.created_at) + " (fixa)"} disabled />
            </Field>
          )}

          <div style={styles.fieldRow}>
            <Field label="Data do último contato">
              <input
                style={styles.input}
                type="date"
                value={editing.last_contact_date || ""}
                onChange={(e) => setEditing({ ...editing, last_contact_date: e.target.value })}
              />
            </Field>
            <Field label="Lembrete p/ próximo contato">
              <input
                style={styles.input}
                type="date"
                value={editing.next_reminder_date || ""}
                onChange={(e) => setEditing({ ...editing, next_reminder_date: e.target.value })}
              />
            </Field>
          </div>

          {editing.stage === "perdido" && (
            <Field label="Motivo da perda">
              <input
                style={styles.input}
                placeholder="Ex: preço, timing, escolheu concorrente…"
                value={editing.loss_reason || ""}
                onChange={(e) => setEditing({ ...editing, loss_reason: e.target.value })}
              />
            </Field>
          )}

          <Field label="Notas">
            <textarea style={{ ...styles.input, minHeight: 70, resize: "vertical" }} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
          </Field>
          {saveError && <div style={styles.authError}>{saveError}</div>}
          <div style={styles.modalFoot}>
            <button style={styles.secondaryBtn} onClick={() => setShowForm(false)}>
              Cancelar
            </button>
            <button style={styles.primaryBtn} onClick={save} disabled={saving}>
              {saving ? "Salvando…" : "Salvar contato"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ============================================================
   FUNIL
   ============================================================ */

function Funil({ contacts, onEdit }) {
  const [dragId, setDragId] = useState(null);
  const moveStage = (id, stage) => onEdit(id, { stage });

  return (
    <div>
      <h1 style={styles.h1}>Funil de vendas</h1>
      <p style={styles.sub}>Arraste os cartões entre as etapas, ou use o menu de cada um.</p>
      <div style={styles.kanban}>
        {STAGES.map((stage) => {
          const items = contacts.filter((c) => c.stage === stage.id);
          const total = items.reduce((s, c) => s + Number(c.value || 0), 0);
          return (
            <div
              key={stage.id}
              style={styles.kanbanCol}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) moveStage(dragId, stage.id);
              }}
            >
              <div style={styles.kanbanColHeader}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Circle size={7} fill={stage.color} color={stage.color} />
                  {stage.label}
                </span>
                <span style={styles.kanbanColCount}>{items.length}</span>
              </div>
              <div style={styles.kanbanColTotal}>{fmtMoney(total)}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {items.map((c) => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={() => setDragId(c.id)}
                    onDragEnd={() => setDragId(null)}
                    style={{ ...styles.kanbanCard, borderLeft: `3px solid ${stage.color}` }}
                  >
                    <div style={styles.kanbanCardName}>{c.name}</div>
                    <div style={styles.kanbanCardCompany}>{c.company}</div>
                    <div style={styles.kanbanCardValue}>{fmtMoney(c.value)}</div>
                    <select value={c.stage} onChange={(e) => moveStage(c.id, e.target.value)} style={styles.kanbanCardSelect}>
                      {STAGES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   GRÁFICOS
   ============================================================ */

function Graficos({ contacts }) {
  const months = lastMonthKeys(6);
  const revenueData = months.map((key) => ({
    name: monthLabel(key),
    valor: contacts
      .filter((c) => c.stage === "ganho" && monthKey(c.created_at) === key)
      .reduce((s, c) => s + Number(c.value || 0), 0),
  }));

  const won = contacts.filter((c) => c.stage === "ganho");
  const lost = contacts.filter((c) => c.stage === "perdido");
  const closedTotal = won.length + lost.length;
  const conversionRate = closedTotal === 0 ? null : (won.length / closedTotal) * 100;
  const closingData = [
    { name: "Ganho", qtd: won.length, color: "#15803D" },
    { name: "Perdido", qtd: lost.length, color: "#DC2626" },
  ];

  const sourceData = LEAD_SOURCES.map((s) => ({
    name: s.label,
    qtd: contacts.filter((c) => (c.lead_source || "") === s.id).length,
  })).filter((s) => s.qtd > 0);

  return (
    <div>
      <h1 style={styles.h1}>Gráficos</h1>
      <p style={styles.sub}>Uma visão simples do seu negócio ao longo do tempo.</p>

      <div style={styles.panel}>
        <div style={styles.panelHeader}>Faturamento fechado por mês</div>
        <div style={{ width: "100%", height: 200 }}>
          <ResponsiveContainer>
            <BarChart data={revenueData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="#E7E8E3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#5B626B" }} />
              <YAxis tick={{ fontSize: 11, fill: "#5B626B" }} tickFormatter={(v) => `R$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
              <Tooltip formatter={(v) => fmtMoney(v)} contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #DFE1DC" }} />
              <Bar dataKey="valor" radius={[3, 3, 0, 0]} fill="#22C55E" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={styles.panel}>
        <div style={styles.panelHeader}>
          Fechamento {conversionRate !== null && <span style={{ color: "#5B626B", fontWeight: 400 }}>— {conversionRate.toFixed(0)}% de conversão</span>}
        </div>
        {closedTotal === 0 ? (
          <EmptyRow text="Ainda não há contatos fechados (ganhos ou perdidos)." />
        ) : (
          <div style={{ width: "100%", height: 160 }}>
            <ResponsiveContainer>
              <BarChart data={closingData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
                <CartesianGrid stroke="#E7E8E3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#5B626B" }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "#374151" }} width={70} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #DFE1DC" }} />
                <Bar dataKey="qtd" radius={[0, 4, 4, 0]}>
                  {closingData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div style={styles.panel}>
        <div style={styles.panelHeader}>Origem dos leads</div>
        {sourceData.length === 0 ? (
          <EmptyRow text="Nenhum contato com origem informada ainda." />
        ) : (
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={sourceData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="#E7E8E3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#5B626B" }} interval={0} angle={-12} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11, fill: "#5B626B" }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #DFE1DC" }} />
                <Bar dataKey="qtd" radius={[3, 3, 0, 0]} fill="#60A5FA" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   TAREFAS
   ============================================================ */

function Tarefas({ tasks, contacts, onAdd, onToggle, onRemove }) {
  const [title, setTitle] = useState("");
  const [contactId, setContactId] = useState("");
  const [dueDate, setDueDate] = useState("");

  const add = () => {
    if (!title.trim()) return;
    onAdd({ title, contact_id: contactId || null, due_date: dueDate || null });
    setTitle("");
    setContactId("");
    setDueDate("");
  };

  const sorted = tasks.slice().sort((a, b) => Number(a.done) - Number(b.done) || (a.due_date || "").localeCompare(b.due_date || ""));

  return (
    <div>
      <h1 style={styles.h1}>Tarefas</h1>
      <p style={styles.sub}>{tasks.filter((t) => !t.done).length} pendentes</p>

      <div style={styles.panel}>
        <div style={styles.taskAddRow}>
          <input
            style={{ ...styles.input, flex: 2 }}
            placeholder="Nova tarefa…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <select style={{ ...styles.input, flex: 1 }} value={contactId} onChange={(e) => setContactId(e.target.value)}>
            <option value="">Sem contato</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input style={{ ...styles.input, flex: 1 }} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <button style={styles.primaryBtn} onClick={add}>
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div style={styles.panel}>
        {sorted.length === 0 ? (
          <EmptyRow text="Nenhuma tarefa ainda." />
        ) : (
          sorted.map((t) => {
            const c = contacts.find((c) => c.id === t.contact_id);
            return (
              <div key={t.id} style={styles.taskRow}>
                <button style={styles.checkBtn} onClick={() => onToggle(t.id, t.done)}>
                  {t.done ? <CheckCircle2 size={18} color="#3C8558" /> : <Circle size={18} color="#9AA0A6" />}
                </button>
                <span style={{ flex: 1, textDecoration: t.done ? "line-through" : "none", color: t.done ? "#9AA0A6" : "#1C2127" }}>
                  {t.title}
                </span>
                {c && <span style={styles.taskMiniContact}>{c.name}</span>}
                {t.due_date && (
                  <span style={styles.taskMiniDate}>
                    <Calendar size={11} style={{ marginRight: 3, verticalAlign: -1 }} />
                    {fmtDate(t.due_date)}
                  </span>
                )}
                <button style={styles.iconBtn} onClick={() => onRemove(t.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ============================================================
   DADOS
   ============================================================ */

function Dados({ profile, org, email }) {
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [companyName, setCompanyName] = useState(org?.name || "");
  const [jobTitle, setJobTitle] = useState(profile?.job_title || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    await supabase.from("profiles").update({ full_name: fullName, job_title: jobTitle }).eq("id", profile.id);
    await supabase.from("organizations").update({ name: companyName }).eq("id", org.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const changePassword = async () => {
    setPwError("");
    setPwSaved(false);
    if (newPassword.length < 6) {
      setPwError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("As senhas não são iguais.");
      return;
    }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwSaving(false);
    if (error) {
      setPwError(error.message);
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    setPwSaved(true);
    setTimeout(() => setPwSaved(false), 2500);
  };

  return (
    <div>
      <h1 style={styles.h1}>Dados</h1>
      <p style={styles.sub}>Informações da sua conta e da sua empresa.</p>

      <div style={styles.panel}>
        <div style={styles.panelHeader}>Sua conta</div>
        <Field label="Seu nome">
          <input style={styles.input} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="E-mail de acesso">
          <input style={{ ...styles.input, color: "#9AA0A6" }} value={email || ""} disabled />
        </Field>
      </div>

      <div style={styles.panel}>
        <div style={styles.panelHeader}>Empresa</div>
        <Field label="Nome da empresa">
          <input style={styles.input} value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
        </Field>
        <Field label="Seu cargo (opcional)">
          <input
            style={styles.input}
            placeholder="Ex: Dono(a), Gerente, Vendedor…"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
          />
        </Field>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <button style={styles.primaryBtn} onClick={save} disabled={saving}>
          {saving ? "Salvando…" : "Salvar alterações"}
        </button>
        {saved && <span style={{ fontSize: 13, color: "#15803D", fontWeight: 600 }}>Salvo!</span>}
      </div>

      <div style={styles.panel}>
        <div style={styles.panelHeader}>Alterar senha</div>
        <div style={styles.fieldRow}>
          <Field label="Nova senha">
            <input style={styles.input} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </Field>
          <Field label="Confirmar nova senha">
            <input style={styles.input} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </Field>
        </div>
        {pwError && <div style={styles.authError}>{pwError}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button style={styles.secondaryBtn} onClick={changePassword} disabled={pwSaving}>
            {pwSaving ? "Alterando…" : "Alterar senha"}
          </button>
          {pwSaved && <span style={{ fontSize: 13, color: "#15803D", fontWeight: 600 }}>Senha alterada!</span>}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   AJUDA
   ============================================================ */

function Ajuda() {
  const faqs = [
    {
      q: "Como cadastro um novo contato?",
      a: "Vá em Contatos e clique em “+ Novo”. Preencha os dados e escolha a etapa do funil.",
    },
    {
      q: "Como movo um contato entre etapas do funil?",
      a: "Na tela Funil, arraste o contato para a coluna da etapa desejada, ou edite o contato e altere o campo Etapa.",
    },
    {
      q: "Como funciona o período de teste?",
      a: "Toda conta nova começa com alguns dias de teste grátis, sem precisar de cartão. Você pode acompanhar quanto tempo resta em Planos.",
    },
    {
      q: "Meus dados ficam seguros?",
      a: "Sim. Cada empresa só enxerga seus próprios contatos e tarefas — o acesso é isolado por conta.",
    },
  ];

  return (
    <div>
      <h1 style={styles.h1}>Ajuda</h1>
      <p style={styles.sub}>Dúvidas comuns e como falar com a gente.</p>

      <div style={styles.panel}>
        <div style={styles.panelHeader}>Perguntas frequentes</div>
        {faqs.map((f, i) => (
          <div key={i} style={{ padding: "12px 2px", borderTop: i === 0 ? "none" : "1px solid #F1F2F0" }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>{f.q}</div>
            <div style={{ fontSize: 13, color: "#5B626B", lineHeight: 1.5 }}>{f.a}</div>
          </div>
        ))}
      </div>

      <div style={styles.panel}>
        <div style={styles.panelHeader}>Precisa de mais ajuda?</div>
        <p style={{ fontSize: 13, color: "#5B626B", lineHeight: 1.5 }}>
          Fale com a gente pelo e-mail{" "}
          <a href="mailto:suporte@hirschgrowth.com.br" style={{ color: "#15803D", fontWeight: 600 }}>
            suporte@hirschgrowth.com.br
          </a>
          .
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   PLANOS
   ============================================================ */

function Planos({ org, remaining, isActive }) {
  return (
    <div>
      <h1 style={styles.h1}>Planos</h1>
      <p style={styles.sub}>Acompanhe seu período de teste e o plano do Elo.</p>

      <div style={styles.panel}>
        <div style={styles.panelHeader}>Status atual</div>
        <p style={{ fontSize: 13.5, color: "#374151", marginBottom: 4 }}>
          {isActive
            ? "Assinatura ativa."
            : remaining !== null && remaining > 0
            ? `Período de teste — faltam ${remaining} dia${remaining === 1 ? "" : "s"}.`
            : "Período de teste encerrado."}
        </p>
      </div>

      <div style={styles.panel}>
        <div style={styles.panelHeader}>Plano Elo</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 26, fontWeight: 700 }}>Em breve</span>
        </div>
        <p style={{ fontSize: 13, color: "#5B626B", lineHeight: 1.5, marginBottom: 14 }}>
          Contatos, funil de vendas, tarefas e lembretes ilimitados para sua empresa. O valor da assinatura ainda
          será definido — por enquanto, aproveite o período de teste gratuito.
        </p>
        <a
          href={STRIPE_PAYMENT_LINK}
          style={{ ...styles.primaryBtn, textDecoration: "none", display: "inline-flex" }}
        >
          Assinar agora
        </a>
      </div>
    </div>
  );
}

/* ============================================================
   PAGAMENTOS
   ============================================================ */

function Pagamentos({ org, isActive }) {
  return (
    <div>
      <h1 style={styles.h1}>Pagamentos</h1>
      <p style={styles.sub}>Assinatura e histórico de cobranças.</p>

      <div style={styles.panel}>
        <div style={styles.panelHeader}>Assinatura</div>
        <p style={{ fontSize: 13.5, color: "#374151", marginBottom: 10 }}>
          Status: <strong>{isActive ? "Ativa" : org?.subscription_status === "trialing" ? "Em teste" : org?.subscription_status || "—"}</strong>
        </p>
        {!isActive && (
          <a
            href={STRIPE_PAYMENT_LINK}
            style={{ ...styles.primaryBtn, textDecoration: "none", display: "inline-flex" }}
          >
            Assinar agora
          </a>
        )}
      </div>

      <div style={styles.panel}>
        <div style={styles.panelHeader}>Histórico de cobranças</div>
        <EmptyRow text="Nenhuma cobrança realizada ainda." />
      </div>
    </div>
  );
}

/* ============================================================
   PEÇAS COMPARTILHADAS
   ============================================================ */

function Modal({ title, children, onClose }) {
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <span>{title}</span>
          <button style={styles.iconBtn} onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: "16px 20px" }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12, flex: 1 }}>
      <div style={styles.fieldLabel}>{label}</div>
      {children}
    </div>
  );
}

/* ============================================================
   ESTILOS
   ============================================================ */

const FONT_STACK = "'Montserrat', -apple-system, BlinkMacSystemFont, \"Segoe UI\", Helvetica, Arial, sans-serif";

const styles = {
  app: {
    display: "flex",
    minHeight: "100vh",
    width: "100%",
    fontFamily: FONT_STACK,
    background: "#F3F4F1",
    color: "#0D0C1F",
    fontSize: 14,
  },
  sidebar: { width: 210, flexShrink: 0, background: "#0D0C1F", color: "#EDEEEA", display: "flex", flexDirection: "column", padding: "20px 14px" },
  brand: { display: "flex", alignItems: "center", gap: 8, fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em", padding: "0 6px 22px 6px" },
  brandMark: { color: "#22C55E", fontSize: 12 },
  nav: { display: "flex", flexDirection: "column", gap: 2 },
  navBtn: { display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, border: "none", background: "transparent", color: "#9CA3AF", fontSize: 13.5, cursor: "pointer", textAlign: "left" },
  navBtnActive: { background: "#1C2432", color: "#FFFFFF", fontWeight: 600 },
  sidebarBottom: { marginTop: "auto", display: "flex", flexDirection: "column", gap: 2, position: "relative" },
  settingsMenu: {
    position: "absolute",
    bottom: "calc(100% + 6px)",
    left: 0,
    right: 0,
    background: "#1C2432",
    border: "1px solid #2A3242",
    borderRadius: 10,
    padding: 6,
    display: "flex",
    flexDirection: "column",
    gap: 2,
    boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
  },
  settingsMenuItem: { display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 7, border: "none", background: "transparent", color: "#B8BEC9", fontSize: 13, cursor: "pointer", textAlign: "left" },
  settingsMenuItemActive: { background: "#22C55E22", color: "#4ADE80", fontWeight: 600 },
  logoutBtn: { display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, border: "none", background: "transparent", color: "#6B7280", fontSize: 13, cursor: "pointer" },
  main: { flex: 1, padding: "26px 32px", overflowY: "auto" },
  h1: { fontSize: 21, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" },
  sub: { fontSize: 13, color: "#6B7178", margin: "4px 0 18px 0" },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 },
  cardsRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 },
  metricCard: { background: "#FFFFFF", border: "1px solid #E2E3DE", borderRadius: 8, padding: "14px 16px" },
  metricLabel: { fontSize: 12, color: "#6B7178", marginBottom: 6 },
  metricValue: { fontSize: 21, fontWeight: 600, letterSpacing: "-0.01em" },
  panel: { background: "#FFFFFF", border: "1px solid #E2E3DE", borderRadius: 8, padding: 18, marginBottom: 18 },
  panelHeader: { fontSize: 13.5, fontWeight: 600, marginBottom: 12 },
  emptyRow: { color: "#9AA0A6", fontSize: 13, padding: "10px 2px" },
  taskRowMini: { display: "flex", alignItems: "center", gap: 9, padding: "7px 0", borderTop: "1px solid #EFF0EC", fontSize: 13 },
  taskMiniContact: { color: "#6B7178", fontSize: 12 },
  taskMiniDate: { color: "#9AA0A6", fontSize: 12, marginLeft: 6, whiteSpace: "nowrap" },
  filterRow: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 },
  searchBar: { display: "flex", alignItems: "center", gap: 8, background: "#FFFFFF", border: "1px solid #E2E3DE", borderRadius: 7, padding: "8px 12px", maxWidth: 300, flex: 1 },
  searchInput: { border: "none", outline: "none", flex: 1, fontSize: 13.5, background: "transparent", color: "#1C2127" },
  filterSelect: { border: "1px solid #E2E3DE", borderRadius: 7, padding: "8px 10px", fontSize: 12.5, background: "#FFFFFF", color: "#5B626B" },
  filterToggle: { display: "flex", alignItems: "center", gap: 6, border: "1px solid #E2E3DE", borderRadius: 7, padding: "8px 12px", fontSize: 12.5, background: "#FFFFFF", color: "#5B626B", cursor: "pointer" },
  filterToggleActive: { background: "#EFFDF4", borderColor: "#22C55E", color: "#15803D" },
  contactRow: { display: "flex", alignItems: "center", gap: 12, padding: "10px 4px", borderTop: "1px solid #EFF0EC" },
  stageTab: { width: 4, alignSelf: "stretch", borderRadius: 2, minHeight: 30 },
  contactName: { fontWeight: 600, fontSize: 13.5 },
  contactMeta: { display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#6B7178" },
  contactContactInfo: { display: "flex", flexDirection: "column", gap: 2, width: 180 },
  datesCol: { display: "flex", flexDirection: "column", gap: 2, width: 130 },
  dateLine: { fontSize: 11, color: "#9AA0A6" },
  contactValue: { fontWeight: 600, fontSize: 13, width: 90, textAlign: "right" },
  badge: { fontSize: 11, padding: "3px 9px", borderRadius: 20, border: "1px solid", whiteSpace: "nowrap" },
  iconBtn: { border: "none", background: "transparent", color: "#9AA0A6", cursor: "pointer", padding: 5, borderRadius: 5 },
  primaryBtn: { display: "flex", alignItems: "center", gap: 6, background: "#22C55E", color: "#0D0C1F", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" },
  secondaryBtn: { background: "transparent", color: "#5B626B", border: "1px solid #DFE1DC", borderRadius: 8, padding: "9px 14px", fontSize: 13.5, cursor: "pointer" },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #DFE1DC", borderRadius: 6, padding: "8px 10px", fontSize: 13.5, fontFamily: "inherit", outline: "none", background: "#FCFCFB", color: "#0D0C1F", colorScheme: "light" },
  fieldRow: { display: "flex", gap: 12 },
  fieldLabel: { fontSize: 12, color: "#6B7178", marginBottom: 5 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(28,33,39,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 },
  modalBox: { background: "#FFFFFF", borderRadius: 10, width: 440, maxWidth: "92vw", maxHeight: "88vh", overflowY: "auto" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid #EFF0EC", fontWeight: 600, fontSize: 14.5 },
  modalFoot: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 },
  kanban: { display: "flex", gap: 14, overflowX: "auto", paddingBottom: 8 },
  kanbanCol: { background: "#FFFFFF", border: "1px solid #E2E3DE", borderRadius: 8, padding: 12, width: 210, flexShrink: 0 },
  kanbanColHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, fontWeight: 600 },
  kanbanColCount: { color: "#9AA0A6", fontWeight: 400 },
  kanbanColTotal: { fontSize: 12, color: "#6B7178", marginTop: 3 },
  kanbanCard: { background: "#FBFBFA", border: "1px solid #E7E8E3", borderRadius: 6, padding: "9px 10px", cursor: "grab" },
  kanbanCardName: { fontSize: 12.5, fontWeight: 600 },
  kanbanCardCompany: { fontSize: 11.5, color: "#6B7178", marginTop: 1 },
  kanbanCardValue: { fontSize: 12, fontWeight: 600, marginTop: 5 },
  kanbanCardSelect: { marginTop: 6, width: "100%", fontSize: 11, border: "1px solid #E2E3DE", borderRadius: 4, padding: "3px 4px", background: "#fff", color: "#5B626B" },
  taskAddRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  taskRow: { display: "flex", alignItems: "center", gap: 10, padding: "9px 2px", borderTop: "1px solid #EFF0EC", fontSize: 13.5 },
  checkBtn: { border: "none", background: "transparent", cursor: "pointer", padding: 2, display: "flex" },
  authWrap: { minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#F3F4F1", fontFamily: FONT_STACK },
  authPage: { minHeight: "100vh", width: "100%", display: "flex", fontFamily: FONT_STACK, background: "#F3F4F1" },
  authBrandPanel: {
    flex: "1 1 50%",
    background: "#0D0C1F",
    color: "#EDEEEA",
    display: "flex",
    alignItems: "center",
    padding: "48px",
  },
  authBrandContent: { maxWidth: 440, margin: "0 auto" },
  authByHirsch: { fontSize: 11.5, color: "#7C8493", fontWeight: 600, letterSpacing: "0.02em", marginTop: 6 },
  authSupportNote: { fontSize: 12, color: "#7C8493", marginTop: 30 },
  authPitchTitle: { fontSize: 28, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.25, margin: "28px 0 14px 0" },
  authPitchSub: { fontSize: 14, color: "#B8BEC9", lineHeight: 1.6, marginBottom: 26 },
  authPitchList: { display: "flex", flexDirection: "column", gap: 12 },
  authPitchItem: { display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13.5, color: "#EDEEEA" },
  authPitchIcon: { color: "#22C55E", flexShrink: 0, marginTop: 1 },
  authFormPanel: { flex: "1 1 50%", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 },
  authCard: { background: "#FFFFFF", border: "1px solid #E2E3DE", borderRadius: 10, padding: 28, width: 340 },
  authTabs: { display: "flex", gap: 4, background: "#F0F1EC", borderRadius: 7, padding: 3, marginBottom: 18 },
  authTab: { flex: 1, border: "none", background: "transparent", padding: "7px 0", borderRadius: 5, fontSize: 13, color: "#6B7178", cursor: "pointer" },
  authTabActive: { background: "#FFFFFF", color: "#0D0C1F", fontWeight: 600, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" },
  authError: { fontSize: 12.5, color: "#DC2626", background: "#FEF2F2", borderRadius: 6, padding: "8px 10px", marginBottom: 10 },
  authInfo: { fontSize: 12.5, color: "#15803D", background: "#EFFDF4", borderRadius: 6, padding: "8px 10px", marginBottom: 10 },
  trialBanner: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "#FFF7E8", border: "1px solid #F0DCA8", color: "#8A6A1F", borderRadius: 8, padding: "10px 16px", fontSize: 13, marginBottom: 18, flexWrap: "wrap" },
  trialBannerLink: { color: "#15803D", fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" },
  datePicker: { position: "relative" },
  dateBackdrop: { position: "fixed", inset: 0, zIndex: 19 },
  dateBtn: { display: "flex", alignItems: "center", gap: 8, background: "#FFFFFF", border: "1px solid #D1D5DB", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, color: "#0D0C1F", cursor: "pointer" },
  dateChev: { color: "#22C55E", fontSize: 11 },
  dateDropdown: { position: "absolute", right: 0, top: "calc(100% + 6px)", background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.10)", width: 270, padding: 8, zIndex: 20 },
  dateOpt: { padding: "9px 10px", borderRadius: 6, fontSize: 13, color: "#374151", cursor: "pointer" },
  dateOptActive: { background: "#EFFDF4", color: "#15803D", fontWeight: 700 },
  dateCustom: { borderTop: "1px solid #F1F2F0", marginTop: 6, paddingTop: 10, padding: 10 },
  dateCustomLabel: { fontSize: 11, color: "#6B7280", marginBottom: 6, fontWeight: 600 },
  dateInputs: { display: "flex", gap: 8, alignItems: "center" },
  dateInput: { flex: 1, border: "1px solid #D1D5DB", borderRadius: 6, padding: "6px 8px", fontSize: 12, color: "#0D0C1F" },
};

const globalCss = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap');
  html { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; width: 100%; min-height: 100%; }
  #root {
    max-width: none !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    text-align: left !important;
    display: block !important;
  }
  body { display: block !important; place-items: unset !important; }
  input, select, textarea, button { font-family: inherit; color: #0D0C1F; }
  input::placeholder, textarea::placeholder { color: #9AA0A6; opacity: 1; }
  input:focus, select:focus, textarea:focus { border-color: #22C55E !important; }
  @media (max-width: 640px) {
    .elo-sidebar { width: 60px !important; padding: 16px 8px !important; }
    .elo-nav-label { display: none; }
    .elo-hide-narrow { display: none !important; }
  }
  @media (max-width: 860px) {
    .elo-auth-brand { display: none !important; }
  }
`;
