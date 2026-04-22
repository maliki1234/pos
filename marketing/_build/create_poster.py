from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
LOGO = ROOT / "assets" / "logan-tech-logo.png"
OUT = ROOT / "outputs" / "logan-pos-social-poster.png"

W, H = 1080, 1350

def font(size, bold=False):
    candidates = [
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()

def text_center(draw, y, text, fnt, fill, spacing=0):
    box = draw.textbbox((0, 0), text, font=fnt)
    x = (W - (box[2] - box[0])) / 2
    draw.text((x, y), text, font=fnt, fill=fill, spacing=spacing)

def wrap_text(draw, text, fnt, max_width):
    words = text.split()
    lines = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        box = draw.textbbox((0, 0), candidate, font=fnt)
        if box[2] - box[0] <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return "\n".join(lines)

poster = Image.new("RGB", (W, H), "#101820")
draw = ImageDraw.Draw(poster)

for y in range(H):
    blend = y / H
    r = int(10 + 10 * blend)
    g = int(20 + 18 * blend)
    b = int(30 + 28 * blend)
    draw.line([(0, y), (W, y)], fill=(r, g, b))

logo = Image.open(LOGO).convert("RGBA")
logo_bg = logo.resize((W, int(W * logo.height / logo.width)))
logo_bg = logo_bg.crop((0, 0, W, min(logo_bg.height, 760)))
logo_bg = logo_bg.filter(ImageFilter.GaussianBlur(1.2))
overlay = Image.new("RGBA", logo_bg.size, (0, 0, 0, 110))
logo_bg = Image.alpha_composite(logo_bg, overlay)
poster.paste(logo_bg.convert("RGB"), (0, 0))

draw = ImageDraw.Draw(poster)

accent = "#137BFF"
white = "#F6FBFF"
muted = "#B7C8D8"
green = "#31D48B"

draw.rounded_rectangle((64, 64, W - 64, 1210), radius=28, outline=(19, 123, 255), width=2)
draw.rectangle((0, 1090, W, H), fill="#07111C")
draw.line((90, 1090, W - 90, 1090), fill=accent, width=3)

text_center(draw, 640, "LOGAN POS", font(86, True), white)
text_center(draw, 742, "Sell smarter. Manage better.", font(42, False), "#D6E9FF")

pill_y = 830
features = ["Sales", "Stock", "Credit", "Profit", "Offline Sync"]
x = 90
for item in features:
    f = font(28, True)
    box = draw.textbbox((0, 0), item, font=f)
    tw = box[2] - box[0]
    pad_x = 24
    draw.rounded_rectangle((x, pill_y, x + tw + pad_x * 2, pill_y + 58), radius=18, fill="#122B42", outline="#1A8BFF")
    draw.text((x + pad_x, pill_y + 12), item, font=f, fill=white)
    x += tw + pad_x * 2 + 16

draw.text((96, 944), "Offline-ready retail system for East African shops.", font=font(34, True), fill=white)
body_font = font(28)
body_copy = "Manage sales, stock, customer credit, running costs, and net profit from one simple dashboard."
draw.multiline_text((96, 1000), wrap_text(draw, body_copy, body_font, W - 192), font=body_font, fill=muted, spacing=8)

draw.rounded_rectangle((96, 1140, W - 96, 1232), radius=18, fill=accent)
text_center(draw, 1164, "Book a demo with Logan Tech", font(36, True), white)

draw.text((96, 1272), "Innovation  |  Systems  |  Solutions", font=font(26), fill=green)
draw.text((W - 355, 1272), "logan.tech", font=font(26, True), fill=muted)

OUT.parent.mkdir(parents=True, exist_ok=True)
poster.save(OUT, quality=95)
print(OUT)
