# Visual Tweaks 0.4.5 — validation avant déploiement — 11 octobre 2026

**Rien n'est déployé.** Production : WordPress 7.1.3, extension 0.4.3 au 11/10 ; la 0.4.4 n'a jamais été installée.

## 0. Verdict

**Encore bloquée, pour une seule raison : le mode allégé n'a pas pu être vérifié sur Firefox et WebKit avec le thème réel.** Ces navigateurs ne s'installent pas dans cet environnement : `cdn.playwright.dev` et `playwright.download.prss.microsoft.com` y restent refusés par la politique réseau. Contrôle non réalisé, sans campagne relancée.

Tout le reste de la recette sur le site complet est conforme, **sans aucun défaut trouvé** (section 12). Elle compare la 0.4.3 en production et la candidate 0.4.5 (`7374be3`) dans les mêmes conditions : thème réel 1.9.77, 14 pages, témoignages, vrais médias et vraies retouches, WordPress 7.1.3, PHP 8.3.33.
- **Pages complètes et images** : accueil complet et vrai logo, rendu sans erreur ; HTML visiteur 0.4.3 = 0.4.5.
- **Ressources de l'éditeur** :
  - seconde copie invisible du thème supprimée ;
  - à cadence égale, coût de l'aperçu divisé par deux (−50 % au repos, −58 % avec sélection) ;
  - mode allégé : −80 % de CPU au repos.
- **Mode allégé sur Chromium** : 6/6. Réversible, une seule boucle au retour, 39 apparitions et compteurs menés à leur terme en mode allégé, retouches et contours exacts.
- **Conservation** (enregistrer, changer de page, recharger, brouillon, annulation) et **fidélité** desktop et mobile (premier affichage = publié = éditeur, sans double application) : conformes, à l'identique en 0.4.3 et en 0.4.5.
- **Performances publiques** : aucune régression reproductible. Un écart ambigu du premier passage, répété sur 20 passages, s'est inversé dans le bruit.

Critères bloquants :
- **perte de modification** : aucune, sur le banc animé (trois moteurs) comme sur le site réel ;
- **rendu incorrect** : aucun ;
- **mode allégé mal réversible** : non, sur Chromium ; **Firefox et WebKit non vérifiés sur le thème réel**. Ils l'ont été sur le banc animé (CI, exécution n° 9) ;
- **régression des performances publiques** : aucune.

**Pour lever le blocage** : autoriser les deux domaines Playwright dans l'accès réseau de l'environnement (section 8), puis rejouer `recette/allege-theme-reel.mjs` avec `VT_ENGINE=firefox` et `VT_ENGINE=webkit`, quelques minutes. S'il est conforme, la 0.4.5 est prête à déployer avec l'archive de la section 9, sans autre changement.

**Avant tout déploiement**, indépendamment de Visual Tweaks : selon l'export, `custom_logo` est absent de la base de production. Le thème n'affiche alors **aucun logo** : celui qu'on voit aujourd'hui viendrait du cache, et la purge prévue par `PROCEDURE.md` le ferait disparaître. À vérifier avant toute purge (`PROCEDURE.md`). Le menu principal n'a pas pu être comparé : l'export en est vide (section 12.2).

## 1. Commit et environnement

**Code testé**
- Extension (`visual-tweaks/`) : dernière modification au commit `7374be3` (contour replacé après une transition), validé par l'exécution de CI n° 9. Modification précédente : `c350cf7`.
- Archive `artifacts/visual-tweaks-0.4.5.zip` : construite depuis l'arbre de `7374be3`, identique à celui-ci (`diff -r`), 49 fichiers.
- Référence 0.4.4 : commit `fbbf381`, identique à `artifacts/visual-tweaks-0.4.4.zip`.

**CI GitHub Actions** (`.github/workflows/validation.yml`)
- Machine : ubuntu-24.04, 4 vCPU, 16 Go, sans GPU.
- Outils : Node 24.21.0, Playwright 1.62.1 (Chromium 151, Firefox et WebKit de cette version).
- WordPress Playground : **WordPress 7.1.3**, la version de production, avec SQLite. PHP demandé : 8.3. La version effective n'a pas été relue en CI : sur le banc du thème réel, sans `preferredVersions` dans le blueprint, le même outil annonce 8.3 mais exécute les requêtes en PHP 8.5.10 (`PHP_VERSION`, section 12.1). C'est le cas de `dev/blueprint.json`.
- Version de production lue par 2 requêtes, sans JavaScript donc sans envoi Analytics (`www.lenergiedesrunes.com` redirige vers `lenergiedesrunes.fr`) :
  - flux : `<generator>https://wordpress.org/?v=7.1.3</generator>` ;
  - fichiers `wp-includes` : `?ver=7.1.3`.

| Exécution | Commit | Contenu | Résultat |
|---|---|---|---|
| n° 3 | `1e9ad8f` | suite complète, échecs rejoués sur la 0.4.4 | 36 réussies, 6 en échec, toutes préexistantes ou d'environnement (section 7) |
| n° 4 | `ab38154` | suite complète après corrections ciblées ; campagne de mesures complète | **42/42 réussies**, 10 non exécutées (thème réel) ; mesures en section 3 |
| n° 5 | `2e2a784` | remplacée, donc annulée ; seul son job de mesures a tourné : répétition de la mesure ambiguë (mobile, cache froid) | 0.4.5 plus lente de 24 à 52 ms (FCP) à chaque tour |
| n° 6 | `30f06ae` | annulée de même ; job de mesures seul, seconde répétition dans la même configuration | écart non reproduit (0.4.5 tantôt plus rapide, tantôt plus lente) |
| n° 7 | `adf7f35` | suite complète, tests PHP compris ; répétitions mesurant le TTFB, puis sites inversés | 41 réussies, 1 en échec : `ressources-e2e` WebKit, défaut de connexion du test (section 7) ; 0.4.5 plus lente de 4 et 7 ms après la réponse |
| n° 8 | `d54c91c` | suite après correction des tests ; témoin A/A ; 0.4.4 / 0.4.5 avec les extensions au même niveau, test de rang | **42 réussies sur 42**, tests PHP 11/11 ; témoin +0 ms, versions +0 ms (section 6) |
| n° 9 | `7374be3` | code final (contour) : suite complète, témoin A/A, 0.4.4 / 0.4.5 | **42 réussies sur 42**, tests PHP 11/11, contour après transition réussi sur les trois moteurs ; témoin et versions en section 6 |

**Conteneur distant** (premier passage et contrôles ciblés)
- Linux, 4 cœurs, Chromium 141, Node 22.22.
- WordPress 6.5.5 seulement : wordpress.org, github.com et le domaine de production y sont bloqués par le réseau.
- Firefox et WebKit n'y sont pas installables (CDN de Playwright bloqué).

**Différences d'environnement restantes**
- PHP : 8.3.35 en production (export des contenus). Banc du site réel : 8.3.33 effectif (section 12.1). CI : 8.3 demandé, très probablement 8.5.10 effectif, non relu.
- Base MySQL/MariaDB en production, SQLite en CI.
- LiteSpeed et CDN Hostinger absents du banc.
- Navigateurs Linux sans fenêtre, alors que Kevin utilise un Mac.
- Thème réel absent.

## 2. Prérequis : thème réel et données

**Mise à jour du 11/10 après-midi** : le thème et l'export des options ont été fournis. Recette en section 11 ; les contenus manquants sont listés en section 11.2. Ce qui suit décrit la recherche du matin.

**Recherche du thème**, sans résultat utilisable :
- dépôt Visual-Tweaks, branches `main` et de travail, historique complet : aucun thème de production.
  - `.local/real-theme/kevin-legros` est ignoré par Git.
  - `artifacts/real-theme-source-hashes.json` ne contient que les empreintes des 191 fichiers de `kevin-legros`.
- Artefacts : aucune archive de thème.
- Autres dépôts accessibles :
  - `Nornsight`, dossier `wordpress/` : prototypes de mai 2026. `lenergiedesrunes` 0.2.0 n'a pas de dossier `js/` ; s'y ajoutent `energiedesrunes-v2` et `edr-*`. Aucun ne contient `.bande-lieu`, `logo__sceau` ni la boucle `tick` de `main.js` relevée en 0.4.4 : ce n'est pas le thème de production ;
  - `nornsight-app`, `Popote` : pas de WordPress.

**Archives nécessaires**
1. Thème de production, dossier `wp-content/themes/lenergiedesrunes/` tel qu'en ligne, avec `js/main.js` (boucle `tick`) :
   `tar czf lenergiedesrunes-theme-AAAAMMJJ.tar.gz -C wp-content/themes lenergiedesrunes`
2. Export des options `vt_*` : `production-options-vt.json` du 11/10, dans les sauvegardes locales `visual-tweaks-0.4.4-20261011/sauvegardes/`. Il contient les retouches du logo et de la bande (révision 22, 2 éléments). Il n'est pas dans le dépôt.
3. Les médias et le contenu utilisés par l'accueil : export des pages concernées et des fichiers de `uploads` cités. Sans eux, le rendu de l'accueil diffère.
4. Pour les 4 suites historiques du « thème réel » de l'outil de test : le thème `kevin-legros` (`.local/real-theme/kevin-legros`, 191 fichiers).

Le dépôt Visual-Tweaks est **public** : ces archives doivent être fournies dans un dépôt privé ou directement à l'environnement de test, jamais dans ce dépôt.

**Retouches représentatives**
- Banc animé : deux retouches publiées par l'outil, un titre déplacé et un bouton animé décalé, identiques sur les deux sites.
- Banc de fidélité : 7 cibles × 28 propriétés.
- Logo et bande de production : seulement dans la recette sur le thème réel.

## 3. Ressources : 0.4.4 contre 0.4.5 (CI, WordPress 7.1.3)

