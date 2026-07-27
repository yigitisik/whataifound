#!/usr/bin/env python3
"""Rasterise the brand mark into the icon sizes search engines and devices expect.

    python3 scripts/build-icons.py

Why this exists
---------------
assets/brand/favicon.svg alone is not enough. Google's favicon crawler documents
support for .ico, .png, .jpg and .gif; SVG is not on that list, so a site that ships
only an SVG icon often shows Google's generic globe in search results instead of its
mark. Devices want raster too: iOS uses apple-touch-icon.png, Android reads the icons
declared in the web manifest.

Run this only when assets/brand/favicon.svg or og.svg changes. The outputs are
committed, so a normal `build.py` does not need to regenerate them, and this script is
not part of it (it needs a renderer the rest of the toolchain does not).

Outputs, all at the repo root or under assets/brand/:
    favicon.ico            48x48, the path Google looks for by default
    assets/brand/icon-48.png    raster rel="icon" and the .ico payload
    apple-touch-icon.png        180x180, iOS home screen, opaque background required
    assets/brand/icon-512.png   manifest, PWA install, and the Organization logo
    assets/brand/og.png         1200x630 social card, from og.svg

Prefers Node with Playwright (the same dependency the parity check uses) and falls
back to macOS Quick Look, which needs no install but takes a more roundabout path:
see render_qlmanage for why the source SVG is rewritten before rendering.
"""
import base64
import json
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "brand", "favicon.svg")
BRAND = os.path.join(ROOT, "assets", "brand")

# (output path relative to ROOT, pixel size). apple-touch-icon sits at the repo root
# because iOS probes /apple-touch-icon.png directly when no <link> is present.
# Deliberately minimal. Browsers scale a 48px icon down for tabs perfectly well, and
# one 512px PNG serves the manifest, the Organization logo and Apple's touch icon
# equally, so shipping 16/32/192 as separate files bought nothing but clutter.
TARGETS = [
    # Payload for favicon.ico and the one raster rel="icon"; the size Google reads.
    ("assets/brand/icon-48.png", 48),
    # iOS home screen (opaque), the manifest's large icon, and the Organization logo.
    ("apple-touch-icon.png", 180),
    ("assets/brand/icon-512.png", 512),
]

RENDER_JS = r"""
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const spec = JSON.parse(process.argv[2]);
  const svg = fs.readFileSync(spec.src, 'utf8');
  const b = await chromium.launch();
  for (const t of spec.targets) {
    const p = await b.newPage({
      viewport: { width: t.size, height: t.size },
      deviceScaleFactor: 1,
    });
    // The mark is drawn on its own rounded dark plate, so the page behind it only
    // shows through the corner radius. Transparent keeps that radius clean for the
    // browser-tab sizes; apple-touch-icon is composited on the plate colour instead,
    // because iOS masks its own corners and a transparent PNG renders black there.
    await p.setContent(
      `<style>html,body{margin:0;padding:0;background:${t.bg}}
       svg{display:block;width:${t.size}px;height:${t.size}px}</style>${svg}`,
      { waitUntil: 'load' });
    await p.screenshot({ path: t.out, omitBackground: t.bg === 'transparent' });
    await p.close();
  }
  await b.close();
})();
"""


def png_size(path):
    """Width/height straight from the IHDR chunk, to verify what we actually wrote."""
    with open(path, "rb") as f:
        head = f.read(24)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    return struct.unpack(">II", head[16:24])


def _read_rgba(path):
    """Decode a PNG to (width, height, bytearray of RGBA rows).

    Only the subset qlmanage emits is handled: 8-bit truecolour with alpha, no
    interlacing. Enough to resample our own render, and it keeps this script free of
    third-party imaging dependencies.
    """
    data = open(path, "rb").read()
    pos, idat, w = 8, b"", None
    while pos < len(data):
        ln = struct.unpack(">I", data[pos:pos + 4])[0]
        typ = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + ln]
        if typ == b"IHDR":
            w, h, depth, colour, _, _, interlace = struct.unpack(">IIBBBBB", chunk[:13])
            if (depth, colour, interlace) != (8, 6, 0):
                sys.exit(f"{path}: expected 8-bit RGBA non-interlaced PNG")
        elif typ == b"IDAT":
            idat += chunk
        elif typ == b"IEND":
            break
        pos += 12 + ln

    raw = zlib.decompress(idat)
    stride, bpp = w * 4, 4
    out, prev, i = [], bytearray(stride), 0
    for _ in range(h):
        filt = raw[i]; i += 1
        line = bytearray(raw[i:i + stride]); i += stride
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0
            b = prev[x]
            c = prev[x - bpp] if x >= bpp else 0
            if filt == 1:
                line[x] = (line[x] + a) & 0xFF
            elif filt == 2:
                line[x] = (line[x] + b) & 0xFF
            elif filt == 3:
                line[x] = (line[x] + (a + b) // 2) & 0xFF
            elif filt == 4:
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                pred = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pred) & 0xFF
        out.append(line)
        prev = line
    return w, h, out


