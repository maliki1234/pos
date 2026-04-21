"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useProductsStore } from "@/stores/useProductsStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ChefHat, Play, X, History } from "lucide-react";
import { toast } from "react-toastify";

const API = process.env.NEXT_PUBLIC_API_URL!;

interface Ingredient { productId: number; productName: string; quantity: string; unit: string; }
interface Recipe {
  id: string; name: string; yieldQty: number; notes?: string;
  product: { id: number; name: string };
  ingredients: { id: string; productId: number; quantity: number; unit: string; product: { name: string } }[];
  _count: { runs: number };
}
interface ProductionRun {
  id: string; quantityProduced: number; costPerUnit: number;
  totalMaterialCost: number; totalExtraCost: number;
  producedAt: string; notes?: string;
  recipe: { name: string; product: { name: string } };
}

const UNITS = ["units", "kg", "g", "L", "ml", "pcs", "cups", "tbsp", "tsp"];

const EMPTY_FORM = { productId: "", name: "", yieldQty: "1", notes: "" };
const EMPTY_ING: Ingredient = { productId: 0, productName: "", quantity: "", unit: "units" };
const EMPTY_RUN = { quantityProduced: "", notes: "" };
const EMPTY_EXTRA = { name: "", amount: "" };

export default function RecipesPage() {
  const { token } = useAuthStore();
  const { products, loadProducts } = useProductsStore();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [runs, setRuns] = useState<ProductionRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ ...EMPTY_ING }]);
  const [submitting, setSubmitting] = useState(false);
  const [showRunModal, setShowRunModal] = useState<Recipe | null>(null);
  const [runForm, setRunForm] = useState(EMPTY_RUN);
  const [extraCosts, setExtraCosts] = useState([{ ...EMPTY_EXTRA }]);
  const [running, setRunning] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const fetchRecipes = async () => {
    const r = await fetch(`${API}/recipes`, { headers });
    const d = await r.json();
    if (d.success) setRecipes(d.data);
  };
  const fetchRuns = async () => {
    const r = await fetch(`${API}/recipes/production`, { headers });
    const d = await r.json();
    if (d.success) setRuns(d.data);
  };

  useEffect(() => {
    Promise.all([loadProducts(), fetchRecipes(), fetchRuns()]).finally(() => setLoading(false));
  }, []);

  const fmt = (n: number) => `TZS ${Number(n).toLocaleString()}`;

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setIngredients([{ ...EMPTY_ING }]);
    setShowForm(true);
  };

  const openEdit = (r: Recipe) => {
    setEditId(r.id);
    setForm({ productId: String(r.product.id), name: r.name, yieldQty: String(r.yieldQty), notes: r.notes || "" });
    setIngredients(r.ingredients.map(i => ({
      productId: i.productId,
      productName: i.product.name,
      quantity: String(i.quantity),
      unit: i.unit,
    })));
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.productId || ingredients.some(i => !i.productId || !i.quantity)) {
      toast.error("Fill in all required fields including ingredients"); return;
    }
    setSubmitting(true);
    try {
      const body = {
        productId: Number(form.productId),
        name: form.name,
        yieldQty: Number(form.yieldQty) || 1,
        notes: form.notes,
        ingredients: ingredients.map(i => ({ productId: Number(i.productId), quantity: Number(i.quantity), unit: i.unit })),
      };
      const url = editId ? `${API}/recipes/${editId}` : `${API}/recipes`;
      const method = editId ? "PUT" : "POST";
      const r = await fetch(url, { method, headers, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { toast.error(d.message || "Failed"); return; }
      toast.success(editId ? "Recipe updated" : "Recipe created");
      setShowForm(false);
      fetchRecipes();
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this recipe?")) return;
    await fetch(`${API}/recipes/${id}`, { method: "DELETE", headers });
    toast.success("Recipe deleted");
    fetchRecipes();
  };

  const handleRunProduction = async () => {
    if (!showRunModal || !runForm.quantityProduced) { toast.error("Enter quantity"); return; }
    setRunning(true);
    try {
      const body = {
        recipeId: showRunModal.id,
        quantityProduced: Number(runForm.quantityProduced),
        notes: runForm.notes,
        extraCosts: extraCosts.filter(c => c.name && c.amount).map(c => ({ name: c.name, amount: Number(c.amount) })),
      };
      const r = await fetch(`${API}/recipes/production`, { method: "POST", headers, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { toast.error(d.message || "Production failed"); return; }
      const s = d.data.summary;
      toast.success(`Produced ${s.quantityProduced} units — Cost/unit: ${fmt(s.costPerUnit)}`);
      setShowRunModal(null);
      setRunForm(EMPTY_RUN);
      setExtraCosts([{ ...EMPTY_EXTRA }]);
      fetchRecipes();
      fetchRuns();
    } finally { setRunning(false); }
  };

  const addIngredient = () => setIngredients(p => [...p, { ...EMPTY_ING }]);
  const removeIngredient = (i: number) => setIngredients(p => p.filter((_, idx) => idx !== i));
  const updateIngredient = (i: number, field: keyof Ingredient, val: string) => {
    setIngredients(p => p.map((ing, idx) => {
      if (idx !== i) return ing;
      if (field === "productId") {
        const prod = (products as any[]).find(p => p.id === Number(val));
        return { ...ing, productId: Number(val), productName: prod?.name || "" };
      }
      return { ...ing, [field]: val };
    }));
  };

  if (loading) return <div className="flex items-center justify-center h-96"><p className="text-muted-foreground">Loading...</p></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ChefHat className="h-7 w-7" /> Recipes & Production
          </h1>
          <p className="text-muted-foreground mt-1">Define how products are made from ingredients</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowHistory(h => !h)}>
            <History className="h-4 w-4 mr-1" /> History
          </Button>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> New Recipe</Button>
        </div>
      </div>

      {/* Production History */}
      {showHistory && (
        <Card>
          <CardHeader><CardTitle>Production History</CardTitle></CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <p className="text-muted-foreground text-sm">No production runs yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-muted-foreground">
                    <th className="text-left p-2">Recipe</th>
                    <th className="text-left p-2">Finished Product</th>
                    <th className="text-right p-2">Qty Produced</th>
                    <th className="text-right p-2">Material Cost</th>
                    <th className="text-right p-2">Extra Cost</th>
                    <th className="text-right p-2">Cost/Unit</th>
                    <th className="text-left p-2">Date</th>
                  </tr></thead>
                  <tbody>
                    {runs.map(r => (
                      <tr key={r.id} className="border-b hover:bg-muted/30">
                        <td className="p-2 font-medium">{r.recipe.name}</td>
                        <td className="p-2 text-muted-foreground">{r.recipe.product.name}</td>
                        <td className="p-2 text-right">{r.quantityProduced}</td>
                        <td className="p-2 text-right">{fmt(r.totalMaterialCost)}</td>
                        <td className="p-2 text-right">{fmt(r.totalExtraCost)}</td>
                        <td className="p-2 text-right font-semibold text-primary">{fmt(r.costPerUnit)}</td>
                        <td className="p-2 text-muted-foreground text-xs">{new Date(r.producedAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recipe Form */}
      {showForm && (
        <Card className="border-primary/40">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{editId ? "Edit Recipe" : "New Recipe"}</CardTitle>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-muted rounded"><X className="h-4 w-4" /></button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Recipe Name *</label>
                <Input placeholder="e.g. Chocolate Cake" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Finished Product *</label>
                <select value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">Select product</option>
                  {(products as any[]).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Yield (units per batch) *</label>
                <Input type="number" min="1" placeholder="1" value={form.yieldQty} onChange={e => setForm(f => ({ ...f, yieldQty: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Notes</label>
                <Input placeholder="Optional notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            {/* Ingredients */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Ingredients *</label>
                <Button size="sm" variant="outline" onClick={addIngredient}><Plus className="h-3.5 w-3.5 mr-1" /> Add</Button>
              </div>
              <div className="space-y-2">
                {ingredients.map((ing, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <select value={ing.productId || ""} onChange={e => updateIngredient(i, "productId", e.target.value)}
                      className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <option value="">Select ingredient</option>
                      {(products as any[]).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <Input type="number" placeholder="Qty" className="w-24" value={ing.quantity}
                      onChange={e => updateIngredient(i, "quantity", e.target.value)} />
                    <select value={ing.unit} onChange={e => updateIngredient(i, "unit", e.target.value)}
                      className="w-24 h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    {ingredients.length > 1 && (
                      <button onClick={() => removeIngredient(i)} className="text-red-500 hover:text-red-700 p-1">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={submitting}>{submitting ? "Saving..." : "Save Recipe"}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recipes List */}
      {recipes.length === 0 && !showForm ? (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <ChefHat className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-40" />
            <p className="text-muted-foreground">No recipes yet. Create one to track production costs.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {recipes.map(r => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{r.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Makes: <span className="font-medium text-foreground">{r.product.name}</span>
                      <span className="ml-2">× {r.yieldQty} per batch</span>
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Badge variant="secondary">{r._count.runs} runs</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Ingredients */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Ingredients</p>
                  <div className="space-y-1">
                    {r.ingredients.map(ing => (
                      <div key={ing.id} className="flex justify-between text-sm">
                        <span>{ing.product.name}</span>
                        <span className="text-muted-foreground">{ing.quantity} {ing.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {r.notes && <p className="text-xs text-muted-foreground italic">{r.notes}</p>}

                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="flex-1 gap-1" onClick={() => { setShowRunModal(r); setRunForm(EMPTY_RUN); setExtraCosts([{ ...EMPTY_EXTRA }]); }}>
                    <Play className="h-3.5 w-3.5" /> Run Production
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(r)}>Edit</Button>
                  <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(r.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Run Production Modal */}
      {showRunModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Play className="h-5 w-5" /> Run Production</CardTitle>
                <button onClick={() => setShowRunModal(null)} className="p-1 hover:bg-muted rounded"><X className="h-4 w-4" /></button>
              </div>
              <p className="text-sm text-muted-foreground">
                Recipe: <strong>{showRunModal.name}</strong> → {showRunModal.product.name}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Units to Produce *</label>
                <Input type="number" min="1" placeholder={`Must be multiple of ${showRunModal.yieldQty}`}
                  value={runForm.quantityProduced}
                  onChange={e => setRunForm(f => ({ ...f, quantityProduced: e.target.value }))} />
                <p className="text-xs text-muted-foreground">Yield: {showRunModal.yieldQty} units per batch</p>
              </div>

              {/* Extra costs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Additional Costs (optional)</label>
                  <Button size="sm" variant="ghost" className="h-7 text-xs"
                    onClick={() => setExtraCosts(e => [...e, { ...EMPTY_EXTRA }])}>
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
                {extraCosts.map((c, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Input placeholder="e.g. Labor" value={c.name}
                      onChange={e => setExtraCosts(p => p.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} />
                    <Input type="number" placeholder="Amount" className="w-32" value={c.amount}
                      onChange={e => setExtraCosts(p => p.map((x, idx) => idx === i ? { ...x, amount: e.target.value } : x))} />
                    {extraCosts.length > 1 && (
                      <button onClick={() => setExtraCosts(p => p.filter((_, idx) => idx !== i))} className="text-red-500 p-1">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Notes</label>
                <Input placeholder="Optional" value={runForm.notes}
                  onChange={e => setRunForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              {/* Ingredients needed preview */}
              <div className="rounded-lg bg-muted/40 p-3 text-sm">
                <p className="font-medium mb-1 text-xs uppercase text-muted-foreground">Will deduct from stock:</p>
                {showRunModal.ingredients.map(ing => {
                  const batches = Number(runForm.quantityProduced || 0) / showRunModal.yieldQty;
                  const needed = Number(ing.quantity) * batches;
                  return (
                    <div key={ing.id} className="flex justify-between">
                      <span>{ing.product.name}</span>
                      <span className="text-muted-foreground">{needed.toFixed(2)} {ing.unit}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowRunModal(null)}>Cancel</Button>
                <Button className="flex-1" onClick={handleRunProduction} disabled={running}>
                  {running ? "Running..." : "Confirm Production"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
