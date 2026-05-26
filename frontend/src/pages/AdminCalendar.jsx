import { useCallback, useEffect, useRef, useState } from "react";
import Layout, { PageHeader } from "../components/Layout";
import { api } from "../lib/api";

// ── Constants ──────────────────────────────────────────────────────────────
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const EVENT_COLORS = [
  { id: "blue",   bg: "bg-blue-500",    text: "text-white",  dot: "bg-blue-500",    label: "Blue"   },
  { id: "green",  bg: "bg-emerald-500", text: "text-white",  dot: "bg-emerald-500", label: "Green"  },
  { id: "red",    bg: "bg-red-500",     text: "text-white",  dot: "bg-red-500",     label: "Red"    },
  { id: "orange", bg: "bg-orange-500",  text: "text-white",  dot: "bg-orange-500",  label: "Orange" },
  { id: "purple", bg: "bg-purple-500",  text: "text-white",  dot: "bg-purple-500",  label: "Purple" },
  { id: "pink",   bg: "bg-pink-500",    text: "text-white",  dot: "bg-pink-500",    label: "Pink"   },
];

const NOTE_COLORS = [
  { id: "yellow", bg: "bg-yellow-500/15", border: "border-yellow-500/30", dot: "bg-yellow-400", label: "Yellow" },
  { id: "blue",   bg: "bg-blue-500/15",   border: "border-blue-500/30",   dot: "bg-blue-400",   label: "Blue"   },
  { id: "green",  bg: "bg-emerald-500/15",border: "border-emerald-500/30",dot: "bg-emerald-400",label: "Green"  },
  { id: "pink",   bg: "bg-pink-500/15",   border: "border-pink-500/30",   dot: "bg-pink-400",   label: "Pink"   },
];

// ── Helpers ────────────────────────────────────────────────────────────────
function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isToday(date) {
  const t = new Date();
  return date.getFullYear() === t.getFullYear() && date.getMonth() === t.getMonth() && date.getDate() === t.getDate();
}

function getMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  const grid  = [];
  const cur   = new Date(first);
  cur.setDate(cur.getDate() - cur.getDay());
  while (cur <= last || cur.getDay() !== 0) {
    const week = [];
    for (let i = 0; i < 7; i++) { week.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    grid.push(week);
    if (cur > last && cur.getDay() === 0) break;
  }
  return grid;
}

function getWeekDays(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return x; });
}

function timeToMin(t) { const [h, m] = (t || "00:00").split(":").map(Number); return h * 60 + m; }
function minToTime(m) { return `${String(Math.floor(m / 60)).padStart(2,"0")}:${String(m % 60).padStart(2,"0")}`; }
function getEventColor(id) { return EVENT_COLORS.find(c => c.id === id) || EVENT_COLORS[0]; }
function getNoteColor(id)  { return NOTE_COLORS.find(c => c.id === id)  || NOTE_COLORS[0]; }

