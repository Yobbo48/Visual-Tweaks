import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
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
    viewport: { width: 1560, height: 1050 },
  }),
  page = await context.newPage();
const base = "http://127.0.0.1:9410",
  route = `/?vt-test=ergonomics-polish-${engine}`,
  checks = [],
  errors = [];
const ui = (s) => page.locator(`#vt-editor-host ${s}`),
  frame = () => page.frameLocator("#vt-editor-host iframe");
page.on("pageerror", (e) => errors.push(e.stack));
const record = (name) => {
  checks.push(name);
  console.log(`PASS ${name}`);
};
const ready = () =>
  page.waitForFunction(
    () => window.VisualTweaksEditor?.diagnostics().ready === true,
  );
async function api(method, body) {
  return page.evaluate(
    async ({ method, body }) => {
      const cfg = VisualTweaksConfig.editor;
      const res = await fetch(
        cfg.api +
          (method === "GET"
            ? (cfg.api.includes("?") ? "&" : "?") +
              "page=" +
              encodeURIComponent(body.page)
            : ""),
        {
          method,
          headers: {
            "X-WP-Nonce": cfg.nonce,
            "Content-Type": "application/json",
          },
          ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
        },
      );
      return { status: res.status, data: await res.json() };
    },
    { method, body },
  );
}
const dirty = () =>
  ui("#state")
    .filter({ hasText: /^Modifications non enregistrées$/ })
    .waitFor();
const clean = () =>
  ui("#state")
    .filter({ hasText: /^Enregistré$/ })
    .waitFor();
const local = () =>
  page.evaluate(() => {
    const cfg = VisualTweaksConfig;
    return JSON.parse(
      localStorage.getItem(
        `visual-tweaks:${location.origin}:${cfg.editor.userId}:${cfg.page}`,
      ),
    );
  });
