import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { api } from "@/lib/api";

const STATUSES = ["open", "in_progress", "resolved"];

export function TicketDetailDialog({ ticketId, open, onOpenChange, onChanged }) {
  const [ticket, setTicket] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open || !ticketId) return;
    api.get(`/growth/tickets/${ticketId}`).then((res) => setTicket(res.data));
  }, [open, ticketId]);

  async function refresh() {
    const res = await api.get(`/growth/tickets/${ticketId}`);
    setTicket(res.data);
    onChanged?.();
  }

  async function send() {
    if (!message.trim()) return;
    await api.post(`/growth/tickets/${ticketId}/messages`, { sender: "you", content: message });
    setMessage("");
    refresh();
  }

  async function setStatus(status) {
    await api.put(`/growth/tickets/${ticketId}`, { status });
    refresh();
  }

  if (!ticket) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{ticket.subject}</DialogTitle>
          <p className="mt-1 text-sm text-zinc-500">{ticket.client_name}</p>
        </DialogHeader>

        <div className="mb-3 flex items-center gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              data-testid={`ticket-status-${s}`}
              className={`rounded-md border px-2.5 py-1 text-xs ${
                ticket.status === s ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-zinc-500"
              }`}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="max-h-72 space-y-3 overflow-y-auto rounded-md border border-white/10 bg-black/20 p-3">
          {ticket.messages.map((m, i) => (
            <div key={i} className={`flex ${m.sender === "you" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-md px-3 py-2 text-sm ${
                  m.sender === "you" ? "bg-blue-500/20 text-white" : "bg-white/10 text-zinc-200"
                }`}
              >
                <p>{m.content}</p>
                <p className="font-mono mt-1 text-[10px] text-zinc-500">{format(new Date(m.created_at), "MMM d, h:mma")}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <textarea className={inputClass} rows={2} placeholder="Reply…" value={message} onChange={(e) => setMessage(e.target.value)} />
          <Button onClick={send} data-testid="ticket-reply-send">Send</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
