import { useEffect } from "react";

const WORKFLOW_PATH = "/moderator/workflow";
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

function getLinkPath(link) {
  try {
    return new URL(link.href, window.location.origin).pathname;
  } catch {
    return link.getAttribute("href");
  }
}

function createModeratorSidebarLink({ path, label, icon, datasetKey }) {
  const link = document.createElement("a");
  link.href = path;
  link.dataset[datasetKey] = "true";
  link.className = navLinkClass(window.location.pathname === path);
  link.innerHTML = `<span class="w-4 text-center text-zinc-400">${icon}</span><span>${label}</span>`;
  return link;
}

function syncInjectedLink({ nav, path, label, icon, datasetKey, insertAfterPath }) {
  const allLinks = Array.from(nav.querySelectorAll("a")).filter((link) => getLinkPath(link) === path);
  const nativeLinks = allLinks.filter((link) => link.dataset[datasetKey] !== "true");
  const injectedLinks = allLinks.filter((link) => link.dataset[datasetKey] === "true");
  const insertAfterLink = Array.from(nav.querySelectorAll("a")).find((link) => getLinkPath(link) === insertAfterPath);

  if (nativeLinks.length > 0) {
    injectedLinks.forEach((link) => link.remove());
    nativeLinks.forEach((link, index) => {
      if (index > 0) {
        link.remove();
        return;
      }
      link.className = navLinkClass(window.location.pathname === path);
    });
    return;
  }

  if (injectedLinks.length > 0) {
    injectedLinks.forEach((link, index) => {
      if (index > 0) {
        link.remove();
        return;
      }
      link.className = navLinkClass(window.location.pathname === path);
    });
    return;
  }

  if (!insertAfterLink) return;
  insertAfterLink.insertAdjacentElement("afterend", createModeratorSidebarLink({ path, label, icon, datasetKey }));
}

function patchModeratorSidebar() {
  if (!window.location.pathname.startsWith("/moderator")) return;

  document.querySelectorAll("aside nav").forEach((nav) => {
    syncInjectedLink({
      nav,
      path: WORKFLOW_PATH,
      label: "Workflow Suite",
      icon: "✦",
      datasetKey: "moderatorWorkflowLink",
      insertAfterPath: "/moderator/overview",
    });

    syncInjectedLink({
      nav,
      path: CREATE_TASK_PATH,
      label: "Create Task",
      icon: "▣",
      datasetKey: "moderatorCreateTaskLink",
      insertAfterPath: "/moderator/tasks",
    });
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
