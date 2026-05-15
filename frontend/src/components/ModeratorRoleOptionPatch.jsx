import { useEffect } from "react";

const CREATE_TASK_PATH = "/moderator/create";

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

function navLinkClass(isActive = false) {
  return [
    "flex",
    "items-center",
    "gap-3",
    "rounded-md",
    "border-l-2",
    "px-3",
    "py-2.5",
    "text-sm",
    "transition-all",
    isActive ? "border-white" : "border-transparent",
    isActive ? "bg-white/10" : "hover:bg-white/5",
    isActive ? "text-white" : "text-zinc-400",
    !isActive ? "hover:text-white" : "",
  ].filter(Boolean).join(" ");
}

function createModeratorCreateTaskLink() {
  const link = document.createElement("a");
  link.href = CREATE_TASK_PATH;
  link.dataset.moderatorCreateTaskLink = "true";
  link.className = navLinkClass(window.location.pathname === CREATE_TASK_PATH);
  link.innerHTML = '<span class="w-4 text-center text-zinc-400">▣</span><span>Create Task</span>';
  return link;
}

function patchModeratorSidebar() {
  if (!window.location.pathname.startsWith("/moderator")) return;

  document.querySelectorAll("aside nav").forEach((nav) => {
    const existing = nav.querySelector('[data-moderator-create-task-link="true"]');
    const tasksLink = Array.from(nav.querySelectorAll("a")).find((link) => link.getAttribute("href") === "/moderator/tasks");

    if (existing) {
      existing.className = navLinkClass(window.location.pathname === CREATE_TASK_PATH);
      return;
    }

    if (!tasksLink) return;
    const createLink = createModeratorCreateTaskLink();
    tasksLink.insertAdjacentElement("afterend", createLink);
  });
}

function patchModeratorEnhancements() {
  patchRoleDropdowns();
  patchModeratorSidebar();
}

export default function ModeratorRoleOptionPatch() {
  useEffect(() => {
    patchModeratorEnhancements();

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    const notifyRouteChange = () => {
      window.dispatchEvent(new Event("motionholic-route-change"));
      window.setTimeout(patchModeratorEnhancements, 0);
    };

    window.history.pushState = function patchedPushState(...args) {
      const result = originalPushState.apply(this, args);
      notifyRouteChange();
      return result;
    };

    window.history.replaceState = function patchedReplaceState(...args) {
      const result = originalReplaceState.apply(this, args);
      notifyRouteChange();
      return result;
    };

    const observer = new MutationObserver(() => patchModeratorEnhancements());
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("popstate", patchModeratorEnhancements);
    window.addEventListener("motionholic-route-change", patchModeratorEnhancements);

    return () => {
      observer.disconnect();
      window.removeEventListener("popstate", patchModeratorEnhancements);
      window.removeEventListener("motionholic-route-change", patchModeratorEnhancements);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  return null;
}
