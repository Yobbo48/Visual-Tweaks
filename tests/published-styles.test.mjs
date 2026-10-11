// 0.4.3 — rendu serveur des overrides publiés.
// Le CSS imprimé par PHP (PublishedStyles::css) doit être celui du runtime
// (styles.js/generateCSS) règle par règle : mêmes déclarations, même ordre,
// mêmes media queries. Seuls changent le sélecteur (même spécificité, vérifiée
// dans le navigateur par la recette publique) et l'absence des bases mesurées.
// PHP s'exécute avec @php-wasm (VT_TOOLCHAIN), comme dev/check.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { generateCSS } from "../visual-tweaks/assets/styles.js";
import { requireTool } from "../dev/toolchain.mjs";

const base = { strategy: "class", changes: {} };
const elements = [
  // Les quatre retouches de l'accueil de L'Énergie des Runes au 9 octobre 2026.
  { ...base, id: "vt-bande", selector: "div.bande-lieu", fingerprint: { tag: "div", classes: ["bande-lieu"] },
    changes: { desktop: { translateX: "0px", translateY: "-18px" }, mobile: { translateX: "0px", translateY: "-7px" } } },
  { ...base, id: "vt-liste", selector: "ul.wrap.bande-lieu__in", fingerprint: { tag: "ul", classes: ["wrap", "bande-lieu__in"] },
    changes: { desktop: { translateX: "1px", translateY: "1px" } } },
  { ...base, id: "vt-nav", selector: "div.wrap.nav", fingerprint: { tag: "div", classes: ["wrap", "nav"] },
    changes: { desktop: { translateX: "0px", translateY: "0px" } } },
  { ...base, id: "vt-logo", selector: "img.logo__sceau", fingerprint: { tag: "img", classes: ["logo__sceau"], src: "https://exemple.test/logo-150x150.webp" },
    changes: { desktop: { width: "60px", height: "60px", "max-width": "60px", translateX: "-14px", translateY: "0px" } } },
  // Héritage partiel de translate entre écrans, propriétés propres à la tablette.
  { ...base, id: "vt-titre", selector: "#hero > h1:nth-of-type(1)", strategy: "hierarchy", fingerprint: { tag: "h1", classes: [], text: "Titre" },
    changes: { desktop: { translateY: "4px", "font-size": "2.5rem" }, tablet: { translateX: "3px", color: "#112233" }, mobile: { "letter-spacing": "-0.5px" } } },
  // Image zoomée (object-view-box calculé sans mesure) ; src à échapper.
  { ...base, id: "vt-photo", selector: '[data-vt-id="photo"]', strategy: "data", fingerprint: { tag: "img", classes: ["photo"], anchor: "photo", src: 'https://exemple.test/a"b\\c.webp' },
    changes: { desktop: { imageZoom: "160", "object-position": "40% 60%" }, mobile: { width: "100%" } } },
];
// Dépendent d'une mesure dans la page : jamais rendues côté serveur.
const runtimeOnly = [
  { ...base, id: "vt-voile", selector: "section.voile", fingerprint: { tag: "section", classes: ["voile"], background: 'url("x.webp")' },
    changes: { desktop: { "overlay-color": "#00000080" } } },
  { ...base, id: "vt-zoom-fond", selector: "div.fond", fingerprint: { tag: "div", classes: ["fond"], background: 'url("y.webp")' },
    changes: { desktop: { imageZoom: "120" } } },
  { ...base, id: "vt-couche", selector: "div.couche", fingerprint: { tag: "div", classes: ["couche"], background: 'url("z.webp")' },
    changes: { desktop: { width: "50%" } }, content: { backgroundLayers: [{ layer: 0, attachmentId: 3, image: { src: "https://exemple.test/z2.webp" } }] } },
  { ...base, id: "vt-image-fond", selector: "div.image-fond", fingerprint: { tag: "div", classes: ["image-fond"], background: 'url("w.webp")' },
    changes: {}, content: { attachmentId: 4, assetKind: "background", image: { src: "https://exemple.test/w2.webp" } } },
];

