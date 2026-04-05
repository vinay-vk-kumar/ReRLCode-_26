import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const api = axios.create({ baseURL: API_BASE, timeout: 30_000 });

export const simulate = (opts: {
  changedFiles?: string[];
  agentType?: string;
  bugProbability?: number;
}) => api.post("/api/simulate", opts).then((r) => r.data);

export const getMetrics = () => api.get("/api/metrics").then((r) => r.data);
export const getMetricsSeries = (limit = 200) =>
  api.get(`/api/metrics/series?limit=${limit}`).then((r) => r.data);

export const getLogs = (page = 1, limit = 20, agentType?: string) =>
  api
    .get(`/api/logs?page=${page}&limit=${limit}${agentType ? `&agentType=${agentType}` : ""}`)
    .then((r) => r.data);

export const clearLogs = () => api.delete("/api/logs").then((r) => r.data);

export const startTraining = (episodes = 200, agentType = "dqn") =>
  api.post("/api/train", { episodes, agentType }).then((r) => r.data);

export const getTrainingStatus = () =>
  api.get("/api/train/status").then((r) => r.data);

export const getAgentStatus = () =>
  api.get("/api/train/agent-status").then((r) => r.data);

export const resetAll = (agentType = "dqn") =>
  api.post("/api/train/reset", { agentType }).then((r) => r.data);

export const FILES_MAP: Record<string, string[]> = {
  "auth.js":    ["test_auth_login", "test_auth_logout", "test_auth_register"],
  "payment.js": ["test_payment_process", "test_payment_refund", "test_payment_validation"],
  "profile.js": ["test_profile_update", "test_profile_avatar", "test_user_crud"],
  "search.js":  ["test_search_query", "test_search_filter"],
  "user.js":    ["test_user_crud", "test_user_permissions"],
  "db.js":      ["test_db_connection", "test_db_queries"],
  "utils.js":   ["test_utils_helpers"],
  "api.js":     ["test_auth_login", "test_payment_process", "test_search_query"],
  "cache.js":   ["test_cache_hit", "test_db_queries"],
  "email.js":   ["test_email_send", "test_user_crud"],
};

export const ALL_FILES = Object.keys(FILES_MAP);
export const ALL_TESTS = [
  "test_auth_login", "test_auth_logout", "test_auth_register",
  "test_payment_process", "test_payment_refund", "test_payment_validation",
  "test_profile_update", "test_profile_avatar",
  "test_search_query", "test_search_filter",
  "test_user_crud", "test_user_permissions",
  "test_db_connection", "test_db_queries",
  "test_utils_helpers", "test_cache_hit", "test_email_send",
];
