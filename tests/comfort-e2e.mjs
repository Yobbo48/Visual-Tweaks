import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const require = createRequire(
  process.env.VT_BROWSER_TOOLCHAIN
    ? `${process.env.VT_BROWSER_TOOLCHAIN}/package.json`
    : new URL("../package.json", import.meta.url),
);
const engine = process.env.VT_ENGINE || "chromium",
  phase = Number(process.env.VT_PHASE || 9);
const browser = await require("playwright")[engine].launch({
  headless: true,
  ...(engine === "chromium" && process.env.VT_CHROMIUM_PATH
    ? { executablePath: process.env.VT_CHROMIUM_PATH }
    : {}),
});
const context = await browser.newContext({
    viewport: { width: 1560, height: 1050 },
  }),
  page = await context.newPage();
const base = "http://127.0.0.1:9410",
  route = `/?vt-test=comfort-${engine}`,
  checks = [],
  errors = [],
  performanceSamples = {};
const ui = (s) => page.locator("#vt-editor-host " + s),
  frame = () => page.frameLocator("#vt-editor-host iframe"),
  node = (id) => frame().locator(`[data-vt-id="${id}"]`);
page.on("pageerror", (e) => errors.push(e.message));
const ready = () =>
  page.waitForFunction(() => VisualTweaksEditor?.diagnostics().ready);
const clean = () =>
  ui("#state")
    .filter({ hasText: /^Enregistré$/ })
    .waitFor();
const dirty = () =>
  ui("#state")
    .filter({ hasText: /^Modifications non enregistrées$/ })
    .waitFor();
