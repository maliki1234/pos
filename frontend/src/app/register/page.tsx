"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/useAuthStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/ThemeToggle";

const CURRENCIES = [
  { code: "KES", label: "KES — Kenyan Shilling" },
  { code: "UGX", label: "UGX — Ugandan Shilling" },
  { code: "TZS", label: "TZS — Tanzanian Shilling" },
  { code: "RWF", label: "RWF — Rwandan Franc" },
  { code: "ETB", label: "ETB — Ethiopian Birr" },
  { code: "USD", label: "USD — US Dollar" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "EUR", label: "EUR — Euro" },
];

const COUNTRIES = [
  "Kenya", "Uganda", "Tanzania", "Rwanda", "Ethiopia",
  "Nigeria", "Ghana", "South Africa", "Other",
];

export default function RegisterPage() {
  const router = useRouter();
  const { registerBusiness, isLoading, error, isAuthenticated } = useAuthStore();

  const [form, setForm] = useState({
    businessName: "",
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    country: "",
    currency: "KES",
  });
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");

    if (!form.businessName || !form.name || !form.email || !form.password) {
      setLocalError("All required fields must be filled.");
      return;
    }
    if (form.password.length < 6) {
      setLocalError("Password must be at least 6 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }

    try {
      await registerBusiness(
        form.businessName,
        form.email,
        form.password,
        form.name,
        form.country || undefined,
        form.currency || undefined
      );
      router.push("/dashboard");
    } catch (err: any) {
      setLocalError(err.message || "Registration failed");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-lg">
        <Card className="border shadow-lg">
          <CardHeader className="rounded-t-lg border-b bg-primary text-primary-foreground">
            <CardTitle className="text-2xl">Register Your Business</CardTitle>
            <CardDescription className="text-primary-foreground/80">
              Create your POS account — free STARTER plan, upgrade anytime
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Business Info */}
              <div className="space-y-1">
                <Label htmlFor="businessName">Business Name *</Label>
                <Input
                  id="businessName"
                  value={form.businessName}
                  onChange={set("businessName")}
                  placeholder="Acme Shop Ltd"
                  disabled={isLoading}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="country">Country</Label>
                  <select
                    id="country"
                    value={form.country}
                    onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
                    disabled={isLoading}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select country</option>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="currency">Currency</Label>
                  <select
                    id="currency"
                    value={form.currency}
                    onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
                    disabled={isLoading}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Owner Info */}
              <hr className="my-2" />
              <p className="text-sm font-medium text-muted-foreground">Admin Account</p>

              <div className="space-y-1">
                <Label htmlFor="name">Your Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={set("name")}
                  placeholder="Jane Doe"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  placeholder="jane@acmeshop.com"
                  disabled={isLoading}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={set("password")}
                    placeholder="••••••••"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="confirmPassword">Confirm *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={form.confirmPassword}
                    onChange={set("confirmPassword")}
                    placeholder="••••••••"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {(error || localError) && (
                <Alert variant="destructive">
                  <AlertDescription>{error || localError}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11"
                size="lg"
              >
                {isLoading ? "Creating account..." : "Create Business Account"}
              </Button>
            </form>

            <div className="mt-4 border-t pt-4 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/" className="font-medium text-primary hover:underline">
                Sign in
              </Link>
            </div>

            {/* Plan comparison */}
            <div className="mt-4 rounded-lg bg-muted p-4 text-xs space-y-1">
              <p className="font-semibold text-sm mb-2">Free STARTER plan includes:</p>
              <p>✓ Unlimited transactions &amp; products</p>
              <p>✓ Multiple cashiers &amp; managers</p>
              <p>✓ Offline-first (works without internet)</p>
              <p>✓ Stock management with reorder alerts</p>
              <p className="text-muted-foreground mt-2 pt-2 border-t">
                Upgrade to <strong>BUSINESS</strong> for analytics, credit ledger &amp; loyalty points.
                Upgrade to <strong>ENTERPRISE</strong> for profit reports, staff performance &amp; end-of-day reconciliation.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
