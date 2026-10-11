#!/usr/bin/env node
/* Campagne courte 0.4.4 / 0.4.5, mêmes données, mêmes conditions (CI).
   Un seul navigateur (Chromium) et un seul scénario à la fois, jamais en parallèle.

   node dev/campagne-mesures.mjs --reference http://127.0.0.1:9412
        --candidate http://127.0.0.1:9410 --sortie mesures-ci

   1. publie les deux mêmes retouches sur la page de banc des deux sites ;
   2. ressources (dev/mesure-ressources.mjs) : référence, candidate, candidate
      allégée, scénario par scénario, fenêtres de 10 à 15 s ;
   3. performances publiques (dev/mesure-publique.mjs) : desktop/mobile,
      cache froid/chaud, deux tours en ordre alterné ;
   4. resume.md et resume.json.                                               */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const REF = option("reference", "http://127.0.0.1:9412");
const CAND = option("candidate", "http://127.0.0.1:9410");
const OUT = option("sortie", "mesures-ci");
// Répétition ciblée d'une mesure ambiguë : --sans-ressources, --profils mobile,
// --caches froid, --tours 4, --passages 5 (défauts : tout, 2 tours de 3).
const SANS_RESSOURCES = args.includes("--sans-ressources");
const PROFILS = option("profils", "desktop,mobile").split(",");
const CACHES = option("caches", "froid,chaud").split(",");
const TOURS = Number(option("tours", 2));
const PASSAGES = option("passages", "3");
// Témoin A/A (deux copies de la même extension) : --libelles "copie 1,copie 2".
const [LREF, LCAND] = option("libelles", "0.4.4,0.4.5").split(",");
mkdirSync(OUT, { recursive: true });
const node = (file, list) => {
  console.log(`\n$ node ${file} ${list.join(" ")}`);
  const r = spawnSync(process.execPath, [file, ...list], { stdio: "inherit" });
  return r.status === 0;
};
// Thème réel : --page, --autre et --cibles sont transmis aux mesures ; avec des
// retouches de production déjà chargées, --sans-preparation n'en publie aucune.
const FORWARD = ["page", "autre", "cibles"].flatMap((k) =>
  option(k, null) === null ? [] : [`--${k}`, option(k)],
);
if (!args.includes("--sans-preparation"))
  for (const base of [REF, CAND])
    if (!node("dev/mesure-ressources.mjs", ["preparer", "--base", base, ...FORWARD]))
      throw new Error(`Préparation impossible : ${base}`);

const SCENARIOS = [
  ["public", 12, false],
  ["public-defilement", 12, false],
  ["repos", 15, true],
  ["repos-selection", 12, true],
  ["defilement", 12, true],
  ["interactions", 15, true],
  ["navigations", 10, true],
  ["masque-retour", 10, true],
];
const runs = [];
for (const [scenario, duree, editor] of SANS_RESSOURCES ? [] : SCENARIOS) {
  const variants = [
    [LREF, REF, []],
    [LCAND, CAND, []],
    ...(editor ? [[`${LCAND} allégé`, CAND, ["--leger"]]] : []),
  ];
  for (const [version, base, extra] of variants) {
    const file = `${OUT}/${scenario}-${version.replace(/\W+/g, "-")}.json`;
    const ok = node("dev/mesure-ressources.mjs", [
      scenario,
      "--base",
      base,
      "--duree",
      String(duree),
      "--sortie",
      file,
      ...extra,
      ...FORWARD,
    ]);
    runs.push({ scenario, version, file, ok });
  }
}
const PUBLIC = [];
for (const profil of PROFILS)
  for (const cache of CACHES)
    for (let tour = 1; tour <= TOURS; tour++) {
      const order = tour % 2 ? [[LREF, REF], [LCAND, CAND]] : [[LCAND, CAND], [LREF, REF]];
      for (const [version, base] of order) {
        const file = `${OUT}/public-${profil}-${cache}-${version.replace(/\W+/g, "-")}-t${tour}.json`;
        const ok = node("dev/mesure-publique.mjs", [
          "--base",
          base,
          "--profil",
          profil,
          "--cache",
          cache,
          "--passages",
          PASSAGES,
          "--sortie",
          file,
          ...(option("page", null) ? ["--page", option("page")] : []),
        ]);
        PUBLIC.push({ profil, cache, tour, version, file, ok });
      }
    }