const record = (text) => {
  checks.push(text);
  console.log("PASS", text);
};
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
async function select(id) {
  await node(id).evaluate((n) => n.scrollIntoView({ block: "center" }));
  await node(id).click();
}
async function group(name) {
  const d = ui(`#panel details[data-group="${name}"]`);
  if ((await d.getAttribute("open")) === null)
    await d.locator(":scope > summary").click();
}
async function createGuideAsset() {
  await node("hero-title").evaluate((n) => {
    if (n.ownerDocument.querySelector('[data-vt-id="guide-asset"]')) return;
    const parent = n.ownerDocument.createElement("div");
    parent.dataset.vtId = "guide-parent";
    parent.style.cssText =
      "width:400px;height:250px;position:relative;padding:0;margin:30px 0";
    const child = n.ownerDocument.createElement("img");
    child.dataset.vtId = "guide-asset";
    child.src = n.ownerDocument.querySelector('[data-vt-id="hero-phone"]').src;
    child.style.cssText =
      "display:block;width:100px;height:100px;margin-left:100px;padding:0;border:0;transform:none";
    parent.append(child);
    n.ownerDocument.querySelector("main").append(parent);
  });
}
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
  const initial = await api("GET", { page: route });
  assert.equal(
    (
      await api("PUT", {
        page: route,
        revision: initial.data.revision,
        elements: [],
      })
    ).status,
    200,
  );
  await page.reload();
  await ready();
  await clean();
  await select("hero-title");
  await node("hero-title").press("ArrowRight");
  await dirty();
  assert.equal((await local()).elements[0].changes.desktop.translateX, "1px");
  await ui("#undo").click();
  await clean();
  assert.equal(await local(), null);
  await node("hero-title").press("ArrowRight");
  await dirty();
  await ui("#save").click();
  await clean();
  await page.reload();
  await ready();
  assert.equal(
    await node("hero-title").evaluate(
      (n) => getComputedStyle(n).translate.split(" ")[0],
    ),
    "1px",
  );
  await ui("#exit").click();
  await page.waitForURL((u) => !u.searchParams.has("vt-edit"));
  assert.equal(await page.locator("#vt-editor-host").count(), 0);
  await page.goto(base + route + "&vt-edit=1");
  await ready();
  await clean();
  assert.equal(
    await node("hero-title").evaluate(
      (n) => getComputedStyle(n).translate.split(" ")[0],
    ),
    "1px",
  );
  record(
    "Smoke complet : ouvrir/sélectionner/modifier/draft/undo/save/refresh/quitter/revenir",
  );
  await ui("#review-button").click();
  assert.equal(await ui("#review-changes article").count(), 1);
  assert.match(
    await ui("#review-changes article").innerText(),
    /Déplacement : X 1px/,
  );
  await ui("#review-changes article")
    .getByRole("button", { name: "Voir", exact: true })
    .click();
  assert.equal(await ui("#properties").isVisible(), true);
  assert.equal(
    await page.evaluate(() => VisualTweaksEditor.diagnostics().selected),
    '[data-vt-id="hero-title"]',
  );
  assert.equal(await ui(".structure-item.is-selected").count(), 1);
  await ui("#review-button").click();
  await ui("#review-changes article")
    .getByRole("button", { name: "Réinitialiser", exact: true })
    .click();
  await dirty();
  assert.equal(await ui("#review-changes article").count(), 0);
  await ui("#review-changes")
    .getByRole("button", { name: "Fermer", exact: true })
    .click();
  await ui("#undo").click();
  await clean();
  await ui("#review-button").click();
  assert.equal(await ui("#review-changes article").count(), 1);
  page.once("dialog", (d) => d.dismiss());
  await ui("#review-changes")
    .getByRole("button", {
      name: "Réinitialiser toutes les modifications de cette page",
      exact: true,
    })
    .click();
  assert.equal(await ui("#review-changes article").count(), 1);
  page.once("dialog", (d) => d.accept());
  await ui("#review-changes")
    .getByRole("button", {
      name: "Réinitialiser toutes les modifications de cette page",
      exact: true,
    })
    .click();
  assert.equal(await ui("#review-changes article").count(), 0);
  await ui("#review-changes")
    .getByRole("button", { name: "Fermer", exact: true })
    .click();
  await ui("#undo").click();
  await clean();
  record(
    "Modifications dérivées du draft : Voir synchronise Structure, reset annulable, reset page confirmé",
  );
  if (phase >= 2) {
    await select("hero-title");
    await node("hero-title").press("ArrowRight");
    await dirty();
    const before = await local(),
      selected = await page.evaluate(
        () => VisualTweaksEditor.diagnostics().selected,
      );
    await node("hero-title").evaluate((n) => {
      const b = n.ownerDocument.createElement("button");
      b.id = "browse-test";
      b.textContent = "Ouvrir le menu";
      b.onclick = () => {
        b.textContent = "Menu ouvert";
      };
      n.after(b);
    });
    await ui("#interaction-browse").click();
    assert.equal(await ui(".selected").isVisible(), false);
    await frame().locator("#browse-test").click();
    assert.equal(
      await frame().locator("#browse-test").textContent(),
      "Menu ouvert",
    );
    await node("hero-title").click();
    assert.equal(
      await page.evaluate(() => VisualTweaksEditor.diagnostics().selected),
      selected,
    );
    assert.deepEqual(await local(), before);
    const popupPromise = context.waitForEvent("page");
    await frame().locator(".cta").click();
    const popup = await popupPromise;
    await popup.waitForLoadState();
    assert.match(popup.url(), /second=1/);
    await popup.close();
    await ui("#interaction-edit").click();
    assert.equal(await ui(".selected").isVisible(), true);
    assert.deepEqual(await local(), before);
    await node("hero-title").press("ArrowRight");
    await dirty();
    assert.equal((await local()).elements[0].changes.desktop.translateX, "3px");
    await ui("#undo").click();
    assert.deepEqual(await local(), before);
    await ui("#undo").click();
    await clean();
    record(
      "Naviguer : interactions et liens actifs, aucune sélection/mutation, draft et sélection conservés au retour Modifier",
    );
  }
  if (phase >= 3) {
    await createGuideAsset();
    await select("guide-asset");
    const gesture = async (control = false) => {
      const started = performance.now();
      const scale = await page.evaluate(
          () => VisualTweaksViewport.diagnostics().zoom,
        ),
        box = await ui(".drag").boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      if (control) await page.keyboard.down("Control");
      await page.mouse.down();
      await page.mouse.move(
        box.x + box.width / 2 + 47 * scale,
        box.y + box.height / 2,
        { steps: 8 },
      );
      await page.waitForTimeout(80);
      assert.equal(
        (await local())?.elements.some((e) => e.id === "guide-asset") || false,
        false,
      );
      assert.equal(await ui(".smart-guides").isVisible(), !control);
      await page.mouse.up();
      if (control) await page.keyboard.up("Control");
      if (!control)
        performanceSamples.drag = {
          interactionWallMs: performance.now() - started,
          includesTestWaitMs: 80,
          diagnostics: await page.evaluate(() =>
            VisualTweaksEditor.diagnostics(),
          ),
        };
      await dirty();
    };
    await gesture();
    assert.equal(
      (await local()).elements.find((e) => e.id === "guide-asset").changes
        .desktop.translateX,
      "50px",
    );
    await ui("#undo").click();
    await clean();
    await ui("#redo").click();
    await dirty();
    await ui("#undo").click();
    await clean();
    await gesture(true);
    const unsnapped = parseFloat(
      (await local()).elements.find((e) => e.id === "guide-asset").changes
        .desktop.translateX,
    );
    assert.ok(unsnapped >= 45 && unsnapped <= 48);
    await ui("#undo").click();
    await clean();
    record(
      "Guides et snap en pixels CSS sous zoom, Ctrl sans conflit Alt/Cmd, aucun draft pendant le geste et une étape Undo",
    );
  }
  if (phase >= 4) {
    await select("hero-title");
    await ui('[data-mode="mobile"]').click();
    await group("size");
    assert.ok((await ui('[data-inherited-from="desktop"]').count()) > 0);
    await clean();
    assert.equal(await local(), null);
    await ui('#panel [data-property="width"]').fill("220px");
    await dirty();
    assert.equal(
      await ui('[data-mode="mobile"]').getAttribute("data-has-overrides"),
      "true",
    );
    assert.equal(
      (await local()).elements.find((e) => e.id === "hero-title").changes
        .desktop.width,
      undefined,
    );
    await ui("#undo").click();
    await clean();
    assert.equal(
      await ui('[data-mode="mobile"]').getAttribute("data-has-overrides"),
      "false",
    );
    await ui('[data-mode="desktop"]').click();
    await clean();
    record(
      "Indicateurs par écran et héritage explicite : ouvrir/changer d’écran ne crée aucun override",
    );
  }
  if (phase >= 5) {
    await select("hero-title");
    await group("size");
    await ui('#panel [data-property="translateX"]').fill("180px");
    await dirty();
    await node("hero-title").click();
    const before = await local(),
      selection = await page.evaluate(
        () => VisualTweaksEditor.diagnostics().selected,
      ),
      viewport = await page.evaluate(
        () => VisualTweaksViewport.diagnostics().logicalViewport,
      );
    await ui("#test-responsive").click();
    await ui('#responsive-report [data-screen="mobile"]').waitFor();
    assert.deepEqual(await local(), before);
    assert.equal(
      await page.evaluate(() => VisualTweaksEditor.diagnostics().selected),
      selection,
    );
    assert.deepEqual(
      await page.evaluate(
        () => VisualTweaksViewport.diagnostics().logicalViewport,
      ),
      viewport,
    );
    assert.equal(
      await ui(
        '#responsive-report [data-screen="desktop"] [data-kind="overflow"]',
      ).count(),
      0,
    );
    assert.ok(
      (await ui(
        '#responsive-report [data-screen="mobile"] [data-kind="overflow"][data-target="responsive-wide"]',
      ).count()) > 0,
    );
    for (const kind of ["shift", "touch", "clipped-text", "overlap"])
      assert.ok(
        (await ui(
          `#responsive-report [data-screen="mobile"] [data-kind="${kind}"]`,
        ).count()) > 0,
        kind,
      );
    assert.equal(
      await ui("#responsive-report")
        .getByRole("button", { name: "Appliquer", exact: true })
        .count(),
      0,
    );
    const timings = await page.evaluate(
      () => VisualTweaksEditor.diagnostics().responsive,
    );
    assert.ok(timings.durationMs > 0);
    assert.ok(timings.elementsExamined > 0);
    performanceSamples.responsiveAudit = timings;
    await ui("#responsive-report")
      .getByRole("button", { name: "Fermer", exact: true })
      .click();
    await ui("#undo").click();
    await clean();
    assert.equal(
      await page.evaluate(
        () => VisualTweaksEditor.diagnostics().responsive.stale,
      ),
      true,
    );
    record(
      "Responsive Guard en lecture seule : overflow réel, déplacement hérité, petite cible, texte coupé et collision nouvelle ; state/viewport/sélection intacts",
    );
  }
  if (phase >= 6) {
    await ui("#test-responsive").click();
    await ui('#responsive-report [data-screen="mobile"]').waitFor();
    const issue = ui(
      '#responsive-report [data-screen="mobile"] [data-kind="overflow"][data-target="responsive-wide"]',
    );
    assert.equal(await local(), null);
    await issue
      .getByRole("button", {
        name: "Prévisualiser une correction",
        exact: true,
      })
      .click();
    assert.ok(
      (await node("responsive-wide").evaluate(
        (n) => n.getBoundingClientRect().width,
      )) < 400,
    );
    assert.equal(await local(), null);
    await clean();
    await ui("#responsive-report")
      .getByRole("button", { name: "Annuler l’aperçu", exact: true })
      .click();
    assert.equal(
      await node("responsive-wide").evaluate(
        (n) => n.getBoundingClientRect().width,
      ),
      920,
    );
    await clean();
    await issue
      .getByRole("button", {
        name: "Prévisualiser une correction",
        exact: true,
      })
      .click();
    await page.keyboard.press("Escape");
    assert.equal(await ui("#responsive-report").isVisible(), false);
    assert.equal(
      await node("responsive-wide").evaluate(
        (n) => n.getBoundingClientRect().width,
      ),
      920,
    );
    assert.equal(await local(), null);
    await ui("#test-responsive").click();
    await ui('#responsive-report [data-screen="mobile"]').waitFor();
    await issue
      .getByRole("button", {
        name: "Prévisualiser une correction",
        exact: true,
      })
      .click();
    await ui("#responsive-report")
      .getByRole("button", { name: "Ignorer", exact: true })
      .click();
    assert.equal(await issue.count(), 0);
    assert.equal(await local(), null);
    assert.equal(
      await node("responsive-wide").evaluate(
        (n) => n.getBoundingClientRect().width,
      ),
      920,
    );
    await ui("#responsive-report")
      .getByRole("button", { name: "Fermer", exact: true })
      .click();
    await ui("#test-responsive").click();
    await ui('#responsive-report [data-screen="mobile"]').waitFor();
    await issue
      .getByRole("button", {
        name: "Prévisualiser une correction",
        exact: true,
      })
      .click();
    await ui("#responsive-report")
      .getByRole("button", { name: "Appliquer", exact: true })
      .click();
    await dirty();
    const correction = (await local()).elements.find(
      (e) => e.id === "responsive-wide",
    );
    assert.deepEqual(correction.changes.mobile, { "max-width": "100%" });
    assert.equal(correction.changes.desktop, undefined);
    await ui("#review-button").click();
    assert.ok(
      await ui('#review-changes [data-entry-id="responsive-wide"]').count(),
    );
    await ui("#review-changes")
      .getByRole("button", { name: "Fermer", exact: true })
      .click();
    await ui("#undo").click();
    await clean();
    assert.equal(
      await node("responsive-wide").evaluate(
        (n) => n.getBoundingClientRect().width,
      ),
      920,
    );
    await ui("#redo").click();
    await dirty();
    await ui("#save").click();
    await clean();
    await page.reload();
    await ready();
    await ui('[data-mode="mobile"]').click();
    assert.ok(
      (await node("responsive-wide").evaluate(
        (n) => n.getBoundingClientRect().width,
      )) < 400,
    );
    const anon = await browser.newContext({
        viewport: { width: 390, height: 900 },
      }),
      publicPage = await anon.newPage();
    await publicPage.goto(base + route);
    await publicPage.waitForFunction(() => !!window.VisualTweaksRuntime);
    assert.ok(
      (await publicPage
        .locator('[data-vt-id="responsive-wide"]')
        .evaluate((n) => n.getBoundingClientRect().width)) < 400,
    );
    await anon.close();
    await ui('[data-mode="desktop"]').click();
    assert.equal(
      await node("responsive-wide").evaluate(
        (n) => n.getBoundingClientRect().width,
      ),
      920,
    );
    record(
      "Correction mobile : proposition, aperçu non persistant, annulation/Échap/ignorer, application explicite, Review/Undo/Redo/save/refresh et rendu public",
    );
  }
  if (phase >= 7) {
    await select("comfort-multi");
    const original = await node("comfort-multi").evaluate((n) => {
      const s = getComputedStyle(n);
      return {
        image: s.backgroundImage,
        position: s.backgroundPosition,
        size: s.backgroundSize,
        repeat: s.backgroundRepeat,
      };
    });
    await ui('#panel [data-background-layer="1"]').click();
    await page.locator(".media-modal:visible #menu-item-browse").click();
    await page
      .locator('.media-modal:visible .attachment[aria-label*="VT replacement"]')
      .click();
    await page.locator(".media-modal:visible .media-button-select").click();
    await dirty();
    const changed = await node("comfort-multi").evaluate((n) => {
      const s = getComputedStyle(n);
      return {
        image: s.backgroundImage,
        position: s.backgroundPosition,
        size: s.backgroundSize,
        repeat: s.backgroundRepeat,
      };
    });
    const layers = await import("../visual-tweaks/assets/background-layers.js");
    assert.equal(
      layers.splitBackground(changed.image)[0],
      layers.splitBackground(original.image)[0],
    );
    assert.equal(
      layers.splitBackground(changed.image)[2],
      layers.splitBackground(original.image)[2],
    );
    assert.match(
      layers.splitBackground(changed.image)[1],
      /vt-replacement.png/,
    );
    for (const key of ["position", "size", "repeat"])
      assert.equal(changed[key], original[key]);
    const entry = (await local()).elements.find(
      (e) => e.id === "comfort-multi",
    );
    assert.equal(entry.content.backgroundLayers[0].layer, 1);
    assert.ok(Number.isInteger(entry.content.backgroundLayers[0].attachmentId));
    assert.equal(entry.content.backgroundLayers[0].raw, undefined);
    await ui("#undo").click();
    assert.equal(
      await node("comfort-multi").evaluate(
        (n) => getComputedStyle(n).backgroundImage,
      ),
      original.image,
    );
    await ui("#redo").click();
    await ui("#save").click();
    await clean();
    await page.reload();
    await ready();
    assert.equal(
      await node("comfort-multi").evaluate(
        (n) => getComputedStyle(n).backgroundImage,
      ),
      changed.image,
    );
    const document = await api("GET", { page: route }),
      bad = structuredClone(document.data.elements);
    bad.find(
      (e) => e.id === "comfort-multi",
    ).content.backgroundLayers[0].layer = -1;
    assert.equal(
      (
        await api("PUT", {
          page: route,
          revision: document.data.revision,
          elements: bad,
        })
      ).status,
      400,
    );
    const anon = await browser.newContext({
        viewport: { width: 1440, height: 900 },
      }),
      publicPage = await anon.newPage();
    await publicPage.goto(base + route);
    await publicPage.waitForFunction(() => !!window.VisualTweaksRuntime);
    assert.equal(
      await publicPage
        .locator('[data-vt-id="comfort-multi"]')
        .evaluate((n) => getComputedStyle(n).backgroundImage),
      changed.image,
    );
    await anon.close();
    record(
      "Fond multicouche : remplacement média de la seule couche choisie, gradient/autres images/position/size/repeat conservés, Undo/save/refresh/public et validation stricte",
    );
  }
  if (phase >= 8) {
    await createGuideAsset();
    await select("guide-asset");
    const before = await local();
    await ui('[data-action="more"]').click();
    await ui("[data-measure]").click();
    assert.match(
      await ui('[data-measurement="size"]').innerText(),
      /Largeur 100 px/,
    );
    assert.match(
      await ui('[data-measurement="parent"]').innerText(),
      /gauche 100 px/,
    );
    assert.deepEqual(await local(), before);
    await ui(".context-popover")
      .getByRole("button", { name: "Fermer", exact: true })
      .click();
    await select("hero-title");
    await group("size");
    const input = ui('#panel [data-property="translateX"]');
    const timings = await page.evaluate(async () => {
      const root = document.querySelector("#vt-editor-host").shadowRoot,
        editor = VisualTweaksEditor;
      const measure = (fn) => {
        const t = performance.now();
        fn();
        return performance.now() - t;
      };
      const baseline = editor.diagnostics(),
        coldAssetsMs = measure(() => root.querySelector("#assets-tab").click()),
        warmStructureMs = measure(() =>
          root.querySelector("#structure-tab").click(),
        ),
        warmAssetsMs = measure(() => root.querySelector("#assets-tab").click());
      root.querySelector("#structure-tab").click();
      const input = root.querySelector('#panel [data-property="translateX"]');
      const propertyMs = measure(() => {
        input.value = "2px";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      const paintStart = performance.now();
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      return {
        coldAssetsMs,
        warmStructureMs,
        warmAssetsMs,
        propertyMs,
        nextPaintMs: performance.now() - paintStart,
        before: baseline,
        after: editor.diagnostics(),
      };
    });
    assert.equal(
      timings.after.responsive.audits,
      timings.before.responsive.audits,
    );
    await dirty();
    await ui("#undo").click();
    await clean();
    await writeFile(
      `artifacts/profile-0.4-${engine}.json`,
      JSON.stringify({ ...timings, ...performanceSamples }, null, 2),
    );
    record(
      "Mesure à la demande : pixels logiques sans override ; timings propriété/Structure/Assets mesurés, aucun audit automatique à chaque retouche",
    );
  }
  if (phase >= 9) {
    await node("hero-title").evaluate((n) => {
      const doc = n.ownerDocument,
        p = doc.createElement("p");
      p.dataset.vtId = "rich-safety";
      p.append(doc.createTextNode("Un texte "));
      const em = doc.createElement("em");
      em.textContent = "important";
      p.append(em);
      const link = doc.createElement("a");
      link.href = "#contact";
      link.textContent = " et un lien";
      link.onclick = (event) => {
        event.preventDefault();
        link.dataset.clicked = "yes";
      };
      p.append(link);
      doc.querySelector("main").append(p);
      const div = doc.createElement("div");
      div.dataset.vtId = "plain-div-safety";
      div.textContent = "49 €";
      p.after(div);
    });
    const before = await local(),
      original = await node("rich-safety").evaluate((n) => {
        n.ownerDocument.defaultView.__richOriginal = n.firstElementChild;
        return n.innerHTML;
      });
    await node("rich-safety").evaluate((n) =>
      n.scrollIntoView({ block: "center" }),
    );
    await node("rich-safety").dispatchEvent("dblclick");
    assert.equal(
      await node("rich-safety").getAttribute("contenteditable"),
      null,
    );
    assert.equal(await node("rich-safety").innerHTML(), original);
    assert.deepEqual(await local(), before);
    await select("hero-title");
    await node("hero-title").press("ArrowRight");
    await dirty();
    await ui("#undo").click();
    await clean();
    assert.equal(
      await node("rich-safety").evaluate(
        (n) =>
          n.firstElementChild === n.ownerDocument.defaultView.__richOriginal,
      ),
      true,
    );
    await ui("#interaction-browse").click();
    await node("rich-safety").locator("a").click();
    assert.equal(
      await node("rich-safety").locator("a").getAttribute("data-clicked"),
      "yes",
    );
    await ui("#interaction-edit").click();
    await node("plain-div-safety").dblclick();
    assert.equal(
      await node("plain-div-safety").getAttribute("contenteditable"),
      null,
    );
    assert.equal(await local(), null);
    await select("hero-title");
    await node("hero-title").dblclick();
    await node("hero-title").fill("<img src=x onerror=alert(1)>");
    await ui('[data-action="edit"]').click();
    await dirty();
    assert.equal(await node("hero-title").locator("img").count(), 0);
    assert.equal(
      await node("hero-title").textContent(),
      "<img src=x onerror=alert(1)>",
    );
    await ui("#undo").click();
    await clean();
    assert.equal(
      await node("hero-title").textContent(),
      "Un détail change tout.",
    );
    record(
      "Texte : contenu HTML traité littéralement, Undo restaure le texte simple ; structure imbriquée et listeners conservés, DIV non élargi sans contrat sûr",
    );
  }
  // New stages append their paths here, keeping the critical smoke first.
  assert.deepEqual(errors, []);
  await writeFile(
    `artifacts/comfort-phase-${phase}-${engine}.json`,
    JSON.stringify({ engine, phase, checks, errors }, null, 2),
  );
  await page.screenshot({ path: `artifacts/comfort-${engine}.png` });
} catch (error) {
  await page.screenshot({ path: `artifacts/comfort-${engine}-failure.png` });
  throw error;
} finally {
  await browser.close();
}
