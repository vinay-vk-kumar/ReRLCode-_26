"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  Activity, Bug, CheckCircle, Clock, Play, RefreshCw, Zap, FileCode, FlaskConical
} from "lucide-react";
import TestCard from "@/components/TestCard";
import { simulate, ALL_TESTS } from "@/lib/api";

interface SimResult {
  changedFiles: string[];
  selectedTests: string[];
  relevantTests: string[];
  bugExists: boolean;
  bugDetected: boolean;
  failedTests: string[];
  missedTests: string[];
  reward: number;
  timeSaved: number;
  epsilon: number;
  agentType: string;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [agentType, setAgentType] = useState<"dqn" | "q_learning">("dqn");
  const [bugProb, setBugProb] = useState(0.35);
  const [visibleTests, setVisibleTests] = useState<string[]>([]);

  async function runSim() {
    setLoading(true);
    setVisibleTests([]);
    setResult(null);
    try {
      const data = await simulate({ agentType, bugProbability: bugProb });
      setResult(data);
      // Reveal test cards one-by-one for dramatic effect
      const allVisual = [...data.selectedTests, ...data.missedTests];
      for (let i = 0; i < allVisual.length; i++) {
        await new Promise(r => setTimeout(r, 280));
        setVisibleTests(prev => [...prev, allVisual[i]]);
      }
      if (data.bugDetected) {
        toast.success("🐛 Bug detected and caught!");
      } else if (data.bugExists) {
        toast.error("⚠️ Bug existed but was missed!");
      } else {
        toast.success("✅ Clean commit — all good!");
      }
    } catch {
      toast.error("Failed to connect to backend. Is it running?");
    } finally {
      setLoading(false);
    }
  }

  function getTestStatus(test: string): "selected-pass" | "selected-fail" | "skipped" | "relevant-missed" {
    if (!result) return "skipped";
    if (result.failedTests.includes(test)) return "selected-fail";
    if (result.selectedTests.includes(test)) return "selected-pass";
    if (result.missedTests.includes(test)) return "relevant-missed";
    return "skipped";
  }

  return (
    <div className="page-container">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
          Live <span className="gradient-text">Simulation</span>
        </h1>
        <p style={{ color: "var(--text-2)", fontSize: 15 }}>
          Watch the RL agent select tests in real time and see what it catches.
        </p>
      </motion.div>

      {/* Controls */}
      <div className="glass" style={{ padding: "24px", marginBottom: 28, display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 6, display: "block", fontWeight: 600 }}>AGENT TYPE</label>
          <select
            value={agentType}
            onChange={e => setAgentType(e.target.value as "dqn" | "q_learning")}
            style={{
              background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.1)",
              color: "var(--text-1)", borderRadius: 8, padding: "9px 12px",
              fontSize: 14, width: "100%", cursor: "pointer",
            }}
          >
            <option value="dqn">DQN (Neural Network)</option>
            <option value="q_learning">Q-Learning (Tabular)</option>
          </select>
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 6, display: "block", fontWeight: 600 }}>
            BUG PROBABILITY — <span style={{ color: "var(--amber)" }}>{Math.round(bugProb * 100)}%</span>
          </label>
          <input type="range" min={0} max={1} step={0.05} value={bugProb}
            onChange={e => setBugProb(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--violet)" }} />
        </div>

        <button className="btn-primary" onClick={runSim} disabled={loading}
          style={{ minWidth: 160, justifyContent: "center" }}>
          {loading ? <><RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> Running…</> : <><Play size={16} /> Run Simulation</>}
        </button>
      </div>

      {/* Results grid */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Summary row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 28 }}>
              {[
                { icon: <FileCode size={18} />, label: "Changed Files", value: result.changedFiles.length, color: "#38bdf8" },
                { icon: <FlaskConical size={18} />, label: "Tests Selected", value: `${result.selectedTests.length} / 17`, color: "#a78bfa" },
                { icon: result.bugDetected ? <Bug size={18} /> : <CheckCircle size={18} />, label: "Outcome", value: result.bugDetected ? "Bug Caught 🐛" : result.bugExists ? "Bug Missed ⚠️" : "Clean ✅", color: result.bugDetected ? "#22c55e" : result.bugExists ? "#f97316" : "#22c55e" },
                { icon: <Zap size={18} />, label: "Reward", value: result.reward.toFixed(2), color: result.reward > 0 ? "#22c55e" : "#fb7185" },
                { icon: <Clock size={18} />, label: "Time Saved", value: `${result.timeSaved}s`, color: "#38bdf8" },
                { icon: <Activity size={18} />, label: "Epsilon (ε)", value: result.epsilon.toFixed(3), color: "var(--text-2)" },
              ].map(({ icon, label, value, color }, i) => (
                <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }} className="glass" style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, color }}>
                    {icon}
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>{value}</div>
                </motion.div>
              ))}
            </div>

            <div className="glass" style={{ padding: "14px 16px", marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 8, fontWeight: 600 }}>FILES IN THIS COMMIT</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {result.changedFiles.map((f) => (
                  <span key={f} className="badge badge-cyan" style={{ fontFamily: "monospace", fontSize: 11 }}>{f}</span>
                ))}
              </div>
            </div>

            {/* Test cards */}
            <div className="glass" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "var(--text-1)" }}>
                Test Results <span style={{ color: "var(--text-3)", fontSize: 13, fontWeight: 400 }}>({result.selectedTests.length} selected, {result.missedTests.length} missed)</span>
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 10 }}>
                {[...result.selectedTests, ...result.missedTests].map((test) =>
                  visibleTests.includes(test) && (
                    <TestCard key={test} name={test} status={getTestStatus(test)} delay={0} />
                  )
                )}
                {ALL_TESTS.filter(t => !result.selectedTests.includes(t) && !result.missedTests.includes(t)).map(t => (
                  <TestCard key={t} name={t} status="skipped" delay={0} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!result && !loading && (
        <motion.div className="glass" style={{ padding: "60px 24px", textAlign: "center", color: "var(--text-4)" }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Play size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
          <p style={{ fontSize: 16 }}>Click <strong>Run Simulation</strong> to watch the RL agent pick tests for a commit</p>
        </motion.div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
