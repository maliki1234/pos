"use client";

import { useCurrencyStore, EA_CURRENCIES } from "@/stores/useCurrencyStore";

export function CurrencySelector() {
  const { currency, setCurrency } = useCurrencyStore();

  return (
    <div className="flex items-center gap-1">
      <span className="text-sm">{currency.flag}</span>
      <select
        value={currency.code}
        onChange={(e) => setCurrency(e.target.value)}
        className="text-sm border rounded-md px-2 py-1 bg-background focus:outline-none focus:ring-2 focus:ring-primary h-8"
        title="Select currency"
      >
        {Object.values(EA_CURRENCIES).map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.code} — {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