def downscale_png(src, dst, size, chroma=None):
    """Box-filter `src` down to size x size, premultiplying so edges stay clean.

    Averaging straight (non-premultiplied) RGBA would pull the colour of fully
    transparent pixels into the visible edge; premultiplying first and dividing back
    out afterwards keeps the antialiased boundary the right hue.

    `chroma` is an (r, g, b) key colour that the renderer painted where the output
    should be transparent. Keying happens here, at master resolution, so the box
    filter turns the key's hard boundary into a correctly antialiased alpha edge.
    """
    w, h, rows = _read_rgba(src)
    if w % size or h % size:
        sys.exit(f"{src}: {w}x{h} does not divide evenly into {size}")
    bx, by = w // size, h // size

    if chroma is not None:
        kr, kg, kb = chroma
        for row in rows:
            for p in range(0, w * 4, 4):
                # Exact match only: the key is a colour the artwork never uses, and
                # anti-aliased pixels along the plate's radius are genuine blends that
                # the box filter below should keep weighting.
                if row[p] == kr and row[p + 1] == kg and row[p + 2] == kb:
                    row[p] = row[p + 1] = row[p + 2] = row[p + 3] = 0

    raw = bytearray()
    for oy in range(size):
        raw.append(0)                                   # filter type: none
        for ox in range(size):
            r = g = b = a = 0
            for sy in range(oy * by, (oy + 1) * by):
                row = rows[sy]
                for sx in range(ox * bx, (ox + 1) * bx):
                    p = sx * 4
                    pa = row[p + 3]
                    r += row[p] * pa
                    g += row[p + 1] * pa
                    b += row[p + 2] * pa
                    a += pa
            n = bx * by
            if a:
                raw += bytes((round(r / a), round(g / a), round(b / a), round(a / n)))
            else:
                raw += b"\0\0\0\0"

    def chunk(typ, payload):
        body = typ + payload
        return (struct.pack(">I", len(payload)) + body
                + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF))

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    open(dst, "wb").write(png)


def build_ico(png_path, ico_path):
    """Wrap a single 32x32 PNG in an ICO container.

    The ICO format allows a PNG payload, which every browser released this decade
    reads, so there is no need to encode a BMP. One directory entry is enough:
    Google scales whatever it finds.
    """
    png = open(png_path, "rb").read()
    w, h = png_size(png_path)
    header = struct.pack("<HHH", 0, 1, 1)               # reserved, type=icon, count
    entry = struct.pack(
        "<BBBBHHII",
        w if w < 256 else 0, h if h < 256 else 0,       # 0 means 256
        0, 0,                                            # palette, reserved
        1, 32,                                           # colour planes, bits per pixel
        len(png), 6 + 16,                                # payload size, offset
    )
    open(ico_path, "wb").write(header + entry + png)


# qlmanage pads rather than scales when the requested thumbnail box is near the SVG's
# intrinsic size, which leaves a 48px icon sitting in the corner of a 48px canvas. So
# each target is rendered far larger and then downscaled. The master must be an exact
# multiple of the target for the box filter, so it is derived per target rather than
# fixed: the smallest multiple of `size` that is at least this many pixels.
QL_MIN_MASTER = 768


def render_qlmanage(spec):
    """Fallback renderer using macOS Quick Look, for machines without Playwright.

    qlmanage sizes an SVG from its intrinsic width/height attributes rather than the
    requested thumbnail box, so the source is rewritten at the master size first and
    the result resampled down. It cannot composite a background either, so opaque
    targets get an explicit plate rect drawn into the SVG before rendering.
    """
    if not shutil.which("qlmanage"):
        return False
    svg = open(spec["src"]).read()

    for t in spec["targets"]:
        # Round up to a whole multiple of the target so the box filter divides evenly.
        master_px = -(-QL_MIN_MASTER // t["size"]) * t["size"]
        source = re.sub(r'\bwidth="[^"]*"', f'width="{master_px}"', svg, count=1)
        source = re.sub(r'\bheight="[^"]*"', f'height="{master_px}"', source, count=1)
        # Quick Look always flattens onto opaque white, so transparency cannot survive
        # the render. Outside the mark's rounded plate we therefore paint a colour that
        # cannot occur in the artwork, and key it back out to alpha after downscaling.
        chroma = None
        if t["bg"] == "transparent":
            chroma = (255, 0, 255)
            rect = f'<rect width="{master_px}" height="{master_px}" fill="#ff00ff"/>'
        else:
            # iOS masks its own corners and renders a transparent PNG's corners black,
            # so the plate colour has to be painted behind the mark, under its radius.
            rect = f'<rect width="{master_px}" height="{master_px}" fill="{t["bg"]}"/>'
        source = re.sub(r"(<svg[^>]*>)", r"\1" + rect, source, count=1)
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "icon.svg")
            open(src, "w").write(source)
            subprocess.run(
                ["qlmanage", "-t", "-s", str(master_px), "-o", tmp, src],
                check=True, capture_output=True)
            master = os.path.join(tmp, "icon.svg.png")
            if not os.path.exists(master):
                sys.exit(f"qlmanage produced nothing for {t['out']}")
            got = png_size(master)
            if got != (master_px, master_px):
                sys.exit(f"qlmanage rendered {got}, expected {master_px}px square")
            # sips would resample this, but it composites alpha onto white, which turns
            # the mark's rounded transparent corners into white boxes. Downscale here
            # instead so the alpha channel survives.
            downscale_png(master, t["out"], t["size"], chroma=chroma)
    return True


