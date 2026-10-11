#!/usr/bin/env node
/* Rendu public d'une page du banc, desktop et mobile : retouches appliquées,
   structure de la page, erreurs, requêtes externes coupées. Captures dans
   .local/production/resultats/ (privées : elles montrent le thème).

   node recette/rendu.mjs --base http://127.0.0.1:9410 --version 045 [--page /] */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { lancer, contexte, prive } from "./navigateur.mjs";

const args = process.argv.slice(2);
const option = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const base = option("base", "http://127.0.0.1:9410");
const version = option("version", "045");
const pagePath = option("page", "/");
const sortie = path.join(prive, "resultats");
mkdirSync(sortie, { recursive: true });

const profils = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};
const browser = await lancer();
const resultat = { base, version, page: pagePath, profils: {} };
for (const [nom, options] of Object.entries(profils)) {
  const context = await contexte(browser, version, options);
  const page = await context.newPage();
  const erreurs = [];
  page.on("pageerror", (e) => erreurs.push(String(e.message).slice(0, 160)));
  page.on("console", (m) => m.type() === "error" && erreurs.push(m.text().slice(0, 160)));
  await page.goto(base + pagePath, { waitUntil: "load" });
  await page.waitForTimeout(3000);
  resultat.profils[nom] = await page.evaluate(() => {
    const boite = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect(), s = getComputedStyle(el);
      return { x: Math.round(r.x), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height), translate: s.translate, width: s.width, maxWidth: s.maxWidth };
    };
    const logo = document.querySelector("img.logo__sceau");
    return {
      runtime: document.documentElement.hasAttribute("data-vt-runtime"),
      hauteur: document.documentElement.scrollHeight,
      sectionsMain: [...document.querySelectorAll("main > *")].map((n) => n.localName + (n.className ? "." + String(n.className).split(" ")[0] : "")),
      temoignages: document.querySelectorAll(".temoignage-carte").length,
      menu: [...document.querySelectorAll("#hdr nav li > a")].map((a) => new URL(a.href).pathname),
      bande: boite(document.querySelector("div.bande-lieu")),
      logo: boite(logo),
      logoCharge: logo ? logo.complete && logo.naturalWidth > 0 : null,
      canvasPluie: !!document.getElementById("pluie"),
      polices: [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family).filter((v, i, a) => a.indexOf(v) === i),
    };
  });
  resultat.profils[nom].erreurs = erreurs;
  resultat.profils[nom].hotesCoupes = [...context.coupees].sort();
  await page.screenshot({ path: path.join(sortie, `rendu-${version}-${nom}${pagePath.replace(/\W+/g, "-")}.png`), fullPage: true });
  await context.close();
}
await browser.close();
writeFileSync(path.join(sortie, `rendu-${version}${pagePath.replace(/\W+/g, "-")}.json`), JSON.stringify(resultat, null, 2));
console.log(JSON.stringify(resultat, null, 2));
