# Visual Tweaks 0.4.5 — validation avant déploiement — 11 octobre 2026

**Rien n'est déployé.** Production : WordPress 7.1.3, extension 0.4.3 au 11/10 ; la 0.4.4 n'a jamais été installée.

## 0. Verdict

**Non déployable en l'état : la recette sur le thème réel n'a pas pu être faite**, faute de copie du thème `lenergiedesrunes` (section 2).

Tout ce qui a pu être testé est conforme, et aucun critère bloquant n'est atteint :
- **perte de modification** : aucune. Conservation 7/7 sur Chromium, WebKit et Firefox ; données enregistrées vérifiées par l'API ;
- **rendu** : éditeur, éditeur allégé, publié et premier affichage identiques sur le banc, sur les trois moteurs ;
- **mode allégé** : réversible sur les trois moteurs. Bascules répétées, une seule boucle, rien de figé, préférence suivie entre pages, retour d'onglet ;
- **performances publiques** : aucune régression. HTML et modules publics identiques à la 0.4.4 hors numéro de version ; FCP, LCP, CLS, requêtes et volume identiques.

Les gains de ressources sont confirmés sur le banc animé, sous WordPress 7.1.3 : CPU au repos −28 %, au défilement −32 %, recalculs de style divisés par deux, plus aucune boucle du thème dans le document de l'éditeur. **Ils restent à confirmer sur le thème réel.**

**Pour lever la réserve** : recette sur le thème réel avec l'archive candidate `visual-tweaks-0.4.5.zip` (section 9), en CI ou dans un environnement distant, jamais sur le Mac. Commandes en section 8. Si cette recette est conforme, la 0.4.5 est déployable sans autre changement, selon `PROCEDURE.md`.

## 1. Commit et environnement

**Code testé**
- Extension (`visual-tweaks/`) : dernière modification au commit `c350cf7`, inchangée jusqu'à `30f06ae` (fin de validation).
- Archive `artifacts/visual-tweaks-0.4.5.zip` : identique à l'arbre de `30f06ae` (`diff -r`), 49 fichiers.
- Référence 0.4.4 : commit `fbbf381`, identique à `artifacts/visual-tweaks-0.4.4.zip`.

**CI GitHub Actions** (`.github/workflows/validation.yml`)
- Machine : ubuntu-24.04, 4 vCPU, 16 Go, sans GPU.
- Outils : Node 24.21.0, Playwright 1.62.1 (Chromium 151, Firefox et WebKit de cette version).
- WordPress Playground : **WordPress 7.1.3**, la version de production, avec PHP 8.3 et SQLite.
- Version de production lue par 2 requêtes, sans JavaScript donc sans envoi Analytics (`www.lenergiedesrunes.com` redirige vers `lenergiedesrunes.fr`) :
  - flux : `<generator>https://wordpress.org/?v=7.1.3</generator>` ;
  - fichiers `wp-includes` : `?ver=7.1.3`.

| Exécution | Commit | Contenu | Résultat |
|---|---|---|---|
| n° 3 | `1e9ad8f` | suite complète, échecs rejoués sur la 0.4.4 | 36 réussies, 6 en échec, toutes préexistantes ou d'environnement (section 7) |
| n° 4 | `ab38154` | suite complète après corrections ciblées ; campagne de mesures complète | **42/42 réussies**, 10 non exécutées (thème réel) ; mesures en section 3 |
| n° 6 | `30f06ae` | suite complète, tests PHP compris ; répétition de la seule mesure ambiguë | ⏳ en cours au moment de cette version du document |

**Conteneur distant** (premier passage et contrôles ciblés)
- Linux, 4 cœurs, Chromium 141, Node 22.22.
- WordPress 6.5.5 seulement : wordpress.org, github.com et le domaine de production y sont bloqués par le réseau.
- Firefox et WebKit n'y sont pas installables (CDN de Playwright bloqué).

**Différences d'environnement restantes**
- PHP de production non exposé, donc inconnu (CI : PHP 8.3).
- Base MySQL/MariaDB en production, SQLite en CI.
- LiteSpeed et CDN Hostinger absents du banc.
- Navigateurs Linux sans fenêtre, alors que Kevin utilise un Mac.
- Thème réel absent.

## 2. Prérequis : thème réel et données

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

## 4. Mode allégé (banc média, trois moteurs)

`tests/allege-e2e.mjs`, sur la variante `?vt-test=animated-media` : boucle comptée, animations CSS infinies, animation d'entrée, révélation par animation et par transition, vidéo en boucle. **Ce n'est pas le thème réel.**

| Contrôle | Chromium | WebKit | Firefox |
|---|---|---|---|
| 4 bascules : boucle de 60/s à ≤ 6/s, puis rétablie ; une seule boucle (passages / images natives = 1,0), aucune trace laissée | ✔ | ✔ | ✔ |
| Animations infinies en pause puis relancées ; vidéo en pause puis relancée | ✔ | ✔ (vidéo WebM non lue par WebKit Linux : contrôle vidéo non applicable) | ✔ |
| Mode allégé : animation d'entrée et révélations terminées (rien de figé), en-tête qui suit le défilement | ✔ | ✔ | ✔ |
| Sélection, contour exact, déplacement à la souris et au clavier, annulation jusqu'à l'état enregistré | ✔ | ✔ | ✔ |
| Navigation entre pages : préférence conservée, puis retirée partout | ✔ | ✔ | ✔ |
| Onglet masqué (simulé), puis en arrière-plan, puis retour : mode conservé, rendu animé rétabli sans boucle doublée | ✔ | ✔ | ✔ |
| Données enregistrées inchangées ; visiteur : 4 modules publics seulement, ni règle ni attribut du mode allégé ; 24 éléments × 14 styles identiques entre éditeur, éditeur allégé et public | ✔ | ✔ | ✔ |