function formatHeaderDate(view, date) {
  if (view === "month") return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
  if (view === "week") {
    const days = getWeekDays(date);
    const s = days[0], e = days[6];
    if (s.getMonth() === e.getMonth()) return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
    return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()} – ${MONTH_NAMES[e.getMonth()]} ${e.getDate()}, ${s.getFullYear()}`;
  }
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

// ── Event Modal ────────────────────────────────────────────────────────────
function EventModal({ initial, onSave, onDelete, onClose }) {
  const isEdit = Boolean(initial?.id);
  const today  = toDateStr(new Date());
  const [form, setForm] = useState({
    title:      initial?.title      || "",
    date:       initial?.date       || today,
    start_time: initial?.start_time || "09:00",
    end_time:   initial?.end_time   || "10:00",
    color:      initial?.color      || "blue",
    note:       initial?.note       || "",
    all_day:    initial?.all_day    || false,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try { await onSave(form); onClose(); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="font-semibold text-sm">{isEdit ? "Edit Event" : "New Event"}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg leading-none">×</button>
        </div>

        <div className="space-y-4 p-5">
          {/* Title */}
          <input
            autoFocus
            value={form.title}
            onChange={e => set("title", e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            placeholder="Event title"
            className="w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm placeholder-zinc-500 focus:border-white/30 focus:outline-none"
          />

          {/* All-day toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={form.all_day} onChange={e => set("all_day", e.target.checked)}
              className="rounded" />
            <span className="text-sm text-zinc-400">All day</span>
          </label>

          {/* Date */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Date</label>
            <input type="date" value={form.date} onChange={e => set("date", e.target.value)}
              className="w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm focus:border-white/30 focus:outline-none" />
          </div>

          {/* Time range */}
          {!form.all_day && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Start</label>
                <input type="time" value={form.start_time} onChange={e => set("start_time", e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm focus:border-white/30 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">End</label>
                <input type="time" value={form.end_time} onChange={e => set("end_time", e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm focus:border-white/30 focus:outline-none" />
              </div>
            </div>
          )}

          {/* Color */}
          <div>
            <label className="block text-xs text-zinc-500 mb-2">Color</label>
            <div className="flex gap-2">
              {EVENT_COLORS.map(c => (
                <button key={c.id} title={c.label}
                  onClick={() => set("color", c.id)}
                  className={`w-6 h-6 rounded-full ${c.dot} transition-transform ${form.color === c.id ? "scale-125 ring-2 ring-white/40" : "opacity-70 hover:opacity-100"}`}
                />
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Notes</label>
            <textarea value={form.note} onChange={e => set("note", e.target.value)} rows={3}
              placeholder="Add notes for this event…"
              className="w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm placeholder-zinc-500 focus:border-white/30 focus:outline-none resize-none" />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 px-5 py-4">
          <div>
            {isEdit && (
              <button onClick={() => { onDelete(initial.id); onClose(); }}
                className="text-sm text-red-400 hover:text-red-300">Delete</button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-md border border-white/10 px-4 py-1.5 text-sm text-zinc-400 hover:text-white">Cancel</button>
            <button onClick={submit} disabled={!form.title.trim() || saving}
              className="rounded-md bg-white px-4 py-1.5 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-40">
              {saving ? "Saving…" : isEdit ? "Save" : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Note Modal ─────────────────────────────────────────────────────────────
function NoteModal({ initial, onSave, onDelete, onClose }) {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState({
    title:   initial?.title   || "",
    content: initial?.content || "",
    color:   initial?.color   || "yellow",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try { await onSave(form); onClose(); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="font-semibold text-sm">{isEdit ? "Edit Note" : "New Note"}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg leading-none">×</button>
        </div>

        <div className="space-y-4 p-5">
          <input autoFocus value={form.title} onChange={e => set("title", e.target.value)}
            onKeyDown={e => e.key === "Enter" && e.shiftKey === false && submit()}
            placeholder="Note title"
            className="w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm placeholder-zinc-500 focus:border-white/30 focus:outline-none" />

          <textarea value={form.content} onChange={e => set("content", e.target.value)} rows={5}
            placeholder="Write your note here…"
            className="w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm placeholder-zinc-500 focus:border-white/30 focus:outline-none resize-none" />

          <div>
            <label className="block text-xs text-zinc-500 mb-2">Color</label>
            <div className="flex gap-2">
              {NOTE_COLORS.map(c => (
                <button key={c.id} title={c.label} onClick={() => set("color", c.id)}
                  className={`w-6 h-6 rounded-full ${c.dot} transition-transform ${form.color === c.id ? "scale-125 ring-2 ring-white/40" : "opacity-60 hover:opacity-100"}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 px-5 py-4">
          <div>{isEdit && <button onClick={() => { onDelete(initial.id); onClose(); }} className="text-sm text-red-400 hover:text-red-300">Delete</button>}</div>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-md border border-white/10 px-4 py-1.5 text-sm text-zinc-400 hover:text-white">Cancel</button>
            <button onClick={submit} disabled={!form.title.trim() || saving}
              className="rounded-md bg-white px-4 py-1.5 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-40">
              {saving ? "Saving…" : isEdit ? "Save" : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Month View ─────────────────────────────────────────────────────────────
function MonthView({ date, events, onDayClick, onEventClick }) {
  const grid  = getMonthGrid(date.getFullYear(), date.getMonth());
  const today = toDateStr(new Date());

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Day labels */}
      <div className="grid grid-cols-7 border-b border-white/10">
        {DAY_LABELS.map(d => (
          <div key={d} className="py-2 text-center text-xs font-medium text-zinc-500">{d}</div>
        ))}
      </div>
      {/* Weeks */}
      <div className="flex-1 grid" style={{ gridTemplateRows: `repeat(${grid.length}, 1fr)` }}>
        {grid.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-white/5 last:border-0">
            {week.map((day, di) => {
              const ds        = toDateStr(day);
              const inMonth   = day.getMonth() === date.getMonth();
              const dayEvents = events.filter(e => e.date === ds);
              const isCurrentDay = ds === today;
              return (
                <div key={di}
                  onClick={() => onDayClick(day)}
                  className={`min-h-[90px] p-1 border-r border-white/5 last:border-0 cursor-pointer hover:bg-white/[0.03] transition-colors ${!inMonth ? "opacity-30" : ""}`}>
                  <div className={`mb-1 w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mx-auto ${isCurrentDay ? "bg-white text-black" : "text-zinc-300"}`}>
                    {day.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map(ev => {
                      const c = getEventColor(ev.color);
                      return (
                        <div key={ev.id}
                          onClick={e => { e.stopPropagation(); onEventClick(ev); }}
                          className={`${c.bg} ${c.text} rounded px-1.5 py-0.5 text-[10px] truncate cursor-pointer hover:opacity-90`}>
                          {!ev.all_day && <span className="opacity-75 mr-1">{ev.start_time}</span>}
                          {ev.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-zinc-500 px-1">+{dayEvents.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Time Grid (shared for week and day) ────────────────────────────────────
function TimeGrid({ days, events, onSlotClick, onEventClick }) {
  const gridRef = useRef(null);
  const ROW_H   = 60; // px per hour

  useEffect(() => {
    if (gridRef.current) {
      const now    = new Date();
      const offset = now.getHours() * ROW_H - 80;
      gridRef.current.scrollTop = Math.max(0, offset);
    }
  }, []);

  const nowMin  = new Date().getHours() * 60 + new Date().getMinutes();
  const todayDs = toDateStr(new Date());

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Day headers */}
      <div className="flex border-b border-white/10 shrink-0">
        <div className="w-14 shrink-0" />
        {days.map((day, i) => {
          const ds = toDateStr(day);
          const td = ds === todayDs;
          return (
            <div key={i} className="flex-1 py-2 text-center border-l border-white/5">
              <div className="text-xs text-zinc-500">{DAY_LABELS[day.getDay()]}</div>
              <div className={`mx-auto mt-0.5 w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold ${td ? "bg-white text-black" : "text-white"}`}>
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable time grid */}
      <div ref={gridRef} className="flex-1 overflow-y-auto">
        <div className="flex relative" style={{ height: `${24 * ROW_H}px` }}>
          {/* Hour labels */}
          <div className="w-14 shrink-0 relative">
            {HOURS.map(h => (
              <div key={h} className="absolute right-2 text-[10px] text-zinc-500 -translate-y-2"
                style={{ top: h * ROW_H }}>
                {h === 0 ? "" : `${String(h).padStart(2,"0")}:00`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, di) => {
            const ds        = toDateStr(day);
            const dayEvents = events.filter(e => e.date === ds && !e.all_day);
            return (
              <div key={di} className="flex-1 relative border-l border-white/5">
                {/* Hour slot click zones */}
                {HOURS.map(h => (
                  <div key={h}
                    style={{ top: h * ROW_H, height: ROW_H }}
                    className="absolute left-0 right-0 border-t border-white/5 cursor-pointer hover:bg-white/[0.03]"
                    onClick={() => onSlotClick(day, h * 60)} />
                ))}
                {/* Events */}
                {dayEvents.map(ev => {
                  const start  = timeToMin(ev.start_time);
                  const end    = timeToMin(ev.end_time);
                  const dur    = Math.max(end - start, 20);
                  const c      = getEventColor(ev.color);
                  return (
                    <div key={ev.id}
                      className={`absolute left-0.5 right-0.5 ${c.bg} ${c.text} rounded px-1.5 py-1 text-[11px] overflow-hidden cursor-pointer z-10 hover:brightness-110`}
                      style={{ top: start + 1, height: dur - 2 }}
                      onClick={e => { e.stopPropagation(); onEventClick(ev); }}>
                      <div className="font-medium truncate leading-tight">{ev.title}</div>
                      {dur > 28 && <div className="opacity-75 text-[10px]">{ev.start_time}–{ev.end_time}</div>}
                    </div>
                  );
                })}
                {/* Current time line */}
                {ds === todayDs && (
                  <div className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                    style={{ top: nowMin }}>
                    <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
                    <div className="flex-1 border-t border-red-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Notes Panel ────────────────────────────────────────────────────────────
function NotesPanel({ notes, onNew, onEdit }) {
  return (
    <div className="w-72 shrink-0 flex flex-col border-l border-white/10 bg-zinc-950/40">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="text-sm font-semibold">Notes</span>
        <button onClick={onNew}
          className="rounded-md bg-white/10 hover:bg-white/20 px-3 py-1 text-xs font-medium text-white transition-colors">
          + New Note
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {notes.length === 0 && (
          <div className="py-8 text-center text-xs text-zinc-500">No notes yet.<br />Click + New Note to create one.</div>
        )}
        {notes.map(n => {
          const c = getNoteColor(n.color);
          return (
            <div key={n.id} onClick={() => onEdit(n)}
              className={`${c.bg} border ${c.border} rounded-xl p-3 cursor-pointer hover:brightness-110 transition-all`}>
              <div className="text-sm font-medium text-white truncate mb-1">{n.title}</div>
              {n.content && <div className="text-xs text-zinc-400 line-clamp-3 whitespace-pre-wrap">{n.content}</div>}
              <div className="mt-2 text-[10px] text-zinc-500">
                {new Date(n.updated_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function AdminCalendar() {
  const [view, setView]         = useState("month");
  const [current, setCurrent]   = useState(new Date());
  const [events, setEvents]     = useState([]);
  const [notes, setNotes]       = useState([]);
  const [eventModal, setEventModal] = useState(null); // null | { initial }
  const [noteModal, setNoteModal]   = useState(null); // null | { initial }

  // ── Data loading ─────────────────────────────────────────────────────────
  const loadEvents = useCallback(async () => {
    try { const r = await api.get("/calendar/events"); setEvents(Array.isArray(r.data) ? r.data : []); } catch {}
  }, []);

  const loadNotes = useCallback(async () => {
    try { const r = await api.get("/calendar/notes"); setNotes(Array.isArray(r.data) ? r.data : []); } catch {}
  }, []);

  useEffect(() => { loadEvents(); loadNotes(); }, [loadEvents, loadNotes]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const navigate = (dir) => {
    setCurrent(prev => {
      const d = new Date(prev);
      if (view === "month") d.setMonth(d.getMonth() + dir);
      else if (view === "week") d.setDate(d.getDate() + dir * 7);
      else d.setDate(d.getDate() + dir);
      return d;
    });
  };

  const goToday = () => setCurrent(new Date());

  // ── Event CRUD ────────────────────────────────────────────────────────────
  const saveEvent = async (form) => {
    if (form._id_to_update) {
      await api.put(`/calendar/events/${form._id_to_update}`, form);
    } else {
      await api.post("/calendar/events", form);
    }
    await loadEvents();
  };

  const deleteEvent = async (id) => {
    await api.delete(`/calendar/events/${id}`);
    await loadEvents();
  };

  const openNewEvent = (day, startMin) => {
    const date       = toDateStr(day || new Date());
    const start_time = startMin != null ? minToTime(startMin) : "09:00";
    const end_time   = startMin != null ? minToTime(startMin + 60) : "10:00";
    setEventModal({ initial: { date, start_time, end_time } });
  };

  const openEditEvent = (ev) => {
    setEventModal({ initial: { ...ev, _id_to_update: ev.id } });
  };

  // ── Note CRUD ─────────────────────────────────────────────────────────────
  const saveNote = async (form) => {
    if (form._id_to_update) {
      await api.put(`/calendar/notes/${form._id_to_update}`, form);
    } else {
      await api.post("/calendar/notes", form);
    }
    await loadNotes();
  };

  const deleteNote = async (id) => {
    await api.delete(`/calendar/notes/${id}`);
    await loadNotes();
  };

  const openEditNote = (n) => setNoteModal({ initial: { ...n, _id_to_update: n.id } });

  // ── Compute displayed days ────────────────────────────────────────────────
  const weekDays = getWeekDays(current);

  return (
    <Layout allowed={["admin"]}>
      <PageHeader label="Admin / Calendar" title="Calendar" subtitle="Book tasks, set reminders, and manage your schedule." />

      <div className="flex gap-0 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/20"
        style={{ height: "calc(100vh - 196px)", minHeight: 520 }}>

        {/* ── Calendar area ─────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col min-w-0">

          {/* Header toolbar */}
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 shrink-0">
            <div className="flex items-center gap-2">
              <button onClick={() => navigate(-1)}
                className="rounded-md border border-white/10 px-2.5 py-1.5 text-sm text-zinc-400 hover:bg-white/5 hover:text-white">‹</button>
              <button onClick={goToday}
                className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-zinc-400 hover:bg-white/5 hover:text-white">Today</button>
              <button onClick={() => navigate(1)}
                className="rounded-md border border-white/10 px-2.5 py-1.5 text-sm text-zinc-400 hover:bg-white/5 hover:text-white">›</button>
              <span className="ml-2 font-semibold text-sm">{formatHeaderDate(view, current)}</span>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => openNewEvent(null, null)}
                className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-zinc-200">
                + New Event
              </button>
              <div className="flex rounded-md border border-white/10 overflow-hidden text-sm">
                {["month","week","day"].map(v => (
                  <button key={v} onClick={() => setView(v)}
                    className={`px-3 py-1.5 capitalize transition-colors ${view === v ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white hover:bg-white/5"}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Calendar views */}
          {view === "month" && (
            <MonthView
              date={current}
              events={events}
              onDayClick={(day) => openNewEvent(day, null)}
              onEventClick={openEditEvent}
            />
          )}
          {view === "week" && (
            <TimeGrid
              days={weekDays}
              events={events}
              onSlotClick={openNewEvent}
              onEventClick={openEditEvent}
            />
          )}
          {view === "day" && (
            <TimeGrid
              days={[current]}
              events={events}
              onSlotClick={openNewEvent}
              onEventClick={openEditEvent}
            />
          )}
        </div>

        {/* ── Notes panel ───────────────────────────────────────────────── */}
        <NotesPanel
          notes={notes}
          onNew={() => setNoteModal({ initial: {} })}
          onEdit={openEditNote}
        />
      </div>

      {/* Modals */}
      {eventModal && (
        <EventModal
          initial={eventModal.initial}
          onSave={saveEvent}
          onDelete={deleteEvent}
          onClose={() => setEventModal(null)}
        />
      )}
      {noteModal && (
        <NoteModal
          initial={noteModal.initial}
          onSave={saveNote}
          onDelete={deleteNote}
          onClose={() => setNoteModal(null)}
        />
      )}
    </Layout>
  );
}