def build_og(width=1200, height=630, scale=2):
    """Rasterise og.svg into the social card at its native 1200x630.

    Quick Look only ever emits a square thumbnail and stretches the art to fill it, so
    a 1200x630 source comes out distorted. Padding the viewBox to a square first keeps
    the aspect ratio honest; the real region is then cropped back out and downscaled
    from `scale`x for antialiasing. Playwright, when present, needs none of this.
    """
    src = os.path.join(BRAND, "og.svg")
    out = os.path.join(BRAND, "og.png")
    if not os.path.exists(src):
        return
    if not shutil.which("qlmanage"):
        print("  og.png                             skipped (no qlmanage)")
        return

    svg = open(src).read()
    square = svg.replace(f'viewBox="0 0 {width} {height}"',
                         f'viewBox="0 0 {width} {width}"', 1)
    px = width * scale
    square = re.sub(r'\bwidth="%d"' % width, f'width="{px}"', square, count=1)
    square = re.sub(r'\bheight="%d"' % height, f'height="{px}"', square, count=1)

    with tempfile.TemporaryDirectory() as tmp:
        s = os.path.join(tmp, "og.svg")
        open(s, "w").write(square)
        subprocess.run(["qlmanage", "-t", "-s", str(px), "-o", tmp, s],
                       check=True, capture_output=True)
        master = os.path.join(tmp, "og.svg.png")
        if not os.path.exists(master):
            sys.exit("qlmanage produced no og.png")
        crop_downscale_png(master, out, width, height, scale)
    got = png_size(out)
    assert got == (width, height), f"og.png: expected {width}x{height}, got {got}"
    print(f"  {'assets/brand/og.png':34} {got[0]}x{got[1]}")


def crop_downscale_png(src, dst, width, height, scale):
    """Crop the top width*scale x height*scale of `src` and box-downscale by `scale`."""
    w, h, rows = _read_rgba(src)
    out = bytearray()
    for y in range(height):
        out.append(0)
        for x in range(width):
            r = g = b = a = 0
            for dy in range(scale):
                row = rows[y * scale + dy]
                for dx in range(scale):
                    p = (x * scale + dx) * 4
                    pa = row[p + 3]
                    r += row[p] * pa
                    g += row[p + 1] * pa
                    b += row[p + 2] * pa
                    a += pa
            n = scale * scale
            out += (bytes((round(r / a), round(g / a), round(b / a), round(a / n)))
                    if a else b"\0\0\0\0")

    def chunk(typ, payload):
        body = typ + payload
        return (struct.pack(">I", len(payload)) + body
                + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF))

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(out), 9))
    png += chunk(b"IEND", b"")
    open(dst, "wb").write(png)


def main():
    if not os.path.exists(SRC):
        sys.exit(f"missing {SRC}")

    spec = {
        "src": SRC,
        "targets": [
            {
                "out": os.path.join(ROOT, rel),
                "size": size,
                # iOS and the Organization logo want an opaque square; everything
                # else keeps the mark's rounded corners transparent.
                "bg": "#0b0d10" if rel.endswith(("apple-touch-icon.png", "icon-512.png"))
                      else "transparent",
            }
            for rel, size in TARGETS
        ],
    }

    # Node resolves `require('playwright')` from the script's own directory upward, so
    # the renderer has to live where the module is installed. PLAYWRIGHT_DIR points at
    # that directory when Playwright is not installed in this repo.
    node_dir = os.environ.get("PLAYWRIGHT_DIR") or ROOT
    script = os.path.join(node_dir, ".build-icons-render.js")
    with open(script, "w") as f:
        f.write(RENDER_JS)
    try:
        subprocess.run(["node", script, json.dumps(spec)], check=True, cwd=node_dir)
    except (FileNotFoundError, subprocess.CalledProcessError) as exc:
        # Playwright is the reference renderer, but it is not installed everywhere.
        # macOS Quick Look renders the same SVG well enough for flat icon art.
        print(f"  playwright unavailable ({type(exc).__name__}); trying qlmanage")
        if not render_qlmanage(spec):
            sys.exit("no renderer: install Node + Playwright, or run on macOS.")
    finally:
        os.unlink(script)

    build_ico(os.path.join(BRAND, "icon-48.png"), os.path.join(ROOT, "favicon.ico"))

    for rel, size in TARGETS:
        p = os.path.join(ROOT, rel)
        got = png_size(p)
        assert got == (size, size), f"{rel}: expected {size}x{size}, got {got}"
        print(f"  {rel:34} {got[0]}x{got[1]}")
    ico = os.path.join(ROOT, "favicon.ico")
    print(f"  {'favicon.ico':34} {os.path.getsize(ico)} bytes")

    build_og()


if __name__ == "__main__":
    main()
