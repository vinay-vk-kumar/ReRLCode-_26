"use client";
import { motion } from "framer-motion";
import { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: ReactNode;
  color?: string;
  delay?: number;
}

export default function MetricCard({ label, value, sub, icon, color = "#38bdf8", delay = 0 }: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      className="glass gradient-border"
      style={{ padding: "24px", cursor: "default" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 10,
          background: `${color}18`,
          border: `1px solid ${color}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color,
        }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text-1)", lineHeight: 1, marginBottom: 6 }}>
        {value}
      </div>
      <div style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: color, marginTop: 4 }}>{sub}</div>}
    </motion.div>
  );
}
