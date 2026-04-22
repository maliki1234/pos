"use client"
import { useEffect, useState } from 'react';
import { useProductsStore } from '@/stores/useProductsStore';
import { useStockStore } from '@/stores/useStockStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AddStockDialog } from '@/components/AddStockDialog';
import { Plus, TrendingDown, Package, AlertTriangle, Clock, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';

// ── Expiry helpers ───────────────────────────────────────────────────────────
function daysUntilExpiry(timestamp?: number): number | null {
  if (!timestamp) return null;
  return Math.floor((timestamp - Date.now()) / 86400000);
}

function expiryBadgeClass(days: number | null): string {
  if (days === null) return "";
  if (days < 0)  return "bg-red-100 text-red-800 border-red-300";
  if (days <= 7)  return "bg-red-100 text-red-700 border-red-300";
  if (days <= 30) return "bg-yellow-100 text-yellow-800 border-yellow-300";
  return "bg-green-100 text-green-700 border-green-300";
}

function expiryLabel(days: number | null, dateStr: string): string {
  if (days === null) return "—";
  if (days < 0)   return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return "Expires today!";
  if (days === 1) return "Expires tomorrow";
  return `${dateStr} (${days}d)`;
}

interface StockView {
  productId: number;
  productName: string;
  totalQuantity: number;
  totalUsed: number;
  batches: any[];
}

/**
 * StockPage Component
 * Main page for managing product inventory and stock batches.
 * Displays products with their stock levels organized by batch in FIFO order.
 * Allows users to add new stock batches, search products, and track stock usage.
 */
export default function StockPage() {
  const { products, loadProducts } = useProductsStore();
  const { stock, lowStockProducts, loadStockByProduct, addStock, fetchLowStockProducts, setReorderPoint, deleteStock } = useStockStore();
  const { user } = useAuthStore();
  const canManage = user?.role === "ADMIN" || user?.role === "MANAGER";
  const [reorderEdits, setReorderEdits] = useState<Record<number, string>>({});
  const [savingReorder, setSavingReorder] = useState<Record<number, boolean>>({});
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
  const [stockView, setStockView] = useState<StockView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Compute expiry alerts across all batches (expired or expiring within 30 days)
  const expiryAlerts = stock
    .filter((s) => s.expiryDate != null && (s.quantity - s.quantityUsed) > 0)
    .map((s) => ({
      ...s,
      days: daysUntilExpiry(s.expiryDate),
      productName: (products as any[]).find((p) => p.id === s.productId)?.name ?? `Product #${s.productId}`,
    }))
    .filter((s) => s.days !== null && s.days <= 30)
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0));

  useEffect(() => {
    /**
     * Initializes the stock page by loading all products and their stock data.
     * Fetches products from the store and then loads stock batches for each product.
     * Sets loading state during the operation to show loading indicators.
     */
    const initializeData = async () => {
      setIsLoading(true);
      try {
        await loadProducts();
        // Load stock for all products
        if (products.length > 0) {
          for (const product of products) {
            await loadStockByProduct(product.id);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();
    fetchLowStockProducts();
  }, [loadProducts, loadStockByProduct, products.length]);

  /**
   * Effect to update stock view whenever stock data or products change.
   * Transforms raw stock data into a display-friendly format with calculated totals.
   * Applies search filtering and sorts batches in FIFO order (oldest received first).
   * Returns empty view if no products are available.
   */
  useEffect(() => {
    // Update stock view whenever stock or products change
    if (products.length === 0) {
      setStockView([]);
      return;
    }

    const view = products
      .map((product: any) => {
        const productStock = stock.filter((s: any) => s.productId === product.id);
        const totalQuantity = productStock.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0);
        const totalUsed = productStock.reduce((sum: number, s: any) => sum + (s.quantityUsed || 0), 0);

        // Sort batches by FIFO order (oldest first by receivedDate)
        const sortedBatches = [...productStock].sort(
          (a, b) => (a.receivedDate || 0) - (b.receivedDate || 0)
        );

        return {
          productId: product.id,
          productName: product.name,
          totalQuantity,
          totalUsed,
          batches: sortedBatches,
        };
      })
      .filter((item) =>
        item.productName.toLowerCase().includes(searchQuery.toLowerCase())
      );

    setStockView(view);
  }, [products, stock, searchQuery]);

  /**
   * Handles adding new stock to a product.
   * Submits the new stock data to the store and refreshes the stock display for that product.
   * Sets submitting state to prevent duplicate submissions and provides feedback to user.
   *
   * @param {Object} data - Stock data to add
   * @param {string} data.productId - ID of the product to add stock for
   * @param {number} data.quantity - Quantity of items in the batch
   * @param {number} data.unitCost - Cost per unit
   * @param {Date} [data.expiryDate] - Optional expiry date for the batch
   * @param {string} [data.notes] - Optional notes about the batch (supplier, location, etc.)
   */
  const handleAddStock = async (data: {
    productId: number;
    quantity: number;
    unitCost: number;
    expiryDate?: Date;
    notes?: string;
  }) => {
    setIsSubmitting(true);
    try {
      await addStock(data);
      await loadStockByProduct(data.productId);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Opens the add stock dialog for a specific product.
   * Sets the selected product ID and opens the modal dialog.
   *
   * @param {number} productId - The ID of the product to add stock for
   */
  const handleSaveReorderPoint = async (productId: number) => {
    const val = parseInt(reorderEdits[productId]);
    if (isNaN(val) || val < 0) return;
    setSavingReorder((s) => ({ ...s, [productId]: true }));
    try {
      await setReorderPoint(productId, val);
    } finally {
      setSavingReorder((s) => ({ ...s, [productId]: false }));
      setReorderEdits((e) => { const n = { ...e }; delete n[productId]; return n; });
    }
  };

  const openAddStockDialog = (productId: number) => {
    setSelectedProductId(productId);
    setIsDialogOpen(true);
  };

  const handleDeleteBatch = async (batch: any) => {
    const label = batch.batchNumber ? `Batch #${batch.batchNumber}` : "this batch";
    if (!confirm(`Delete ${label}? Sales history will remain, but this stock will no longer be available.`)) return;

    setDeletingBatchId(batch.id);
    try {
      await deleteStock(batch.id);
      toast.success("Stock batch deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete stock batch");
    } finally {
      setDeletingBatchId(null);
    }
  };

  /**
   * Formats a timestamp into a short date string.
   * Returns 'N/A' if no timestamp is provided.
   *
   * @param {number} [timestamp] - Unix timestamp (in milliseconds) to format
   * @returns {string} Formatted date string or 'N/A'
   */
  const formatDateShort = (timestamp?: number) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Loading stock data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stock Management</h1>
          <p className="text-muted-foreground mt-1">Track inventory batches in FIFO order</p>
        </div>
        <Button
          onClick={() => {
            setSelectedProductId(undefined);
            setIsDialogOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Stock
        </Button>
      </div>

      {/* Low Stock Alerts */}
      {lowStockProducts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <AlertTriangle className="h-5 w-5" />
              Low Stock Alerts ({lowStockProducts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-orange-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-orange-100/60 dark:bg-orange-900/20">
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-right">Reorder Point</TableHead>
                    <TableHead className="text-right">Update Reorder Point</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockProducts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive">{p.totalQuantity}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{p.reorderPoint}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Input
                            type="number"
                            min={0}
                            className="w-20 h-8 text-sm"
                            placeholder={String(p.reorderPoint)}
                            value={reorderEdits[p.id] ?? ""}
                            onChange={(e) => setReorderEdits((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            disabled={savingReorder[p.id] || reorderEdits[p.id] === undefined}
                            onClick={() => handleSaveReorderPoint(p.id)}
                          >
                            {savingReorder[p.id] ? "Saving…" : "Save"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expiry Alerts */}
      {expiryAlerts.length > 0 && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <Clock className="h-5 w-5" />
              Expiry Alerts — {expiryAlerts.filter(e => (e.days ?? 0) < 0).length} expired · {expiryAlerts.filter(e => (e.days ?? 0) >= 0 && (e.days ?? 0) <= 7).length} expiring ≤7d · {expiryAlerts.filter(e => (e.days ?? 0) > 7).length} expiring ≤30d
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-red-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-red-100/60 dark:bg-red-900/20">
                    <TableHead>Product</TableHead>
                    <TableHead>Batch #</TableHead>
                    <TableHead className="text-right">Available Qty</TableHead>
                    <TableHead>Expiry Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiryAlerts.map((s) => (
                    <TableRow key={s.id} className={(s.days ?? 0) < 0 ? "bg-red-50/50" : ""}>
                      <TableCell className="font-medium">{s.productName}</TableCell>
                      <TableCell className="font-mono text-xs">{s.batchNumber}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={(s.days ?? 0) < 0 ? "destructive" : "outline"}>
                          {s.quantity - s.quantityUsed}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-block text-xs px-2 py-0.5 rounded border font-medium ${expiryBadgeClass(s.days)}`}>
                          {expiryLabel(s.days, new Date(s.expiryDate!).toLocaleDateString())}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Expired or near-expiry stock should be discounted, returned to supplier, or written off to avoid losses.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="flex gap-4">
        <Input
          placeholder="Search by product name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Stock View */}
      {stockView.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No stock found matching your search' : 'No stock records yet. Add stock to get started.'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {stockView.map((item) => (
            <Card key={item.productId}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{item.productName}</CardTitle>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="h-fit">
                      <Package className="h-3 w-3 mr-1" />
                      Total: {item.totalQuantity}
                    </Badge>
                    <Badge variant="secondary" className="h-fit">
                      <TrendingDown className="h-3 w-3 mr-1" />
                      Used: {item.totalUsed}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {item.batches.length === 0 ? (
                  <div className="text-center py-4 border rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground">No stock batches</p>
                  </div>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted">
                          <TableHead>Batch #</TableHead>
                          <TableHead className="text-right">Received</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Used</TableHead>
                          <TableHead className="text-right">Available</TableHead>
                          <TableHead className="text-right">Unit Cost</TableHead>
                          <TableHead>Expiry</TableHead>
                          <TableHead>Notes</TableHead>
                          {canManage && <TableHead className="text-right">Action</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {item.batches.map((batch) => {
                          const available = (batch.quantity || 0) - (batch.quantityUsed || 0);
                          const days = daysUntilExpiry(batch.expiryDate);
                          const isExpired = days !== null && days < 0;
                          const isUrgent  = days !== null && days >= 0 && days <= 7;

                          return (
                            <TableRow
                              key={batch.id}
                              className={isExpired ? 'bg-red-50/60 dark:bg-red-950/20' : isUrgent ? 'bg-orange-50/60 dark:bg-orange-950/20' : ''}
                            >
                              <TableCell className="font-mono text-xs font-semibold">
                                {batch.batchNumber || "—"}
                              </TableCell>
                              <TableCell className="text-right text-xs">
                                {formatDateShort(batch.receivedDate)}
                              </TableCell>
                              <TableCell className="text-right">{batch.quantity}</TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {batch.quantityUsed}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                <Badge variant={available === 0 ? 'secondary' : 'default'}>
                                  {available}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {Number(batch.unitCost || 0).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-sm">
                                {batch.expiryDate ? (
                                  <span className={`inline-block text-xs px-2 py-0.5 rounded border font-medium ${expiryBadgeClass(days)}`}>
                                    {expiryLabel(days, formatDateShort(batch.expiryDate))}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-xs">No expiry</span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                                {batch.notes || '—'}
                              </TableCell>
                              {canManage && (
                                <TableCell className="text-right">
                                  <button
                                    onClick={() => handleDeleteBatch(batch)}
                                    disabled={deletingBatchId === batch.id}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                    title="Delete stock batch"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openAddStockDialog(item.productId)}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Batch
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Stock Dialog */}
      <AddStockDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        productId={selectedProductId}
        productName={
          selectedProductId ? stockView.find((v) => v.productId === selectedProductId)?.productName : undefined
        }
        products={products.map((p: any) => ({ id: p.id, name: p.name }))}
        onSubmit={handleAddStock}
        isLoading={isSubmitting}
      />
    </div>
  );
}
