"use client";

import { AlertCircle, CheckCircle2, DownloadCloud, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useSyncStore } from "@/stores/useSyncStore";

function formatTime(value?: number) {
  if (!value) return "Not ready";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function OfflineStatus() {
  const {
    isOnline,
    isSyncing,
    isPreloading,
    pendingCount,
    lastPreloadTime,
    lastSyncTime,
    syncPendingTransactions,
    preloadOfflineData,
  } = useSyncStore();

  const busy = isSyncing || isPreloading;
  const ready = Boolean(lastPreloadTime);

  const handleSync = async () => {
    await syncPendingTransactions();
    await preloadOfflineData();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <div className={`flex items-center gap-1.5 rounded border px-2 py-1 ${isOnline ? "border-green-200 bg-green-50 text-green-700" : "border-orange-200 bg-orange-50 text-orange-700"}`}>
        {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
        {isOnline ? "Online" : "Offline"}
      </div>

      <div className={`flex items-center gap-1.5 rounded border px-2 py-1 ${ready ? "border-blue-200 bg-blue-50 text-blue-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
        {ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : <DownloadCloud className="h-3.5 w-3.5" />}
        Offline data: {formatTime(lastPreloadTime)}
      </div>

      {pendingCount > 0 && (
        <div className="flex items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">
          <AlertCircle className="h-3.5 w-3.5" />
          {pendingCount} pending
        </div>
      )}

      {lastSyncTime && (
        <div className="text-muted-foreground">Last sync: {formatTime(lastSyncTime)}</div>
      )}

      <button
        type="button"
        onClick={handleSync}
        disabled={!isOnline || busy}
        className="inline-flex items-center gap-1.5 rounded border px-2 py-1 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
        {busy ? "Syncing" : "Sync now"}
      </button>
    </div>
  );
}
