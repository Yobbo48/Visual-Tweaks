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
const base = "http://127.0.0.1:9410",
  route = `/?vt-test=guard-navigation-${engine}`,
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
  const target = frame().locator('[data-vt-id="hero-title"]');
  await target.click();
  await target.press("ArrowRight");
  await dirty();
  await ui("#undo").click();
  await clean();
  await target.press("ArrowRight");
  await dirty();
  const draftBefore = await local();
  await ui('[data-mode="mobile"]').click();
  await frame()
    .locator("body")
    .evaluate(() => {
      const style = document.createElement("style");
      style.id = "guard-limit-isolation";
      style.textContent = "body > * { display: none !important; }";
      const padding = document.createElement("div");
      padding.id = "guard-limit-padding";
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < 1700; i++)
        fragment.append(document.createElement("span"));
      padding.append(fragment);
      document.body.append(style, padding);
    });
  const audit = async () => {
    await ui("#test-responsive").click();
    await page.waitForFunction(
      () => !VisualTweaksEditor.diagnostics().responsive.busy,
    );
    await ui("#responsive-report").waitFor({ state: "visible" });
  };
  await audit();
  const notice = ui(
    '#responsive-report [data-screen="desktop"] [data-kind="scan-limit"]',
  );
  const selectedBefore = await page.evaluate(
    () => VisualTweaksEditor.diagnostics().selected,
  );
  const evidence = {
    totalDomElements: await frame()
      .locator("body")
      .evaluate(() => document.querySelectorAll("body *").length),
    notice: await notice.textContent(),
    heading: await ui(
      '#responsive-report [data-screen="desktop"] h3',
    ).textContent(),
    seeButtons: await notice
      .getByRole("button", { name: "Voir", exact: true })
      .count(),
    selectedBefore,
  };
  if (evidence.seeButtons) {
    await notice.getByRole("button", { name: "Voir", exact: true }).click();
    evidence.selectedAfter = await page.evaluate(
      () => VisualTweaksEditor.diagnostics().selected,
    );
    evidence.dialogOpenAfter = await ui("#responsive-report").evaluate(
      (n) => n.open,
    );
  }
  await writeFile(
    `artifacts/guard-navigation-${engine}-diagnostic.json`,
    JSON.stringify(evidence, null, 2),
  );
  assert.equal(
    evidence.seeButtons,
    0,
    "A global scan limit has no target: do not offer a misleading Voir button",
  );
  assert.match(evidence.heading, /analyse partielle/i);
  assert.doesNotMatch(evidence.heading, /point\(s\) à vérifier|— OK/);
  for (const screen of ["desktop", "tablet", "mobile"]) {
    const row = ui(
      `#responsive-report [data-screen="${screen}"] [data-kind="scan-limit"]`,
    );
    assert.match(
      await row.textContent(),
      new RegExp(
        String(evidence.totalDomElements).replace(
          /(?=\B(?:\d{3})+$)/g,
          "[\\s\\u202f]?",
        ),
      ),
    );
    assert.equal(await row.getByRole("button").count(), 0);
  }
  assert.deepEqual(await local(), draftBefore);
  await page.screenshot({ path: `artifacts/guard-navigation-${engine}.png` });
  await ui("#responsive-report")
    .getByRole("button", { name: "Fermer", exact: true })
    .click();
  await frame()
    .locator("body")
    .evaluate(() => {
      const group = document.createElement("div");
      group.id = "guard-many-warnings";
      group.style.setProperty("display", "block", "important");
      for (let i = 0; i < 45; i++) {
        const button = document.createElement("button");
        button.textContent = "+";
        button.style.cssText =
          "display:inline-block;width:20px;height:20px;padding:0;border:0";
        group.append(button);
      }
      document.body.prepend(group);
    });
  await audit();
  assert.equal(
    await ui(
      '#responsive-report [data-screen="desktop"] [data-kind="touch"]',
    ).count(),
    40,
  );
  assert.equal(
    await ui('#responsive-report [data-kind="scan-limit"]').count(),
    3,
    "Coverage notice remains visible even when the 40 recommendations budget is full",
  );
  await ui("#responsive-report")
    .getByRole("button", { name: "Fermer", exact: true })
    .click();
  await frame()
    .locator("#guard-many-warnings")
    .evaluate((n) => n.remove());
  record(
    "Limite 1500 : couverture expliquée et nombre total visible, sans faux Voir/problème ni mutation du draft",
  );

  await frame()
    .locator("body")
    .evaluate(() => {
      document.querySelector("#guard-limit-isolation").remove();
      const problem = document.createElement("div");
      problem.dataset.vtId = "guard-real-overflow";
      problem.setAttribute("aria-label", "Bloc qui dépasse");
      problem.style.cssText = "width:900px;height:100px";
      problem.textContent = "Une vraie largeur trop grande en mobile";
      document.body.prepend(problem);
    });
  await audit();
  const problem = ui(
    '#responsive-report [data-screen="mobile"] [data-kind="overflow"][data-target="guard-real-overflow"]',
  );
  await problem.getByRole("button", { name: "Voir", exact: true }).click();
  await page.waitForFunction(
    () =>
      VisualTweaksEditor.diagnostics().selected ===
      '[data-vt-id="guard-real-overflow"]',
  );
  assert.equal(await ui(".structure-item.is-selected").count(), 1);
  assert.equal(await ui("#properties").isVisible(), true);
  assert.equal(await ui("#responsive-report").evaluate((n) => n.open), false);
  assert.deepEqual(await local(), draftBefore);
  record(
    "Vraie alerte : Voir sélectionne la bonne cible, synchronise Structure et ouvre ses propriétés sans modifier le draft",
  );

  await ui("#save").click();
  await clean();
  await page.reload();
  await ready();
  await clean();
  const saved = await api("GET", { page: route });
  assert.equal(
    saved.data.elements.find((n) => n.selector.includes("hero-title")).changes
      .desktop.translateX,
    "1px",
  );
  await ui("#exit").click();
  await page.waitForURL((u) => !u.searchParams.has("vt-edit"));
  await page.locator("#wp-admin-bar-visual-tweaks a").click();
  await ready();
  await clean();
  record(
    "Smoke : sélectionner → modifier → draft → Undo → modifier → audit → sauvegarder → refresh → quitter/revenir",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    `artifacts/guard-navigation-${engine}.json`,
    JSON.stringify({ engine, checks, errors, evidence }, null, 2),
  );
} catch (error) {
  await page.screenshot({
    path: `artifacts/guard-navigation-${engine}-failure.png`,
  });
  throw error;
} finally {
  await browser.close();
}