const read = (f) => (existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null);
const lines = [
  "## Ressources (Chromium, banc animé, une fenêtre par ligne)",
  "",
  "| Scénario | Version | CPU moyen % | pic % | fil principal % | script ms/s | style/s | mise en page/s | thème ms/s | éditeur ms/s | runtime ms/s | rendu natif ms/s | rAF thème haut / cadre | tas Mo | nœuds |",
  "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
];
const json = { ressources: [], publiques: [] };
const row = (scenario, version, m) => {
  const p = m.profil.parOrigine,
    s = m.dureeS,
    per = (k) => +((p[k] || 0) / s).toFixed(1);
  const raf = (side) => m.recurrentParS?.[side]?.raf?.theme ?? 0;
  const r = {
    scenario,
    version,
    cpu: m.cpu.moyennePct,
    pic: m.cpu.picPct,
    fil: m.filPrincipal.occupePct,
    script: m.filPrincipal.scriptMsParS,
    style: m.filPrincipal.recalculsStyleParS,
    layout: m.filPrincipal.misesEnPageParS,
    theme: per("thème"),
    editeur: per("éditeur"),
    runtime: per("runtime public"),
    natif: per("rendu natif"),
    rafHaut: raf("haut"),
    rafCadre: raf("cadre"),
    tas: m.memoire.tasJSMo,
    noeuds: m.memoire.noeuds,
  };
  json.ressources.push(r);
  lines.push(
    `| ${scenario} | ${version} | ${r.cpu} | ${r.pic} | ${r.fil} | ${r.script} | ${r.style} | ${r.layout} | ${r.theme} | ${r.editeur} | ${r.runtime} | ${r.natif} | ${r.rafHaut} / ${r.rafCadre} | ${r.tas} | ${r.noeuds} |`,
  );
};
for (const run of runs) {
  const d = read(run.file);
  if (!d?.mesure) {
    lines.push(`| ${run.scenario} | ${run.version} | échec de la mesure |||||||||||||`);
    continue;
  }
  row(run.scenario, run.version, d.mesure);
  if (d.retour) row(`${run.scenario} (retour)`, run.version, d.retour);
  if (d.memoireParNavigation)
    json.ressources.at(-1).memoireNavigations = [d.memoireApresOuverture, ...d.memoireParNavigation].map((x) => x.tasJSMo);
}
lines.push(
  "",
  "## Performances publiques (médianes de 3 passages)",
  "",
  "| Profil | Cache | Tour | Version | TTFB | FCP après réponse | FCP | LCP | CLS | longues tâches | LoAF (médiane ; par passage) | trames lentes chargement / défilement | pire trame | requêtes | Ko | modules VT |",
  "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
);
for (const run of PUBLIC) {
  const d = read(run.file);
  if (!d) {
    lines.push(`| ${run.profil} | ${run.cache} | ${run.tour} | ${run.version} | échec |||||||||`);
    continue;
  }
  const r = d.resume;
  json.publiques.push({ ...run, ...r });
  lines.push(
    `| ${run.profil} | ${run.cache} | ${run.tour} | ${run.version} | ${r.ttfb ?? "—"} | ${r.fcpApresReponse ?? "—"} | ${r.fcp} | ${r.lcp} | ${r.cls} | ${r.longues} | ${r.loafs} ; ${d.passages.map((p) => p.loafs).join(" ")} | ${r.lentesChargement} / ${r.lentesDefilement} | ${r.pireTrame} | ${r.requetes} | ${r.ko} | ${r.modulesVT.join(", ")} |`,
  );
}
// Totaux par version : passages avec au moins un long animation frame.
const totals = {};
for (const run of PUBLIC) {
  const d = read(run.file);
  if (!d) continue;
  const key = `${run.profil} ${run.cache} ${run.version}`;
  totals[key] ||= { passages: 0, avecLoaf: 0, loafs: 0, ttfb: [], fcp: [], fcpApresReponse: [] };
  for (const p of d.passages) {
    totals[key].passages++;
    for (const k of ["ttfb", "fcp", "fcpApresReponse"]) if (p[k] != null) totals[key][k].push(p[k]);
    totals[key].loafs += p.loafs;
    if (p.loafs) totals[key].avecLoaf++;
  }
}
const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : "—");
lines.push("", "Tous tours confondus (médianes de tous les passages) :", "");
for (const [k, t] of Object.entries(totals))
  lines.push(`- ${k} : TTFB ${med(t.ttfb)} ms, FCP ${med(t.fcp)} ms, FCP après réponse ${med(t.fcpApresReponse)} ms ; ${t.avecLoaf} passage(s) sur ${t.passages} avec au moins un LoAF (${t.loafs} au total)`);
