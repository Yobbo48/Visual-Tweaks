# Visual Tweaks 0.4.5 — ressources consommées par l'éditeur — 11 octobre 2026

**Rien n'est déployé.** La production reste en 0.4.3 ; la 0.4.4 n'est pas installée non plus.

Objectif : que l'éditeur ne travaille que lorsqu'une action ou une modification pertinente le demande, avec une baisse mesurée du CPU, du temps occupé du fil principal et de la mémoire, sans toucher au site public ni aux retouches.

## 1. Conditions de mesure

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

## 2. Référence 0.4.4 : où partent les ressources

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

## 3. Corrections

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

## 4. Résultats (mêmes conditions)

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

## 5. Conservation, fidélité, site public

- **Site public** : HTML visiteur identique octet pour octet à la 0.4.4 sur 3 pages (accueil du banc, page animée retouchée, seconde page). `runtime.js`, `styles.js`, `selection.js` et `background-layers.js` ne changent que par le numéro de version. Le CSS serveur et `published_styles()` ne changent pas.
- **Données** : aucun changement de format, de REST/CAS, d'historique ou de brouillon. Seule nouveauté : la clé locale `visual-tweaks-light:…` (préférence du mode allégé).
- **Fidélité** : l'aperçu reste la vraie page du thème. En mode allégé, les retouches (translation, taille, couleur, hauteur) sont identiques avant, pendant et après, et le rendu animé est rétabli à l'identique (états des animations, aucune trace laissée).

## 6. Validation réalisée (Chromium seul, WordPress 6.5.5)

| Test | Résultat |
|---|---|
| `tests/ressources-e2e.mjs` (nouveau) : document hôte, Navigation sous animation continue, branche Structure dans l'ordre du DOM, onglet et panneau masqués, édition allégée réversible + test responsive + préférence | 5/5 |
| `tests/conservation-e2e.mjs` | 7/7 |
| `tests/fidelite-e2e.mjs` (7 cibles × 28 propriétés × 3 écrans, froid/chaud, premier affichage) | 6/6 |
| `tests/speed-e2e.mjs` (observateur, scans, rendu pendant le geste) | 5/5 |
| `tests/foundations-e2e.mjs` (médiathèque dans le nouveau document hôte, assets, fonds) | 16/16 |
| Syntaxe des modules modifiés (`node --check`) | valide |
| Barre de l'aperçu à 1280 et 1440 px | même hauteur et même zoom qu'en 0.4.4 |

## 7. Validations encore nécessaires (non réalisées ici)

Elles sont trop longues pour le Mac de Kevin et ne doivent pas y être lancées. À faire dans un environnement distant ou une CI qui accède à wordpress.org (pour WordPress 7.1.2) :

1. **Suite complète** `node dev/validate.mjs` (Chromium, WebKit, Firefox ; 46 suites + `ressources-e2e`, ajoutée au script). Aucun test n'a été lancé ici sous Firefox ni WebKit.
2. **Recette sur le thème réel** (`dev/real-theme-server.mjs`, thème `kevin-legros`) :
   - mesure `node dev/mesure-ressources.mjs repos --page /` puis `defilement` et `repos --leger`, avant/après ;
   - contrôle visuel du mode allégé sur ses animations réelles (`main.js`).
3. **Performances publiques sur relais** (FCP, LCP, CLS, trames lentes) : non remesurées. Le code public est identique, hors numéro de version.
4. Sur le Mac (une seule fois, quelques minutes) : ouvrir l'éditeur, basculer « Édition allégée », vérifier le rendu animé au second clic.
