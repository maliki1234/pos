'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  products?: Array<{ id: number; name: string }>;
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
  const [formData, setFormData] = useState({
    productId: initialProductId?.toString() || '',
    quantity: '',
    unitCost: '',
    expiryDate: '',
    notes: '',
  });
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      // Validate unit cost is provided
      if (!formData.unitCost || Number(formData.unitCost) < 0) {
        throw new Error('Unit cost is required');
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
        unitCost: Number(formData.unitCost),
        expiryDate,
        notes: formData.notes.trim() || undefined,
      });

      // Reset form to initial state
      setFormData({
        productId: initialProductId?.toString() || '',
        quantity: '',
        unitCost: '',
        expiryDate: '',
        notes: '',
      });
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Stock</DialogTitle>
          <DialogDescription>
            Add a new stock batch for a product. Stock is tracked in FIFO order.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <Label htmlFor="unitCost">Unit Cost</Label>
            <Input
              id="unitCost"
              type="number"
              placeholder="0.00"
              min="0"
              step="0.01"
              value={formData.unitCost}
              onChange={(e) => setFormData({ ...formData, unitCost: e.target.value })}
              disabled={isSubmitting || isLoading}
            />
          </div>

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

          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isLoading}>
              {isSubmitting || isLoading ? 'Adding...' : 'Add Stock'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