json.loafs = totals;
// Test de rang (Mann-Whitney, approximation normale corrigée des égalités) sur
// tous les passages : l'écart entre les deux sites dépasse-t-il le bruit du banc ?
const erf = (x) => {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x < 0 ? -y : y;
};
function rangs(a, b) {
  const all = [...a.map((v) => [v, 0]), ...b.map((v) => [v, 1])].sort((x, y) => x[0] - y[0]);
  let r1 = 0, ties = 0;
  for (let i = 0; i < all.length; ) {
    let j = i;
    while (j + 1 < all.length && all[j + 1][0] === all[i][0]) j++;
    for (let k = i; k <= j; k++) if (all[k][1] === 0) r1 += (i + j) / 2 + 1;
    ties += (j - i + 1) ** 3 - (j - i + 1);
    i = j + 1;
  }
  const n1 = a.length, n2 = b.length, n = n1 + n2;
  const u = r1 - (n1 * (n1 + 1)) / 2;
  const sigma = Math.sqrt(((n1 * n2) / 12) * (n + 1 - ties / (n * (n - 1))));
  const z = sigma ? (u - (n1 * n2) / 2) / sigma : 0;
  return { z: +z.toFixed(2), p: +(1 - erf(Math.abs(z) / Math.SQRT2)).toFixed(3) };
}
json.ecarts = [];
lines.push("", `Écart ${LCAND} − ${LREF}, tous passages (différence des médianes ; test de rang, p bilatéral) :`, "");
for (const profil of PROFILS)
  for (const cache of CACHES) {
    const a = totals[`${profil} ${cache} ${LREF}`], b = totals[`${profil} ${cache} ${LCAND}`];
    if (!a || !b) continue;
    const parts = [];
    for (const k of ["fcpApresReponse", "fcp", "ttfb"]) {
      if (!a[k].length || !b[k].length) continue;
      const t = rangs(b[k], a[k]), d = med(b[k]) - med(a[k]);
      json.ecarts.push({ profil, cache, mesure: k, ecart: d, ...t, [LREF]: a[k], [LCAND]: b[k] });
      parts.push(`${k} ${d >= 0 ? "+" : ""}${d} ms (p = ${t.p})`);
    }
    lines.push(`- ${profil} ${cache} : ${parts.join(" ; ")}`);
    for (const k of ["fcpApresReponse", "fcp"])
      if (a[k].length && b[k].length)
        lines.push(`  - ${k}, passages triés : ${LREF} [${[...a[k]].sort((x, y) => x - y).join(" ")}] ; ${LCAND} [${[...b[k]].sort((x, y) => x - y).join(" ")}]`);
  }
writeFileSync(`${OUT}/resume.md`, lines.join("\n") + "\n");
writeFileSync(`${OUT}/resume.json`, JSON.stringify(json, null, 2));
console.log(lines.join("\n"));
const failed = [...runs, ...PUBLIC].filter((r) => !r.ok);
if (failed.length) {
  console.log(`${failed.length} mesure(s) en échec`);
  process.exitCode = 1;
}