async function phpRun(code) {
  const { PHP } = requireTool("@php-wasm/universal");
  const { loadNodeRuntime } = requireTool("@php-wasm/node");
  const schema = await readFile("visual-tweaks/includes/class-schema.php", "utf8");
  const published = await readFile("visual-tweaks/includes/class-published-styles.php", "utf8");
  const php = new PHP(await loadNodeRuntime("8.3", { emscriptenOptions: { processId: process.pid } }));
  const strip = (s) => s.replace(/^<\?php\s*namespace VisualTweaks;\s*defined\('ABSPATH'\) \|\| exit;/, "");
  const result = await php.run({
    code: `<?php namespace { define('ABSPATH', '/'); function sanitize_text_field($v) { return $v; } } namespace VisualTweaks { ${strip(schema)} ${strip(published)} } namespace { ${code} }`,
  });
  php.exit();
  return JSON.parse(result.text);
}
async function phpCss(list) {
  const { PHP } = requireTool("@php-wasm/universal");
  const { loadNodeRuntime } = requireTool("@php-wasm/node");
  const schema = await readFile("visual-tweaks/includes/class-schema.php", "utf8");
  const published = await readFile("visual-tweaks/includes/class-published-styles.php", "utf8");
  const php = new PHP(await loadNodeRuntime("8.3", { emscriptenOptions: { processId: process.pid } }));
  const strip = (s) => s.replace(/^<\?php\s*namespace VisualTweaks;\s*defined\('ABSPATH'\) \|\| exit;/, "");
  const payload = Buffer.from(JSON.stringify(list)).toString("base64");
  const result = await php.run({
    code: `<?php namespace { define('ABSPATH', '/'); } namespace VisualTweaks { ${strip(schema)} ${strip(published)} } namespace {
      $elements = json_decode(base64_decode('${payload}'), true);
      echo json_encode(['css' => \\VisualTweaks\\PublishedStyles::css($elements),
        'selectors' => array_map(fn($e) => \\VisualTweaks\\PublishedStyles::selector($e), $elements),
        'runtime' => array_map(fn($e) => \\VisualTweaks\\PublishedStyles::needs_runtime($e), $elements)]); }`,
  });
  php.exit();
  return JSON.parse(result.text);
}
const rules = (css) =>
  css.replace(/^\/\*[^\n]*\*\/\n/, "")
    .replace(/\[data-vt-target="[^"]+"\] \{/g, "SELECTEUR {")
    .replace(/:where\([^\n]*\):not\(\[data-vt-published-off\]\) \{/g, "SELECTEUR {");

test("PHP prints the runtime's CSS rule for rule (selectors aside)", { skip: !process.env.VT_TOOLCHAIN && "VT_TOOLCHAIN absent : PHP WebAssembly indisponible" }, async () => {
  const php = await phpCss(elements);
  assert.equal(rules(php.css), rules(generateCSS(elements)));
  assert.match(php.css, /^\/\* Visual Tweaks — overrides publiés \(rendu serveur\) \*\//);
  assert.match(php.css, /@media \(max-width: 767px\) \{\n\/\* div\.bande-lieu \*\/\n:where\(html:not\(\[data-vt-runtime\]\)\) :where\(div\.bande-lieu\):where\(div\.bande-lieu\):not\(\[data-vt-published-off\]\) \{\n  translate: calc\(var\(--vt-base-x, 0px\) \+ 0px\) calc\(var\(--vt-base-y, 0px\) \+ -7px\) !important;/);
  assert.doesNotMatch(php.css, /--vt-base-x: /, "aucune base mesurée côté serveur");
});

test("selectors keep the stored target, the fingerprint, the runtime lock and a (0,1,0) specificity", { skip: !process.env.VT_TOOLCHAIN && "VT_TOOLCHAIN absent" }, async () => {
  const php = await phpCss(elements);
  assert.equal(php.selectors[0], ":where(html:not([data-vt-runtime])) :where(div.bande-lieu):where(div.bande-lieu):not([data-vt-published-off])");
  assert.equal(php.selectors[3], ':where(html:not([data-vt-runtime])) :where(img.logo__sceau):where(img.logo__sceau):where([src="https://exemple.test/logo-150x150.webp"]):not([data-vt-published-off])');
  assert.equal(php.selectors[4], ":where(html:not([data-vt-runtime])) :where(#hero > h1:nth-of-type(1)):where(h1):not([data-vt-published-off])");
  assert.equal(php.selectors[5], ':where(html:not([data-vt-runtime])) :where([data-vt-id="photo"]):where(img.photo):where([src="https://exemple.test/a\\"b\\\\c.webp"]):not([data-vt-published-off])');
});

test("measured backgrounds and overlays stay with the runtime; the rest of the element is printed", { skip: !process.env.VT_TOOLCHAIN && "VT_TOOLCHAIN absent" }, async () => {
  const php = await phpCss([...runtimeOnly, elements[0]]);
  assert.deepEqual(php.runtime, [true, true, true, true, false]);
  assert.doesNotMatch(php.css, /overlay-color|background-size|background-image/);
  for (const e of runtimeOnly.filter((e) => e.id !== "vt-couche")) assert.doesNotMatch(php.css, new RegExp(e.selector.replace(".", "\\.")));
  // Couches de fond : l'image reste au runtime, la largeur est imprimée dès le premier rendu.
  const printable = runtimeOnly.filter((e) => e.id === "vt-couche").map(({ content, ...e }) => e);
  assert.equal(rules(php.css), rules(generateCSS([...printable, elements[0]])));
  assert.equal((await phpCss(runtimeOnly.filter((e) => e.id !== "vt-couche"))).css, "", "rien à imprimer : pas de balise <style> vide");
});

test("an <html> target stays with the runtime (the lock needs a descendant)", { skip: !process.env.VT_TOOLCHAIN && "VT_TOOLCHAIN absent" }, async () => {
  const php = await phpCss([{ ...base, id: "vt-racine", selector: "html", fingerprint: { tag: "html", classes: [] }, changes: { desktop: { "font-size": "17px" } } }]);
  assert.deepEqual(php.runtime, [true]);
  assert.equal(php.css, "");
});

test("no stored value can close the <style> element", { skip: !process.env.VT_TOOLCHAIN && "VT_TOOLCHAIN absent" }, async () => {
  const php = await phpCss([{ ...elements[3], fingerprint: { ...elements[3].fingerprint, src: "https://exemple.test/</style><script>alert(1)</script>" } }]);
  assert.doesNotMatch(php.css, /</);
});

// 0.4.4 — toutes les propriétés acceptées par Schema::value(), lues par réflexion,
// sur les trois écrans avec héritage : le PHP et le JavaScript impriment le même CSS.
const SAMPLES = {
  translateX: ["12px", "-3px", "0.5rem"], translateY: ["-18px", "4px", "2%"],
  width: ["320px", "80%", "fit-content"], height: ["auto", "200px", "50vh"], "max-width": ["none", "640px", "90%"], "min-width": ["10px", "0", "2em"],
  "margin-top": ["auto", "-8px", "1.5rem"], "margin-right": ["4px", "0", "auto"], "margin-bottom": ["12px", "-2px", "0"], "margin-left": ["auto", "3px", "1em"],
  "padding-top": ["8px", "0", "1rem"], "padding-right": ["2px", "4px", "6px"], "padding-bottom": ["0", "10px", "2vh"], "padding-left": ["1px", "0.25rem", "5%"],
  gap: ["24px", "1rem", "0"], "font-size": ["42px", "2.5rem", "18px"], "letter-spacing": ["-0.5px", "0.1em", "0"], "border-radius": ["15px", "50%", "0"], "border-width": ["1px", "2px", "0"],
  color: ["#112233", "#abc", "transparent"], "background-color": ["#11223344", "currentColor", "#fff"], "border-color": ["#000", "#123456", "currentColor"],
  opacity: ["0.5", "1", "0"], "font-weight": ["700", "400", "900"], "z-index": ["3", "auto", "-1"], "line-height": ["1.4", "normal", "24px"],
  "font-family": ['"Inter", sans-serif', "Georgia, serif", '"Cormorant Garamond", serif'],
  "box-shadow": ["0px 4px 12px 0px #00000033", "none", "2px 2px 0px 1px #ff000080"], filter: ["blur(2px)", "none", "blur(12px)"],
  "object-position": ["40% 60%", "0% 100%", "50.5% 50%"], "background-position": ["10% 20%", "100% 0%", "50% 50%"],
};
test("every property accepted by Schema renders identically in PHP and JavaScript, on the three screens", { skip: !process.env.VT_TOOLCHAIN && "VT_TOOLCHAIN absent" }, async () => {
  const accepted = await phpRun(`$r = new ReflectionClass('VisualTweaks\\Schema');
    $enums = $r->getConstant('ENUMS'); $lengths = $r->getConstant('LENGTHS');
    echo json_encode(['enums' => $enums, 'lengths' => $lengths]);`);
  const enumSamples = Object.fromEntries(Object.entries(accepted.enums).map(([p, values]) => [p, [values[0], values.at(-1), values[Math.floor(values.length / 2)]]]));
  const all = { ...SAMPLES, ...enumSamples };
  for (const p of accepted.lengths) assert.ok(all[p], `échantillon manquant pour ${p}`);
  const modes = ["desktop", "tablet", "mobile"];
  const element = (property, i) => ({
    ...base, id: `vt-p${i}`, selector: `div.p${i}`, fingerprint: { tag: "div", classes: [`p${i}`] },
    // Desktop seul, tablette seule, ou les trois : couvre héritage et exceptions.
    changes: Object.fromEntries(modes.filter((m, k) => i % 3 === 0 || k === i % 3).map((m, k) => [m, { [property]: all[property][k % 3] }])),
  });
  const list = Object.keys(all).map(element);
  const checked = await phpRun(`$out = []; foreach (json_decode(base64_decode('${Buffer.from(JSON.stringify(list)).toString("base64")}'), true) as $e)
    foreach ($e['changes'] as $mode => $values) foreach ($values as $p => $v) if (!\\VisualTweaks\\Schema::value($p, $v)) $out[] = "$p=$v"; echo json_encode($out);`);
  assert.deepEqual(checked, [], "chaque échantillon est une valeur acceptée par WordPress");
  const php = await phpCss(list);
  assert.equal(rules(php.css), rules(generateCSS(list)));
  for (const property of Object.keys(all)) assert.match(php.css, new RegExp(`  ${property === "translateX" || property === "translateY" ? "translate" : property}: `));
});

test("a zoomed image that also has a CSS background stays with the runtime, like styles.js", { skip: !process.env.VT_TOOLCHAIN && "VT_TOOLCHAIN absent" }, async () => {
  const php = await phpCss([{ ...base, id: "vt-bgimg", selector: "img.bg", fingerprint: { tag: "img", classes: ["bg"], src: "a.webp", background: 'url("b.webp")' }, changes: { desktop: { imageZoom: "150" } } }]);
  assert.deepEqual(php.runtime, [true]);
  assert.equal(php.css, "");
});
