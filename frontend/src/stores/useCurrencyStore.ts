import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
  flag: string;
  locale: string;
  decimals: number;
}

export const EA_CURRENCIES: Record<string, CurrencyConfig> = {
  KES: { code: "KES", symbol: "KES", name: "Kenyan Shilling",       flag: "🇰🇪", locale: "en-KE", decimals: 2 },
  UGX: { code: "UGX", symbol: "UGX", name: "Ugandan Shilling",      flag: "🇺🇬", locale: "en-UG", decimals: 0 },
  TZS: { code: "TZS", symbol: "TZS", name: "Tanzanian Shilling",    flag: "🇹🇿", locale: "en-TZ", decimals: 0 },
  RWF: { code: "RWF", symbol: "RWF", name: "Rwandan Franc",         flag: "🇷🇼", locale: "rw-RW", decimals: 0 },
  ETB: { code: "ETB", symbol: "ETB", name: "Ethiopian Birr",        flag: "🇪🇹", locale: "am-ET", decimals: 2 },
  SOS: { code: "SOS", symbol: "SOS", name: "Somali Shilling",       flag: "🇸🇴", locale: "so-SO", decimals: 2 },
  BIF: { code: "BIF", symbol: "BIF", name: "Burundian Franc",       flag: "🇧🇮", locale: "fr-BI", decimals: 0 },
  SSP: { code: "SSP", symbol: "SSP", name: "South Sudanese Pound",  flag: "🇸🇸", locale: "en-SS", decimals: 2 },
  DJF: { code: "DJF", symbol: "DJF", name: "Djiboutian Franc",      flag: "🇩🇯", locale: "fr-DJ", decimals: 0 },
  ERN: { code: "ERN", symbol: "ERN", name: "Eritrean Nakfa",        flag: "🇪🇷", locale: "ti-ER", decimals: 2 },
};

interface CurrencyState {
  currency: CurrencyConfig;
  setCurrency: (code: string) => void;
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set) => ({
      currency: EA_CURRENCIES.TZS,
      setCurrency: (code: string) => {
        const cfg = EA_CURRENCIES[code];
        if (cfg) set({ currency: cfg });
      },
    }),
    { name: "pos-currency" }
  )
);

/** Format a number as currency using the currently selected currency.
 *  Safe to call outside React components (reads from Zustand state directly). */
export function formatAmount(n: number): string {
  const { currency } = useCurrencyStore.getState();
  return `${currency.symbol} ${n.toLocaleString(currency.locale, {
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  })}`;
}
