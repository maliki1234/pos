"use client";
import { useEffect, useState } from "react";
import { useProductsStore } from "@/stores/useProductsStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useCurrencyStore } from "@/stores/useCurrencyStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarcodeLabel } from "@/components/BarcodeLabel";
import { Printer, RefreshCw, Plus, Search, Check } from "lucide-react";
import { toast } from "react-toastify";

const API = process.env.NEXT_PUBLIC_API_URL!;

// Generate a valid CODE128-compatible barcode string
function generateBarcode(productId: number): string {
  const ts = Date.now().toString().slice(-6);
  const pid = String(productId).padStart(4, "0");
  return `PRD${pid}${ts}`;
}

export default function BarcodesPage() {
  const { token } = useAuthStore();
  const { products, loadProducts } = useProductsStore();
  const { currency } = useCurrencyStore();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState<Set<number>>(new Set());
  const [copies, setCopies] = useState(1);
  useEffect(() => { loadProducts(); }, []);

  const fmt = (n: number) =>
    `${currency.symbol}${Number(n).toLocaleString()}`;

  const filtered = (products as any[]).filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode && p.barcode.includes(search))
  );

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(filtered.map(p => p.id)));
  const clearAll = () => setSelected(new Set());

  const handleGenerate = async (product: any) => {
    if (product.barcode) {
      if (!confirm(`Product already has barcode "${product.barcode}". Replace it?`)) return;
    }
    const newBarcode = generateBarcode(product.id);
    setGenerating(prev => new Set(prev).add(product.id));
    try {
      const r = await fetch(`${API}/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ barcode: newBarcode }),
      });
      if (!r.ok) { toast.error("Failed to save barcode"); return; }
      toast.success(`Barcode generated for ${product.name}`);
      await loadProducts();
    } finally {
      setGenerating(prev => { const n = new Set(prev); n.delete(product.id); return n; });
    }
  };

  const handlePrint = () => {
    if (selected.size === 0) { toast.error("Select at least one product"); return; }
    const selectedProducts = (products as any[]).filter(p => selected.has(p.id) && p.barcode);
    if (selectedProducts.length === 0) { toast.error("Selected products have no barcodes. Generate them first."); return; }

    const printWindow = window.open("", "", "height=800,width=600");
    if (!printWindow) return;

    // Build label HTML for each product × copies
    const labels = selectedProducts.flatMap(p =>
      Array(copies).fill(null).map(() => `
        <div class="label">
          <div class="product-name">${p.name}</div>
          <svg id="bc_${p.id}_${Math.random().toString(36).slice(2)}"></svg>
          <div class="price">${fmt(p.retail?.unitPrice ?? 0)}</div>
        </div>
      `)
    ).join("");

    printWindow.document.write(`
      <html><head><title>Barcode Labels</title>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; }
        .grid { display: flex; flex-wrap: wrap; gap: 8px; padding: 8px; }
        .label { border: 1px solid #ccc; padding: 6px; display: inline-flex; flex-direction: column; align-items: center; width: 160px; background: white; }
        .product-name { font-size: 10px; font-weight: bold; text-align: center; margin-bottom: 4px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .price { font-size: 12px; font-weight: bold; margin-top: 4px; }
        @media print { body { margin: 0; } }
      </style></head>
      <body>
      <div class="grid">${labels}</div>
      <script>
        window.onload = function() {
          document.querySelectorAll('svg[id^="bc_"]').forEach(function(el) {
            var pid = el.id.split('_')[1];
            var barcodes = ${JSON.stringify(Object.fromEntries(selectedProducts.map(p => [p.id, p.barcode])))};
            var barcode = barcodes[pid];
            if (barcode) {
              JsBarcode(el, barcode, { format: 'CODE128', width: 1.5, height: 50, fontSize: 11, margin: 4 });
            }
          });
          setTimeout(function() { window.print(); }, 500);
        };
      <\/script>
      </body></html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Barcode Manager</h1>
          <p className="text-muted-foreground mt-1">Generate and print barcode labels for your products</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Copies:</span>
          <Input type="number" min={1} max={20} value={copies}
            onChange={e => setCopies(Math.max(1, Math.min(20, Number(e.target.value))))}
            className="w-16 h-9 text-center" />
          <Button onClick={handlePrint} disabled={selected.size === 0} className="gap-2">
            <Printer className="h-4 w-4" /> Print {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </div>
      </div>

      {/* Search + select controls */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search products..." className="pl-9" value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" onClick={selectAll}>Select All</Button>
        <Button variant="outline" size="sm" onClick={clearAll}>Clear</Button>
        {selected.size > 0 && (
          <Badge variant="secondary">{selected.size} selected</Badge>
        )}
      </div>

      {/* Product list */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((product: any) => (
          <Card
            key={product.id}
            className={`cursor-pointer transition-all ${selected.has(product.id) ? "ring-2 ring-primary" : ""}`}
            onClick={() => toggleSelect(product.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{product.name}</p>
                  <p className="text-sm text-muted-foreground">{fmt(product.retail?.unitPrice ?? 0)}</p>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  {selected.has(product.id) && (
                    <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                </div>
              </div>

              {product.barcode ? (
                <div className="flex flex-col items-center gap-2">
                  {/* Live barcode preview */}
                  <div onClick={e => e.stopPropagation()}>
                    <BarcodeLabel
                      value={product.barcode}
                      width={1.5}
                      height={50}
                      fontSize={11}
                      showText={true}
                    />
                  </div>
                  <Button
                    size="sm" variant="ghost"
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    onClick={e => { e.stopPropagation(); handleGenerate(product); }}
                    disabled={generating.has(product.id)}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    {generating.has(product.id) ? "Generating..." : "Regenerate"}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-2">
                  <p className="text-xs text-muted-foreground">No barcode assigned</p>
                  <Button
                    size="sm" variant="outline" className="gap-1"
                    onClick={e => { e.stopPropagation(); handleGenerate(product); }}
                    disabled={generating.has(product.id)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {generating.has(product.id) ? "Generating..." : "Generate Barcode"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No products found. Add products first.
          </div>
        )}
      </div>
    </div>
  );
}
