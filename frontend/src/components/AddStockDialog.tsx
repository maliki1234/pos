'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { calculateStockUnitCost, type StockCostInputMode } from '@/lib/stockCostInput';
import { calculateStockProfitPreview, type StockProfitLine } from '@/lib/stockProfit';

interface StockProductOption {
  id: number;
  name: string;
  retailPrice?: number;
  wholesalePrice?: number;
}

interface AddStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId?: number;
  productName?: string;
  onSubmit: (data: {
    productId: number;
    quantity: number;
    unitCost: number;
    expiryDate?: Date;
    notes?: string;
  }) => Promise<void>;
  isLoading?: boolean;
  products?: StockProductOption[];
}

function getEmptyFormData(productId?: number) {
  return {
    productId: productId?.toString() || '',
    quantity: '',
    costInputMode: 'unit' as StockCostInputMode,
    unitCost: '',
    totalCost: '',
    expiryDate: '',
    notes: '',
  };
}

function formatMoney(value: number): string {
  return Number(value || 0).toLocaleString();
}

function ProfitLineCard({ title, line }: { title: string; line?: StockProfitLine }) {
  if (!line) {
    return (
      <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
        {title} selling price is not set.
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-background p-2 text-xs">
      <div className="font-medium">{title}</div>
      <div className="mt-1 space-y-1 text-muted-foreground">
        <div className="flex justify-between gap-2">
          <span>Selling price</span>
          <span className="font-medium text-foreground">{formatMoney(line.sellingPrice)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Profit per unit</span>
          <span className={line.isLoss ? 'font-semibold text-red-600' : 'font-semibold text-green-700'}>
            {formatMoney(line.profitPerUnit)}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Batch profit</span>
          <span className={line.isLoss ? 'font-semibold text-red-600' : 'font-semibold text-green-700'}>
            {formatMoney(line.totalProfit)}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Margin</span>
          <span className={line.isLoss ? 'font-semibold text-red-600' : 'font-semibold text-green-700'}>
            {line.marginPercent}%
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * AddStockDialog Component
 * Modal dialog for adding new stock/inventory to products.
 * Provides form inputs for product selection, quantity, unit cost, expiry date, and notes.
 * Validates input data and submits through the onSubmit callback.
 * Supports both selecting a product from a list or using a pre-selected product.
 */
export function AddStockDialog({
  open,
  onOpenChange,
  productId: initialProductId,
  productName: initialProductName,
  onSubmit,
  isLoading = false,
  products = [],
}: AddStockDialogProps) {
  const [formData, setFormData] = useState(() => getEmptyFormData(initialProductId));
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedProduct = useMemo(() => {
    const selectedId = Number(formData.productId || initialProductId || 0);
    return products.find((product) => product.id === selectedId);
  }, [formData.productId, initialProductId, products]);
  const quantity = Number(formData.quantity || 0);
  const unitCost = calculateStockUnitCost({
    mode: formData.costInputMode,
    quantity,
    unitCost: Number(formData.unitCost || 0),
    totalCost: Number(formData.totalCost || 0),
  });
  const profitPreview = selectedProduct && quantity > 0 && unitCost > 0
    ? calculateStockProfitPreview({
        quantity,
        unitCost,
        retailPrice: selectedProduct.retailPrice,
        wholesalePrice: selectedProduct.wholesalePrice,
      })
    : null;

  useEffect(() => {
    if (!open) return;
    setError('');
    setFormData(getEmptyFormData(initialProductId));
  }, [initialProductId, open]);

  /**
   * Handles the form submission for adding new stock.
   * Validates all required fields and formats data before submission.
   * Clears form and closes dialog on successful submission.
   * Displays error messages if validation fails.
   *
   * @param {React.FormEvent} e - The form submission event
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      // Validate product selection
      if (!formData.productId) {
        throw new Error('Product is required');
      }
      // Validate quantity is positive
      if (!formData.quantity || Number(formData.quantity) <= 0) {
        throw new Error('Quantity must be greater than 0');
      }
      // Validate cost input is provided for stock value and profit reports
      if (formData.costInputMode === 'unit' && (!formData.unitCost || Number(formData.unitCost) <= 0)) {
        throw new Error('Unit cost must be greater than 0');
      }
      if (formData.costInputMode === 'total' && (!formData.totalCost || Number(formData.totalCost) <= 0)) {
        throw new Error('Total batch cost must be greater than 0');
      }
      if (unitCost <= 0) {
        throw new Error('Calculated unit cost must be greater than 0');
      }
      if (!selectedProduct) {
        throw new Error('Product selling prices could not be loaded. Please reload products and try again.');
      }

      const profitValidation = calculateStockProfitPreview({
        quantity: Number(formData.quantity),
        unitCost,
        retailPrice: selectedProduct.retailPrice,
        wholesalePrice: selectedProduct.wholesalePrice,
      });
      if (profitValidation.hasLoss) {
        throw new Error(profitValidation.lossMessages.join(' '));
      }

      // Parse and validate expiry date if provided
      let expiryDate: Date | undefined;
      if (formData.expiryDate) {
        expiryDate = new Date(formData.expiryDate);
        if (isNaN(expiryDate.getTime())) {
          throw new Error('Invalid expiry date');
        }
      }

      // Submit the validated stock data
      await onSubmit({
        productId: Number(formData.productId),
        quantity: Number(formData.quantity),
        unitCost,
        expiryDate,
        notes: formData.notes.trim() || undefined,
      });

      // Reset form to initial state
      setFormData(getEmptyFormData(initialProductId));
      // Close dialog after successful submission
      onOpenChange(false);
    } catch (err) {
      // Display validation or submission errors
      setError(err instanceof Error ? err.message : 'Failed to add stock');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-[520px]">
        <DialogHeader className="shrink-0">
          <DialogTitle>Add Stock</DialogTitle>
          <DialogDescription>
            Add a new stock batch for a product. Stock is tracked in FIFO order.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!initialProductId && (
              <div className="space-y-2">
                <Label htmlFor="product">Product</Label>
                <select
                  id="product"
                  value={formData.productId}
                  onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background text-sm"
                >
                  <option value="">Select a product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {initialProductId && (
              <div className="p-2 bg-muted rounded-md text-sm">
                <strong>Product:</strong> {initialProductName}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                placeholder="0"
                min="1"
                step="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                disabled={isSubmitting || isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label>Cost Entry Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <label
                  className={`flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm font-medium ${
                    formData.costInputMode === 'unit'
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'bg-background text-foreground hover:bg-muted'
                  }`}
                >
                  <input
                    type="radio"
                    name="costInputMode"
                    value="unit"
                    checked={formData.costInputMode === 'unit'}
                    onChange={() => setFormData({ ...formData, costInputMode: 'unit' })}
                    className="sr-only"
                    disabled={isSubmitting || isLoading}
                  />
                  By unit
                </label>
                <label
                  className={`flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm font-medium ${
                    formData.costInputMode === 'total'
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'bg-background text-foreground hover:bg-muted'
                  }`}
                >
                  <input
                    type="radio"
                    name="costInputMode"
                    value="total"
                    checked={formData.costInputMode === 'total'}
                    onChange={() => setFormData({ ...formData, costInputMode: 'total' })}
                    className="sr-only"
                    disabled={isSubmitting || isLoading}
                  />
                  By total
                </label>
              </div>
            </div>

            {formData.costInputMode === 'unit' && (
              <div className="space-y-2">
                <Label htmlFor="unitCost">Unit Cost (Buying Price)</Label>
                <Input
                  id="unitCost"
                  type="number"
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  value={formData.unitCost}
                  onChange={(e) => setFormData({ ...formData, unitCost: e.target.value })}
                  disabled={isSubmitting || isLoading}
                />
                <p className="text-xs text-muted-foreground">Cost for one item.</p>
              </div>
            )}

            {formData.costInputMode === 'total' && (
              <div className="space-y-2">
                <Label htmlFor="totalCost">Total Batch Cost</Label>
                <Input
                  id="totalCost"
                  type="number"
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  value={formData.totalCost}
                  onChange={(e) => setFormData({ ...formData, totalCost: e.target.value })}
                  disabled={isSubmitting || isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Unit cost will be calculated from total cost divided by quantity.
                </p>
                {quantity > 0 && unitCost > 0 && (
                  <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                    Calculated unit cost: <span className="font-semibold">{formatMoney(unitCost)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="computedUnitCost">Cost used for profit</Label>
              <Input
                id="computedUnitCost"
                type="text"
                value={unitCost > 0 ? formatMoney(unitCost) : ''}
                placeholder="Calculated after cost is entered"
                readOnly
              />
              <p className="text-xs text-muted-foreground">Used for product cost and profit reports.</p>
            </div>

            {profitPreview && (
              <div
                className={`rounded-md border p-3 text-sm ${
                  profitPreview.hasLoss
                    ? 'border-red-200 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-200'
                    : 'border-green-200 bg-green-50 text-green-950 dark:border-green-900/60 dark:bg-green-950/20 dark:text-green-200'
                }`}
                aria-live="polite"
              >
                <div className="mb-2 font-semibold">Profit Preview</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <ProfitLineCard title="Retail" line={profitPreview.retail} />
                  <ProfitLineCard title="Wholesale" line={profitPreview.wholesale} />
                </div>
                {profitPreview.lossMessages.length > 0 && (
                  <div className="mt-2 rounded-md border border-red-200 bg-red-100 p-2 text-xs font-medium text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
                    {profitPreview.lossMessages.join(' ')}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="expiryDate">Expiry Date (Optional)</Label>
              <Input
                id="expiryDate"
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                disabled={isSubmitting || isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                placeholder="e.g., supplier info, location"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                disabled={isSubmitting || isLoading}
              />
            </div>
          </div>

          <div className="mt-4 flex shrink-0 gap-3 border-t pt-4 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isLoading || Boolean(profitPreview?.hasLoss)}>
              {isSubmitting || isLoading ? 'Adding...' : 'Add Stock'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
