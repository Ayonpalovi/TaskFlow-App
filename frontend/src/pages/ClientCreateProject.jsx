import { useState } from "react";
import Layout, { PageHeader } from "../components/Layout";
import { api, formatApiError } from "../lib/api";
import { useNavigate } from "react-router-dom";

function Field({ label, children }) {
  return (
    <div>
      <label className="label-xs text-zinc-400 block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export default function ClientCreateProject() {
  const nav = useNavigate();

  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [f, setF] = useState({
    title: "",
    project_type: "Reel",
    priority: "medium",
    deadline: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    num_videos: 1,
    duration: "60s",
    resolution: "1080p",
    aspect_ratio: "9:16",
    footages_url: "",
    script_url: "",
    brief_goal: "",
    brief_audience: "",
    brief_style: "",
    brief_hook: "",
    brief_body: "",
    brief_cta: "",
    brief_references: "",
    brief_notes: "",
  });

  const updateField = (key, value) => {
    setF((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const submit = async () => {
    setErr("");
    setBusy(true);

    try {
      const payload = {
        ...f,
        num_videos: Number(f.num_videos) || 1,
      };

      await api.post("/tasks", payload);
      nav("/client/panel");
    } catch (e) {
      setErr(
        formatApiError(e?.response?.data?.detail) ||
          "Failed to submit project."
      );
    } finally {
      setBusy(false);
    }
  };

  const inp =
    "w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20";

  return (
    <Layout allowed={["client"]}>
      <PageHeader
        label="Client / Create"
        title="New Project"
        subtitle="Submit your brief — admin approves before assignment."
      >
        <button
          data-testid="submit-project-button"
          onClick={submit}
          disabled={busy}
          className="px-4 py-2 bg-white text-black rounded-md text-sm font-medium hover:bg-zinc-200 disabled:opacity-50"
        >
          {busy ? "Submitting…" : "Submit for approval"}
        </button>
      </PageHeader>

      {err && (
        <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-md">
          {err}
        </div>
      )}

      <div className="space-y-6 max-w-3xl">
        <section className="border border-white/10 rounded-md p-5 bg-zinc-900/30">
          <h3 className="label-xs text-zinc-400 mb-4">Project</h3>

          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Title">
              <input
                data-testid="cp-title"
                className={inp}
                value={f.title}
                onChange={(e) => updateField("title", e.target.value)}
              />
            </Field>

            <Field label="Type">
              <select
                data-testid="cp-type"
                className={inp}
                value={f.project_type}
                onChange={(e) => updateField("project_type", e.target.value)}
              >
                {[
                  "Reel",
                  "Ad",
                  "Podcast",
                  "Documentary",
                  "Vlog",
                  "YouTube",
                  "Short",
                ].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Field>

            <Field label="Priority">
              <select
                data-testid="cp-priority"
                className={inp}
                value={f.priority}
                onChange={(e) => updateField("priority", e.target.value)}
              >
                {["low", "medium", "high", "urgent"].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Field>

            <Field label="Deadline">
              <input
                data-testid="cp-deadline"
                type="date"
                className={inp}
                value={f.deadline}
                onChange={(e) => updateField("deadline", e.target.value)}
              />
            </Field>
          </div>
        </section>

        <section className="border border-white/10 rounded-md p-5 bg-zinc-900/30">
          <h3 className="label-xs text-zinc-400 mb-4">Deliverables</h3>

          <div className="grid md:grid-cols-4 gap-4">
            <Field label="Videos">
              <input
                type="number"
                className={inp}
                value={f.num_videos}
                onChange={(e) => updateField("num_videos", e.target.value)}
              />
            </Field>

            <Field label="Duration">
              <input
                className={inp}
                value={f.duration}
                onChange={(e) => updateField("duration", e.target.value)}
              />
            </Field>

            <Field label="Resolution">
              <input
                className={inp}
                value={f.resolution}
                onChange={(e) => updateField("resolution", e.target.value)}
              />
            </Field>

            <Field label="Aspect">
              <input
                className={inp}
                value={f.aspect_ratio}
                onChange={(e) => updateField("aspect_ratio", e.target.value)}
              />
            </Field>
          </div>
        </section>

        <section className="border border-white/10 rounded-md p-5 bg-zinc-900/30">
          <h3 className="label-xs text-zinc-400 mb-4">Assets</h3>

          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Footages URL">
              <input
                className={inp}
                value={f.footages_url}
                onChange={(e) => updateField("footages_url", e.target.value)}
                placeholder="Drive / Dropbox link"
              />
            </Field>

            <Field label="Script URL">
              <input
                className={inp}
                value={f.script_url}
                onChange={(e) => updateField("script_url", e.target.value)}
                placeholder="Doc link"
              />
            </Field>
          </div>
        </section>

        <section className="border border-white/10 rounded-md p-5 bg-zinc-900/30">
          <h3 className="label-xs text-zinc-400 mb-4">Creative Brief</h3>

          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Goal">
              <textarea
                data-testid="cp-goal"
                rows={2}
                className={inp}
                value={f.brief_goal}
                onChange={(e) => updateField("brief_goal", e.target.value)}
              />
            </Field>

            <Field label="Target Audience">
              <textarea
                rows={2}
                className={inp}
                value={f.brief_audience}
                onChange={(e) => updateField("brief_audience", e.target.value)}
              />
            </Field>

            <Field label="Style">
              <textarea
                rows={2}
                className={inp}
                value={f.brief_style}
                onChange={(e) => updateField("brief_style", e.target.value)}
              />
            </Field>

            <Field label="Hook">
              <textarea
                rows={2}
                className={inp}
                value={f.brief_hook}
                onChange={(e) => updateField("brief_hook", e.target.value)}
              />
            </Field>

            <Field label="Body">
              <textarea
                rows={2}
                className={inp}
                value={f.brief_body}
                onChange={(e) => updateField("brief_body", e.target.value)}
              />
            </Field>

            <Field label="CTA">
              <textarea
                rows={2}
                className={inp}
                value={f.brief_cta}
                onChange={(e) => updateField("brief_cta", e.target.value)}
              />
            </Field>

            <Field label="References">
              <textarea
                rows={2}
                className={inp}
                value={f.brief_references}
                onChange={(e) =>
                  updateField("brief_references", e.target.value)
                }
              />
            </Field>

            <Field label="Notes">
              <textarea
                rows={2}
                className={inp}
                value={f.brief_notes}
                onChange={(e) => updateField("brief_notes", e.target.value)}
              />
            </Field>
          </div>
        </section>
      </div>
    </Layout>
  );
}
