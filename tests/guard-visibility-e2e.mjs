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
  route = `/?vt-test=guard-visibility-${engine}`,
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
  const findings = await frame()
    .locator("body")
    .evaluate(async () => {
      // Test-only DOM fixtures: source theme remains untouched.
      const fixture = document.createElement("section");
      fixture.id = "guard-visibility-fixture";
      const invisible = document.createElement("div");
      invisible.style.opacity = "0";
      invisible.style.position = "absolute";
      const nested = document.createElement("div");
      const button = document.createElement("button");
      button.textContent = "Menu invisible";
      button.style.cssText = "width:20px;height:20px;padding:0;border:0";
      button.id = "invisible-ancestor-button";
      nested.append(button);
      invisible.append(nested);
      fixture.append(invisible);
      const visible = button.cloneNode(true);
      visible.textContent = "Petit bouton visible";
      visible.id = "visible-small-button";
      fixture.append(visible);
      const title = document.createElement("h2");
      title.id = "multiline-heading";
      title.textContent = "Un titre simplement réparti sur plusieurs lignes";
      title.style.cssText = "width:120px;height:auto;overflow:visible";
      fixture.append(title);
      const decor = document.createElement("div");
      decor.id = "intentional-decoration";
      decor.textContent = "Décoration";
      decor.style.cssText =
        "position:absolute;left:20px;top:0;transform:translateX(2px)";
      fixture.append(decor);
      document.body.append(fixture);
      const src = [...document.scripts]
        .find((n) => n.src.includes("/assets/runtime.js"))
        .src.replace("runtime.js", "responsive-guard.js");
      const { ResponsiveGuard } = await import(src);
      const guard = Object.create(ResponsiveGuard.prototype);
      guard.runtime = () => VisualTweaksRuntime;
      guard.elements = () => [];
      guard.metrics = { elementsExamined: 0 };
      const desktop = guard.snapshot(document, "desktop", (n) => n, new Set()),
        mobile = guard.snapshot(
          document,
          "mobile",
          (n) => n,
          desktop.collisions,
        );
      const rows = [...desktop.issues, ...mobile.issues].map((i) => ({
        id: i.node.id,
        kind: i.kind,
        screen: i.screen,
      }));
      fixture.remove();
      return rows;
    });
  await writeFile(
    `artifacts/guard-visibility-${engine}.json`,
    JSON.stringify({ engine, findings }, null, 2),
  );
  assert.equal(
    findings.filter((i) => i.id === "invisible-ancestor-button").length,
    0,
    "False positive: interactive child of an opacity:0 ancestor",
  );
  assert.ok(
    findings.some((i) => i.id === "visible-small-button" && i.kind === "touch"),
  );
  assert.equal(
    findings.filter((i) =>
      ["multiline-heading", "intentional-decoration"].includes(i.id),
    ).length,
    0,
  );
  record(
    "Responsive Guard : sous-arbre invisible exclu, petite cible visible conservée, titre multiligne et décoration sans faux problème",
  );
  await writeFile(
    `artifacts/guard-visibility-${engine}.json`,
    JSON.stringify({ engine, checks, findings }, null, 2),
  );
} finally {
  await browser.close();
}
