#!/usr/bin/env python3
"""Cria versões 2x das fichas existentes com super-resolução FSRCNN."""
from pathlib import Path
from urllib.request import urlopen, Request
import os, sys
from PIL import Image, ImageFilter, ImageEnhance
import numpy as np
import cv2

ROOT = Path(__file__).resolve().parent.parent
output = ROOT / "assets" / "fichas-hd"
output.mkdir(parents=True, exist_ok=True)
model = Path("/tmp/shinobi-fsrcnn-x2.pb")
engine = None
try:
    url = "https://raw.githubusercontent.com/moveontech/opencv_super_resolution/master/FSRCNN_x2.pb"
    with urlopen(Request(url, headers={"User-Agent":"Mozilla/5.0"}),timeout=30) as response:
        model.write_bytes(response.read())
    engine = cv2.dnn_superres.DnnSuperResImpl_create()
    engine.readModel(str(model))
    engine.setModel("fsrcnn",2)
    print("FSRCNN 2x carregado.",flush=True)
except Exception as err:
    print(f"Modelo neural indisponível, usando Lanczos: {err}",flush=True)
    engine = None

clans = ["uchiha","senju","uzumaki","hyuga","aburame","nara","inuzuka","akimichi","yamanaka","sarutobi","hatake","semcla"]
modes = [("aburame",1)] if os.getenv("SHINOBI_HD_TEST")=="1" else [(c,p) for c in clans for p in range(1,5)]
saved = []
for clan,page in modes:
    name = f"{clan}-{page}"
    source = ROOT / f"{name}.jpg"
    if not source.exists():
        print(f"Faltando {source}",flush=True)
        continue
    img = Image.open(source).convert("RGB")
    if engine:
        bgr=cv2.cvtColor(np.array(img),cv2.COLOR_RGB2BGR)
        enhanced=engine.upsample(bgr)
        result=Image.fromarray(cv2.cvtColor(enhanced,cv2.COLOR_BGR2RGB))
    else:
        result=img.resize((img.width*2,img.height*2),Image.Resampling.LANCZOS)
    # Recuperar contornos suavemente, sem distorcer a aquarela nem as coordenadas.
    result=result.filter(ImageFilter.UnsharpMask(radius=1.05,percent=85,threshold=3))
    dest=output / f"{name}.jpg"
    result.save(dest,format="JPEG",quality=96,subsampling=0,optimize=True)
    if name=="aburame-1":
        preview=ROOT / "assets" / "fichas-hd-preview"
        preview.mkdir(parents=True,exist_ok=True)
        result.resize(img.size,Image.Resampling.LANCZOS).save(preview / "aburame-1.jpg",quality=84,optimize=True)
    saved.append(name)
    print(f"{name} {img.size} -> {result.size}: {dest.stat().st_size} bytes",flush=True)
(ROOT / "upscale-fichas-status.txt").write_text(f"Model: {'FSRCNN 2x' if engine else 'Lanczos'}\nFiles: {len(saved)}\n"+ "\n".join(saved))