Mêmes données, mêmes conditions : deux sites identiques (0.4.4 sur le port 9412, 0.4.5 sur le port 9410), publiés avec les deux mêmes retouches. Un scénario à la fois, Chromium seul, fenêtres de 10 à 15 s. Banc animé `?vt-test=animated` : boucle `tick` qui lit la géométrie à chaque image, animations CSS infinies, diaporama, bandeau, révélations. **Ce n'est pas le thème réel.**

| Scénario | CPU moyen (pic) | Fil principal | Script ms/s | Recalculs de style/s | Mises en page/s |
|---|---|---|---|---|---|
| Public au repos | 23,2 (28) → 23,0 (27) | 3,8 → 3,7 | 5,3 → 5,3 | 120 → 120 | 0,8 → 0,8 |
| Public au défilement | 16,7 (33) → 17,1 (34) | 4,3 → 4,2 | 4,9 → 4,8 | 121 → 121 | 4,5 → 4,5 |
| Éditeur au repos, sans sélection | **32,3 (70) → 23,1 (55)** ; allégé **7,1** (39) | 9,6 → 7,2 ; allégé 2,6 | 10,7 → 6,3 ; 0,9 | 241 → 120 ; 8 | 1,8 → 0,9 |
| Éditeur au repos, avec sélection et Assets | 33,6 (70) → 24,3 (60) ; allégé 8,2 | 11,1 → 9,0 ; 3,3 | 11,1 → 7,0 ; 1,6 | 241 → 121 ; 11 | 1,7 → 0,8 |
| Défilement avec sélection | **33,3 (78) → 22,5 (70)** ; allégé **17,6** (60) | 13,0 → 10,7 ; 5,9 | 12,7 → 8,1 ; 3,8 | 263 → 146 ; 70 | 19,6 → 13,2 ; 16,8 |
| Sélection, déplacement, écrans | 33,9 (73) → 21,9 (64) ; allégé 14,6 | 13,0 → 10,3 ; 5,3 | 16,1 → 10,9 ; 6,0 | 271 → 149 ; 58 | 28,2 → 22,1 ; 22,9 |
| Après 5 ouvertures successives | 35,2 (44) → 23,2 (27) ; allégé 5,9 | 10,4 → 7,6 ; 1,0 | 11,0 → 6,6 ; 1,3 | 242 → 121 ; 10 | 1,8 → 0,9 |
| Onglet en arrière-plan | 34,9 (71) → 25,1 (61) ; allégé 9,6 | 11,6 → 9,5 ; 4,3 | 10,8 → 7,1 ; 2,0 | 241 → 121 ; 12 | 1,9 → 1,0 |
| … puis réaffiché | 38,2 (45) → 23,2 (26) ; allégé 5,8 | 8,9 → 6,3 ; 0,8 | 11,1 → 6,9 ; 2,0 | 240 → 120 ; 11 | 1,8 → 0,9 |

CPU en % d'un cœur, tous processus de Chromium. Chaque cellule se lit « 0.4.4 → 0.4.5 » ; quand une troisième valeur est donnée, c'est la 0.4.5 allégée.

**Attribution** (profil CPU, ms par seconde ; éditeur au repos, sans sélection) :

| | 0.4.4 | 0.4.5 | 0.4.5 allégé | public |
|---|---|---|---|---|
| Thème | 17,9 | 6,6 | 0,3 | 7,3 |
| Éditeur | 0,5 | 0,2 | 0,3 | — |
| Runtime public | 0 | 0 | 0 | 0 |
| Rendu natif (style, mise en page, peinture hors JS) | 55,2 | 42,3 | 2,9 | 33,3 |
| Boucle du thème : rappels/s dans le document de l'éditeur / dans l'aperçu | **60 / 60** | **0 / 60** | 0 / 0 | 60 (page) |

**Seconde copie du thème** : en 0.4.4, la boucle du thème tourne 60 fois par seconde dans le document de l'éditeur, en plus de l'aperçu. En 0.4.5, elle n'y tourne plus du tout. Le test `ressources-e2e` le vérifie aussi sur les trois moteurs : aucun gabarit, aucun script du thème, aucun runtime dans le document hôte.

**Mémoire** : tas JS équivalent (3,8 Mo au repos dans les deux versions), document de l'éditeur plus léger (1 696 → 1 402 nœuds au repos, 3 171 → 2 877 en interactions). Ni accumulation ni fuite d'une ouverture à l'autre.

**Onglet masqué** : dans Chromium piloté, la page reste « visible » même en arrière-plan, et même avec fenêtre sous Xvfb. L'état `hidden` n'est donc pas mesurable ainsi.
- En CI, la page en arrière-plan n'est pas ralentie : la ligne « Onglet en arrière-plan » équivaut à un repos.
- Le retour se fait sans rattrapage ni accumulation : pic de 26 % en 0.4.5 contre 45 % en 0.4.4.
- La suspension sur `visibilitychange` est vérifiée par les tests (état masqué simulé), sur les trois moteurs.
- Dans le conteneur distant, avec l'onglet ralenti à 1 image/s : script de l'éditeur 7,4 → 0,7 ms/s (annexe A.4).

**Lecture**
- Au repos, le CPU baisse de 28 %, le fil principal de 25 % et le temps de script de 41 %. Les recalculs de style sont divisés par deux.
- Au défilement : CPU −32 %, script −36 %.
- Le mode allégé ramène l'éditeur au repos à 7 % de CPU, sous la page publique seule (23 %).
- Mêmes tendances dans le conteneur distant (WordPress 6.5.5, composition logicielle, valeurs absolues plus hautes), annexe A.4 : repos 96,5 → 66,0 %, allégé 22,0 %.

Fichiers : `ci/mesures-run4.md` (synthèse), `ci/mesures-run4-brut.txt` (sorties par scénario, fonctions dominantes), `ci/mesures-run4-environnement.txt`.

**Correction du contour** (`7374be3`, après ces mesures) : le document de l'aperçu écoute les fins de transition et d'animation. Avec une sélection, chacune replace le contour une fois par image au plus. Sur le banc animé : 0,6 événement/s au repos (diaporama), 4,5/s au défilement (en-tête, révélations). Scénarios avec sélection rejoués avant et après, dans le conteneur distant, une fenêtre de 12 s chacun :

| Scénario | CPU moyen (pic) | Fil principal | Script ms/s | Mises en page/s | Éditeur ms/s |
|---|---|---|---|---|---|
| Repos avec sélection | 72,3 (115) → 69,3 (106) | 21,6 → 20,4 | 25,4 → 25,0 | 0,8 → 1,2 | 2,1 → 2,5 |
| Défilement avec sélection | 67,8 (129) → 66,7 (121) | 26,5 → 26,3 | 27,1 → 27,9 | 12,6 → 13,4 | 8,2 → 9,5 |
| Sélection, déplacement, écrans | 76,7 (124) → 72,2 (112) | 30,6 → 28,3 | 39,5 → 36,8 | 31,8 → 32,2 | 27,0 → 25,2 |

Écarts dans le bruit d'une mesure unique. Coût propre : au repos, une mise en page de plus toutes les 2,5 s environ, quand une transition du diaporama se termine.

## 4. Mode allégé (banc média, trois moteurs)

`tests/allege-e2e.mjs`, sur la variante `?vt-test=animated-media` : boucle comptée, animations CSS infinies, animation d'entrée, révélation par animation et par transition, vidéo en boucle. **Ce n'est pas le thème réel.**

| Contrôle | Chromium | WebKit | Firefox |
|---|---|---|---|
| 4 bascules : boucle de 60/s à ≤ 6/s, puis rétablie ; une seule boucle (passages / images natives = 1,0), aucune trace laissée | ✔ | ✔ | ✔ |
| Animations infinies en pause puis relancées ; vidéo en pause puis relancée | ✔ | ✔ (vidéo WebM non lue par WebKit Linux : contrôle vidéo non applicable) | ✔ |
| Mode allégé : animation d'entrée et révélations terminées (rien de figé), en-tête qui suit le défilement | ✔ | ✔ | ✔ |
| Sélection, contour exact, déplacement à la souris et au clavier, annulation jusqu'à l'état enregistré | ✔ | ✔ | ✔ |
| Contour replacé après une transition du thème qui déplace la sélection sans défilement : en-tête collant qui rétrécit puis revient, titre déplacé de 12 px (`7374be3`) | ✔ | ✔ | ✔ |
| Navigation entre pages : préférence conservée, puis retirée partout | ✔ | ✔ | ✔ |
| Onglet masqué (simulé), puis en arrière-plan, puis retour : mode conservé, rendu animé rétabli sans boucle doublée | ✔ | ✔ | ✔ |
| Données enregistrées inchangées ; visiteur : 4 modules publics seulement, ni règle ni attribut du mode allégé ; 24 éléments × 14 styles identiques entre éditeur, éditeur allégé et public | ✔ | ✔ | ✔ |

Dans le conteneur distant : 6 cycles, rapport passages / images natives de 1,0 à chaque retour. Pendant le mode allégé, 3 passages par seconde.

**Contour après une transition** : contrôle ajouté avec la correction `7374be3`. Dans le conteneur distant (Chromium), il échoue sur l'éditeur d'avant la correction (contour resté 12 px trop haut) et réussit avec elle. En CI (exécution n° 9), il réussit sur les trois moteurs.

## 5. Conservation, fidélité, médiathèque, Structure et Assets (trois moteurs)

