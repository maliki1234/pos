"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useStoreStore } from "@/stores/useStoreStore";
import { useSubscriptionStore } from "@/stores/useSubscriptionStore";
import { Users, Plus, Lock, ArrowRight, UserCheck, Building2 } from "lucide-react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL;

const PLAN_USER_LIMITS: Record<string, number | null> = {
  STARTER: 3,
  BUSINESS: null,
  ENTERPRISE: null,
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN:   "bg-secondary text-secondary-foreground",
  MANAGER: "bg-primary/10 text-primary",
  CASHIER: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  storeId?: string | null;
  store?: { id: string; name: string } | null;
}

export default function StaffPage() {
  const { token, user } = useAuthStore();
  const { stores, fetchStores } = useStoreStore();
  const { subscription } = useSubscriptionStore();

  const plan = subscription?.plan ?? "STARTER";
  const userLimit = PLAN_USER_LIMITS[plan];
  const isAdmin = user?.role === "ADMIN";

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "CASHIER", storeId: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [assigningUser, setAssigningUser] = useState<StaffMember | null>(null);
  const [assignStoreId, setAssignStoreId] = useState("");
  const [assigning, setAssigning] = useState(false);

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  const loadStaff = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/staff`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setStaff(data.data ?? []);
      }
    } catch { setError("Failed to load staff"); }
    setLoading(false);
  }, [authHeaders]);

  useEffect(() => {
    loadStaff();
    fetchStores();
  }, [loadStaff, fetchStores]);

  const atLimit = userLimit !== null && staff.length >= userLimit;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          storeId: form.storeId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to add staff");
      setShowAdd(false);
      setForm({ name: "", email: "", password: "", role: "CASHIER", storeId: "" });
      loadStaff();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async () => {
    if (!assigningUser) return;
    setAssigning(true);
    try {
      const { assignUser } = useStoreStore.getState();
      await assignUser(assigningUser.id, assignStoreId || null);
      setAssigningUser(null);
      loadStaff();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" /> Staff Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {plan} plan · {userLimit === null ? "Unlimited staff" : `${staff.length} / ${userLimit} accounts`}
          </p>
        </div>
        {isAdmin && (
          atLimit ? (
            <Link href="/dashboard/subscription" className="flex items-center gap-1.5 px-4 py-2 rounded-md border text-sm text-muted-foreground hover:bg-muted">
              <Lock className="h-4 w-4" /> Upgrade for more <ArrowRight className="h-3 w-3" />
            </Link>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Add Staff
            </button>
          )
        )}
      </div>

      {atLimit && isAdmin && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200 flex items-center justify-between">
          <span>You&apos;ve reached the <strong>{userLimit}-user limit</strong> for the {plan} plan.</span>
          <Link href="/dashboard/subscription" className="font-semibold underline ml-2">Upgrade plan →</Link>
        </div>
      )}

      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

      {/* Add staff form */}
      {showAdd && (
        <div className="rounded-lg border bg-card p-5 text-card-foreground shadow-sm space-y-4">
          <h2 className="font-semibold">Add Staff Member</h2>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" required />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Email *</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" required />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Password *</label>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" required minLength={6} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="CASHIER">Cashier</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Assign to Store</label>
                <select value={form.storeId} onChange={e => setForm(f => ({ ...f, storeId: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">— Any store —</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setShowAdd(false); setFormError(""); }}
                className="px-4 py-2 rounded-md border text-sm hover:bg-muted">Cancel</button>
              <button type="submit" disabled={saving}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                {saving ? "Adding…" : "Add Staff"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Assign to store dialog */}
      {assigningUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="w-full max-w-sm space-y-4 rounded-lg bg-card p-6 text-card-foreground shadow-2xl">
            <h2 className="font-semibold">Assign {assigningUser.name} to Store</h2>
            <select
              value={assignStoreId}
              onChange={e => setAssignStoreId(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">— No specific store —</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAssigningUser(null)} className="px-4 py-2 rounded-md border text-sm hover:bg-muted">Cancel</button>
              <button onClick={handleAssign} disabled={assigning}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                {assigning ? "Saving…" : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staff list */}
      {loading ? (
        <div className="text-center text-muted-foreground py-12 text-sm">Loading staff…</div>
      ) : (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm divide-y">
          {staff.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No staff members yet.</div>
          ) : staff.map(s => (
            <div key={s.id} className="px-5 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-sm">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.email}</p>
                {s.store && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <Building2 className="h-3 w-3" /> {s.store.name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${ROLE_COLORS[s.role]}`}>{s.role}</span>
                {!s.isActive && <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-600">Inactive</span>}
                {isAdmin && (
                  <button
                    onClick={() => { setAssigningUser(s); setAssignStoreId(s.storeId ?? ""); }}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                    title="Assign to store"
                  >
                    <UserCheck className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
