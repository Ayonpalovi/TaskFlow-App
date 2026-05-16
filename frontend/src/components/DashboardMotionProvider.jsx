import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const PUBLIC_ROUTES = new Set(["/login", "/register", "/showcase"]);
const DASHBOARD_ROUTES = new Set(["/admin", "/client", "/editor", "/moderator"]);
const CLIENT_NAME_KEY = "motionholic_workflow_client_name";
const CLIENT_NAME_MAP_KEY = "motionholic_workflow_client_name_by_id";

function getClientNameMap() {
  try {
    return JSON.parse(window.localStorage.getItem(CLIENT_NAME_MAP_KEY) || "{}");
  } catch {
    return {};
  }
}

function enhanceClientOnboarding() {
  const headings = [...document.querySelectorAll("h2")];
  const onboardingHeading = headings.find((heading) =>
    heading.textContent?.trim().toLowerCase() === "client onboarding form"
  );

  if (!onboardingHeading) return;

  const panel = onboardingHeading.closest(".border");
  if (!panel || panel.querySelector('[data-mh-client-name-field="true"]')) return;

  const firstGrid = panel.querySelector(".grid.md\\:grid-cols-2");
  if (!firstGrid) return;

  const label = document.createElement("label");
  label.className = "block";
  label.setAttribute("data-mh-client-name-field", "true");
  label.innerHTML = `
    <div class="label-xs text-zinc-500 mb-2">Client name</div>
    <input class="w-full bg-zinc-950 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500" placeholder="Client name" value="${window.localStorage.getItem(CLIENT_NAME_KEY) || ""}" />
  `;

  const input = label.querySelector("input");
  input?.addEventListener("input", (event) => {
    window.localStorage.setItem(CLIENT_NAME_KEY, event.target.value || "");
  });

  firstGrid.prepend(label);
}

function enhanceClientBrandProfiles() {
  const clientNameMap = getClientNameMap();
  const labels = [...document.querySelectorAll(".text-xs.text-zinc-500")].filter((node) =>
    node.textContent?.trim().startsWith("Client ID:")
  );

  labels.forEach((node) => {
    if (node.parentElement?.querySelector('[data-mh-client-name-display="true"]')) return;

    const clientId = node.textContent.replace("Client ID:", "").trim();
    const clientName = clientNameMap[clientId];
    if (!clientName) return;

    const display = document.createElement("div");
    display.className = "text-xs text-blue-300 mt-1";
    display.setAttribute("data-mh-client-name-display", "true");
    display.textContent = `Client Name: ${clientName}`;
    node.insertAdjacentElement("beforebegin", display);
  });
}

export default function DashboardMotionProvider() {
  const location = useLocation();

  useEffect(() => {
    const isPublicRoute = PUBLIC_ROUTES.has(location.pathname);
    const isDashboardRoute = DASHBOARD_ROUTES.has(location.pathname);

    document.body.classList.toggle("mh-saas-motion", !isPublicRoute);
    document.body.classList.toggle("mh-dashboard-motion", isDashboardRoute);

    return () => {
      document.body.classList.remove("mh-saas-motion");
      document.body.classList.remove("mh-dashboard-motion");
    };
  }, [location.pathname]);

  useEffect(() => {
    if (PUBLIC_ROUTES.has(location.pathname)) return undefined;

    const runEnhancers = () => {
      enhanceClientOnboarding();
      enhanceClientBrandProfiles();
    };

    runEnhancers();
    const observer = new MutationObserver(runEnhancers);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [location.pathname]);

  return null;
}
