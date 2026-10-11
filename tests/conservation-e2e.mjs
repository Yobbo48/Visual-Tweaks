// 0.4.4 — conservation des retouches pendant la navigation et les sauvegardes.
// Banc autonome (127.0.0.1:9410), un chemin de page par moteur. Chaque scénario
// vérifie les données de WordPress (REST) et le brouillon local, pas seulement
// l'interface : aucune retouche ne doit disparaître sans action explicite.
import { createRequire } from "node:module";
import { writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const require = createRequire(
  process.env.VT_BROWSER_TOOLCHAIN
    ? `${process.env.VT_BROWSER_TOOLCHAIN}/package.json`
    : new URL("../package.json", import.meta.url),
);
const engine = process.env.VT_ENGINE || "chromium";
const browser = await require("playwright")[engine].launch({
  headless: true,
  ...(engine === "chromium" && process.env.VT_CHROMIUM_PATH
    ? { executablePath: process.env.VT_CHROMIUM_PATH }
    : {}),
});
const base = "http://127.0.0.1:9410";
const route = (name) => `/?vt-test=conservation-${engine}-${name}`;
// Rejet non traité de WordPress (wp-preferences, chargé avec la médiathèque) quand
// on quitte la page pendant sa requête : identique en 0.4.3, sans lien avec
// Visual Tweaks. Consigné à part ; toute autre erreur fait échouer le test.
const coreErrors = [];
const isCoreRejection = (e) =>
  /^(\[object Object\]|Object)$/.test(e.message) &&
  (/wp-includes\/js\/dist\/preferences/.test(e.stack || "") ||
    (engine === "firefox" && !/https?:\/\//.test(e.stack || "")));
const checks = [],
  errors = [];
const record = (text) => {
  checks.push(text);
  console.log("PASS", `${engine}: ${text}`);
};
const context = await browser.newContext({
  viewport: { width: 1500, height: 1000 },
  acceptDownloads: true,
});
const page = await context.newPage();
let phase = "connexion";
page.on("pageerror", (e) => (isCoreRejection(e) ? coreErrors : errors).push(`${phase} : ${e.message} ${e.stack || ""}`.trim()));
page.on("dialog", (dialog) => dialog.accept());
const ui = (p, s) => p.locator(`#vt-editor-host ${s}`);
const title = (p) =>
  p.frameLocator("#vt-editor-host iframe").locator('[data-vt-id="hero-title"]');
const state = (p) => ui(p, "#state").textContent();
async function ready(p) {
  await p.waitForFunction(
    () => window.VisualTweaksEditor?.diagnostics().ready === true,
    null,
    { timeout: 30000 },
  );
  // WordPress (wp-preferences, chargé avec la médiathèque) rejette sans le
  // traiter une requête interrompue par un départ immédiat : attendre la fin
  // du chargement comme le ferait un utilisateur, sans masquer d'erreur.
  await p.waitForLoadState("networkidle");
}
async function open(p, path) {
  await p.goto(base + path + "&vt-edit=1");
  await ready(p);
}
async function api(p, method, body) {
  return p.evaluate(
    async ({ method, body }) => {
      const cfg = window.VisualTweaksConfig.editor;
      const url =
        method === "GET"
          ? `${cfg.api}${cfg.api.includes("?") ? "&" : "?"}page=${encodeURIComponent(body.page)}`
          : cfg.api;
      const r = await fetch(url, {
        method,
        headers: { "X-WP-Nonce": cfg.nonce, "Content-Type": "application/json" },
        ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
      });
      return { status: r.status, data: await r.json() };
    },
    { method, body },
  );
}
async function stored(p, path) {
  return (await api(p, "GET", { page: path })).data;
}
const translateX = (data) =>
  data.elements.find((e) => e.id === "hero-title")?.changes?.desktop?.translateX;
async function reset(p, path) {
  await open(p, path);
  const old = await stored(p, path);
  await api(p, "PUT", { page: path, revision: old.revision, elements: [] });
  await p.evaluate(() => {
    for (const key of Object.keys(localStorage))
      if (key.startsWith("visual-tweaks:")) localStorage.removeItem(key);
  });
  await open(p, path);
}
async function nudge(p, times) {
  await title(p).click();
  await p.waitForFunction(() => !!window.VisualTweaksEditor.diagnostics().selected);
  for (let i = 0; i < times; i++) await p.keyboard.press("ArrowRight");
}
async function saveAndWait(p) {
  await ui(p, "#save").click();
  await ui(p, "#state").filter({ hasText: /^Enregistré$/ }).waitFor();
}
await mkdir("artifacts", { recursive: true });
try {
  // Connexion vers l'accueil, pas le tableau de bord : quitter celui-ci aussitôt
  // interrompt ses requêtes (test de compression, actualités), que WebKit sous
  // Linux signale comme erreurs de page, en 0.4.4 comme en 0.4.5 (0.4.5, CI).
  await page.goto(
    base + "/wp-login.php?redirect_to=" + encodeURIComponent(base + "/"),
  );
  await page.waitForTimeout(250);
  await page.locator("#user_login").fill("vt-admin");
  await page.locator("#user_pass").fill("vt-local-only-9410");
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("wp-login")),
    page.locator("#wp-submit").click(),
  ]);

  // 1. Modifier puis changer immédiatement de page, revenir, retour arrière.
  {
    phase = "changement de page";
    const a = route("immediate"),
      b = route("other");
    await reset(page, a);
    const before = await stored(page, a);
    await nudge(page, 3);
    let unloadPrompt = false;
    page.once("dialog", (d) => (unloadPrompt = d.type() === "beforeunload"));
    await open(page, b);
    assert.equal((await stored(page, a)).revision, before.revision);
    await open(page, a);
    assert.equal(await state(page), "Modifications non enregistrées");
    assert.equal(
      await page.evaluate(
        () => window.VisualTweaksEditor.diagnostics().recoveryPending,
      ),
      false,
    );
    await saveAndWait(page);
    assert.equal(translateX(await stored(page, a)), "3px");
    await open(page, b);
    await page.goBack();
    await ready(page);
    assert.equal(await state(page), "Enregistré");
    record(
      `changement de page immédiat : brouillon conservé et restauré, puis enregistré (3px), retour arrière cohérent${unloadPrompt ? ", départ protégé" : ""}`,
    );
  }

  // 2. Quitter pendant qu'une sauvegarde est en cours, avec une retouche faite
  //    pendant l'envoi : WordPress garde la sauvegarde, la retouche suivante
  //    est restaurée sur la nouvelle révision, sans conflit.
  {
    phase = "départ pendant une sauvegarde";
    const a = route("inflight");
    await reset(page, a);
    const r0 = (await stored(page, a)).revision;
    await nudge(page, 2);
    let committed;
    const done = new Promise((resolve) => (committed = resolve));
    await page.route(/visual-tweaks\/v1\/page/, async (r) => {
      if (r.request().method() !== "PUT") return r.continue();
      const response = await r.fetch(); // WordPress enregistre…
      committed();
      await new Promise((resolve) => setTimeout(resolve, 4000)); // …réponse retardée
      await r.fulfill({ response }).catch(() => {});
    });
    await ui(page, "#save").click();
    await done;
    await page.keyboard.press("ArrowRight"); // retouche faite pendant l'envoi
    assert.notEqual(await state(page), "Enregistré");
    await open(page, route("other")); // départ avant la réponse
    await page.unroute(/visual-tweaks\/v1\/page/);
    const server = await stored(page, a);
    assert.equal(server.revision, r0 + 1);
    assert.equal(translateX(server), "2px");
    await open(page, a);
    assert.equal(
      await page.evaluate(
        () => window.VisualTweaksEditor.diagnostics().recoveryPending,
      ),
      false,
    );
    assert.equal(await state(page), "Modifications non enregistrées");
    await saveAndWait(page);
    const after = await stored(page, a);
    assert.equal(after.revision, r0 + 2);
    assert.equal(translateX(after), "3px");
    record(
      "départ pendant une sauvegarde : révision envoyée conservée (2px), retouche suivante restaurée puis enregistrée sans conflit (3px)",
    );
  }

  // 3. Réponses refusées ou illisibles : jamais « Enregistré », brouillon gardé,
  //    reprise possible. Jeton expiré : renouvelé puis requête rejouée.
  {
    phase = "erreurs";
    const a = route("errors");
    await reset(page, a);
    await nudge(page, 4);
    await page.route(/visual-tweaks\/v1\/page/, (r) =>
      r.request().method() === "PUT"
        ? r.fulfill({ status: 502, contentType: "text/html", body: "<html>Bad gateway</html>" })
        : r.continue(),
    );
    await ui(page, "#save").click();
    await ui(page, "#global-error").waitFor({ state: "visible" });
    assert.match(await ui(page, "#global-error").textContent(), /HTTP 502/);
    assert.match(await ui(page, "#global-error").textContent(), /brouillon est conservé/);
    assert.equal(await state(page), "Modifications non enregistrées");
    await page.unroute(/visual-tweaks\/v1\/page/);
    await page.route(/visual-tweaks\/v1\/page/, (r) =>
      r.request().method() === "PUT" ? r.abort("internetdisconnected") : r.continue(),
    );
    await ui(page, "#save").click();
    await ui(page, "#global-error").filter({ hasText: /Connexion interrompue/ }).waitFor();
    assert.equal(await state(page), "Modifications non enregistrées");
    await page.unroute(/visual-tweaks\/v1\/page/);
    assert.equal(translateX(await stored(page, a)), undefined);
    await page.evaluate(() => {
      window.VisualTweaksConfig.editor.nonce = "0000000000";
    });
    const puts = [];
    page.on("request", (q) => {
      if (q.method() === "PUT" && q.url().includes("visual-tweaks")) puts.push(q);
    });
    await saveAndWait(page);
    assert.equal(puts.length, 2);
    assert.equal(translateX(await stored(page, a)), "4px");
    record(
      "HTTP 502 illisible et coupure réseau : message clair, brouillon conservé, jamais « Enregistré » ; jeton expiré renouvelé puis requête rejouée (4px)",
    );
  }

  // 3b. Réponse perdue alors que WordPress a enregistré : la sauvegarde suivante
  //     reconnaît son propre envoi (pas de faux conflit) et envoie la suite.
  {
    phase = "réponse perdue";
    const a = route("lost");
    await reset(page, a);
    const r0 = (await stored(page, a)).revision;
    await nudge(page, 2);
    await page.route(/visual-tweaks\/v1\/page/, async (r) => {
      if (r.request().method() !== "PUT") return r.continue();
      await r.fetch(); // WordPress enregistre…
      await r.abort("connectionreset"); // …la réponse n'arrive jamais
    });
    await ui(page, "#save").click();
    await ui(page, "#global-error").filter({ hasText: /Connexion interrompue/ }).waitFor();
    await page.unroute(/visual-tweaks\/v1\/page/);
    assert.equal((await stored(page, a)).revision, r0 + 1);
    assert.equal(await state(page), "Modifications non enregistrées");
    await page.keyboard.press("ArrowRight");
    await ui(page, "#save").click();
    await ui(page, "#state").filter({ hasText: /^Enregistré$/ }).waitFor();
    assert.equal(await ui(page, "#conflict-actions").count(), 0);
    const after = await stored(page, a);
    assert.equal(after.revision, r0 + 2);
    assert.equal(translateX(after), "3px");
    record("réponse perdue après enregistrement : propre envoi reconnu (pas de faux conflit), retouche suivante enregistrée (3px)");
  }

  // 4. Deux onglets sur la même page : avertissement, conflit refusé par
  //    WordPress, brouillon conservé, remplacement explicite avec export.
  {
    phase = "onglets";
    const a = route("tabs");
    await reset(page, a);
    const other = await context.newPage();
    other.on("dialog", (d) => d.accept());
    await open(other, a);
    await page.waitForFunction(
      () =>
        document.querySelector("#vt-editor-host").shadowRoot.querySelector(".shell")
          .dataset.sharedPage === "true",
    );
    await nudge(other, 1);
    await saveAndWait(other);
    await nudge(page, 5);
    await ui(page, "#save").click();
    await ui(page, "#conflict-actions").waitFor();
    assert.equal(translateX(await stored(page, a)), "1px");
    assert.equal(await state(page), "Modifications non enregistrées");
    const backup = page.waitForEvent("download");
    await ui(page, "#conflict-actions button:nth-child(2)").click();
    const file = await backup;
    assert.match(file.suggestedFilename(), /version-enregistree-r\d+\.json/);
    await ui(page, "#state").filter({ hasText: /^Enregistré$/ }).waitFor();
    assert.equal(translateX(await stored(page, a)), "5px");
    await other.close();
    record(
      "deux onglets : autre onglet signalé, conflit refusé sans écraser (1px), remplacement explicite après export de la version enregistrée (5px)",
    );
  }

  // 5. Rapport de publication : sans cache de page géré, l'éditeur ne prétend
  //    pas que les visiteurs voient déjà la nouvelle version.
  {
    phase = "publication";
    const a = route("cache");
    await reset(page, a);
    await nudge(page, 1);
    const answer = page.waitForResponse(
      (r) => r.request().method() === "PUT" && r.url().includes("visual-tweaks"),
    );
    await saveAndWait(page);
    const body = await (await answer).json();
    assert.equal(body.cache.litespeed, "absent");
    assert.equal(body.cache.url, base + a);
    assert.match(await ui(page, "#message").textContent(), /révision \d+/);
    assert.match(await ui(page, "#message").textContent(), /videz-le/);
    record("publication : état du cache rapporté (LiteSpeed absent), message sans fausse promesse");
  }
  assert.deepEqual(errors, []);
  record(`aucune erreur JavaScript de Visual Tweaks${coreErrors.length ? ` (${coreErrors.length} rejet(s) de wp-preferences consigné(s))` : ""}`);
} finally {
  await writeFile(
    `artifacts/conservation-${engine}-test-report.json`,
    JSON.stringify({ engine, checks, errors, coreErrors }, null, 2),
  );
  await browser.close();
}
