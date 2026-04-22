"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Printer, Download, MessageCircle, X } from "lucide-react";
import { useCurrencyStore } from "@/stores/useCurrencyStore";
import { useLangStore } from "@/stores/useLangStore";
import { useSettingsStore } from "@/stores/useSettingsStore";

interface ReceiptItem {
  productId: number;
  productName?: string;
  quantity: number;
  price: number;
  discount?: number;
}

interface ReceiptProps {
  items: ReceiptItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: string;
  pricingType: string;
  transactionId?: string;
  customerName?: string;
  customerPhone?: string;
  onClose?: () => void;
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Cash", CARD: "Card", MOBILE_MONEY: "M-Pesa",
  CHEQUE: "Cheque", BANK_TRANSFER: "Bank Transfer", CREDIT: "Credit",
};

export const Receipt: React.FC<ReceiptProps> = ({
  items, subtotal, discountAmount, taxAmount, totalAmount,
  paymentMethod, transactionId, customerName, customerPhone, onClose,
}) => {
  const { currency } = useCurrencyStore();
  const { t } = useLangStore();
  const { settings } = useSettingsStore();
  const [waPhone, setWaPhone] = useState(customerPhone ?? "");

  const businessName = settings?.name || "Logan POS";
  const businessPhone = settings?.phone || "";

  const fmt = (n: number) =>
    `${currency.symbol}${Number(n).toLocaleString("en-KE", {
      minimumFractionDigits: currency.decimals,
      maximumFractionDigits: currency.decimals,
    })}`;

  const receiptText = () => {
    const now = new Date().toLocaleString();
    return [
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      `        ${businessName.toUpperCase()}`,
      businessPhone ? `        Tel: ${businessPhone}` : "",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      customerName ? `Customer: ${customerName}` : "",
      `Date: ${now}`,
      transactionId ? `Ref: ${transactionId}` : "",
      "──────────────────────────────",
      ...items.map(i => `${i.productName || "Item"} x${i.quantity}   ${fmt(Number(i.price) * i.quantity)}`),
      "──────────────────────────────",
      `Subtotal:      ${fmt(Number(subtotal))}`,
      discountAmount > 0 ? `Discount:     -${fmt(Number(discountAmount))}` : "",
      `Tax (10%):     ${fmt(Number(taxAmount))}`,
      `TOTAL:         ${fmt(Number(totalAmount))}`,
      "──────────────────────────────",
      `Payment: ${PAYMENT_LABELS[paymentMethod] ?? paymentMethod}`,
      "",
      "   Thank you for your business!",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    ].filter(Boolean).join("\n");
  };

  const handlePrint = () => {
    const text = receiptText();
    const win = window.open("", "", "height=700,width=420");
    if (win) {
      win.document.write(`
        <html><head><title>Receipt</title>
        <style>
          body { font-family: 'Courier New', monospace; padding: 16px; max-width: 380px; font-size: 13px; }
          pre { white-space: pre-wrap; }
        </style></head>
        <body><pre>${text}</pre></body></html>
      `);
      win.document.close();
      win.print();
    }
  };

  const handleDownload = () => {
    const text = receiptText();
    const el = document.createElement("a");
    el.href = "data:text/plain;charset=utf-8," + encodeURIComponent(text);
    el.download = `receipt_${transactionId || Date.now()}.txt`;
    el.style.display = "none";
    document.body.appendChild(el);
    el.click();
    document.body.removeChild(el);
  };

  const handleWhatsApp = () => {
    const text = receiptText();
    const phone = waPhone.replace(/[\s\-()]/g, "");
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <Card className="w-full max-w-sm shadow-2xl">
      <CardHeader className="pb-2">
        {/* Title row */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Receipt</h2>
          <div className="flex gap-1.5">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted transition-colors"
            >
              <Printer className="h-3.5 w-3.5" /> {t("print")}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted transition-colors"
            >
              <Download className="h-3.5 w-3.5" /> {t("save")}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg border hover:bg-muted text-muted-foreground"
                title="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* WhatsApp row */}
        <div className="flex items-center gap-2 mt-2">
          <input
            type="tel"
            value={waPhone}
            onChange={e => setWaPhone(e.target.value)}
            placeholder="WhatsApp number e.g. +254712345678"
            className="flex-1 border rounded-md px-2.5 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={handleWhatsApp}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors whitespace-nowrap"
          >
            <MessageCircle className="h-3.5 w-3.5" /> Send
          </button>
        </div>
      </CardHeader>

      <CardContent className="font-mono text-xs pt-0">
        <div className="border-t pt-3">
          {/* Business header */}
          <div className="text-center mb-2">
            <div className="font-bold text-sm">{businessName.toUpperCase()}</div>
            {businessPhone && <div className="text-muted-foreground text-[10px]">Tel: {businessPhone}</div>}
            <div className="text-[10px] text-muted-foreground mt-0.5">POS RECEIPT</div>
          </div>

          <div className="border-t border-dashed my-2" />

          {/* Customer & meta */}
          {customerName && (
            <div className="flex justify-between mb-1">
              <span className="text-muted-foreground">Customer:</span>
              <span>{customerName}</span>
            </div>
          )}
          <div className="flex justify-between mb-1 text-muted-foreground">
            <span>Date:</span>
            <span>{new Date().toLocaleDateString()}</span>
          </div>
          {transactionId && (
            <div className="flex justify-between mb-1 text-muted-foreground">
              <span>Ref:</span>
              <span className="truncate max-w-[8rem]">{transactionId}</span>
            </div>
          )}

          <div className="border-t border-dashed my-2" />

          {/* Items */}
          <div className="space-y-1 mb-2">
            {items.map(item => (
              <div key={item.productId} className="flex justify-between">
                <span className="truncate max-w-[10rem]">{item.productName || "Item"} ×{item.quantity}</span>
                <span className="shrink-0">{fmt(Number(item.price) * item.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed my-2" />

          {/* Totals */}
          <div className="space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal:</span><span>{fmt(Number(subtotal))}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Discount:</span><span>−{fmt(Number(discountAmount))}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>Tax (10%):</span><span>{fmt(Number(taxAmount))}</span>
            </div>
          </div>

          <div className="border-t my-2 pt-2 font-bold text-sm flex justify-between">
            <span>TOTAL:</span>
            <span className="text-primary">{fmt(Number(totalAmount))}</span>
          </div>

          <div className="border-t border-dashed my-2" />

          <div className="flex justify-between text-muted-foreground">
            <span>Payment:</span>
            <span>{PAYMENT_LABELS[paymentMethod] ?? paymentMethod}</span>
          </div>

          <div className="text-center mt-4 py-2 text-muted-foreground">
            <p className="font-medium">Thank you for your business!</p>
            <p className="text-[10px] mt-0.5">{new Date().toLocaleString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
