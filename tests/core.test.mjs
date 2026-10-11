import test from "node:test";
import assert from "node:assert/strict";
import { History } from "../visual-tweaks/assets/history.js";
import {
  generateCSS,
  effectiveProperties,
} from "../visual-tweaks/assets/styles.js";
import { validValue, validHref } from "../visual-tweaks/assets/validation.js";
import {
  resizeDimensions,
  localDelta,
} from "../visual-tweaks/assets/geometry.js";
import {
  toHex,
  fontValue,
} from "../visual-tweaks/assets/appearance-controls.js";
test("undo/redo preserve snapshots and truncate obsolete branches", () => {
  const history = new History([]);
  const value = [{ id: "phone", x: 1 }];
  history.push(value);
  value[0].x = 99;
  assert.deepEqual(history.undo(), []);
  assert.deepEqual(history.redo(), [{ id: "phone", x: 1 }]);
  history.undo();
  history.push([{ id: "title" }]);
  assert.equal(history.canRedo, false);
});
test("new font and link values are bounded and reject executable schemes", () => {
  assert.equal(
    validValue("font-family", '"Instrument Sans", sans-serif'),
    true,
  );
  for (const value of ["url(https://x)", "Arial; color: red", '"Bad\\font"'])
    assert.equal(validValue("font-family", value), false);
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,<script>",
    "//evil.test",
    "java\nscript:alert(1)",
  ])
    assert.equal(validHref(url), false);
  for (const url of [
    "https://example.test/a",
    "/contact",
    "#hero",
    "mailto:a@example.test",
    "tel:+33000000000",
  ])
    assert.equal(validHref(url), true);
});
test("resize follows local axes and keeps image proportions by default", () => {
  const a = Math.cos(Math.PI / 4),
    b = Math.sin(Math.PI / 4);
  const delta = localDelta({ a, b, c: -b, d: a }, a * 40, b * 40);
  assert.ok(Math.abs(delta.x - 40) < 0.001);
  assert.ok(Math.abs(delta.y) < 0.001);
  const size = resizeDimensions({
    width: 200,
    height: 100,
    dx: 40,
    dy: 20,
    corner: "se",
    ratio: true,
  });
  assert.deepEqual(size, { width: 240, height: 120 });
  assert.deepEqual(
    resizeDimensions({
      width: 200,
      height: 100,
      dx: 40,
      dy: 20,
      corner: "se",
      ratio: false,
    }),
    { width: 240, height: 120 },
  );
  const free = resizeDimensions({
    width: 200,
    height: 100,
    dx: 40,
    dy: 0,
    corner: "se",
    ratio: false,
  });
  assert.deepEqual(free, { width: 240, height: 100 });
});
test("site palette extracts colors without treating transparency as opaque", () => {
  assert.equal(toHex("rgb(23, 61, 48)"), "#173d30");
  assert.equal(toHex("rgba(0, 0, 0, 0)"), null);
  assert.equal(toHex("#abc"), "#aabbcc");
});
test("controls refuse CSS injection, unsupported values and negative dimensions", () => {
  for (const value of [
    "url(javascript:alert(1))",
    "10px;color:red",
    "var(--secret)",
    "calc(100% - 1px)",
    "-20px",
    "20",
  ])
    assert.equal(validValue("width", value), false);
  assert.equal(validValue("translateY", "-25px"), true);
  assert.equal(validValue("padding-top", "-1px"), false);
  assert.equal(validValue("color", "#aabbcc"), true);
  assert.equal(validValue("object-position", "100.01% 50%"), false);
});
test("responsive generation groups exceptions in at most two media queries", () => {
  const elements = Array.from({ length: 20 }, (_, i) => ({
    id: `phone-${i}`,
    selector: ".phone",
    changes: {
      desktop: {
        translateX: "20px",
        translateY: "-25px",
        "max-width": "280px",
      },
      tablet: { translateY: "-10px" },
      mobile: { translateX: "0px", "font-size": "16px" },
    },
  }));
  const css = generateCSS(elements);
  assert.equal((css.match(/@media/g) || []).length, 2);
  assert.ok(
    css.includes(
      "calc(var(--vt-base-x, 0px) + 20px) calc(var(--vt-base-y, 0px) + -10px)",
    ),
  );
  assert.ok(
    css.includes(
      "calc(var(--vt-base-x, 0px) + 0px) calc(var(--vt-base-y, 0px) + -10px)",
    ),
  );
  assert.equal(css.includes("transform:"), false);
  assert.deepEqual(effectiveProperties(elements[0], "mobile"), {
    translateX: "0px",
    translateY: "-10px",
    "max-width": "280px",
    "font-size": "16px",
  });
});

