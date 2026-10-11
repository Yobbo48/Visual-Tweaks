// 0.4.4 — caches de page après une publication (Cache::after_publish).
// PHP WebAssembly (VT_TOOLCHAIN) avec des fonctions WordPress simulées :
// LiteSpeed purge la seule URL publiée, une purge en échec est rapportée sans
// lever d'erreur, le CDN Hostinger n'est jamais vidé automatiquement.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { requireTool } from "../dev/toolchain.mjs";

async function afterPublish({ litespeed = false, failing = false, hostinger = false, admin = true }) {
  const { PHP } = requireTool("@php-wasm/universal");
  const { loadNodeRuntime } = requireTool("@php-wasm/node");
  const cache = (await readFile("visual-tweaks/includes/class-cache.php", "utf8")).replace(
    /^<\?php\s*namespace VisualTweaks;\s*defined\('ABSPATH'\) \|\| exit;/,
    "",
  );
  const php = new PHP(await loadNodeRuntime("8.3", { emscriptenOptions: { processId: process.pid } }));
  const result = await php.run({
    code: `<?php namespace {
      define('ABSPATH', '/');
      $GLOBALS['calls'] = [];
      function home_url($p = '') { return 'https://exemple.test' . $p; }
      function rest_url($p) { return 'https://exemple.test/wp-json/' . $p; }
      function current_user_can($c) { return ${admin ? "true" : "false"}; }
      function apply_filters($h, $v) { return $v; }
      function has_action($h) { return ${litespeed ? "true" : "false"} && $h === 'litespeed_purge_url'; }
      function do_action($h, ...$a) { $GLOBALS['calls'][] = [$h, $a];
        if (${failing ? "true" : "false"}) throw new RuntimeException('purge indisponible'); }
      ${hostinger ? "define('HOSTINGER_PLUGIN_REST_API_BASE', 'hostinger-tools-plugin/v1');" : ""}
    } namespace VisualTweaks { ${cache} } namespace {
      $report = \\VisualTweaks\\Cache::after_publish('/a-propos/?x=1');
      echo json_encode(['report' => $report, 'calls' => $GLOBALS['calls'], 'silent' => defined('LITESPEED_PURGE_SILENT')]);
    }`,
  });
  php.exit();
  return JSON.parse(result.text);
}
const skip = !process.env.VT_TOOLCHAIN && "VT_TOOLCHAIN absent : PHP WebAssembly indisponible";

test("LiteSpeed: only the published URL is purged, silently", { skip }, async () => {
  const r = await afterPublish({ litespeed: true });
  assert.equal(r.report.litespeed, "purged");
  assert.deepEqual(r.calls, [["litespeed_purge_url", ["https://exemple.test/a-propos/?x=1"]]]);
  assert.equal(r.silent, true, "pas de notification « Purge url » dans l'administration");
  assert.equal(r.report.cdn, null);
});

test("a failing purge is reported and never throws (the save stays confirmed)", { skip }, async () => {
  const r = await afterPublish({ litespeed: true, failing: true });
  assert.equal(r.report.litespeed, "failed");
});

test("without a page cache plugin, nothing is called and the report says so", { skip }, async () => {
  const r = await afterPublish({});
  assert.equal(r.report.litespeed, "absent");
  assert.deepEqual(r.calls, []);
});

test("Hostinger CDN: offered (whole site, explicit action), never purged automatically", { skip }, async () => {
  const r = await afterPublish({ litespeed: true, hostinger: true });
  assert.deepEqual(r.report.cdn, {
    provider: "hostinger",
    scope: "site",
    purge: "https://exemple.test/wp-json/hostinger-tools-plugin/v1/clear-cache",
  });
  assert.ok(r.calls.every(([hook]) => hook === "litespeed_purge_url"), "aucune purge complète déclenchée");
  const editorOnly = await afterPublish({ hostinger: true, admin: false });
  assert.equal(editorOnly.report.cdn, null, "proposé seulement à qui peut l'exécuter");
});
