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

const STAGES = [
  { id: "novo", label: "Novo lead", color: "#6E7C91" },
  { id: "qualificado", label: "Qualificado", color: "#4C7A8C" },
  { id: "proposta", label: "Proposta enviada", color: "#2F6F63" },
  { id: "negociacao", label: "Em negociação", color: "#B8823A" },
  { id: "ganho", label: "Ganho", color: "#3C8558" },
  { id: "perdido", label: "Perda", color: "#B5493A" },
];

const stageInfo = (id) => STAGES.find((s) => s.id === id) || STAGES[0];

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
    await supabase.from("contacts").insert({
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
    });
    loadData();
  };

  const editContact = async (id, patch) => {
    const previous = contacts.find((c) => c.id === id);
    await supabase.from("contacts").update(patch).eq("id", id);
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
  if (!profile) return <LoadingScreen text="Preparando sua conta…" />;

  return (
    <div style={styles.app}>
      <style>{globalCss}</style>
      <Sidebar tab={tab} setTab={setTab} />
      <div style={styles.main}>
        {tab === "painel" && <Painel contacts={contacts} tasks={tasks} />}
        {tab === "contatos" && (
          <Contatos contacts={contacts} onAdd={addContact} onEdit={editContact} onRemove={removeContact} />
        )}
        {tab === "funil" && <Funil contacts={contacts} onEdit={editContact} />}
        {tab === "tarefas" && (
          <Tarefas tasks={tasks} contacts={contacts} onAdd={addTask} onToggle={toggleTask} onRemove={removeTask} />
        )}
      </div>
    </div>
  );
}

function LoadingScreen({ text }) {
  return (
    <div style={{ ...styles.app, alignItems: "center", justifyContent: "center" }}>
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
    <div style={styles.authWrap}>
      <style>{globalCss}</style>
      <div style={styles.authCard}>
        <div style={styles.brand}>
          <span style={styles.brandMark}>●</span>
          <span style={{ color: "#1C2127" }}>Elo</span>
        </div>
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
  );
}

/* ============================================================
   SIDEBAR
   ============================================================ */

function Sidebar({ tab, setTab }) {
  const items = [
    { id: "painel", label: "Painel", icon: LayoutGrid },
    { id: "contatos", label: "Contatos", icon: Users },
    { id: "funil", label: "Funil", icon: Columns3 },
    { id: "tarefas", label: "Tarefas", icon: CheckSquare },
  ];
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
      <button style={styles.logoutBtn} onClick={() => supabase.auth.signOut()}>
        <LogOut size={15} />
        <span className="elo-nav-label">Sair</span>
      </button>
    </div>
  );
}

/* ============================================================
   PAINEL
   ============================================================ */

