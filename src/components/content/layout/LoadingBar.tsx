"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function LoadingBar() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 10000,
        opacity: loading ? 1 : 0,
        transition: "opacity 0.3s ease",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          height: "100%",
          background: "linear-gradient(90deg, transparent, #1976d2, transparent)",
          animation: loading ? "loading-bar 0.6s ease-in-out infinite" : "none",
        }}
      />
      <style>{`
        @keyframes loading-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}