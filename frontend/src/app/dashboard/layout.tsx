"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/useAuthStore";
import { useSyncStore } from "@/stores/useSyncStore";
import { useStockStore } from "@/stores/useStockStore";
import { useStoreStore } from "@/stores/useStoreStore";
import { useSubscriptionStore } from "@/stores/useSubscriptionStore";
import { CurrencySelector } from "@/components/CurrencySelector";
import { LogOut, Lock, ShieldCheck, X, Languages, ChefHat, Barcode, ArrowLeftRight } from "lucide-react";
import { useLangStore } from "@/stores/useLangStore";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ThemeToggle";
import { OfflinePinModal } from "@/components/OfflinePinModal";
import { SetPinModal } from "@/components/SetPinModal";
import { OfflineStatus } from "@/components/OfflineStatus";

interface NavProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: NavProps) {
  const router = useRouter();
  const { user, logout, isAuthenticated, isPinLocked, hasPinSet, showReauthBanner, dismissReauthBanner, isLoading } = useAuthStore();
  const { initializeSync } = useSyncStore();
  const [showSetPin, setShowSetPin] = useState(false);
  const { lowStockCount, fetchLowStockProducts } = useStockStore();
  const { subscription, fetchCurrent: fetchSubscription } = useSubscriptionStore();
  const { stores, fetchStores } = useStoreStore();
  const { lang, setLang } = useLangStore();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isPinLocked) {
      router.push("/");
    }
  }, [isLoading, isAuthenticated, isPinLocked, router]);

  useEffect(() => {
    initializeSync();
    fetchLowStockProducts();
    fetchSubscription();
    fetchStores();
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  if (isLoading) return null;
  if (!isAuthenticated && !isPinLocked) return null;
  if (!user) return null;

  const isCashier = user.role === "CASHIER";
  const isAdmin = user.role === "ADMIN";
  const isManager = user.role === "MANAGER";
  const isAdminOrManager = isAdmin || isManager;

  const plan = subscription?.plan ?? "STARTER";
  const hasBusiness = plan === "BUSINESS" || plan === "ENTERPRISE";
  const hasEnterprise = plan === "ENTERPRISE";

  const PLAN_COLORS: Record<string, string> = {
    STARTER: "bg-gray-100 text-gray-600",
    BUSINESS: "bg-blue-100 text-blue-700",
    ENTERPRISE: "bg-purple-100 text-purple-700",
  };

  return (
    <div className="flex h-screen bg-background">
      {isPinLocked && <OfflinePinModal />}
      {showSetPin && <SetPinModal onClose={() => setShowSetPin(false)} />}
      {/* Sidebar */}
      <div className="w-64 border-r bg-card shadow-sm flex flex-col">
        <div className="px-6 py-5">
          <h1 className="text-xl font-bold text-primary truncate">{user.businessName || "POS System"}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground truncate">{user.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-medium text-muted-foreground uppercase">{user.role}</span>
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${PLAN_COLORS[plan]}`}>{plan}</span>
          </div>
        </div>

        <nav className="space-y-1 px-4 py-4 flex-1 overflow-y-auto">
          {isCashier && (
            <>
              <Link
                href="/dashboard/cashier"
                className="block rounded-lg px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                Point of Sale
              </Link>
              <Link
                href="/dashboard/transactions"
                className="block rounded-lg px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                My Transactions
              </Link>
              <Link
                href="/dashboard/reconciliation"
                className="block rounded-lg px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                End of Day
              </Link>
            </>
          )}

          {isAdminOrManager && (
            <>
              <Link
                href="/dashboard/cashier"
                className="block rounded-lg px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                Point of Sale
              </Link>
              <Link
                href="/dashboard/products"
                className="block rounded-lg px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                Products
              </Link>
              <Link
                href="/dashboard/categories"
                className="block rounded-lg px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                Categories
              </Link>
              <Link
                href="/dashboard/recipes"
                className="block rounded-lg px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2"
              >
                <ChefHat className="h-4 w-4" /> Recipes
              </Link>
              <Link
                href="/dashboard/barcodes"
                className="block rounded-lg px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2"
              >
                <Barcode className="h-4 w-4" /> Barcodes
              </Link>
              <Link
                href="/dashboard/conversions"
                className="block rounded-lg px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2"
              >
                <ArrowLeftRight className="h-4 w-4" /> Conversions
              </Link>
              <Link
                href="/dashboard/stock"
                className="block rounded-lg px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between"
              >
                <span>Stock</span>
                {lowStockCount > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-orange-500 text-white text-xs font-bold">
                    {lowStockCount}
                  </span>
                )}
              </Link>
              <Link
                href="/dashboard/customers"
                className="block rounded-lg px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                Customers
              </Link>
              <Link
                href="/dashboard/transactions"
                className="block rounded-lg px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                All Transactions
              </Link>
              <Link
                href="/dashboard/credit"
                className="flex items-center justify-between rounded-lg px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <span>Credit Ledger</span>
                {!hasBusiness && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Link>
              <Link
                href="/dashboard/analytics"
                className="flex items-center justify-between rounded-lg px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <span>Analytics</span>
                {!hasBusiness && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Link>
              <Link
                href="/dashboard/reconciliation"
                className="flex items-center justify-between rounded-lg px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <span>End of Day</span>
                {!hasEnterprise && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Link>
              <Link
                href="/dashboard/reports"
                className="block rounded-lg px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                Reports
              </Link>
            </>
          )}

          {isAdminOrManager && (
            <>
              <Link
                href="/dashboard/stores"
                className="flex items-center justify-between rounded-lg px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <span>Stores</span>
                {stores.length > 0 && (
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-medium text-muted-foreground">
                    {stores.length}
                  </span>
                )}
              </Link>
            </>
          )}

          {isAdmin && (
            <>
              <Link
                href="/dashboard/staff"
                className="block rounded-lg px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                Staff
              </Link>
              <Link
                href="/dashboard/settings"
                className="block rounded-lg px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                Settings
              </Link>
              <Link
                href="/dashboard/subscription"
                className="block rounded-lg px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                Subscription
              </Link>
            </>
          )}
        </nav>

        {isAdmin && plan === "STARTER" && (
          <div className="mx-4 mb-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-xs">
            <p className="font-semibold text-blue-700 dark:text-blue-300">Unlock Premium Features</p>
            <p className="text-blue-600 dark:text-blue-400 mt-0.5">Analytics, credit ledger & loyalty points on BUSINESS plan.</p>
            <Link href="/dashboard/subscription" className="mt-2 block text-center py-1 rounded bg-blue-600 text-white hover:bg-blue-700 font-medium">
              Upgrade Plan
            </Link>
          </div>
        )}

        <Separator />

        <div className="px-4 py-4">
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start gap-2 text-destructive hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Reauth banner */}
        {showReauthBanner && (
          <div className="flex items-center justify-between gap-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-6 py-2.5 text-sm text-amber-800 dark:text-amber-300">
            <span>Your session expired while offline. <strong>Log in again</strong> to keep syncing transactions to the server.</span>
            <div className="flex items-center gap-2 shrink-0">
              <a href="/" className="px-3 py-1 rounded-md bg-amber-600 text-white text-xs font-medium hover:bg-amber-700">Log in</a>
              <button onClick={dismissReauthBanner} className="p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Top Bar */}
        <div className="border-b bg-card px-8 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Dashboard</h2>
          <div className="flex items-center gap-4">
            {/* Set Offline PIN button */}
            <button
              onClick={() => setShowSetPin(true)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors
                ${hasPinSet
                  ? "border-green-200 bg-green-50 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400"
                  : "border-border hover:bg-muted text-muted-foreground hover:text-foreground"}`}
              title={hasPinSet ? "Offline PIN is set" : "Set an offline PIN to keep working beyond 7 days offline"}
            >
              {hasPinSet ? <ShieldCheck className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
              {hasPinSet ? "PIN Set" : "Set PIN"}
            </button>

            <CurrencySelector />
            <button
              onClick={() => setLang(lang === "en" ? "sw" : "en")}
              title={lang === "en" ? "Switch to Swahili" : "Badilisha kwa Kiingereza"}
              className="flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium hover:bg-accent transition-colors"
            >
              <Languages className="h-3.5 w-3.5" />
              {lang === "en" ? "SW" : "EN"}
            </button>
            <ThemeToggle />

            <OfflineStatus />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
