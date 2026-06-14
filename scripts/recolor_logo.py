"""Remove white background from the FiNot logo and recolor the navy-blue parts
to cream so the mark harmonizes with the ink-green theme. Orange is kept (brand
accent). Run inside the container where Pillow + numpy are available."""
import numpy as np
from PIL import Image

SRC = "/tmp/logo_src.png"
OUT = "/tmp/logo_out.png"

CREAM = np.array([238, 242, 233], dtype=np.float32)   # #EEF2E9 (theme text)
ORANGE = np.array([245, 132, 31], dtype=np.float32)    # #F5841F (brand accent)

img = Image.open(SRC).convert("RGBA")
arr = np.asarray(img).astype(np.float32)
r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]

# Logo already has a transparent background — keep its alpha, only recolor ink.
ink = a > 0
is_orange = ink & (r >= g) & ((r - b) > 25)   # orange/red accents -> keep brand orange
is_cream = ink & ~is_orange                    # navy-blue + neutral outlines -> cream

out = arr.copy()
out[is_cream, 0] = CREAM[0]
out[is_cream, 1] = CREAM[1]
out[is_cream, 2] = CREAM[2]
out[is_orange, 0] = ORANGE[0]
out[is_orange, 1] = ORANGE[1]
out[is_orange, 2] = ORANGE[2]
out[..., 3] = a  # preserve original alpha (incl. anti-aliased edges)

Image.fromarray(out.astype(np.uint8), "RGBA").save(OUT)
print("done", img.size)
