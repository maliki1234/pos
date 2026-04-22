"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/useAuthStore";
import { useSyncStore } from "@/stores/useSyncStore";
import { useStockStore } from "@/stores/useStockStore";
import { useStoreStore } from "@/stores/useStoreStore";
import { useSubscriptionStore } from "@/stores/useSubscriptionStore";
import { CurrencySelector } from "@/components/CurrencySelector";
import {
  ArrowLeftRight,
  Barcode,
  BarChart3,
  ChefHat,
  ClipboardList,
  CreditCard,
  Languages,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  Settings,
  ShieldCheck,
  Store,
  Tags,
  UserCog,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { useLangStore } from "@/stores/useLangStore";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ThemeToggle";
import { OfflinePinModal } from "@/components/OfflinePinModal";
import { SetPinModal } from "@/components/SetPinModal";
import { OfflineStatus } from "@/components/OfflineStatus";
import { cn } from "@/lib/utils";

interface NavProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: NavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, isAuthenticated, isPinLocked, hasPinSet, showReauthBanner, dismissReauthBanner, isLoading } = useAuthStore();
  const { initializeSync } = useSyncStore();
  const [showSetPin, setShowSetPin] = useState(false);
  const { lowStockCount, fetchLowStockProducts } = useStockStore();
  const { subscription, fetchCurrent: fetchSubscription } = useSubscriptionStore();
  const { stores, fetchStores } = useStoreStore();
  const { lang, setLang } = useLangStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    STARTER: "bg-muted text-muted-foreground",
    BUSINESS: "bg-primary/10 text-primary",
    ENTERPRISE: "bg-secondary text-secondary-foreground",
  };

  const NavItem = ({
    href,
    icon: Icon,
    children: label,
    locked,
    badge,
  }: {
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
    locked?: boolean;
    badge?: React.ReactNode;
  }) => {
    const isActive = href === "/dashboard"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        href={href}
        className={cn(
          "flex min-h-10 items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
      >
        <span className="flex min-w-0 items-center gap-3">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </span>
        {badge ?? (locked ? <Lock className="h-3.5 w-3.5 shrink-0 opacity-70" /> : null)}
      </Link>
    );
  };

  const NavGroup = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="space-y-1">
      <p className="px-3 pt-3 text-[11px] font-semibold uppercase text-muted-foreground">{title}</p>
      {children}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background lg:h-screen">
      {isPinLocked && <OfflinePinModal />}
      {showSetPin && <SetPinModal onClose={() => setShowSetPin(false)} />}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r bg-card shadow-xl transition-transform duration-200 lg:static lg:z-auto lg:w-64 lg:translate-x-0 lg:shadow-sm ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b px-5 py-5 lg:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-foreground">{user.businessName || "Logan POS"}</h1>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{user.name}</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs font-medium uppercase text-muted-foreground">{user.role}</span>
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${PLAN_COLORS[plan]}`}>{plan}</span>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close navigation"
            className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav
          className="flex-1 space-y-4 overflow-y-auto px-3 py-4"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) setSidebarOpen(false);
          }}
        >
          {isCashier && (
            <NavGroup title="Sales">
              <NavItem href="/dashboard/cashier" icon={ReceiptText}>Point of Sale</NavItem>
              <NavItem href="/dashboard/transactions" icon={ClipboardList}>My Transactions</NavItem>
              <NavItem href="/dashboard/reconciliation" icon={ShieldCheck}>End of Day</NavItem>
            </NavGroup>
          )}

          {isAdminOrManager && (
            <>
              <NavGroup title="Sales">
                <NavItem href="/dashboard" icon={LayoutDashboard}>Dashboard</NavItem>
                <NavItem href="/dashboard/cashier" icon={ReceiptText}>Point of Sale</NavItem>
                <NavItem href="/dashboard/transactions" icon={ClipboardList}>All Transactions</NavItem>
                <NavItem href="/dashboard/reconciliation" icon={ShieldCheck} locked={!hasEnterprise}>End of Day</NavItem>
              </NavGroup>

              <NavGroup title="Inventory">
                <NavItem href="/dashboard/products" icon={Package}>Products</NavItem>
                <NavItem href="/dashboard/categories" icon={Tags}>Categories</NavItem>
                <NavItem href="/dashboard/stock" icon={Package} badge={lowStockCount > 0 ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-xs font-bold text-white">
                    {lowStockCount}
                  </span>
                ) : null}>Stock</NavItem>
                <NavItem href="/dashboard/recipes" icon={ChefHat}>Recipes</NavItem>
                <NavItem href="/dashboard/barcodes" icon={Barcode}>Barcodes</NavItem>
                <NavItem href="/dashboard/conversions" icon={ArrowLeftRight}>Conversions</NavItem>
              </NavGroup>

              <NavGroup title="Business">
                <NavItem href="/dashboard/customers" icon={Users}>Customers</NavItem>
                <NavItem href="/dashboard/credit" icon={CreditCard} locked={!hasBusiness}>Credit Ledger</NavItem>
                <NavItem href="/dashboard/expenses" icon={WalletCards}>Running Costs</NavItem>
                <NavItem href="/dashboard/analytics" icon={BarChart3} locked={!hasBusiness}>Analytics</NavItem>
                <NavItem href="/dashboard/reports" icon={ClipboardList}>Reports</NavItem>
              </NavGroup>
            </>
          )}

          {isAdminOrManager && (
            <NavGroup title="Operations">
              <NavItem href="/dashboard/stores" icon={Store} badge={stores.length > 0 ? (
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {stores.length}
                </span>
              ) : null}>Stores</NavItem>
            </NavGroup>
          )}

          {isAdmin && (
            <NavGroup title="Admin">
              <NavItem href="/dashboard/staff" icon={UserCog}>Staff</NavItem>
              <NavItem href="/dashboard/settings" icon={Settings}>Settings</NavItem>
              <NavItem href="/dashboard/subscription" icon={CreditCard}>Subscription</NavItem>
            </NavGroup>
          )}
        </nav>

        {isAdmin && plan === "STARTER" && (
          <div className="mx-4 mb-3 rounded-md border border-primary/20 bg-primary/10 p-3 text-xs">
            <p className="font-semibold text-primary">Unlock Premium Features</p>
            <p className="mt-0.5 text-muted-foreground">Analytics, credit ledger & loyalty points on BUSINESS plan.</p>
            <Link href="/dashboard/subscription" className="mt-2 block rounded bg-primary py-1 text-center font-medium text-primary-foreground hover:bg-primary/90">
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
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Reauth banner */}
        {showReauthBanner && (
          <div className="flex flex-col gap-3 border-b border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300 sm:flex-row sm:items-center sm:justify-between sm:px-6">
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
        <div className="border-b bg-card px-3 py-3 sm:px-4 lg:px-8 lg:py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Open navigation"
                className="rounded-md border p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </button>
              <h2 className="text-lg font-semibold sm:text-xl">Dashboard</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:gap-4">
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
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-3 sm:p-4 lg:p-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
