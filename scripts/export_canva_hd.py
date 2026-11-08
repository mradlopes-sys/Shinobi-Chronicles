#!/usr/bin/env python3
"""Baixa as artes originais do Canva e publica apenas imagens com dimensões de alta resolução."""
import io
import json
import pathlib
import urllib.parse
import urllib.request
from PIL import Image

root = pathlib.Path(__file__).resolve().parent.parent
items = json.loads((root / "scripts" / "canva_hd_sources.json").read_text())
out_dir = root / "assets" / "fichas-hd"
out_dir.mkdir(parents=True, exist_ok=True)
report = []
successful = 0
for entry in items:
    src = entry["url"]
    label = entry["name"]
    alternatives = [("Canva", src)]
    fallback = urllib.parse.parse_qs(urllib.parse.urlparse(src).query).get("fallback", [])
    if fallback:
        alternatives.append(("OriginalFallback", fallback[0]))
    done = False
    for method, url in alternatives:
        try:
            request = urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0", "Accept":"image/webp,image/png,image/jpeg,image/*"})
            with urllib.request.urlopen(request, timeout=35) as response:
                raw = response.read()
            art = Image.open(io.BytesIO(raw))
            art.load()
            report.append(f"{label} | {method}: {art.width}x{art.height}; {len(raw)} bytes")
            print(report[-1], flush=True)
            if art.width < 1900 or art.height < 2700:
                continue
            dest = out_dir / (label + ".jpg")
            art.convert("RGB").save(dest, format="JPEG", quality=96, subsampling=0, optimize=True)
            successful += 1
            done = True
            break
        except Exception as error:
            report.append(f"{label} | {method} failed: {str(error)[:300]}")
            print(report[-1], flush=True)
    if not done:
        report.append(f"{label} | high-resolution source unavailable")
(root / "canva-hd-export-status.txt").write_text("\n".join(report) + f"\nSUCCESSFUL {successful}/{len(items)}\n")
