import axios from "axios";

const rawBackendUrl = process.env.REACT_APP_BACKEND_URL;

// Remove trailing slash if someone adds it accidentally
const BACKEND_URL = rawBackendUrl ? rawBackendUrl.replace(/\/$/, "") : "";

export const API = BACKEND_URL ? `${BACKEND_URL}/api` : "";

export const api = axios.create({
  baseURL: API,
  timeout: 20000,
});

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

  return config;
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
