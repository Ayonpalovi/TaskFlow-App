export default function LoadingScreen({ label = "Loading" }) {
  return (
    <div className="min-h-screen grid place-items-center bg-zinc-950">
      <div className="flex flex-col items-center gap-5">
        <div className="relative w-12 h-12">
          {/* Track */}
          <div className="absolute inset-0 rounded-full border-2 border-white/10" />
          {/* Spinner */}
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 border-r-blue-500/40 animate-spin" />
          {/* Core glow */}
          <div className="absolute inset-[30%] rounded-full bg-blue-500/20 blur-[6px]" />
        </div>
        <div className="text-[11px] text-zinc-500 font-mono uppercase tracking-[0.3em] animate-pulse">
          {label}
        </div>
      </div>
    </div>
  );
}