import { normalizeElements } from "../visual-tweaks/assets/state.js";
test("legacy empty PHP arrays become serializable setting maps", () => {
  const [entry] = normalizeElements([{ id: "text", changes: [] }]);
  entry.changes.desktop = { "font-size": "42px" };
  assert.equal(
    JSON.parse(JSON.stringify(entry)).changes.desktop["font-size"],
    "42px",
  );
  const [mode] = normalizeElements([{ changes: { desktop: [] } }]);
  mode.changes.desktop.translateX = "1px";
  assert.equal(
    JSON.parse(JSON.stringify(mode)).changes.desktop.translateX,
    "1px",
  );
});

test("asset appearance values are typed and reject CSS injection", () => {
  for (const [property, value] of [
    ["background-size", "cover"],
    ["background-position", "25% 70%"],
    ["imageZoom", "140"],
    ["overlay-color", "#12345633"],
    ["box-shadow", "0px 8px 20px 0px #12345633"],
    ["filter", "blur(4px)"],
  ])
    assert.equal(validValue(property, value), true, property);
  for (const [property, value] of [
    ["background-size", "url(https://x)"],
    ["background-position", "50% 50%; color:red"],
    ["imageZoom", "999"],
    ["box-shadow", "0px 0px 20px 0px #12345633;display:none"],
    ["filter", "url(#filter)"],
  ])
    assert.equal(validValue(property, value), false, property);
});

import {
  canonicalValue,
  invalidOverride,
} from "../visual-tweaks/assets/validation.js";
import { boxEdges, dimensionsOf } from "../visual-tweaks/assets/geometry.js";
test("explicit lengths become canonical without admitting arbitrary CSS", () => {
  for (const [input, result] of [
    ["127", "127px"],
    ["127.125", "127.125px"],
    ["167.10899999999998px", "167.109px"],
    [".123456rem", "0.1235rem"],
    ["57.5%", "57.5%"],
    ["2em", "2em"],
    ["10vw", "10vw"],
    ["10vh", "10vh"],
    ["0", "0"],
    ["auto", "auto"],
    ["fit-content", "fit-content"],
    ["", ""],
  ])
    assert.equal(canonicalValue("width", input, true), result);
  for (const input of [
    "none",
    "max-content",
    "min-content",
    "calc(100% - 2px)",
    "clamp(1px, 2vw, 3px)",
    "NaNpx",
    "Infinitypx",
    "-1px",
    "100000px",
    "99999.99999px",
    127,
    { value: 127, unit: "px" },
  ])
    assert.equal(
      canonicalValue("width", input, true),
      null,
      JSON.stringify(input),
    );
  assert.equal(canonicalValue("max-width", "none"), "none");
  assert.equal(canonicalValue("max-width", "auto"), null);
  assert.equal(canonicalValue("width", "20"), null);
});
test("legacy precision is repaired only inside existing override maps", () => {
  const source = [
    {
      id: "asset",
      changes: {
        desktop: { width: "167.10899999999998px", height: "NaNpx" },
        mobile: { width: { value: 127, unit: "px" } },
      },
    },
  ];
  const normalized = normalizeElements(source);
  assert.equal(normalized[0].changes.desktop.width, "167.109px");
  assert.equal(source[0].changes.desktop.width, "167.10899999999998px");
  assert.equal(normalized[0].changes.desktop.height, "NaNpx");
  assert.deepEqual(normalized[0].changes.mobile.width, {
    value: 127,
    unit: "px",
  });
  assert.deepEqual(invalidOverride(normalized), {
    element: "asset",
    breakpoint: "desktop",
    property: "height",
    value: "NaNpx",
    type: "string",
  });
  assert.deepEqual(
    normalizeElements([{ id: "theme", changes: {} }])[0].changes,
    {},
  );
});
test("resize geometry measures CSS boxes without subtracting rounded offset sizes", () => {
  const style = {
    boxSizing: "content-box",
    width: "127.109px",
    height: "auto",
    paddingLeft: "3.7px",
    paddingRight: "3.7px",
    paddingTop: "2px",
    paddingBottom: "2px",
    borderLeftWidth: "1px",
    borderRightWidth: "1px",
    borderTopWidth: "1px",
    borderBottomWidth: "1px",
  };
  const node = {
    ownerDocument: { defaultView: { getComputedStyle: () => style } },
    offsetWidth: 136,
    offsetHeight: 76,
  };
  assert.deepEqual(boxEdges(style), { width: 9.4, height: 6 });
  assert.deepEqual(dimensionsOf(node), { width: 127.109 + 9.4, height: 76 });
  style.boxSizing = "border-box";
  assert.deepEqual(boxEdges(style), { width: 0, height: 0 });
  assert.deepEqual(dimensionsOf(node), { width: 127.109, height: 76 });
});

