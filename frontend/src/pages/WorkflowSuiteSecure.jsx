import { useEffect, useMemo, useState } from "react";
import Layout, { PageHeader, Badge, MetricCard } from "../components/Layout";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { playActionFeedback } from "../lib/actionFeedback";

const BLUE = "#0051FF";
const EMPTY = { brandProfiles: [], videoVersions: [], timestampFeedback: [], invoices: [], calendarItems: [], happinessScores: [], projectFinance: [], editorPaymentInvoices: [] };
const PLATFORMS = ["Instagram", "TikTok", "YouTube Shorts", "LinkedIn", "Facebook"];
const CAL_STATUS = ["Brief Submitted", "Editing", "Internal Review", "Sent to Client", "Revision Requested", "Approved", "Scheduled", "Published"];
const inputCls = "w-full bg-zinc-950 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500";
const textAreaCls = `${inputCls} min-h-[92px] resize-y`;

function Field({ label, children }) { return <label className="block"><div className="label-xs text-zinc-500 mb-2">{label}</div>{children}</label>; }
function Panel({ title, subtitle, children }) { return <div className="border border-white/10 rounded-xl bg-zinc-900/30 p-5 shadow-2xl shadow-black/20"><div className="mb-4"><h2 className="text-lg font-semibold">{title}</h2>{subtitle && <p className="text-sm text-zinc-500 mt-1">{subtitle}</p>}</div>{children}</div>; }
function Empty({ title, subtitle }) { return <div className="border border-dashed border-white/10 rounded-lg p-8 text-center bg-black/20"><div className="text-sm text-zinc-300">{title}</div>{subtitle && <div className="text-xs text-zinc-600 mt-1">{subtitle}</div>}</div>; }
function money(v) { return `€${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`; }
function pct(v) { return `${Number(v || 0).toFixed(0)}%`; }
function isOverdue(date, status) { return !!date && status !== "Paid" && new Date(date) < new Date(); }
function projectName(tasks, id) { return tasks.find((task) => task.id === id)?.title || "Project"; }
function badgeTone(status) { if (["Paid", "Approved", "Published", "Fixed", "Final", "active"].includes(status)) return "good"; if (["Overdue", "Rejected", "Revision Requested"].includes(status)) return "bad"; return "blue"; }
function editorPrivateName(editor, canSeePrivate) {
  if (canSeePrivate) {
    const real = editor.real_name || editor.display_name || editor.name || editor.anime_name || "Unnamed editor";
    return editor.anime_name && real !== editor.anime_name ? `${real} (${editor.anime_name})` : real;
  }
  return editor.anime_name || "Editor";
}

