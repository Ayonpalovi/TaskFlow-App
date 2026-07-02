import { useState } from "react";
import { useParams } from "react-router-dom";
import Layout, { PageHeader, Badge } from "../../components/Layout";

const STORE_KEY = "motionholic_os_deliveries_v1";
const STATUSES = ["Draft", "Sent", "Viewed", "Approved"];

function loadStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveStore(deliveries) {
  localStorage.setItem(STORE_KEY, JSON.stringify(deliveries));
}

const emptyForm = { client: "", project: "", video_url: "", message: "" };

export default function DeliveryPage() {
  const [deliveries, setDeliveries] = useState(loadStore);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [preview, setPreview] = useState(null);

  const update = (next) => {
    setDeliveries(next);
    saveStore(next);
  };

  const createDelivery = () => {
    if (!form.client.trim() || !form.video_url.trim()) return;
    const delivery = { id: `del_${Date.now()}`, ...form, status: "Draft", created_at: new Date().toISOString() };
    update([delivery, ...deliveries]);
    setForm(emptyForm);
    setShowForm(false);
  };

  const setStatus = (id, status) => {
    update(deliveries.map((d) => (d.id === id ? { ...d, status } : d)));
  };

  const removeDelivery = (id) => {
    update(deliveries.filter((d) => d.id !== id));
  };

  const shareUrl = (id) => `${window.location.origin}/delivery/${id}`;

  return (
    <Layout allowed={["admin"]}>
      <PageHeader label="Admin / Delivery" title="Delivery Pages" subtitle="Create branded, shareable handoff pages for finished client work — send the link, track when it's viewed and approved.">
        <button type="button" onClick={() => setShowForm((v) => !v)} className="px-3 py-2 rounded-md bg-[#0051FF] text-white text-sm font-medium hover:opacity-90">
          {showForm ? "Cancel" : "+ New delivery"}
        </button>
      </PageHeader>

      {showForm && (
        <div className="mb-6 border border-white/10 rounded-md bg-zinc-900/30 p-4 lg:p-5">
          <div className="grid sm:grid-cols-2 gap-3">
            <input className="input-field" placeholder="Client name" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} />
            <input className="input-field" placeholder="Project title" value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} />
            <input className="input-field sm:col-span-2" placeholder="Final video URL (YouTube, Drive, etc.)" value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} />
            <textarea className="input-field sm:col-span-2 min-h-[70px]" placeholder="Message to client (optional)" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </div>
          <button type="button" onClick={createDelivery} className="mt-3 px-3 py-2 rounded-md bg-white/10 hover:bg-white/15 text-sm font-medium">Create delivery page</button>
        </div>
      )}

      <div className="grid gap-3">
        {deliveries.map((d) => (
          <div key={d.id} className="border border-white/10 rounded-md bg-zinc-900/20 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium">{d.project || "Untitled delivery"}</div>
                  <Badge tone={d.status === "Approved" ? "good" : d.status === "Viewed" ? "blue" : d.status === "Sent" ? "warn" : "default"}>{d.status}</Badge>
                </div>
                <div className="text-xs text-zinc-500 mt-1">{d.client}</div>
                <div className="text-xs text-zinc-600 mt-1 font-mono truncate">{shareUrl(d.id)}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select className="text-xs bg-zinc-950 border border-white/10 rounded-md px-1.5 py-1" value={d.status} onChange={(e) => setStatus(d.id, e.target.value)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button type="button" onClick={() => setPreview(d)} className="text-xs text-blue-400 hover:underline">Preview</button>
                <button type="button" onClick={() => navigator.clipboard?.writeText(shareUrl(d.id))} className="text-xs text-zinc-400 hover:underline">Copy link</button>
                <button type="button" onClick={() => removeDelivery(d.id)} className="text-xs text-zinc-600 hover:text-red-400">Delete</button>
              </div>
            </div>
          </div>
        ))}
        {deliveries.length === 0 && <div className="text-sm text-zinc-600 text-center py-10 border border-dashed border-white/10 rounded-md">No delivery pages yet.</div>}
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-zinc-950 border border-white/10 rounded-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <DeliveryContent delivery={preview} />
            <div className="p-4 border-t border-white/10 text-right">
              <button type="button" onClick={() => setPreview(null)} className="px-3 py-1.5 rounded-md border border-white/10 text-sm">Close</button>
            </div>
          </div>
        </div>
      )}

      <style>{`.input-field { background: rgba(24,24,27,0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 8px 10px; font-size: 14px; width: 100%; }`}</style>
    </Layout>
  );
}

function DeliveryContent({ delivery }) {
  return (
    <div className="p-6 lg:p-10">
      <div className="text-xs font-mono uppercase tracking-[0.25em] text-[#0051FF] mb-2">Motionholic — Final Delivery</div>
      <h1 className="text-2xl font-semibold">{delivery.project || "Your finished video"}</h1>
      <p className="text-sm text-zinc-400 mt-1">Prepared for {delivery.client}</p>
      {delivery.video_url && (
        <div className="mt-6 aspect-video rounded-md overflow-hidden border border-white/10 bg-zinc-900 grid place-items-center">
          <a href={delivery.video_url} target="_blank" rel="noreferrer" className="text-[#0051FF] text-sm underline break-all px-4">{delivery.video_url}</a>
        </div>
      )}
      {delivery.message && <p className="mt-6 text-sm text-zinc-300 whitespace-pre-wrap">{delivery.message}</p>}
    </div>
  );
}

// Unauthenticated, standalone page for clients — no sidebar / Layout wrapper.
export function PublicDeliveryPage() {
  const { id } = useParams();
  const deliveries = loadStore();
  const delivery = deliveries.find((d) => d.id === id);

  if (!delivery) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white grid place-items-center px-6">
        <div className="text-center">
          <div className="text-lg font-medium">Delivery not found</div>
          <p className="text-sm text-zinc-500 mt-2">This link may have expired or the delivery was removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-2xl mx-auto">
        <DeliveryContent delivery={delivery} />
      </div>
    </div>
  );
}
