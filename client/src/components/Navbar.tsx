"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Brain, Menu, X } from "lucide-react";

const NAV = [
  { href: "/",             label: "Home" },
  { href: "/dashboard",    label: "Dashboard" },
  { href: "/learning",     label: "Learning" },
  { href: "/simulator",    label: "Simulator" },
  { href: "/test-mapping", label: "Test Map" },
  { href: "/logs",         label: "Logs" },
];

export default function Navbar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50 }}>
      <div style={{
        height: 64,
        background: "rgba(7,10,18,0.85)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg,#a78bfa,#38bdf8)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Brain size={20} color="#fff" />
          </div>
          <span style={{ fontWeight: 800, fontSize: 18, color: "var(--text-1)", letterSpacing: "-0.5px" }}>
            Smart<span style={{ color: "#38bdf8" }}>CI</span>
          </span>
        </Link>

        <div className="desktop-nav" style={{ display: "flex", gap: 4, marginLeft: 40, flex: 1 }}>
          {NAV.map(({ href, label }) => {
            const active = isActive(href);
            return (
              <Link key={href} href={href} style={{
                padding: "6px 14px", borderRadius: 8, textDecoration: "none",
                fontSize: 14, fontWeight: active ? 600 : 400,
                color: active ? "#38bdf8" : "#a7b0c0",
                background: active ? "rgba(56,189,248,0.10)" : "transparent",
                transition: "all 0.15s",
              }}>
                {label}
              </Link>
            );
          })}
        </div>

        <div className="desktop-live" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="pulse-dot" />
          <span style={{ fontSize: 12, color: "#a7b0c0" }}>Live</span>
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((prev) => !prev)}
          className="mobile-menu-btn"
          style={{
            marginLeft: "auto",
            display: "none",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
            color: "var(--text-1)",
            cursor: "pointer",
          }}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open && (
        <div className="mobile-nav-sheet" style={{
          background: "rgba(7,10,18,0.98)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "12px 16px 16px",
        }}>
          {NAV.map(({ href, label }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                style={{
                  display: "block",
                  padding: "10px 12px",
                  borderRadius: 8,
                  textDecoration: "none",
                  fontSize: 14,
                  marginBottom: 6,
                  color: active ? "#38bdf8" : "#cbd5e1",
                  background: active ? "rgba(56,189,248,0.10)" : "transparent",
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
