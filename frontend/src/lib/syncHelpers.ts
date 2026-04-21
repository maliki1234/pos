type QueueType = "CATEGORY" | "CUSTOMER" | "PRODUCT" | "STOCK" | "TRANSACTION";

const SYNC_PRIORITY: Record<QueueType, number> = {
  CATEGORY: 10,
  CUSTOMER: 20,
  PRODUCT: 30,
  STOCK: 40,
  TRANSACTION: 50,
};

export function sortSyncQueueItems<T extends { type: QueueType; createdAt: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const priorityDelta = SYNC_PRIORITY[a.type] - SYNC_PRIORITY[b.type];
    if (priorityDelta !== 0) return priorityDelta;
    return a.createdAt - b.createdAt;
  });
}

export function calculateAvailableQuantity({
  baseQuantity,
  pendingStockQuantity = 0,
  pendingTransactionQuantity = 0,
}: {
  baseQuantity: number;
  pendingStockQuantity?: number;
  pendingTransactionQuantity?: number;
}) {
  return Math.max(0, Number(baseQuantity || 0) + Number(pendingStockQuantity || 0) - Number(pendingTransactionQuantity || 0));
}

export function isOfflineFallbackError(error: any) {
  if (typeof window !== "undefined" && !navigator.onLine) return true;
  if (!error) return false;
  const message = String(error.message || error);
  return (
    error.name === "AbortError" ||
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.includes("Load failed")
  );
}