let originalStyle;
async function styleApi(method, body) {
  return page.evaluate(
    async ({ method, body }) => {
      const cfg = VisualTweaksConfig.editor;
      const r = await fetch(cfg.styleApi, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-WP-Nonce": cfg.nonce,
        },
        ...(method === "PUT" ? { body: JSON.stringify(body) } : {}),
      });
      return { status: r.status, data: await r.json() };
    },
    { method, body },
  );
}
const node = (id) => frame().locator(`[data-vt-id="${id}"]`);
async function select(id) {
  await node(id).evaluate((n) => n.scrollIntoView({ block: "center" }));
  await node(id).click();
}
async function group(name) {
  const details = ui(`#panel details[data-group="${name}"]`);
  if (!((await details.getAttribute("open")) !== null))
    await details.locator(":scope > summary").click();
}
try {
  await page.goto(
    base +
      "/wp-login.php?redirect_to=" +
      encodeURIComponent(base + route + "&vt-edit=1"),
  );
  await page.waitForTimeout(250); // WordPress login autofocus settles after 200 ms.
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
  originalStyle = (await styleApi("GET")).data;
  await page.reload();
  await ready();
  await ui("#site-style").click();
  await ui('[data-site-role="colors.primary"]').fill("#315b93");
  await ui('[data-site-role="colors.accent"]').fill("#315b9380");
  await ui('[data-site-role="fonts.heading"]').selectOption('"Georgia"');
  await ui('[data-site-role="fonts.body"]').selectOption("system-ui");
  await ui('[data-site-role="radius"]').selectOption("16px");
  await ui('[data-site-role="shadow"]').selectOption(
    "0px 2px 8px 0px #163b3026",
  );
  const styleSave = ui(".site-style-dialog").getByRole("button", {
    name: "Enregistrer le style du site",
    exact: true,
  });
  await styleSave.click();
  await ui("#site-style-state")
    .filter({ hasText: /^Palette enregistrée$/ })
    .waitFor();
  await ui(".site-style-dialog")
    .getByRole("button", { name: "Fermer", exact: true })
    .click();
  assert.equal(await local(), null);
  assert.equal((await styleApi("GET")).data.colors.primary, "#315b93");
  await page.reload();
  await ready();
  await select("erg-button");
  await group("style");
  await ui('#panel [data-property="color"]')
    .getByRole("button", { name: "Utiliser Principale", exact: true })
    .click();
  assert.equal(
    await ui('#panel [data-property="color"]')
      .getByRole("button", { name: "Utiliser Accent", exact: true })
      .count(),
    1,
  );
  await ui("[data-radius-preset]").selectOption("9999px");
  await group("spacing");
  await ui('[data-spacing-preset="padding"]').selectOption("16px");
  await group("text");
  await ui('#panel [data-property="font-family"]').selectOption("system-ui");
  assert.equal(
    await node("erg-button").evaluate((n) => getComputedStyle(n).fontFamily),
    "system-ui",
  );
  await ui('#panel [data-property="font-family"]').selectOption('"Georgia"');
  const values = (await local()).elements.find((e) => e.id === "erg-button")
    .changes.desktop;
  assert.equal(values.color, "#315b93");
  assert.equal(values["border-radius"], "9999px");
  assert.equal(values["font-family"], '"Georgia"');
  for (const side of ["top", "right", "bottom", "left"])
    assert.equal(values[`padding-${side}`], "16px");
  record(
    "Palette WordPress persistante, rôles nommés, polices, presets arrondi et espaces : seules les actions créent des overrides",
  );
  await ui("#panel .element-actions > summary").click();
  await ui("#panel")
    .getByRole("button", { name: "Copier le style", exact: true })
    .click();
  await select("erg-text");
  assert.equal(await ui(".hover").isVisible(), false);
  await ui("#panel .element-actions > summary").click();
  await ui("#panel")
    .getByRole("button", { name: "Coller le style", exact: true })
    .click();
  const copied = (await local()).elements.find((e) => e.id === "erg-text");
  assert.deepEqual(copied.changes.desktop, values);
  assert.equal(copied.content, undefined);
  await ui("#undo").click();
  assert.equal(
    (await local()).elements.some((e) => e.id === "erg-text"),
    false,
  );
  await ui("#redo").click();
  assert.deepEqual(
    (await local()).elements.find((e) => e.id === "erg-text").changes.desktop,
    values,
  );
  record(
    "Copier/coller le style change uniquement les overrides de destination et reste une étape undo/redo",
  );
  await ui("#save").click();
  await clean();
  await page.reload();
  await ready();
  assert.equal(
    await node("erg-text").evaluate((n) => getComputedStyle(n).color),
    "rgb(49, 91, 147)",
  );
  await select("erg-text");
  await ui("#panel")
    .getByRole("button", { name: "Masquer les propriétés", exact: true })
    .click();
  assert.equal(await ui("#properties").isVisible(), false);
  assert.equal(await ui(".selected").isVisible(), true);
  await ui("#toggle-panel").click();
  await ui("#close-navigation").click();
  assert.equal(await ui("#navigation").isVisible(), false);
  assert.equal(
    await page.evaluate(() => VisualTweaksViewport.diagnostics().innerWidth),
    1440,
  );
  record(
    "Style collé persiste après refresh ; panneaux refermables sans perdre sélection ni viewport logique",
  );
  const current = (await styleApi("GET")).data;
  assert.equal(
    (
      await styleApi("PUT", {
        ...current,
        colors: { primary: "url(javascript:alert(1))" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await styleApi("PUT", {
        ...current,
        fonts: { heading: "Arial; color:red" },
      })
    ).status,
    400,
  );
  assert.equal(
    (await styleApi("PUT", { ...current, revision: current.revision - 1 }))
      .status,
    409,
  );
  const anon = await browser.newContext(),
    publicPage = await anon.newPage();
  assert.equal(
    (
      await publicPage.request.get(
        base + "/wp-json/visual-tweaks/v1/site-style",
      )
    ).status(),
    403,
  );
  await publicPage.goto(base + route);
  const resources = await publicPage.evaluate(() =>
    performance.getEntriesByType("resource").map((r) => r.name),
  );
  assert.equal(
    resources.some((url) =>
      /assets\/(?:editor|site-style|navigation|gesture-preview|style-patcher)\./.test(
        url,
      ),
    ),
    false,
  );
  record(
    "Rendu public : aucun module d’interface, de palette ou de geste chargé",
  );
  await anon.close();
  record(
    "Palette : CSS/JS arbitraire refusé, nonce/capability et conflit CAS protégés",
  );
  await ui("#toggle-navigation").click();
  await ui("#structure-tab").click();
  await group("style");
  await page.waitForFunction(() => {
    const ui = document.querySelector("#vt-editor-host").shadowRoot;
    const box = ui.querySelector(".selected").getBoundingClientRect();
    const expected = VisualTweaksViewport.diagnostics().displayedBox;
    return (
      expected &&
      ["left", "top", "width", "height"].every(
        (key) => Math.abs(box[key] - expected[key]) < 1,
      )
    );
  });
  record(
    "Outlines remain attached to the selected node after navigation/properties toggles",
  );
  assert.equal(await ui(".hover").isVisible(), false);
  await page.screenshot({ path: `artifacts/polish-${engine}.png` });
  assert.deepEqual(errors, []);
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    `artifacts/polish-${engine}.json`,
    JSON.stringify({ engine, checks, errors }, null, 2),
  );
} finally {
  if (originalStyle) {
    const current = await styleApi("GET");
    if (current.status === 200)
      await styleApi("PUT", {
        ...originalStyle,
        revision: current.data.revision,
      });
  }
  await browser.close();
}
