import { createServer } from "node:http";
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
  route = `/?vt-test=cache-public-${engine}`,
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
const cache = new Map(),
  proxyBase = "http://127.0.0.1:9412";
const proxy = createServer(async (req, res) => {
  try {
    if (
      req.headers.cookie ||
      /vt-edit|vt-frame|wp-admin|wp-login/.test(req.url)
    ) {
      res.writeHead(403);
      res.end("Anonymous public cache test only");
      return;
    }
    let stored = cache.get(req.url),
      hit = !!stored;
    if (!stored) {
      const upstream = await fetch(base + req.url);
      const headers = Object.fromEntries(
        [...upstream.headers].filter(
          ([k]) =>
            ![
              "content-encoding",
              "content-length",
              "transfer-encoding",
              "set-cookie",
            ].includes(k),
        ),
      );
      const raw = Buffer.from(await upstream.arrayBuffer());
      const body = (headers["content-type"] || "").includes("text/html")
        ? Buffer.from(
            raw
              .toString()
              .replaceAll(
                base + "/wp-content/plugins/visual-tweaks/",
                proxyBase + "/wp-content/plugins/visual-tweaks/",
              ),
          )
        : raw;
      stored = { status: upstream.status, headers, body };
      cache.set(req.url, stored);
    }
    res.writeHead(stored.status, {
      ...stored.headers,
      "x-vt-test-cache": hit ? "HIT" : "MISS",
      "cache-control": "public, max-age=60",
    });
    res.end(stored.body);
  } catch (error) {
    res.writeHead(502);
    res.end(error.message);
  }
});
await new Promise((resolve) => proxy.listen(9412, "127.0.0.1", resolve));
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
  const anon = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    pub = await anon.newPage(),
    resources = [];
  pub.on("request", (r) => {
    if (r.url().includes("/plugins/visual-tweaks/")) resources.push(r.url());
  });
  const empty = await pub.goto(base + route);
  await pub.waitForLoadState("networkidle");
  assert.equal(resources.length, 0);
  assert.equal(
    await pub.evaluate(() => typeof window.VisualTweaksConfig),
    "undefined",
  );
  record(
    "Public sans overrides : zéro ressource Visual Tweaks et aucune configuration REST/nonce",
  );
  const target = frame().locator('[data-vt-id="hero-phone"]');
  await target.click();
  await target.press("ArrowRight");
  await dirty();
  await ui("#save").click();
  await clean();
  await pub.reload();
  await pub.waitForFunction(
    () =>
      getComputedStyle(document.querySelector('[data-vt-id="hero-phone"]'))
        .translate === "6px 3px",
  );
  const config = await pub.evaluate(() => ({
    keys: Object.keys(VisualTweaksConfig),
    editor: VisualTweaksConfig.editor,
  }));
  assert.equal(config.editor, undefined);
  const modules = [
    ...new Set(resources.map((u) => new URL(u).pathname.split("/").pop())),
  ].sort();
  assert.deepEqual(modules, [
    "background-layers.js",
    "runtime.js",
    "selection.js",
    "styles.js",
  ]);
  record(
    "Public retouché : quatre modules du runtime, aucun éditeur/Guard/Review/Guides, aucun nonce",
  );
  const cached = await anon.newPage();
  let first = await cached.goto(proxyBase + route);
  await cached.waitForFunction(() => !!window.VisualTweaksRuntime);
  assert.equal(first.headers()["x-vt-test-cache"], "MISS");
  await target.press("ArrowRight");
  await dirty();
  await ui("#save").click();
  await clean();
  await pub.reload();
  await pub.waitForFunction(
    () =>
      getComputedStyle(document.querySelector('[data-vt-id="hero-phone"]'))
        .translate === "7px 3px",
  );
  record(
    "Cache navigateur ordinaire : nouvelle sauvegarde visible après refresh public, sans purge spécifique",
  );
  const hit = await anon.request.get(proxyBase + route);
  assert.equal(hit.headers()["x-vt-test-cache"], "HIT");
  await cached.goto(proxyBase + route + "&cache-check=1"); // Read cached HTML through the same key below, bypass browser cache only.
  await cached.route(proxyBase + route, async (r) =>
    r.continue({
      headers: { ...r.request().headers(), "cache-control": "no-cache" },
    }),
  );
  await cached.goto(proxyBase + route);
  await cached.waitForFunction(() => !!window.VisualTweaksRuntime);
  assert.equal(
    await cached
      .locator('[data-vt-id="hero-phone"]')
      .evaluate((n) => getComputedStyle(n).translate),
    "6px 3px",
  );
  cache.clear();
  await cached.reload();
  await cached.waitForFunction(
    () =>
      getComputedStyle(document.querySelector('[data-vt-id="hero-phone"]'))
        .translate === "7px 3px",
  );
  record(
    "Cache HTTP HTML contrôlé : ancien override reproduit après save ; purge du cache restitue la dernière valeur",
  );
  const editorHeaders = await context.request.get(base + route + "&vt-frame=1");
  assert.match(editorHeaders.headers()["cache-control"], /private|no-store/);
  const plugins = await page.evaluate(async () => {
    const cfg = VisualTweaksConfig.editor;
    const r = await fetch(
      cfg.api.replace("visual-tweaks/v1/page", "wp/v2/plugins"),
      { headers: { "X-WP-Nonce": cfg.nonce } },
    );
    return { status: r.status, data: await r.json() };
  });
  assert.equal(plugins.status, 200);
  await writeFile(
    "artifacts/cache-public-stabilisation.json",
    JSON.stringify(
      {
        checks,
        modules,
        config,
        publicHeaders: empty.headers(),
        previewHeaders: editorHeaders.headers(),
        activePlugins: plugins.data
          .filter((p) => p.status === "active")
          .map((p) => p.plugin),
        cache: {
          type: "in-process real HTTP proxy caching anonymous HTML on localhost:9412",
          staleBeforePurge: "6px 3px",
          freshAfterPurge: "7px 3px",
        },
        mysql: "not tested",
      },
      null,
      2,
    ),
  );
  await anon.close();
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await new Promise((resolve) => proxy.close(resolve));
}
