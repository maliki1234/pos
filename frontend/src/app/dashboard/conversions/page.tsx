"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useProductsStore } from "@/stores/useProductsStore";
import { useCurrencyStore } from "@/stores/useCurrencyStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeftRight, Plus, X, History, Calculator, Minus } from "lucide-react";
import { toast } from "react-toastify";

const API = process.env.NEXT_PUBLIC_API_URL!;

type UnitLevel = "CARTON" | "BLOCK" | "PIECE";

interface Product {
  id: number; name: string; unitLevel: UnitLevel;
  parentId: number | null; conversionRate: number | null;
  retail?: { unitPrice: number };
}
interface Conversion {
  id: string; quantityIn: number; quantityOut: number; costPerUnit: number;
  notes?: string; convertedAt: string;
  fromProduct: { id: number; name: string; unitLevel: string };
  toProduct:   { id: number; name: string; unitLevel: string };
}
interface SimScenario { piecesCount: string; sellingPrice: string; }
interface SimResult {
  product: { name: string; avgCostPerUnit: number; totalAvailable: number };
  scenarios: {
    piecesCount: number; sellingPrice: number; costPerPiece: number;
    revenuePerUnit: number; profitPerUnit: number; marginPct: number;
  }[];
}

const LEVEL_COLOR: Record<string, string> = {
  CARTON: "bg-blue-100 text-blue-800",
  BLOCK:  "bg-orange-100 text-orange-800",
  PIECE:  "bg-green-100 text-green-800",
};

