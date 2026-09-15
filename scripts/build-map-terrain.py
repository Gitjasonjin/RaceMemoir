"""Reproject Natural Earth SR_50M.tif to the app map. Requires Pillow + NumPy.
Usage: python scripts/build-map-terrain.py path/to/SR_50M.tif
"""
import json, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[1]
projection = json.loads(subprocess.check_output([
    "node", "--experimental-strip-types", "--input-type=module", "-e",
    "import {mapGeometry} from './src/race-map/mapGeometry.ts'; console.log(JSON.stringify({scale:mapGeometry.projection.scale(),translate:mapGeometry.projection.translate()}))"
], cwd=root, text=True))
source = np.asarray(Image.open(sys.argv[1]).convert("L"))
h, w = source.shape
# Inverse Mercator into the source global equirectangular pixel grid.
x = (np.arange(2000) + .5) / 2
y = (np.arange(1400) + .5) / 2
lng = (x - projection["translate"][0]) / projection["scale"] * 180 / np.pi
lat = (2 * np.arctan(np.exp((projection["translate"][1] - y) / projection["scale"])) - np.pi / 2) * 180 / np.pi
sx = np.clip((lng + 180) / 360 * w - .5, 0, w-2)
sy = np.clip((90 - lat) / 180 * h - .5, 0, h-2)
ix, iy = sx.astype(int), sy.astype(int)
fx, fy = sx - ix, (sy - iy)[:, None]
a = source[iy[:, None], ix].astype(float) * (1-fx) + source[iy[:, None], ix+1] * fx
b = source[iy[:, None]+1, ix].astype(float) * (1-fx) + source[iy[:, None]+1, ix+1] * fx
shade = a * (1-fy) + b * fy
# Muted sage relief: keep enough contrast for ridges without competing with pins.
relief = np.clip((shade - 190) * .62, -65, 20)
rgb = np.clip(np.array([222, 230, 224]) + relief[:, :, None], 0, 255).astype("uint8")
output = root / "src/assets/maps/china-terrain.webp"
Image.fromarray(rgb).save(output, quality=88, method=6)
print(f"{output}: {output.stat().st_size} bytes")
