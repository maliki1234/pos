import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { Presentation, PresentationFile } = await import("@oai/artifact-tool");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "outputs");
const PREVIEW_DIR = path.join(__dirname, "previews");
const LOGO_PATH = path.join(ROOT, "assets", "logan-tech-logo.png");
const OUTPUT_PATH = path.join(OUT_DIR, "logan-pos-presentation.pptx");

const W = 1280;
const H = 720;
const COLOR = {
  bg: "#07111C",
  bg2: "#0B1B2A",
  panel: "#102235",
  panel2: "#0D2B45",
  blue: "#137BFF",
  blue2: "#00A3FF",
  green: "#31D48B",
  white: "#F6FBFF",
  muted: "#B7C8D8",
  dim: "#6F8498",
  line: "#1D4266",
  danger: "#FF6B6B",
};

const FONT = {
  title: "Poppins",
  body: "Lato",
};

await fs.mkdir(OUT_DIR, { recursive: true });
await fs.mkdir(PREVIEW_DIR, { recursive: true });

async function readImageBlob(imagePath) {
  const bytes = await fs.readFile(imagePath);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

const logoBlob = await readImageBlob(LOGO_PATH);

function addShape(slide, geometry, x, y, width, height, opts = {}) {
  const shape = slide.shapes.add({
    geometry,
    position: { left: x, top: y, width, height },
    fill: opts.fill ?? "#00000000",
    line: opts.line ?? { style: "solid", fill: "#00000000", width: 0 },
  });
  return shape;
}

function addText(slide, text, x, y, width, height, opts = {}) {
  const shape = addShape(slide, "rect", x, y, width, height, {
    fill: opts.fill ?? "#00000000",
    line: opts.line ?? { style: "solid", fill: "#00000000", width: 0 },
  });
  shape.text = text;
  shape.text.typeface = opts.typeface ?? FONT.body;
  shape.text.fontSize = opts.size ?? 24;
  shape.text.color = opts.color ?? COLOR.white;
  shape.text.bold = opts.bold ?? false;
  shape.text.alignment = opts.align ?? "left";
  shape.text.verticalAlignment = opts.valign ?? "top";
  shape.text.autoFit = opts.autoFit ?? "shrinkText";
  shape.text.insets = opts.insets ?? { left: 0, right: 0, top: 0, bottom: 0 };
  return shape;
}

function addTitle(slide, title, subtitle) {
  addText(slide, title, 70, 74, 760, 88, {
    typeface: FONT.title,
    size: 44,
    bold: true,
    color: COLOR.white,
  });
  if (subtitle) {
    addText(slide, subtitle, 72, 150, 780, 54, {
      size: 22,
      color: COLOR.muted,
    });
  }
}

function addLogo(slide, x = 1010, y = 32, width = 210, height = 96) {
  const image = slide.images.add({
    blob: logoBlob.slice(0),
    fit: "contain",
    alt: "Logan Tech logo",
  });
  image.position = { left: x, top: y, width, height };
  return image;
}

function addBackground(slide) {
  slide.background.fill = COLOR.bg;
  addShape(slide, "rect", 0, 0, W, H, { fill: COLOR.bg });
  addShape(slide, "rect", 0, 0, W, 9, { fill: COLOR.blue });
  addShape(slide, "rect", 0, H - 6, W, 6, { fill: COLOR.green });
  addShape(slide, "ellipse", 1018, -160, 380, 380, {
    fill: "#0F3E6655",
    line: { style: "solid", fill: "#00000000", width: 0 },
  });
  addShape(slide, "ellipse", -150, 500, 360, 360, {
    fill: "#063D6650",
    line: { style: "solid", fill: "#00000000", width: 0 },
  });
  addLogo(slide);
}

function addCard(slide, x, y, width, height, title, body, opts = {}) {
  addShape(slide, "roundRect", x, y, width, height, {
    fill: opts.fill ?? COLOR.panel,
    line: { style: "solid", fill: opts.line ?? COLOR.line, width: opts.lineWidth ?? 1.2 },
  });
  addText(slide, title, x + 24, y + 22, width - 48, 34, {
    typeface: FONT.title,
    size: opts.titleSize ?? 24,
    bold: true,
    color: opts.titleColor ?? COLOR.white,
  });
  addText(slide, body, x + 24, y + 66, width - 48, height - 84, {
    size: opts.bodySize ?? 18,
    color: opts.bodyColor ?? COLOR.muted,
  });
}

function addPill(slide, label, x, y, width, opts = {}) {
  addShape(slide, "roundRect", x, y, width, 46, {
    fill: opts.fill ?? COLOR.panel2,
    line: { style: "solid", fill: opts.line ?? COLOR.blue, width: 1.2 },
  });
  addText(slide, label, x, y + 10, width, 24, {
    size: opts.size ?? 17,
    bold: true,
    color: opts.color ?? COLOR.white,
    align: "center",
  });
}

function addFooter(slide, note = "Logan POS by Logan Tech") {
  addText(slide, note, 72, 665, 440, 28, { size: 15, color: COLOR.dim });
  addText(slide, "Innovation | Systems | Solutions", 806, 665, 400, 28, {
    size: 15,
    color: COLOR.dim,
    align: "right",
  });
}

function addNumberBadge(slide, n, x, y) {
  addShape(slide, "ellipse", x, y, 46, 46, {
    fill: COLOR.blue,
    line: { style: "solid", fill: COLOR.blue2, width: 1 },
  });
  addText(slide, String(n), x, y + 8, 46, 24, {
    typeface: FONT.title,
    size: 20,
    bold: true,
    align: "center",
  });
}

function slideTitle() {
  const slide = presentation.slides.add();
  addBackground(slide);
  addShape(slide, "rect", 0, 0, W, H, { fill: "#00000055" });
  addLogo(slide, 255, 44, 770, 430);
  addText(slide, "LOGAN POS", 230, 482, 820, 86, {
    typeface: FONT.title,
    size: 66,
    bold: true,
    align: "center",
    color: COLOR.white,
  });
  addText(slide, "Sell smarter. Manage better.", 300, 560, 680, 48, {
    size: 30,
    align: "center",
    color: COLOR.muted,
  });
  addPill(slide, "Sales", 250, 632, 120);
  addPill(slide, "Stock", 392, 632, 120);
  addPill(slide, "Credit", 534, 632, 120);
  addPill(slide, "Profit", 676, 632, 120);
  addPill(slide, "Offline Sync", 818, 632, 170);
  slide.speakerNotes.setText("Open with Logan POS as a practical system for East African shops that need control even when internet is unstable.");
}

function slideProblem() {
  const slide = presentation.slides.add();
  addBackground(slide);
  addTitle(slide, "The Shop Problem", "Sales happen every day, but control gets lost when the business runs in scattered places.");
  const cards = [
    ["Sales in notebooks", "Daily totals are hard to trust when every shift writes its own numbers."],
    ["Stock guesses", "Owners discover missing stock after money has already been lost."],
    ["Credit confusion", "Customer balances are forgotten, delayed, or not visible to the owner."],
    ["Profit is unclear", "Revenue looks good, but product cost and running costs are not deducted."],
  ];
  cards.forEach(([title, body], i) => addCard(slide, 72 + i * 292, 266, 252, 225, title, body));
  addText(slide, "Logan POS brings these daily controls into one working system.", 132, 550, 1016, 52, {
    typeface: FONT.title,
    size: 28,
    bold: true,
    align: "center",
    color: COLOR.green,
  });
  addFooter(slide);
}

function slideSolution() {
  const slide = presentation.slides.add();
  addBackground(slide);
  addTitle(slide, "One System For Daily Operations", "A simple POS workflow for cashier, manager, owner, and accountant.");
  addShape(slide, "roundRect", 450, 260, 380, 160, {
    fill: "#12345A",
    line: { style: "solid", fill: COLOR.blue, width: 2 },
  });
  addText(slide, "LOGAN POS", 475, 305, 330, 44, {
    typeface: FONT.title,
    size: 36,
    bold: true,
    align: "center",
  });
  addText(slide, "Sales, stock, credit, expenses, reports", 492, 358, 296, 32, {
    size: 17,
    color: COLOR.muted,
    align: "center",
  });
  const items = [
    ["Cashier", "Sells products and shares receipts", 76, 224],
    ["Manager", "Adds products, prices, and stock", 76, 426],
    ["Owner", "Views revenue, net profit, and credit", 912, 224],
    ["Accountant", "Checks costs, balances, and reports", 912, 426],
  ];
  items.forEach(([title, body, x, y]) => addCard(slide, x, y, 276, 136, title, body, { bodySize: 16 }));
  addShape(slide, "rect", 352, 292, 98, 3, { fill: COLOR.blue });
  addShape(slide, "rect", 352, 492, 98, 3, { fill: COLOR.blue });
  addShape(slide, "rect", 830, 292, 82, 3, { fill: COLOR.blue });
  addShape(slide, "rect", 830, 492, 82, 3, { fill: COLOR.blue });
  addFooter(slide);
}

function slideWorkflows() {
  const slide = presentation.slides.add();
  addBackground(slide);
  addTitle(slide, "Core Workflows", "Everything the shop needs from the first sale to the end-of-day report.");
  const workflows = [
    ["1", "Sell", "Search products, add to cart, choose payment, complete sale."],
    ["2", "Stock", "Add stock with buying cost, track available quantity, watch low stock."],
    ["3", "Credit", "Select customer, sell on credit, keep balance visible."],
    ["4", "Profit", "Revenue minus product cost and running costs gives net profit."],
  ];
  workflows.forEach(([n, title, body], i) => {
    const x = 78 + i * 292;
    addCard(slide, x, 250, 250, 270, title, body, { bodySize: 17 });
    addNumberBadge(slide, n, x + 24, 204);
  });
  addText(slide, "Designed for fast cashier work and clear owner decisions.", 150, 580, 980, 44, {
    size: 25,
    bold: true,
    align: "center",
    color: COLOR.green,
  });
  addFooter(slide);
}

function slideOffline() {
  const slide = presentation.slides.add();
  addBackground(slide);
  addTitle(slide, "Offline-First Advantage", "Internet can drop. Selling should continue.");
  addText(slide, "Cashiers keep selling from offline product data. New sales are saved locally, then synced when the connection returns.", 76, 240, 470, 178, {
    typeface: FONT.title,
    size: 31,
    bold: true,
    color: COLOR.white,
  });
  const steps = [
    ["Offline", "Sell from local catalog"],
    ["Queue", "Save pending sale"],
    ["Reconnect", "Internet returns"],
    ["Sync", "Server updates stock and reports"],
  ];
  steps.forEach(([title, body], i) => {
    const x = 625 + (i % 2) * 270;
    const y = 218 + Math.floor(i / 2) * 180;
    addCard(slide, x, y, 230, 126, title, body, { bodySize: 15, titleColor: i === 3 ? COLOR.green : COLOR.white });
    if (i < 3) {
      addText(slide, ">", x + 232, y + 42, 38, 40, { size: 34, bold: true, color: COLOR.blue, align: "center" });
    }
  });
  addPill(slide, "Offline sales", 88, 490, 170);
  addPill(slide, "Offline product search", 282, 490, 232);
  addPill(slide, "Sync status", 88, 552, 170);
  addPill(slide, "Pending retry", 282, 552, 180);
  addFooter(slide);
}

function slideProfit() {
  const slide = presentation.slides.add();
  addBackground(slide);
  addTitle(slide, "Know Net Profit, Not Just Revenue", "Reports should tell the owner whether the business truly made money.");
  const formula = [
    ["Revenue", COLOR.blue],
    ["-", COLOR.muted],
    ["Product Cost", COLOR.blue2],
    ["-", COLOR.muted],
    ["Running Costs", COLOR.green],
    ["=", COLOR.muted],
    ["Net Profit", COLOR.white],
  ];
  let x = 84;
  formula.forEach(([text, color]) => {
    const width = text.length < 2 ? 42 : text.length * 17 + 42;
    addShape(slide, "roundRect", x, 254, width, 76, {
      fill: text.length < 2 ? "#00000000" : COLOR.panel,
      line: { style: "solid", fill: text.length < 2 ? "#00000000" : COLOR.line, width: 1.2 },
    });
    addText(slide, text, x, 274, width, 34, {
      typeface: FONT.title,
      size: text.length < 2 ? 32 : 22,
      bold: true,
      color,
      align: "center",
    });
    x += width + 14;
  });
  addCard(slide, 96, 420, 310, 140, "Daily report", "Revenue, cost, gross profit, running costs, and net profit for today.");
  addCard(slide, 486, 420, 310, 140, "Custom range", "Review weekly, monthly, or any selected date range.");
  addCard(slide, 876, 420, 310, 140, "Owner clarity", "Spot good sales days that still had weak profit.");
  addFooter(slide);
}

function slideCreditStock() {
  const slide = presentation.slides.add();
  addBackground(slide);
  addTitle(slide, "Credit And Stock Control", "Reduce lost money by keeping balances and stock movement visible.");
  addCard(slide, 92, 230, 500, 320, "Customer Credit", "Credit sale requires a customer. Balance updates after the sale, so the owner can see who still owes money and follow up on time.", {
    titleSize: 31,
    bodySize: 22,
    titleColor: COLOR.green,
  });
  addCard(slide, 690, 230, 500, 320, "Stock Control", "Products and stock batches can be managed safely. Buying cost supports profit reports, while low-stock visibility helps the shop reorder early.", {
    titleSize: 31,
    bodySize: 22,
    titleColor: COLOR.blue2,
  });
  addPill(slide, "Customer balance", 140, 590, 200);
  addPill(slide, "Due dates", 360, 590, 138);
  addPill(slide, "Stock batches", 738, 590, 180);
  addPill(slide, "Low stock", 938, 590, 144);
  addFooter(slide);
}

function slideCustomers() {
  const slide = presentation.slides.add();
  addBackground(slide);
  addTitle(slide, "Built For Growing Shops", "Logan POS fits businesses that need practical control without complex enterprise software.");
  const customers = [
    "Retail shops",
    "Mini supermarkets",
    "Wholesalers",
    "Pharmacies",
    "Hardware stores",
    "Cosmetics and electronics",
  ];
  customers.forEach((label, i) => {
    const x = 92 + (i % 3) * 370;
    const y = 236 + Math.floor(i / 3) * 142;
    addShape(slide, "roundRect", x, y, 310, 98, {
      fill: COLOR.panel,
      line: { style: "solid", fill: COLOR.line, width: 1.2 },
    });
    addShape(slide, "ellipse", x + 24, y + 25, 48, 48, {
      fill: i % 2 ? COLOR.green : COLOR.blue,
      line: { style: "solid", fill: "#00000000", width: 0 },
    });
    addText(slide, label, x + 88, y + 32, 190, 34, {
      typeface: FONT.title,
      size: 22,
      bold: true,
    });
  });
  addText(slide, "Start with one shop. Grow into a managed retail operation.", 150, 582, 980, 44, {
    size: 27,
    bold: true,
    align: "center",
    color: COLOR.green,
  });
  addFooter(slide);
}

function slideDemoJourney() {
  const slide = presentation.slides.add();
  addBackground(slide);
  addTitle(slide, "Demo Journey", "A practical walkthrough that shows the owner how Logan POS works in real shop life.");
  const steps = [
    ["Setup", "Business settings, users, products, prices"],
    ["Stock", "Add stock with buying cost"],
    ["Sell", "Cash sale, mobile money, or credit"],
    ["Offline", "Turn internet off and keep selling"],
    ["Report", "Return online and review net profit"],
  ];
  steps.forEach(([title, body], i) => {
    const x = 92 + i * 225;
    addNumberBadge(slide, i + 1, x + 82, 228);
    addCard(slide, x, 296, 190, 188, title, body, { bodySize: 15, titleSize: 22 });
    if (i < 4) {
      addText(slide, ">", x + 192, 358, 34, 32, { size: 28, bold: true, color: COLOR.blue, align: "center" });
    }
  });
  addText(slide, "The goal is not only to show screens. It is to show control.", 155, 562, 970, 46, {
    size: 27,
    bold: true,
    align: "center",
    color: COLOR.green,
  });
  addFooter(slide);
}

function slideNextStep() {
  const slide = presentation.slides.add();
  addBackground(slide);
  addLogo(slide, 355, 54, 570, 310);
  addText(slide, "Ready For A Demo?", 226, 380, 828, 64, {
    typeface: FONT.title,
    size: 48,
    bold: true,
    align: "center",
  });
  addText(slide, "Use Logan POS to sell, manage stock, track credit, record costs, and see net profit.", 260, 454, 760, 56, {
    size: 23,
    color: COLOR.muted,
    align: "center",
  });
  addShape(slide, "roundRect", 394, 542, 492, 68, {
    fill: COLOR.blue,
    line: { style: "solid", fill: COLOR.blue2, width: 1.2 },
  });
  addText(slide, "Book a demo with Logan Tech", 394, 560, 492, 32, {
    typeface: FONT.title,
    size: 25,
    bold: true,
    align: "center",
  });
  addText(slide, "WhatsApp-ready receipts | Offline sync | Net profit reports", 320, 640, 640, 32, {
    size: 18,
    color: COLOR.green,
    align: "center",
  });
}

const presentation = Presentation.create({
  slideSize: { width: W, height: H },
});

slideTitle();
slideProblem();
slideSolution();
slideWorkflows();
slideOffline();
slideProfit();
slideCreditStock();
slideCustomers();
slideDemoJourney();
slideNextStep();

const inspect = [];
for (const slide of presentation.slides.items) {
  for (const element of slide.elements.items) {
    if (element.text && String(element.text).trim()) {
      inspect.push({
        slide: slide.index + 1,
        kind: "text",
        text: String(element.text),
        bbox: element.position ?? element.pixelRect ?? null,
      });
    }
  }
}
await fs.writeFile(path.join(__dirname, "deck-inspect.json"), JSON.stringify(inspect, null, 2));

for (const slide of presentation.slides.items) {
  const png = await presentation.export({ slide, format: "png", scale: 1 });
  const bytes = Buffer.from(await png.arrayBuffer());
  await fs.writeFile(path.join(PREVIEW_DIR, `slide-${String(slide.index + 1).padStart(2, "0")}.png`), bytes);
}

const pptx = await PresentationFile.exportPptx(presentation);
await pptx.save(OUTPUT_PATH);
console.log(OUTPUT_PATH);
process.exitCode = 0;
