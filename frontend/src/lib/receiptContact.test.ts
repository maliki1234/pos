import assert from "node:assert/strict";
import { getReceiptBusinessContact } from "./receiptContact";

assert.equal(
  getReceiptBusinessContact({ phone: "+255700111222", whatsappPhone: "+255744333444" }),
  "+255744333444"
);

assert.equal(
  getReceiptBusinessContact({ phone: "+255700111222", whatsappPhone: "" }),
  "+255700111222"
);

assert.equal(
  getReceiptBusinessContact({ phone: null, whatsappPhone: null }),
  ""
);

console.log("receiptContact tests passed");
