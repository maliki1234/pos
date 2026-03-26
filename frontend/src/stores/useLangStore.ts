import { create } from "zustand";
import { persist } from "zustand/middleware";

type Lang = "en" | "sw";

const translations: Record<Lang, Record<string, string>> = {
  en: {
    retail: "Retail", wholesale: "Wholesale", search_product: "Search product or scan barcode…",
    product: "Product", price: "Price", stock: "Stock", out_of_stock: "Out of stock",
    no_products: "No products found", search_hint: "Search for products above",
    order: "Order", clear_all: "Clear all", add_customer: "Add customer (optional)…",
    subtotal: "Subtotal", discount: "Discount", tax: "Tax", total: "Total",
    payment: "Payment", cash_received: "Cash received", change: "Change",
    split_payment: "Split payment (Cash + M-Pesa)", split_cash_mpesa: "Split: Cash + M-Pesa",
    mpesa_phone: "Customer M-Pesa phone", send_stk_push: "Send M-Pesa Request",
    enter_ref_manually: "Enter confirmation code manually", sending_push: "Sending request…",
    waiting_mpesa: "Waiting for M-Pesa payment…", prompt_sent: "Prompt sent to",
    expires_in: "Expires in", cancel_retry: "Cancel / Retry",
    mpesa_confirmed: "M-Pesa Confirmed", mpesa_failed: "Payment failed or cancelled",
    try_again: "Try again", card_ref: "Card / Terminal Reference",
    select_customer_credit: "Select a customer above first",
    offline_mpesa_note: "Offline — enter M-Pesa confirmation code instead",
    mpesa_not_configured: "M-Pesa not configured. Go to Settings to enable.",
    mpesa_ref_label: "M-Pesa confirmation code",
    owes: "owes", due_date: "Due Date", no_items: "No items yet",
    click_to_add: "Click products to add them", processing: "Processing…",
    charge: "Charge", offline: "Offline", cart_empty: "Cart is empty",
    credit_needs_customer: "Select a customer for credit payment",
    sale_complete: "Sale complete!", saved_offline: "Saved offline — will sync when online",
    credit_limit: "Credit limit", used: "used",
    whatsapp_receipt: "WhatsApp Receipt", print: "Print", save: "Save",
  },
  sw: {
    retail: "Rejareja", wholesale: "Jumla", search_product: "Tafuta bidhaa au skani barcode…",
    product: "Bidhaa", price: "Bei", stock: "Hisa", out_of_stock: "Hisa imekwisha",
    no_products: "Hakuna bidhaa zilizopatikana", search_hint: "Tafuta bidhaa hapo juu",
    order: "Agizo", clear_all: "Futa zote", add_customer: "Ongeza mteja (hiari)…",
    subtotal: "Jumla ndogo", discount: "Punguzo", tax: "Kodi", total: "Jumla",
    payment: "Malipo", cash_received: "Pesa zilizopokelewa", change: "Chenji",
    split_payment: "Gawanya malipo (Pesa + M-Pesa)", split_cash_mpesa: "Gawanya: Pesa + M-Pesa",
    mpesa_phone: "Nambari ya M-Pesa ya mteja", send_stk_push: "Tuma Ombi la M-Pesa",
    enter_ref_manually: "Ingiza nambari ya uthibitisho", sending_push: "Inatuma ombi…",
    waiting_mpesa: "Inasubiri malipo ya M-Pesa…", prompt_sent: "Ombi limetumwa kwa",
    expires_in: "Inaisha kwa", cancel_retry: "Ghairi / Jaribu tena",
    mpesa_confirmed: "M-Pesa Imethibitishwa", mpesa_failed: "Malipo yameshindwa au kughairiwa",
    try_again: "Jaribu tena", card_ref: "Nambari ya kadi / terminal",
    select_customer_credit: "Chagua mteja kwanza",
    offline_mpesa_note: "Nje ya mtandao — ingiza nambari ya uthibitisho wa M-Pesa",
    mpesa_not_configured: "M-Pesa haijasanidiwa. Nenda Mipangilio kuwezesha.",
    mpesa_ref_label: "Nambari ya uthibitisho wa M-Pesa",
    owes: "anadaiwa", due_date: "Tarehe ya malipo", no_items: "Hakuna bidhaa bado",
    click_to_add: "Bonyeza bidhaa kuziongeza", processing: "Inashughulikia…",
    charge: "Lipia", offline: "Nje ya mtandao", cart_empty: "Mkokoteni uko tupu",
    credit_needs_customer: "Chagua mteja kwa malipo ya mkopo",
    sale_complete: "Mauzo yamekamilika!", saved_offline: "Imehifadhiwa nje ya mtandao — itasawazishwa ukiunganika",
    credit_limit: "Kikomo cha mkopo", used: "iliyotumiwa",
    whatsapp_receipt: "Risiti ya WhatsApp", print: "Chapisha", save: "Hifadhi",
  },
};

interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

export const useLangStore = create<LangState>()(
  persist(
    (set, get) => ({
      lang: "en",
      setLang: (lang) => set({ lang }),
      t: (key) => translations[get().lang][key] ?? translations.en[key] ?? key,
    }),
    { name: "pos-language" }
  )
);