export default function ConversionsPage() {
  const { token } = useAuthStore();
  const { products: rawProducts, loadProducts } = useProductsStore();
  const { currency } = useCurrencyStore();
  const products = rawProducts as unknown as Product[];

  const [conversions, setConversions] = useState<Conversion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [showSim, setShowSim] = useState(false);

  // Convert form
  const [convertForm, setConvertForm] = useState({ fromProductId: "", toProductId: "", quantityIn: "", notes: "" });
  const [converting, setConverting] = useState(false);

  // Simulation
  const [simProductId, setSimProductId] = useState("");
  const [scenarios, setScenarios] = useState<SimScenario[]>([{ piecesCount: "", sellingPrice: "" }]);
  const [simResults, setSimResults] = useState<SimResult | null>(null);
  const [simulating, setSimulating] = useState(false);

  const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const fmt = (n: number) => `${currency.symbol}${Number(n).toLocaleString()}`;

  const fetchConversions = async () => {
    const r = await fetch(`${API}/conversions`, { headers: H });
    const d = await r.json();
    if (d.success) setConversions(d.data);
  };

  useEffect(() => {
    Promise.all([loadProducts(), fetchConversions()]).finally(() => setLoading(false));
  }, []);

  // Derived lists
  const parentProducts = products.filter(p => p.unitLevel === "CARTON" || p.unitLevel === "BLOCK");
  const childrenOf = (parentId: number) => products.filter(p => p.parentId === parentId);
  // Computed: quantity out preview
  const toProduct   = products.find(p => p.id === Number(convertForm.toProductId));
  const quantityOut = convertForm.quantityIn && toProduct?.conversionRate
    ? Number(convertForm.quantityIn) * toProduct.conversionRate
    : null;

  const handleConvert = async () => {
    if (!convertForm.fromProductId || !convertForm.toProductId || !convertForm.quantityIn) {
      toast.error("Fill in all fields"); return;
    }
    setConverting(true);
    try {
      const r = await fetch(`${API}/conversions/convert`, {
        method: "POST", headers: H,
        body: JSON.stringify({
          fromProductId: Number(convertForm.fromProductId),
          toProductId:   Number(convertForm.toProductId),
          quantityIn:    Number(convertForm.quantityIn),
          notes:         convertForm.notes,
        }),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.message || "Conversion failed"); return; }
      const s = d.data.summary;
      toast.success(`Converted ${s.quantityIn} ${s.fromProduct} → ${s.quantityOut} ${s.toProduct}`);
      setShowConvert(false);
      setConvertForm({ fromProductId: "", toProductId: "", quantityIn: "", notes: "" });
      fetchConversions();
      loadProducts();
    } finally { setConverting(false); }
  };

  const handleSimulate = async () => {
    if (!simProductId || scenarios.some(s => !s.piecesCount || !s.sellingPrice)) {
      toast.error("Fill in all simulation fields"); return;
    }
    setSimulating(true);
    try {
      const r = await fetch(`${API}/conversions/simulate`, {
        method: "POST", headers: H,
        body: JSON.stringify({
          fromProductId: Number(simProductId),
          scenarios: scenarios.map(s => ({
            piecesCount:  Number(s.piecesCount),
            sellingPrice: Number(s.sellingPrice),
          })),
        }),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.message || "Simulation failed"); return; }
      setSimResults(d.data);
    } finally { setSimulating(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-96"><p className="text-muted-foreground">Loading...</p></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ArrowLeftRight className="h-7 w-7" /> Stock Conversions
          </h1>
          <p className="text-muted-foreground mt-1">Break cartons into blocks, blocks into pieces</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setShowHistory(h => !h); }}>
            <History className="h-4 w-4 mr-1" /> History
          </Button>
          <Button variant="outline" onClick={() => { setShowSim(true); setSimResults(null); }}>
            <Calculator className="h-4 w-4 mr-1" /> Simulate Pricing
          </Button>
          <Button onClick={() => setShowConvert(true)}>
            <ArrowLeftRight className="h-4 w-4 mr-1" /> Convert Stock
          </Button>
        </div>
      </div>

      {/* Product hierarchy overview */}
      <div className="grid gap-4 md:grid-cols-3">
        {(["CARTON", "BLOCK", "PIECE"] as UnitLevel[]).map(level => {
          const count = products.filter(p => p.unitLevel === level).length;
          return (
            <Card key={level}>
              <CardContent className="pt-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{level}s</p>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">products at this level</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${LEVEL_COLOR[level]}`}>{level}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Hierarchy tree */}
      <Card>
        <CardHeader><CardTitle>Product Hierarchy</CardTitle></CardHeader>
        <CardContent>
          {products.filter(p => p.unitLevel === "CARTON").length === 0 && (
            <p className="text-sm text-muted-foreground">
              No carton-level products yet. Set the unit level when adding or editing products.
            </p>
          )}
          {products.filter(p => p.unitLevel === "CARTON").map(carton => (
            <div key={carton.id} className="mb-4">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${LEVEL_COLOR.CARTON}`}>CARTON</span>
                <span className="font-semibold">{carton.name}</span>
              </div>
              {childrenOf(carton.id).map(block => (
                <div key={block.id} className="ml-6 mt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">└─</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${LEVEL_COLOR.BLOCK}`}>BLOCK</span>
                    <span className="font-medium">{block.name}</span>
                    {block.conversionRate && (
                      <span className="text-xs text-muted-foreground">({block.conversionRate} per carton)</span>
                    )}
                  </div>
                  {childrenOf(block.id).map(piece => (
                    <div key={piece.id} className="ml-6 mt-1 flex items-center gap-2">
                      <span className="text-muted-foreground">└─</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${LEVEL_COLOR.PIECE}`}>PIECE</span>
                      <span className="text-sm">{piece.name}</span>
                      {piece.conversionRate && (
                        <span className="text-xs text-muted-foreground">({piece.conversionRate} per block)</span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Conversion History */}
      {showHistory && (
        <Card>
          <CardHeader><CardTitle>Conversion History</CardTitle></CardHeader>
          <CardContent>
            {conversions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No conversions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-muted-foreground text-xs uppercase">
                    <th className="text-left p-2">From</th>
                    <th className="text-left p-2">To</th>
                    <th className="text-right p-2">Qty In</th>
                    <th className="text-right p-2">Qty Out</th>
                    <th className="text-right p-2">Cost/Unit</th>
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Notes</th>
                  </tr></thead>
                  <tbody>
                    {conversions.map(c => (
                      <tr key={c.id} className="border-b hover:bg-muted/30">
                        <td className="p-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium mr-1 ${LEVEL_COLOR[c.fromProduct.unitLevel] || ""}`}>
                            {c.fromProduct.unitLevel}
                          </span>
                          {c.fromProduct.name}
                        </td>
                        <td className="p-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium mr-1 ${LEVEL_COLOR[c.toProduct.unitLevel] || ""}`}>
                            {c.toProduct.unitLevel}
                          </span>
                          {c.toProduct.name}
                        </td>
                        <td className="p-2 text-right">{c.quantityIn}</td>
                        <td className="p-2 text-right">{c.quantityOut}</td>
                        <td className="p-2 text-right font-semibold">{fmt(Number(c.costPerUnit))}</td>
                        <td className="p-2 text-muted-foreground text-xs">{new Date(c.convertedAt).toLocaleDateString()}</td>
                        <td className="p-2 text-muted-foreground text-xs">{c.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Convert Modal */}
      {showConvert && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><ArrowLeftRight className="h-5 w-5" /> Convert Stock</CardTitle>
                <button onClick={() => setShowConvert(false)} className="p-1 hover:bg-muted rounded"><X className="h-4 w-4" /></button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">From (parent product) *</label>
                <select value={convertForm.fromProductId}
                  onChange={e => setConvertForm(f => ({ ...f, fromProductId: e.target.value, toProductId: "" }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">Select carton or block product</option>
                  {parentProducts.map(p => (
                    <option key={p.id} value={p.id}>[{p.unitLevel}] {p.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">To (child product) *</label>
                <select value={convertForm.toProductId}
                  onChange={e => setConvertForm(f => ({ ...f, toProductId: e.target.value }))}
                  disabled={!convertForm.fromProductId}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
                  <option value="">Select child product</option>
                  {convertForm.fromProductId && childrenOf(Number(convertForm.fromProductId)).map(p => (
                    <option key={p.id} value={p.id}>[{p.unitLevel}] {p.name} — {p.conversionRate ?? "?"} per unit</option>
                  ))}
                </select>
                {convertForm.fromProductId && childrenOf(Number(convertForm.fromProductId)).length === 0 && (
                  <p className="text-xs text-orange-600">No child products linked. Edit products to set parent/level.</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Quantity to Convert *</label>
                <Input type="number" min="1" placeholder="e.g. 2"
                  value={convertForm.quantityIn}
                  onChange={e => setConvertForm(f => ({ ...f, quantityIn: e.target.value }))} />
                {quantityOut !== null && (
                  <p className="text-sm font-medium text-primary">
                    → Will create {quantityOut} {toProduct?.name}s
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Notes (optional)</label>
                <Input placeholder="e.g. Batch for weekend" value={convertForm.notes}
                  onChange={e => setConvertForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowConvert(false)}>Cancel</Button>
                <Button className="flex-1" onClick={handleConvert} disabled={converting}>
                  {converting ? "Converting..." : "Execute Conversion"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Simulate Modal */}
      {showSim && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="w-full max-w-2xl shadow-2xl my-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" /> Profit Simulator</CardTitle>
                <button onClick={() => setShowSim(false)} className="p-1 hover:bg-muted rounded"><X className="h-4 w-4" /></button>
              </div>
              <p className="text-sm text-muted-foreground">Simulate different piece counts and selling prices before breaking down stock</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Product to simulate *</label>
                <select value={simProductId} onChange={e => { setSimProductId(e.target.value); setSimResults(null); }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">Select a product (any level)</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>[{p.unitLevel}] {p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Scenarios</label>
                  <Button size="sm" variant="ghost" className="h-7 text-xs"
                    onClick={() => setScenarios(s => [...s, { piecesCount: "", sellingPrice: "" }])}>
                    <Plus className="h-3 w-3 mr-1" /> Add scenario
                  </Button>
                </div>
                <div className="space-y-2">
                  {scenarios.map((s, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <div className="flex-1">
                        <Input type="number" min="1" placeholder="Pieces per unit (e.g. 8)"
                          value={s.piecesCount}
                          onChange={e => setScenarios(p => p.map((x, idx) => idx === i ? { ...x, piecesCount: e.target.value } : x))} />
                      </div>
                      <div className="flex-1">
                        <Input type="number" min="0" placeholder={`Selling price per piece`}
                          value={s.sellingPrice}
                          onChange={e => setScenarios(p => p.map((x, idx) => idx === i ? { ...x, sellingPrice: e.target.value } : x))} />
                      </div>
                      {scenarios.length > 1 && (
                        <button onClick={() => setScenarios(p => p.filter((_, idx) => idx !== i))} className="text-red-500 p-1">
                          <Minus className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1 px-1">
                  <span>← Pieces count per unit</span>
                  <span>Selling price per piece →</span>
                </div>
              </div>

              <Button className="w-full" onClick={handleSimulate} disabled={simulating}>
                {simulating ? "Simulating..." : "Run Simulation"}
              </Button>

              {/* Results */}
              {simResults && (
                <div className="space-y-3">
                  <div className="rounded-lg bg-muted/40 p-3 text-sm flex items-center justify-between">
                    <span className="text-muted-foreground">{simResults.product.name} — avg cost per unit:</span>
                    <span className="font-bold text-foreground">{fmt(simResults.product.avgCostPerUnit)}</span>
                  </div>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-muted text-xs uppercase text-muted-foreground">
                        <th className="p-2 text-right">Pieces</th>
                        <th className="p-2 text-right">Sell Price</th>
                        <th className="p-2 text-right">Cost/Piece</th>
                        <th className="p-2 text-right">Revenue/Unit</th>
                        <th className="p-2 text-right">Profit/Unit</th>
                        <th className="p-2 text-right">Margin</th>
                      </tr></thead>
                      <tbody>
                        {simResults.scenarios.map((r, i) => (
                          <tr key={i} className={`border-t ${r.profitPerUnit >= 0 ? "" : "bg-red-50 dark:bg-red-950/20"}`}>
                            <td className="p-2 text-right font-medium">{r.piecesCount}</td>
                            <td className="p-2 text-right">{fmt(r.sellingPrice)}</td>
                            <td className="p-2 text-right text-muted-foreground">{fmt(r.costPerPiece)}</td>
                            <td className="p-2 text-right">{fmt(r.revenuePerUnit)}</td>
                            <td className={`p-2 text-right font-semibold ${r.profitPerUnit >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {r.profitPerUnit >= 0 ? "+" : ""}{fmt(r.profitPerUnit)}
                            </td>
                            <td className="p-2 text-right">
                              <span className={`font-semibold text-xs px-1.5 py-0.5 rounded ${
                                r.marginPct >= 20 ? "bg-green-100 text-green-700" :
                                r.marginPct >= 10 ? "bg-yellow-100 text-yellow-700" :
                                "bg-red-100 text-red-700"
                              }`}>{r.marginPct.toFixed(1)}%</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground">Green ≥20% margin · Yellow ≥10% · Red &lt;10%</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
