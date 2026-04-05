"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { getMetrics } from "@/lib/api";
import MetricCard from "@/components/MetricCard";
import { Brain, FlaskConical, Clock, Target, ChevronRight, Zap, Shield, TrendingUp } from "lucide-react";

interface Metrics {
  totalEpisodes: number;
  accuracy: number;
  avgTestsSelected: number;
  avgReward: number;
  avgTimeSaved: number;
  testReductionPct: number;
  agentStats?: { dqn?: Record<string, unknown>; q_learning?: Record<string, unknown> };
}

const FEATURES = [
  { icon: <Brain size={22} />, title: "Q-Learning + DQN", desc: "Dual agent architecture — tabular Q-learning for interpretability, deep neural network for generalization across unseen commit patterns.", color: "#a78bfa" },
  { icon: <Zap size={22} />, title: "Epsilon-Greedy Exploration", desc: "Starts exploring all tests randomly (ε=1.0) and gradually shifts to exploitation as it learns which tests matter for each file.", color: "#38bdf8" },
  { icon: <Shield size={22} />, title: "Smart Reward Function", desc: "+10 for catching a bug, −10 for missing one. Efficiency bonus rewards the agent for selecting fewer tests while maintaining accuracy.", color: "#22c55e" },
  { icon: <TrendingUp size={22} />, title: "Continuous Learning", desc: "Experience replay buffer lets DQN learn from thousands of past episodes. Soft target network updates ensure stable training.", color: "#f97316" },
];

export default function HomePage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMetrics().then(setMetrics).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Hero */}
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "80px 24px 60px", textAlign: "center" }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 999, background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)", marginBottom: 28 }}>
            <div className="pulse-dot" />
            <span style={{ fontSize: 13, color: "#a78bfa", fontWeight: 600 }}>Powered by Reinforcement Learning</span>
          </div>

          <h1 style={{ fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 900, lineHeight: 1.1, marginBottom: 24, letterSpacing: "-1.5px" }}>
            Stop running{" "}
            <span className="gradient-text">every test</span>
            <br />on every commit
          </h1>

          <p style={{ fontSize: 18, color: "var(--text-2)", maxWidth: 560, margin: "0 auto 40px", lineHeight: 1.7 }}>
            SmartCI uses a Reinforcement Learning agent to learn which tests actually matter —
            running only the right ones for each commit, slashing CI/CD time without sacrificing
            bug detection.
          </p>

          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/dashboard" className="btn-primary" style={{ fontSize: 15, padding: "12px 28px" }}>
              <Brain size={18} /> Live Simulation
            </Link>
            <Link href="/learning" className="btn-outline" style={{ fontSize: 15, padding: "12px 28px" }}>
              <TrendingUp size={18} /> View Learning Curves
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Metric cards */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 60px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
          <MetricCard label="Episodes Run" value={loading ? "–" : metrics?.totalEpisodes ?? 0}
            sub="total simulations" icon={<Brain size={20} />} color="#a78bfa" delay={0.1} />
          <MetricCard label="Bug Detection Accuracy"
            value={loading ? "–" : metrics ? `${Math.round(metrics.accuracy * 100)}%` : "0%"}
            sub="when a bug exists" icon={<Target size={20} />} color="#22c55e" delay={0.2} />
          <MetricCard label="Avg Tests Selected"
            value={loading ? "–" : metrics?.avgTestsSelected ?? "–"}
            sub={`out of 17 total (${loading ? "–" : metrics ? `${metrics.testReductionPct}% reduction` : "–"})`}
            icon={<FlaskConical size={20} />} color="#38bdf8" delay={0.3} />
          <MetricCard label="Avg Time Saved"
            value={loading ? "–" : metrics ? `${metrics.avgTimeSaved}s` : "0s"}
            sub="per commit vs running all" icon={<Clock size={20} />} color="#f97316" delay={0.4} />
        </div>
      </section>

      {/* How it works */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px" }}>
        <motion.h2 initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, textAlign: "center" }}>
          How <span className="gradient-text">SmartCI</span> works
        </motion.h2>
        <p style={{ color: "var(--text-3)", textAlign: "center", marginBottom: 40, fontSize: 15 }}>
          A four-layer architecture connecting your CI pipeline to a continuously learning brain.
        </p>

        {/* Architecture flow */}
        <div className="glass" style={{ padding: "28px 32px", marginBottom: 32, display: "flex", gap: 0, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
          {["Next.js Frontend", "Node.js Backend", "Python FastAPI RL Engine", "MongoDB Atlas"].map((step, i, arr) => (
            <div key={step} style={{ display: "flex", alignItems: "center" }}>
              <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }} transition={{ delay: i * 0.12 }}
                style={{ textAlign: "center", padding: "12px 20px" }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: "linear-gradient(135deg,#a78bfa,#38bdf8)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontSize: 16 }}>
                  {["🖥️", "⚙️", "🧠", "🍃"][i]}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", maxWidth: 100 }}>{step}</div>
              </motion.div>
              {i < arr.length - 1 && (
                <ChevronRight size={20} color="var(--text-4)" style={{ flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>

        {/* Feature cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
          {FEATURES.map(({ icon, title, desc, color }, i) => (
            <motion.div key={title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              className="glass gradient-border" style={{ padding: "24px" }}>
              <div style={{ color, background: `${color}15`, border: `1px solid ${color}25`, borderRadius: 10, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                {icon}
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)", marginBottom: 10 }}>{title}</h3>
              <p style={{ fontSize: 13, color: "var(--text-3)", lineHeight: 1.6 }}>{desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 700, margin: "0 auto", padding: "0 24px 80px", textAlign: "center" }}>
        <div className="glass" style={{ padding: "48px 32px" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Ready to see it in action?</h2>
          <p style={{ color: "var(--text-3)", fontSize: 15, marginBottom: 28, lineHeight: 1.7 }}>
            Open the live dashboard, run a simulation, and watch the RL agent pick the right tests in under a second.
          </p>
          <Link href="/dashboard" className="btn-primary" style={{ fontSize: 15, padding: "14px 32px" }}>
            <Play size={18} /> Open Dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}

function Play({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}
