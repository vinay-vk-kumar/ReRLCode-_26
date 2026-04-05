"use client";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { TrendingUp, Brain, Zap, RefreshCw } from "lucide-react";
import { getMetricsSeries, startTraining, getTrainingStatus, getAgentStatus } from "@/lib/api";

interface SeriesPoint {
  episode: number;
  reward: number;
  testsSelected: number;
  accuracy: number;
  epsilon: number;
}

interface AgentStats {
  dqn?: {
    episodes_trained?: number;
    epsilon?: number;
  };
  q_learning?: {
    episodes_trained?: number;
  };
}

const CHART_STYLE = {
  background: "transparent",
  fontSize: 12,
};

const tooltipStyle = {
  contentStyle: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, color: "var(--text-1)" },
  labelStyle: { color: "var(--text-2)" },
};

export default function LearningPage() {
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [agentStats, setAgentStats] = useState<AgentStats | null>(null);
  const [training, setTraining] = useState(false);
  const [episodes, setEpisodes] = useState(200);
  const [agentType, setAgentType] = useState("dqn");

  const fetchData = useCallback(async () => {
    try {
      // Fetch last 2000 to always capture newest training data
      const [s, a] = await Promise.all([getMetricsSeries(2000), getAgentStatus()]);
      setSeries(s.series || []);
      setAgentStats(a);
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      await fetchData();
    })();
  }, [fetchData]);

  async function runTraining() {
    setTraining(true);
    try {
      await startTraining(episodes, agentType);
      toast.success(`Training started: ${episodes} episodes (${agentType.toUpperCase()})`);

      // Poll: check status + refresh charts every 5 seconds
      const poll = setInterval(async () => {
        try {
          const s = await getTrainingStatus();
          // Always refresh data so charts update live
          await fetchData();
          if (!s.running) {
            clearInterval(poll);
            setTraining(false);
            toast.success(`Training complete! ${s.current} episodes done.`);
          }
        } catch {
          clearInterval(poll);
          setTraining(false);
        }
      }, 5000);
    } catch {
      toast.error("Failed to start training.");
      setTraining(false);
    }
  }

  // Downsample to max 200 points spread evenly across ALL history
  // so the full learning curve shape is visible and updates when new data arrives
  const chartData = (() => {
    if (series.length <= 200) return series;
    const step = Math.ceil(series.length / 200);
    return series.filter((_, i) => i % step === 0 || i === series.length - 1);
  })();

  return (
    <div className="page-container">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
          Learning <span className="gradient-text">Curves</span>
        </h1>
        <p style={{ color: "var(--text-2)", fontSize: 15 }}>
          Watch the agent improve over episodes — accuracy, reward, and efficiency.
        </p>
      </motion.div>

      {/* Agent stats */}
      {agentStats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 28 }}>
          {[
            { label: "DQN Episodes", value: agentStats.dqn?.episodes_trained ?? 0, icon: <Brain size={18} />, color: "#a78bfa" },
            { label: "DQN Epsilon", value: agentStats.dqn?.epsilon ?? "–", icon: <Zap size={18} />, color: "#38bdf8" },
            { label: "Q-Table Episodes", value: agentStats.q_learning?.episodes_trained ?? 0, icon: <Brain size={18} />, color: "#f97316" },
            { label: "Total Episodes (DB)", value: series.length, icon: <TrendingUp size={18} />, color: "#22c55e" },
          ].map(({ label, value, icon, color }, i) => (
            <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }} className="glass" style={{ padding: "16px 20px" }}>
              <div style={{ color, marginBottom: 8 }}>{icon}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-1)" }}>{value}</div>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>{label}</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Training controls */}
      <div className="glass" style={{ padding: "20px 24px", marginBottom: 28, display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 6, display: "block", fontWeight: 600 }}>AGENT</label>
          <select value={agentType} onChange={e => setAgentType(e.target.value)}
            style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-1)", borderRadius: 8, padding: "9px 12px", fontSize: 14, width: "100%" }}>
            <option value="dqn">DQN</option>
            <option value="q_learning">Q-Learning</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 6, display: "block", fontWeight: 600 }}>
            EPISODES — <span style={{ color: "var(--violet)" }}>{episodes}</span>
          </label>
          <input type="range" min={50} max={1000} step={50} value={episodes}
            onChange={e => setEpisodes(Number(e.target.value))} style={{ width: "100%" }} />
        </div>
        <button className="btn-primary" onClick={runTraining} disabled={training}
          style={{ minWidth: 160, justifyContent: "center" }}>
          {training ? <><RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> Training…</> : <><Brain size={16} /> Train Agent</>}
        </button>
        <button className="btn-outline" onClick={fetchData}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Live training progress bar */}
      {training && (
        <div className="glass" style={{ padding: "16px 24px", marginBottom: 20, display: "flex", alignItems: "center", gap: 16 }}>
          <RefreshCw size={16} color="#a78bfa" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 600 }}>Training in progress — episodes saving to DB…</span>
              <span style={{ fontSize: 12, color: "#a78bfa", fontWeight: 700 }}>{series.length} episodes recorded</span>
            </div>
            <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: "100%", background: "linear-gradient(90deg,#a78bfa,#38bdf8)", borderRadius: 4, animation: "shimmer 1.5s ease-in-out infinite" }} />
            </div>
          </div>
        </div>
      )}

      {chartData.length === 0 ? (
        <div className="glass" style={{ padding: "60px 24px", textAlign: "center", color: "var(--text-4)" }}>
          <TrendingUp size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
          <p>No training data yet. Run simulations on the Dashboard or train the agent above.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Reward Chart */}
          <div className="glass" style={{ padding: "24px" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: "var(--text-1)" }}>📈 Reward per Episode</h3>
            <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 16 }}>{series.length} total episodes · showing {chartData.length} sampled points</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} style={CHART_STYLE}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="episode" stroke="var(--text-4)" tick={{ fill: "var(--text-3)", fontSize: 11 }} />
                <YAxis stroke="var(--text-4)" tick={{ fill: "var(--text-3)", fontSize: 11 }} />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="reward" stroke="#a78bfa" strokeWidth={2} dot={false} name="Reward" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Accuracy Chart */}
          <div className="glass" style={{ padding: "24px" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: "var(--text-1)" }}>🎯 Rolling Accuracy</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} style={CHART_STYLE}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="episode" stroke="var(--text-4)" tick={{ fill: "var(--text-3)", fontSize: 11 }} />
                <YAxis stroke="var(--text-4)" domain={[0, 1]} tick={{ fill: "var(--text-3)", fontSize: 11 }} tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
                <Tooltip {...tooltipStyle} formatter={(v) => `${(Number(v) * 100).toFixed(1)}%`} />
                <Line type="monotone" dataKey="accuracy" stroke="#38bdf8" strokeWidth={2} dot={false} name="Accuracy" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Tests Selected */}
          <div className="glass" style={{ padding: "24px" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: "var(--text-1)" }}>⚡ Tests Selected (Efficiency)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} style={CHART_STYLE}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="episode" stroke="var(--text-4)" tick={{ fill: "var(--text-3)", fontSize: 11 }} />
                <YAxis stroke="var(--text-4)" domain={[0, 17]} tick={{ fill: "var(--text-3)", fontSize: 11 }} />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="testsSelected" stroke="#22c55e" strokeWidth={2} dot={false} name="Tests Selected" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer {
          0%   { opacity: 0.5; transform: translateX(-100%); }
          50%  { opacity: 1; }
          100% { opacity: 0.5; transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
