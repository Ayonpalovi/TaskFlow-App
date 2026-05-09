import { useEffect, useState } from "react";
import Layout, { PageHeader, Badge } from "../components/Layout";
import DeadlineBar from "../components/DeadlineBar";
import { api } from "../lib/api";
import { playActionFeedback } from "../lib/actionFeedback";

export default function AdminApprovals() {
  const [pendingProjects, setPendingProjects] = useState([]);
  const [pendingVideos, setPendingVideos] = useState([]);

  const load = async () => {
    const { data } = await api.get("/tasks");
    setPendingProjects(data.filter(t => t.status === "pending_admin_approval"));
    setPendingVideos(data.filter(t => t.status === "submitted"));
  };
  useEffect(() => { load(); }, []);

  const approveProject = async (id) => {
    playActionFeedback("approve");
    await api.post(`/tasks/${id}/admin-approve`);
    load();
  };

  const rejectProject = async (id) => {
    playActionFeedback("reject");
    await api.post(`/tasks/${id}/admin-reject`);
    load();
  };

  const approveVideo = async (id) => {
    playActionFeedback("approve");
    await api.post(`/tasks/${id}/admin-approve-video`);
    load();
  };

  return (
    <Layout allowed={["admin"]}>
      <PageHeader label="Admin / Approvals" title="Approval Queue" subtitle="Approve client projects (12h to assign) and video submissions (6h or auto-approved)." />

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="border border-white/10 rounded-md p-5 bg-zinc-900/30">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Pending project approvals</h2>
            <Badge tone="warn">{pendingProjects.length}</Badge>
          </div>
          <div className="space-y-3">
            {pendingProjects.length === 0 && <div className="text-sm text-zinc-500">All clear.</div>}
            {pendingProjects.map(t => (
              <div key={t.id} className="border border-white/10 rounded-md p-4" data-testid={`pending-project-${t.id}`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-medium">{t.title}</div>
                    <div className="text-xs text-zinc-500">{t.project_type} · {t.priority}</div>
                  </div>
                  <Badge tone={t.priority === "urgent" ? "bad" : "default"}>{t.priority}</Badge>
                </div>
                <div className="text-xs text-zinc-400 mb-3 line-clamp-2">{t.brief_goal || "—"}</div>
                <DeadlineBar deadline={t.deadline} status={t.status} compact />
                <div className="flex gap-2 mt-3">
                  <button onClick={() => approveProject(t.id)} data-testid={`approve-project-${t.id}`} className="flex-1 bg-white text-black text-xs py-2 rounded-md font-medium hover:bg-zinc-200">Approve</button>
                  <button onClick={() => rejectProject(t.id)} data-testid={`reject-project-${t.id}`} className="flex-1 border border-white/10 text-xs py-2 rounded-md hover:bg-white/5">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-white/10 rounded-md p-5 bg-zinc-900/30">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Pending video approvals</h2>
            <Badge tone="warn">{pendingVideos.length}</Badge>
          </div>
          <div className="text-xs text-zinc-500 mb-3">Auto-approved after 6 hours.</div>
          <div className="space-y-3">
            {pendingVideos.length === 0 && <div className="text-sm text-zinc-500">No videos awaiting review.</div>}
            {pendingVideos.map(t => (
              <div key={t.id} className="border border-white/10 rounded-md p-4" data-testid={`pending-video-${t.id}`}>
                <div className="font-medium mb-1">{t.title}</div>
                <div className="text-xs text-zinc-500 mb-2">Submitted {t.submitted_at?.slice(0, 16).replace("T", " ")}</div>
                {t.video_url && <a href={t.video_url} target="_blank" rel="noreferrer" className="block text-xs text-blue-400 hover:underline truncate font-mono mb-2">{t.video_url}</a>}
                <button onClick={() => approveVideo(t.id)} data-testid={`approve-video-${t.id}`} className="w-full bg-emerald-500 text-black text-xs py-2 rounded-md font-medium hover:bg-emerald-400">Approve & send to client</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
