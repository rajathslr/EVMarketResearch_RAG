const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

const TOKEN_KEY = "ev_research_token";
const USER_KEY = "ev_research_user";

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

async function authedFetch(path, { method = "GET", body, isFormData = false } = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
  return data;
}

export async function login(username, password) {
  const data = await authedFetch("/api/auth/login", { method: "POST", body: { username, password } });
  window.localStorage.setItem(TOKEN_KEY, data.access_token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data.user;
}

export async function askQuestion({ question, categoryFilter, appFilter, sourceFilter, comparisonMode, sessionId, topK, scoreThreshold }) {
  return authedFetch("/api/query", {
    method: "POST",
    body: {
      question,
      category_filter: categoryFilter && categoryFilter !== "all" ? categoryFilter : null,
      app_filter: appFilter && appFilter !== "all" ? appFilter : null,
      source_filter: sourceFilter && sourceFilter !== "all" ? sourceFilter : null,
      comparison_mode: !!comparisonMode,
      session_id: sessionId || null,
      top_k: topK,
      score_threshold: scoreThreshold,
    },
  });
}

// ── Sessions ──────────────────────────────────────────────────────────────────
export const listSessions = () => authedFetch("/api/sessions");
export const createSession = () => authedFetch("/api/sessions", { method: "POST" });
export const getSessionMessages = (id) => authedFetch(`/api/sessions/${id}/messages`);
export const saveSessionMessages = (id, messages, title) =>
  authedFetch(`/api/sessions/${id}/messages`, { method: "PUT", body: { messages, title } });
export const appendSessionMessages = (id, messages, title) =>
  authedFetch(`/api/sessions/${id}/messages/append`, { method: "POST", body: { messages, title } });
export const deleteSessionApi = (id) => authedFetch(`/api/sessions/${id}`, { method: "DELETE" });
export const getSessionFeedback = (id) => authedFetch(`/api/sessions/${id}/feedback`);
export const postFeedback = (id, messageIdx, reaction, comment) =>
  authedFetch(`/api/sessions/${id}/feedback`, { method: "POST", body: { message_idx: messageIdx, reaction, comment } });

// ── Admin ─────────────────────────────────────────────────────────────────────
export const getAdminOverview = () => authedFetch("/api/admin/overview");
export const getAdminSources = () => authedFetch("/api/admin/sources");
export const runSource = (source) => authedFetch(`/api/admin/sources/${source}/run`, { method: "POST" });
export const uploadYoutubeTranscript = (app, file) => {
  const form = new FormData();
  form.append("file", file);
  return authedFetch(`/api/admin/youtube/upload?app=${encodeURIComponent(app)}`, { method: "POST", body: form, isFormData: true });
};
export const getSchedules = () => authedFetch("/api/admin/schedules");
export const saveSchedules = (updates) => authedFetch("/api/admin/schedules", { method: "PUT", body: updates });
export const getRunLogs = (source, limit = 50) =>
  authedFetch(`/api/admin/logs?${source && source !== "all" ? `source=${source}&` : ""}limit=${limit}`);
export const getUsers = () => authedFetch("/api/admin/users");
export const createUser = (username, name, role) =>
  authedFetch("/api/admin/users", { method: "POST", body: { username, name, role } });
export const changeUserRole = (username, role) =>
  authedFetch(`/api/admin/users/${encodeURIComponent(username)}/role`, { method: "PUT", body: { role } });
export const resetUserPassword = (username) =>
  authedFetch(`/api/admin/users/${encodeURIComponent(username)}/reset-password`, { method: "POST" });
export const deleteUser = (username) =>
  authedFetch(`/api/admin/users/${encodeURIComponent(username)}`, { method: "DELETE" });

// ── Observability ─────────────────────────────────────────────────────────────
export const getObsKpis = () => authedFetch("/api/obs/kpis");
export const getDailyVolume = (days = 14) => authedFetch(`/api/obs/daily-volume?days=${days}`);
export const getLatencyTrend = (days = 7) => authedFetch(`/api/obs/latency-trend?days=${days}`);
export const getAppDistribution = () => authedFetch("/api/obs/app-distribution");
export const getTokenTrend = (days = 7) => authedFetch(`/api/obs/token-trend?days=${days}`);
export const getRecentQueries = (limit = 50) => authedFetch(`/api/obs/recent-queries?limit=${limit}`);
export const getRecentErrors = (limit = 20) => authedFetch(`/api/obs/recent-errors?limit=${limit}`);
export const getRagasKpis = () => authedFetch("/api/obs/ragas/kpis");
export const getRagasTrend = (days = 7) => authedFetch(`/api/obs/ragas/trend?days=${days}`);
export const getLowScoringQueries = (threshold = 0.5, limit = 20) =>
  authedFetch(`/api/obs/ragas/low-scoring?threshold=${threshold}&limit=${limit}`);
