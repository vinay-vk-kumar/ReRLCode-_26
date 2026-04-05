"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { Play, RefreshCw, Bug, Layers } from "lucide-react";
import { simulate } from "@/lib/api";

interface BatchResult {
  episode: number;
  reward: number;
  bugExists: boolean;
  bugDetected: boolean;
  selectedCount: number;
  timeSaved: number;
}

export default function SimulatorPage() {
  const [bugProb, setBugProb] = useState(0.35);
  const [batchSize, setBatchSize] = useState(10);
  const [agentType, setAgentType] = useState("dqn");
  const [running, setRunning] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [progress, setProgress] = useState(0);

  async function runBatch() {
    setRunning(true);
    setBatchResults([]);
    setProgress(0);
    const results: BatchResult[] = [];
    for (let i = 1; i <= batchSize; i++) {
      try {
        const data = await simulate({ agentType, bugProbability: bugProb });
        results.push({
          episode: i,
          reward: data.reward,
          bugExists: data.bugExists,
          bugDetected: data.bugDetected,
          selectedCount: data.selectedTests.length,
          timeSaved: data.timeSaved,
        });
        setBatchResults([...results]);
        setProgress(Math.round((i / batchSize) * 100));
        await new Promise(r => setTimeout(r, 180));
      } catch { break; }
    }
    const caught = results.filter(r => r.bugExists && r.bugDetected).length;
    const existed = results.filter(r => r.bugExists).length;
    toast.success(`Batch complete! Accuracy: ${existed > 0 ? Math.round((caught / existed) * 100) : 100}%`);
    setRunning(false);
  }

  const avgReward = batchResults.length ? (batchResults.reduce((s, r) => s + r.reward, 0) / batchResults.length).toFixed(2) : "–";
  const avgTests = batchResults.length ? (batchResults.reduce((s, r) => s + r.selectedCount, 0) / batchResults.length).toFixed(1) : "–";
  const bugsFound = batchResults.filter(r => r.bugDetected).length;

  return (
    <div className="page-container" style={{ maxWidth: 1000 }}>
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
          Batch <span className="gradient-text">Simulator</span>
        </h1>
        <p style={{ color: "var(--text-2)", fontSize: 15 }}>
          Configure parameters and run multiple episodes to benchmark the agent.
        </p>
      </motion.div>

      {/* Config panel */}
      <div className="glass" style={{ padding: "28px", marginBottom: 28 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 24 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text-2)", display: "block", marginBottom: 6, fontWeight: 600 }}>AGENT TYPE</label>
            <select value={agentType} onChange={e => setAgentType(e.target.value)}
              style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-1)", borderRadius: 8, padding: "9px 12px", fontSize: 14, width: "100%" }}>
              <option value="dqn">DQN (Neural Network)</option>
              <option value="q_learning">Q-Learning (Tabular)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, color: "var(--text-2)", display: "block", marginBottom: 6, fontWeight: 600 }}>
              <Bug size={12} style={{ display: "inline", marginRight: 4 }} />
              BUG PROBABILITY — <span style={{ color: "var(--amber)" }}>{Math.round(bugProb * 100)}%</span>
            </label>
            <input type="range" min={0} max={1} step={0.05} value={bugProb}
              onChange={e => setBugProb(Number(e.target.value))} style={{ width: "100%" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-4)", marginTop: 4 }}>
              <span>0%</span><span>50%</span><span>100%</span>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, color: "var(--text-2)", display: "block", marginBottom: 6, fontWeight: 600 }}>
              <Layers size={12} style={{ display: "inline", marginRight: 4 }} />
              BATCH SIZE — <span style={{ color: "var(--violet)" }}>{batchSize}</span>
            </label>
            <input type="range" min={5} max={50} step={5} value={batchSize}
              onChange={e => setBatchSize(Number(e.target.value))} style={{ width: "100%" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-4)", marginTop: 4 }}>
              <span>5</span><span>25</span><span>50</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
          <button className="btn-primary" onClick={runBatch} disabled={running} style={{ minWidth: 180, justifyContent: "center" }}>
            {running ? <><RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} /> Running {progress}%</> : <><Play size={15} /> Run {batchSize} Episodes</>}
          </button>
        </div>

        {/* Progress bar */}
        {running && (
          <div style={{ marginTop: 16, background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 6, overflow: "hidden" }}>
            <motion.div style={{ height: "100%", background: "linear-gradient(90deg,#a78bfa,#38bdf8)", borderRadius: 4 }}
              animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
          </div>
        )}
      </div>

      {/* Live stats */}
      {batchResults.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginBottom: 24 }}>
          {[
            { label: "Avg Reward", value: avgReward, color: "#a78bfa" },
            { label: "Avg Tests / Run", value: `${avgTests} / 17`, color: "#38bdf8" },
            { label: "Bugs Caught", value: `${bugsFound}`, color: "#22c55e" },
            { label: "Episodes Run", value: batchResults.length, color: "#f97316" },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass" style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Episode list */}
      <AnimatePresence>
        {batchResults.map((r, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0 }} className="glass"
            style={{ padding: "14px 20px", marginBottom: 8, display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 12, color: "var(--text-4)", width: 28, fontWeight: 600 }}>#{r.episode}</span>
            <div style={{ flex: 1, display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span className={`badge ${r.reward > 0 ? "badge-success" : "badge-danger"}`}>
                Reward: {r.reward.toFixed(1)}
              </span>
              <span className="badge badge-cyan">{r.selectedCount} tests</span>
              {r.bugExists && (
                <span className={`badge ${r.bugDetected ? "badge-success" : "badge-amber"}`}>
                  {r.bugDetected ? "Bug Caught 🐛" : "Bug Missed ⚠️"}
                </span>
              )}
              {!r.bugExists && <span className="badge badge-gray">Clean Commit</span>}
            </div>
            <span style={{ fontSize: 12, color: "var(--success)" }}>+{r.timeSaved}s saved</span>
          </motion.div>
        ))}
      </AnimatePresence>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
