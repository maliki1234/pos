export interface ReceiptBusinessContact {
  phone?: string | null;
  whatsappPhone?: string | null;
}

export function getReceiptBusinessContact(settings: ReceiptBusinessContact | null | undefined) {
  return settings?.whatsappPhone?.trim() || settings?.phone?.trim() || "";
}