Dans le conteneur distant : 6 cycles, rapport passages / images natives de 1,0 à chaque retour. Pendant le mode allégé, 3 passages par seconde.

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

**Seule mesure ambiguë** : en mobile à cache froid, la médiane des « long animation frames » (LoAF) vaut 1 en 0.4.5 contre 0 en 0.4.4, sur les deux tours. Le code public ne diffère que par le numéro de version, et la pire trame (33 ms) comme les trames lentes (0) sont identiques. Mesure répétée seule, en 4 tours de 5 passages alternés : ⏳ en cours (exécution n° 6)

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

**Exécution n° 4** : **42 suites réussies sur 42, 0 en échec, 10 non exécutées** (thème réel absent). Au total, 334 contrôles navigateur réussis, plus 18 tests unitaires du cœur.
- Les 11 tests unitaires PHP (rendu serveur = JavaScript, caches) y ont été **sautés**, faute de `VT_TOOLCHAIN` en CI.
- Ils ont été exécutés dans le conteneur distant : 11/11.
- La CI les exécute depuis l'exécution n° 6 : ⏳ en cours (exécution n° 6)

**Non exécutées** (thème `kevin-legros` absent) : `real-theme` ×3, `comfort-real-theme` ×3, `guard-visibility` ×3, `stabilisation` ×3.

Résumé ligne à ligne : `ci/suite-complete-run4.txt`.

## 8. Contrôles impossibles ici, à faire avant déploiement

1. **Recette sur le thème réel** (bloquante pour le déploiement), en CI ou dans un environnement distant, avec les archives de la section 2 :
   - ressources 0.4.4 / 0.4.5, sans puis avec mode allégé :
     `node dev/campagne-mesures.mjs --reference <site 0.4.4> --candidate <site 0.4.5> --sans-preparation --page / --autre <autre page> --cibles ".bande-lieu,img.logo__sceau,h1"` ;
   - mode allégé sur les animations réelles de `main.js` : bascules, retour au rendu animé, vidéos si présentes ;
   - recette historique « visiteur 390/900/1440 : bande et logo à leur place dès la première image, valeurs non doublées » (`recette-visual-tweaks.cjs`, sauvegardes locales) ;
   - les 4 suites « thème réel » avec `kevin-legros`.
2. **Onglet réellement masqué** : non reproductible dans un navigateur piloté. À constater une fois sur le Mac, quelques secondes :
   - passer à un autre onglet, puis revenir ;
   - l'aperçu reprend, les panneaux sont à jour.
3. **Environnement de production** : LiteSpeed, CDN Hostinger, MySQL et PHP de production. Contrôles prévus dans `PROCEDURE.md`, après installation.

## 9. Archive, empreinte, retour arrière

| Fichier | Empreinte SHA-256 |
|---|---|
| `artifacts/visual-tweaks-0.4.5.zip` (candidate, 49 fichiers, = commit `30f06ae`) | `d0180c25a2d022abad358e560f3d4ba49a1d3408eb6a70e37da19c34de3af75a` |
| `artifacts/visual-tweaks-0.4.4.zip` (= commit `fbbf381`) | `a83100ad96ed4bfe27b05b68c3b0a5eed28e403f911588475dc9fd93e72569ff` |
| `artifacts/visual-tweaks-0.4.3.zip` (production au 11/10) | `9ccc15d087f5b9eeb944255b8773fc7b79379b9eefcf668a17257246900fb8db` |

**L'archive candidate sert à la recette sur le thème réel. Ne pas l'installer en production avant cette recette.**

Retour arrière : réinstaller la version relevée avant installation (0.4.3 au 11/10). Les données gardent leur format : aucune restauration de données n'est nécessaire. Le détail, avec l'export et la restauration des options en cas de besoin, est dans `PROCEDURE.md`.

## 10. Limites restantes

- Thème réel non validé (section 8).
- Mode allégé :
  - une boucle d'animation qui a gardé sa propre référence à `requestAnimationFrame` avant l'ouverture de l'éditeur (GSAP, par exemple) n'est pas ralentie ;
  - les animations Web infinies créées après l'activation ne sont pas mises en pause.
- Sans le mode allégé, l'éditeur au repos dépasse encore la page publique seule : le dessin de la page animée dans le cadre coûte environ 20 ms/s de peinture (annexe A.4).
- Vidéo WebM non lue par WebKit Linux en CI : contrôle vidéo du mode allégé validé sur Chromium et Firefox seulement.
- Les mesures de CI (navigateur sans fenêtre, sans GPU) n'ont pas la même échelle absolue que sur un Mac. Seules les comparaisons 0.4.4 / 0.4.5 dans un même environnement sont significatives.

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
