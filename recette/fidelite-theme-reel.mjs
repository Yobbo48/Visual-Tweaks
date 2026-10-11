#!/usr/bin/env node
/* Fidélité sur le thème réel : bande et logo, desktop (1440) et mobile (390).
   - premier affichage : CSS imprimé par le serveur seul (JavaScript coupé) ;
   - site publié : après le runtime ;
   - éditeur : aperçu, écran Desktop puis Mobile.
   Mêmes valeurs attendues partout, égales aux retouches enregistrées, sans
   double application (translate et dimensions jamais cumulés).

   node recette/fidelite-theme-reel.mjs --base http://127.0.0.1:9410 --version 045 */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { lancer, contexte, connecter, prive } from "./navigateur.mjs";

const args = process.argv.slice(2);
const option = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const base = option("base", "http://127.0.0.1:9410");
const version = option("version", "045");
const engine = process.env.VT_ENGINE || "chromium";
const ATTENDU = {
  desktop: { bande: { translate: "0px -18px" }, logo: { translate: "-14px", width: "60px", height: "60px", maxWidth: "60px" } },
  mobile: { bande: { translate: "0px -7px" }, logo: { translate: "-14px", width: "60px", height: "60px", maxWidth: "60px" } },
};
const PROFILS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};
const mesurer = (racine) =>
  racine.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming?.().iterations !== Infinity).map((a) => a.finished.catch(() => {})));
    const lire = (sel) => {
      const n = document.querySelector(sel);
      if (!n) return null;
      const s = getComputedStyle(n), r = n.getBoundingClientRect();
      return { translate: s.translate, width: s.width, height: s.height, maxWidth: s.maxWidth, boite: [r.x, r.y + scrollY, r.width, r.height].map((v) => Math.round(v * 2) / 2) };
    };
    return { runtime: document.documentElement.hasAttribute("data-vt-runtime"), bande: lire("div.bande-lieu"), logo: lire("img.logo__sceau") };
  });
const conforme = (m, attendu) => {
  for (const [cible, props] of Object.entries(attendu))
    for (const [k, v] of Object.entries(props)) assert.equal(m[cible]?.[k], v, `${cible}.${k}`);
};

const controles = [], releves = {};
const reussi = (t) => (controles.push(t), console.log("PASS", `${version} ${engine}: ${t}`));
const browser = await lancer({ engine });
try {
  for (const [profil, options] of Object.entries(PROFILS)) {
    // Premier affichage : serveur seul.
    const sansJs = await contexte(browser, version, { ...options, javaScriptEnabled: false });
    const p1 = await sansJs.newPage();
    await p1.goto(base + "/", { waitUntil: "load" });
    const serveur = await mesurer(p1.locator("body"));
    await sansJs.close();
    // Site publié, après le runtime.
    const avecJs = await contexte(browser, version, options);
    const p2 = await avecJs.newPage();
    await p2.goto(base + "/", { waitUntil: "load" });
    await p2.waitForFunction(() => document.documentElement.hasAttribute("data-vt-runtime"));
    await p2.waitForTimeout(1500);
    const publie = await mesurer(p2.locator("body"));
    await avecJs.close();
    assert.equal(serveur.runtime, false);
    assert.equal(publie.runtime, true);
    conforme(serveur, ATTENDU[profil]);
    conforme(publie, ATTENDU[profil]);
    assert.deepEqual(publie.bande.boite, serveur.bande.boite, "bande : premier affichage = publié");
    assert.deepEqual(publie.logo.boite, serveur.logo.boite, "logo : premier affichage = publié");
    releves[profil] = { serveur, publie };
    reussi(`${profil} : premier affichage (CSS serveur seul) = site publié après runtime ; bande ${publie.bande.translate}, logo ${publie.logo.width} × ${publie.logo.height} translate ${publie.logo.translate} ; aucune double application`);
  }

  // Éditeur : aperçu Desktop puis Mobile.
  const ctx = await contexte(browser, version, { viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  await connecter(page, base);
  await page.goto(base + "/?vt-edit=1");
  await page.waitForFunction(() => window.VisualTweaksEditor?.diagnostics().ready === true, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const cadre = () => page.frameLocator("#vt-editor-host iframe").locator("body");
  for (const profil of ["desktop", "mobile"]) {
    await page.locator(`#vt-editor-host [data-mode="${profil}"]`).click();
    await page.waitForTimeout(1500);
    const largeur = await cadre().evaluate(() => innerWidth);
    const editeur = await mesurer(cadre());
    conforme(editeur, ATTENDU[profil]);
    releves[profil].editeur = { largeur, ...editeur };
    if (largeur === PROFILS[profil].viewport.width) {
      assert.deepEqual(editeur.bande.boite, releves[profil].publie.bande.boite, `bande : éditeur = publié (${profil})`);
      assert.deepEqual(editeur.logo.boite, releves[profil].publie.logo.boite, `logo : éditeur = publié (${profil})`);
      reussi(`éditeur ${profil} (${largeur} px) : bande et logo aux mêmes valeurs et aux mêmes boîtes que le site publié`);
    } else reussi(`éditeur ${profil} (${largeur} px) : bande et logo aux valeurs enregistrées (boîtes non comparées, largeur différente du site publié)`);
  }
  await ctx.close();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  writeFileSync(path.join(prive, `resultats/fidelite-${version}-${engine}.json`), JSON.stringify({ engine, version, controles, releves }, null, 2));
  await browser.close();
}
