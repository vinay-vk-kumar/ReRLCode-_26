import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "SmartCI — RL-Powered Test Selection",
  description:
    "Reinforcement Learning agent that selects only relevant tests for each commit, reducing CI/CD time while maintaining bug detection accuracy.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main style={{ paddingTop: "64px", minHeight: "100vh" }}>
          {children}
        </main>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--bg-card2)",
              color: "var(--text-1)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              fontSize: "14px",
            },
          }}
        />
      </body>
    </html>
  );
}
