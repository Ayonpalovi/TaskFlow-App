import { useEffect, useMemo, useState } from "react";
import Layout, { PageHeader, Badge, MetricCard } from "../components/Layout";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { playActionFeedback } from "../lib/actionFeedback";

const BLUE = "#0051FF";
const PLATFORMS = ["Instagram", "TikTok", "YouTube Shorts", "LinkedIn", "Facebook"];
const STATUSES = ["Brief Submitted", "Editing", "Internal Review", "Sent to Client", "Revision Requested", "Approved", "Scheduled", "Published"];
const EMPTY = { brandProfiles: [], calendarItems: [], happinessScores: [] };
const inputCls = "w-full bg-zinc-950 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500";
const textAreaCls = `${inputCls} min-h-[92px] resize-y`;

function key(user) { return `motionholic_safe_workflow_${user?.id || "guest"}`; }
function load(user) { try { return { ...EMPTY, ...(JSON.parse(localStorage.getItem(key(user))) || {}) }; } catch { return EMPTY; } }
function save(user, data) { localStorage.setItem(key(user), JSON.stringify(data)); }
function id(prefix) { return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`; }
function now() { return new Date().toISOString(); }
function Field({ label, children }) { return <label className="block"><div className="label-xs text-zinc-500 mb-2">{label}</div>{children}</label>; }
function Panel({ title, subtitle, children }) { return <div className="border border-white/10 rounded-xl bg-zinc-900/30 p-5"><div className="mb-4"><h2 className="text-lg font-semibold">{title}</h2>{subtitle && <p className="text-sm text-zinc-500 mt-1">{subtitle}</p>}</div>{children}</div>; }
function Empty({ title, subtitle }) { return <div className="border border-dashed border-white/10 rounded-lg p-8 text-center bg-black/20"><div className="text-sm text-zinc-300">{title}</div>{subtitle && <div className="text-xs text-zinc-600 mt-1">{subtitle}</div>}</div>; }
function tone(status) { if (["Approved", "Scheduled", "Published"].includes(status)) return "good"; if (status === "Revision Requested") return "bad"; return "blue"; }

export default function WorkflowSuiteSafe() {
  const { user } = useAuth();
  const role = user?.role;
  const isClient = role === "client";
  const isAdmin = role === "admin";
  const [tasks, setTasks] = useState([]);
  const [store, setStore] = useState(EMPTY);
  const [activeTab, setActiveTab] = useState("brand");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("Workflow buttons are active. Data is saved safely in this browser until the backend workflow API is fully connected.");

  const [brand, setBrand] = useState({ brand_name: "", website_social_links: "", target_audience: "", business_goal: "", video_goal: "", preferred_video_style: "", reference_video_links: "", brand_colors: "", logo_assets_url: "", tone_of_voice: "", competitors: "", platforms_needed: [], number_of_videos_needed: 1, deadline: "", notes: "" });
  const [calendar, setCalendar] = useState({ video_title: "", platform: "Instagram", due_date: "", status: "Brief Submitted" });
  const [happiness, setHappiness] = useState({ rating: 10, fast_enough: "Yes", clear_communication: "Yes", happy_final: "Yes", work_again: "Yes", feedback: "" });

  useEffect(() => {
    setStore(load(user));
    api.get("/tasks").then((res) => setTasks(Array.isArray(res.data) ? res.data : [])).catch(() => setTasks([]));
  }, [user]);

  const write = (next) => { setStore(next); save(user, next); };
  const projectName = tasks[0]?.title || "General Workflow";
  const projectId = tasks[0]?.id || `general_${user?.id || "guest"}`;
  const clientId = tasks[0]?.client_id || user?.id;

  const saveBrand = () => {
    setSaving(true);
    const existing = store.brandProfiles.find((item) => item.client_id === clientId);
    const doc = { ...(existing || {}), ...brand, id: existing?.id || id("brand"), client_id: clientId, project_id: projectId, updated_at: now(), created_at: existing?.created_at || now() };
    write({ ...store, brandProfiles: [doc, ...store.brandProfiles.filter((item) => item.id !== doc.id)] });
    playActionFeedback("approve");
    setSaving(false);
    setNotice("Brand profile saved.");
  };

  const addCalendar = () => {
    setSaving(true);
    const doc = { id: id("calendar"), project_id: projectId, client_id: clientId, project_name: projectName, video_title: calendar.video_title || projectName, platform: calendar.platform, due_date: calendar.due_date, status: calendar.status, created_at: now() };
    write({ ...store, calendarItems: [doc, ...store.calendarItems] });
    setCalendar({ video_title: "", platform: "Instagram", due_date: "", status: "Brief Submitted" });
    playActionFeedback("approve");
    setSaving(false);
    setNotice("Calendar item added.");
  };

  const submitScore = () => {
    setSaving(true);
    const rating = Number(happiness.rating || 0);
    const doc = { id: id("score"), project_id: projectId, client_id: clientId, project_name: projectName, ...happiness, rating, needs_attention: rating < 7, created_at: now() };
    write({ ...store, happinessScores: [doc, ...store.happinessScores] });
    setHappiness({ rating: 10, fast_enough: "Yes", clear_communication: "Yes", happy_final: "Yes", work_again: "Yes", feedback: "" });
    playActionFeedback("approve");
    setSaving(false);
    setNotice("Client happiness score submitted.");
  };

  const avg = useMemo(() => store.happinessScores.length ? store.happinessScores.reduce((sum, item) => sum + Number(item.rating || 0), 0) / store.happinessScores.length : 0, [store.happinessScores]);
  const tabs = [
    ["brand", "Brand Profile"], ["calendar", "Calendar"], ["happiness", "Happiness"],
    ["review", "Video Review"], ["versions", "Versions"],
    ...(isAdmin ? [["matching", "Skill Match"], ["profit", "Profit"], ["invoices", "Invoices"]] : [])
  ];

  return <Layout allowed={[role]}>
    <PageHeader label={`${role} / Workflow Suite`} title="Motionholic Workflow Suite" subtitle="Connected workflow hub for brand, calendar, feedback, review, versions, invoices, and profit." />
    {notice && <div className="mb-4 border border-amber-500/20 bg-amber-500/10 text-amber-200 rounded-md px-4 py-3 text-sm">{notice}</div>}
    <div className="grid lg:grid-cols-[280px,1fr] gap-5">
      <aside className="space-y-4">
        <Panel title="Project Context" subtitle="Safe workflow mode">{tasks.length === 0 ? <Empty title="No projects yet" subtitle="You can still save brand, calendar, and feedback items." /> : <div className="text-sm text-zinc-300">{projectName}</div>}</Panel>
        <div className="border border-white/10 rounded-xl bg-zinc-900/30 p-2">{tabs.map(([tab, label]) => <button key={tab} onClick={() => setActiveTab(tab)} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm ${activeTab === tab ? "text-white" : "text-zinc-500 hover:text-white hover:bg-white/5"}`} style={activeTab === tab ? { background: BLUE } : {}}>{label}</button>)}</div>
      </aside>
      <section className="space-y-5">
        {activeTab === "brand" && <div className="grid xl:grid-cols-[1fr,380px] gap-5">{(isClient || isAdmin) && <Panel title="Client Onboarding Form" subtitle="Save project and brand details."><div className="grid md:grid-cols-2 gap-3">{[["Brand name", "brand_name"], ["Website / socials", "website_social_links"], ["Target audience", "target_audience"], ["Business goal", "business_goal"], ["Video goal", "video_goal"], ["Preferred style", "preferred_video_style"], ["Reference links", "reference_video_links"], ["Brand colors", "brand_colors"], ["Logo/assets URL", "logo_assets_url"], ["Tone of voice", "tone_of_voice"], ["Competitors", "competitors"]].map(([label, field]) => <Field key={field} label={label}><input className={inputCls} value={brand[field]} onChange={(e) => setBrand({ ...brand, [field]: e.target.value })} /></Field>)}<Field label="Number of videos"><input type="number" className={inputCls} value={brand.number_of_videos_needed} onChange={(e) => setBrand({ ...brand, number_of_videos_needed: e.target.value })} /></Field><Field label="Deadline"><input type="date" className={inputCls} value={brand.deadline} onChange={(e) => setBrand({ ...brand, deadline: e.target.value })} /></Field></div><div className="mt-3"><div className="label-xs text-zinc-500 mb-2">Platforms needed</div><div className="flex flex-wrap gap-2">{PLATFORMS.map((p) => <button key={p} onClick={() => setBrand({ ...brand, platforms_needed: brand.platforms_needed.includes(p) ? brand.platforms_needed.filter((x) => x !== p) : [...brand.platforms_needed, p] })} className={`px-3 py-1 rounded-md text-xs border ${brand.platforms_needed.includes(p) ? "border-blue-500 text-white" : "border-white/10 text-zinc-500"}`}>{p}</button>)}</div></div><Field label="Notes"><textarea className={textAreaCls} value={brand.notes} onChange={(e) => setBrand({ ...brand, notes: e.target.value })} /></Field><button onClick={saveBrand} disabled={saving} className="mt-4 px-4 py-2 rounded-md text-white disabled:opacity-50" style={{ background: BLUE }}>{saving ? "Saving…" : "Save Brand Profile"}</button></Panel>}<Panel title="Brand Profiles" subtitle="Saved profiles">{store.brandProfiles.length === 0 ? <Empty title="No brand profile yet" /> : store.brandProfiles.map((item) => <div key={item.id} className="border border-white/10 rounded-lg p-4 mb-3 bg-black/20"><div className="font-semibold">{item.brand_name || "Untitled Brand"}</div><div className="text-xs text-zinc-500 mt-1">{item.website_social_links || "No links"}</div><div className="flex flex-wrap gap-1 mt-2">{(item.platforms_needed || []).map((p) => <Badge key={p}>{p}</Badge>)}</div><button onClick={() => setBrand({ ...brand, ...item })} className="text-xs text-blue-400 mt-3">Edit</button></div>)}</Panel></div>}
        {activeTab === "calendar" && <div className="grid lg:grid-cols-[1fr,360px] gap-5"><Panel title="Content Calendar" subtitle="Deadlines and publishing schedule">{store.calendarItems.length === 0 ? <Empty title="No calendar items yet" /> : store.calendarItems.map((item) => <div key={item.id} className="border border-white/10 rounded-lg p-4 mb-3 bg-black/20"><div className="flex justify-between"><div><div className="font-semibold">{item.video_title}</div><div className="text-xs text-zinc-500">{item.platform} · {item.due_date || "No date"}</div></div><Badge tone={tone(item.status)}>{item.status}</Badge></div></div>)}</Panel>{(isClient || isAdmin) && <Panel title="Create Calendar Item"><div className="space-y-3"><Field label="Video title"><input className={inputCls} value={calendar.video_title} onChange={(e) => setCalendar({ ...calendar, video_title: e.target.value })} /></Field><Field label="Platform"><select className={inputCls} value={calendar.platform} onChange={(e) => setCalendar({ ...calendar, platform: e.target.value })}>{PLATFORMS.map((p) => <option key={p}>{p}</option>)}</select></Field><Field label="Due date"><input type="date" className={inputCls} value={calendar.due_date} onChange={(e) => setCalendar({ ...calendar, due_date: e.target.value })} /></Field><Field label="Status"><select className={inputCls} value={calendar.status} onChange={(e) => setCalendar({ ...calendar, status: e.target.value })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field><button onClick={addCalendar} disabled={saving} className="w-full py-2 rounded-md text-white disabled:opacity-50" style={{ background: BLUE }}>{saving ? "Saving…" : "Add to Calendar"}</button></div></Panel>}</div>}
        {activeTab === "happiness" && <div className="grid lg:grid-cols-[1fr,360px] gap-5"><Panel title="Client Happiness Score"><div className="grid md:grid-cols-3 gap-4 mb-5"><MetricCard label="Average Score" value={avg ? `${avg.toFixed(1)}/10` : "—"} /><MetricCard label="Feedback Count" value={store.happinessScores.length} /><MetricCard label="Needs Attention" value={store.happinessScores.filter((s) => s.needs_attention).length} tone="bad" /></div>{store.happinessScores.length === 0 ? <Empty title="No client feedback yet" /> : store.happinessScores.map((item) => <div key={item.id} className="border border-white/10 rounded-lg p-4 mb-3"><div className="flex justify-between"><div className="font-semibold">{item.project_name}</div><Badge tone={item.needs_attention ? "bad" : "good"}>{item.needs_attention ? "Needs Attention" : "Positive"}</Badge></div><div className="text-2xl font-mono text-blue-400 mt-2">{item.rating}/10</div><p className="text-sm text-zinc-400 mt-2">{item.feedback}</p></div>)}</Panel>{isClient && <Panel title="Submit Feedback"><div className="space-y-3"><Field label="Rating 1–10"><input type="number" min="1" max="10" className={inputCls} value={happiness.rating} onChange={(e) => setHappiness({ ...happiness, rating: e.target.value })} /></Field>{["fast_enough", "clear_communication", "happy_final", "work_again"].map((field) => <Field key={field} label={field.replaceAll("_", " ")}><select className={inputCls} value={happiness[field]} onChange={(e) => setHappiness({ ...happiness, [field]: e.target.value })}><option>Yes</option><option>No</option><option>Somewhat</option></select></Field>)}<Field label="Written feedback / testimonial"><textarea className={textAreaCls} value={happiness.feedback} onChange={(e) => setHappiness({ ...happiness, feedback: e.target.value })} /></Field><button onClick={submitScore} disabled={saving} className="w-full py-2 rounded-md text-white disabled:opacity-50" style={{ background: BLUE }}>{saving ? "Saving…" : "Submit Score"}</button></div></Panel>}</div>}
        {!['brand','calendar','happiness'].includes(activeTab) && <Panel title={tabs.find(([t]) => t === activeTab)?.[1] || "Workflow Module"} subtitle="This module is connected in the full Workflow Suite. Create a project first to use this section fully."><Empty title="Create or select a project first" subtitle="Brand profile, calendar, and happiness score now work without a project." /></Panel>}
      </section>
    </div>
  </Layout>;
}
