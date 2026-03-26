"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { WifiOff, Delete } from "lucide-react";

export function OfflinePinModal() {
  const { user, verifyPin } = useAuthStore();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleDigit = useCallback((d: string) => {
    if (pin.length < 4) setPin(p => p + d);
  }, [pin]);

  const handleBackspace = () => setPin(p => p.slice(0, -1));

  const handleSubmit = useCallback(async () => {
    if (pin.length !== 4 || checking) return;
    setChecking(true);
    setError("");
    const ok = await verifyPin(pin);
    if (!ok) {
      setShake(true);
      setError("Incorrect PIN");
      setPin("");
      setTimeout(() => setShake(false), 500);
    }
    setChecking(false);
  }, [pin, checking, verifyPin]);

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (pin.length === 4) handleSubmit();
  }, [pin, handleSubmit]);

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") handleDigit(e.key);
      else if (e.key === "Backspace") handleBackspace();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleDigit]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 px-8 py-10 max-w-sm w-full">
        {/* Icon + heading */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="h-14 w-14 rounded-full bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center">
            <WifiOff className="h-7 w-7 text-orange-500" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">You&apos;ve been offline</h2>
          <p className="text-sm text-muted-foreground">
            Welcome back, <span className="font-medium text-foreground">{user?.name}</span>.
            Enter your PIN to continue.
          </p>
        </div>

        {/* PIN dots */}
        <div className={`flex gap-4 ${shake ? "animate-shake" : ""}`}>
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`h-4 w-4 rounded-full border-2 transition-all duration-150
                ${i < pin.length ? "bg-primary border-primary scale-110" : "border-muted-foreground/40"}`}
            />
          ))}
        </div>

        {error && (
          <p className="text-sm text-destructive font-medium -mt-2">{error}</p>
        )}

        {/* PIN pad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[240px]">
          {["1","2","3","4","5","6","7","8","9"].map(d => (
            <button
              key={d}
              onClick={() => handleDigit(d)}
              className="h-16 rounded-2xl border bg-card text-xl font-semibold hover:bg-accent active:scale-95 transition-all shadow-sm"
            >
              {d}
            </button>
          ))}
          <div /> {/* empty cell */}
          <button
            onClick={() => handleDigit("0")}
            className="h-16 rounded-2xl border bg-card text-xl font-semibold hover:bg-accent active:scale-95 transition-all shadow-sm"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            className="h-16 rounded-2xl border bg-card flex items-center justify-center hover:bg-accent active:scale-95 transition-all shadow-sm"
          >
            <Delete className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          No internet connection. Your sales are saved and will sync when back online.
        </p>
      </div>

      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
}
