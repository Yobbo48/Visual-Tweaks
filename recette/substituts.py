#!/usr/bin/env python3
"""Substituts de banc pour les médias absents des fichiers fournis.

Le logo de production n'est pas fourni : un disque neutre, marqué
« SUBSTITUT », est créé au chemin et aux dimensions que donne l'empreinte de
la retouche du logo (src exact) dans l'export des options. Original 512 px,
vignette aux dimensions du src.

    python3 -I recette/substituts.py
Écrit dans .local/production/substituts/ (exclu de Git)."""
import json
import re
from pathlib import Path

from PIL import Image, ImageDraw

prive = Path(__file__).resolve().parent.parent / ".local/production"
export = json.loads((prive / "recu/visual-tweaks-options-production.json").read_text())
src = None
for o in export["options"]:
    valeur = o.get("value")
    for e in valeur.get("elements", []) if isinstance(valeur, dict) else []:
        fp = e.get("fingerprint", {})
        if fp.get("tag") == "img" and "logo__sceau" in fp.get("classes", []):
            src = fp.get("src")
if not src:
    raise SystemExit("Retouche du logo absente de l'export : aucun substitut à créer.")
m = re.search(r"/wp-content/uploads/((\d{4}/\d{2})/(.+?))-(\d+)x(\d+)\.(\w+)$", src)
fichier, dossier, l, h, ext = m.group(1), m.group(2), int(m.group(4)), int(m.group(5)), m.group(6)
sortie = prive / "substituts" / dossier
sortie.mkdir(parents=True, exist_ok=True)
img = Image.new("RGB", (512, 512), (24, 30, 28))
d = ImageDraw.Draw(img)
d.ellipse((40, 40, 472, 472), outline=(184, 134, 78), width=18)
d.text((200, 230), "SUBSTITUT", fill=(184, 134, 78))
original = prive / "substituts" / fichier
img.save(original, "JPEG", quality=85)
img.resize((l, h), Image.LANCZOS).save(sortie / f"{Path(fichier).name}-{l}x{h}.{ext}", ext.upper())
print("substituts :", sorted(p.name for p in sortie.iterdir()))
