import { useEffect, useState } from "react";
import Layout, { PageHeader, Badge } from "../../components/Layout";
import { api } from "../../lib/api";

export default function ModeratorCalendar() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    api.get("/calendar").then((response) => setItems(Array.isArray(response.data) ? response.data : []));
  }, []);

  const byDate = items.reduce((acc, item) => {
    const date = item.deadline?.slice(0, 10) || "unknown";
    (acc[date] = acc[date] || []).push(item);
    return acc;
  }, {});

  const sortedDates = Object.keys(byDate).sort();

  return (
    <Layout allowed={["moderator"]}>
      <PageHeader label="Moderator / Calendar" title="Deadlines" subtitle="Upcoming and past delivery dates grouped by day." />
      <div className="space-y-4">
        {sortedDates.map((date) => (
          <div key={date} className="border border-white/10 rounded-md bg-zinc-900/30 p-4">
            <div className="label-xs text-zinc-400 mb-3 font-mono">{date}</div>
            <div className="space-y-2">
              {byDate[date].map((task) => (
                <div key={task.task_id || task.id} className="flex items-center gap-3 p-2">
                  <div className="flex-1 text-sm">{task.title}</div>
                  <Badge tone={task.priority === "urgent" ? "bad" : "default"}>{task.priority}</Badge>
                  <Badge tone={task.status === "completed" ? "good" : task.status === "revision" ? "bad" : "warn"}>{task.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        ))}
        {sortedDates.length === 0 && <div className="text-sm text-zinc-500 p-8 text-center">No scheduled deadlines.</div>}
      </div>
    </Layout>
  );
}
