"use client";
import { useEffect, useState } from "react";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { toast } from "react-toastify";
import { Settings, Smartphone, Receipt, Save, Eye, EyeOff, Zap } from "lucide-react";

export default function SettingsPage() {
  const { settings, isLoading, fetchSettings, updateSettings } = useSettingsStore();
  const [saving, setSaving] = useState(false);
  const [showMpesaKey, setShowMpesaKey] = useState(false);
  const [showMpesaSecret, setShowMpesaSecret] = useState(false);
  const [showPasskey, setShowPasskey] = useState(false);
  const [showAzampaySecret, setShowAzampaySecret] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: "", email: "", phone: "", address: "", country: "TZ", currency: "TZS",
    etimsEnabled: false, etimsPin: "", etimsBhfId: "",
    mpesaEnabled: false, mpesaShortcode: "", mpesaConsumerKey: "", mpesaConsumerSecret: "",
    mpesaPasskey: "", mpesaCallbackUrl: "",
    azampayEnabled: false, azampayAppName: "", azampayClientId: "", azampayClientSecret: "",
    azampayCallbackUrl: "",
  });

  useEffect(() => { fetchSettings(); }, []);

  useEffect(() => {
    if (settings) {
      setForm(f => ({
        ...f,
        name:            settings.name ?? "",
        email:           settings.email ?? "",
        phone:           settings.phone ?? "",
        address:         settings.address ?? "",
        country:         settings.country ?? "KE",
        currency:        settings.currency ?? "KES",
        etimsEnabled:    settings.etimsEnabled,
        etimsPin:        settings.etimsPin ?? "",
        etimsBhfId:      settings.etimsBhfId ?? "",
        mpesaEnabled:    settings.mpesaEnabled,
        mpesaShortcode:  settings.mpesaShortcode ?? "",
        mpesaCallbackUrl: settings.mpesaCallbackUrl ?? "",
        // Don't prefill secret fields (masked)
        azampayEnabled:      settings.azampayEnabled,
        azampayAppName:      settings.azampayAppName ?? "",
        azampayClientId:     settings.azampayClientId ?? "",
        azampayCallbackUrl:  settings.azampayCallbackUrl ?? "",
        // Don't prefill azampayClientSecret (secret)
      }));
    }
  }, [settings]);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings(form);
      await fetchSettings();
      toast.success("Settings saved");
    } catch (err: any) {
      toast.error(err.message);
    } finally { setSaving(false); }
  };

  if (isLoading && !settings) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Loading…</div>;
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Business profile, tax compliance, and payment integrations</p>
      </div>

      {/* ── Business Profile ── */}
      <section className="rounded-xl border p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Settings className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Business Profile</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Business Name" value={form.name} onChange={v => set("name", v)} />
          <Field label="Email" value={form.email} onChange={v => set("email", v)} />
          <Field label="Phone" value={form.phone} onChange={v => set("phone", v)} />
          <Field label="Country" value={form.country} onChange={v => set("country", v)} />
          <Field label="Currency Code" value={form.currency} onChange={v => set("currency", v)} placeholder="e.g. KES" />
          <Field label="Address" value={form.address} onChange={v => set("address", v)} />
        </div>
      </section>

      {/* ── eTIMS ── */}
      <section className="rounded-xl border p-6 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">KRA eTIMS (Kenya)</h2>
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Optional</span>
          </div>
          <Toggle enabled={form.etimsEnabled} onChange={v => set("etimsEnabled", v)} />
        </div>
        <p className="text-sm text-muted-foreground">
          When enabled, every sale receipt is transmitted to KRA in real time. Required for VAT-registered businesses in Kenya.
        </p>
        {form.etimsEnabled && (
          <div className="grid grid-cols-2 gap-4 pt-2">
            <Field label="KRA PIN" value={form.etimsPin} onChange={v => set("etimsPin", v)} placeholder="A123456789B" />
            <Field label="Branch ID (bhfId)" value={form.etimsBhfId} onChange={v => set("etimsBhfId", v)} placeholder="00" />
          </div>
        )}
      </section>

      {/* ── M-Pesa ── */}
      <section className="rounded-xl border p-6 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-green-600" />
            <h2 className="text-lg font-semibold">M-Pesa Daraja</h2>
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Optional</span>
          </div>
          <Toggle enabled={form.mpesaEnabled} onChange={v => set("mpesaEnabled", v)} />
        </div>
        <p className="text-sm text-muted-foreground">
          Enables STK Push — customers receive a payment prompt on their phone. Requires a Safaricom Daraja API account.
          Use shortcode <strong>174379</strong> for sandbox testing.
        </p>
        {form.mpesaEnabled && (
          <div className="grid grid-cols-2 gap-4 pt-2">
            <Field label="Business Shortcode / Till No." value={form.mpesaShortcode} onChange={v => set("mpesaShortcode", v)} placeholder="174379" />
            <Field label="Callback URL" value={form.mpesaCallbackUrl} onChange={v => set("mpesaCallbackUrl", v)} placeholder="https://yourdomain.com/api/v1/payments/mpesa/callback" />
            <SecretField
              label="Consumer Key"
              value={form.mpesaConsumerKey}
              onChange={v => set("mpesaConsumerKey", v)}
              show={showMpesaKey}
              onToggle={() => setShowMpesaKey(s => !s)}
              placeholder={settings?.mpesaConsumerKeySet ? "Already set (enter to replace)" : "Daraja consumer key"}
            />
            <SecretField
              label="Consumer Secret"
              value={form.mpesaConsumerSecret}
              onChange={v => set("mpesaConsumerSecret", v)}
              show={showMpesaSecret}
              onToggle={() => setShowMpesaSecret(s => !s)}
              placeholder="Daraja consumer secret"
            />
            <SecretField
              label="Lipa Na M-Pesa Passkey"
              value={form.mpesaPasskey}
              onChange={v => set("mpesaPasskey", v)}
              show={showPasskey}
              onToggle={() => setShowPasskey(s => !s)}
              placeholder={settings?.mpesaPasskeySet ? "Already set (enter to replace)" : "Daraja passkey"}
            />
          </div>
        )}
      </section>

      {/* ── Azampay ── */}
      <section className="rounded-xl border p-6 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            <h2 className="text-lg font-semibold">Azampay (Tanzania)</h2>
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Optional</span>
          </div>
          <Toggle enabled={form.azampayEnabled} onChange={v => set("azampayEnabled", v)} />
        </div>
        <p className="text-sm text-muted-foreground">
          Enables mobile money payments via M-Pesa TZ (Azampesa), Airtel, Tigo, and Halopesa through a single integration.
          Register at <strong>azampay.co.tz</strong> to get your credentials.
        </p>
        {form.azampayEnabled && (
          <div className="grid grid-cols-2 gap-4 pt-2">
            <Field label="App Name" value={form.azampayAppName} onChange={v => set("azampayAppName", v)} placeholder="Your registered app name" />
            <Field label="Callback URL" value={form.azampayCallbackUrl} onChange={v => set("azampayCallbackUrl", v)} placeholder="https://yourdomain.com/api/v1/payments/azampay/callback" />
            <Field label="Client ID" value={form.azampayClientId} onChange={v => set("azampayClientId", v)} placeholder="sandbox-... or production client ID" />
            <SecretField
              label="Client Secret"
              value={form.azampayClientSecret}
              onChange={v => set("azampayClientSecret", v)}
              show={showAzampaySecret}
              onToggle={() => setShowAzampaySecret(s => !s)}
              placeholder="Azampay client secret"
            />
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}

function SecretField({ label, value, onChange, show, onToggle, placeholder }: { label: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full border rounded-lg px-3 py-2 pr-9 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button type="button" onClick={onToggle} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? "bg-primary" : "bg-muted"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}
