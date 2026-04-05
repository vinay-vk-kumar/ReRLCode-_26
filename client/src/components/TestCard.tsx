"use client";
import { motion } from "framer-motion";

interface TestCardProps {
  name: string;
  status: "selected-pass" | "selected-fail" | "skipped" | "relevant-missed";
  delay?: number;
}

const STATUS_CONFIG = {
  "selected-pass":    { bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.38)", label: "✓ Selected",   dot: "#22c55e" },
  "selected-fail":    { bg: "rgba(251,113,133,0.12)", border: "rgba(251,113,133,0.40)", label: "✗ Failed",     dot: "#fb7185" },
  "skipped":          { bg: "rgba(167,176,192,0.08)", border: "rgba(167,176,192,0.18)", label: "– Skipped", dot: "#5b677f" },
  "relevant-missed":  { bg: "rgba(249,115,22,0.12)",  border: "rgba(249,115,22,0.30)", label: "⚠ Missed",  dot: "#f97316" },
};

export default function TestCard({ name, status, delay = 0 }: TestCardProps) {
  const cfg = STATUS_CONFIG[status];
  const shortName = name.replace("test_", "").replace(/_/g, " ");
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.25, ease: "easeOut" }}
      style={{
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        borderRadius: 10, padding: "10px 14px",
        display: "flex", alignItems: "center", gap: 10,
      }}
    >
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", textTransform: "capitalize" }}>{shortName}</div>
        <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{name}</div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: cfg.dot, whiteSpace: "nowrap" }}>{cfg.label}</span>
    </motion.div>
  );
}
