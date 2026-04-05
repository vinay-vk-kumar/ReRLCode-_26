"use client";
import { motion } from "framer-motion";
import { FILES_MAP, ALL_TESTS } from "@/lib/api";
import { FileCode, FlaskConical, CheckCircle } from "lucide-react";

export default function TestMappingPage() {
  const files = Object.keys(FILES_MAP);

  return (
    <div className="page-container">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
          Test <span className="gradient-text">Mapping</span>
        </h1>
        <p style={{ color: "var(--text-2)", fontSize: 15 }}>
          File → test coverage relationships. The RL agent uses this to build its state representation.
        </p>
      </motion.div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 32 }}>
        {[
          { label: "Source Files", value: files.length, icon: <FileCode size={20} />, color: "#38bdf8" },
          { label: "Test Cases", value: ALL_TESTS.length, icon: <FlaskConical size={20} />, color: "#a78bfa" },
          { label: "Avg Coverage", value: `${(Object.values(FILES_MAP).reduce((s, v) => s + v.length, 0) / files.length).toFixed(1)} tests/file`, icon: <CheckCircle size={20} />, color: "#22c55e" },
        ].map(({ label, value, icon, color }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }} className="glass" style={{ padding: "20px 24px", display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ color, background: `${color}18`, border: `1px solid ${color}30`, borderRadius: 10, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-1)" }}>{value}</div>
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>{label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Coverage matrix */}
      <div className="glass" style={{ padding: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Coverage Matrix</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "10px 16px", color: "var(--text-3)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  File
                </th>
                <th style={{ textAlign: "left", padding: "10px 16px", color: "var(--text-3)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  Relevant Tests
                </th>
                <th style={{ textAlign: "center", padding: "10px 16px", color: "var(--text-3)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  Coverage
                </th>
              </tr>
            </thead>
            <tbody>
              {files.map((file, i) => {
                const tests = FILES_MAP[file];
                const pct = Math.round((tests.length / ALL_TESTS.length) * 100);
                return (
                  <motion.tr key={file} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <FileCode size={15} color="#38bdf8" />
                        <span style={{ fontWeight: 600, color: "var(--text-1)", fontFamily: "monospace" }}>{file}</span>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {tests.map(t => (
                          <span key={t} className="badge badge-cyan" style={{ fontFamily: "monospace", fontSize: 11 }}>
                            {t.replace("test_", "")}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "center" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                        <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 6, width: 80, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#a78bfa,#38bdf8)", borderRadius: 4 }} />
                        </div>
                        <span style={{ fontSize: 11, color: "var(--text-3)" }}>{pct}%</span>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
