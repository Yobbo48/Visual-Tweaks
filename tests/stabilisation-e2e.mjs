import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
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
const context = await browser.newContext({
    viewport: { width: 1400, height: 1000 },
  }),
  page = await context.newPage();
const base = "http://127.0.0.1:9411",
  route = `/?vt-test=stabilisation-${engine}`,
  checks = [],
  errors = [];
const ui = (s) => page.locator("#vt-editor-host " + s),
  frame = () => page.frameLocator("#vt-editor-host iframe");
page.on("pageerror", (e) => errors.push(e.message));
const record = (text) => {
  checks.push(text);
  console.log("PASS", text);
};
const ready = () =>
  page.waitForFunction(() => window.VisualTweaksEditor?.diagnostics().ready);
const clean = () =>
  ui("#state")
    .filter({ hasText: /^Enregistré$/ })
    .waitFor();
const dirty = () =>
  ui("#state")
    .filter({ hasText: /^Modifications non enregistrées$/ })
    .waitFor();
const local = () =>
  page.evaluate(() =>
    JSON.parse(
      localStorage.getItem(
        `visual-tweaks:${location.origin}:${VisualTweaksConfig.editor.userId}:${VisualTweaksConfig.page}`,
      ),
    ),
  );
async function api(method, body) {
  return page.evaluate(
    async ({ method, body }) => {
      const cfg = VisualTweaksConfig.editor;
      const r = await fetch(
        cfg.api +
          (method === "GET" ? "?page=" + encodeURIComponent(body.page) : ""),
        {
          method,
          headers: {
            "Content-Type": "application/json",
            "X-WP-Nonce": cfg.nonce,
          },
          ...(method === "PUT" ? { body: JSON.stringify(body) } : {}),
        },
      );
      return { status: r.status, data: await r.json() };
    },
    { method, body },
  );
}
const geometry = (n) => {
  const box = n.getBoundingClientRect();
  return {
    x: box.x + scrollX,
    y: box.y + scrollY,
    width: box.width,
    height: box.height,
  };
};
page.setDefaultTimeout(10000);
const group = async (name) => {
  const d = ui(`#panel details[data-group="${name}"]`);
  if ((await d.getAttribute("open")) === null)
    await d.locator(":scope > summary").click();
};
const property = async (name, value) => {
  const n = ui(`#panel [data-property="${name}"]`);
  await n.fill(value);
  await n.press("Tab");
};
try {
  await page.goto(
    base +
      "/wp-login.php?redirect_to=" +
      encodeURIComponent(base + route + "&vt-edit=1"),
  );
  await page.waitForTimeout(250);
  await page.locator("#user_login").fill("vt-admin");
  await page.locator("#user_pass").fill("vt-local-only-9410");
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("wp-login")),
    page.locator("#wp-submit").click(),
  ]);
  await ready();
  const old = await api("GET", { page: route });
  assert.equal(
    (
      await api("PUT", {
        page: route,
        revision: old.data.revision,
        elements: [],
      })
    ).status,
    200,
  );
  await page.reload();
  await ready();
  await frame()
    .locator("body")
    .evaluate(() => document.fonts.ready);
  const target = frame().locator(".hero-intro");
  await target.click();
  await target.press("ArrowRight");
  await dirty();
  assert.equal((await local()).elements.length, 1);
  await ui("#undo").click();
  await clean();
  await target.press("Shift+ArrowRight");
  await dirty();
  record(
    "Thème réel : sélection, mutation utilisateur, brouillon, dirty et Undo dans une session continue",
  );

  await ui("#structure-tab").click();
  await ui(".structure-item.is-selected .tree-pick").click();
  assert.equal(await ui(".structure-item.is-selected").count(), 1);
  await group("spacing");
  await property("margin-top", "-4");
  await property("padding-left", "8");
  assert.equal(
    await target.evaluate((n) => getComputedStyle(n).paddingLeft),
    "8px",
  );
  await ui('#panel [data-reset-group="spacing"]').click();
  assert.equal(
    await target.evaluate((n) => getComputedStyle(n).paddingLeft),
    "0px",
  );
  assert.equal((await local()).elements[0].changes.desktop.translateX, "10px");
  record(
    "Structure reste synchronisée ; margin/padding visibles puis reset restitue le thème sans supprimer le déplacement",
  );

  await target.dblclick();
  await frame()
    .locator("[data-vt-inline-edit]")
    .fill("Retouche locale validée — contenu simple.");
  await ui('#context-toolbar [data-action="size"]').count();
  await ui("#review-button").click();
  assert.equal(await ui("#review-changes article").count(), 1);
  await ui("#review-changes article")
    .getByRole("button", { name: "Voir", exact: true })
    .click();
  assert.equal(
    await target.textContent(),
    "Retouche locale validée — contenu simple.",
  );
  record(
    "Texte inline, fin de saisie, Modifications → Voir et sélection globale cohérents",
  );

  await ui("#assets-tab").click();
  const portrait = ui("#inventory .asset-card").filter({
    hasText: "Kevin Legros, concepteur",
  });
  const disclosure = portrait.locator("xpath=ancestor::details[1]");
  if ((await disclosure.getAttribute("open")) === null)
    await disclosure.locator(":scope > summary").click();
  assert.ok(await disclosure.locator(".asset-thumb").count());
  await portrait
    .getByRole("button", { name: "Sélectionner", exact: true })
    .click();
  const image = frame().locator(".pack-portrait img");
  const selectionScroll = await image.evaluate(async (n) => {
    const samples = [scrollY];
    for (let i = 0; i < 5; i++) {
      await new Promise(requestAnimationFrame);
      samples.push(scrollY);
    }
    const r = n.getBoundingClientRect();
    return {
      samples,
      themeScroll: getComputedStyle(document.documentElement).scrollBehavior,
      visible: r.top < innerHeight && r.bottom > 0,
    };
  });
  await writeFile(
    `artifacts/selection-scroll-${engine}.json`,
    JSON.stringify(selectionScroll, null, 2),
  );
  assert.equal(
    selectionScroll.themeScroll,
    "smooth",
    "Real theme exercises animated native scrolling",
  );
  assert.equal(selectionScroll.visible, true);
  assert.ok(
    Math.max(...selectionScroll.samples) -
      Math.min(...selectionScroll.samples) <
      1,
    "Assets selection is stable immediately despite the theme smooth scroll; toolbar does not chase an animated target",
  );

  await ui("#structure-tab").click();
  assert.equal(await ui(".structure-item.is-selected").count(), 1);
  await image.press("ArrowDown");
  const originalWidth = await image.evaluate(
    (n) => n.getBoundingClientRect().width,
  );
  await group("size");
  await property("width", "320px");
  assert.ok(
    (await image.evaluate((n) => n.getBoundingClientRect().width)) <
      originalWidth,
  );
  await ui('#context-toolbar [data-action="center"]').click();
  assert.equal(
    await page.evaluate(() => VisualTweaksEditor.diagnostics().selected),
    "figure.pack-portrait > img",
    "Toolbar click keeps the selected image instead of reaching the section behind",
  );
  const aligned = await image.evaluate((n) => {
    const a = n.getBoundingClientRect(),
      b = n.parentElement.getBoundingClientRect();
    return Math.abs((a.left + a.right) / 2 - (b.left + b.right) / 2);
  });
  assert.ok(
    aligned < 2,
    "Image resized then horizontally centered in its real parent",
  );
  await ui("#reset-element").click();
  assert.ok(
    Math.abs(
      (await image.evaluate((n) => n.getBoundingClientRect().width)) -
        originalWidth,
    ) < 1,
  );
  record(
    "Assets : miniature réelle, occurrence sélectionnée dans canvas/Structure ; taille puis reset exact",
  );

  await image.click();
  const corner = await ui('[data-corner="ne"]').boundingBox();
  await page.mouse.move(
    corner.x + corner.width / 2,
    corner.y + corner.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    corner.x + corner.width / 2 - 30,
    corner.y + corner.height / 2 + 30,
    { steps: 5 },
  );
  await page.mouse.up();
  assert.ok(
    (await image.evaluate((n) => n.getBoundingClientRect().width)) <
      originalWidth - 5,
  );
  await ui("#undo").click();
  assert.ok(
    Math.abs(
      (await image.evaluate((n) => n.getBoundingClientRect().width)) -
        originalWidth,
    ) < 1,
  );
  record(
    "Thème réel : poignée sous canvas zoomé, taille logique réduite, proportions et Undo exacts ; centrage visible après taille",
  );

  await page.evaluate(async () => {
    const cfg = VisualTweaksConfig.editor,
      root = cfg.api.replace("visual-tweaks/v1/page", "wp/v2/media");
    const list = await (
      await fetch(root + "?search=VT%20stabilisation%20replacement", {
        headers: { "X-WP-Nonce": cfg.nonce },
      })
    ).json();
    if (!list.length) {
      const body = Uint8Array.from(
        atob(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
        ),
        (c) => c.charCodeAt(0),
      );
      const response = await fetch(root, {
        method: "POST",
        headers: {
          "X-WP-Nonce": cfg.nonce,
          "Content-Type": "image/png",
          "Content-Disposition":
            'attachment; filename="vt-stabilisation-replacement.png"',
        },
        body,
      });
      if (!response.ok)
        throw new Error("Local test media upload failed: " + response.status);
      const media = await response.json();
      await fetch(root + "/" + media.id, {
        method: "POST",
        headers: {
          "X-WP-Nonce": cfg.nonce,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: "VT stabilisation replacement" }),
      });
    }
  });
  await ui("#replace-image").click();
  await page.locator(".media-modal:visible #menu-item-browse").click();
  await page
    .locator(
      '.media-modal:visible .attachment[aria-label*="VT stabilisation replacement"]',
    )
    .click();
  await page.locator(".media-modal:visible .media-button-select").click();
  await image.evaluate((n) => n.decode());
  assert.match(
    await image.getAttribute("src"),
    /vt-stabilisation-replacement.png/,
  );
  await ui("#undo").click();
  assert.doesNotMatch(
    await image.getAttribute("src"),
    /vt-stabilisation-replacement.png/,
  );
  await ui("#redo").click();
  record(
    "Médiathèque : remplacement image sans reconstruire le bloc, Undo/Redo fidèles",
  );

  await target.click();
  for (const mode of ["tablet", "mobile", "desktop", "mobile"])
    await ui(`[data-mode="${mode}"]`).click();
  await target.press("ArrowLeft");
  const draft = await local();
  assert.equal(
    draft.elements.find((e) => e.content?.text).changes.mobile.translateX,
    "9px",
  );
  await ui('[data-mode="desktop"]').click();
  await ui("#test-responsive").click();
  await ui('#responsive-report [data-screen="mobile"]').waitFor();
  const recommendations = await ui("#responsive-report article").evaluateAll(
    (rows) =>
      rows.map((n) => ({
        screen: n.parentElement.dataset.screen,
        kind: n.dataset.kind,
        text: n.textContent,
      })),
  );
  assert.deepEqual(await local(), draft);
  await ui("#responsive-report")
    .getByRole("button", { name: "Fermer", exact: true })
    .click();
  const classification = await frame()
    .locator("body")
    .evaluate(async () => {
      const src = [...document.scripts]
        .find((n) => n.src.includes("/assets/runtime.js"))
        .src.replace("runtime.js", "responsive-guard.js");
      const { ResponsiveGuard } = await import(src);
      const g = Object.create(ResponsiveGuard.prototype);
      g.runtime = () => VisualTweaksRuntime;
      g.elements = () => [];
      g.metrics = { elementsExamined: 0 };
      const result = g.snapshot(document, "desktop", (n) => n, new Set());
      return result.issues.map((i) => ({
        kind: i.kind,
        text: i.node.textContent.trim().slice(0, 120),
        label: i.node.getAttribute("aria-label"),
        width: i.node.getBoundingClientRect().width,
        height: i.node.getBoundingClientRect().height,
        hiddenAncestor: !!i.node.closest('[hidden],[aria-hidden="true"]'),
        classification:
          i.kind === "touch"
            ? "pertinente : zone mesurée sous 24 px, recommandation non bloquante"
            : "à examiner",
      }));
    });
  record(
    "Desktop/Tablette/Mobile : exceptions explicites, audit sans mutation ; recommandations du thème inventoriées individuellement",
  );

  await ui("#interaction-browse").click();
  await frame()
    .locator("#apropos summary")
    .filter({ hasText: "Faire connaissance" })
    .click();
  const afterBrowse = await local();
  assert.deepEqual(afterBrowse, draft);
  await ui("#interaction-edit").click();
  await ui("#save").click();
  await clean();
  const saved = await api("GET", { page: route });
  assert.equal(saved.status, 200);
  await page.reload();
  await ready();
  assert.equal(
    await target.textContent(),
    "Retouche locale validée — contenu simple.",
  );
  await ui("#exit").click();
  await page.waitForURL((u) => !u.searchParams.has("vt-edit"));
  await page.locator("#wp-admin-bar-visual-tweaks a").click();
  await ready();
  await clean();
  assert.deepEqual(
    (await api("GET", { page: route })).data.elements,
    saved.data.elements,
  );
  record(
    "Naviguer conserve le draft ; save → refresh → quitter → revenir recharge la même sauvegarde",
  );

  const anon = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    pub = await anon.newPage();
  await pub.goto(base + route);
  await pub.waitForFunction(() => !!window.VisualTweaksRuntime);
  await pub.evaluate(() => document.fonts.ready);
  assert.equal(
    await pub.locator(".hero-intro").textContent(),
    "Retouche locale validée — contenu simple.",
  );
  assert.match(
    await pub.locator(".pack-portrait img").getAttribute("src"),
    /vt-stabilisation-replacement.png/,
  );
  const editorBox = await target.evaluate(geometry),
    publicBox = await pub.locator(".hero-intro").evaluate(geometry);
  for (const key of Object.keys(editorBox))
    assert.ok(
      Math.abs(editorBox[key] - publicBox[key]) < 2,
      `${key}: preview/public`,
    );
  await anon.close();
  record(
    "Rendu public anonyme identique : texte, image et géométrie logique à 1440 px",
  );
  const invalid = structuredClone(saved.data.elements);
  invalid.find((e) => e.content?.text).changes.desktop.width = "NaNpx";
  await page.evaluate(
    ({ elements, revision }) => {
      const c = VisualTweaksConfig;
      localStorage.setItem(
        `visual-tweaks:${location.origin}:${c.editor.userId}:${c.page}`,
        JSON.stringify({ page: c.page, revision, elements }),
      );
    },
    { elements: invalid, revision: saved.data.revision },
  );
  await page.reload();
  await ready();
  assert.equal(
    await page.evaluate(() => VisualTweaksEditor.diagnostics().recoveryPending),
    true,
  );
  assert.equal(
    (await local()).elements.find((e) => e.content?.text).changes.desktop.width,
    "NaNpx",
  );
  await ui("#recovery")
    .getByRole("button", { name: "Récupérer le brouillon local", exact: true })
    .click();
  await ui("#save").click();
  await ui("#global-error").waitFor({ state: "visible" });
  assert.match(await ui("#global-error").textContent(), /Largeur invalide/);
  assert.equal(
    (await local()).elements.find((e) => e.content?.text).changes.desktop.width,
    "NaNpx",
  );
  await target.click();
  await group("size");
  await property("width", "");
  await clean();
  assert.equal(
    await ui('#panel [data-property="width"]').getAttribute("placeholder"),
    await target.evaluate((n) => getComputedStyle(n).width),
    "Clearing an invalid recovered width shows the current site width, not a stale override",
  );
  assert.equal(await local(), null);
  assert.deepEqual(
    (await api("GET", { page: route })).data.elements,
    saved.data.elements,
  );
  record(
    "Recovery invalide : décision explicite, message clair et largeur refusée conservée ; suppression explicite restitue exactement la sauvegarde",
  );
  assert.deepEqual(errors, []);
  await page.screenshot({ path: `artifacts/stabilisation-${engine}.png` });
  await writeFile(
    `artifacts/stabilisation-${engine}.json`,
    JSON.stringify(
      {
        engine,
        checks,
        errors,
        classification,
        recommendations,
        saved: saved.data,
        editorBox,
        publicBox,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await page.screenshot({
    path: `artifacts/stabilisation-${engine}-failure.png`,
  });
  throw error;
} finally {
  await browser.close();
}
