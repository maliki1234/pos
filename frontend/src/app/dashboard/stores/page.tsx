"use client";

import React, { useEffect, useState } from "react";
import { useStoreStore, Store } from "@/stores/useStoreStore";
import { useSubscriptionStore } from "@/stores/useSubscriptionStore";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  Building2, Plus, Star, Users, ShoppingCart, Phone, MapPin, Pencil, Trash2,
  UserCog, Lock, ArrowRight,
} from "lucide-react";
import Link from "next/link";

const PLAN_STORE_LIMITS: Record<string, number | null> = {
  STARTER: 1,
  BUSINESS: 3,
  ENTERPRISE: null,
};

export default function StoresPage() {
  const { stores, loading, error, fetchStores, createStore, updateStore, deactivateStore } = useStoreStore();
  const { subscription } = useSubscriptionStore();
  const { user } = useAuthStore();

  const plan = subscription?.plan ?? "STARTER";
  const storeLimit = PLAN_STORE_LIMITS[plan];
  const atLimit = storeLimit !== null && stores.length >= storeLimit;
  const isAdmin = user?.role === "ADMIN";
  const isManager = user?.role === "MANAGER";
  const canManage = isAdmin || isManager;

  const [showCreate, setShowCreate] = useState(false);
  const [editStore, setEditStore] = useState<Store | null>(null);
  const [form, setForm] = useState({ name: "", address: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => { fetchStores(); }, [fetchStores]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setFormError("");
    try {
      if (editStore) {
        await updateStore(editStore.id, { name: form.name, address: form.address, phone: form.phone });
        setEditStore(null);
      } else {
        await createStore({ name: form.name, address: form.address, phone: form.phone });
        setShowCreate(false);
      }
      setForm({ name: "", address: "", phone: "" });
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (store: Store) => {
    setEditStore(store);
    setForm({ name: store.name, address: store.address ?? "", phone: store.phone ?? "" });
    setShowCreate(false);
  };

  const handleSetDefault = async (store: Store) => {
    try { await updateStore(store.id, { isDefault: true }); } catch {}
  };

  const handleDeactivate = async (store: Store) => {
    if (!confirm(`Deactivate "${store.name}"? Users assigned here will be unassigned.`)) return;
    try { await deactivateStore(store.id); } catch (err: any) { alert(err.message); }
  };

  const closeForm = () => { setShowCreate(false); setEditStore(null); setForm({ name: "", address: "", phone: "" }); setFormError(""); };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" /> Stores & Branches
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {plan} plan · {storeLimit === null ? "Unlimited stores" : `${stores.length} / ${storeLimit} store${storeLimit !== 1 ? "s" : ""}`}
          </p>
        </div>
        {canManage && (
          atLimit ? (
            <Link
              href="/dashboard/subscription"
              className="flex items-center gap-1.5 px-4 py-2 rounded-md border text-sm text-muted-foreground hover:bg-muted"
            >
              <Lock className="h-4 w-4" /> Upgrade to add more <ArrowRight className="h-3 w-3" />
            </Link>
          ) : (
            <button
              onClick={() => { setShowCreate(true); setEditStore(null); setForm({ name: "", address: "", phone: "" }); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Add Store
            </button>
          )
        )}
      </div>

      {/* Limit info banner */}
      {atLimit && canManage && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200 flex items-center justify-between">
          <span>
            You&apos;ve reached the <strong>{storeLimit}-store limit</strong> for the {plan} plan.
          </span>
          <Link href="/dashboard/subscription" className="font-semibold underline ml-2 whitespace-nowrap">
            Upgrade plan →
          </Link>
        </div>
      )}

      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

      {/* Create / Edit form */}
      {(showCreate || editStore) && (
        <div className="rounded-xl border bg-white dark:bg-slate-800 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold">{editStore ? `Edit "${editStore.name}"` : "New Store"}</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Store Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Nairobi CBD Branch"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Address</label>
                <input
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Street, City"
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Phone</label>
                <input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+254 7XX XXX XXX"
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={closeForm} className="px-4 py-2 rounded-md border text-sm hover:bg-muted">Cancel</button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? "Saving…" : editStore ? "Save Changes" : "Create Store"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Store list */}
      {loading ? (
        <div className="text-center text-muted-foreground py-12 text-sm">Loading stores…</div>
      ) : stores.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 text-sm">No stores yet.</div>
      ) : (
        <div className="space-y-3">
          {stores.map((store) => (
            <div key={store.id} className="rounded-xl border bg-white dark:bg-slate-800 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-base">{store.name}</h3>
                    {store.isDefault && (
                      <span className="inline-flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 px-2 py-0.5 rounded-full font-medium">
                        <Star className="h-3 w-3" /> Default
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {store.address && (
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{store.address}</span>
                    )}
                    {store.phone && (
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{store.phone}</span>
                    )}
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {store._count?.users ?? 0} staff</span>
                    <span className="flex items-center gap-1"><ShoppingCart className="h-3 w-3" /> {store._count?.transactions ?? 0} transactions</span>
                  </div>
                </div>

                {canManage && (
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    {!store.isDefault && (
                      <button
                        onClick={() => handleSetDefault(store)}
                        title="Set as default"
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                      >
                        <Star className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(store)}
                      title="Edit store"
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {isAdmin && (
                      <Link
                        href={`/dashboard/staff?store=${store.id}`}
                        title="Manage staff"
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                      >
                        <UserCog className="h-4 w-4" />
                      </Link>
                    )}
                    {!store.isDefault && isAdmin && (
                      <button
                        onClick={() => handleDeactivate(store)}
                        title="Deactivate store"
                        className="p-1.5 rounded hover:bg-muted text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
