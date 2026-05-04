"use client";

import React, { useEffect, useState } from "react";
import { Eye, EyeOff, Save, User } from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ProfilePage() {
  const { user, updateProfile } = useAuthStore();
  const [form, setForm] = useState({
    name: "",
    email: "",
    currentPassword: "",
    newPassword: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);

  useEffect(() => {
    if (user) {
      setForm((current) => ({
        ...current,
        name: user.name,
        email: user.email,
      }));
    }
  }, [user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const payload: {
        name?: string;
        email?: string;
        currentPassword?: string;
        newPassword?: string;
      } = {};

      if (form.name.trim() && form.name.trim() !== user?.name) payload.name = form.name.trim();
      if (form.email.trim() && form.email.trim() !== user?.email) payload.email = form.email.trim();
      if (form.newPassword) {
        payload.currentPassword = form.currentPassword;
        payload.newPassword = form.newPassword;
      }

      if (Object.keys(payload).length === 0) {
        setMessage("No changes to save.");
        return;
      }

      await updateProfile(payload);
      setForm((current) => ({ ...current, currentPassword: "", newPassword: "" }));
      setMessage("Profile updated successfully.");
    } catch (err: any) {
      setError(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
          <User className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Profile</h1>
          <p className="text-sm text-muted-foreground">{user.businessName} · {user.role}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Account Details</CardTitle>
          <CardDescription>Update your name, email, or password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="rounded-md border p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">Change Password</h2>
                  <p className="text-xs text-muted-foreground">Leave these fields empty if you only want to update your profile details.</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPasswords((value) => !value)}
                  title={showPasswords ? "Hide passwords" : "Show passwords"}
                >
                  {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type={showPasswords ? "text" : "password"}
                    value={form.currentPassword}
                    onChange={(event) => setForm((current) => ({ ...current, currentPassword: event.target.value }))}
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type={showPasswords ? "text" : "password"}
                    value={form.newPassword}
                    onChange={(event) => setForm((current) => ({ ...current, newPassword: event.target.value }))}
                    minLength={6}
                  />
                </div>
              </div>
            </div>

            {message && <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">{message}</div>}
            {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

            <Button type="submit" disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
