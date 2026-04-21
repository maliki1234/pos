"use client";

import React, { useState } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { Lock, X } from "lucide-react";
import { toast } from "react-toastify";

interface Props {
  onClose: () => void;
}

export function SetPinModal({ onClose }: Props) {
  const { setPin } = useAuthStore();
  const [pin, setPinValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!/^\d{4}$/.test(pin)) { setError("PIN must be exactly 4 digits."); return; }
    if (pin !== confirm) { setError("PINs do not match."); return; }
    setSaving(true);
    await setPin(pin);
    toast.success("Offline PIN set — you can now work offline beyond 7 days");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-xl shadow-2xl p-6 w-full max-w-sm space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" /> Set Offline PIN
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          Set a 4-digit PIN so you can keep using the POS even when your session expires offline.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">New PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={e => { setPinValue(e.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }}
              placeholder="• • • •"
              className="w-full h-10 border rounded-lg px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primaryst text-center text-lg"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Confirm PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirm}
              onChange={e => { setConfirm(e.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }}
              placeholder="• • • •"
              className="w-full h-10 border rounded-lg px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primaryst text-center text-lg"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border text-sm hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || pin.length < 4 || confirm.length < 4}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Set PIN"}
          </button>
        </div>
      </div>
    </div>
  );
}
