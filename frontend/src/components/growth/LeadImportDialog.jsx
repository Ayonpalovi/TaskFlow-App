import { useState } from "react";
import { UploadSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export function LeadImportDialog({ open, onOpenChange, onImported }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleImport(e) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      // Don't set Content-Type manually — the browser must generate the multipart boundary itself.
      const res = await api.post("/growth/leads/import", formData);
      const { created, duplicates, skipped } = res.data;
      const parts = [`${created} lead${created === 1 ? "" : "s"} imported`];
      if (duplicates) parts.push(`${duplicates} duplicate${duplicates === 1 ? "" : "s"} skipped`);
      if (skipped) parts.push(`${skipped} row${skipped === 1 ? "" : "s"} skipped (no name)`);
      toast.success(parts.join(", "));
      onImported();
      onOpenChange(false);
      setFile(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Couldn't import that file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import leads from CSV</DialogTitle>
        </DialogHeader>
        <p className="mb-4 text-sm text-zinc-500">
          We auto-detect columns like name, company, email, phone, Instagram, niche, and value — no
          need to match exact headers. Every row lands in <span className="text-zinc-300">New</span>,
          duplicates by email are skipped automatically.
        </p>
        <form onSubmit={handleImport} className="space-y-4">
          <label
            htmlFor="csv-file"
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-white/10 bg-zinc-900/30 px-4 py-8 text-center transition-colors hover:border-white/30"
          >
            <UploadSimple size={20} className="text-zinc-500" />
            <span className="text-sm text-zinc-300">{file ? file.name : "Click to choose a .csv file"}</span>
          </label>
          <input
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            data-testid="csv-file-input"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <Button
            type="submit"
            className="w-full"
            disabled={!file || busy}
            data-testid="csv-import-submit"
          >
            {busy ? "Importing…" : "Import leads"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
