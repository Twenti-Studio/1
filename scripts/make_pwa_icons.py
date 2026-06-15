"""Generate transparent square PWA icons (192 & 512) from the transparent
F-mark source, centered with padding. No background box."""
from PIL import Image

SRC = "/tmp/icon_src.png"          # finot_logo.png (transparent F-mark)
SIZES = {192: "/tmp/finot_logo-192.png", 512: "/tmp/finot_logo-512.png"}
PAD = 0.14  # fraction of canvas kept as transparent margin on each side

src = Image.open(SRC).convert("RGBA")
w, h = src.size

for N, out in SIZES.items():
    canvas = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    box = int(N * (1 - 2 * PAD))
    scale = min(box / w, box / h)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    mark = src.resize((nw, nh), Image.LANCZOS)
    canvas.alpha_composite(mark, ((N - nw) // 2, (N - nh) // 2))
    canvas.save(out)
    print(out, canvas.size)
