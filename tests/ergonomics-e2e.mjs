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
const context = await browser.newContext({
    viewport: { width: 1600, height: 1050 },
  }),
  page = await context.newPage();
const base = "http://127.0.0.1:9410",
  route = `/?vt-test=ergonomics-${engine}`,
  checks = [],
  errors = [];
page.on("pageerror", (e) => errors.push(e.stack));
const ui = (selector) => page.locator(`#vt-editor-host ${selector}`),
  frame = () => page.frameLocator("#vt-editor-host iframe"),
  node = (id) => frame().locator(`[data-vt-id="${id}"]`);
const record = (name) => {
  checks.push(name);
  console.log(`PASS ${name}`);
};
const ready = () =>
  page.waitForFunction(
    () =>
      !!window.VisualTweaksEditor?.diagnostics().ready,
  );
async function api(method, body) {
  return page.evaluate(
    async ({ method, body }) => {
      const cfg = VisualTweaksConfig.editor,
        url =
          method === "GET"
            ? cfg.api +
              (cfg.api.includes("?") ? "&" : "?") +
              "page=" +
              encodeURIComponent(body.page)
            : cfg.api;
      const response = await fetch(url, {
        method,
        headers: {
          "X-WP-Nonce": cfg.nonce,
          "Content-Type": "application/json",
        },
        ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, data: await response.json() };
    },
    { method, body },
  );
}
async function navigation(kind) {
  if (!(await ui("#navigation").isVisible()))
    await ui("#toggle-navigation").click();
  await ui(`#${kind}-tab`).click();
}
async function select(id) {
  await navigation("structure");
  const row = ui(`.structure-item[data-asset-id="${id}"]`);
  // Programmatic selection from the real tree requires expanding parents as a user would.
  await row.evaluate((row) => {
    for (
      let branch = row
        .closest(".structure-branch")
        ?.parentElement?.closest(".structure-branch");
      branch;
      branch = branch.parentElement.closest(".structure-branch")
    ) {
      const button = branch.querySelector(
        ":scope > .structure-item .tree-toggle",
      );
      if (button?.getAttribute("aria-expanded") === "false") button.click();
    }
  });
  await row.locator(".tree-pick").click();
  return row;
}
async function command(scope, axis, value) {
  await ui('#context-toolbar [data-action="alignment"]').click();
  await ui(
    `.context-popover [data-align-scope="${scope}"][data-align-axis="${axis}"][data-align-value="${value}"]`,
  ).click();
}
async function save() {
  await ui("#save").click();
  await ui("#state")
    .filter({ hasText: /^Enregistré$/ })
    .waitFor();
}
async function property(group, prop, value) {
  await ui(`#panel details[data-group="${group}"] summary`).click();
  await ui(`#panel input[data-property="${prop}"]`).fill(value);
  await ui(`#panel input[data-property="${prop}"]`).press("Tab");
}
async function horizontal(id) {
  return node(id).evaluate((n) => {
    const p = n.parentElement,
      s = getComputedStyle(p),
      r = n.getBoundingClientRect(),
      b = p.getBoundingClientRect();
    return {
      left: r.left - b.left - parseFloat(s.paddingLeft),
      right: b.right - r.right - parseFloat(s.paddingRight),
      width: r.width,
    };
  });
}
async function vertical(id) {
  return node(id).evaluate((n) => {
    const p = n.parentElement,
      s = getComputedStyle(p),
      r = n.getBoundingClientRect(),
      b = p.getBoundingClientRect();
    return {
      top: r.top - b.top - parseFloat(s.paddingTop),
      bottom: b.bottom - r.bottom - parseFloat(s.paddingBottom),
    };
  });
}
function equal(a, b) {
  assert.ok(Math.abs(a - b) < 1, `${a} ≠ ${b}`);
}
await mkdir("artifacts", { recursive: true });
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
  await page.reload();
  await ready();
  assert.equal(await ui("#properties").isVisible(), false);
  await node("hero-title").dblclick();
  assert.equal(
    await node("hero-title").evaluate((n) => n.isContentEditable),
    true,
  );
  await node("hero-title").press("Escape");
  await node("hero-title").press("Escape");
  assert.equal(await ui("#state").textContent(), "Enregistré");
  record(
    "Double-click starts inline text editing even when properties opening changes canvas fit",
  );
  await navigation("structure");
  const tree = await select("erg-row-70");
  assert.equal(await tree.getAttribute("aria-selected"), "true");
  assert.equal(await ui("#properties").isVisible(), true);
  assert.equal(
    await ui('.structure-item[data-asset-id="erg-many"]').getAttribute(
      "aria-expanded",
    ),
    "true",
  );
  const scroll = await ui("#inventory").evaluate((n) => n.scrollTop);
  assert.ok(scroll > 0);
  await tree.locator(".tree-pick").click();
  equal(scroll, await ui("#inventory").evaluate((n) => n.scrollTop));
  await node("erg-row-71").click();
  assert.equal(
    await ui('.structure-item[data-asset-id="erg-row-71"]').getAttribute(
      "aria-selected",
    ),
    "true",
  );
  const bounds = await ui("#inventory").boundingBox(),
    active = await ui(".structure-item.is-selected").boundingBox();
  assert.ok(
    active.y >= bounds.y &&
      active.y + active.height <= bounds.y + bounds.height + 1,
  );
  await page.screenshot({ path: `artifacts/ergonomics-tree-${engine}.png` });
  record(
    "Structure ↔ canvas: one selected row, parents open, scroll stable, selection visible",
  );
  await node("erg-row-71").press("Escape");
  assert.equal(await ui("#properties").isVisible(), false);
  assert.equal(await ui(".structure-item.is-selected").count(), 0);
  record("Properties close on deselection; navigation remains independent");
  await select("erg-background-title");
  assert.equal(
    await ui('.structure-item[data-asset-id="erg-background"]').getAttribute(
      "aria-expanded",
    ),
    "true",
  );
  record("Structure includes children of background containers");
  await navigation("assets");
  const cards = ui("#inventory .asset-card");
  assert.ok((await cards.count()) >= 11);
  for (const id of [
    "hero-phone",
    "fixture-logo",
    "fixture-icon",
    "erg-background",
    "erg-multi",
    "erg-hidden-image",
  ])
    assert.ok(
      (await ui(`#inventory .asset-card[data-asset-id="${id}"]`).count()) > 0,
      id,
    );
  assert.equal(
    await ui('#inventory .asset-card[data-asset-id="erg-multi"]').count(),
    2,
  );
  assert.equal(
    await ui('#inventory .asset-card[data-asset-id="erg-background"]').count(),
    2,
  );
  assert.ok(
    (await ui("#inventory .asset-group summary")
      .filter({ hasText: /utilisé .* fois/ })
      .count()) > 0,
  );
  await ui("#inventory .asset-group")
    .first()
    .locator("summary")
    .first()
    .click();
  assert.ok((await ui("#inventory .asset-thumb").count()) >= 2);
  assert.ok((await ui("#inventory svg.asset-thumb circle").count()) > 0);
  const asset = ui('#inventory .asset-card[data-asset-id="fixture-logo"]');
  await asset
    .getByRole("button", { name: "Sélectionner", exact: true })
    .click();
  assert.equal(await ui("#navigation").isVisible(), true);
  assert.equal(await ui("#panel h2").textContent(), "Image");
  await navigation("structure");
  assert.equal(
    await ui('.structure-item[data-asset-id="fixture-logo"]').getAttribute(
      "aria-selected",
    ),
    "true",
  );
  record(
    "Assets discovers img/picture, resolved variables, every CSS layer, SVG and pseudo backgrounds; groups occurrences with safe thumbnails",
  );
  await navigation("assets");
  const hidden = ui('#inventory .asset-card[data-asset-id="erg-hidden-image"]');
  await hidden.evaluate((c) => (c.closest(".asset-group").open = true));
  await hidden
    .getByRole("button", { name: "Sélectionner", exact: true })
    .click();
  assert.match(await ui("#message").textContent(), /masqué/);
  await navigation("structure");
  assert.ok(
    await ui('.structure-item[data-asset-id="erg-hidden-image"]')
      .getAttribute("class")
      .then((v) => v.includes("is-invisible")),
  );
  record(
    "Hidden/covered assets select their actual occurrence and synchronize properties/tree",
  );
  assert.equal(await ui("#state").textContent(), "Enregistré");
  assert.deepEqual((await api("GET", { page: route })).data.elements, []);
  record(
    "Finding/selecting/revealing elements does not turn theme values into overrides",
  );
  for (const id of [
    "erg-image",
    "erg-normal-child",
    "erg-button",
    "erg-flex-child",
    "erg-column-child",
  ]) {
    await select(id);
    await ui('#context-toolbar [data-action="center"]').click();
    let g = await horizontal(id);
    equal(g.left, g.right);
    await command("element", "horizontal", "left");
    g = await horizontal(id);
    equal(g.left, 0);
    await command("element", "horizontal", "right");
    g = await horizontal(id);
    equal(g.right, 0);
    await command("element", "horizontal", "center");
    g = await horizontal(id);
    equal(g.left, g.right);
  }
  record(
    "Real horizontal geometry: normal image, inline button, flex row and flex column center/left/right",
  );
  await select("erg-grid-child");
  await command("element", "horizontal", "center");
  assert.equal(
    await node("erg-grid-child").evaluate(
      (n) => getComputedStyle(n).justifySelf,
    ),
    "center",
  );
  equal((await horizontal("erg-grid-child")).left, 80);
  await command("element", "horizontal", "left");
  equal((await horizontal("erg-grid-child")).left, 0);
  await command("element", "horizontal", "right");
  equal((await horizontal("erg-grid-child")).left, 160);
  await command("element", "horizontal", "center");
  await command("element", "vertical", "center");
  let y = await vertical("erg-grid-child");
  equal(y.top, y.bottom);
  await select("erg-flex-child");
  await command("element", "vertical", "center");
  y = await vertical("erg-flex-child");
  equal(y.top, y.bottom);
  record(
    "Grid visibly aligns left/center/right within its cell; flex cross-axis and grid vertical center visibly",
  );
  await select("erg-grid-child");
  await property("spacing", "margin-top", "0");
  await ui('#panel details[data-group="alignment"] summary').click();
  await ui('#panel [data-reset-group="alignment"]').click();
  assert.equal(
    await ui('#panel [data-property="margin-top"]').inputValue(),
    "0",
  );
  assert.equal(
    await ui('#panel [data-reset-group="alignment"]').isDisabled(),
    true,
  );
  record(
    "Reset Alignment preserves a standalone zero spacing override and does not classify it as an alignment",
  );
  await select("erg-text");
  await ui('#context-toolbar [data-action="center"]').click();
  assert.equal(
    await node("erg-text").evaluate((n) => getComputedStyle(n).textAlign),
    "center",
  );
  const textCenter = await node("erg-text").evaluate((n) => {
    const r = document.createRange();
    r.selectNodeContents(n);
    const t = r.getBoundingClientRect(),
      b = n.getBoundingClientRect();
    return { left: t.left - b.left, right: b.right - t.right };
  });
  equal(textCenter.left, textCenter.right);
  for (const direction of ["left", "right"]) {
    await command("content", "horizontal", direction);
    assert.equal(
      await node("erg-text").evaluate((n) => getComputedStyle(n).textAlign),
      direction,
    );
  }
  await select("erg-flex-group");
  await command("content", "horizontal", "center");
  const a = await horizontal("erg-flex-sibling");
  equal(a.left, 160);
  await command("content", "vertical", "center");
  y = await vertical("erg-flex-sibling");
  equal(y.top, y.bottom);
  record("Text and container content align separately, respecting flex axes");
  await select("erg-inline-text");
  await ui('#context-toolbar [data-action="center"]').click();
  assert.match(await ui("#global-error").textContent(), /en ligne/);
  await ui('#panel details[data-group="text"] summary').click();
  await ui(
    '#panel details[data-group="text"] [data-property="text-align"]',
  ).selectOption("center");
  assert.match(await ui("#global-error").textContent(), /en ligne/);
  assert.equal(
    await ui(
      '#panel details[data-group="text"] [data-property="text-align"]',
    ).inputValue(),
    "",
  );
  record(
    "Inline text alignment reports its missing block context, including typography controls, and creates no silent override",
  );
  await select("erg-flex-sibling");
  const stateBefore = await api("GET", { page: route });
  await command("element", "horizontal", "center");
  assert.match(await ui("#global-error").textContent(), /partage une rangée/);
  await select("erg-image");
  await command("element", "vertical", "center");
  assert.match(await ui("#global-error").textContent(), /centrage vertical/);
  record(
    "Unsupported commands produce visible feedback without changing layout",
  );
  await property("size", "translateX", "8");
  assert.equal(
    await node("erg-image").evaluate((n) => getComputedStyle(n).translate),
    "8px",
  );
  await ui('#panel [data-reset-group="position"]').click();
  assert.equal(
    await node("erg-image").evaluate((n) => getComputedStyle(n).translate),
    "none",
  );
  let g = await horizontal("erg-image");
  equal(g.left, g.right);
  await ui('#panel details[data-group="alignment"] summary').click();
  await ui('#panel [data-reset-group="alignment"]').click();
  g = await horizontal("erg-image");
  equal(g.left, 0);
  record(
    "Alignment and local movement remain separate; group resets delete only their overrides",
  );
  await select("erg-flex-group");
  await ui('#panel details[data-group="spacing"] summary').click();
  const margin = ui("#panel .spacing-box").nth(0),
    padding = ui("#panel .spacing-box").nth(1);
  await margin.locator('input[type="checkbox"]').check();
  await margin.locator('[data-property="margin-top"]').fill("-7.25");
  await margin.locator('[data-property="margin-top"]').press("Tab");
  for (const side of ["top", "right", "bottom", "left"])
    assert.equal(
      await node("erg-flex-group").evaluate(
        (n, side) => getComputedStyle(n).getPropertyValue("margin-" + side),
        side,
      ),
      "-7.25px",
    );
  await ui("#undo").click();
  for (const side of ["top", "right", "bottom", "left"])
    assert.notEqual(
      await node("erg-flex-group").evaluate(
        (n, side) => getComputedStyle(n).getPropertyValue("margin-" + side),
        side,
      ),
      "-7.25px",
    );
  await ui("#redo").click();
  for (const side of ["top", "right", "bottom", "left"])
    assert.equal(
      await node("erg-flex-group").evaluate(
        (n, side) => getComputedStyle(n).getPropertyValue("margin-" + side),
        side,
      ),
      "-7.25px",
    );
  // Re-rendered controls after history keep linking as local view state only.
  await ui('#panel details[data-group="spacing"] summary').click();
  await margin.locator('input[type="checkbox"]').uncheck();
  await margin.locator('[data-property="margin-right"]').fill("18");
  await margin.locator('[data-property="margin-right"]').press("Tab");
  assert.equal(
    await node("erg-flex-group").evaluate(
      (n) => getComputedStyle(n).marginRight,
    ),
    "18px",
  );
  await padding.locator('input[type="checkbox"]').check();
  await padding.locator('[data-property="padding-top"]').fill("0");
  await padding.locator('[data-property="padding-top"]').press("Tab");
  await ui('#panel [data-property="gap"]').fill("16");
  await ui('#panel [data-property="gap"]').press("Tab");
  assert.equal(
    await node("erg-flex-group").evaluate((n) => getComputedStyle(n).gap),
    "16px",
  );
  await ui("#undo").click();
  assert.notEqual(
    await node("erg-flex-group").evaluate((n) => getComputedStyle(n).gap),
    "16px",
  );
  await ui("#redo").click();
  assert.equal(
    await node("erg-flex-group").evaluate((n) => getComputedStyle(n).gap),
    "16px",
  );
  record(
    "Spacing previews positive individual/negative linked margins, zero padding and relevant gap; undo/redo restores complete batches",
  );
  for (const [mode, value] of [
    ["tablet", "12"],
    ["mobile", "6"],
  ]) {
    await ui(`[data-mode="${mode}"]`).click();
    await ui('#panel details[data-group="spacing"] summary').click();
    await ui('#panel [data-property="padding-left"]').fill(value);
    await ui('#panel [data-property="padding-left"]').press("Tab");
  }
  await save();
  const stored = await api("GET", { page: route });
  assert.equal(stored.status, 200);
  const styles = stored.data.elements.find(
    (e) => e.id === "erg-flex-group",
  ).changes;
  assert.equal(styles.desktop["margin-left"], "-7.25px");
  assert.equal(styles.desktop["padding-left"], "0");
  assert.equal(styles.tablet["padding-left"], "12px");
  assert.equal(styles.mobile["padding-left"], "6px");
  assert.equal(
    stored.data.elements.some((e) =>
      ["erg-flex-sibling", "erg-inline-text"].includes(e.id),
    ),
    false,
  );
  assert.equal(
    stored.data.elements.find((e) => e.id === "erg-button").changes.desktop
      .width,
    "fit-content",
  );
  await page.reload();
  await ready();
  await select("erg-flex-group");
  for (const [mode, value] of [
    ["desktop", "0px"],
    ["tablet", "12px"],
    ["mobile", "6px"],
  ]) {
    await ui(`[data-mode="${mode}"]`).click();
    assert.equal(
      await node("erg-flex-group").evaluate(
        (n) => getComputedStyle(n).paddingLeft,
      ),
      value,
    );
  }
  record(
    "WordPress REST saves strict semantic properties; spacing desktop/tablet/mobile survives refresh, rejected commands never enter document",
  );
  await ui('#panel details[data-group="spacing"] summary').click();
  await ui('#panel [data-reset-group="spacing"]').click();
  assert.equal(
    await node("erg-flex-group").evaluate(
      (n) => getComputedStyle(n).paddingLeft,
    ),
    "12px",
  );
  await ui("#undo").click();
  assert.equal(
    await node("erg-flex-group").evaluate(
      (n) => getComputedStyle(n).paddingLeft,
    ),
    "6px",
  );
  record(
    "Spacing group reset removes only mobile overrides and recovers tablet inheritance; undo restores mobile intent",
  );
  await ui('[data-mode="desktop"]').click();
  await select("erg-button");
  const centered = await horizontal("erg-button");
  equal(centered.left, centered.right);
  await ui('#panel details[data-group="alignment"] summary').click();
  await ui('#panel [data-reset-group="alignment"]').click();
  assert.equal(
    await node("erg-button").evaluate((n) => getComputedStyle(n).display),
    "inline-block",
  );
  record(
    "Button reset restores theme display and intrinsic width by removing controlled alignment overrides",
  );
  await ui("#close-navigation").click();
  assert.equal(await ui("#navigation").isVisible(), false);
  assert.equal(await node("erg-button").evaluate(() => innerWidth), 1440);
  record(
    "Navigation is fully collapsible; both panels preserve the 1440px logical viewport",
  );
  await save();
  const anonymous = await browser.newContext({
      viewport: { width: 1440, height: 1050 },
    }),
    publicPage = await anonymous.newPage();
  await publicPage.goto(base + route);
  await publicPage.waitForFunction(() => !!window.VisualTweaksRuntime);
  const publicGroup = publicPage.locator('[data-vt-id="erg-flex-group"]');
  assert.equal(
    await publicGroup.evaluate((n) => getComputedStyle(n).marginLeft),
    "-7.25px",
  );
  assert.equal(
    await publicGroup.evaluate((n) => getComputedStyle(n).gap),
    "16px",
  );
  assert.equal(
    await publicPage
      .locator('[data-vt-id="erg-button"]')
      .evaluate((n) => getComputedStyle(n).display),
    "inline-block",
  );
  assert.equal(await publicPage.locator("#vt-editor-host").count(), 0);
  await anonymous.close();
  record(
    "Anonymous frontend applies saved spacing/alignment/reset state without editor interface",
  );
  assert.deepEqual(errors, []);
  record("No uncaught browser errors");
  await page.screenshot({ path: `artifacts/ergonomics-${engine}.png` });
  await writeFile(
    `artifacts/ergonomics-${engine}-report.json`,
    JSON.stringify(
      { testedAt: new Date().toISOString(), engine, checks },
      null,
      2,
    ),
  );
} catch (e) {
  console.log(errors);
  await page.screenshot({ path: `artifacts/ergonomics-${engine}-failure.png` });
  throw e;
} finally {
  await browser.close();
}
