import { useEffect, useMemo, useRef, useState } from "react";
import Layout, { PageHeader, Badge, MetricCard } from "../components/Layout";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { playActionFeedback } from "../lib/actionFeedback";

const BLUE = "#0051FF";
const EMPTY = { brandProfiles: [], videoVersions: [], timestampFeedback: [], invoices: [], calendarItems: [], happinessScores: [], projectFinance: [] };
const PLATFORMS = ["Instagram", "TikTok", "YouTube Shorts", "LinkedIn", "Facebook"];
const CAL_STATUS = ["Brief Submitted", "Editing", "Internal Review", "Sent to Client", "Revision Requested", "Approved", "Scheduled", "Published"];
const FEEDBACK_STATUS = ["Open", "In Progress", "Fixed", "Rejected"];
const inputCls = "w-full bg-zinc-950 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500";
const textAreaCls = `${inputCls} min-h-[92px] resize-y`;

function money(value) { return `€${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`; }
function pct(value) { return `${Number(value || 0).toFixed(0)}%`; }
function fmtTime(seconds) { const s = Math.max(0, Math.floor(Number(seconds || 0))); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
function projectTitle(projects, id) { return projects.find((p) => p.id === id)?.title || "Project"; }
function isOverdue(date, status) { return !!date && status !== "Paid" && new Date(date) < new Date(); }
function Field({ label, children }) { return <label className="block"><div className="label-xs text-zinc-500 mb-2">{label}</div>{children}</label>; }
function EmptyState({ title, subtitle }) { return <div className="border border-dashed border-white/10 rounded-lg p-8 text-center bg-black/20"><div className="text-sm text-zinc-300">{title}</div>{subtitle && <div className="text-xs text-zinc-600 mt-1">{subtitle}</div>}</div>; }
function Panel({ title, subtitle, children }) { return <div className="border border-white/10 rounded-xl bg-zinc-900/30 p-5 shadow-2xl shadow-black/20"><div className="mb-4"><h2 className="text-lg font-semibold">{title}</h2>{subtitle && <p className="text-sm text-zinc-500 mt-1">{subtitle}</p>}</div>{children}</div>; }
function tagTone(status) { if (["Paid", "Approved", "Published", "Fixed", "Final"].includes(status)) return "good"; if (["Overdue", "Rejected", "Revision Requested"].includes(status)) return "bad"; return "blue"; }

export default function WorkflowSuiteDB() {
  const { user } = useAuth();
  const videoRef = useRef(null);
  const [tasks, setTasks] = useState([]);
  const [editors, setEditors] = useState([]);
  const [store, setStore] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("review");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [replyDrafts, setReplyDrafts] = useState({});

  const [brandForm, setBrandForm] = useState({ brand_name: "", website_social_links: "", target_audience: "", business_goal: "", video_goal: "", preferred_video_style: "", reference_video_links: "", brand_colors: "", logo_assets_url: "", tone_of_voice: "", competitors: "", platforms_needed: [], number_of_videos_needed: 1, deadline: "", notes: "" });
  const [versionForm, setVersionForm] = useState({ file_url: "", notes: "", version_status: "Current Version" });
  const [commentText, setCommentText] = useState("");
  const [invoiceForm, setInvoiceForm] = useState({ amount: 0, due_date: "", payment_method: "Bank transfer", notes: "" });
  const [calendarForm, setCalendarForm] = useState({ video_title: "", platform: "Instagram", due_date: "", status: "Brief Submitted" });
  const [happinessForm, setHappinessForm] = useState({ rating: 10, fast_enough: "Yes", clear_communication: "Yes", happy_final: "Yes", work_again: "Yes", feedback: "" });
  const [financeForm, setFinanceForm] = useState({ client_payment_amount: 0, editor_cost: 0, extra_expenses: 0 });

  const role = user?.role;
  const isAdmin = role === "admin";
  const isClient = role === "client";
  const isEditor = role === "editor";

  const refresh = async () => {
    try {
      setLoading(true); setError("");
      const [taskRes, stateRes] = await Promise.all([api.get("/tasks"), api.get("/workflow/state")]);
      const taskData = Array.isArray(taskRes.data) ? taskRes.data : [];
      setTasks(taskData);
      setStore({ ...EMPTY, ...(stateRes.data || {}) });
      if (!selectedTaskId && taskData.length) setSelectedTaskId(taskData[0].id);
      if (isAdmin) {
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

  const selectedTask = useMemo(() => tasks.find((t) => t.id === selectedTaskId) || tasks[0], [tasks, selectedTaskId]);
  const selectedVersions = useMemo(() => store.videoVersions.filter((v) => v.project_id === selectedTask?.id).sort((a, b) => new Date(b.uploaded_at || b.created_at) - new Date(a.uploaded_at || a.created_at)), [store.videoVersions, selectedTask?.id]);
  const currentVersion = selectedVersions[0];
  const selectedComments = useMemo(() => store.timestampFeedback.filter((c) => c.project_id === selectedTask?.id && (!currentVersion || c.video_version_id === currentVersion.id)).sort((a, b) => a.timestamp - b.timestamp), [store.timestampFeedback, selectedTask?.id, currentVersion?.id]);
  const selectedFinance = store.projectFinance.find((f) => f.project_id === selectedTask?.id);

  const tabs = [
    ["review", "Video Review", ["admin", "client", "editor"]],
    ["versions", "Versions", ["admin", "client", "editor"]],
    ["onboarding", "Brand Profile", ["admin", "client", "editor"]],
    ["matching", "Skill Match", ["admin"]],
    ["profit", "Profit", ["admin"]],
    ["happiness", "Happiness", ["admin", "client"]],
    ["invoices", "Invoices", ["admin", "client"]],
    ["calendar", "Calendar", ["admin", "client", "editor"]],
  ].filter(([, , roles]) => roles.includes(role));

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
    const ownerId = isClient ? user.id : selectedTask?.client_id;
    if (!ownerId) return setError("Select a project/client first.");
    const existing = store.brandProfiles.find((p) => p.client_id === ownerId);
    const payload = { ...brandForm, client_id: ownerId };
    existing ? await patchDoc("brandProfiles", existing.id, payload) : await createDoc("brandProfiles", payload);
  };

  const addVersion = async () => {
    if (!selectedTask?.id || !versionForm.file_url) return setError("Select a project and add a video/file URL.");
    await createDoc("videoVersions", { ...versionForm, project_id: selectedTask.id, client_id: selectedTask.client_id, label: versionForm.version_status === "Final" ? "Final" : `V${selectedVersions.length + 1}`, uploaded_by: user.id, uploaded_by_role: role, uploaded_at: new Date().toISOString() });
    setVersionForm({ file_url: "", notes: "", version_status: "Current Version" });
  };

  const addTimestampComment = async () => {
    if (!currentVersion) return setError("Upload or select a video version first.");
    if (!commentText.trim()) return setError("Write a feedback comment first.");
    await createDoc("timestampFeedback", { timestamp: videoRef.current?.currentTime || 0, comment_text: commentText.trim(), author_id: user.id, author_name: user.display_name, role, project_id: selectedTask.id, client_id: selectedTask.client_id, video_version_id: currentVersion.id, status: "Open", replies: [] });
    setCommentText("");
  };

  const addFeedbackReply = async (comment) => {
    const text = replyDrafts[comment.id];
    if (!text?.trim()) return;
    await patchDoc("timestampFeedback", comment.id, { replies: [...(comment.replies || []), { id: `${Date.now()}`, text, author_id: user.id, author_name: user.display_name, role, created_at: new Date().toISOString() }] });
    setReplyDrafts((d) => ({ ...d, [comment.id]: "" }));
  };

  const jumpToTimestamp = (seconds) => { if (videoRef.current) { videoRef.current.currentTime = Number(seconds || 0); videoRef.current.play().catch(() => {}); } };

  const editorMatch = useMemo(() => {
    if (!selectedTask) return [];
    const required = new Set([...(selectedTask.skill_tags || []), selectedTask.project_type].filter(Boolean).map((x) => String(x).toLowerCase()));
    return editors.map((editor) => {
      const skills = (editor.skills || []).map((x) => String(x).toLowerCase());
      const hits = skills.filter((s) => [...required].some((r) => s.includes(r) || r.includes(s)));
      const score = Math.max(30, Math.min(98, (required.size ? Math.round((hits.length / required.size) * 70) : 45) + Math.min(15, Math.floor((editor.xp || 0) / 100)) + 15 - (editor.burnout === "high" ? 20 : editor.burnout === "medium" ? 10 : 0)));
      return { editor, score, reason: hits.length ? `strong in ${hits.slice(0, 3).join(", ")}` : "a general fit based on profile and workload" };
    }).sort((a, b) => b.score - a.score);
  }, [editors, selectedTask]);

  const assignEditor = async (editorId) => { if (!selectedTask) return; try { setSaving(true); await api.patch(`/tasks/${selectedTask.id}`, { assigned_editor_id: editorId, status: "active" }); await refresh(); } catch (e) { setError(formatApiError(e?.response?.data?.detail || e.message)); } finally { setSaving(false); } };

  const saveFinance = async () => {
    if (!selectedTask) return;
    const revenue = Number(financeForm.client_payment_amount || 0);
    const cost = Number(financeForm.editor_cost || 0) + Number(financeForm.extra_expenses || 0);
    const payload = { project_id: selectedTask.id, client_id: selectedTask.client_id, ...financeForm, final_profit: revenue - cost, profit_margin: revenue ? ((revenue - cost) / revenue) * 100 : 0 };
    selectedFinance ? await patchDoc("projectFinance", selectedFinance.id, payload) : await createDoc("projectFinance", payload);
  };

  const createInvoice = async () => {
    if (!selectedTask) return;
    await createDoc("invoices", { invoice_number: `MH-${new Date().getFullYear()}-${String(store.invoices.length + 1).padStart(4, "0")}`, client_id: selectedTask.client_id, project_id: selectedTask.id, amount: Number(invoiceForm.amount || 0), due_date: invoiceForm.due_date, paid_date: "", payment_method: invoiceForm.payment_method, notes: invoiceForm.notes, status: isOverdue(invoiceForm.due_date, "Unpaid") ? "Overdue" : "Unpaid" });
    setInvoiceForm({ amount: 0, due_date: "", payment_method: "Bank transfer", notes: "" });
  };

  const markInvoicePaid = async (invoiceId) => { try { await api.post(`/workflow/invoices/${invoiceId}/mark-paid`); await refresh(); } catch (e) { setError(formatApiError(e?.response?.data?.detail || e.message)); } };

  const printInvoice = (invoice) => { const win = window.open("", "_blank"); if (!win) return; win.document.write(`<html><head><title>${invoice.invoice_number}</title><style>body{font-family:Arial;padding:40px;color:#111}h1{color:#0051FF}.box{border:1px solid #ddd;padding:20px;border-radius:12px;margin:16px 0}</style></head><body><h1>Motionholic OS Invoice</h1><div class="box"><strong>Invoice:</strong> ${invoice.invoice_number}<br/><strong>Project:</strong> ${projectTitle(tasks, invoice.project_id)}<br/><strong>Amount:</strong> ${money(invoice.amount)}<br/><strong>Status:</strong> ${invoice.status}<br/><strong>Due:</strong> ${invoice.due_date || "—"}</div><p>${invoice.notes || ""}</p><script>window.print()</script></body></html>`); win.document.close(); };

  const createCalendarItem = async () => { if (!selectedTask) return; await createDoc("calendarItems", { project_id: selectedTask.id, client_id: selectedTask.client_id, editor_id: selectedTask.assigned_editor_id, project_name: selectedTask.title, video_title: calendarForm.video_title || selectedTask.title, platform: calendarForm.platform, assigned_editor: selectedTask.assigned_editor_id, status: calendarForm.status, due_date: calendarForm.due_date }); };

  const submitHappiness = async () => { if (!selectedTask) return; const rating = Number(happinessForm.rating || 0); await createDoc("happinessScores", { project_id: selectedTask.id, client_id: selectedTask.client_id || user.id, rating, ...happinessForm, needs_attention: rating < 7 }); setHappinessForm({ rating: 10, fast_enough: "Yes", clear_communication: "Yes", happy_final: "Yes", work_again: "Yes", feedback: "" }); };

  const visibleInvoices = store.invoices.filter((i) => isAdmin || i.client_id === user.id);
  const visibleCalendar = store.calendarItems;
  const visibleHappiness = store.happinessScores.filter((h) => isAdmin || h.client_id === user.id);
  const profitStats = useMemo(() => { const revenue = store.projectFinance.reduce((s, f) => s + Number(f.client_payment_amount || 0), 0); const editorCost = store.projectFinance.reduce((s, f) => s + Number(f.editor_cost || 0), 0); const expenses = store.projectFinance.reduce((s, f) => s + Number(f.extra_expenses || 0), 0); const profit = revenue - editorCost - expenses; const pending = store.invoices.filter((i) => i.status !== "Paid").reduce((s, i) => s + Number(i.amount || 0), 0); const overdue = store.invoices.filter((i) => i.status === "Overdue" || isOverdue(i.due_date, i.status)).reduce((s, i) => s + Number(i.amount || 0), 0); return { revenue, editorCost, expenses, profit, pending, overdue, margin: revenue ? (profit / revenue) * 100 : 0 }; }, [store]);
  const happinessAvg = visibleHappiness.length ? visibleHappiness.reduce((s, h) => s + Number(h.rating || 0), 0) / visibleHappiness.length : 0;

  if (loading) return <Layout allowed={[role]}><div className="text-sm text-zinc-500">Loading database-backed workflow suite…</div></Layout>;

  return <Layout allowed={[role]}>
    <PageHeader label={`${role} / Workflow Suite`} title="Motionholic Workflow Suite" subtitle="Database-backed flow: onboarding → matching → version review → timestamp feedback → invoice → profit → calendar → happiness score." />
    {error && <div className="mb-4 border border-red-500/20 bg-red-500/10 text-red-300 rounded-md px-4 py-3 text-sm">{error}</div>}
    <div className="grid lg:grid-cols-[280px,1fr] gap-5">
      <aside className="space-y-4"><Panel title="Project Context" subtitle="Role-safe MongoDB scope">{tasks.length === 0 ? <EmptyState title="No projects yet" subtitle="Create or approve a project first." /> : <select className={inputCls} value={selectedTask?.id || ""} onChange={(e) => setSelectedTaskId(e.target.value)}>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select>}{selectedTask && <div className="mt-4 space-y-2 text-xs text-zinc-400"><div className="flex justify-between"><span>Status</span><Badge>{selectedTask.status}</Badge></div><div className="flex justify-between"><span>Type</span><span>{selectedTask.project_type}</span></div><div className="flex justify-between"><span>Deadline</span><span>{selectedTask.deadline?.slice(0, 10) || "—"}</span></div></div>}</Panel><div className="border border-white/10 rounded-xl bg-zinc-900/30 p-2">{tabs.map(([id, label]) => <button key={id} onClick={() => setActiveTab(id)} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${activeTab === id ? "text-white" : "text-zinc-500 hover:text-white hover:bg-white/5"}`} style={activeTab === id ? { background: BLUE } : {}}>{label}</button>)}</div></aside>
      <section className="space-y-5">
        {activeTab === "review" && <div className="grid xl:grid-cols-[1fr,380px] gap-5"><Panel title="Timestamp Video Feedback" subtitle="Click timestamp comments to jump directly in the video.">{!currentVersion ? <EmptyState title="No version uploaded yet" subtitle="Upload a version first." /> : <><div className="aspect-video bg-black rounded-lg overflow-hidden border border-white/10"><video ref={videoRef} src={currentVersion.file_url} controls className="w-full h-full" /></div><div className="mt-4 flex gap-2"><input className={inputCls} value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Add feedback at current timestamp…" /><button onClick={addTimestampComment} disabled={(!isClient && !isAdmin) || saving} className="px-4 rounded-md text-sm font-medium text-white disabled:opacity-40" style={{ background: BLUE }}>Add</button></div>{isEditor && <div className="text-xs text-zinc-600 mt-2">Editors can reply and mark feedback fixed.</div>}</>}</Panel><Panel title="Timestamp Comments" subtitle="Open, In Progress, Fixed, Rejected">{selectedComments.length === 0 ? <EmptyState title="No feedback yet" /> : selectedComments.map((c) => <div key={c.id} className="border border-white/10 rounded-lg p-3 mb-3 bg-black/20"><div className="flex items-start justify-between gap-2"><button onClick={() => jumpToTimestamp(c.timestamp)} className="font-mono text-sm text-blue-400 hover:underline">{fmtTime(c.timestamp)}</button><select className="bg-zinc-950 border border-white/10 rounded-md text-xs px-2 py-1" value={c.status} onChange={(e) => patchDoc("timestampFeedback", c.id, { status: e.target.value })}>{FEEDBACK_STATUS.map((s) => <option key={s}>{s}</option>)}</select></div><div className="text-sm text-zinc-200 mt-2">{c.comment_text}</div><div className="text-[11px] text-zinc-600 mt-1">{c.author_name} · {c.role}</div>{(c.replies || []).map((r) => <div key={r.id} className="mt-2 pl-3 border-l border-white/10 text-xs text-zinc-400"><span className="text-zinc-200">{r.author_name}:</span> {r.text}</div>)}<div className="flex gap-2 mt-3"><input className={`${inputCls} text-xs py-1.5`} placeholder="Reply…" value={replyDrafts[c.id] || ""} onChange={(e) => setReplyDrafts({ ...replyDrafts, [c.id]: e.target.value })} /><button onClick={() => addFeedbackReply(c)} className="px-3 rounded-md bg-white text-black text-xs">Reply</button></div></div>)}</Panel></div>}
        {activeTab === "versions" && <div className="grid lg:grid-cols-[1fr,360px] gap-5"><Panel title="Version History" subtitle="All previous versions stay saved in MongoDB.">{selectedVersions.length === 0 ? <EmptyState title="No versions yet" /> : selectedVersions.map((v, idx) => <div key={v.id} className="border border-white/10 rounded-lg p-4 mb-3 bg-black/20"><div className="flex items-center justify-between gap-3"><div><div className="text-lg font-semibold">{v.label}</div><div className="text-xs text-zinc-500">Uploaded {new Date(v.uploaded_at || v.created_at).toLocaleString()}</div></div><Badge tone={tagTone(idx === 0 ? "Current" : v.version_status)}>{idx === 0 ? "Current Version" : v.version_status}</Badge></div><a className="block text-xs text-blue-400 truncate mt-3" href={v.file_url} target="_blank" rel="noreferrer">{v.file_url}</a>{v.notes && <div className="text-sm text-zinc-400 mt-2">{v.notes}</div>}</div>)}</Panel>{(isAdmin || isEditor) && <Panel title="Upload New Version" subtitle="Admin/editor upload V1, V2, V3 or Final."><div className="space-y-3"><Field label="Video/file URL"><input className={inputCls} value={versionForm.file_url} onChange={(e) => setVersionForm({ ...versionForm, file_url: e.target.value })} placeholder="https://…" /></Field><Field label="Version status"><select className={inputCls} value={versionForm.version_status} onChange={(e) => setVersionForm({ ...versionForm, version_status: e.target.value })}><option>Current Version</option><option>Revision Requested</option><option>Approved</option><option>Final</option></select></Field><Field label="Notes"><textarea className={textAreaCls} value={versionForm.notes} onChange={(e) => setVersionForm({ ...versionForm, notes: e.target.value })} /></Field><button onClick={addVersion} disabled={saving} className="w-full py-2 rounded-md font-medium text-white disabled:opacity-50" style={{ background: BLUE }}>Upload Version</button></div></Panel>}</div>}
        {activeTab === "onboarding" && <div className="grid xl:grid-cols-[1fr,380px] gap-5">{(isClient || isAdmin) && <Panel title="Client Onboarding Form" subtitle="Creates a reusable brand profile."><div className="grid md:grid-cols-2 gap-3">{[["Brand name", "brand_name"], ["Website / socials", "website_social_links"], ["Target audience", "target_audience"], ["Business goal", "business_goal"], ["Video goal", "video_goal"], ["Preferred style", "preferred_video_style"], ["Reference links", "reference_video_links"], ["Brand colors", "brand_colors"], ["Logo/assets URL", "logo_assets_url"], ["Tone of voice", "tone_of_voice"], ["Competitors", "competitors"]].map(([label, key]) => <Field key={key} label={label}><input className={inputCls} value={brandForm[key]} onChange={(e) => setBrandForm({ ...brandForm, [key]: e.target.value })} /></Field>)}<Field label="Number of videos"><input type="number" className={inputCls} value={brandForm.number_of_videos_needed} onChange={(e) => setBrandForm({ ...brandForm, number_of_videos_needed: e.target.value })} /></Field><Field label="Deadline"><input type="date" className={inputCls} value={brandForm.deadline} onChange={(e) => setBrandForm({ ...brandForm, deadline: e.target.value })} /></Field></div><div className="mt-3"><div className="label-xs text-zinc-500 mb-2">Platforms needed</div><div className="flex flex-wrap gap-2">{PLATFORMS.map((p) => <button key={p} onClick={() => setBrandForm({ ...brandForm, platforms_needed: brandForm.platforms_needed.includes(p) ? brandForm.platforms_needed.filter((x) => x !== p) : [...brandForm.platforms_needed, p] })} className={`px-3 py-1 rounded-md text-xs border ${brandForm.platforms_needed.includes(p) ? "border-blue-500 text-white" : "border-white/10 text-zinc-500"}`}>{p}</button>)}</div></div><Field label="Notes"><textarea className={textAreaCls} value={brandForm.notes} onChange={(e) => setBrandForm({ ...brandForm, notes: e.target.value })} /></Field><button onClick={saveBrandProfile} disabled={saving} className="mt-4 px-4 py-2 rounded-md text-white font-medium disabled:opacity-50" style={{ background: BLUE }}>Save Brand Profile</button></Panel>}<Panel title="Brand Profiles" subtitle="Scoped by role and project access.">{store.brandProfiles.length === 0 ? <EmptyState title="No brand profile yet" /> : store.brandProfiles.map((p) => <div key={p.id} className="border border-white/10 rounded-lg p-4 mb-3 bg-black/20"><div className="flex justify-between gap-3"><div className="font-semibold">{p.brand_name || "Untitled Brand"}</div>{(isAdmin || isClient) && <button onClick={() => setBrandForm({ ...brandForm, ...p })} className="text-xs text-blue-400">Edit</button>}</div><div className="text-xs text-zinc-500 mt-1">{p.website_social_links || "No links"}</div><div className="flex flex-wrap gap-1 mt-2">{(p.platforms_needed || []).map((x) => <Badge key={x}>{x}</Badge>)}</div><p className="text-sm text-zinc-400 mt-3 line-clamp-3">{p.notes || p.video_goal || "No notes yet."}</p></div>)}</Panel></div>}
        {activeTab === "matching" && isAdmin && <Panel title="Editor Skill Matching" subtitle="Top 3 recommendations based on skills, XP and workload.">{editorMatch.length === 0 ? <EmptyState title="No editors found" /> : <div className="grid md:grid-cols-3 gap-4">{editorMatch.slice(0, 3).map(({ editor, score, reason }, index) => <div key={editor.id} className="border border-white/10 rounded-xl p-4 bg-black/20"><div className="flex justify-between items-start"><div><div className="text-xs text-zinc-500">Recommendation #{index + 1}</div><div className="font-semibold mt-1">{editor.anime_name || editor.display_name}</div></div><div className="text-2xl font-mono text-blue-400">{score}%</div></div><p className="text-sm text-zinc-400 mt-3">{score}% match because this editor is {reason}.</p><div className="flex flex-wrap gap-1 mt-3">{(editor.skills || []).slice(0, 5).map((s) => <Badge key={s}>{s}</Badge>)}</div><button disabled={saving} onClick={() => assignEditor(editor.id)} className="w-full mt-4 py-2 rounded-md bg-white text-black text-sm font-medium disabled:opacity-50">Assign Editor</button></div>)}</div>}</Panel>}
        {activeTab === "profit" && isAdmin && <div className="space-y-5"><div className="grid md:grid-cols-4 gap-4"><MetricCard label="Total Revenue" value={money(profitStats.revenue)} /><MetricCard label="Editor Cost" value={money(profitStats.editorCost)} tone="warn" /><MetricCard label="Total Profit" value={money(profitStats.profit)} tone={profitStats.profit >= 0 ? "good" : "bad"} /><MetricCard label="Profit Margin" value={pct(profitStats.margin)} tone="blue" /><MetricCard label="Pending Payments" value={money(profitStats.pending)} tone="warn" /><MetricCard label="Overdue Payments" value={money(profitStats.overdue)} tone="bad" /></div><Panel title="Project Finance" subtitle="Saved in MongoDB and connected to invoices."><div className="grid md:grid-cols-4 gap-3 items-end"><Field label="Client payment amount"><input type="number" className={inputCls} value={financeForm.client_payment_amount} onChange={(e) => setFinanceForm({ ...financeForm, client_payment_amount: e.target.value })} /></Field><Field label="Editor cost"><input type="number" className={inputCls} value={financeForm.editor_cost} onChange={(e) => setFinanceForm({ ...financeForm, editor_cost: e.target.value })} /></Field><Field label="Extra expenses"><input type="number" className={inputCls} value={financeForm.extra_expenses} onChange={(e) => setFinanceForm({ ...financeForm, extra_expenses: e.target.value })} /></Field><button onClick={saveFinance} disabled={saving} className="py-2 rounded-md text-white disabled:opacity-50" style={{ background: BLUE }}>Save</button></div><div className="mt-5 overflow-x-auto"><table className="w-full text-sm"><thead className="text-zinc-500"><tr><th className="text-left p-2">Project</th><th className="text-left p-2">Revenue</th><th className="text-left p-2">Cost</th><th className="text-left p-2">Profit</th><th className="text-left p-2">Margin</th></tr></thead><tbody>{store.projectFinance.map((f) => <tr key={f.id} className="border-t border-white/5"><td className="p-2">{projectTitle(tasks, f.project_id)}</td><td className="p-2">{money(f.client_payment_amount)}</td><td className="p-2">{money(Number(f.editor_cost || 0) + Number(f.extra_expenses || 0))}</td><td className="p-2">{money(f.final_profit)}</td><td className="p-2">{pct(f.profit_margin)}</td></tr>)}</tbody></table></div></Panel></div>}
        {activeTab === "happiness" && <div className="grid lg:grid-cols-[1fr,360px] gap-5"><Panel title="Client Happiness Score" subtitle="Average, testimonials and needs-attention flags."><div className="grid md:grid-cols-3 gap-4 mb-5"><MetricCard label="Average Score" value={happinessAvg ? `${happinessAvg.toFixed(1)}/10` : "—"} tone={happinessAvg >= 8 ? "good" : happinessAvg ? "warn" : "default"} /><MetricCard label="Feedback Count" value={visibleHappiness.length} /><MetricCard label="Needs Attention" value={visibleHappiness.filter((h) => h.needs_attention).length} tone="bad" /></div>{visibleHappiness.length === 0 ? <EmptyState title="No client feedback yet" /> : visibleHappiness.map((h) => <div key={h.id} className="border border-white/10 rounded-lg p-4 mb-3"><div className="flex justify-between"><div className="font-semibold">{projectTitle(tasks, h.project_id)}</div><Badge tone={h.needs_attention ? "bad" : "good"}>{h.needs_attention ? "Needs Attention" : "Positive"}</Badge></div><div className="text-2xl font-mono text-blue-400 mt-2">{h.rating}/10</div><p className="text-sm text-zinc-400 mt-2">{h.feedback}</p></div>)}</Panel>{isClient && <Panel title="Submit Feedback" subtitle="After project completion."><div className="space-y-3"><Field label="Rating 1–10"><input type="number" min="1" max="10" className={inputCls} value={happinessForm.rating} onChange={(e) => setHappinessForm({ ...happinessForm, rating: e.target.value })} /></Field>{["fast_enough", "clear_communication", "happy_final", "work_again"].map((key) => <Field key={key} label={key.replaceAll("_", " ")}><select className={inputCls} value={happinessForm[key]} onChange={(e) => setHappinessForm({ ...happinessForm, [key]: e.target.value })}><option>Yes</option><option>No</option><option>Somewhat</option></select></Field>)}<Field label="Written feedback / testimonial"><textarea className={textAreaCls} value={happinessForm.feedback} onChange={(e) => setHappinessForm({ ...happinessForm, feedback: e.target.value })} /></Field><button onClick={submitHappiness} disabled={saving} className="w-full py-2 rounded-md text-white disabled:opacity-50" style={{ background: BLUE }}>Submit Score</button></div></Panel>}</div>}
        {activeTab === "invoices" && <div className="grid lg:grid-cols-[1fr,360px] gap-5"><Panel title="Payment / Invoice Tracking" subtitle="MongoDB invoices with client visibility.">{visibleInvoices.length === 0 ? <EmptyState title="No invoices yet" /> : visibleInvoices.map((i) => <div key={i.id} className="border border-white/10 rounded-lg p-4 mb-3 bg-black/20"><div className="flex justify-between gap-3"><div><div className="font-semibold">{i.invoice_number}</div><div className="text-xs text-zinc-500">{projectTitle(tasks, i.project_id)} · due {i.due_date || "—"}</div></div><Badge tone={i.status === "Paid" ? "good" : i.status === "Overdue" || isOverdue(i.due_date, i.status) ? "bad" : "warn"}>{isOverdue(i.due_date, i.status) ? "Overdue" : i.status}</Badge></div><div className="text-2xl font-mono text-white mt-3">{money(i.amount)}</div><div className="flex gap-2 mt-3"><button onClick={() => printInvoice(i)} className="px-3 py-1.5 rounded-md border border-white/10 text-xs">Download PDF</button>{isAdmin && i.status !== "Paid" && <button onClick={() => markInvoicePaid(i.id)} className="px-3 py-1.5 rounded-md bg-white text-black text-xs">Mark paid</button>}</div></div>)}</Panel>{isAdmin && <Panel title="Create Invoice" subtitle="Connected to selected project/client."><div className="space-y-3"><Field label="Amount"><input type="number" className={inputCls} value={invoiceForm.amount} onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })} /></Field><Field label="Due date"><input type="date" className={inputCls} value={invoiceForm.due_date} onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })} /></Field><Field label="Payment method"><input className={inputCls} value={invoiceForm.payment_method} onChange={(e) => setInvoiceForm({ ...invoiceForm, payment_method: e.target.value })} /></Field><Field label="Notes"><textarea className={textAreaCls} value={invoiceForm.notes} onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })} /></Field><button onClick={createInvoice} disabled={saving} className="w-full py-2 rounded-md text-white disabled:opacity-50" style={{ background: BLUE }}>Create Invoice</button></div></Panel>}</div>}
        {activeTab === "calendar" && <div className="grid lg:grid-cols-[1fr,360px] gap-5"><Panel title="Content Calendar" subtitle="Deadlines, approvals, publishing and revision schedule.">{visibleCalendar.length === 0 ? <EmptyState title="No calendar items yet" /> : visibleCalendar.sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0)).map((item) => <div key={item.id} className="border border-white/10 rounded-lg p-4 mb-3 bg-black/20"><div className="flex justify-between gap-3"><div><div className="font-semibold">{item.video_title}</div><div className="text-xs text-zinc-500">{item.project_name} · {item.platform} · {item.due_date || "No date"}</div></div><Badge tone={tagTone(item.status)}>{item.status}</Badge></div></div>)}</Panel>{(isAdmin || isClient) && <Panel title="Create Calendar Item" subtitle="Track video deadlines and publishing dates."><div className="space-y-3"><Field label="Video title"><input className={inputCls} value={calendarForm.video_title} onChange={(e) => setCalendarForm({ ...calendarForm, video_title: e.target.value })} /></Field><Field label="Platform"><select className={inputCls} value={calendarForm.platform} onChange={(e) => setCalendarForm({ ...calendarForm, platform: e.target.value })}>{PLATFORMS.map((p) => <option key={p}>{p}</option>)}</select></Field><Field label="Due date"><input type="date" className={inputCls} value={calendarForm.due_date} onChange={(e) => setCalendarForm({ ...calendarForm, due_date: e.target.value })} /></Field><Field label="Status"><select className={inputCls} value={calendarForm.status} onChange={(e) => setCalendarForm({ ...calendarForm, status: e.target.value })}>{CAL_STATUS.map((s) => <option key={s}>{s}</option>)}</select></Field><button onClick={createCalendarItem} disabled={saving} className="w-full py-2 rounded-md text-white disabled:opacity-50" style={{ background: BLUE }}>Add to Calendar</button></div></Panel>}</div>}
      </section>
    </div>
  </Layout>;
}
