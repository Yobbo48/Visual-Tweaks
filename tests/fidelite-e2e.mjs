// 0.4.4 — fidélité entre éditeur, site publié et premier affichage.
// Pour une même révision, compare les styles calculés et les contenus de chaque
// cible à 1440, 820 et 390 px :
//   E  éditeur (cadre de prévisualisation, écran Desktop/Tablette/Mobile) ;
//   P  site publié, visiteur anonyme, runtime initialisé (cache froid puis chaud) ;
//   F  premier affichage : runtime.js bloqué, CSS serveur seul.
// E = P pour tout ; F = P sauf écarts attendus et nommés (mesures du runtime,
// contenus du DOM, translation propre au thème, cible ambiguë).
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
const path = `/?vt-test=fidelite-${engine}`;
// Rejet non traité de WordPress (wp-preferences, chargé avec la médiathèque) quand
// on quitte la page pendant sa requête : identique en 0.4.3, sans lien avec
// Visual Tweaks. Consigné à part ; toute autre erreur fait échouer le test.
const coreErrors = [];
const isCoreRejection = (e) =>
  /^(\[object Object\]|Object)$/.test(e.message) &&
  (/wp-includes\/js\/dist\/preferences/.test(e.stack || "") ||
    (engine === "firefox" && !/https?:\/\//.test(e.stack || "")));
const checks = [],
  errors = [],
  report = {};
const record = (text) => {
  checks.push(text);
  console.log("PASS", `${engine}: ${text}`);
};
const SCREENS = { desktop: 1440, tablet: 820, mobile: 390 };
const PROPS = [
  "font-size", "letter-spacing", "color", "translate", "text-align", "width", "height",
  "object-position", "object-view-box", "padding-top", "margin-left", "line-height",
  "font-weight", "opacity", "max-width", "background-color", "border-top-left-radius",
  "border-top-width", "border-top-style", "border-top-color", "box-shadow",
  "text-transform", "font-style", "font-family", "z-index", "position",
  "background-position", "background-image",
];
const TARGETS = {
  title: '[data-vt-id="hero-title"]',
  phone: '[data-vt-id="hero-phone"]',
  intro: "p.intro",
  cta: "a.cta",
  card: "#card-title",
  background: '[data-vt-id="fixture-background"]',
  cards: "article.card",
};
// Retouches couvrant dimensions, espacements, déplacements (dont translation du
// thème), typographie, couleurs, bordures, ombre, image zoomée, fond avec voile,
// texte, lien et exceptions responsive.
const CHANGES = {
  title: { changes: { desktop: { "font-size": "52px", "letter-spacing": "1px", color: "#8a2b2b", translateX: "6px" }, tablet: { "font-size": "40px" }, mobile: { "text-align": "center", "font-size": "30px" } }, content: { text: "Titre fidèle" } },
  phone: { changes: { desktop: { translateY: "-25px", width: "200px", height: "280px", imageZoom: "120", "object-position": "30% 40%" }, mobile: { translateX: "10px" } } },
  intro: { changes: { desktop: { "padding-top": "12px", "margin-left": "8px", "line-height": "1.8", "font-weight": "700", opacity: "0.8" }, tablet: { "max-width": "300px" } } },
  cta: { changes: { desktop: { "background-color": "#224466", "border-radius": "4px", "border-width": "2px", "border-style": "solid", "border-color": "#ff0000", "box-shadow": "0px 4px 12px 0px #00000033" } }, content: { href: "https://example.test/fidele" } },
  card: { changes: { desktop: { "text-transform": "uppercase", "font-style": "italic", "font-family": "Georgia, serif", "z-index": "3", position: "relative" } } },
  background: { changes: { desktop: { "overlay-color": "#00000066", "background-position": "20% 30%" } } },
};
async function login(context) {
  const page = await context.newPage();
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
  return page;
}
const snapshot = ([targets, props]) => {
  const out = {};
  for (const [name, selector] of Object.entries(targets)) {
    const nodes = [...document.querySelectorAll(selector)];
    out[name] = nodes.map((node) => {
      const style = getComputedStyle(node);
      return {
        style: Object.fromEntries(props.map((p) => [p, style.getPropertyValue(p)])),
        text: node.localName === "h1" ? node.textContent : undefined,
        href: node.localName === "a" ? node.getAttribute("href") : undefined,
        target: node.getAttribute("data-vt-target"),
      };
    });
  }
  return out;
};
function diff(a, b) {
  const out = [];
  for (const name of Object.keys(a))
    a[name].forEach((node, i) => {
      for (const key of ["text", "href"])
        if (node[key] !== b[name][i]?.[key]) out.push(`${name}[${i}].${key}`);
      for (const [p, v] of Object.entries(node.style))
        if (v !== b[name][i]?.style[p]) out.push(`${name}[${i}].${p}: ${v} ≠ ${b[name][i]?.style[p]}`);
    });
  return out;
}
await mkdir("artifacts", { recursive: true });
try {
  const editorContext = await browser.newContext({ viewport: { width: 1700, height: 1100 } });
  const editor = await login(editorContext);
  editor.on("pageerror", (e) => (isCoreRejection(e) ? coreErrors : errors).push(`éditeur : ${e.message} ${e.stack || ""}`.trim()));
  editor.on("dialog", (d) => d.accept());
  const putPage = (elements) =>
    editor.evaluate(async ({ page, elements }) => {
      const cfg = window.VisualTweaksConfig.editor;
      const current = await (await fetch(`${cfg.api}?page=${encodeURIComponent(page)}`, { headers: { "X-WP-Nonce": cfg.nonce } })).json();
      const r = await fetch(cfg.api, { method: "PUT", headers: { "X-WP-Nonce": cfg.nonce, "Content-Type": "application/json" }, body: JSON.stringify({ page, revision: current.revision, elements }) });
      return { status: r.status, data: await r.json() };
    }, { page: path, elements });
  await editor.goto(base + path + "&vt-edit=1");
  await editor.waitForFunction(() => window.VisualTweaksEditor?.diagnostics().ready === true);
  await editor.waitForLoadState("networkidle"); // voir conservation-e2e.mjs (wp-preferences)
  // Empreintes relevées sur la page du thème, sans retouche d'un passage précédent.
  assert.equal((await putPage([])).status, 200);
  await editor.reload();
  await editor.waitForFunction(() => window.VisualTweaksEditor?.diagnostics().ready === true);
  await editor.waitForLoadState("networkidle");
  // Identités produites par le code de sélection de l'extension elle-même.
  const elements = await editor.evaluate(async ({ targets, changes }) => {
    const frame = document.querySelector("#vt-editor-host").shadowRoot.querySelector("iframe");
    const { identify } = await frame.contentWindow.eval(
      `import(${JSON.stringify(new URL("../assets/selection.js", document.querySelector('script[src*="visual-tweaks/assets/editor.js"]').src).href)})`,
    );
    const out = [];
    for (const [name, spec] of Object.entries(changes)) {
      const node = frame.contentDocument.querySelector(targets[name]);
      out.push({ ...identify(node), ...spec });
    }
    return out;
  }, { targets: TARGETS, changes: CHANGES });
  // Une retouche dont le sélecteur désigne deux éléments (page modifiée depuis).
  elements.push({ id: "vt-ambigue", selector: "article.card", strategy: "class", fingerprint: { tag: "article", classes: ["card"] }, changes: { desktop: { "background-color": "#ffcc00" } } });
  const saved = await putPage(elements);
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  report.revision = saved.data.revision;
  await editor.reload();
  await editor.waitForFunction(() => window.VisualTweaksEditor?.diagnostics().ready === true);
  await editor.waitForLoadState("networkidle");
  const unresolved = await editor.evaluate(() => window.VisualTweaksEditor.diagnostics().unresolvedTargets);
  assert.deepEqual(unresolved, ["article.card"]);
  assert.match(await editor.locator("#vt-editor-host #message").textContent(), /introuvable/);
  record("cible ambiguë signalée dans l'éditeur, retouche conservée dans les données");

  const frame = () => editor.frames().find((f) => f.url().includes("vt-frame"));
  const publicContext = await browser.newContext();
  // Téléphone : écran tactile et densité 2 (profil mobile complet hors Firefox).
  const phoneContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    ...(engine === "firefox" ? {} : { isMobile: true }),
  });
  for (const [screen, width] of Object.entries(SCREENS)) {
    await editor.locator(`#vt-editor-host [data-mode="${screen}"]`).click();
    await editor.waitForFunction((w) => {
      const f = document.querySelector("#vt-editor-host").shadowRoot.querySelector("iframe");
      return f.contentWindow.innerWidth === w;
    }, width);
    await editor.waitForTimeout(300);
    const E = await frame().evaluate(snapshot, [TARGETS, PROPS]);
    const visit = async (blockRuntime) => {
      const page = await (screen === "mobile" ? phoneContext : publicContext).newPage();
      if (screen !== "mobile") await page.setViewportSize({ width, height: 900 });
      if (blockRuntime) await page.route(/visual-tweaks\/assets\/runtime\.js/, (r) => r.abort());
      page.on("pageerror", (e) => (isCoreRejection(e) ? coreErrors : errors).push(`publié ${screen}${blockRuntime ? " (runtime bloqué)" : ""} : ${e.message} ${e.stack || ""}`.trim()));
      await page.goto(base + path);
      if (blockRuntime) await page.waitForLoadState("load");
      else await page.waitForFunction(() => !!window.VisualTweaksRuntime);
      await page.waitForTimeout(150);
      const value = await page.evaluate(snapshot, [TARGETS, PROPS]);
      const relay = await page.evaluate(() => ({
        media: document.getElementById("vt-published-styles")?.media ?? null,
        lock: document.documentElement.hasAttribute("data-vt-runtime"),
      }));
      await page.close();
      return { value, relay };
    };
    const P = await visit(false);
    const warm = await visit(false);
    const F = await visit(true);
    report[screen] = { E, P: P.value, F: F.value };
    assert.deepEqual(diff(E, P.value), [], `${screen} : éditeur ≠ publié`);
    assert.deepEqual(diff(P.value, warm.value), [], `${screen} : froid ≠ chaud`);
    assert.equal(P.relay.media, "not all");
    assert.equal(P.relay.lock, true);
    assert.equal(F.relay.media, "");
    assert.equal(F.relay.lock, false);
    // Écarts attendus entre premier affichage (serveur) et runtime.
    const expected = new Set([
      "title[0].text", // texte : mutation du DOM par le runtime
      "title[0].height", // hauteur du titre : dépend du texte (retour à la ligne)
      "cta[0].href", // lien : idem
      "phone[0].translate", // translation propre au thème : base mesurée par le runtime
      "background[0].background-image", // voile : mesure du fond par le runtime
      "background[0].background-position", // une valeur par couche, voile compris (vérifiée ci-dessous)
      "cards[0].background-color", // cible ambiguë : CSS serveur sur les deux cartes…
      "cards[1].background-color", // …retiré par le runtime, qui ne l'applique à aucune
    ]);
    const firstPaint = diff(F.value, P.value).filter((d) => !expected.has(d.split(":")[0]));
    assert.deepEqual(firstPaint, [], `${screen} : premier affichage ≠ publié`);
    // Valeurs de référence : aucune double application, translation du thème composée.
    const phone = P.value.phone[0].style.translate;
    const themeBase = { desktop: [5, 3], tablet: [2, 7], mobile: [0, 12] }[screen];
    const delta = screen === "mobile" ? [10, -25] : [0, -25];
    assert.equal(phone, `${themeBase[0] + delta[0]}px ${themeBase[1] + delta[1]}px`);
    assert.equal(F.value.phone[0].style.translate, `${delta[0]}px ${delta[1]}px`);
    assert.equal(F.value.background[0].style["background-position"], "20% 30%");
    // Chromium répète la position pour chaque couche, Firefox et WebKit non.
    assert.match(P.value.background[0].style["background-position"], /^20% 30%(, 20% 30%)?$/);
    assert.equal(P.value.title[0].text, "Titre fidèle");
    assert.equal(P.value.cta[0].href, "https://example.test/fidele");
    assert.ok(P.value.cards.every((c) => c.style["background-color"] !== "rgb(255, 204, 0)"));
    assert.ok(F.value.cards.every((c) => c.style["background-color"] === "rgb(255, 204, 0)"));
    record(
      `${screen} ${width}px : éditeur = publié (froid et chaud) pour ${Object.keys(TARGETS).length} cibles × ${PROPS.length} propriétés ; premier affichage = publié hors écarts nommés ; translation du thème composée (${phone}) sans double application`,
    );
  }

  // Retrait d'une retouche : retour exact au style du thème.
  const pristineContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pristine = await pristineContext.newPage();
  await pristine.goto(base + `/?vt-test=fidelite-temoin-${engine}`);
  const before = await pristine.evaluate(snapshot, [{ intro: "p.intro", card: "#card-title" }, PROPS]);
  const removed = await editor.evaluate(async (page) => {
    const cfg = window.VisualTweaksConfig.editor;
    const current = await (await fetch(`${cfg.api}?page=${encodeURIComponent(page)}`, { headers: { "X-WP-Nonce": cfg.nonce } })).json();
    const elements = current.elements.filter((e) => !["p.intro", "#card-title"].includes(e.selector));
    const r = await fetch(cfg.api, { method: "PUT", headers: { "X-WP-Nonce": cfg.nonce, "Content-Type": "application/json" }, body: JSON.stringify({ page, revision: current.revision, elements }) });
    return r.status;
  }, path);
  assert.equal(removed, 200);
  for (const blockRuntime of [false, true]) {
    const page = await publicContext.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    if (blockRuntime) await page.route(/visual-tweaks\/assets\/runtime\.js/, (r) => r.abort());
    await page.goto(base + path);
    if (!blockRuntime) await page.waitForFunction(() => !!window.VisualTweaksRuntime);
    const after = await page.evaluate(snapshot, [{ intro: "p.intro", card: "#card-title" }, PROPS]);
    assert.deepEqual(diff(before, after), [], `retrait ${blockRuntime ? "premier affichage" : "runtime"}`);
    await page.close();
  }
  record("retrait de deux retouches : retour exact au style du thème, au premier affichage comme après le runtime");
  assert.deepEqual(errors, []);
  record(`aucune erreur JavaScript de Visual Tweaks${coreErrors.length ? ` (${coreErrors.length} rejet(s) de wp-preferences consigné(s))` : ""}`);
} finally {
  await writeFile(`artifacts/fidelite-${engine}-test-report.json`, JSON.stringify({ engine, checks, errors, coreErrors, report }, null, 2));
  await browser.close();
}