export default function WorkflowSuiteSecure() {
  const { user } = useAuth();
  const role = user?.role;
  const isAdmin = role === "admin";
  const isModerator = role === "moderator";
  const isOps = isAdmin || isModerator;
  const isClient = role === "client";
  const isEditor = role === "editor";

  const [tasks, setTasks] = useState([]);
  const [editors, setEditors] = useState([]);
  const [store, setStore] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState(isEditor ? "review" : "onboarding");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [brandForm, setBrandForm] = useState({ brand_name: "", website_social_links: "", target_audience: "", business_goal: "", video_goal: "", preferred_video_style: "", reference_video_links: "", brand_colors: "", logo_assets_url: "", tone_of_voice: "", competitors: "", platforms_needed: [], number_of_videos_needed: 1, deadline: "", notes: "" });
  const [calendarForm, setCalendarForm] = useState({ video_title: "", platform: "Instagram", due_date: "", status: "Brief Submitted" });
  const [happinessForm, setHappinessForm] = useState({ rating: 10, fast_enough: "Yes", clear_communication: "Yes", happy_final: "Yes", work_again: "Yes", feedback: "" });
  const [invoiceForm, setInvoiceForm] = useState({ amount: 0, due_date: "", payment_method: "Bank transfer", notes: "" });
  const [financeForm, setFinanceForm] = useState({ client_payment_amount: 0, editor_cost: 0, extra_expenses: 0 });

  const liveTaskIds = useMemo(() => new Set(tasks.map((task) => task.id)), [tasks]);
  const keepLiveProjectRecord = (record) => !record.project_id || liveTaskIds.has(record.project_id);

  const refresh = async () => {
    try {
      setLoading(true);
      setError("");
      const [taskRes, stateRes] = await Promise.all([api.get("/tasks"), api.get("/workflow/state")]);
      const taskData = Array.isArray(taskRes.data) ? taskRes.data : [];
      setTasks(taskData);
      setStore({ ...EMPTY, ...(stateRes.data || {}) });
      if (!selectedTaskId && taskData.length) setSelectedTaskId(taskData[0].id);
      if (isOps) {
        const users = await api.get("/users?role=editor");
        setEditors(Array.isArray(users.data) ? users.data : []);
      }
    } catch (e) {
      setError(formatApiError(e?.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [role]);

  const selectedTask = useMemo(() => tasks.find((t) => t.id === selectedTaskId) || tasks[0] || null, [tasks, selectedTaskId]);
  const selectedFinance = store.projectFinance.find((f) => f.project_id === selectedTask?.id);

  const tabs = [
    ["review", "Video Review", ["admin", "moderator", "client", "editor"]],
    ["versions", "Versions", ["admin", "moderator", "client", "editor"]],
    ["onboarding", "Brand Profile", ["admin", "moderator", "client"]],
    ["matching", "Skill Match", ["admin", "moderator"]],
    ["profit", "Profit", ["admin"]],
    ["happiness", "Happiness", ["admin", "moderator", "client"]],
    ["invoices", "Invoices", ["admin", "moderator", "client"]],
    ["calendar", "Calendar", ["admin", "moderator", "client", "editor"]],
  ].filter(([, , roles]) => roles.includes(role));

  useEffect(() => {
    if (!tabs.some(([id]) => id === activeTab)) setActiveTab(tabs[0]?.[0] || "review");
  }, [role, activeTab, tabs]);

  const cleanupOrphans = async () => {
    if (!isAdmin) return;
    try {
      setSaving(true);
      setError("");
      const { data } = await api.post("/workflow/cleanup-orphans");
      await refresh();
      const deletedTotal = Object.values(data?.deleted || {}).reduce((sum, value) => sum + Number(value || 0), 0);
      setNotice(`Cleaned ${deletedTotal} orphan records from deleted projects.`);
    } catch (e) {
      setError(formatApiError(e?.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
    }
  };

  const createDoc = async (collection, payload) => {
    setSaving(true);
    try { await api.post(`/workflow/${collection}`, payload); await refresh(); playActionFeedback("approve"); }
    catch (e) { setError(formatApiError(e?.response?.data?.detail || e.message)); }
    finally { setSaving(false); }
  };

  const patchDoc = async (collection, id, payload) => {
    setSaving(true);
    try { await api.patch(`/workflow/${collection}/${id}`, payload); await refresh(); playActionFeedback("request"); }
    catch (e) { setError(formatApiError(e?.response?.data?.detail || e.message)); }
    finally { setSaving(false); }
  };

  const saveBrandProfile = async () => {
    if (isEditor) return setError("Editors cannot access brand profiles.");
    const ownerId = isClient ? user.id : selectedTask?.client_id;
    if (!ownerId) return setError("Select a project/client first.");
    const existing = store.brandProfiles.find((p) => p.client_id === ownerId);
    const payload = { ...brandForm, client_id: ownerId, project_id: selectedTask?.id };
    existing ? await patchDoc("brandProfiles", existing.id, payload) : await createDoc("brandProfiles", payload);
  };

  const createCalendarItem = async () => {
    if (!selectedTask) return setError("Select a project first.");
    await createDoc("calendarItems", { project_id: selectedTask.id, client_id: selectedTask.client_id, editor_id: selectedTask.assigned_editor_id, project_name: selectedTask.title, video_title: calendarForm.video_title || selectedTask.title, platform: calendarForm.platform, status: calendarForm.status, due_date: calendarForm.due_date });
    setCalendarForm({ video_title: "", platform: "Instagram", due_date: "", status: "Brief Submitted" });
  };

  const submitHappiness = async () => {
    if (!selectedTask) return setError("Select a project first.");
    const rating = Number(happinessForm.rating || 0);
    await createDoc("happinessScores", { project_id: selectedTask.id, client_id: selectedTask.client_id || user.id, rating, ...happinessForm, needs_attention: rating < 7 });
    setHappinessForm({ rating: 10, fast_enough: "Yes", clear_communication: "Yes", happy_final: "Yes", work_again: "Yes", feedback: "" });
  };

  const saveFinance = async () => {
    if (!selectedTask) return setError("Select a project first.");
    const revenue = Number(financeForm.client_payment_amount || 0);
    const cost = Number(financeForm.editor_cost || 0) + Number(financeForm.extra_expenses || 0);
    const payload = { project_id: selectedTask.id, client_id: selectedTask.client_id, ...financeForm, final_profit: revenue - cost, profit_margin: revenue ? ((revenue - cost) / revenue) * 100 : 0 };
    selectedFinance ? await patchDoc("projectFinance", selectedFinance.id, payload) : await createDoc("projectFinance", payload);
  };

  const createInvoice = async () => {
    if (!selectedTask) return setError("Select a project first.");
    await createDoc("invoices", { invoice_number: `MH-${new Date().getFullYear()}-${String(store.invoices.length + 1).padStart(4, "0")}`, client_id: selectedTask.client_id, project_id: selectedTask.id, amount: Number(invoiceForm.amount || 0), due_date: invoiceForm.due_date, paid_date: "", payment_method: invoiceForm.payment_method, notes: invoiceForm.notes, status: isOverdue(invoiceForm.due_date, "Unpaid") ? "Overdue" : "Unpaid" });
    setInvoiceForm({ amount: 0, due_date: "", payment_method: "Bank transfer", notes: "" });
  };

  const markInvoicePaid = async (invoiceId) => {
    try { await api.post(`/workflow/invoices/${invoiceId}/mark-paid`); await refresh(); }
    catch (e) { setError(formatApiError(e?.response?.data?.detail || e.message)); }
  };

  const assignEditor = async (editorId) => {
    if (!selectedTask) return setError("Select a project first.");
    try { setSaving(true); await api.patch(`/tasks/${selectedTask.id}`, { assigned_editor_id: editorId, status: "active" }); await refresh(); playActionFeedback("approve"); }
    catch (e) { setError(formatApiError(e?.response?.data?.detail || e.message)); }
    finally { setSaving(false); }
  };

  const visibleProfiles = store.brandProfiles.filter((profile) => (isOps || profile.client_id === user?.id) && keepLiveProjectRecord(profile));
  const visibleInvoices = store.invoices.filter((invoice) => (isOps || invoice.client_id === user?.id) && invoice.project_id && liveTaskIds.has(invoice.project_id));
  const visibleCalendar = store.calendarItems.filter((item) => (isOps || item.client_id === user?.id || item.editor_id === user?.id) && item.project_id && liveTaskIds.has(item.project_id));
  const visibleHappiness = store.happinessScores.filter((score) => (isOps || score.client_id === user?.id) && score.project_id && liveTaskIds.has(score.project_id));

  const editorMatch = useMemo(() => {
    if (!selectedTask || !isOps) return [];
    const required = new Set([...(selectedTask.skill_tags || []), selectedTask.project_type].filter(Boolean).map((x) => String(x).toLowerCase()));
    return editors.map((editor) => {
      const skills = (editor.skills || []).map((x) => String(x).toLowerCase());
      const hits = skills.filter((skill) => [...required].some((req) => skill.includes(req) || req.includes(skill)));
      const score = Math.max(30, Math.min(98, (required.size ? Math.round((hits.length / required.size) * 70) : 45) + Math.min(15, Math.floor((editor.xp || 0) / 100)) + 15));
      return { editor, score, reason: hits.length ? `strong in ${hits.slice(0, 3).join(", ")}` : "a general fit based on profile and workload" };
    }).sort((a, b) => b.score - a.score);
  }, [editors, selectedTask, isOps]);

  const profitStats = useMemo(() => {
    const liveFinance = store.projectFinance.filter((f) => f.project_id && liveTaskIds.has(f.project_id));
    const liveInvoices = store.invoices.filter((i) => i.project_id && liveTaskIds.has(i.project_id));
    const revenue = liveFinance.reduce((s, f) => s + Number(f.client_payment_amount || 0), 0);
    const editorCost = liveFinance.reduce((s, f) => s + Number(f.editor_cost || 0), 0);
    const expenses = liveFinance.reduce((s, f) => s + Number(f.extra_expenses || 0), 0);
    const profit = revenue - editorCost - expenses;
    const pending = liveInvoices.filter((i) => i.status !== "Paid").reduce((s, i) => s + Number(i.amount || 0), 0);
    const overdue = liveInvoices.filter((i) => i.status === "Overdue" || isOverdue(i.due_date, i.status)).reduce((s, i) => s + Number(i.amount || 0), 0);
    return { revenue, editorCost, profit, pending, overdue, margin: revenue ? (profit / revenue) * 100 : 0 };
  }, [store, liveTaskIds]);

  const happinessAvg = visibleHappiness.length ? visibleHappiness.reduce((s, h) => s + Number(h.rating || 0), 0) / visibleHappiness.length : 0;

  if (loading) return <Layout allowed={[role]}><div className="text-sm text-zinc-500">Loading secured workflow suite…</div></Layout>;

  return <Layout allowed={[role]}>
    <PageHeader label={`${role} / Workflow Suite`} title="Motionholic Workflow Suite" subtitle={isModerator ? "Moderator workflow access: brand profiles, happiness, matching, calendar and invoices. Profit stays Admin-only." : "Role-safe workflow: deleted project records are hidden and can be cleaned by Admin."} />
    {error && <div className="mb-4 border border-red-500/20 bg-red-500/10 text-red-300 rounded-md px-4 py-3 text-sm">{error}</div>}
    {notice && <div className="mb-4 border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 rounded-md px-4 py-3 text-sm">{notice}</div>}
    {isAdmin && <div className="mb-4 flex justify-end"><button onClick={cleanupOrphans} disabled={saving} className="px-4 py-2 rounded-md border border-white/10 text-sm hover:bg-white/5 disabled:opacity-50">Clean deleted project history</button></div>}
    <div className="grid lg:grid-cols-[280px,1fr] gap-5">
      <aside className="space-y-4">
        <Panel title="Project Context" subtitle="Role-safe MongoDB scope">
          {tasks.length === 0 ? <Empty title="No projects yet" subtitle="Create or approve a project first." /> : <select className={inputCls} value={selectedTask?.id || ""} onChange={(e) => setSelectedTaskId(e.target.value)}>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select>}
          {selectedTask && <div className="mt-4 space-y-2 text-xs text-zinc-400"><div className="flex justify-between"><span>Status</span><Badge>{selectedTask.status}</Badge></div><div className="flex justify-between"><span>Type</span><span>{selectedTask.project_type}</span></div><div className="flex justify-between"><span>Deadline</span><span>{selectedTask.deadline?.slice(0, 10) || "—"}</span></div></div>}
        </Panel>
        <div className="border border-white/10 rounded-xl bg-zinc-900/30 p-2">{tabs.map(([id, label]) => <button key={id} onClick={() => setActiveTab(id)} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${activeTab === id ? "text-white" : "text-zinc-500 hover:text-white hover:bg-white/5"}`} style={activeTab === id ? { background: BLUE } : {}}>{label}</button>)}</div>
      </aside>

      <section className="space-y-5">
        {activeTab === "onboarding" && !isEditor && <div className="grid xl:grid-cols-[1fr,460px] gap-5">
          {(isOps || isClient) && <Panel title="Client Onboarding Form" subtitle="Admin and moderators can manage client brand profiles. Clients can update their own.">
            <div className="grid md:grid-cols-2 gap-3">
              {[["Brand name", "brand_name"], ["Website / socials", "website_social_links"], ["Target audience", "target_audience"], ["Business goal", "business_goal"], ["Video goal", "video_goal"], ["Preferred style", "preferred_video_style"], ["Reference links", "reference_video_links"], ["Brand colors", "brand_colors"], ["Logo/assets URL", "logo_assets_url"], ["Tone of voice", "tone_of_voice"], ["Competitors", "competitors"]].map(([label, key]) => <Field key={key} label={label}><input className={inputCls} value={brandForm[key]} onChange={(e) => setBrandForm({ ...brandForm, [key]: e.target.value })} /></Field>)}
              <Field label="Number of videos"><input type="number" className={inputCls} value={brandForm.number_of_videos_needed} onChange={(e) => setBrandForm({ ...brandForm, number_of_videos_needed: e.target.value })} /></Field>
              <Field label="Deadline"><input type="date" className={inputCls} value={brandForm.deadline} onChange={(e) => setBrandForm({ ...brandForm, deadline: e.target.value })} /></Field>
            </div>
            <div className="mt-3"><div className="label-xs text-zinc-500 mb-2">Platforms needed</div><div className="flex flex-wrap gap-2">{PLATFORMS.map((p) => <button key={p} onClick={() => setBrandForm({ ...brandForm, platforms_needed: brandForm.platforms_needed.includes(p) ? brandForm.platforms_needed.filter((x) => x !== p) : [...brandForm.platforms_needed, p] })} className={`px-3 py-1 rounded-md text-xs border ${brandForm.platforms_needed.includes(p) ? "border-blue-500 text-white" : "border-white/10 text-zinc-500"}`}>{p}</button>)}</div></div>
            <Field label="Notes"><textarea className={textAreaCls} value={brandForm.notes} onChange={(e) => setBrandForm({ ...brandForm, notes: e.target.value })} /></Field>
            <button onClick={saveBrandProfile} disabled={saving} className="mt-4 px-4 py-2 rounded-md text-white font-medium disabled:opacity-50" style={{ background: BLUE }}>Save Brand Profile</button>
          </Panel>}
          <Panel title="Client Brand Profiles" subtitle={isOps ? "Ops view of all client brand profiles." : "Your saved brand profile."}>
            {visibleProfiles.length === 0 ? <Empty title="No brand profile yet" /> : visibleProfiles.map((p) => <div key={p.id} className="border border-white/10 rounded-lg p-4 mb-3 bg-black/20">
              <div className="flex justify-between gap-3"><div><div className="font-semibold">{p.brand_name || "Untitled Brand"}</div><div className="text-xs text-zinc-500 mt-1">Client ID: {p.client_id || "—"}</div></div>{(isOps || isClient) && <button onClick={() => setBrandForm({ ...brandForm, ...p })} className="text-xs text-blue-400">Edit</button>}</div>
              <div className="grid sm:grid-cols-2 gap-3 mt-4 text-xs text-zinc-400">
                <div><span className="text-zinc-600">Website/socials:</span> {p.website_social_links || "—"}</div><div><span className="text-zinc-600">Audience:</span> {p.target_audience || "—"}</div>
                <div><span className="text-zinc-600">Business goal:</span> {p.business_goal || "—"}</div><div><span className="text-zinc-600">Video goal:</span> {p.video_goal || "—"}</div>
                <div><span className="text-zinc-600">Style:</span> {p.preferred_video_style || "—"}</div><div><span className="text-zinc-600">Tone:</span> {p.tone_of_voice || "—"}</div>
                <div><span className="text-zinc-600">Colors:</span> {p.brand_colors || "—"}</div><div><span className="text-zinc-600">Competitors:</span> {p.competitors || "—"}</div>
                <div><span className="text-zinc-600">References:</span> {p.reference_video_links || "—"}</div><div><span className="text-zinc-600">Assets:</span> {p.logo_assets_url || "—"}</div>
                <div><span className="text-zinc-600">Videos:</span> {p.number_of_videos_needed || "—"}</div><div><span className="text-zinc-600">Deadline:</span> {p.deadline || "—"}</div>
              </div>
              <div className="flex flex-wrap gap-1 mt-3">{(p.platforms_needed || []).map((platform) => <Badge key={platform}>{platform}</Badge>)}</div>
              {p.notes && <p className="text-sm text-zinc-300 mt-3">{p.notes}</p>}
            </div>)}
          </Panel>
        </div>}

        {activeTab === "matching" && isOps && <Panel title="Editor Skill Matching" subtitle="Moderator can assign projects to editors without seeing profit.">{editorMatch.length === 0 ? <Empty title="No editors found" /> : <div className="grid md:grid-cols-3 gap-4">{editorMatch.slice(0, 3).map(({ editor, score, reason }, index) => <div key={editor.id} className="border border-white/10 rounded-xl p-4 bg-black/20"><div className="flex justify-between items-start"><div><div className="text-xs text-zinc-500">Recommendation #{index + 1}</div><div className="font-semibold mt-1">{editorPrivateName(editor, true)}</div><div className="text-xs text-zinc-600 mt-1">Ops identity view</div></div><div className="text-2xl font-mono text-blue-400">{score}%</div></div><p className="text-sm text-zinc-400 mt-3">{score}% match because this editor is {reason}.</p><div className="flex flex-wrap gap-1 mt-3">{(editor.skills || []).slice(0, 5).map((skill) => <Badge key={skill}>{skill}</Badge>)}</div><button disabled={saving} onClick={() => assignEditor(editor.id)} className="w-full mt-4 py-2 rounded-md bg-white text-black text-sm font-medium disabled:opacity-50">Assign Editor</button></div>)}</div>}</Panel>}

        {activeTab === "calendar" && <div className="grid lg:grid-cols-[1fr,360px] gap-5"><Panel title="Content Calendar" subtitle="Only active project calendar items are shown.">{visibleCalendar.length === 0 ? <Empty title="No calendar items yet" /> : visibleCalendar.map((item) => <div key={item.id} className="border border-white/10 rounded-lg p-4 mb-3 bg-black/20"><div className="flex justify-between gap-3"><div><div className="font-semibold">{item.video_title}</div><div className="text-xs text-zinc-500">{item.project_name} · {item.platform} · {item.due_date || "No date"}</div></div><Badge tone={badgeTone(item.status)}>{item.status}</Badge></div></div>)}</Panel>{(isOps || isClient) && <Panel title="Create Calendar Item"><div className="space-y-3"><Field label="Video title"><input className={inputCls} value={calendarForm.video_title} onChange={(e) => setCalendarForm({ ...calendarForm, video_title: e.target.value })} /></Field><Field label="Platform"><select className={inputCls} value={calendarForm.platform} onChange={(e) => setCalendarForm({ ...calendarForm, platform: e.target.value })}>{PLATFORMS.map((p) => <option key={p}>{p}</option>)}</select></Field><Field label="Due date"><input type="date" className={inputCls} value={calendarForm.due_date} onChange={(e) => setCalendarForm({ ...calendarForm, due_date: e.target.value })} /></Field><Field label="Status"><select className={inputCls} value={calendarForm.status} onChange={(e) => setCalendarForm({ ...calendarForm, status: e.target.value })}>{CAL_STATUS.map((s) => <option key={s}>{s}</option>)}</select></Field><button onClick={createCalendarItem} disabled={saving} className="w-full py-2 rounded-md text-white disabled:opacity-50" style={{ background: BLUE }}>Add to Calendar</button></div></Panel>}</div>}

        {activeTab === "happiness" && <div className="grid lg:grid-cols-[1fr,360px] gap-5"><Panel title="Client Happiness Score"><div className="grid md:grid-cols-3 gap-4 mb-5"><MetricCard label="Average Score" value={happinessAvg ? `${happinessAvg.toFixed(1)}/10` : "—"} /><MetricCard label="Feedback Count" value={visibleHappiness.length} /><MetricCard label="Needs Attention" value={visibleHappiness.filter((h) => h.needs_attention).length} tone="bad" /></div>{visibleHappiness.length === 0 ? <Empty title="No client feedback yet" /> : visibleHappiness.map((h) => <div key={h.id} className="border border-white/10 rounded-lg p-4 mb-3"><div className="flex justify-between"><div className="font-semibold">{projectName(tasks, h.project_id)}</div><Badge tone={h.needs_attention ? "bad" : "good"}>{h.needs_attention ? "Needs Attention" : "Positive"}</Badge></div><div className="text-2xl font-mono text-blue-400 mt-2">{h.rating}/10</div><p className="text-sm text-zinc-400 mt-2">{h.feedback}</p></div>)}</Panel>{isClient && <Panel title="Submit Feedback"><div className="space-y-3"><Field label="Rating 1–10"><input type="number" min="1" max="10" className={inputCls} value={happinessForm.rating} onChange={(e) => setHappinessForm({ ...happinessForm, rating: e.target.value })} /></Field>{["fast_enough", "clear_communication", "happy_final", "work_again"].map((key) => <Field key={key} label={key.replaceAll("_", " ")}><select className={inputCls} value={happinessForm[key]} onChange={(e) => setHappinessForm({ ...happinessForm, [key]: e.target.value })}><option>Yes</option><option>No</option><option>Somewhat</option></select></Field>)}<Field label="Written feedback / testimonial"><textarea className={textAreaCls} value={happinessForm.feedback} onChange={(e) => setHappinessForm({ ...happinessForm, feedback: e.target.value })} /></Field><button onClick={submitHappiness} disabled={saving} className="w-full py-2 rounded-md text-white disabled:opacity-50" style={{ background: BLUE }}>Submit Score</button></div></Panel>}</div>}

        {activeTab === "profit" && isAdmin && <div className="space-y-5"><div className="grid md:grid-cols-4 gap-4"><MetricCard label="Total Revenue" value={money(profitStats.revenue)} /><MetricCard label="Editor Cost" value={money(profitStats.editorCost)} tone="warn" /><MetricCard label="Total Profit" value={money(profitStats.profit)} tone={profitStats.profit >= 0 ? "good" : "bad"} /><MetricCard label="Profit Margin" value={pct(profitStats.margin)} tone="blue" /><MetricCard label="Pending Payments" value={money(profitStats.pending)} tone="warn" /><MetricCard label="Overdue Payments" value={money(profitStats.overdue)} tone="bad" /></div><Panel title="Project Finance"><div className="grid md:grid-cols-4 gap-3 items-end"><Field label="Client payment amount"><input type="number" className={inputCls} value={financeForm.client_payment_amount} onChange={(e) => setFinanceForm({ ...financeForm, client_payment_amount: e.target.value })} /></Field><Field label="Editor cost"><input type="number" className={inputCls} value={financeForm.editor_cost} onChange={(e) => setFinanceForm({ ...financeForm, editor_cost: e.target.value })} /></Field><Field label="Extra expenses"><input type="number" className={inputCls} value={financeForm.extra_expenses} onChange={(e) => setFinanceForm({ ...financeForm, extra_expenses: e.target.value })} /></Field><button onClick={saveFinance} disabled={saving} className="py-2 rounded-md text-white disabled:opacity-50" style={{ background: BLUE }}>Save</button></div></Panel></div>}

        {activeTab === "invoices" && <div className="grid lg:grid-cols-[1fr,360px] gap-5"><Panel title="Payment / Invoice Tracking">{visibleInvoices.length === 0 ? <Empty title="No invoices yet" /> : visibleInvoices.map((invoice) => <div key={invoice.id} className="border border-white/10 rounded-lg p-4 mb-3 bg-black/20"><div className="flex justify-between gap-3"><div><div className="font-semibold">{invoice.invoice_number}</div><div className="text-xs text-zinc-500">{projectName(tasks, invoice.project_id)} · due {invoice.due_date || "—"}</div></div><Badge tone={invoice.status === "Paid" ? "good" : invoice.status === "Overdue" || isOverdue(invoice.due_date, invoice.status) ? "bad" : "warn"}>{isOverdue(invoice.due_date, invoice.status) ? "Overdue" : invoice.status}</Badge></div><div className="text-2xl font-mono text-white mt-3">{money(invoice.amount)}</div>{isOps && invoice.status !== "Paid" && <button onClick={() => markInvoicePaid(invoice.id)} className="mt-3 px-3 py-1.5 rounded-md bg-white text-black text-xs">Mark paid</button>}</div>)}</Panel>{isOps && <Panel title="Create Invoice"><div className="space-y-3"><Field label="Amount"><input type="number" className={inputCls} value={invoiceForm.amount} onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })} /></Field><Field label="Due date"><input type="date" className={inputCls} value={invoiceForm.due_date} onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })} /></Field><Field label="Payment method"><input className={inputCls} value={invoiceForm.payment_method} onChange={(e) => setInvoiceForm({ ...invoiceForm, payment_method: e.target.value })} /></Field><Field label="Notes"><textarea className={textAreaCls} value={invoiceForm.notes} onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })} /></Field><button onClick={createInvoice} disabled={saving} className="w-full py-2 rounded-md text-white disabled:opacity-50" style={{ background: BLUE }}>Create Invoice</button></div></Panel>}</div>}

        {!["onboarding", "matching", "calendar", "happiness", "profit", "invoices"].includes(activeTab) && <Panel title={tabs.find(([id]) => id === activeTab)?.[1] || "Workflow Module"} subtitle="This section stays project-based and role-safe."><Empty title="Project-based module" subtitle="Use this section after the project has versions or feedback." /></Panel>}
      </section>
    </div>
  </Layout>;
}