import {
  fitScale,
  logicalPointer,
  displayedRect,
} from "../visual-tweaks/assets/viewport.js";
test("canvas scale fits display while keeping logical geometry independent", () => {
  assert.equal(fitScale(1440, 1000, 1080, 900), 0.75);
  assert.equal(fitScale(1440, 1000, 1080, 900, "actual"), 1);
  assert.equal(fitScale(390, 1000, 1080, 750), 0.75);
  assert.deepEqual(
    displayedRect(
      { left: 100, top: 50, width: 400, height: 200 },
      { left: 24, top: 100 },
      0.75,
    ),
    {
      left: 99,
      top: 137.5,
      width: 300,
      height: 150,
      right: 399,
      bottom: 287.5,
    },
  );
});
test("pointer coordinates are converted once according to their document", () => {
  const doc = {},
    frame = {
      contentDocument: doc,
      getBoundingClientRect: () => ({ left: 24, top: 100 }),
    };
  assert.deepEqual(
    logicalPointer(
      { target: { ownerDocument: doc }, clientX: 100, clientY: 50 },
      frame,
      0.75,
    ),
    { x: 100, y: 50 },
  );
  assert.deepEqual(
    logicalPointer(
      { target: { ownerDocument: {} }, clientX: 99, clientY: 137.5 },
      frame,
      0.75,
    ),
    { x: 100, y: 50 },
  );
});

test("generic system families stay unquoted CSS keywords, real font names remain quoted", () => {
  for (const family of ["system-ui", "sans-serif", "serif", "monospace"]) {
    assert.equal(fontValue(family), family);
    assert.equal(validValue("font-family", fontValue(family)), true);
  }
  assert.equal(fontValue("-apple-system"), "system-ui");
  assert.equal(fontValue("Georgia"), '\"Georgia\"');
  assert.equal(fontValue("Instrument Sans"), '\"Instrument Sans\"');
});

const { nearestGuide } =
  await import("../visual-tweaks/assets/smart-guides.js");
test("smart guides use logical thresholds and choose the nearest alignment", () => {
  assert.equal(nearestGuide(100, 100, 47, [{ value: 200 }]).correction, 3);
  assert.equal(nearestGuide(100, 100, 40, [{ value: 200 }]), null);
  assert.equal(
    nearestGuide(100, 100, 47, [{ value: 201 }, { value: 198 }]).value,
    198,
  );
});

const { propertyOrigin } = await import("../visual-tweaks/assets/styles.js");
test("responsive origin reflects only actual overrides, never theme values", () => {
  const e = {
    changes: {
      desktop: { width: "200px" },
      tablet: { color: "#fff" },
      mobile: { color: "#000" },
    },
  };
  assert.equal(propertyOrigin(e, "mobile", "width"), "desktop");
  assert.equal(propertyOrigin(e, "mobile", "color"), "mobile");
  assert.equal(propertyOrigin(e, "mobile", "height"), null);
  assert.equal(propertyOrigin(e, "desktop", "color"), null);
});

const { intersection } =
  await import("../visual-tweaks/assets/responsive-guard.js");
test("responsive overlap uses actual positive intersection, never adjacent boxes", () => {
  assert.equal(
    intersection(
      { left: 0, right: 20, top: 0, bottom: 20 },
      { left: 20, right: 40, top: 0, bottom: 20 },
    ),
    0,
  );
  assert.equal(
    intersection(
      { left: 0, right: 20, top: 0, bottom: 20 },
      { left: 10, right: 30, top: 10, bottom: 30 },
    ),
    100,
  );
});

const { splitBackground, backgroundLayers, replaceBackgroundLayers } =
  await import("../visual-tweaks/assets/background-layers.js");
test("background layers preserve gradients, nested commas, quotes and unaffected URLs", () => {
  const original = `linear-gradient(135deg, rgba(0, 0, 0, .2), rgba(255, 255, 255, .4)), url("a (copy).webp"), url('b.webp')`;
  assert.equal(splitBackground(original).length, 3);
  assert.equal(backgroundLayers(original)[1].src, "a (copy).webp");
  const next = replaceBackgroundLayers(original, [
    { layer: 1, image: { src: "new.webp" } },
  ]);
  assert.equal(splitBackground(next)[0], splitBackground(original)[0]);
  assert.equal(splitBackground(next)[2], splitBackground(original)[2]);
  assert.equal(backgroundLayers(next)[1].src, "new.webp");
  assert.equal(
    replaceBackgroundLayers(original, [{ layer: 0, image: { src: "x.png" } }]),
    null,
  );
  assert.equal(
    replaceBackgroundLayers(original, [{ layer: 3, image: { src: "x.png" } }]),
    null,
  );
  assert.equal(
    splitBackground(
      'image-set(url("a.png") 1x, url("b.png") 2x), radial-gradient(red, blue)',
    ).length,
    2,
  );
});