function Painel({ contacts, tasks }) {
  const open = contacts.filter((c) => c.stage !== "ganho" && c.stage !== "perdido");
  const won = contacts.filter((c) => c.stage === "ganho");
  const lost = contacts.filter((c) => c.stage === "perdido");
  const pendingTasks = tasks.filter((t) => !t.done);
  const pipelineValue = open.reduce((s, c) => s + Number(c.value || 0), 0);
  const wonValue = won.reduce((s, c) => s + Number(c.value || 0), 0);
  const closedTotal = won.length + lost.length;
  const conversionRate = closedTotal === 0 ? null : (won.length / closedTotal) * 100;

  const dueReminders = contacts
    .filter((c) => c.next_reminder_date && reminderState(c.next_reminder_date) !== "futuro")
    .sort((a, b) => a.next_reminder_date.localeCompare(b.next_reminder_date));

  const chartData = STAGES.filter((s) => s.id !== "perdido").map((s) => ({
    name: s.label,
    valor: contacts.filter((c) => c.stage === s.id).reduce((sum, c) => sum + Number(c.value || 0), 0),
    color: s.color,
  }));

  return (
    <div>
      <h1 style={styles.h1}>Painel</h1>
      <p style={styles.sub}>Como está o seu negócio agora.</p>

      <div style={styles.cardsRow}>
        <MetricCard label="Contatos ativos" value={contacts.length} />
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

/* ============================================================
   CONTATOS
   ============================================================ */

function Contatos({ contacts, onAdd, onEdit, onRemove }) {
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all"); // all | 7d | 30d | month
  const [reminderOnly, setReminderOnly] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const filtered = contacts.filter((c) => {
    const q = query.toLowerCase();
    const matchesQuery = c.name.toLowerCase().includes(q) || (c.company || "").toLowerCase().includes(q);
    if (!matchesQuery) return false;

    if (dateFilter === "7d" && !withinDays(c.created_at, 7)) return false;
    if (dateFilter === "30d" && !withinDays(c.created_at, 30)) return false;
    if (dateFilter === "month" && !isSameMonth(c.created_at)) return false;

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
    });
    setShowForm(true);
  };

  const openEdit = (c) => {
    setEditing({ ...c });
    setShowForm(true);
  };

  const save = () => {
    if (!editing.name.trim()) return;
    if (editing.id) {
      const { id, created_at, organization_id, created_by, ...patch } = editing;
      onEdit(id, patch);
    } else {
      onAdd(editing);
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
        <select style={styles.filterSelect} value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
          <option value="all">Data de entrada: todas</option>
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="month">Este mês</option>
        </select>
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
          <div style={styles.modalFoot}>
            <button style={styles.secondaryBtn} onClick={() => setShowForm(false)}>
              Cancelar
            </button>
            <button style={styles.primaryBtn} onClick={save}>
              Salvar contato
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

const styles = {
  app: {
    display: "flex",
    minHeight: 560,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    background: "#F3F4F1",
    color: "#1C2127",
    fontSize: 14,
  },
  sidebar: { width: 210, flexShrink: 0, background: "#1C2127", color: "#EDEEEA", display: "flex", flexDirection: "column", padding: "20px 14px" },
  brand: { display: "flex", alignItems: "center", gap: 8, fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em", padding: "0 6px 22px 6px" },
  brandMark: { color: "#5FA394", fontSize: 12 },
  nav: { display: "flex", flexDirection: "column", gap: 2 },
  navBtn: { display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 6, border: "none", background: "transparent", color: "#B9BDC2", fontSize: 13.5, cursor: "pointer", textAlign: "left" },
  navBtnActive: { background: "#2A303A", color: "#FFFFFF" },
  logoutBtn: { marginTop: "auto", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 6, border: "none", background: "transparent", color: "#8B9096", fontSize: 13, cursor: "pointer" },
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
  searchInput: { border: "none", outline: "none", flex: 1, fontSize: 13.5, background: "transparent" },
  filterSelect: { border: "1px solid #E2E3DE", borderRadius: 7, padding: "8px 10px", fontSize: 12.5, background: "#FFFFFF", color: "#5B626B" },
  filterToggle: { display: "flex", alignItems: "center", gap: 6, border: "1px solid #E2E3DE", borderRadius: 7, padding: "8px 12px", fontSize: 12.5, background: "#FFFFFF", color: "#5B626B", cursor: "pointer" },
  filterToggleActive: { background: "#E7F1EE", borderColor: "#2F6F63", color: "#2F6F63" },
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
  primaryBtn: { display: "flex", alignItems: "center", gap: 6, background: "#2F6F63", color: "#FFFFFF", border: "none", borderRadius: 7, padding: "9px 14px", fontSize: 13.5, fontWeight: 500, cursor: "pointer" },
  secondaryBtn: { background: "transparent", color: "#5B626B", border: "1px solid #DFE1DC", borderRadius: 7, padding: "9px 14px", fontSize: 13.5, cursor: "pointer" },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #DFE1DC", borderRadius: 6, padding: "8px 10px", fontSize: 13.5, fontFamily: "inherit", outline: "none", background: "#FCFCFB" },
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
  authWrap: { minHeight: 560, display: "flex", alignItems: "center", justifyContent: "center", background: "#F3F4F1", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' },
  authCard: { background: "#FFFFFF", border: "1px solid #E2E3DE", borderRadius: 10, padding: 28, width: 340 },
  authTabs: { display: "flex", gap: 4, background: "#F0F1EC", borderRadius: 7, padding: 3, marginBottom: 18 },
  authTab: { flex: 1, border: "none", background: "transparent", padding: "7px 0", borderRadius: 5, fontSize: 13, color: "#6B7178", cursor: "pointer" },
  authTabActive: { background: "#FFFFFF", color: "#1C2127", fontWeight: 600, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" },
  authError: { fontSize: 12.5, color: "#B5493A", background: "#FBEDEA", borderRadius: 6, padding: "8px 10px", marginBottom: 10 },
  authInfo: { fontSize: 12.5, color: "#2F6F63", background: "#E7F1EE", borderRadius: 6, padding: "8px 10px", marginBottom: 10 },
};

const globalCss = `
  * { box-sizing: border-box; }
  input, select, textarea, button { font-family: inherit; }
  input:focus, select:focus, textarea:focus { border-color: #2F6F63 !important; }
  @media (max-width: 640px) {
    .elo-sidebar { width: 60px !important; padding: 16px 8px !important; }
    .elo-nav-label { display: none; }
    .elo-hide-narrow { display: none !important; }
  }
`;