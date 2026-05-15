import { useEffect } from "react";

function ensureModeratorOption(select) {
  if (!select) return;
  const hasEditor = Array.from(select.options || []).some((option) => option.value === "editor");
  const hasClient = Array.from(select.options || []).some((option) => option.value === "client");
  const hasModerator = Array.from(select.options || []).some((option) => option.value === "moderator");

  if (!hasEditor || !hasClient || hasModerator) return;

  const option = document.createElement("option");
  option.value = "moderator";
  option.textContent = "Moderator";
  select.appendChild(option);
}

function patchRoleDropdowns() {
  document.querySelectorAll("select").forEach(ensureModeratorOption);
}

export default function ModeratorRoleOptionPatch() {
  useEffect(() => {
    patchRoleDropdowns();

    const observer = new MutationObserver(() => patchRoleDropdowns());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
