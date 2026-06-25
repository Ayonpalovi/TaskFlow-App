export function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export const STAGES = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "qualified", label: "Qualified" },
  { key: "proposal", label: "Proposal" },
  { key: "negotiation", label: "Negotiation" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

export const STAGE_TONE = {
  new: "default",
  contacted: "blue",
  qualified: "blue",
  proposal: "warn",
  negotiation: "warn",
  won: "good",
  lost: "bad",
};

export const STAGE_DOT = {
  new: "bg-zinc-500",
  contacted: "bg-blue-400",
  qualified: "bg-blue-400",
  proposal: "bg-amber-400",
  negotiation: "bg-amber-400",
  won: "bg-emerald-400",
  lost: "bg-red-400",
};

export const TEMPERATURE_TONE = {
  hot: "bad",
  warm: "warn",
  cold: "blue",
};

export const TEMPERATURE_LABEL = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
};

export const TEMPERATURE_DOT = {
  hot: "bg-red-400",
  warm: "bg-amber-400",
  cold: "bg-blue-400",
};

export const TEMPERATURES = [
  { key: "hot", label: "Hot" },
  { key: "warm", label: "Warm" },
  { key: "cold", label: "Cold" },
];
