import { useEffect, useState } from "react";

export default function DeadlineBar({ deadline, status, compact = false }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  if (!deadline) return null;
  let d;
  try {
    d = new Date(deadline.includes("T") ? deadline : deadline + "T23:59:59Z");
  } catch { return null; }
  const isCompleted = status === "completed" || status === "past_work";
  const totalMs = d.getTime() - now;
  const days = Math.floor(Math.abs(totalMs) / 86400000);
  const hours = Math.floor((Math.abs(totalMs) % 86400000) / 3600000);
  const overdue = totalMs < 0 && !isCompleted;
  const hoursLeft = totalMs / 3600000;

  let color, label;
  if (isCompleted) {
    color = "#10B981"; label = "Delivered";
  } else if (overdue) {
    color = "#EF4444"; label = `Overdue · ${days}d ${hours}h late`;
  } else if (hoursLeft < 24) {
    color = "#EF4444"; label = `${hours}h left · urgent`;
  } else if (hoursLeft < 72) {
    color = "#F59E0B"; label = `${days}d ${hours}h left`;
  } else {
    color = "#10B981"; label = `${days}d ${hours}h left`;
  }

  // % progress: assume created_at was deadline - 7d (rough). For simplicity show a saturation bar.
  const totalWindow = 7 * 24; // 7 days assumed
  const pct = isCompleted ? 100 : Math.max(0, Math.min(100, 100 - (hoursLeft / totalWindow * 100)));

  if (compact) {
    return (
      <div className="text-xs font-mono flex items-center gap-1.5" style={{ color }}>
        <div className="w-16 h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
        <span>{label}</span>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-zinc-500">Deadline</span>
        <span className="font-mono" style={{ color }}>{label}</span>
      </div>
      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
