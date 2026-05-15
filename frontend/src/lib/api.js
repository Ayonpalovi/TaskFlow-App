import axios from "axios";

const rawBackendUrl = process.env.REACT_APP_BACKEND_URL;

// Remove trailing slash if someone adds it accidentally
const BACKEND_URL = rawBackendUrl ? rawBackendUrl.replace(/\/$/, "") : "";

export const API = BACKEND_URL ? `${BACKEND_URL}/api` : "";

export const api = axios.create({
  baseURL: API,
  timeout: 20000,
});

const CLIENT_NAME_KEY = "motionholic_workflow_client_name";
const CLIENT_NAME_MAP_KEY = "motionholic_workflow_client_name_by_id";

function safeLocalStorageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage issues in private browsing or restricted contexts.
  }
}

function clearSessionAndRedirect(message) {
  try {
    window.localStorage.removeItem("taskflow_token");
    window.sessionStorage.setItem("motionholic_auth_notice", message);
  } catch {
    // Ignore storage restrictions.
  }

  if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
    window.location.href = "/login";
  }
}

function shouldRetryModeratorCreateTask(error) {
  const config = error?.config || {};
  const url = String(config.url || "");
  const method = String(config.method || "").toLowerCase();
  const status = error?.response?.status;

  return (
    method === "post" &&
    url === "/workflow/moderator/tasks" &&
    [404, 405].includes(status) &&
    !config._motionholicModeratorTaskRetry
  );
}

// Stop silent broken requests when REACT_APP_BACKEND_URL is missing
api.interceptors.request.use((config) => {
  if (!BACKEND_URL) {
    throw new Error(
      "Missing REACT_APP_BACKEND_URL. Add it in Vercel Environment Variables and redeploy."
    );
  }

  const token = localStorage.getItem("taskflow_token");

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  const url = String(config.url || "");
  const method = String(config.method || "").toLowerCase();
  const isBrandProfileWrite =
    url.includes("/workflow/brandProfiles") && ["post", "patch", "put"].includes(method);

  if (isBrandProfileWrite && config.data && typeof config.data === "object") {
    const clientName = safeLocalStorageGet(CLIENT_NAME_KEY)?.trim();
    if (clientName && !config.data.client_name) {
      config.data = {
        ...config.data,
        client_name: clientName,
      };
    }
  }

  return config;
});

api.interceptors.response.use((response) => {
  const url = String(response?.config?.url || "");
  const profiles = response?.data?.brandProfiles;

  if (url.includes("/workflow/state") && Array.isArray(profiles)) {
    const clientNameById = {};

    profiles.forEach((profile) => {
      if (profile?.client_id && profile?.client_name) {
        clientNameById[profile.client_id] = profile.client_name;
      }
    });

    safeLocalStorageSet(CLIENT_NAME_MAP_KEY, JSON.stringify(clientNameById));
  }

  return response;
}, (error) => {
  if (shouldRetryModeratorCreateTask(error)) {
    return api.request({
      ...error.config,
      url: "/tasks",
      method: "post",
      _motionholicModeratorTaskRetry: true,
    });
  }

  const detail = error?.response?.data?.detail;
  const message = typeof detail === "string" ? detail : "";

  if (error?.response?.status === 403 && message.toLowerCase().includes("deactivated")) {
    clearSessionAndRedirect(message);
  }

  return Promise.reject(error);
});

export function formatApiError(detail) {
  if (detail == null) return "Something went wrong";

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((e) => {
        if (e?.msg) return e.msg;
        if (typeof e === "string") return e;
        return JSON.stringify(e);
      })
      .join(" ");
  }

  if (detail?.msg) return detail.msg;

  return String(detail);
}
