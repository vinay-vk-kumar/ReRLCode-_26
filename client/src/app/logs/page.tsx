"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { Trash2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { getLogs, clearLogs } from "@/lib/api";

interface Episode {
  _id: string;
  changedFiles: string[];
  selectedTests: string[];
  bugExists: boolean;
  bugDetected: boolean;
  reward: number;
  timeSaved: number;
  selectedCount: number;
  agentType: string;
  epsilon: number;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function LogsPage() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loading, setLoading] = useState(false);
  const [agentFilter, setAgentFilter] = useState("");

  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await getLogs(page, 20, agentFilter || undefined);
      setEpisodes(data.episodes);
      setPagination(data.pagination);
    } catch { toast.error("Failed to load logs."); }
    finally { setLoading(false); }
  }, [agentFilter]);

  useEffect(() => { fetchLogs(1); }, [fetchLogs]);

  async function handleClear() {
    if (!confirm("Clear all episode logs? This cannot be undone.")) return;
    await clearLogs();
    toast.success("Logs cleared.");
    fetchLogs(1);
  }

  return (
    <div className="page-container" style={{ maxWidth: 1200 }}>
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
              Episode <span className="gradient-text">Logs</span>
            </h1>
            <p style={{ color: "var(--text-2)", fontSize: 15 }}>
              Full history of every simulation the RL agent has run — {pagination.total} episodes total.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
              style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-1)", borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
              <option value="">All agents</option>
              <option value="dqn">DQN</option>
              <option value="q_learning">Q-Learning</option>
            </select>
            <button className="btn-outline" onClick={() => fetchLogs(pagination.page)}>
              <RefreshCw size={14} />
            </button>
            <button onClick={handleClear} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, background: "rgba(251,113,133,0.12)", border: "1px solid rgba(251,113,133,0.35)", color: "#fb7185", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              <Trash2 size={14} /> Clear
            </button>
          </div>
        </div>
      </motion.div>

      <div className="glass" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                {["#", "Changed Files", "Tests", "Outcome", "Reward", "Time Saved", "Agent", "ε", "Timestamp"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: "var(--text-3)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {loading ? (
                  <tr><td colSpan={9} style={{ padding: "40px", textAlign: "center", color: "var(--text-4)" }}>Loading…</td></tr>
                ) : episodes.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding: "60px", textAlign: "center", color: "var(--text-4)" }}>No episodes yet. Run simulations on the Dashboard.</td></tr>
                ) : episodes.map((ep, i) => (
                  <motion.tr key={ep._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ padding: "12px 16px", color: "var(--text-4)", fontWeight: 600 }}>
                      {(pagination.page - 1) * pagination.limit + i + 1}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {ep.changedFiles.map(f => (
                          <span key={f} className="badge badge-cyan" style={{ fontFamily: "monospace", fontSize: 10 }}>{f}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span className="badge badge-gray">{ep.selectedCount} / 17</span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {ep.bugExists ? (
                        ep.bugDetected
                          ? <span className="badge badge-success">Bug Caught 🐛</span>
                          : <span className="badge badge-amber">Bug Missed ⚠️</span>
                      ) : (
                        <span className="badge badge-gray">Clean</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontWeight: 700, color: ep.reward > 0 ? "#22c55e" : "#fb7185" }}>
                        {ep.reward > 0 ? "+" : ""}{ep.reward.toFixed(2)}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#38bdf8" }}>+{ep.timeSaved}s</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span className={`badge ${ep.agentType === "dqn" ? "badge-cyan" : "badge-amber"}`}>
                        {ep.agentType === "dqn" ? "DQN" : "QL"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--text-3)", fontFamily: "monospace" }}>{ep.epsilon?.toFixed(3)}</td>
                    <td style={{ padding: "12px 16px", color: "var(--text-4)", fontSize: 11, whiteSpace: "nowrap" }}>
                      {new Date(ep.createdAt).toLocaleString()}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ fontSize: 13, color: "var(--text-3)" }}>
            Showing {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-outline" style={{ padding: "6px 12px" }}
              onClick={() => fetchLogs(pagination.page - 1)} disabled={pagination.page <= 1}>
              <ChevronLeft size={16} />
            </button>
            <span style={{ padding: "6px 16px", fontSize: 13, color: "var(--text-1)" }}>
              {pagination.page} / {pagination.pages}
            </span>
            <button className="btn-outline" style={{ padding: "6px 12px" }}
              onClick={() => fetchLogs(pagination.page + 1)} disabled={pagination.page >= pagination.pages}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
