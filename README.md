# Visual Tweaks — 0.4.5 — éditeur économe en ressources

Plugin WordPress autonome pour retoucher un site PHP/HTML/CSS/JavaScript depuis son rendu réel. JavaScript natif, aucun framework, aucun page builder, aucun service IA. Aucun fichier du thème n’est réécrit.

## 0.4.5 — ressources consommées pendant l'édition

Compte rendu, mesures brutes et validations restantes : `docs/validation-0.4.5/CONTROLE.md`. **Rien n'est déployé.**

**Mesuré sur la 0.4.4** (banc animé `?vt-test=animated`, Chromium, mêmes conditions). Éditeur ouvert sans action : 97 % de CPU contre 67 % pour la page publique seule, fil principal occupé 23,7 % contre 10,2 %, deux fois plus de recalculs de style (241/s contre 120/s). Causes :
- **Le thème tournait deux fois** : l'éditeur s'ouvrait par-dessus la page du thème, dont la copie invisible exécutait scripts, boucle d'animation et animations CSS, en plus de l'aperçu. C'était le coût dominant.
- **Observateur de Navigation** déclenché 60 fois par seconde par les animations du thème :
  - en continu, la mise à jour était repoussée sans fin (panneaux jamais à jour) ;
  - par intermittence, le panneau Assets était reconstruit même sans changement ;
  - un ajout ou un retrait dans la page reconstruisait tout l'arbre Structure.
- **Contour** : mises en page forcées par la barre contextuelle à chaque image de défilement, recherches répétées dans le shadow DOM, mise à jour même sans sélection.
- **Onglet ou panneau masqué** : la Navigation continuait de travailler.

**Corrections**
- `includes/editor-host.php`, `class-plugin.php` : l'éditeur a son propre document. Il contient les feuilles de style (polices), la médiathèque et l'éditeur, sans gabarit ni script du thème ni runtime. Le thème tourne normalement, et une seule fois, dans l'aperçu (`vt-frame`, inchangé).
- `navigation.js`, `assets.js` :
  - délai fixe au lieu d'un report à chaque mutation ;
  - Assets reconstruit seulement si son contenu change ;
  - Structure reconstruite par branche ;
  - rien n'est traité tant que la navigation est masquée (panneau fermé, onglet en arrière-plan) ; tout est rattrapé au retour.
