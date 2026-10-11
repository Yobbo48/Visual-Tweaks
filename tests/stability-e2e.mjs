import { createRequire } from "node:module";
import { mkdir, writeFile, readFile } from "node:fs/promises";
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
  route = `/?vt-test=stability-${engine}`,
  checks = [],
  errors = [];
const ui = (s) => page.locator(`#vt-editor-host ${s}`),
  frame = () => page.frameLocator("#vt-editor-host iframe"),
  hero = () => frame().locator('[data-vt-id="hero-title"]');
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
async function nudge() {
  await hero().click();
  await hero().press("ArrowRight");
  await dirty();
}
async function chain(label) {
  await ready();
  await clean();
  assert.equal(await ui("#frame-status").isVisible(), false);
  await nudge();
  assert.equal(
    (await local()).elements.find((e) => e.id === "hero-title").changes.desktop
      .translateX,
    "1px",
  );
  await ui("#undo").click();
  await clean();
  assert.equal(await local(), null);
  await nudge();
  await ui("#save").click();
  await clean();
  assert.equal(await local(), null);
  const saved = await api("GET", { page: route });
  assert.equal(
    saved.data.elements.find((e) => e.id === "hero-title").changes.desktop
      .translateX,
    "1px",
  );
  await page.reload();
  await ready();
  await clean();
  assert.equal(
    await hero().evaluate((n) => getComputedStyle(n).translate.split(" ")[0]),
    "1px",
  );
  await ui("#exit").click();
  await page.waitForURL((u) => !u.searchParams.has("vt-edit"));
  assert.equal(await page.locator("#vt-editor-host").count(), 0);
  await page.goto(base + route + "&vt-edit=1");
  await ready();
  await clean();
  assert.equal(
    await hero().evaluate((n) => getComputedStyle(n).translate.split(" ")[0]),
    "1px",
  );
  record(
    label +
      " → sélection/mutation/draft/dirty/undo/save/refresh/quitter/revenir",
  );
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
  async function reset() {
    const before = await api("GET", { page: route });
    assert.equal(
      (
        await api("PUT", {
          page: route,
          revision: before.data.revision,
          elements: [],
        })
      ).status,
      200,
    );
    await page.reload();
    await ready();
  }
  await reset();
  await nudge();
  await ui('#panel details[data-group="size"] > summary').click();
  await ui('#panel [data-reset-group="position"]').click();
  await clean();
  assert.equal(await local(), null);
  await ui("#undo").click();
  await dirty();
  assert.equal((await local()).elements[0].changes.desktop.translateX, "1px");
  await ui("#redo").click();
  await clean();
  record(
    "Reset Position supprime les derniers overrides, reste annulable et ne laisse pas de faux brouillon vide",
  );
  await chain("Initialisation normale");
  // Simulate a script optimizer initializing the runtime after iframe load.
  await page.route("**/assets/runtime.js?*", async (route) => {
    const response = await route.fetch();
    let body = await response.text();
    body = body
      .replace(
        "if (window.VisualTweaksConfig)\n  window.VisualTweaksRuntime = new Runtime(",
        "if (window.VisualTweaksConfig) setTimeout(() => {\n  window.VisualTweaksRuntime = new Runtime(",
      )
      .replace(
        "window.VisualTweaksConfig.elements,\n  );",
        "window.VisualTweaksConfig.elements,\n  );\n}, 600);",
      );
    await route.fulfill({ response, body });
  });
  await reset();
  await chain("Runtime tardif après load");
  await page.evaluate(() =>
    document
      .querySelector("#vt-editor-host")
      .shadowRoot.querySelector("iframe")
      .contentWindow.location.reload(),
  );
  await page.waitForFunction(
    () => VisualTweaksEditor.diagnostics().phase !== "ready",
  );
  await ready();
  await nudge();
  assert.equal(
    (await local()).elements.find((e) => e.id === "hero-title").changes.desktop
      .translateX,
    "2px",
  );
  await ui("#undo").click();
  await clean();
  record(
    "Rechargement de l’iframe : événements réactivés une seule fois, état sauvegardé conservé",
  );
  await nudge();
  await page.reload();
  await ready();
  await dirty();
  assert.equal(
    await page.evaluate(() => VisualTweaksEditor.diagnostics().recoveryPending),
    false,
  );
  await hero().click();
  await hero().press("ArrowRight");
  assert.equal(
    (await local()).elements.find((e) => e.id === "hero-title").changes.desktop
      .translateX,
    "3px",
  );
  record(
    "Brouillon de même révision automatiquement restauré et immédiatement éditable",
  );
  // Selecting again flushes the pending nudge before seeding an older local revision.
  await hero().click();
  await page.evaluate(() => {
    const cfg = VisualTweaksConfig;
    const key = `visual-tweaks:${location.origin}:${cfg.editor.userId}:${cfg.page}`;
    const value = JSON.parse(localStorage.getItem(key));
    value.revision--;
    localStorage.setItem(key, JSON.stringify(value));
  });
  await page.reload();
  await ready();
  assert.equal(await ui("#state").textContent(), "Brouillon à récupérer");
  const downloadPromise = page.waitForEvent("download");
  await ui("#export").click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile(await download.path(), "utf8"));
  assert.equal(exported.revision, (await local()).revision);
  assert.equal(
    exported.elements.find((e) => e.id === "hero-title").changes.desktop
      .translateX,
    "3px",
  );
  record(
    "Export du brouillon en attente : valeurs et ancienne révision conservées",
  );
  await hero().click();
  await hero().press("ArrowRight");
  assert.match(
    await ui("#global-error").textContent(),
    /brouillon local attend/,
  );
  assert.equal(
    (await local()).elements.find((e) => e.id === "hero-title").changes.desktop
      .translateX,
    "3px",
  );
  await ui("#recovery")
    .getByRole("button", { name: "Récupérer le brouillon local" })
    .click();
  await dirty();
  await hero().click();
  await hero().press("ArrowRight");
  assert.equal(
    (await local()).elements.find((e) => e.id === "hero-title").changes.desktop
      .translateX,
    "4px",
  );
  await ui("#discard").click();
  await clean();
  await nudge();
  await ui("#save").click();
  await clean();
  record(
    "Brouillon en attente explicitement signalé, aucun blocage silencieux, récupération puis édition",
  );
  const publicContext = await browser.newContext({
      viewport: { width: 1440, height: 1050 },
    }),
    publicPage = await publicContext.newPage();
  await publicPage.goto(base + route);
  assert.equal(await publicPage.locator("#vt-editor-host").count(), 0);
  assert.equal(
    await publicPage
      .locator('[data-vt-id="hero-title"]')
      .evaluate((n) => getComputedStyle(n).translate.split(" ")[0]),
    "2px",
  );
  await publicContext.close();
  record("Rendu visiteur applique uniquement l’override enregistré");
  assert.deepEqual(errors, []);
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    `artifacts/stability-${engine}.json`,
    JSON.stringify({ engine, checks, errors }, null, 2),
  );
} finally {
  await browser.close();
}
