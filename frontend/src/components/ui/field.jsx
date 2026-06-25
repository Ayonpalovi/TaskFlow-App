export function Field({ label, children }) {
  return (
    <div>
      <label className="label-xs text-zinc-400 block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export const inputClass =
  "w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20";