- `editor.js`, `contextual-toolbar.js` : aucune lecture de géométrie sans sélection ni survol ; barre contextuelle placée avec la géométrie déjà lue ; calques recherchés une fois.
- `editor.js`, contour : replacé à la fin d'une transition ou d'une animation du thème qui déplace la sélection sans défilement (en-tête qui rétrécit, apparition). Défaut préexistant, aucune version antérieure n'écoutant ces événements : le contour restait décalé jusqu'au défilement suivant.
- **Édition allégée** (`light-mode.js`, bouton dans la barre de l'aperçu, désactivée par défaut, choix conservé) :
  - dans l'aperçu seulement, les boucles d'animation du thème passent à 4 images/s, les animations infinies et les vidéos sont en pause ;
  - les apparitions et transitions ne sont pas touchées ;
  - un second clic rend immédiatement le rendu animé réel ;
  - le site public n'est pas concerné.

**Résultats** (0.4.4 → 0.4.5)

| Scénario | CPU moyen | Fil principal | Recalculs de style/s |
|---|---|---|---|
| Éditeur au repos, 30 s | 96,5 → 66,0 % (allégé : 22,0 %) | 23,7 → 17,6 % (allégé : 2,2 %) | 241 → 120 (allégé : 8) |
| Défilement avec sélection | 103,6 → 66,2 % (allégé : 49,1 %) | 34,7 → 25,0 % (allégé : 10,7 %) | 259 → 145 (allégé : 68) |
| Interactions (sélection, déplacement, écrans) | 107,4 → 65,5 % | 36,7 → 26,4 % | 271 → 152 |
| Onglet en arrière-plan | 19,6 → 17,2 % ; script de l'éditeur 7,4 → 0,7 ms/s | | |

Mémoire stable d'une ouverture à l'autre ; document hôte plus léger (−283 nœuds).

**Inchangés** : le site public (HTML visiteur identique octet pour octet, runtime et modules publics identiques hors numéro de version), le format des données, la REST/CAS, l'historique, les brouillons.

**Validation** (Chromium seul, WordPress 6.5.5 : wordpress.org est inaccessible depuis l'environnement de mesure) :
- nouveau `tests/ressources-e2e.mjs` 5/5 ;
- `conservation` 7/7, `fidelite` 6/6, `speed` 5/5, `foundations` 16/16 (médiathèque comprise).

**Non réalisé** :
- suite complète sur trois moteurs ;
- recette et mesure sur le thème réel ;
- performances publiques sur relais.

Détail et commandes dans le compte rendu.

## 0.4.4 — fluidité de l'éditeur, conservation, publication

Compte rendu complet, mesures et procédures : `Wordpress Claude/backups/visual-tweaks-0.4.4-20261011/CONTROLE.md`.

**Problèmes reproduits sur la 0.4.3**, sur le banc local avec les données de production.
- **Départ pendant une sauvegarde.** Une retouche faite pendant l'envoi, puis un changement de page : au retour, le brouillon restait « à récupérer » sur l'ancienne révision. Le récupérer menait à un conflit refusé. Rien n'était perdu, mais la reprise était impossible sans export.
- **Messages illisibles.**
  - Une réponse HTML (502) affichait « Unexpected token '<' ».
  - Une coupure réseau affichait « Failed to fetch ».
  - Un jeton REST expiré affichait « Cookie check failed », et l'éditeur ne pouvait plus enregistrer sans recharger la page.
- **Conflit réel**, deux onglets ou deux sessions : seul l'export était proposé.
- **Publication.** L'éditeur annonçait « Réglages enregistrés » alors que LiteSpeed, puis le CDN Hostinger (qui met le HTML en cache), servaient encore l'ancienne page aux visiteurs.
- **Fluidité.**
  - Défilement avec une sélection : 13 recalculs de style forcés par événement, car `updateOutline` alterne lectures et écritures.
  - Changement d'écran : une mise en page forcée par ligne de l'arbre de navigation, dans `paintTree`.
- **Fidélité.**
  - Un élément avec voile coloré était entièrement laissé au runtime : ses autres réglages (position du fond…) n'apparaissaient qu'après le JavaScript.
  - Fermer le test responsive avec Échap laissait l'aperçu une tâche de plus (test `comfort` instable).

**Corrections.**
- `editor.js`
  - Lectures de géométrie groupées avant les écritures. Le contour suit défilement et redimensionnement une fois par image, dans la même image.
  - Journal des envois non confirmés (`visual-tweaks:…:envoi`). Au retour, la révision du serveur est reconnue comme notre propre envoi, et le brouillon continue dessus. Sur un 409, l'éditeur vérifie d'abord si la version enregistrée est notre propre envoi resté sans réponse : pas de faux conflit.
  - Jeton REST renouvelé une fois (`admin-ajax.php?action=rest-nonce`), puis requête rejouée.
  - Réponses illisibles et coupures réseau : message clair, brouillon conservé.
  - Conflit : « Exporter mon brouillon », ou « Remplacer la version enregistrée ». Le remplacement est confirmé, et la version remplacée est d'abord téléchargée en JSON.
  - Autre onglet sur la même page signalé (`BroadcastChannel`).
  - Le message après sauvegarde dit ce que voient les visiteurs.
- `navigation.js` : arbre peint en deux temps, toutes les lectures puis toutes les écritures.
- `responsive-guard.js` : l'aperçu est annulé dès l'événement `cancel` (Échap).
- `includes/class-cache.php` (nouveau)
  - Après une sauvegarde confirmée : purge LiteSpeed de la seule URL publiée (`litespeed_purge_url`, sans notification dans l'administration).
  - CDN Hostinger : son extension ne sait vider que tout le site, cache serveur compris. Le vidage est proposé, jamais déclenché automatiquement.
  - Une purge ne fait jamais échouer la sauvegarde.
  - Le style du site n'est pas rendu côté public : aucune page à purger.
- `class-published-styles.php`
  - Seules les parties mesurées (voile, zoom de fond) restent au runtime ; les autres réglages de l'élément sont imprimés.
  - Une image zoomée qui a aussi un fond reste au runtime, comme dans `styles.js`.
- `class-plugin.php` : CSS serveur imprimé en fin de `<head>`, comme la feuille du runtime (même cascade). Rapport de cache dans la réponse de sauvegarde ; adresse de renouvellement du jeton.

**Inchangés** : le runtime public et ses modules (octet pour octet hors numéro de version), le format des données, la REST/CAS, l'historique, les brouillons existants. Sur l'Énergie des Runes, le CSS serveur de l'accueil est identique octet pour octet.

**Validation**
- `dev/validate.mjs` sur Chromium, WebKit et Firefox : les 316 contrôles historiques, plus les nouveaux (journal : `artifacts/validation-0.4.4.log`).
- Nouveaux tests
  - `tests/conservation-e2e.mjs` : 7 scénarios par moteur.
  - `tests/fidelite-e2e.mjs` : éditeur = publié (froid et chaud) = premier affichage hors écarts nommés, 7 cibles × 28 propriétés × 3 écrans, profil téléphone.
  - `tests/published-styles.test.mjs` : toutes les propriétés du schéma, PHP = JavaScript.
  - `tests/cache.test.mjs`.

**Limites restantes**
- **CDN Hostinger** : vidage de tout le site seulement, sur action explicite.
- **LiteSpeed** : purge vérifiée sur son code source et par test isolé ; à observer en production (en-tête de purge) à la première sauvegarde.
- **Translation posée par le thème** (propriété `translate`) : au premier affichage, la retouche s'applique sans la base du thème ; le runtime la compose ensuite, une seule fois. L'Énergie des Runes n'en utilise pas.
- **Cible devenue ambiguë** (page modifiée depuis) : avant l'exécution du runtime, le CSS serveur s'applique à tous les éléments correspondants ; le runtime le retire et l'éditeur signale la cible. La retouche est conservée.
- **Brouillons non enregistrés** : ils restent dans le navigateur (stockage local). Deux onglets sur la même page partagent ce brouillon ; l'éditeur le signale.

## 0.4.3 — aucun saut au premier affichage

**Problème mesuré** (L’Énergie des Runes, 9 octobre 2026). Le runtime n’applique les overrides qu’une fois ses quatre modules chargés, donc après le premier affichage. Sur l’accueil, une première image montrait le logo à 46 px et la bande du lieu à sa place d’origine, puis le logo passait à 60 px (−14 px) et la bande remontait de 7 ou 18 px. Le saut durait de 110 à 333 ms selon le banc. Il n’est pas compté dans le CLS, car c’est une translation, mais il est visible.

**Correction.**
- `includes/class-published-styles.php` (nouveau) porte `styles.js/generateCSS()` en PHP.
  - Mêmes déclarations, même ordre, même `!important`, mêmes media queries.
  - Sélecteur `:where(sélecteur enregistré):where(étiquette.classes de l’empreinte)` (plus `[src]` pour une image), puis `:not([data-vt-published-off])`. La spécificité est donc celle de `[data-vt-target]`, soit (0,1,0).
- `Plugin::published_styles()` (`wp_head`, priorité 99) imprime `<style id="vt-published-styles">` pour les visiteurs, aux mêmes conditions que le runtime public. Il ne le fait jamais en mode édition ni dans le cadre `vt-frame`.
- `runtime.js` passe cette feuille en `media="not all"` avant sa première mesure, dans la même tâche que son propre rendu.
  - Second verrou : chaque règle serveur commence par `:where(html:not([data-vt-runtime]))`, et le runtime pose `data-vt-runtime` sur `<html>` au même moment. La spécificité reste (0,1,0).
  - Ce verrou tient même si un optimiseur déplace les règles hors de leur balise. C'est le cas de LiteSpeed avec « CSS Combine » + « Combine External and Inline ». Sans lui, la retouche serait appliquée deux fois (bande à −14 px au lieu de −7, logo à −28 px au lieu de −14), un défaut reproduit sur le banc.
  - Une cible `<html>` reste au runtime seul : le verrou exige une cible descendante.
  - Les bases de translation sont mesurées sans elle : aucune double application, aucune image intermédiaire.
  - Le runtime reste seul maître ensuite : garde d’empreinte, contenus, éditeur, redimensionnement.
- Restent au runtime seul, parce qu’ils dépendent d’une mesure dans la page : voile, couches de fond, image de fond remplacée, zoom de fond. Les contenus (texte, lien, image) restent des mutations du DOM, inchangées.
- Rien ne change pour le stockage (schema v1), la REST/CAS, le brouillon, l’historique ou l’éditeur.
- Imports et métadonnées passent en 0.4.3, selon la règle du projet contre les modules mélangés en cache.

**Limites connues.**
- **Translation déjà posée par le thème** (propriété `translate`) : le serveur ne connaît pas la base mesurée. La première image montre la translation de la retouche seule ; le runtime ajoute ensuite la base, comme avant.
- **Empreinte non exprimable en CSS** (texte, fond) : vérifiée par le runtime seulement. Si la page a changé et que la retouche ne correspond plus, la feuille serveur s’applique jusqu’à l’exécution du runtime, qui la retire.
- **Cache HTML public** : la feuille est dans le même HTML que la configuration du runtime ; les deux restent donc toujours cohérentes. Une sauvegarde ne purge pas le cache de page (règle inchangée depuis la 0.3) : il faut purger la page, ou le cache LiteSpeed, pour que les visiteurs voient la nouvelle retouche.
- **Optimiseurs CSS** : minification, combinaison, CSS critique ou UCSS peuvent déplacer ou réécrire les règles sans risque de double application, grâce au second verrou. Au pire, si un optimiseur les retire (UCSS calculé sur une page où le runtime a déjà tourné), on retrouve le comportement de la 0.4.2 : le saut au premier affichage, jamais une valeur doublée. Le 9 octobre 2026 en production, LiteSpeed ne touche pas au CSS en ligne : minification, combinaison, UCSS et CSS asynchrone sont désactivés.

**Validation de la 0.4.3**
- Syntaxe : PHP valide (`php -l`, et `dev/check.mjs` avec PHP WebAssembly) ; modules JS valides.
- `node --test tests/core.test.mjs` : 18/18.
- Nouveau `tests/published-styles.test.mjs` (PHP WebAssembly, `VT_TOOLCHAIN`) : 5/5.
  - CSS serveur identique au CSS du runtime, règle par règle.
  - Sélecteurs (verrou du runtime compris) et échappement corrects.
  - Fonds, voile et cible `<html>` laissés au runtime.
  - Aucune donnée ne peut fermer `<style>`.
- **Suite complète `dev/validate.mjs` : 316/316 contrôles, 39 suites sur 39**, Chromium, WebKit et Firefox, le 9 octobre 2026.
  - Environnement : Node 24.21.0, Playwright 1.62.1, WordPress Playground (WordPress 7.1.x, PHP 8.3, SQLite).
  - Couvre notamment : brouillon, Undo, sauvegarde, rafraîchissement, conflit, responsive par écran, et cache public (ancienne valeur tant que la page n'est pas purgée, dernière valeur après purge).
  - Journal : `artifacts/validation-0.4.3.log`. Une première exécution complète, avant le second verrou, avait aussi donné 316/316 (`artifacts/validation-0.4.3-avant-durcissement.log`).
  - Test instable connu, sans lien avec la 0.4.3 : `comfort-e2e.mjs` ligne 460 lit la largeur juste après Échap, alors qu'elle n'est restaurée qu'à l'image suivante. Il a échoué lors d'une exécution intermédiaire, y compris avec le code de la première exécution réussie. Avec 1,5 s d'attente, la valeur attendue (920 px) est bien là. Il est passé dans l'exécution finale.
- Recette WordPress Playground (thème réel de L'Énergie des Runes, retouches publiées de la production) : 30/30 contrôles, plus 10/10 en simulation de CSS regroupé.
  - Visiteur à 390, 900 et 1440 px : feuille dans `<head>`, bande et logo à leur place dès la première image, feuille neutralisée par le runtime, valeurs non doublées.
  - Redimensionnement.
  - Administrateur : vue publique, mode édition et cadre sans feuille serveur, runtime prêt.
  - Sauvegarde par la REST avec la nonce de l'éditeur : nouvelle valeur dès la première image.
  - CSS regroupé par un optimiseur (`--combine`) : sans le second verrou, 6 échecs (valeurs doublées) ; avec, 10/10.
  - La même recette sur la 0.4.2 échoue sur le saut, comme attendu.
  - Script : `Wordpress Claude/backups/perf-fluidite-20261009/outils/recette-visual-tweaks.cjs`.

Sauvegarde avant modification : `artifacts/backups/visual-tweaks-0.4.2-before-published-css.tar.gz` (et `.sha256`). Archive installable : `artifacts/visual-tweaks-0.4.3.zip`. Retour arrière : réinstaller `artifacts/visual-tweaks-0.4.2.zip`, puis purger le cache.

## Correctif 0.4.2 — audit responsive partiel

Sur une page contenant plus de 1 500 éléments DOM (y compris les sous-éléments SVG et éléments masqués), l’audit conserve sa limite de parcours pour rester réactif. Cette limite est une **information de couverture**, pas un défaut d’un bloc. Le précédent bouton « Voir » fermait le rapport sans sélectionner la page entière ; il était trompeur.

Le rapport indique désormais le nombre parcouru et le nombre total, affiche **analyse partielle** et ne compte pas cette information comme point à corriger. Aucun bouton « Voir » ou « Ignorer » n’est proposé pour la couverture ; elle reste visible même lorsque les 40 recommandations sont atteintes. « Voir » reste disponible pour une alerte ciblant un élément, avec sélection/Structure/propriétés synchronisées. Aucun changement des règles, seuils responsive ou du draft.

Validation finale : **316 contrôles navigateur et 18 tests unitaires passants**, dont les 307 contrôles précédents conservés. Les trois moteurs passent ; les 191 fichiers du thème source restent inchangés. Détail : `artifacts/validation-0.4.2.json`.

Checkpoint de la 0.4.1 : `artifacts/baseline-0.4.1.json`. Reproduction avant correction : `artifacts/guard-navigation-before.json`. Tests ajoutés : `tests/guard-navigation-e2e.mjs`, sur les trois moteurs. Le stockage, Runtime et historique sont conservés ; le correctif fonctionnel est limité à `responsive-guard.js`.

## Stabilisation 0.4.1 — historique

La 0.4.0 est la référence : checkpoint complet et hashes dans `artifacts/baseline-0.4.0.json`, archive `artifacts/backups/visual-tweaks-0.4.0-before-stabilisation.tar.gz`. Ses **270 contrôles navigateur et 18 tests unitaires** ont été relancés avant toute modification.

Trois correctifs locaux : le Responsive Guard ignorait l’opacité des parents et signalait des descendants invisibles ; il exclut désormais ces sous-arbres avec un cache limité à chaque mesure. La navigation vers une sélection suivait le `scroll-behavior: smooth` du thème : la toolbar pouvait encore bouger lors du clic. Ce défilement de sélection est maintenant instantané, sans changer la navigation du site en mode Naviguer. Effacer un réglage actualise aussi son indication avec la valeur du site ou la valeur héritée, au lieu de laisser apparaître l’ancien override. Aucune nouvelle règle, correction automatique, refonte ou fonctionnalité. Les imports et métadonnées passent en 0.4.1 pour éviter un mélange de modules en cache. L’implémentation des quatre modules publics reste identique ; seules leurs URLs de version changent.

La validation finale de la 0.4.1 passe **307 contrôles navigateur et 18 tests unitaires** (325 au total), dont les **270 contrôles historiques conservés**. Les 14 fichiers de tests historiques sont inchangés ; les 191 hashes du thème source aussi. Les parcours critiques et le thème isolé passent sur Chromium, WebKit et Firefox. Preuves détaillées : `artifacts/validation-0.4.1.json` et son journal.

La passe de validation est détaillée dans [le rapport court](docs/stabilisation-0.4.1.md). MySQL/MariaDB n’est **pas testé** : cet environnement fournit PHP WebAssembly et SQLite, sans serveur MySQL/MariaDB, PHP natif ni moteur de conteneurs installé. La compatibilité native reste à démontrer.

## Fonctions introduites en 0.4.0 — historique

Base conservée : **0.3.4 corrigée**, conformément à votre choix. Les 14 tests unitaires et 231 contrôles navigateur de cette base ont été relancés avant modification. Checkpoint intégral : `artifacts/backups/visual-tweaks-0.3.4-before-0.4.tar.gz`, état de référence dans `artifacts/baseline-0.3.4.json`. Les versions précédentes restent disponibles.

- **Modifications** donne une liste issue directement des overrides de la page, enregistrés ou encore dans le brouillon : écran concerné, déplacement, taille, couleur, contenu et image remplacée. **Voir** retrouve la sélection partagée avec Structure et les propriétés. **Réinitialiser** retire les overrides de cet élément ; le reset de toute la page demande confirmation. Ces actions restent annulables. La liste décrit les valeurs finales ; elle ne prétend pas connaître l’ancienne taille calculée du thème.
- **Modifier / Naviguer** permet de tester les menus, accordéons, interactions et ancres, puis de revenir à la même sélection et au même brouillon. Les liens vers une autre page et les formulaires classiques ouvrent un nouvel onglet pour protéger le brouillon de la page en cours. Ce n’est pas une édition multi-pages dans une seule iframe. Les scripts du site continuent de fonctionner : utiliser un environnement de test pour les interactions métier.
- **Guides et magnétisme** : bords et centre du parent, centres des voisins proches. Tolérance de 4 pixels CSS logiques, indépendante du zoom ; maintenir **Ctrl** pendant le drag désactive le snap. Alt/Cmd reste réservé à la sélection des éléments empilés. Les candidats sont calculés au début du geste, le feedback suit les frames et seule la fin du geste crée une mutation et une étape Undo. Le snap est désactivé pour les cadres tournés ou mis à l’échelle ; leur drag existant reste disponible.
- **Desktop / Tablette / Mobile** indiquent discrètement leurs exceptions. Un réglage effectivement hérité indique **Héritée de Desktop** ou **Héritée de Tablette**. Consulter ces indications ne crée aucune propriété dans le draft.
- **Tester le responsive** mesure successivement les trois viewports logiques configurés, puis restaure le canvas et sa sélection. Il relève les débordements horizontaux réels, décalages importants hérités, espacements suspects avec débordement, petites zones cliquables, texte effectivement coupé et chevauchements nouveaux de feuilles en flux normal. Information / Attention / Problème distinguent les niveaux. Aucune retouche automatique et aucun audit complet à chaque frappe ou pixel de drag. Un changement rend le diagnostic obsolète et demande un nouveau test.
- **Prévisualiser une correction** propose, lorsqu’une largeur dépasse réellement, de la limiter à la largeur du parent. L’aperçu utilise la feuille temporaire existante, sans draft ni historique. **Appliquer** crée uniquement alors un override normal sur l’écran concerné ; **Ignorer**, **Annuler l’aperçu** et Échap le retirent. La correction est visible dans Modifications, annulable, sauvegardable et réinitialisable.
- **Fonds multicouches** : choisir la couche image à remplacer dans Contenu ou Assets. Le gradient, les autres URL, leur ordre, position, taille et répétition sont conservés. Le stockage contient uniquement l’index de couche et l’ID d’un média WordPress validé. Les URL sont résolues côté serveur ; aucun CSS libre n’est accepté. Les couches `image-set`, les pseudo-éléments et les couches après la vingtième restent sous contrôle du thème. Le cadrage individuel de chaque couche n’est pas encore proposé. Comme les contenus image existants, le remplacement est commun aux écrans ; une composition du thème qui change selon le breakpoint doit être vérifiée sur chaque écran, et une empreinte incompatible peut empêcher son application.
- **… → Mesurer** affiche à la demande largeur, hauteur, distances au parent et au voisin proche, dans le viewport logique. Ce sont des mesures du cadre visuel ; elles ne deviennent jamais des overrides.

L’édition du texte simple reste identique. L’étude [du texte inline riche](docs/inline-rich-content.md) précise les garanties nécessaires avant une évolution Selection/Range. Texte riche par sélection, édition de DIV, wireframe et nouveaux composants/effets sont volontairement reportés.

### Modules touchés et validation par étape

| Étape | Fichiers principaux | Raison et contrôles ajoutés |
| --- | --- | --- |
| Référence | rapports et checkpoint dans `artifacts/` | Suite complète avant modification, hashes de la base corrigée |
| Modifications | `review-changes.js`, `editor.js`, `editor.css` | Projection du draft, Voir/reset/confirmation/Undo |
| Naviguer | `editor.js`, `editor.css` | Guards des événements et navigation native ; draft/sélection conservés |
| Guides | `smart-guides.js`, `editor.js`, `editor.css` | Candidats bornés, snap CSS logique, Ctrl, preview et Undo |
| Indicateurs | `styles.js`, `editor.js`, `editor.css` | Origine des overrides et exceptions par écran |
| Audit | `responsive-guard.js`, `editor.js`, `editor.css`, fixture | Mesures sans mutation, restauration du viewport et diagnostics déterministes |
| Correction | `responsive-guard.js`, `editor.js`, `editor.css` | Aperçu temporaire, application explicite, Undo/save/refresh/public |
| Fonds | `background-layers.js`, `assets.js`, `selection.js`, `navigation.js`, `styles.js`, `runtime.js`, `class-schema.php`, `editor.js` | Remplacement ciblé et extension additive contrôlée du contenu |
| Mesure | `editor.js`, `responsive-guard.js` (compteur d’audit) | Mesures à la demande et profilage |
| Texte | `docs/inline-rich-content.md`, `tests/comfort-e2e.mjs` | Étude et verrouillage des garanties actuelles, sans nouveau renderer |

Les journaux `artifacts/comfort-stage-*.log` documentent les contrôles successifs : syntaxe, anciens tests unitaires, stabilisation/smoke, nouveaux parcours cumulés et suite historique concernée (viewport, largeur, foundations ou UX). La validation finale relance toutes les suites avec `npm run test:all`.

Lors de la release 0.4.0, les imports étaient versionnés en 0.4.0 pour éviter un mélange de modules en cache. Les métadonnées de cette release suivaient cette version ; la version installable actuelle est 0.4.2. Les tests unitaires de `tests/core.test.mjs`, les parcours `tests/comfort-e2e.mjs` et les runners `dev/cross-browser.mjs --comfort` et `--comfort-real-theme` couvrent les nouvelles fonctions. Le smoke critique ouvre, sélectionne, modifie, vérifie draft/dirty, annule, sauvegarde, recharge, quitte puis revient, avant chaque parcours de confort.

### Mesures et limites de l’audit

Le profilage est conservé dans `artifacts/profile-0.4-<moteur>.json` : propriété, prochain paint, ouverture froide/chaude de Structure et Assets, compteurs CSSOM/Runtime et audit. Il mesure cette machine et ce fixture, pas une promesse de vitesse universelle. Le graphe public des modules passe de 15 353 à 18 642 octets de source ; estimation gzip par module : 5 009 → 6 097 octets, soit environ 1,1 Ko de plus pour le support ciblé des fonds. Ce n’est pas une mesure HTTP. Aucun de ces modules n’est chargé sur une page sans retouches, et les outils d’édition restent absents du rendu visiteur. Les caches et mises à jour CSSOM de la 0.3.4 sont conservés ; aucun remaniement du Runtime n’a été nécessaire. Les guides ne font aucun scan global à chaque mouvement et l’audit reste déclenché à la demande.

Le responsive guard analyse au maximum 1 500 éléments et 20 frères significatifs par groupe, et présente jusqu’à 40 recommandations par écran, plus l’information de couverture lorsqu’un parcours est limité. Un site animé ou dynamique peut évoluer pendant les mesures. Les éléments absolus/fixes, fonds décoratifs et cas complexes ne permettent pas une analyse exhaustive des collisions ; les recommandations demandent une vérification humaine. La proposition `max-width: 100%` peut ne pas suffire face à d’autres contraintes du thème : l’aperçu permet de juger avant application. Une largeur fixe déjà contrainte n’est pas déclarée problématique sans débordement réel.

Le stockage version 1, REST/CAS, draft, Runtime, empreintes, sélection et historique restent les mêmes. Les seuls nouveaux contenus persistants sont les remplacements typés de couches de fond. Aucun thème source ni site en production n’est modifié.

### Validation finale 0.4.0 — 9 octobre 2026

**18 tests unitaires et 270 contrôles de parcours réussis** : les 231 contrôles historiques restent passants, 30 contrôles de confort et 9 contrôles supplémentaires du thème réel s’ajoutent sur Chromium, WebKit et Firefox. Syntaxe PHP/JS valide ; WordPress 7.1.3, PHP 8.5.10 et SQLite réellement servis. Le smoke critique, les pannes réseau, conflits, refresh, rendu public, responsive, Structure, Assets, alignement et espacement restent couverts. Les 191 fichiers du thème source sont inchangés. Aucun accès ni déploiement en production.

| Mesure sur le fixture local | Chromium | WebKit | Firefox |
| --- | ---: | ---: | ---: |
| Mutation de propriété, traitement JS synchrone | 1,1 ms | 2 ms | 2 ms |
| Première ouverture d’Assets | 5,2 ms | 8 ms | 5 ms |
| Réouverture d’Assets | 0,9 ms | 2 ms | 1 ms |
| Réouverture de Structure | 1 ms | 3 ms | 1 ms |
| Audit des trois écrans, temps écoulé avec attentes de rendu | 129 ms | 131 ms | 112 ms |

Ces échantillons ne démontrent pas une accélération par rapport à la 0.3.4 et ne sont pas des seuils universels. Les compteurs vérifient que la retouche ciblée utilise CSSOM, que le drag ne rend pas tout le document à chaque mouvement et qu’aucun audit ne part automatiquement. La durée de geste enregistrée dans le profil inclut le pilote de test et son attente explicite de 80 ms ; elle ne représente pas du temps CPU.

Rapport détaillé, hashes du checkpoint/source/ZIP, journaux par étape, profils et limites : `artifacts/validation-0.4.0.json`. Archive installable : `artifacts/visual-tweaks-0.4.0.zip`. La suite complète se relance avec `npm run test:all` lorsque les deux WordPress locaux sont démarrés.

## Stabilisation 0.3.4

La régression signalée en ligne provenait du blocage `recoveryPending` : un brouillon local différent de la sauvegarde empêchait toute mutation, même les flèches et le drag. L’état affichait pourtant « Enregistré » et le texte mêlait brouillon en attente et texte imbriqué. Le moteur de stockage n’était pas en cause.

Les deux bandeaux exacts ont été reproduits en servant les assets originaux de la 0.3.3 dans un navigateur isolé sur WordPress local, avec le backend actuel compatible : une retouche X de 1 px est conservée localement, puis le refresh laisse l’éditeur sur « Enregistré », sans appliquer le brouillon et sans autoriser une nouvelle retouche. Preuve : `artifacts/recovery-before-fix.json`. Le site en production n’a été ni inspecté ni modifié.

Un brouillon valide fondé sur **la même révision** est maintenant restauré automatiquement dans le vrai state, avec une étape Undo et « Modifications non enregistrées ». Un brouillon d’une autre révision ou contenant des valeurs refusées reste conservé avec une bande visible : récupération explicite, export ou retour à la sauvegarde. Les flèches et gestes expliquent ce blocage. Revenir à la sauvegarde rétablit aussi sa révision CAS ; l’export prend le brouillon en attente, jamais un document vide à sa place.

Un deuxième défaut a été reproduit en retardant l’initialisation du runtime : le seul callback `iframe.load` abandonnait les listeners lorsque le runtime était absent, sans reprendre ensuite. L’activation attend désormais le runtime du document courant (15 secondes maximum, puis erreur et **Réessayer**), masque la page pendant cette attente et réinstalle une seule fois les événements après un reload. Une erreur de découverte de navigation ne désactive plus le cœur d’édition. Une iframe ayant navigué vers une autre page est refusée pour préserver les retouches de la page initiale.

Diagnostic sans modifier le state : `window.VisualTweaksEditor.diagnostics()` indique phase, disponibilité, brouillon en attente, dirty, cible, révision, URL de frame et compteurs de navigation/rendu. `window.VisualTweaksViewport.diagnostics()` garde les mesures du viewport logique et de la géométrie. Les tests attendent désormais **editor ready**, et non seulement un runtime présent.

### Retouches et confort

- Panneaux gauche et droit indépendants ; × masque les propriétés sans désélectionner. Structure / Assets gardent leur sélection et leur scroll, issus du même nœud DOM que le canvas.
- Presets d’arrondi : Aucun, Léger, Arrondi, Très arrondi, Pilule ; **Personnaliser l’arrondi** donne la valeur précise. Presets d’espace intérieur/extérieur : Aucun, Petit, Moyen, Grand. Une action de preset constitue une seule étape d’Undo.
- **Actions de l’élément → Copier le style / Coller le style** copie les overrides effectifs de l’écran courant. Le contenu, la visibilité et le déplacement restent ceux de la destination. Le collage est annulable, se sauvegarde normalement et ne copie pas les valeurs calculées du thème.
- **Style du site** propose cinq couleurs nommées, les polices Titres / Texte et un arrondi / une ombre facultatifs. Cette palette est partagée entre les pages, stockée dans WordPress et possède une sauvegarde indépendante, un brouillon local, un export et sa propre révision CAS. Aucun chargement de police externe. Choisir une valeur de la palette crée un override littéral ; il n’existe pas encore de liaison dynamique entre tokens et éléments. Modifier la palette ne change pas automatiquement les anciennes retouches.

### Performances vérifiables

Structure et Assets conservent leurs vues et miniatures entre les ouvertures. Les changements de breakpoint n’imposent plus une reconstruction de Structure. La visibilité est mise en cache. Le `MutationObserver` surveille les éléments et attributs utiles, regroupe les changements pendant 200 ms et remet à jour les assets des sous-arbres concernés. Les feuilles SVG restent représentées par leur racine. La découverte de polices échantillonne 200 éléments et complète avec les polices déjà chargées dans `document.fonts`, sans provoquer le chargement de variantes pour les aperçus. Les familles génériques restent de vrais mots-clés CSS : **Police système** applique `system-ui`, sans guillemets.

Les réglages CSS ordinaires d’une cible existante mettent à jour ses règles dans la feuille centrale via CSSOM, y compris les translations héritées entre écrans. Les règles des autres éléments restent intactes ; la sauvegarde régénère le CSS lisible. Le renderer complet reste le fallback pour contenu, nouvelles cibles, zoom/overlay, reset structurel ou cible incohérente.

Le drag est limité à une prévisualisation par frame. Une feuille CSS temporaire ne cible que l’élément actif : ni REST, ni clonage complet des overrides, ni écriture locale, ni reconstruction de la feuille principale à chaque mouvement. `pointerup` normalise et finalise une seule mutation/histoire ; annulation et perte de capture retirent simplement la prévisualisation. Les mesures et valeurs restent en pixels CSS logiques, indépendantes du zoom.

Limites : un changement réel de structure peut encore reconstruire l’arbre ; les changements de contenu, nouvelles cibles, zooms d’image et cas incompatibles utilisent le renderer complet. Les dépendances CSS entre frères ou les feuilles chargées tardivement peuvent nécessiter **Actualiser** dans Assets. L’observer ne vise pas un framework dynamique complexe. Une virtualisation de l’arbre et un rendu serveur CSS/texte/image sont des évolutions séparées ; aucun contenu du thème n’est réécrit.

## Installation

Prérequis : WordPress 6.5+, PHP 8.1+, navigateur moderne prenant en charge les modules ES, Shadow DOM, `ResizeObserver`, `structuredClone` et la propriété CSS individuelle `translate`. Validation effectuée avec PHP 8.5.10 et Chromium / WebKit / Firefox (syntaxe PHP également vérifiée sous 8.3) ; la compatibilité avec les autres configurations reste à vérifier.

1. Dans WordPress : **Extensions → Ajouter une extension → Téléverser**, choisir `artifacts/visual-tweaks-0.4.2.zip`, puis activer.
2. Alternativement, copier uniquement le dossier `visual-tweaks/` dans `wp-content/plugins/` et activer l’extension.
3. Vérifier **Réglages → Visual Tweaks**. Le système est activé par défaut seulement si `WP_ENVIRONMENT_TYPE` vaut `local` ou `development`. Sans cette constante, WordPress se considère en production : activation explicite nécessaire.
4. Se connecter avec un compte possédant `manage_options`, afficher une page du site, puis cliquer **Édition visuelle** dans la barre WordPress.

Le thème doit appeler `wp_head()`, `wp_footer()` et permettre l’affichage de la barre d’administration. Aucun changement à vos sites existants n’est nécessaire pour tester ce projet.

## Banc d’essai autonome

Le dossier `dev/fixture-theme/` est un petit thème de test, avec un téléphone tourné, une translation déjà présente, des media queries et une image de médiathèque. La base et les uploads sont stockés dans `.local/`, séparément de vos autres projets. Rien n’est déployé.

Avec Node.js 24.18+ et npm :

```sh
npm install
npx playwright install chromium firefox webkit
npm run dev
```

Ouvrir **http://127.0.0.1:9410/**. Connexion de test : `vt-admin` / `vt-local-only-9410`. Compte abonné de test : `vt-subscriber`, même mot de passe. Ces comptes sont réservés à ce banc local. Le serveur utilise WordPress Playground, WordPress 7.1.2 demandé, PHP 8.3 demandé et SQLite. La version réellement servie est affichée dans le rapport de vérification quand disponible.

```sh
npm run check
npm test
npm run test:e2e
npm run test:viewport
npm run test:ergonomics
npm run test:stability
npm run test:speed
npm run test:polish
npm run test:comfort
npm run test:comfort-real-theme
npm run test:all
npm run package
```

Vérification de la 0.3.2, le 8 octobre 2026 : syntaxe PHP/JS valide, 13 tests unitaires et 108 vérifications de parcours réussies sur **WordPress 7.1.3 réellement servi**, PHP 8.5.10, SQLite, Chromium, WebKit et Firefox (66 parcours hérités sous Chromium, 33 contrôles du canvas et 9 contrôles du thème réel sur les trois moteurs). Les rapports de suites `artifacts/*-test-report.json` et les captures sont régénérés à chaque exécution : ils décrivent la dernière validation, pas forcément cette release historique. Les checkpoints et rapports agrégés versionnés conservent leurs références.

Pour utiliser un outillage déjà installé sans l’intégrer au projet : `VT_TOOLCHAIN=/chemin/projet` pour les scripts PHP/Playground, `VT_BROWSER_TOOLCHAIN=/chemin/projet` pour Playwright, `VT_CHROMIUM_PATH=/chemin/chromium` si nécessaire. Ce sont des chemins d’outillage de développement ; le ZIP du plugin n’a aucune dépendance Node.

Validation de la **0.3.3** : **13 tests unitaires et 174 contrôles de parcours réussis**, dont 63 contrôles d’ergonomie sur Chromium/WebKit/Firefox, 33 contrôles du canvas, 66 parcours hérités et 12 contrôles du thème réel isolé. Syntaxe PHP/JS valide ; les 191 fichiers du thème source sont inchangés. Détail : `artifacts/validation-0.3.3.json`.

Validation de la **0.3.4**, le 9 octobre 2026 : **14 tests unitaires et 231 contrôles de parcours réussis**. Les 174 contrôles précédents restent couverts ; 24 contrôles de stabilisation, 15 de performances et 18 de polish s’ajoutent sur Chromium/WebKit/Firefox. Le parcours obligatoire vérifie sélection → mutation → brouillon → dirty → Undo → sauvegarde → refresh → quitter/revenir, avec initialisation normale et runtime tardif. Pannes réseau, conflit, viewport logique, alignement, espacement, Structure, Assets, médiathèque et rendu anonyme restent testés. Syntaxe de 8 fichiers PHP et des modules JS valide ; WordPress 7.1.3/PHP 8.5.10/SQLite réellement servis. Le thème réel est testé sur une copie isolée ; les 191 fichiers originaux sont inchangés. Détail et empreintes de l’archive : `artifacts/validation-0.3.4.json`.

## Ergonomie 0.3.3

**Navigation à gauche**, **canvas au centre**, **propriétés à droite**. La navigation de 276 px se replie complètement avec **Navigation** ou × et contient uniquement **Structure / Assets**. Les propriétés s’ouvrent à la sélection, peuvent être masquées avec **Réglages** et disparaissent à la désélection. Les actions de page (sauvegarde, retour à la sauvegarde, export, reset) restent accessibles indépendamment des panneaux. Les messages occupent une bande stable pour ne pas déplacer les cibles lors d’une retouche. Le viewport logique du site reste indépendant des deux panneaux.

**Structure** partage la sélection DOM du canvas et des propriétés. Les parents s’ouvrent automatiquement ; la ligne active est amenée dans la zone visible avec le minimum de scroll nécessaire. Déplier un autre groupe et sélectionner à nouveau une ligne visible ne ramène pas la liste en haut. Survol, sélection, ascendants et éléments masqués sont distingués ; les types restent simples et les noms/id/classes sont secondaires. Les fonds de conteneurs n’empêchent plus de découvrir leurs enfants. La vue conserve son ouverture et son scroll dans la session, sans toucher au document d’overrides.

**Assets** inventorie les images HTML (dont les images actives de `picture/source`), les URL des fonds CSS résolus, chaque couche à URL, les SVG racines et les fonds des décors `::before` / `::after` effectivement générés. Aucun arrêt arbitraire à 200 visuels ou six niveaux. Les fichiers répétés sont regroupés avec leur nombre d’utilisations ; déplier pour choisir l’occurrence exacte. Chaque ligne indique sa zone, ses dimensions logiques, les actions de sélection/remplacement compatibles et sa source dans **Avancé**. Les miniatures SVG ne copient que des primitives autorisées ; les références `<use>` internes sont résolues avec une profondeur bornée, jamais les ressources externes, scripts ou `foreignObject`.

Sélectionner un asset fait défiler la page, active son cadre, ouvre ses propriétés et synchronise Structure. Un décor de pseudo-élément sélectionne son bloc propriétaire, avec une information explicite : **son remplacement individuel reste réservé au thème**. Depuis la 0.4.0, les couches URL simples peuvent être remplacées individuellement sans supprimer les autres couches. **Actualiser** réanalyse les éléments ajoutés ou chargés dynamiquement. Les dimensions des décors sont celles du bloc propriétaire ; elles ne prétendent pas mesurer séparément la boîte du pseudo-élément.

**Aligner l’élément** et **Aligner le contenu** sont séparés. Le bouton rapide **Centrer** et les directions de la toolbar inspectent le contexte : marges automatiques en flux classique, alignement dans la cellule grid, axe transversal flex ou marges automatiques pour un élément seul sur l’axe principal ; disposition des enfants flex/grid ou alignement du texte pour le contenu. Aucun centrage n’utilise `translate`. **Déplacer** reste une finition locale indépendante.

Dans le flux classique, centrer une image en ligne lui ajoute seulement `display: block`. Un bouton/lien en ligne reçoit également `width: fit-content` pour garder une largeur adaptée à son contenu. Ce sont des overrides explicites issus de la commande, annulables et réinitialisables ; aucune largeur mesurée n’est ajoutée automatiquement. Le contrat PHP/JS autorise désormais **uniquement** `display: block`, `width: fit-content` et les valeurs d’alignement énumérées nécessaires. Il n’accepte toujours pas de CSS libre. Les blocs absolus/fixes, l’axe principal d’un groupe flex à plusieurs enfants, les éléments qui remplissent tout l’espace et le centrage vertical en flux classique reçoivent une explication plutôt qu’une mutation sans effet. Aucune section n’est convertie arbitrairement en flex. Le raccourci **Centrer le texte** aligne le contenu d’un texte en bloc ; un texte en ligne sans cadre reçoit une explication demandant de choisir son bloc parent, y compris depuis les réglages typographiques.

**Espacement** distingue espace extérieur, intérieur et entre éléments (ce dernier uniquement pour flex/grid). Les côtés liés sont validés et appliqués ensemble, en une étape d’historique. Marges négatives et zéro sont acceptés ; espaces intérieurs et gap négatifs sont refusés. Les valeurs du thème restent des indications et ne deviennent jamais des overrides par sélection, ouverture de panneau ou changement d’écran.

**Réinitialiser Position / Espacement / Alignement** supprime les propriétés correspondantes dans le mode actif ; les modes supérieurs reprennent la main par héritage. Le reset d’alignement retire aussi les paires de marges automatiques/zéro, les marges de l’axe transversal flex et l’adaptation de bouton utilisées par ces commandes, tout en conservant une marge numérique isolée ; ces marges sont les mêmes propriétés que l’espace extérieur, pas une deuxième couche cachée. Les autres dimensions, couleurs et décalages restent conservés. Le reset complet de l’élément reste disponible.

`npm run test:ergonomics` exécute les parcours sur Chromium, WebKit et Firefox : sélection bidirectionnelle, arbre profond/scroll, assets et miniatures, géométrie réelle des alignements, explications des commandes impossibles, espacement lié/individuel, historique, desktop/tablette/mobile, sauvegarde/refresh et frontend anonyme. Il couvre aussi le double-clic sur un texte lorsque l’ouverture des propriétés modifie le zoom visuel. Rapports et captures : `artifacts/ergonomics-<moteur>-report.json` et `.png`. Sauvegarde préalable : `artifacts/backups/visual-tweaks-0.3.2-before-navigation-alignment.tar.gz`.

## Canvas logique 0.3.2

L’iframe possède son propre viewport CSS : **1440 px** par défaut, **820 px** sur tablette, **390 px** sur mobile. Sa hauteur logique suit `window.innerHeight` du navigateur ; elle n’est pas réduite par les commandes de Visual Tweaks. La sidebar, la toolbar et le redimensionnement de la fenêtre changent seulement le zoom affiché. **Adapter** réduit visuellement le canvas pour qu’il tienne dans la zone disponible ; **100 %** garde son échelle réelle et permet de faire défiler le canvas horizontalement. Le zoom ne devient jamais un override du site. Sous WebKit, certains événements pointer sont quantifiés au pixel écran : les tests de drag vérifient le déplacement logique correspondant aux événements réellement reçus (traces dans les rapports), plutôt que d’exiger une fraction de pixel écran que le moteur n’a pas émise. Les flèches clavier restent exactement à 1 / 10 pixels CSS.

Les presets Desktop proposent 1280 / 1440 / 1600 / 1920 px, une largeur personnalisée et **Fenêtre actuelle**, capturée avant la création de l’interface (`document.documentElement.clientWidth`). La valeur par défaut est configurable dans **Réglages → Visual Tweaks**. Le choix temporaire dans l’éditeur ne modifie pas les retouches de la page. Le mode actif détermine le groupe d’overrides ; le zoom affiché ne décide jamais d’un breakpoint.

`assets/viewport.js` centralise les dimensions, le fit, la conversion des points et les diagnostics. Les événements provenant de l’iframe sont déjà exprimés en pixels CSS logiques ; ceux des poignées dans l’interface sont convertis en divisant par le zoom. Les transformations existantes des éléments restent prises en compte par `geometry.js`. Les outlines, poignées et toolbar utilisent la conversion inverse. Le point focal du panneau demeure dans les coordonnées du panneau, et le cadrage direct dans celles de l’iframe. Les flèches restent à 1 / 10 pixels CSS.

Le canvas `vt-frame=1` conserve l’authentification, mais WordPress ne lui ajoute plus sa barre d’administration, la classe `admin-bar` ou le décalage HTML associé. La sécurité REST, les nonces, les capabilities, les brouillons et la sauvegarde atomique sont conservés. Une preview authentifiée peut encore différer du contenu anonyme si un thème/plugin affiche du contenu spécifique à l’utilisateur, bloque les iframes ou utilise une logique spéciale en iframe. L’éditeur ne réécrit pas ces conditions.

**Comparer le rendu** affiche temporairement le viewport logique, les largeurs internes/client, le zoom, les media queries inspectables et les boîtes logique/affichée de la sélection. Les stylesheets cross-origin ne sont pas inspectables. Les mesures attendent le chargement des polices avant les comparaisons de tests ; les cadres sont actualisés après `document.fonts.ready`. **Réinitialiser ce réglage** enlève uniquement la propriété explicite du mode actif ; **Réinitialiser les réglages de cet écran** enlève le groupe courant, en laissant son héritage ; **Réinitialiser cet élément** retire toutes ses retouches et son contenu remplacé. Aucun ancien CSS n’est reconstruit.

La suite légère `npm run test:viewport` vérifie Chromium, WebKit et Firefox : navigation complète à 1440 malgré une zone disponible inférieure à 1200, géométrie 400/100, fit/100 %, coordonnées, nudge, drag, resize, cadrage, responsive, sauvegarde/refresh, rendu anonyme, transformations et resets. Rapports et captures : `artifacts/viewport-<moteur>-report.json` et `.png`.

Un second WordPress local sur **9411** contient une copie isolée du thème PHP réel **Kevin Legros**, avec ses assets et ses polices locales. Les sources du projet existant ne sont pas modifiées. Pour reproduire ce contrôle avec votre thème, copier un thème de confiance dans `.local/real-theme/kevin-legros/`, adapter le nom dans `dev/real-theme-blueprint.json` et le montage de `dev/real-theme-server.mjs`, puis lancer `npm run dev:real-theme` et `npm run test:real-theme`. Base/uploads séparés ; aucun déploiement. La version de **L’Énergie des Runes** des captures ne dispose pas de staging accessible et n’a pas été modifiée ni validée en production. Les rapports du thème réel isolé sont `artifacts/real-theme-<moteur>-report.json`.

## Correctif 0.3.1 : contrat des dimensions

Rejet reproduit sous WordPress : la poignée d’une zone en `content-box` fractionnaire envoyait `"width": "167.10899999999998px"` (chaîne, desktop), refusé en HTTP 400 par `Schema::value` qui limite les longueurs à quatre décimales. Le chemin de redimensionnement contournait le validateur des champs et soustrayait une largeur CSS fractionnaire d’un `offsetWidth` arrondi. Le payload, les mesures et la règle sont conservés dans `artifacts/width-before-fix.json`. Ce scénario démontre un défaut de la 0.3.0 ; le brouillon du site signalé par l’utilisateur n’a pas fourni sa largeur exacte.

Les dimensions des gestes sont maintenant mesurées avec le modèle de boîte CSS (bordures et espaces intérieurs), normalisées puis validées ensemble avant d’entrer dans les overrides. Le serveur conserve sa liste blanche : aucun CSS arbitraire n’est accepté. Les champs acceptent px, %, rem, em, vw, vh, zéro ; `auto` pour largeur/hauteur/marges et `none` seulement pour largeur maximale. Les nombres sans unité saisis explicitement deviennent des pixels, les décimales sont arrondies à quatre chiffres. Vider un champ supprime sa retouche.

Les valeurs calculées du thème restent des indications dans les champs. Sélectionner, ouvrir un panneau ou changer de breakpoint ne les persiste jamais. Les largeurs `fit-content`, `max-content`, `min-content`, `calc(...)` et `clamp(...)` du thème restent intactes quand on change seulement une couleur ou une position ; elles ne sont jamais copiées automatiquement. À partir de la 0.3.3, le mot-clé contrôlé `fit-content` est aussi autorisé comme override explicite pour l’adaptation d’un bouton lors du centrage ; les expressions CSS libres restent refusées.

Une longueur numérique déjà présente dans un ancien brouillon est normalisée lors de sa récupération, sans inventer de propriété supplémentaire. Une valeur irrécupérable (`NaNpx`, objet au lieu d’une chaîne, etc.) est conservée : la sauvegarde indique l’élément, la propriété et le breakpoint à corriger. Aucune propriété invalide n’est supprimée silencieusement et aucun document partiel n’est sauvegardé.

`tests/width-e2e.mjs` vérifie les payloads REST réels, la validation PHP/JavaScript, les vues desktop/tablette/mobile, l’historique, le rendu public, les rafraîchissements et les anciens brouillons. Le rapport est `artifacts/width-test-report.json`.

## Utilisation

- **Cliquez sur un élément** : ses actions principales apparaissent à côté. La navigation à gauche sert à retrouver un élément ; le panneau **Réglages** à droite, visible uniquement à la sélection et repliable, propose Contenu, Taille et position, Espacement, Style, Texte et Responsive. Les informations techniques restent dans **Réglages avancés**.
- **Modifier un texte** : double-cliquer ou choisir **Modifier**, puis écrire dans la page. **Terminer** valide l’édition ; Échap annule cette session de texte et de style. Gras, italique, police, taille, couleur et alignement sont accessibles dans la barre contextuelle. Une session forme une seule étape d’historique.
- Le texte reste du texte brut, y compris au collage : aucun HTML n’est exécuté. Seules les balises texte autorisées sans enfants HTML sont modifiables (`p`, titres, `span`, `a`, `button`, `li`, `small`, `strong`, `em`, `figcaption`). Les DIV et contenus imbriqués ne sont pas éditables. Les styles s’appliquent à l’élément entier, pas à une sélection de mots. Le lien d’un élément `<a>` existant est modifiable avec une adresse autorisée ; aucun lien imbriqué n’est créé.
- **Déplacer** : glisser un asset déjà sélectionné, ou la poignée de déplacement. Les flèches du clavier déplacent de 1 px, Maj + flèche de 10 px ; elles restent inactives dans les champs et la saisie inline. La barre **Déplacer** propose quatre boutons et un pas de 1/5/10 px. Les frappes rapprochées forment une étape d’historique, clôturée après 550 ms sans déplacement. Les décalages s’ajoutent au thème sans imposer de position absolue. Les transformations 2D des parents sont prises en compte ; les effets 3D sont refusés pour les gestes directs. Le glissement nécessite des décalages en px.
- **Redimensionner** : glisser une poignée de coin. Les images gardent leurs proportions ; Shift libère le ratio, également réglable dans le panneau. Le coin opposé reste ancré pour les transformations 2D. Échap annule un geste en cours. Des champs permettent toujours de saisir une valeur exacte ; un nombre seul devient une valeur en pixels.
- **Espacement** : représentation des quatre côtés pour l’espace extérieur et intérieur, avec possibilité de lier les valeurs. Alignement et espace entre éléments apparaissent pour les groupes compatibles.
- **Assets** : inventaire des images, images adaptatives (`picture`/`source` ciblent leur `img`), logos, SVG racines et fonds CSS. Miniature, nom, zone et dimensions ; source dans **Avancé**. **Sélectionner** fait défiler la page et ouvre les réglages, y compris pour un asset recouvert. **Actualiser** réanalyse les éléments chargés dynamiquement. Un élément masqué reste sélectionnable, avec un avertissement sur son absence de cadre visible.
- **Structure** : arborescence de sélection légère, sans déplacement du DOM. **Alt/Cmd + clic** propose les éléments empilés sous le pointeur.
- **Images** : **Remplacer** ouvre la médiathèque WordPress. **Recadrer** permet de glisser l’image dans son cadre ; un point de positionnement et les choix Couvrir / Contenir / Taille réelle restent disponibles. Le cadrage devient visible quand l’image déborde de son cadre ; le fichier original reste intact. Un zoom 100–180 % est disponible pour les fonds CSS et, lorsque le navigateur le prend en charge, les images via `object-view-box`. Une image dans `<picture>` utilise le remplacement unique en neutralisant temporairement ses sources.
- **Apparence** : fond, couleur, bordure, arrondi, opacité, ombres Aucune/Légère/Moyenne/Forte ou personnalisées par champs contrôlés, et flou léger. Les fonds à image remplaçable peuvent recevoir un voile de couleur avec intensité. Il concerne la composition de fond entière.
- **Fonds CSS** : remplacement par médiathèque, Couvrir / Contenir / Taille réelle, point focal et glissement dans le cadre. La zone et ses enfants restent en place. Pour les fonds multicouches, choisir la couche URL simple à remplacer : les gradients, autres URLs et leurs réglages restent conservés. `image-set`, pseudo-éléments et couches d’index supérieur à 19 restent inventoriés mais non remplaçables. Le cadrage s’applique à la composition entière, pas indépendamment à chaque couche.
- **Couleurs** : sélecteur natif, hex, couleurs détectées sur la page, couleurs récentes et personnelles. Les favoris sont locaux au navigateur et au compte ; ils restent indépendants de la palette facultative **Style du site** sauvegardée dans WordPress.
- **Polices** : polices détectées sur le site et quelques familles système, présentées dans leur police. Aucune police externe n’est ajoutée. Les familles web non chargées sont exclues des aperçus ; les familles génériques (Police système, Sans empattement, etc.) utilisent les mots-clés CSS corrects, sans guillemets. Taille, graisse, italique, interligne, espacement et casse restent personnalisables.
- **Desktop / Tablette / Mobile** : boutons visuels en haut. Un point indique des overrides spécifiques à cet écran ; les champs personnalisés portent un indicateur. Les valeurs héritées sont identifiées par leur écran d’origine. Une valeur vide retrouve l’héritage.
- **Modifications** liste les overrides existants, sans état supplémentaire. **Voir** sélectionne l’élément dans le canvas et Structure ; **Réinitialiser** retire ses overrides de tous les écrans, avec Undo. Le reset de toute la page demande confirmation.
- **Modifier / Naviguer** permet de tester les interactions du site puis de revenir à sa sélection et son brouillon. Les liens vers une autre page et les formulaires classiques ouvrent un nouvel onglet ; les scripts personnalisés peuvent encore provoquer une navigation. Utiliser une page de test pour les interactions métier.
- **Guides** : le drag approche les bords/centres du parent ou les centres voisins avec un snap de 4 pixels CSS logiques. Maintenir **Ctrl** suspend le snap ; Alt/Cmd conserve la sélection des éléments superposés.
- **Tester le responsive** analyse les trois viewports à la demande, sans mutation. **Prévisualiser une correction** ne crée aucun override ; **Appliquer** est explicite et annulable. Une nouvelle retouche rend le rapport obsolète. Les petites zones cliquables sont des recommandations, pas des erreurs absolues.
- **… → Mesurer** affiche temporairement les dimensions et distances du cadre logique sans créer de retouche.
- **Annuler/Rétablir** : boutons, Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z. Dans un champ, ces raccourcis restent ceux du navigateur. Cmd/Ctrl+S enregistre. Échap désélectionne.
- **Enregistrer** confirme **Enregistré** après **Modifications non enregistrées** et écrit tout le brouillon de cette page en une seule opération atomique. Une retouche affiche immédiatement son résultat, mais reste un brouillon jusqu’à l’enregistrement. Les retouches faites pendant une requête de sauvegarde restent à enregistrer.
- **Réinitialiser cet élément** / **Réinitialiser la page** enlèvent les overrides dans le brouillon ; enregistrer pour persister le reset. L’historique reste disponible pendant la session, y compris après sauvegarde.
- **Revenir à la sauvegarde** restaure le dernier état enregistré ; ce retour est lui-même annulable.
- **Exporter le brouillon JSON** fournit les cibles, empreintes, breakpoints et propriétés. Il prépare la future intégration au thème avec Codex, sans appeler d’IA.

Un brouillon est conservé dans `localStorage`, isolé par origine, compte et page. Après rechargement, un brouillon valide de même révision revient automatiquement. **Récupérer le brouillon local** reste nécessaire pour une révision divergente ou des valeurs refusées. Une version ancienne reste exportable mais ne peut pas écraser une version plus récente. Si le stockage local échoue, un message le signale ; quitter avec des retouches déclenche un avertissement. Les brouillons peuvent contenir le texte de votre page : les supprimer via le navigateur si nécessaire.

## Responsive centralisé

L’éditeur affiche la même page WordPress dans une iframe de même origine, avec ses vrais scripts et media queries. Le canvas est zoomé autour de l’iframe ; sa taille affichée ne modifie pas le viewport CSS. Il ne simule pas le mobile en réduisant simplement un conteneur.

| Mode | Aperçu | Application des overrides |
| --- | --- | --- |
| Desktop | viewport logique 1440 px par défaut, configurable | base commune à toutes les largeurs |
| Tablette | 820 px | exceptions à `max-width: 1023px` |
| Mobile | 390 px | exceptions à `max-width: 767px` |

Une valeur vide enlève l’exception du mode courant. Mobile hérite de Tablette puis de Desktop ; sans override, le CSS du thème s’applique. Les décalages X/Y héritent indépendamment. Le moteur produit au maximum deux media queries pour toute la page. Ces seuils sont fixes dans ce MVP ; adapter ultérieurement les constantes centralisées PHP/JS si votre thème utilise d’autres seuils.

## Identification des cibles

Ordre de préférence :

1. `data-vt-id="hero-phone"`, unique dans la page, alphabet `A-Z a-z 0-9 _ -`.
2. `id` unique compatible avec un sélecteur simple.
3. Balise + une à trois classes stables si cette combinaison est unique.
4. Chemin court, limité à cinq niveaux, éventuellement ancré sur un id et utilisant `nth-of-type` seulement si nécessaire. Refus si aucune cible unique n’est trouvée.

Les classes d’état (`is-*`, `has-*`, active, focus, hover…) ne servent pas d’ancrage. Chaque cible conserve une empreinte : balise, classes stables, identifiant s’il existe, texte d’origine pour les feuilles, src d’origine pour les images. Le runtime exige un seul résultat et une empreinte compatible ; une cible absente ou modifiée est ignorée et signalée dans l’éditeur. Il ne cherche pas un élément « ressemblant » ailleurs.

Sur un thème que vous contrôlez, `data-vt-id` est recommandé. Les sélecteurs CSS et empreintes ne peuvent pas garantir l’identité d’un composant après une réécriture du DOM : deux blocs strictement identiques sont notamment difficiles à distinguer. Changer le texte/src original ou les classes peut rendre un override inapplicable ; exportez les données puis réidentifiez l’élément. Pas de sélection dans les iframes tierces, Shadow DOM du site, pseudo-éléments ou paths SVG individuels. Le clic sur un path sélectionne son SVG racine. Les éléments apparus après l’initialisation peuvent être inventoriés avec **Actualiser**, mais les overrides ne sont pas continuellement réappliqués après chaque reconstruction du DOM. `data-vt-ignore` exclut une zone de la sélection.

## Architecture

```text
visual-tweaks/
  visual-tweaks.php             bootstrap WordPress
  includes/class-plugin.php    accès, barre admin, REST, réglages, chargement
  includes/class-schema.php    schéma, validation stricte, assets WordPress
  includes/class-store.php     stockage par page, compare-and-swap atomique partagé
  includes/class-site-style.php palette globale facultative, validation et API privée
  assets/runtime.js            résolution, application/restauration des overrides
  assets/gesture-preview.js    prévisualisation CSS ciblée, chargée uniquement par l’éditeur
  assets/style-patcher.js      mises à jour CSSOM ciblées avec fallback sur le renderer
  assets/selection.js          identification, empreintes, picture et SVG racine
  assets/assets.js             découverte des visuels, arbre DOM et miniatures SVG sûres
  assets/navigation.js         vues/index/caches Structure/Assets, observer, sélection fournie par l’éditeur
  assets/site-style.js         palette globale, dialogue et brouillon local indépendant
  assets/alignment.js         commandes sémantiques et groupes de reset
  assets/state.js              normalisation des cartes de réglages historiques
  assets/styles.js             CSS et héritage responsive centralisés
  assets/history.js            historique immuable et borné
  assets/validation.js         validation des champs avant prévisualisation
  assets/inline-editor.js      saisie directe sécurisée et transaction de texte
  assets/contextual-toolbar.js barre contextuelle et popovers
  assets/appearance-controls.js couleurs et découverte des polices
  assets/geometry.js           déplacement et resize dans les transformations 2D
  assets/viewport.js           viewport logique, fit et conversions de coordonnées
  assets/review-changes.js     projection des overrides et actions Voir/reset
  assets/smart-guides.js       candidats locaux et guides transitoires de drag
  assets/responsive-guard.js   diagnostic dérivé, aperçu et application explicite
  assets/background-layers.js lecture des couches et remplacement URL ciblé
  assets/editor.js             orchestration, panneau, iframe, médiathèque, sauvegarde
  assets/light-mode.js         édition allégée : animations du thème ralenties dans l’aperçu
  assets/editor.css            interface isolée par Shadow DOM
  includes/editor-host.php     document hôte de l’éditeur (styles, médiathèque, éditeur)
```

Les options `vt_page_<sha256>` ne sont pas autoloadées. Un document par URL relative contient `schemaVersion`, `page`, `revision`, `elements`, `updatedAt`, `updatedBy`. Les paramètres d’édition et de tracking sont retirés ; les autres paramètres sont triés et conservés, afin de distinguer par exemple `/?etude=...`. Limites : 200 cibles/page, 300 Ko/requête, 80 snapshots d’historique en mémoire.

```json
{
  "schemaVersion": 1,
  "page": "/",
  "revision": 3,
  "elements": [{
    "id": "hero-phone",
    "selector": "[data-vt-id=\"hero-phone\"]",
    "strategy": "data",
    "fingerprint": {"tag": "img", "classes": ["hero-phone"], "anchor": "hero-phone", "src": "/phone.png"},
    "changes": {"desktop": {"translateY": "-25px"}, "mobile": {"translateY": "12px"}},
    "content": {"attachmentId": 42}
  }]
}
```

Pour un fond multicouche, l’extension additive du contenu est `"content": {"backgroundLayers": [{"layer": 1, "attachmentId": 42}]}` : index CSS à partir de zéro, unique et borné de 0 à 19. Les autres couches restent des styles du thème ; elles ne sont pas copiées dans le document d’overrides. La réponse REST hydrate chaque média avec son URL/alt validés par WordPress. Les anciennes images et retouches restent compatibles.

Les URLs d’images sont résolues côté WordPress depuis les IDs de médiathèque. Aucun CSS brut, JavaScript, HTML interprété ou URL d’asset arbitraire n’est accepté par l’API. Les routes GET/PUT exigent `manage_options`, système actif et nonce REST. Un UPDATE conditionnel sur l’ancienne valeur sérialisée protège la sauvegarde ; une insertion unique protège la première sauvegarde concurrente. Conflit HTTP 409 : conserver/exporter le brouillon, recharger la page actuelle, réappliquer les changements souhaités. Il n’y a pas de fusion automatique de révisions divergentes. Restaurer un brouillon de même révision n’est pas une fusion de conflit.

Le runtime ajoute seulement des marqueurs temporaires `data-vt-target` aux cibles vérifiées et une feuille `<style id="vt-generated-styles">` lisible. Aucun attribut `style` persistant n’est ajouté aux éléments du site. L’interface utilise ses propres styles transitoires pour ses cadres et son iframe.

## Visiteurs, performance et arrêt

Les **réglages enregistrés** sont visibles dans le rendu public lorsque le plugin est actif. L’**interface et les brouillons** sont réservés aux administrateurs en mode édition. Aucun script de l’éditeur ni configuration nonce n’est envoyé aux visiteurs. Aucun script Visual Tweaks n’est chargé sur une page sans retouches. Sur une page retouchée, seul le petit runtime et les données nécessaires à cette page sont chargés.

Les prévisualisations administrateur reçoivent des en-têtes `private, no-store` et `DONOTCACHEPAGE`. Le cache/CDN/hébergement doit aussi exclure les sessions connectées et les URLs `vt-edit` / `vt-frame`. Les caches publics déjà remplis doivent être purgés après sauvegarde ; le MVP n’intègre pas d’API de purge propre à chaque fournisseur.

Arrêt complet : désactiver dans **Réglages → Visual Tweaks**, désactiver l’extension, ou définir `VISUAL_TWEAKS_DISABLED` à `true` dans la configuration WordPress. Le runtime, les overrides et l’éditeur cessent alors de s’appliquer. Les données restent conservées pour une réactivation ; désinstaller ne purge pas automatiquement vos retouches.

## Limites et prochaines étapes

- Aucun changement structurel du DOM, PHP, logique métier ou système d’animation. Pas de déplacement entre sections.
- L’inventaire ne traverse pas les shadow roots ni les iframes tiers. Il découvre les URL CSS (y compris `image-set` lorsqu’il contient des `url(...)`), pas les gradients seuls ni les dessins canvas. Les SVG à filtres/masques complexes peuvent avoir une miniature simplifiée ; les sprites externes ne sont pas chargés. Un SVG se retouche mais ne se remplace pas. Pseudo-éléments et image-set sont inventoriés mais restent non remplaçables ; les couches URL simples des fonds se remplacent individuellement.
- Les gestes directs traitent les transformations 2D et le zoom, mais pas la perspective/3D. Les éléments animés, tailles contraintes par le thème et mises en page complexes demandent des vérifications visuelles. Un redimensionnement impose une largeur/hauteur explicite au breakpoint courant.
- Les overrides gagnent via `!important`. Un style inline du thème lui-même `!important` peut prendre le dessus. Les animations de `translate` et translations 3D ne sont pas traitées ; les transformations `transform` classiques sont conservées.
- Les textes sont limités par l’API à 4 000 octets UTF-8 ; l’interface compte les unités de chaîne JavaScript. Un texte long accentué peut donc être refusé avant la limite affichée ; le brouillon reste conservé. Ce contrat n’est pas élargi dans cette passe.
- Texte/images appliqués côté client : ils ne modifient pas la source PHP/WordPress, le HTML serveur, les métadonnées SEO ou les exports du thème. Un bref affichage du contenu original reste possible avant le runtime.
- En édition, la page du thème n’est rendue que dans l’iframe (depuis la 0.4.5, le document hôte de l’éditeur ne contient ni gabarit ni script du thème) ; elle requiert une politique CSP compatible avec les frames de même origine. En mode Modifier, la navigation et les formulaires sont bloqués ; en mode Naviguer ils fonctionnent avec ouverture externe pour une autre page. Les scripts du thème s’exécutent : cette version vise les pages de développement statiques, pas les applications avec effets métier au chargement.
- Pas de CSS libre (`calc`, `var`, gradient, `url`), pas de système typographique complet, pas de gestion globale des retouches de plusieurs pages, pas d’import JSON ni de journal durable multi-session.
- Compatibilité vérifiée sur WordPress Playground/SQLite, Chromium/WebKit/Firefox, le fixture et une copie locale isolée du thème Kevin Legros. MySQL/MariaDB et autres thèmes/plugins nécessitent leur propre validation. Le cache navigateur et un cache HTTP local contrôlé sont testés ; les caches WordPress tiers et CDN réels restent non testés ; aucun test ni déploiement en production.

La 0.4 reste une surcouche de retouche : effets et composants restent reportés. L’API et le schéma version 1 sont conservés ; les retouches précédentes restent utilisables. Sauvegardes des bases 0.3.3 et 0.3.4 conservées dans `artifacts/backups/`.

### Correction de sauvegarde démontrée

Après une sauvegarde de contenu seul, PHP sérialisait `changes` (ou un breakpoint vide) comme `[]`. Le JavaScript y ajoutait des clés qui fonctionnaient en prévisualisation mais que `JSON.stringify()` omettait. La requête réussissait avec HTTP 200 : ces propriétés n’étaient pas dans le payload, ni dans WordPress. Le nonce et le compare-and-swap n’étaient pas responsables de ce défaut.

La réponse PHP conserve maintenant ces groupes comme objets JSON ; l’éditeur normalise aussi les anciennes données et brouillons. Il confirme l’état canonique renvoyé par WordPress et préserve les changements faits pendant la requête. Un échec apparaît au-dessus de la page, même si les réglages sont masqués. Le brouillon reste localement conservé ; un conflit 409 reste explicite et exportable, sans écrasement automatique.

`tests/save-e2e.mjs` reproduit la sauvegarde de texte seul, le refresh, l’ajout de taille et de texte, puis vérifie le payload, la lecture REST, « Enregistré », le refresh, quitter/revenir et le rendu anonyme. Il teste également panne réseau, modification pendant une sauvegarde et conflit. Diagnostic avant correction : `artifacts/save-contract-before-fix.json` ; après : `artifacts/save-contract-diagnostic.json`.

Les fonds simples enregistrent un ID de médiathèque contrôlé et un type d’asset ; les remplacements multicouches utilisent la liste typée `backgroundLayers` (index de couche et ID média). Aucun CSS ou HTML utilisateur n’est stocké. Le runtime génère les styles, vérifie l’empreinte du fond original et résout l’URL côté WordPress.

Prochaines étapes, volontairement non implémentées :

- Effets futurs : presets d’effets respectant `prefers-reduced-motion`, liaisons dynamiques aux rôles de couleurs/polices et seuils responsive configurables.
- Composants futurs : palette **+ Ajouter** et composants possédés par Visual Tweaks. Prévoir des enregistrements typés (`id`, `type`, `content`, `styles`, `animation`, zone d’insertion), des zones explicitement compatibles et un rendu serveur contrôlé. Aucun HTML arbitraire ; duplication/suppression uniquement de ces composants. Ne pas assimiler les overrides actuels à des composants ajoutés.
- Ensuite : composants dynamiques, journal durable, purge de cache extensible et transfert explicite des overrides au thème avec Codex.

Références WordPress utilisées : [routes REST et contrôles de permission](https://developer.wordpress.org/rest-api/extending-the-rest-api/routes-and-endpoints/), [médiathèque native](https://developer.wordpress.org/reference/functions/wp_enqueue_media/).
