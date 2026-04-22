"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useProductsStore } from "@/stores/useProductsStore";
import { useCategoriesStore } from "@/stores/useCategoriesStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useCurrencyStore } from "@/stores/useCurrencyStore";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddProductDialog } from "@/components/AddProductDialog";
import { toast } from "react-toastify";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const API = process.env.NEXT_PUBLIC_API_URL;

const EMPTY_EDIT = { name: "", description: "", barcode: "", categoryId: "", reorderPoint: "10", retailPrice: "", wholesalePrice: "", costPrice: "", unitLevel: "PIECE", parentId: "", conversionRate: "" };

export default function ProductsPage() {
  const { products, isLoading, loadProducts, searchProducts, createProduct, deleteProduct } = useProductsStore();
  const { categories, loadCategories } = useCategoriesStore();
  const { token, user } = useAuthStore();
  const { currency } = useCurrencyStore();
  const fmt = (n: number) => `${currency.symbol}${Number(n).toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  const canManage = user?.role === "ADMIN" || user?.role === "MANAGER";

  const [query, setQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit state
  const [editTarget, setEditTarget] = useState<any>(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_EDIT });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [deletingProductId, setDeletingProductId] = useState<number | null>(null);

  useEffect(() => { loadProducts(); loadCategories(); }, []);

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }), [token]);

  const handleSearch = async (value: string) => {
    setQuery(value);
    if (value.trim()) { await searchProducts(value); } else { await loadProducts(); }
  };

  const handleAddProduct = async (data: any) => {
    setIsSubmitting(true);
    try {
      await createProduct(data);
      toast.success("Product added successfully!");
      setIsDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to add product");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (product: any) => {
    setEditTarget(product);
    setEditForm({
      name: product.name ?? "",
      description: product.description ?? "",
      barcode: product.barcode ?? "",
      categoryId: product.categoryId ?? "",
      reorderPoint: String(product.reorderPoint ?? 10),
      retailPrice: String(product.retail?.unitPrice ?? product.prices?.find((p: any) => p.customerType === "RETAIL")?.unitPrice ?? ""),
      wholesalePrice: String(product.wholesale?.unitPrice ?? product.prices?.find((p: any) => p.customerType === "WHOLESALE")?.unitPrice ?? ""),
      costPrice: String(product.retail?.costPrice ?? product.prices?.find((p: any) => p.customerType === "RETAIL")?.costPrice ?? ""),
      unitLevel: product.unitLevel ?? "PIECE",
      parentId: product.parentId ? String(product.parentId) : "",
      conversionRate: product.conversionRate ? String(product.conversionRate) : "",
    });
    setEditError("");
  };

  const closeEdit = () => { setEditTarget(null); setEditError(""); };

  const handleDeleteProduct = async (event: React.MouseEvent, product: any) => {
    event.stopPropagation();
    if (!confirm(`Delete product "${product.name}" and archive its stock? Sales history will remain.`)) return;

    setDeletingProductId(product.id);
    try {
      await deleteProduct(product.id);
      if (editTarget?.id === product.id) closeEdit();
      toast.success("Product deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete product");
    } finally {
      setDeletingProductId(null);
    }
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditSaving(true);
    setEditError("");
    try {
      // Update product info
      const r1 = await fetch(`${API}/products/${editTarget.id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          name: editForm.name.trim() || undefined,
          description: editForm.description.trim() || undefined,
          barcode: editForm.barcode.trim() || undefined,
          categoryId: editForm.categoryId || undefined,
          reorderPoint: editForm.reorderPoint ? parseInt(editForm.reorderPoint) : undefined,
          unitLevel: editForm.unitLevel || undefined,
          parentId: editForm.parentId ? parseInt(editForm.parentId) : null,
          conversionRate: editForm.conversionRate ? parseInt(editForm.conversionRate) : null,
        }),
      });
      if (!r1.ok) { const d = await r1.json(); throw new Error(d.message || "Failed to update product"); }

      // Update retail price if provided
      if (editForm.retailPrice) {
        await fetch(`${API}/products/${editTarget.id}/pricing`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            customerType: "RETAIL",
            unitPrice: parseFloat(editForm.retailPrice),
            costPrice: parseFloat(editForm.costPrice || editForm.retailPrice),
          }),
        });
      }

      // Update wholesale price if provided
      if (editForm.wholesalePrice) {
        await fetch(`${API}/products/${editTarget.id}/pricing`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            customerType: "WHOLESALE",
            unitPrice: parseFloat(editForm.wholesalePrice),
            costPrice: parseFloat(editForm.costPrice || editForm.wholesalePrice),
          }),
        });
      }

      toast.success("Product updated");
      closeEdit();
      loadProducts();
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const getCategoryName = (categoryId: string) =>
    categories.find((c) => c.id === categoryId)?.name || "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground">Manage your product catalog</p>
        </div>
        {canManage && (
          <Button size="lg" className="gap-2" onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        )}
      </div>

      <AddProductDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        categories={categories}
        onSubmit={handleAddProduct}
        isLoading={isSubmitting}
      />

      {/* Inline Edit Form */}
      {editTarget && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Edit — {editTarget.name}</CardTitle>
            <button onClick={closeEdit} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEditSave} className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium block mb-1">Name *</label>
                  <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Barcode</label>
                  <Input value={editForm.barcode} onChange={e => setEditForm(f => ({ ...f, barcode: e.target.value }))} placeholder="Scan or type barcode" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Category</label>
                  <select
                    value={editForm.categoryId}
                    onChange={e => setEditForm(f => ({ ...f, categoryId: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">— None —</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Retail Price ({currency.symbol})</label>
                  <Input type="number" min="0" step="0.01" value={editForm.retailPrice} onChange={e => setEditForm(f => ({ ...f, retailPrice: e.target.value }))} placeholder="0.00" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Wholesale Price ({currency.symbol})</label>
                  <Input type="number" min="0" step="0.01" value={editForm.wholesalePrice} onChange={e => setEditForm(f => ({ ...f, wholesalePrice: e.target.value }))} placeholder="0.00" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Cost Price ({currency.symbol})</label>
                  <Input type="number" min="0" step="0.01" value={editForm.costPrice} onChange={e => setEditForm(f => ({ ...f, costPrice: e.target.value }))} placeholder="0.00" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Reorder Point</label>
                  <Input type="number" min="0" value={editForm.reorderPoint} onChange={e => setEditForm(f => ({ ...f, reorderPoint: e.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium block mb-1">Description</label>
                  <Input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
                </div>
                {/* Hierarchy fields */}
                <div className="md:col-span-2 border-t pt-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-3">Unit Hierarchy (Carton → Block → Piece)</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-sm font-medium block mb-1">Unit Level</label>
                      <select value={editForm.unitLevel} onChange={e => setEditForm(f => ({ ...f, unitLevel: e.target.value }))}
                        className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary">
                        <option value="PIECE">PIECE (sellable)</option>
                        <option value="BLOCK">BLOCK (intermediate)</option>
                        <option value="CARTON">CARTON (bulk)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-1">Parent Product</label>
                      <select value={editForm.parentId} onChange={e => setEditForm(f => ({ ...f, parentId: e.target.value }))}
                        className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary">
                        <option value="">— None (top level) —</option>
                        {(products as any[]).filter(p => p.id !== editTarget?.id).map(p => (
                          <option key={p.id} value={p.id}>[{p.unitLevel || "PIECE"}] {p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium block mb-1">Units per Parent</label>
                      <Input type="number" min="1" placeholder="e.g. 24 blocks per carton"
                        value={editForm.conversionRate}
                        onChange={e => setEditForm(f => ({ ...f, conversionRate: e.target.value }))} />
                    </div>
                  </div>
                </div>
              </div>
              {editError && <p className="text-sm text-destructive">{editError}</p>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={closeEdit} className="px-4 py-2 rounded-md border text-sm hover:bg-muted">Cancel</button>
                <button type="submit" disabled={editSaving} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                  {editSaving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Product List ({products.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="text"
            placeholder="Search products…"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            className="max-w-md"
          />

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead className="text-right">Retail</TableHead>
                  <TableHead className="text-right">Wholesale</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="w-24"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 8 : 7} className="text-center py-8 text-muted-foreground">
                      Loading products…
                    </TableCell>
                  </TableRow>
                ) : products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 8 : 7} className="text-center py-8 text-muted-foreground">
                      No products found
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product: any) => {
                    const stockQty = product.stock?.quantity ?? product.totalStock ?? 0;
                    const retailP = product.retail?.unitPrice ?? 0;
                    const wholesaleP = product.wholesale?.unitPrice ?? 0;
                    return (
                      <TableRow key={product.id} className={editTarget?.id === product.id ? "bg-primary/5" : ""}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{getCategoryName(product.categoryId)}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{product.barcode || "—"}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(retailP)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{wholesaleP ? fmt(wholesaleP) : "—"}</TableCell>
                        <TableCell className="text-right">{stockQty}</TableCell>
                        <TableCell>
                          <Badge variant={stockQty > (product.reorderPoint ?? 10) ? "success" : "warning"}>
                            {stockQty > (product.reorderPoint ?? 10) ? "In Stock" : "Low Stock"}
                          </Badge>
                        </TableCell>
                        {canManage && (
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => editTarget?.id === product.id ? closeEdit() : openEdit(product)}
                                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                title="Edit product"
                              >
                                {editTarget?.id === product.id ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                              </button>
                              <button
                                onClick={(event) => handleDeleteProduct(event, product)}
                                disabled={deletingProductId === product.id}
                                className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 disabled:opacity-50"
                                title="Delete product and stock"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