| Suite | Chromium | WebKit | Firefox |
|---|---|---|---|
| `conservation-e2e` : changement de page immédiat, retouche pendant la sauvegarde puis départ avant la réponse, réponse perdue, 502 HTML, coupure réseau et reprise, jeton expiré, conflit entre deux onglets, publication | 7/7 | 7/7 | 7/7 |
| `fidelite-e2e` : éditeur = publié (froid et chaud), premier affichage = publié hors écarts nommés, 7 cibles × 28 propriétés × 3 écrans, translation du thème sans double application, retrait exact | 6/6 | 6/6 | 6/6 |
| `ressources-e2e` : document hôte, Navigation sous animation continue (asset ajouté visible), branche Structure dans l'ordre du DOM, onglet ou panneau masqué puis rattrapé, mode allégé | 5/5 | 5/5 | 5/5 |
| `foundations` (médiathèque : remplacement d'image et de fond, Assets, SVG, recouvrements) | 16/16 | — | — |
| `e2e`, `ux`, `save`, `width`, `stability` (brouillon, annulation, rechargement, sauvegarde, cache public) | 19, 15, 7, 9, 8 | stability 8 | stability 8 |
| `ergonomics`, `viewport`, `speed`, `polish`, `comfort`, `guard-navigation` | 21, 11, 5, 6, 10, 3 | idem | idem |
| `cache-public-e2e` (aucun module d'édition chez les visiteurs, cache HTTP) | 4/4 | — | — |

Les suites sans moteur indiqué tournent sur Chromium seul, comme dans `dev/validate.mjs` depuis la 0.4.0.

**Mise à jour des panneaux** : un asset ajouté pendant une animation continue apparaît, et un élément retiré disparaît de Structure. Après réaffichage du panneau ou de l'onglet, l'état est rattrapé en une fois. Ce cas était bloqué en 0.4.4, où chaque mutation repoussait la mise à jour.

## 6. Performances publiques (CI, WordPress 7.1.3)

`dev/mesure-publique.mjs`, sur la page retouchée du banc, en visiteur anonyme ; toute requête hors 127.0.0.1 est coupée (aucun envoi Analytics). Desktop 1440 × 900 ; mobile 390 × 844 (densité 3, tactile, CPU ralenti × 4). Cache froid et chaud, 2 tours en ordre alterné, médianes de 3 passages.

| | FCP / LCP (ms), tour 1 → tour 2 | CLS | Longues tâches | Trames lentes | Requêtes / Ko |
|---|---|---|---|---|---|
| Desktop, froid | 0.4.4 : 648, 652 — 0.4.5 : 648, 624 | 0 | 0 | 0 | 9 / 76 identiques |
| Desktop, chaud | 0.4.4 : 636, 608 — 0.4.5 : 632, 624 | 0 | 0 | 0 | identiques |
| Mobile, froid | 0.4.4 : 748, 716 — 0.4.5 : 720, 732 | 0 | 0 | 0 | identiques |
| Mobile, chaud | 0.4.4 : 748, 724 — 0.4.5 : 724, 720 | 0 | 0 | 0 | identiques |

- Modules chargés chez les visiteurs, identiques dans les deux versions : `runtime.js`, `styles.js`, `selection.js`, `background-layers.js`. Aucun module d'édition (`light-mode.js`, `editor.js`, `navigation.js`…).
- HTML visiteur identique octet pour octet sur 3 pages (conteneur distant).
- Les 4 modules publics sont identiques à la 0.4.4 hors numéro de version.
- PHP public inchangé : `class-published-styles.php`, `class-cache.php`, `class-schema.php`, `class-store.php`.

**Seule mesure ambiguë en exécution n° 4** : en mobile à cache froid, la médiane des « long animation frames » (LoAF) valait 1 en 0.4.5 contre 0 en 0.4.4, sur les deux tours. La pire trame (33 ms) et les trames lentes (0) étaient identiques. Mesure répétée seule, 4 tours de 5 passages en ordre alterné, puis analysée jusqu'à conclusion :

| Exécution | Configuration | FCP 0.4.5 − 0.4.4 | FCP après réponse | LoAF (passages sur 20) |
|---|---|---|---|---|
| n° 5 | 0.4.5 sur 9410 | +24 à +52 ms selon le tour | non mesuré | 0.4.4 : 13 ; 0.4.5 : 16 |
| n° 6 | même configuration | −20 à +20 ms selon le tour | non mesuré | 0.4.4 : 19 ; 0.4.5 : 16 |
| n° 7 A | 0.4.5 sur 9410 | +12 ms | +4 ms | 0.4.4 : 3 ; 0.4.5 : 7 |
| n° 7 B | sites inversés, nouvelles données | +16 ms | +7 ms | 0.4.4 : 11 ; 0.4.5 : 13 |
| n° 8 témoin | deux copies de la 0.4.5 | +0 ms (p = 0,557) | +0 ms (p = 0,85) | 1 et 0 |
| n° 8 | extensions au même niveau | −8 ms (p = 0,277) | +0 ms (p = 0,807) | 0.4.4 : 1 ; 0.4.5 : 0 |
| n° 9 témoin | deux copies de la 0.4.5 | −32 ms (**p = 0,023**) | +2 ms (p = 0,645) | 11 et 7 |
| n° 9 | extensions au même niveau | −8 ms (p = 0,363) | −4 ms (p = 0,159) | 0.4.4 : 5 ; 0.4.5 : 6 |

- **LoAF** : le nombre de passages concernés varie d'une exécution à l'autre pour le même code (de 3 à 19 sur 20 pour la 0.4.4), et l'écart change de sens. Ce n'est pas un signal.
- **Écart de quelques ms en n° 7** : il résiste à l'inversion des ports et des données, alors que le visiteur reçoit les mêmes octets. Vérifié dans le conteneur distant : retouches publiées par l'éditeur de chaque version avec l'outil de mesure, HTML visiteur identique hors numéro de version.
- **Une seule différence restait entre les sites** : la 0.4.5 était servie depuis le dossier du dépôt, la 0.4.4 depuis un dossier voisin. Avec les deux extensions copiées au même niveau, l'écart disparaît (+0 ms, p = 0,81), comme dans le témoin A/A (+0 ms, p = 0,85). Le témoin montre aussi que deux copies du même code s'écartent jusqu'à 16 ms d'un tour à l'autre.
- **Exécution n° 9, seconde réplique** : 0.4.5 − 0.4.4 = −4 ms après la réponse (p = 0,16). Dans le témoin A/A, le FCP de deux copies identiques diffère de 32 ms avec p = 0,023, porté par le temps de réponse du serveur (−27 ms, p = 0,018), alors que le FCP après réponse ne bouge pas (p = 0,645). Chaque instance du banc a sa propre vitesse : c'est le FCP après réponse qui départage le code livré au navigateur.

**Conclusion : aucune régression reproductible des performances publiques.**

Fichiers : `ci/repetition-run5.md`, `ci/repetition-run6.md`, `ci/repetition-run7.md`, `ci/mesures-run8.md`, `ci/mesures-run9.md`.

## 7. Suite complète et classement des échecs

**Exécution n° 3** (avant corrections) : 6 suites en échec, toutes rejouées à l'identique sur la 0.4.4, dans le même environnement :

| Suite | Cause | 0.4.4 |
|---|---|---|
| `viewport` WebKit, Firefox | le panneau « Comparer le rendu », fixé à 110 px du haut, recouvre son propre bouton sous Linux : le second clic, qui le ferme, est impossible | même échec : **préexistant** |
| `conservation`, `fidelite` WebKit | tous les contrôles réussis, puis « aucune erreur JavaScript » échoue : requêtes du tableau de bord WordPress (`wp-compression-test`, actualités) interrompues quand le test le quitte aussitôt après la connexion, signalées comme erreurs par WebKit Linux | même échec : **préexistant** (environnement : base neuve, WebKit Linux) |
| `ressources`, `allege` WebKit (nouveaux) | même cause, tous les contrôles réussis | test absent en 0.4.4 |

**Corrections ciblées** (commit `c350cf7`, relancées puis validées en exécution n° 4) :
- **Extension** (`editor.js`, gestionnaire de clic seulement) : le panneau de diagnostic se place sous son propre bouton. Défaut préexistant, visible aussi par un utilisateur.
- **Tests** : connexion directe vers l'accueil au lieu du tableau de bord. Aucune erreur n'est filtrée : une erreur de Visual Tweaks fait toujours échouer le test.

**Exécution n° 4** : **42 suites réussies sur 42, 0 en échec, 10 non exécutées** (thème réel absent). Au total, 334 contrôles navigateur réussis, plus 18 tests unitaires du cœur. Les 11 tests unitaires PHP (rendu serveur = JavaScript, caches) y ont été **sautés**, faute de `VT_TOOLCHAIN` en CI ; ils ont été exécutés dans le conteneur distant : 11/11.

**Exécution n° 7** (tests PHP désormais en CI : `ℹ tests 11`, `ℹ pass 11`, `ℹ skipped 0`) : 41 réussies, **1 en échec**, `ressources-e2e` sur WebKit, avant tout contrôle.
- Symptôme : `page.waitForURL: Timeout 30000ms exceeded` à la connexion, journal réduit à `waiting for navigation until "load"`. Aucune navigation : le formulaire n'est pas parti.
- Cause : `wp-login.php` donne le focus à `#user_login` environ 150 ms après la fin du chargement, en sélectionnant son texte. S'il survient pendant la saisie du mot de passe, celui-ci remplace l'identifiant ; `#user_pass` reste vide alors qu'il est requis, et le navigateur bloque l'envoi.
- Reproduction à l'identique sur Chromium, dans le conteneur distant : même erreur, même journal.
- Classement : **défaut des tests ajoutés en 0.4.5**, pas de l'extension. La connexion précède tout code de Visual Tweaks, et le rejeu sur la 0.4.4 est impossible, ce test n'y existant pas. Les suites de la 0.4.4 attendent ce focus (250 ms) ou vérifient les champs ; `ressources-e2e`, `allege-e2e` et l'outil de mesure ne le faisaient pas.
- Correction (`d54c91c`) : attente du focus, saisie, puis vérification des deux champs. Aucune erreur n'est filtrée.

Pendant la vérification locale de cette correction, deux autres constats, classés à part :
- `allege-e2e` sélectionnait le titre pendant la transition de 0,3 s de l'en-tête (retour en haut de page). Le contour, placé sur événement depuis toujours, restait décalé de 3 px. Défaut préexistant de l'éditeur, corrigé en `7374be3` (sections 3 et 4), avec un contrôle qui échoue sans la correction.
- Sur le banc local (Playground, 6 processus, SQLite), la toute première connexion après le démarrage d'un site neuf échoue parfois : « The username vt-admin is not registered on this site ». Constaté en 0.4.4 comme en 0.4.5 (1 essai sur 2 chacune), la seconde connexion réussit toujours. Jamais observé en CI. Particularité du banc local, sans lien avec l'extension.

**Exécution n° 8** : **42 réussies, 0 en échec, 10 non exécutées** ; cœur 18/18, PHP 11/11.

**Exécution n° 9** (code final, `7374be3`) : **42 réussies, 0 en échec, 10 non exécutées** ; cœur 18/18, PHP 11/11, 334 contrôles navigateur réussis. Le nouveau contrôle du contour réussit sur Chromium, WebKit et Firefox.

**Non exécutées** (thème `kevin-legros` absent) :
- `real-theme` × 3 ;
- `comfort-real-theme` × 1 (`cross-browser.mjs`, les trois moteurs en une entrée) ;
- `guard-visibility` × 3 ;
- `stabilisation` × 3.

Résumés : `ci/suite-complete-run4.txt` (ligne à ligne), `ci/repetition-run7.md`, `ci/mesures-run8.md`, `ci/mesures-run9.md`.

## 8. Contrôles restants avant déploiement

1. **Mode allégé sur Firefox et WebKit, thème réel** (bloquant, seul contrôle restant).
   - Blocage : ces navigateurs ne s'installent pas dans cet environnement, et les fichiers privés ne peuvent pas passer par la CI publique.
   - Pour lever le blocage : dans les réglages de l'environnement cloud (menu de l'environnement dans la barre de titre de la session, puis Modifier, rubrique Accès réseau), ajouter `cdn.playwright.dev` et `playwright.download.prss.microsoft.com` aux domaines autorisés, la case des gestionnaires de paquets restant cochée. Procédure : https://code.claude.com/docs/en/cloud-environments#network-access.
   - Puis, dans le cloud, avec les fichiers privés en place (`.local/production/`) :
     ```
     npx playwright install firefox webkit
     node recette/banc.mjs --version 045 --port 9410
     VT_ENGINE=firefox node recette/allege-theme-reel.mjs --base http://127.0.0.1:9410 --version 045
     VT_ENGINE=webkit  node recette/allege-theme-reel.mjs --base http://127.0.0.1:9410 --version 045
     ```
   - Autre voie, avec votre accord seulement : un dépôt **privé** dédié à cette recette, avec journaux et artefacts privés.
2. **Logo de production** (point d'attention, indépendant de Visual Tweaks) : vérifier `custom_logo` avant toute purge de cache (`PROCEDURE.md`).
3. **Menu principal** : l'export en est vide. Pour une comparaison, il faudrait réexporter `menus` ; ce n'est pas nécessaire aux retouches, qui sont hors du menu.
4. **Onglet réellement masqué** : non reproductible dans un navigateur piloté. À constater une fois sur le Mac, quelques secondes :
   - passer à un autre onglet, puis revenir ;
   - l'aperçu reprend, les panneaux sont à jour.
5. **Environnement de production** : LiteSpeed, CDN Hostinger, MySQL, PHP 8.3.35 et les 14 extensions actives. Contrôles prévus dans `PROCEDURE.md`, après installation.

## 9. Archive, empreinte, retour arrière

| Fichier | Empreinte SHA-256 |
|---|---|
| `artifacts/visual-tweaks-0.4.5.zip` (candidate, 49 fichiers, = extension du commit `7374be3`) | `fc825e1863112acca474d2be59c126f3776021b410cdef71090e24f1d2f6d336` |
| `artifacts/visual-tweaks-0.4.4.zip` (= commit `fbbf381`) | `a83100ad96ed4bfe27b05b68c3b0a5eed28e403f911588475dc9fd93e72569ff` |
| `artifacts/visual-tweaks-0.4.3.zip` (production au 11/10) | `9ccc15d087f5b9eeb944255b8773fc7b79379b9eefcf668a17257246900fb8db` |

L'archive candidate est celle qu'a utilisée toute la recette sur le site réel complet : copie vérifiée, identique à l'arbre de `7374be3`. Face à elle, l'archive 0.4.3, celle de la production. Le code de l'extension n'a pas changé pendant ces recettes : aucune validation antérieure n'est invalidée.

**Ne pas l'installer en production avant le contrôle restant (section 8, point 1) et la vérification du logo de production.**

Retour arrière : réinstaller la version relevée avant installation (0.4.3 au 11/10). Les données gardent leur format : aucune restauration de données n'est nécessaire. Le détail, avec l'export et la restauration des options en cas de besoin, est dans `PROCEDURE.md`.

## 10. Limites restantes

- Thème réel : recette complète sur Chromium (section 12). Firefox et WebKit non vérifiés sur le thème réel (section 8).
- Banc : PHP 8.3.33 (production 8.3.35), SQLite, sans LiteSpeed, sans CDN ni les 14 extensions de production ; menu de repli du thème, faute de menu dans l'export.
- Mesures du thème réel faites dans un conteneur sans GPU que la pluie de runes sature : le CPU ne s'y compare qu'à cadence égale (section 11.3). Sur un Mac, cadence plafonnée à 60 images/s, la suppression de la copie invisible doit se traduire en CPU économisé. Ce n'est pas mesuré : aucune campagne sur le Mac.
- Mode allégé :
  - une boucle d'animation qui a gardé sa propre référence à `requestAnimationFrame` avant l'ouverture de l'éditeur (GSAP, par exemple) n'est pas ralentie ;
  - les animations Web infinies créées après l'activation ne sont pas mises en pause.
- Sans le mode allégé, l'éditeur au repos dépasse encore la page publique seule : le dessin de la page animée dans le cadre coûte environ 20 ms/s de peinture (annexe A.4).
- Vidéo WebM non lue par WebKit Linux en CI : contrôle vidéo du mode allégé validé sur Chromium et Firefox seulement.
- Contour : replacé à la fin d'une transition ou d'une animation qui déplace la sélection, pas pendant. Sur un en-tête de 0,3 s, il rejoint l'élément à la fin du mouvement. Une boucle JavaScript qui déplace l'élément (sans transition CSS) n'est suivie qu'au défilement ou au redimensionnement suivant, comme avant.
- Les mesures de CI (navigateur sans fenêtre, sans GPU) n'ont pas la même échelle absolue que sur un Mac. Seules les comparaisons 0.4.4 / 0.4.5 dans un même environnement sont significatives.

## 11. Recette sur le thème réel (11/10 après-midi, conteneur distant, Chromium)

> Première recette sur des pages incomplètes, en PHP 8.5.10. **Remplacée par la section 12** : pages complètes, PHP 8.3.

### 11.1 Fichiers fournis, versions, banc

**Fichiers reçus**
- `lenergiedesrunes-production.zip` : 328 fichiers, SHA-256 `da62f1ed5f5d1f4fae8c098c0625da5112ada0c919831d82e66053d5e9fdcd5c`, `js/main.js` compris.
- `visual-tweaks-options-production.json` : export en lecture seule du 11/10 à 12:45 UTC, SHA-256 `25f4ad0b05c97affa45ca207ec4b70558ed559e4500ce0226e54fe88e39522fc`.
- Les deux restent dans `.local/production/`, exclu de Git : jamais dans le dépôt, la CI ou ses artefacts. Le banc refuse de démarrer sous GitHub Actions.

**Versions**
- WordPress 7.1.3 : relevé de production du 11/10.
- Thème « L'énergie des Runes » 1.9.77 : `style.css` du ZIP.
- Visual Tweaks en production : 0.4.3, d'après le relevé du 11/10 et votre indication. L'export fourni ne porte pas ce numéro, et le domaine de production est inaccessible d'ici : **non relu**. L'export de contenus de la section 8 le relève.

**Options de production**
- `vt_enabled` : « 1 », autoload `off`.
- Page `/` : révision 22, deux retouches :
  - `div.bande-lieu` : desktop 0 / −18 px, mobile 0 / −7 px ;
  - `img.logo__sceau` : desktop 60 × 60 px, max-width 60 px, −14 px, avec empreinte sur le `src` exact.
- `vt_site_style` et `vt_desktop_width` sont absentes en production, et non vides. Elles le restent sur le banc.

**Banc** : deux WordPress 7.1.3 isolés, même thème, mêmes options.
- L'un avec la 0.4.3 (`artifacts/visual-tweaks-0.4.3.zip`), l'autre avec la 0.4.5 (`artifacts/visual-tweaks-0.4.5.zip`, = `7374be3`). Extensions copiées au même niveau.
- Playground, SQLite. PHP annoncé 8.3, **8.5.10 effectif** (`PHP_VERSION`).
- WordPress 7.1.3 vient du dépôt git officiel (`WordPress/WordPress`, étiquette 7.1.3) : wordpress.org est bloqué ici.
- Outils : `recette/` (banc, import, isolation, contrôles), sans aucun contenu privé : tout est lu dans `.local/production/` à l'exécution.
- Résultats détaillés et captures : `.local/production/resultats/`. Ils montrent le thème : privés, hors dépôt.

**Import** octet pour octet, relu et comparé à chaque démarrage. Les sites sont remis à l'export entre les séries de contrôles.
- Empreintes identiques à l'export sur les deux sites : page `0d214346d3ffe4787061a9a11982fdb523121024edb35ced573292af204aa1f6`, `vt_enabled` `6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b`.
- Les deux options absentes restent absentes.
- HTML visiteur 0.4.3 = 0.4.5, hors numéro de version, port et identifiant de page.

**Isolation**
- Côté serveur, toute requête HTTP sortante est refusée (`WP_HTTP_BLOCK_EXTERNAL` et un filtre), les emails sont abandonnés et le cron est coupé (`recette/mu-plugins/vt-banc-isolation.php`).
- Côté navigateur, toute requête hors du banc est coupée et comptée : aucune constatée sur l'accueil.
- Le thème ne charge pas Analytics lui-même : c'est Site Kit, extension absente du banc. Sa collecte d'adresses est fermée dans le thème.

**Adaptations de la copie de test**, documentées :
1. Page « accueil » au contenu vide en page d'accueil statique. Le thème ne sert `css/accueil.css` qu'à une page de ce nom ; c'est la feuille servie en production. S'y ajoutent des pages vides pour la navigation.
2. Logo : substitut neutre marqué « SUBSTITUT », au chemin et aux dimensions de production (512 px, vignette 150 × 150 WebP). Le fichier réel n'est pas fourni.
3. URL des médias imprimées avec l'origine de production. La retouche du logo enregistre le `src` exact : sans cela, elle ne s'appliquerait jamais sur la copie de test. Le navigateur de recette sert ces URL depuis la copie locale, et aucune requête n'atteint la production. Les options ne sont pas modifiées.
4. Nom du site « L'énergie des Runes » : valeur de production non fournie.

### 11.2 Ce qui manque : pages incomplètes, non équivalentes au site réel

| Élément | Source en production | Sur le banc |
|---|---|---|
| Sections éditoriales de l'accueil | contenu de la page « accueil » | absentes : l'accueil s'arrête après le bandeau (1 073 px en desktop) |
| Témoignages | articles `temoignage`, méta `_temo_service` | absents, section non affichée |
| Autres pages (soins, guidances…) | contenus de page | article vide |
| Logo | `custom_logo` et son média | substitut (11.1, point 2) |
| Menu principal | menu `primary` | menu de repli du thème |
| Textes du bandeau, avis Google, contacts | options `edr_*` | valeurs par défaut du thème |
| Médias des contenus | `uploads/` | absents |
| Extensions | WooCommerce (icône « Mon compte »), Site Kit, SEO… | absentes |

Les deux retouches, dans l'en-tête et la bande au-dessus du contenu, sont rendues et vérifiées. La page entière n'est pas équivalente à celle de production. Mesures de défilement et animations des sections de contenu (révélations au défilement) : **non représentatives**.

### 11.3 Ressources de l'éditeur, 0.4.3 contre 0.4.5

`dev/mesure-ressources.mjs`, un scénario à la fois, fenêtres de 12 s, cibles réelles.

| Scénario | Version | CPU moyen % (pic) | Fil principal % | Script ms/s | Thème ms/s | Boucle du thème : document de l'éditeur / aperçu (rappels/s) |
|---|---|---|---|---|---|---|
| Page publique seule | 0.4.3 / 0.4.5 | 131,5 (147) / 131,4 (145) | 15,9 / 16,4 | 22,7 / 23,1 | 18,1 / 19,1 | 28,3 / 29,5 (page) |
| Éditeur au repos | 0.4.3 | 137,1 (225) | 22,5 | 25,5 | 19,4 | **14,7 / 14,7** |
| | 0.4.5 | 140,2 (219) | 24,4 | 29,5 | 22,0 | **0 / 31,7** |
| | 0.4.5 allégé | **37,0** (125) | **9,3** | 4,3 | 2,6 | 0 / 4 au repos (mesuré en 11.4) |
| Repos, bande sélectionnée | 0.4.3 | 141,5 (234) | 25,8 | 27,5 | 22,4 | 17,0 / 17,0 |
| | 0.4.5 | 143,7 (204) | 27,8 | 36,0 | 27,1 | 0 / 41,1 |
| | 0.4.5 allégé | 33,9 (102) | 8,0 | 4,6 | 2,6 | 0 / ralentie (sonde aveugle, 11.4) |
| Défilement, bande sélectionnée | 0.4.3 | 147,7 (259) | 30,4 | 32,7 | 26,0 | 19,8 / 19,9 |
| | 0.4.5 | 151,3 (261) | 32,4 | 36,3 | 30,0 | 0 / 41,3 |
| | 0.4.5 allégé | 60,1 (168) | 15,5 | 5,6 | 3,2 | 0 / ralentie (sonde aveugle, 11.4) |

**Lecture**
- **Seconde copie invisible : supprimée.** En 0.4.3, la pluie de runes de `main.js` tourne aussi dans le document de l'éditeur, autant que dans l'aperçu. En 0.4.5, plus du tout.
- **Le conteneur, sans GPU, est saturé par le thème seul** : 131 % de CPU pour la page publique, à 28–30 images/s. Le CPU ne baisse donc pas : la 0.4.5 rend l'aperçu deux fois plus fluide au lieu de dépenser la moitié de l'effort sur la copie invisible.
- **À cadence égale, le coût baisse de moitié.** CPU par image d'aperçu au repos : 9,3 → 4,4 (−52 %). Avec sélection : 8,3 → 3,5. Au défilement : 7,4 → 3,7.
- **L'éditeur 0.4.5 coûte à peine plus que la page publique seule** : 4,4 contre 4,5 à 4,6 par image.
- **Mode allégé** : CPU au repos −74 % (140 → 37 %), fil principal 24 → 9 %.
- **Document de l'éditeur plus léger** : 3 532 → 2 859 nœuds au repos. Tas JS équivalent, environ 4 Mo.
- **Page incomplète et courte** (11.2) : le défilement n'y parcourt que le haut de page.
- **En mode allégé, la sonde ne compte plus les rappels du thème** : ils passent par le mode allégé. Leur cadence est mesurée directement en 11.4.

### 11.4 Mode allégé (`recette/allege-theme-reel.mjs`, 0.4.5, Chromium) : 5/5

Cadence mesurée dans la page : redessins du canvas `#pluie` rapportés aux images natives.

1. **Quatre bascules**
   - Pluie de runes : 33 images/s, puis **4** en mode allégé à chaque bascule.
   - Retour : 29, 35, 35 puis 37 images/s, **une seule boucle** (passages / images = 1,0) ; la pluie bouge de nouveau.
   - Aucune animation finie figée, aucune trace laissée.
   - La portion rendue de l'accueil n'a pas d'animation CSS infinie.
2. **Retouches en mode allégé**
   - Sélection de la bande et du logo, contours exacts.
   - Déplacement au clavier, puis annulation jusqu'à l'état enregistré (0 / −18 px).
3. **Navigation** vers une autre page puis retour : préférence conservée, mode appliqué.
4. **Onglet masqué (simulé), puis en arrière-plan**
   - Le mode est conservé.
   - Désactivé : rendu animé rétabli sans boucle doublée, et préférence retirée sur toutes les pages.
5. **Isolation**
   - Données inchangées : révision 22, retouches identiques à l'export.
   - Visiteur : 4 modules publics, aucune trace du mode allégé.

**Firefox et WebKit : non exécutés** (section 8, point 1).

### 11.5 Conservation, fidélité, panneaux (0.4.3 et 0.4.5, Chromium)

**Conservation** (`recette/conservation-theme-reel.mjs`) : **4/4 dans les deux versions**.
- Bande déplacée de 2 px puis enregistrée : révision 22 → 23, desktop −18 → −16 px, mobile et logo inchangés (API).
- Retour sur l'accueil après une autre page, puis rechargement : état « Enregistré ». Site public à −16 px, en CSS serveur comme au rendu.
- Brouillon non enregistré (−15 px) restauré après un changement de page, révision inchangée.
- Annulation jusqu'à l'état enregistré.
- Comportement identique en 0.4.3 et en 0.4.5. Copies de test remises ensuite à l'export, empreintes vérifiées.

**Fidélité** (`recette/fidelite-theme-reel.mjs`) : **4/4 dans les deux versions**.
- Desktop 1440 et mobile 390 : premier affichage (CSS serveur seul, JavaScript coupé) = site publié après runtime = aperçu de l'éditeur (écrans Desktop et Mobile).
- Valeurs exactes, **sans double application** : bande 0 / −18 px en desktop, 0 / −7 px en mobile ; logo 60 × 60 px et −14 px.
- Boîtes identiques au demi-pixel entre les trois vues et entre la 0.4.3 et la 0.4.5 :
  - desktop : bande `[0, 103, 1440, 48]`, logo `[154, 13.5, 60, 60]` ;
  - mobile : bande `[0, 114, 390, 81.5]`, logo `[6, 16, 60, 60]`.

**Panneaux** (`recette/panneaux-theme-reel.mjs`) : **3/3 dans les deux versions**.
- Structure (185 lignes) : la bande sélectionnée dans l'aperçu s'ouvre et se marque dans l'arbre ; un clic sur la ligne du bandeau le sélectionne.
- Assets : 26 cartes, dont le logo.
- Médiathèque ouverte depuis le logo (« Remplacer cette image »), fermée sans choix : aucune modification.

### 11.6 Performances publiques, 0.4.3 contre 0.4.5

`dev/campagne-mesures.mjs` : visiteur anonyme, page d'accueil du banc, toute requête externe coupée, 2 tours de 3 passages en ordre alterné. Médianes de tous les passages, test de rang.

| Cas | FCP après réponse 0.4.3 → 0.4.5 | FCP | TTFB |
|---|---|---|---|
| Desktop, froid | 327 → 281 ms (p = 1) | 1 824 → 1 612 (p = 0,75) | 1 426 → 1 270 (p = 0,52) |
| Desktop, chaud | 338 → 308 ms (p = 0,81) | 1 620 → 1 592 (p = 1) | 1 286 → 1 229 (p = 0,75) |
| Mobile, froid | 363 → 385 ms (p = 0,87) | 1 740 → 1 772 (p = 1) | 1 377 → 1 372 (p = 1) |
| Mobile, chaud | 352 → 332 ms (p = 0,75) | 1 628 → 1 708 (p = 0,63) | 1 281 → 1 312 (p = 0,69) |

- Requêtes et volume identiques : 15 et 550 Ko en desktop, 16 et 541 Ko en mobile. Mêmes 4 modules publics.
- CLS 0 ; longues tâches de 2 à 5 par chargement dans les deux versions.
- Long animation frames sur tous les passages des deux versions, dus à la pluie de runes.
- Trames lentes : 3 à 6 au chargement, 0 à 2 au défilement, dans les deux versions.
- **Aucun écart significatif, aucune régression.**
- Valeurs absolues élevées, dues au conteneur saturé ; seule la comparaison compte. Six passages par version et par cas : la puissance du test est faible, mais rien ne suggère d'écart.

## 12. Recette sur pages complètes (11/10 soir, conteneur distant)

### 12.1 Fichiers, versions, PHP

**Contenus et médias de production** : `contenus-production-et-medias.zip`, SHA-256 `4842243863bc1eea8127e1285e7c791349ddfa6f8b78ef8ece82e27a7d9c5b14`.
- Export en lecture seule du 11/10 à 16:24 UTC, fait avec `recette/exporter-contenus.php` (blob `5d255bf`) et complété en mémoire.
- `MANIFESTE-SHA256.json` vérifié : **276 fichiers sur 276 conformes** (empreinte et taille), aucun absent, aucun en trop.
- Ses 262 fichiers de thème sont identiques à ceux du ZIP du thème déjà reçu.
- Gardé dans `.local/production/` (exclu de Git), comme le thème et les options : jamais dans le dépôt, la CI ou ses artefacts.

**Versions de production confirmées** par l'export : PHP 8.3.35 (CLI et web), WordPress 7.1.3, thème 1.9.77, Visual Tweaks 0.4.3.

**PHP du banc, relevé par requête** (`X-Powered-By` et `PHP_VERSION`, pas l'option du lanceur) :
- l'outil Playground annonçait 8.3 mais exécutait les requêtes en **8.5.10** : c'était le cas de la recette de la section 11 ;
- avec `preferredVersions.php = 8.3` dans le blueprint, toutes les requêtes du banc tournent en **PHP 8.3.33** : accueil, pages, API REST, import ;
- **différence restante : 8.3.33 contre 8.3.35**, la version 8.3 la plus récente que fournit l'outil ;
- en CI (`dev/server.mjs`, sans `preferredVersions`), les exécutions n° 4 à 9 ont très probablement tourné en 8.5.10. Non relu.

### 12.2 Import et rendu

Import selon `IMPORT.md` (`recette/import.php`), sur deux sites neufs : 0.4.3 et 0.4.5.
- **Pages** : 14, parents d'abord, contenu brut non filtré. **Empreinte du contenu stocké = export pour 14 pages sur 14**, marqueur `<!-- edr-temoignages -->` intact.
- **Témoignages** : 3, avec ordre et date.
- **Pièces jointes** : 2, depuis les fichiers fournis, sans régénération, tous leurs fichiers présents.
- **Ressource** : 1, avec sa taxonomie. `_thumbnail_id` remappé.
- **Réglages** : nom, description, permaliens, accueil statique `accueil`, `site_icon` remappé, réglage de thème `edr_avis_google`. Les options `edr_*` absentes en production le restent : textes par défaut du thème.
- **Options Visual Tweaks** : octet pour octet, empreintes identiques à l'export ; `vt_site_style` et `vt_desktop_width` absentes.
- **Import idempotent** : après chaque série qui modifie les données, le site est redémarré puis réimporté, avec les mêmes identifiants et les mêmes empreintes.

**Rendu**, contrôlé dans le navigateur, desktop 1440 et mobile 390, sur les deux versions :
- **accueil complet** : 5 890 px en desktop, 7 274 px en mobile ;
  - bande, bandeau et six sections éditoriales : preuves, portes, axe runique, parcours, livre, final ;
  - les 3 témoignages (« 21 avis Google · 5,0/5 ») ;
  - **vrai logo** chargé ;
- les sections « plus » (créations runiques) et « maintien » (lettre d'information) sont **commentées dans le contenu de production** : non affichées, comme en production ;
- 11 images et sources dans `main`, aucune cassée. Polices du thème chargées. Aucune erreur JavaScript, aucune requête externe ;
- **HTML visiteur 0.4.3 = 0.4.5**, hors numéro de version, port et date de publication de la page dans les données structurées (date de création de chaque copie).

**Adaptations de la copie de test**, documentées :
1. **Logo** : `custom_logo` est absent de la base de production. Le média réel (`site_icon`, ID 22), dont la vignette 150 px correspond à l'empreinte de la retouche, est posé comme `custom_logo` sur le banc seulement, comme le permet `IMPORT.md`.
2. **URL des médias** imprimées avec l'origine de production. La retouche du logo enregistre le `src` exact. Le navigateur de recette sert ces URL depuis la copie locale, sans requête vers la production.
3. **Ressource** : `_edr_linked_page_id` = 3343 n'a pas d'`id_source` correspondant dans l'export. Seule la page enfant `ressources/24-runes-futhark` n'en a pas : lien déduit vers elle, et signalé comme tel.
4. **Type `ressource` et taxonomie** enregistrés par un mu-plugin de banc (`recette/mu-plugins/vt-banc-types.php`). La fonction `edr_get_resource_url()` du mu-plugin de production n'est pas fournie : le thème laisse ses listes de ressources inactives, hors de l'accueil.
5. Contenus par défaut de WordPress (« sample-page », « hello-world ») supprimés : absents de la production.

**Différences restantes**
- **Menu principal** : `IMPORT.md` indique un menu `primary` défini, mais `menus.primary` est une **liste vide** dans `contenus-production.json`. Emplacement laissé libre sur le banc, donc menu de repli du thème (9 entrées). Conformité au menu de production non vérifiable.
- **Extensions de production absentes du banc** (14 relevées, aucune fournie) : LiteSpeed Cache, Site Kit, Pojo Accessibility, Fluent Forms, WPForms, Brevo, extensions Hostinger et IA… Leur balisage, leurs scripts et l'optimisation LiteSpeed ne sont pas reproduits. Formulaires, Analytics et envois sont coupés, comme demandé.
- PHP 8.3.33 contre 8.3.35 ; SQLite contre MySQL ; ni LiteSpeed ni CDN.

**Point d'attention avant tout déploiement**, indépendant de Visual Tweaks : sans `custom_logo`, `header.php` n'affiche **aucun logo**. Si la base de production est bien dans cet état, le logo visible aujourd'hui vient du cache. La purge prévue par `PROCEDURE.md` le ferait disparaître du site, et avec lui la cible de la retouche du logo. À vérifier avant toute purge (`PROCEDURE.md`, étape ajoutée).

### 12.3 Ressources de l'éditeur, 0.4.3 contre 0.4.5 (Chromium, PHP 8.3)

`dev/mesure-ressources.mjs`, accueil complet, cibles réelles (bande, logo), un scénario à la fois, fenêtres de 12 s.

| Scénario | Version | CPU moyen % (pic) | Fil principal % | Script ms/s | Thème ms/s | Boucle du thème : document de l'éditeur / aperçu (rappels/s) | Nœuds du document |
|---|---|---|---|---|---|---|---|
| Page publique seule | 0.4.3 / 0.4.5 | 126,2 (135) / 126,6 (134) | 13,1 / 13,4 | 23,2 / 23,4 | 17,9 / 16,5 | 42,9 / 40,2 (page) | 1 376 |
| Éditeur au repos | 0.4.3 | 130,6 (178) | 17,8 | 25,2 | 21,2 | **23,7 / 23,7** | 7 351 |
| | 0.4.5 | 134,0 (182) | 19,6 | 30,7 | 24,4 | **0 / 48,2** | 5 893 |
| | 0.4.5 allégé | **26,8** (73) | **5,8** | 3,4 | 2,0 | 0 / ralentie | 5 898 |
| Repos, bande sélectionnée | 0.4.3 | 132,5 (198) | 19,7 | 28,7 | 22,0 | 22,1 / 22,1 | 10 970 |
| | 0.4.5 | 136,4 (194) | 21,6 | 32,0 | 23,7 | 0 / 53,8 | 9 512 |
| | 0.4.5 allégé | **25,7** (67) | **5,6** | 3,3 | 1,5 | 0 / ralentie | 9 517 |
| Défilement, bande sélectionnée | 0.4.3 | 155,4 (236) | 29,0 | 35,6 | 28,4 | 23,5 / 40,9 | 8 565 |
| | 0.4.5 | 156,4 (226) | 33,7 | 26,7 | 25,5 | 0 / 72,8 | 7 107 |
| | 0.4.5 allégé | 142,4 (175) | 29,8 | 15,2 | 8,7 | 0 / ralentie | 7 113 |

**Lecture**
- **Seconde copie invisible du thème : supprimée.** En 0.4.3, la boucle de `main.js` tourne autant dans le document de l'éditeur que dans l'aperçu ; en 0.4.5, plus du tout.
- **Le conteneur, sans GPU, est saturé par le thème seul** (126 % de CPU pour la page publique). Le CPU total ne baisse donc pas : la 0.4.5 donne à l'aperçu deux fois plus d'images.
- **À cadence égale, le coût baisse de moitié.** CPU par image d'aperçu au repos : 5,5 → **2,8** (−50 %). Avec sélection : 6,0 → **2,5** (−58 %).
- **L'éditeur 0.4.5 coûte autant que la page publique seule** : 2,9 à 3,2 par image.
- **Au défilement**, la boucle du thème s'arrête dès que le bandeau sort de l'écran, et les rappels comptés sont surtout ceux des gestionnaires de défilement : pas de mesure par image propre. CPU équivalent ; script de l'éditeur 13,8 → 11,8 ms/s.
- **Mode allégé** : CPU au repos −80 % (134 → 27 %), fil principal 19,6 → 5,8 %.
  - Au défilement, −9 % seulement : le coût y est le dessin de la page qui défile, que le mode allégé ne touche pas, par principe.
- **Document de l'éditeur plus léger** : −1 458 nœuds. Tas JS équivalent, environ 4 à 5,5 Mo.
- Machine sans GPU : sur un Mac, plafonné à 60 images/s, la suppression de la copie invisible doit se traduire en CPU économisé. Non mesuré : aucune campagne sur le Mac.

### 12.4 Mode allégé : Chromium 6/6 ; Firefox et WebKit **non réalisés**

`recette/allege-theme-reel.mjs`, sur la 0.4.5. Cadence mesurée dans la page : redessins du canvas `#pluie` rapportés aux images natives.
1. **Quatre bascules**
   - Pluie de runes : 56 images/s, puis **4** à chaque activation.
   - Retour : 45, 45, 45 puis 51 images/s, **une seule boucle** (passages / images = 1,0) ; la pluie bouge de nouveau.
   - Aucune animation finie figée, aucune trace laissée.
2. **Page complète parcourue en mode allégé** (5 950 px) : les **39 apparitions** au défilement et le compteur vont à leur terme, rien n'est figé.
3. **Retouches en mode allégé**
   - Sélection de la bande et du logo, contours exacts.
   - Déplacement au clavier, puis annulation jusqu'à l'état enregistré.
4. **Navigation** vers une autre page, puis retour : préférence conservée.
5. **Onglet masqué (simulé), puis en arrière-plan**
   - Le mode est conservé.
   - Désactivé : rendu animé rétabli sans boucle doublée, et préférence retirée partout.
6. **Isolation**
   - Données inchangées : révision 22, retouches identiques à l'export.
   - Visiteur : 4 modules publics, aucune trace du mode allégé.

**Firefox et WebKit : non réalisés.** `cdn.playwright.dev` et `playwright.download.prss.microsoft.com` restent refusés par la politique réseau de cet environnement : les deux navigateurs ne s'installent pas. Les fichiers privés ne passent pas par la CI publique, où ces moteurs sont validés sur le banc animé (exécution n° 9). Aucune campagne relancée.

### 12.5 Conservation, fidélité, panneaux (0.4.3 et 0.4.5, Chromium)

- **Conservation** (`recette/conservation-theme-reel.mjs`) : **4/4 dans les deux versions**, comportement identique.
  - Bande déplacée de 2 px puis enregistrée : révision 22 → 23, desktop −18 → −16 px, mobile et logo inchangés (API).
  - Retour sur l'accueil après une page à contenu complet, puis rechargement : « Enregistré ». Public à −16 px, en CSS serveur comme au rendu.
  - Brouillon non enregistré (−15 px) restauré après un changement de page, révision inchangée.
  - Annulation jusqu'à l'état enregistré.
  - Copies remises à l'export ensuite : réimport, empreintes vérifiées.
- **Fidélité** (`recette/fidelite-theme-reel.mjs`) : **4/4 dans les deux versions**.
  - Desktop 1440 et mobile 390 : premier affichage (CSS serveur seul) = site publié après runtime = aperçu de l'éditeur.
  - Valeurs exactes, **sans double application** : bande 0 / −18 px (desktop), 0 / −7 px (mobile) ; logo 60 × 60 px et −14 px.
  - Boîtes identiques au demi-pixel entre les trois vues et entre les deux versions : desktop, bande `[0, 103, 1440, 48]` et logo `[154, 13.5, 60, 60]` ; mobile, bande `[0, 114, 390, 81.5]` et logo `[6, 16, 60, 60]`.
- **Panneaux** (`recette/panneaux-theme-reel.mjs`) : **3/3 dans les deux versions**.
  - Structure (410 lignes) : la bande s'ouvre et se marque depuis l'aperçu ; un clic sur la ligne du bandeau le sélectionne.
  - Assets : 69 cartes, dont le logo.
  - Médiathèque ouverte depuis le logo, fermée sans choix : aucune modification.

### 12.6 Performances publiques, 0.4.3 contre 0.4.5

`dev/campagne-mesures.mjs` : visiteur anonyme, accueil complet, toute requête externe coupée, ordre alterné, test de rang.

**Premier passage** (2 tours de 3 passages) : aucun écart significatif.

| Cas | FCP après réponse 0.4.3 → 0.4.5 | FCP | TTFB |
|---|---|---|---|
| Desktop, froid | 334 → 369 ms (p = 0,26) | 1 280 → 1 276 (p = 0,87) | 926 → 934 (p = 0,75) |
| Desktop, chaud | 362 → 391 ms (p = 0,2) | 1 280 → 1 308 (p = 0,52) | 918 → 930 (p = 0,75) |
| Mobile, froid | 588 → 777 ms (p = 0,63) | 1 476 → 1 700 (p = 0,34) | 888 → 935 (p = 0,87) |
| Mobile, chaud | 496 → 535 ms (p = 0,87) | 1 412 → 1 460 (p = 0,87) | 977 → 925 (p = 0,87) |

- Requêtes et volume identiques : 40 et 2 064 Ko en desktop, 35 et 1 745 Ko en mobile. Mêmes 4 modules publics.
- CLS 0 ; longues tâches de 2 à 5 par chargement dans les deux versions.
- Long animation frames sur tous les passages des deux versions (pluie de runes) ; trames lentes et pire trame comparables.

La 0.4.5 était plus lente dans les quatre cas, sans signification : résultat ambigu, donc **répété seul**, cache froid, 4 tours de 5 passages par version (20 passages).

| Cas | FCP après réponse 0.4.3 → 0.4.5 | FCP | TTFB |
|---|---|---|---|
| Desktop, froid | 410 → 336 ms (**−74**, p = 0,068) | 1 288 → 1 256 (p = 0,52) | 893 → 899 (p = 0,62) |
| Mobile, froid | 608 → 575 ms (**−33**, p = 0,12) | 1 592 → 1 408 (p = 0,25) | 888 → 884 (p = 0,98) |

L'écart du premier passage ne se reproduit pas : il s'inverse, toujours dans le bruit. **Aucune régression reproductible** du chargement, des animations ou du défilement.

---

## Annexe A — conception de la 0.4.5 et premier passage (conteneur distant, WordPress 6.5.5)

Contenu du premier compte rendu, conservé tel quel. Ses mesures précèdent la CI. Elles restent valables pour le code testé : depuis, l'extension n'a changé que par le placement du panneau de diagnostic.

### A.1 Conditions de mesure

- **Où** : conteneur distant (Linux, 4 cœurs, sans GPU), pas le Mac de Kevin. Un seul navigateur, un seul scénario à la fois, jamais en parallèle. Navigateurs, traces et serveurs arrêtés après chaque étape.
- **Navigateur** : Chromium 141 (`/opt/pw-browsers/chromium`), sans fenêtre, 1560 × 1000, CPU non ralenti. Sans GPU, la composition est logicielle : les pourcentages absolus sont plus élevés que sur un Mac, mais avant et après sont mesurés dans les mêmes conditions.
- **WordPress** : Playground, PHP 8.3, **WordPress 6.5.5** (copie npm). wordpress.org et GitHub sont bloqués par le réseau de cet environnement : la 7.1.2 du banc habituel n'a pas pu être téléchargée.
- **Page** : banc animé `/?vt-test=animated` (nouveau, `dev/fixture-theme/animated.js`), avec deux retouches publiées. Il reproduit les motifs relevés en 0.4.4 sur le thème réel (`main.js`) :
  - boucle `tick` permanente, qui lit la géométrie puis écrit des styles à chaque image ;
  - gestionnaires de défilement et de redimensionnement ;
  - animations CSS infinies (pulsation, rotation, reflet) ;
  - diaporama (classe toutes les 3 s) et bandeau qui déplace un élément du DOM toutes les 4 s.
  Le thème réel (`.local/real-theme`) n'est pas dans le dépôt : **la mesure sur L'Énergie des Runes reste à faire**.
- **Outil** : `dev/mesure-ressources.mjs`, un scénario par appel, fenêtre de 10 à 30 s après 1,5 s de stabilisation.
  - CPU par processus (moyenne et pic d'une seconde) ;
  - fil principal occupé, script, recalculs de style, mises en page (`Performance.getMetrics`) ;
  - profil CPU par origine : thème, runtime public, éditeur, rendu natif ;
  - tâches récurrentes par origine (sonde légère, identique avant et après) ;
  - mémoire après collecte.
  Fichiers bruts : `mesures/avant-*.json` (0.4.4), `mesures/apres-*.json` (0.4.5).

Bruit : la page publique, octet pour octet identique entre les deux versions, varie de 67 à 73 % de CPU d'un passage à l'autre. Seuls les écarts nettement supérieurs à ±6 points sont retenus.

### A.2 Référence 0.4.4 : où partent les ressources

| Scénario (durée) | CPU moyen | pic | fil principal | recalculs de style/s | mises en page/s |
|---|---|---|---|---|---|
| Page publique seule (15 s) | 67 % | 83 % | 10,2 % | 120 | 0,9 |
| Public, défilement continu (15 s) | 57 % | 95 % | 12,8 % | 120 | 4,9 |
| Éditeur ouvert, aucune action (30 s) | **97 %** | 132 % | **23,7 %** | **241** | 1,7 |
| Éditeur, sélection + onglet Assets, aucune action (15 s) | 97 % | 148 % | 27,7 % | 241 | 1,7 |
| Éditeur, défilement avec sélection (15 s) | **104 %** | 154 % | **34,7 %** | 259 | 20,3 |
| Éditeur : défilement, sélections, déplacement, écrans (15 s) | 107 % | 146 % | 36,7 % | 271 | 31,2 |
| Éditeur après 5 ouvertures successives (10 s) | 100 % | 127 % | 29,3 % | 242 | 1,8 |

**Causes mesurées**

1. **Le thème tournait deux fois.** L'éditeur s'ouvrait par-dessus la page du thème, et cette copie, invisible derrière l'interface, exécutait tout :
   - sa boucle `requestAnimationFrame` (60/s, comme celle de l'aperçu) ;
   - ses animations CSS, ses gestionnaires de défilement ;
   - le runtime public.

   Résultat : deux fois plus de recalculs de style qu'en public (241/s contre 120/s), et le temps de script du thème multiplié par 2,6 (50,7 contre 19,5 ms/s). C'était le coût dominant, au repos comme au défilement.
2. **Observateur de Navigation déclenché par les animations du thème** : 61 rappels/s, 362 enregistrements/s (styles en ligne écrits à chaque image).
   - Animation continue : chaque mutation repoussait la mise à jour de 200 ms. Les panneaux n'étaient donc jamais mis à jour (asset ajouté invisible), sans pour autant rien économiser.
   - Animation intermittente (onglet en arrière-plan, rAF ralenti) : reconstruction complète du panneau Assets à chaque passage, 7,4 ms/s de script en 0.4.4, **même quand l'inventaire n'avait pas changé**.
   - Tout élément ajouté ou retiré reconstruisait l'arbre Structure entier.
3. **Contour** :
   - au défilement, `ContextualToolbar.position` relisait la scène après les écritures du contour : 2 à 3 mises en page forcées par image ;
   - chaque mise à jour cherchait les calques par sélecteur dans le shadow DOM, après l'arbre Structure (des centaines de lignes parcourues à chaque fois) ;
   - n'importe quel défilement de la page (carrousels compris) relançait le contour, même sans sélection.
4. **Onglet ou panneau masqué** : la Navigation continuait de traiter les mutations du thème (minuteries) alors que personne ne la voyait.

**Non retenu, mesuré négligeable ou déjà correct** : écouteurs et observateurs ne s'accumulent pas d'une navigation à l'autre (mémoire stable : 3,8 → 5,1 Mo, comme en 0.4.4). L'éditeur n'a aucune boucle de rendu propre au repos (0 rappel rAF/s). Le runtime public ne fait rien au repos.

### A.3 Corrections

**Document hôte de l'éditeur** (`includes/editor-host.php`, `class-plugin.php`)
- `?vt-edit=1` sert désormais un document minimal (filtre `template_include`).
- Il contient :
  - les feuilles de style enfilées, pour garder les polices du site dans les aperçus de police ;
  - la médiathèque : les scripts ajoutés par `wp_enqueue_media`, repérés par différence, plus ses quatre scripts nommés si le thème l'a déjà enfilée ;
  - l'éditeur.
- Il ne contient ni gabarit, ni script du thème, ni runtime.
- Le thème tourne normalement, complet, dans l'aperçu (`vt-frame`), qui est inchangé. Ses scripts ne sont donc pas désactivés : seule leur copie invisible disparaît.
- La configuration est attachée au module de l'éditeur.

**Navigation** (`navigation.js`, `assets.js`)
- Délai fixe de 250 ms compté depuis la première mutation : une animation continue ne bloque plus les mises à jour.
- Un attribut modifié ne concerne que son nœud, plus ses descendants s'ils sont au plus 64 ; un nœud ajouté ou retiré concerne tout son sous-arbre.
- Le panneau Assets n'est reconstruit que si ce qu'il affiche a changé (signature : source, type, zone, dimensions…).
- Structure : seule la branche dont les enfants ont changé est reconstruite (`structureInventory` accepte une racine), puis seules ses lignes sont repeintes. Un ajout directement sous `<body>` reconstruit l'arbre, comme avant.
- Rien n'est traité pendant que la navigation est masquée (panneau fermé, onglet en arrière-plan) : les changements attendent et sont appliqués en une fois au retour (`visibilitychange`, réouverture du panneau).
- Nouveaux compteurs dans les diagnostics : `structureBranches` et `viewRebuilds`.

**Contour** (`editor.js`, `contextual-toolbar.js`)
- Sans survol ni sélection, aucune lecture de géométrie.
- Un défilement n'entraîne une mise à jour que s'il y a une sélection.
- La barre contextuelle reçoit la géométrie lue avant les écritures (scène, défilement, largeur de la barre) : aucune mise en page forcée par image tant qu'elle reste affichée.
- Les calques (survol, sélection, poignées, scène) sont recherchés une seule fois.

**Édition allégée** (`light-mode.js`, bouton « Édition allégée » dans la barre de l'aperçu), désactivée par défaut, choix conservé par site.
- Dans l'aperçu seulement :
  - les boucles `requestAnimationFrame` du thème passent à 4 images/s. Les animations finies se terminent quand même, à l'heure prévue : rien ne reste figé à mi-chemin ;
  - les animations CSS et Web infinies sont mises en pause, ainsi que les vidéos en lecture ;
  - les apparitions et transitions ne sont pas touchées.
- Les scripts du thème continuent de s'exécuter : événements, minuteries, observateurs.
- Un second clic rend immédiatement le rendu animé réel. La mise en pause CSS passe par une règle sur l'élément, retirée ensuite : l'`animation-play-state` propre au thème reprend la main.
- Le test responsive utilise les images natives, il fonctionne aussi en mode allégé.
- Limite : une boucle qui a gardé sa propre référence à `requestAnimationFrame` avant l'ouverture de l'éditeur (cas de GSAP, par exemple) n'est pas ralentie.

**Version** : 0.4.5 (imports, en-tête, `readme.txt`, `package.json`). Le runtime public et ses trois modules ne changent que par ce numéro.

### A.4 Résultats (mêmes conditions)

| Scénario | CPU moyen | pic | fil principal | recalculs de style/s | script (ms/s) |
|---|---|---|---|---|---|
| **Éditeur au repos (30 s)** | 96,5 → **66,0 %** | 132 → 86 % | 23,7 → **17,6 %** | 241 → 120 | 37,1 → 23,9 |
| Éditeur au repos, édition allégée | → **22,0 %** | → 43 % | → **2,2 %** | → 7,8 | → 3,1 |
| Repos, sélection + Assets (15 s) | 97,2 → 64,9 % | 148 → 104 % | 27,7 → 18,7 % | 241 → 121 | 38,8 → 22,8 |
| **Défilement avec sélection (15 s)** | 103,6 → **66,2 %** | 154 → 124 % | 34,7 → **25,0 %** | 259 → 145 | 45,3 → 27,3 |
| Défilement, édition allégée | → **49,1 %** | → 105 % | → **10,7 %** | → 68 | → 12,7 |
| Interactions (15 s) | 107,4 → 65,5 % | 146 → 125 % | 36,7 → 26,4 % | 271 → 152 | 53,2 → 33,8 |
| Après 5 ouvertures (10 s) | 99,8 → 73,4 % | 127 → 89 % | 29,3 → 23,3 % | 242 → 121 | 35,3 → 22,2 |
| Onglet en arrière-plan (12 s) | 19,6 → 17,2 % | 50 → 39 % | 3,6 → 2,6 % | 6,5 → 2,5 | 5,2 → 1,6 |
| Page publique (15 s, témoin) | 67,3 / 73,3 % | 83 / 85 % | 10,2 / 11,2 % | 120 / 120 | 15,9 / 18,0 |

**Attribution, éditeur au repos** (profil CPU, ms par seconde) :

| | 0.4.4 | 0.4.5 | 0.4.5 allégé | public |
|---|---|---|---|---|
| Thème | 50,7 | 25,5 | 0,9 | 19,5 |
| Éditeur | 1,7 | 1,2 | 0,6 | — |
| Runtime public | 0,0 | 0,0 | 0,0 | 0,0 |
| Rendu natif (style, mise en page, peinture hors JS) | 158,8 | 134,0 | 11,0 | 83,9 |

Au défilement, le temps de script propre à l'éditeur passe de 13,0 à 10,2 ms/s ; en interactions, de 25,4 à 19,7 ms/s.

**Mémoire** : document hôte allégé (1 685 → 1 402 nœuds au repos ; 3 161 → 2 878 en interactions). Le tas JS reste stable d'une ouverture à l'autre, comme en 0.4.4 : 3,8 → 4,9 → 5,0 Mo. Aucune accumulation.

**Onglet en arrière-plan** : script de l'éditeur 7,4 → 0,7 ms/s, sans reconstruction du panneau Assets. Chromium sans fenêtre ne passe pas l'onglet en « hidden » (il ralentit seulement ses images) : la suspension sur `visibilitychange` est vérifiée par le test ciblé, en simulant l'état masqué.

**Lecture**
- Au repos et au défilement, la consommation baisse d'environ 30 points de CPU. Le fil principal occupé baisse de 26 % au repos et de 28 % au défilement. Les recalculs de style sont divisés par deux. Ce n'est pas seulement un nombre de recalculs : le CPU, le fil principal, les pics et le temps de script baissent tous.
- Avec l'édition allégée, l'éditeur au repos consomme moins que la page publique seule (22 % contre 67-73 %), et le défilement aussi (49 % contre 57 %).
- Il reste, sans le mode allégé, un écart avec la page publique au repos (fil principal 17,6 % contre 10-11 %). La trace l'attribue à la peinture : environ 20 ms/s de plus, parce que la page animée est rendue dans le cadre de l'éditeur. Il ne vient ni de l'échelle de l'aperçu (identique à 100 %), ni d'un calque à promouvoir (`will-change` sans effet), ni de l'arbre Structure (−5 ms/s seulement une fois fermé). Seul le mode allégé le supprime.

### A.5 Conservation, fidélité, site public

- **Site public** : HTML visiteur identique octet pour octet à la 0.4.4 sur 3 pages (accueil du banc, page animée retouchée, seconde page). `runtime.js`, `styles.js`, `selection.js` et `background-layers.js` ne changent que par le numéro de version. Le CSS serveur et `published_styles()` ne changent pas.
- **Données** : aucun changement de format, de REST/CAS, d'historique ou de brouillon. Seule nouveauté : la clé locale `visual-tweaks-light:…` (préférence du mode allégé).
- **Fidélité** : l'aperçu reste la vraie page du thème. En mode allégé, les retouches (translation, taille, couleur, hauteur) sont identiques avant, pendant et après, et le rendu animé est rétabli à l'identique (états des animations, aucune trace laissée).
