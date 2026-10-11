# Visual Tweaks 0.4.4 — fluidité de l'éditeur, conservation, publication — 11 octobre 2026

Passe ciblée sur l'extension autonome (`~/Documents/ChatGPT/Visual Tweaks`). Ce n'est pas un nouvel audit du site.

**Rien n'est déployé.** La production reste en 0.4.3 : vérifiée le 11/10, identique octet pour octet au code source de référence.

## 1. Référence et protection des données

**Sauvegardes**, dans `sauvegardes/`, empreintes dans `SHA256SUMS-sauvegardes` :
- `production-visual-tweaks-0.4.3.tar.gz` : dossier de l'extension en production. Identique au ZIP 0.4.3 (`diff -r`).
- `visual-tweaks-0.4.3.zip` : archive de retour arrière.
- `source-visual-tweaks-0.4.3.tar.gz` : projet source avant modification.
- `production-options-vt.json` : export brut de toutes les options `vt_*`. Chaque valeur sérialisée est gardée octet pour octet (base64), avec son empreinte, sa révision et son nombre d'éléments.

**Données de production au 11/10**
- `vt_page_…` (page `/`) : révision 22, 2 éléments (bande du lieu, logo), mise à jour le 09/10.
- `vt_enabled` : 1.
- Pas de `vt_site_style`, pas de `vt_desktop_width`.

**Restauration éprouvée** sur un WordPress local jetable (`outils/restaurer-options-vt.php`). Dans un état dégradé (retouche effacée, révision 99, style du site ajouté), la simulation signale les écarts sans écrire. L'application :
- copie d'abord l'état courant ;
- restaure 2 options sur 2, avec la même empreinte que la production ;
- laisse intacte l'option absente de l'export.

**Brouillons** : ils vivent dans le stockage local du navigateur de Kevin, pas sur le serveur, donc hors de portée d'une sauvegarde serveur. Les exporter depuis l'éditeur avant toute installation ; la 0.4.4 relit ceux de la 0.4.3 tels quels.

**Mécanismes identifiés**
- **Navigation entre pages** : rechargement complet de l'éditeur, une clé de brouillon par page et par utilisateur, avertissement avant de quitter.
- **Sauvegarde** : PUT REST avec la révision ; la base n'écrit que si cette révision est toujours la dernière (409 sinon).
- **Historique** : 80 états en mémoire.
- **Publication** : options `vt_page_*`, sans purge avant cette version.
- **Rendu public** : CSS serveur (0.4.3) puis runtime à 4 modules.
- **Style du site** : palette de l'éditeur seulement, jamais rendue côté public.

## 2. Fluidité de l'éditeur

Banc : WordPress local (Playground) avec le thème réel et les retouches de production, Chromium, CPU ×4. Médianes de 3 répétitions par action, dans la même session. Outils : `outils/mesure-editeur.mjs`, et `outils/trace-editeur.mjs` pour l'attribution des mises en page forcées par fonction.

**Causes mesurées (0.4.3)**
- **Défilement avec une sélection** : chaque événement `scroll` relance `updateOutline`, qui alterne lectures de géométrie et écritures de style, soit environ 13 recalculs forcés par événement. Les rectangles du cadre et de la scène étaient relus après chaque écriture, jusque dans la boucle des poignées.
- **Changement d'écran** : `Navigation.paintTree` lit la visibilité (cadre) puis écrit la ligne (éditeur), ligne par ligne : une mise en page forcée par ligne.
- **Déplacement au clavier** : même motif, via `updateOutline` et `sync`.

**Mesuré sans correction nécessaire**
- **Observateur de mutations** : avec l'onglet Assets ouvert, le défilement provoque 28 mises à jour incrémentales, soit environ 15 ms de script sur 6 s. Négligeable, non modifié.
- **Écouteurs** : rattachés à un `AbortController` par document du cadre, ils ne s'accumulent pas.
- **Réponses obsolètes** : une seule page par chargement de l'éditeur, une seule sauvegarde à la fois. Aucune réponse ancienne ne peut écraser la page courante.
- **Documents** : les 34 « documents » comptés par Chrome sont des documents détachés, pas des cadres ; il n'y en a que 2 réels.

**Corrections retenues**
- Toutes les lectures avant les écritures dans `updateOutline`.
- Contour regroupé à une mise à jour par image, sur défilement et redimensionnement, dans la même image : aucun retard visible.
- `paintTree` en deux temps.

**Écarté** : la lecture des styles calculés dans `renderPanel`. Elle coûte environ 1 ms par panneau, trop peu pour justifier le risque.

**Mises en page et recalculs forcés** (trace, CPU ×1)

| Action | 0.4.3 | 0.4.4 |
|---|---|---|
| Sélection | 115 | 74 |
| Changement d'écran | 132 / 125 | 81 / 81 |
| Défilement (20 crans) | 469 | 270 |
| Déplacement clavier (6) | 137 | 59 |
| Onglets Assets / Structure | 42 | 46 |

Au défilement, l'éditeur ne force plus qu'une lecture par image, le minimum nécessaire. Le reste vient de la boucle d'animation du thème (`main.js`), présente aussi sans l'éditeur.

**Durées et recalculs** (CPU ×4, médianes ; `mesures/editeur-043.json`, `mesures/editeur-044.json`)

| Action | ms | Recalculs de style | Mises en page | Script (ms) |
|---|---|---|---|---|
| Sélection | 154 → 160 | 66 → 54 | 41 → 24 | 23 → 20 |
| Seconde sélection | 142 → 112 | 48 → 38 | 34 → 23 | 18 → 15 |
| Onglet Structure | 112 → 95 | 20 → 20 | 7 → 6 | 21 → 17 |
| Panneau Réglages (×2) | 131 → 115 | 48 → 31 | 33 → 15 | 16 → 11 |
| Écran mobile | 228 → 238 | 82 → 52 | 62 → 35 | 37 → 30 |
| Écran desktop | 243 → 226 | 83 → 54 | 63 → 34 | 35 → 29 |
| Défilement (30 crans) | 1055 → 1057 | 470 → 203 | 91 → 66 | 99 → 79 |
| Déplacement clavier (10) | 127 → 127 | 127 → 58 | 78 → 42 | 35 → 27 |
| Ouverture de l'éditeur | 1975 → 1952 | | | |
| Navigation vers une autre page | 1528 → 1515 | | | |

Lecture :
- les recalculs et mises en page forcés baissent de 30 à 57 % ;
- le temps de script baisse de 10 à 30 % ;
- les durées d'action ne bougent guère : elles sont dominées par la remise en page de la page elle-même, par exemple sur un changement de largeur. Les écarts de ±10 ms y sont du bruit de mesure.

**Parcours répété** (40 cycles : sélection, déplacement, onglets, écrans, défilement, retour à la sauvegarde)
- Même évolution de la mémoire JS dans les deux versions (6,3 → 6,9 Mo), avec un palier vers le 32e cycle : c'est l'historique d'annulation, limité à 80 états.
- Écouteurs, nœuds et observateurs restent constants d'un bout à l'autre (9 + 8 observateurs). Rien ne s'accumule.
- Après 6 navigations entre pages, l'état est identique en 0.4.3 et en 0.4.4. Aucune erreur.

## 3. Conservation des modifications

Test `tests/conservation-e2e.mjs` : 7 scénarios × 3 moteurs. Il vérifie les données de WordPress (REST) et le brouillon local, pas seulement l'interface.

| Scénario | 0.4.3 | 0.4.4 |
|---|---|---|
| Modifier puis changer immédiatement de page ; revenir ; retour arrière | conservé | conservé (départ protégé) |
| Retouche pendant l'envoi, puis départ avant la réponse | brouillon bloqué « à récupérer », conflit à la récupération | révision envoyée conservée, retouche suivante restaurée puis enregistrée sans conflit |
| Réponse perdue après enregistrement, puis nouvelle sauvegarde | faux conflit 409 | envoi reconnu, suite enregistrée |
| Réponse 502 en HTML | « Unexpected token '<' » | message clair, brouillon gardé, jamais « Enregistré » |
| Coupure réseau | « Failed to fetch » | « Connexion interrompue… », brouillon gardé, reprise |
| Jeton REST expiré | « Cookie check failed », bloqué | jeton renouvelé, requête rejouée |
| Deux onglets, conflit | export seulement | onglet signalé ; 409 sans écrasement ; remplacement explicite après téléchargement de la version enregistrée |
| Publication | « Réglages enregistrés » | révision et état des caches annoncés |

« Enregistré » ne s'affiche qu'après confirmation du serveur pour l'état exact envoyé. Une retouche faite pendant l'envoi garde l'état « Modifications non enregistrées ».

La protection avant de quitter la page reste active tant qu'une modification n'est pas confirmée. Elle ne demande aucune confirmation à chaque action.

## 4. Fidélité éditeur / aperçu / publié / premier affichage

**PHP = JavaScript.** `tests/published-styles.test.mjs` (7 tests) parcourt toutes les propriétés acceptées par `Schema::value()`, lues par réflexion : 46 propriétés (31 valeurs libres et 15 énumérations) avec héritage desktop → tablette → mobile. Le voile et le zoom sont couverts par des tests dédiés. Le CSS PHP est identique, règle par règle, à `styles.js/generateCSS()`.

**Navigateurs.** `tests/fidelite-e2e.mjs`, Chromium, Firefox et WebKit, à 1440, 820 et 390 px (profil téléphone : tactile, densité ×2) :
- même révision ; 7 cibles × 28 styles calculés, plus texte et lien ;
- **éditeur = publié** (cache froid et cache chaud) : identiques ;
- **premier affichage (CSS serveur seul) = publié**, hors écarts nommés et attendus :
  - texte et lien : mutations du DOM par le runtime ;
  - hauteur du titre : elle dépend du texte ;
  - voile : fond mesuré ;
  - translation propre au thème ;
  - cible ambiguë ;
- translation du thème composée une seule fois (5px −22px, 2px −18px, 10px −13px), sans double application ;
- cible ambiguë : signalée dans l'éditeur, retouche conservée, appliquée à aucun élément après le runtime ;
- retrait d'une retouche : retour exact au style du thème, au premier affichage comme après le runtime.

**Corrections de fidélité**
- Un élément avec voile, couches ou zoom de fond n'est plus entièrement laissé au runtime : seules les parties mesurées le restent. Sa position de fond, par exemple, apparaît désormais dès le premier affichage.
- Une image zoomée qui a aussi un fond reste au runtime, comme dans `styles.js`.
- Le CSS serveur est imprimé en fin de `<head>`, comme la feuille du runtime : même ordre de cascade, y compris face au « CSS additionnel » de WordPress (priorité 101).

**Sur l'Énergie des Runes** :
- CSS serveur de l'accueil identique octet pour octet entre 0.4.3 et 0.4.4 (993 octets), et identique à celui servi en production le 09/10 ;
- le thème n'utilise jamais la propriété `translate` ;
- recette sur le thème réel : 30/30 ; simulation de CSS regroupé par un optimiseur : 10/10.

## 5. Publication et caches

**LiteSpeed.** Après chaque sauvegarde confirmée, l'extension purge la seule URL publiée (`litespeed_purge_url`). LiteSpeed envoie l'en-tête de purge à la fin de la requête REST (`shutdown` → `send_headers`), constaté dans le code de LSCWP 7.9.1 en production. `LITESPEED_PURGE_SILENT` évite de laisser une notification dans l'administration. Test isolé : `tests/cache.test.mjs`, 4/4.

**CDN Hostinger.** Il met le HTML en cache : deux requêtes à l'accueil ont répondu `x-hcdn-cache-status: HIT`, âge d'environ 25 h. Une purge LiteSpeed ciblée ne le vide donc pas.
- L'extension Hostinger 3.0.79 ne vide son CDN qu'en entier : soit après une purge complète de LiteSpeed (`litespeed_purged_all`), soit par sa route `DELETE /hostinger-tools-plugin/v1/clear-cache`, qui vide aussi le cache serveur.
- Une purge complète a déjà provoqué des 504 pendant quelques minutes. Elle n'est donc **jamais automatique** : après une sauvegarde, l'éditeur propose « Vider le cache Hostinger (tout le site) », avec confirmation, par la route officielle (administrateur seulement). L'adresse a été vérifiée en production.
- **Limite** : pas d'invalidation ciblée possible du CDN Hostinger.

**Message après sauvegarde** : révision enregistrée, puis :
- « Cache LiteSpeed de cette page vidé » ;
- « Le CDN Hostinger peut encore servir l'ancienne version aux visiteurs » ;
- sans cache géré, « videz-le » ;
- en cas d'échec de purge, l'avertissement correspondant.

Une purge ne peut jamais faire échouer une sauvegarde, et l'éditeur ne présente jamais la page publique comme à jour sans le savoir.

**Style du site** : palette de l'éditeur, jamais rendue côté public. Aucune page à purger.

## 6. Performances du site public (contrainte bloquante)

**Code public** : `runtime.js`, `styles.js`, `selection.js` et `background-layers.js` sont identiques octet pour octet à la 0.4.3, hors numéro de version. Aucun module, observateur ni mécanisme de l'éditeur n'est chargé chez les visiteurs (test historique « Public retouché : quatre modules du runtime »).

**Mesures** sur relais (production figée en cache, envois Analytics bloqués) : accueil, 0.4.3 contre 0.4.4, mobile (CPU ×4) et ordinateur, cache froid et cache chaud. Deux tours alternés de 3 passages : `mesures/comparaison-public.txt`.

| Scénario | FCP | LCP | CLS | Requêtes / Ko |
|---|---|---|---|---|
| Mobile froid | 720 → 720 / 724 → 724 | 1036 → 1036 / 1040 → 1036 | 0 | 40 / 843 identiques |
| Mobile chaud | 284 → 272 / 268 → 272 | 1040 → 1048 / 1032 → 1036 | 0 | 40 / 116 identiques |
| Ordinateur froid | 316 → 320 / 324 → 320 | 1096 → 1096 / 1100 → 1100 | 0 | 45 / 1110 identiques |
| Ordinateur chaud | 160 → 156 / 156 → 160 | 900 → 900 | 0 | 45 / 66 identiques |

Trames lentes, au chargement et au défilement : mêmes nombres. Les écarts de temps manqué changent de sens d'un tour à l'autre (ordinateur chaud : 19 → 51 au premier tour, 51 → 18 au second) : c'est du bruit d'une image, pas une régression. **Aucune régression reproductible.**

## 7. Validation finale

- **Suite complète** `dev/validate.mjs` (Node 24.21, Playwright 1.62.1, Chromium, WebKit et Firefox) : **46 suites sur 46, 355 contrôles réussis**. Ce sont les 316 contrôles historiques, plus 21 de conservation et 18 de fidélité. Journal : `Visual Tweaks/artifacts/validation-0.4.4.log`.
  - Une exécution intermédiaire avait fait échouer une fois le test d'ergonomie connu pour son instabilité (largeur lue juste après Échap). La cause, la fermeture différée de la fenêtre, est corrigée dans l'extension (`cancel`) : 3 passages sur 3 sous Chromium, plus Firefox et WebKit, puis la suite complète.
- **Tests unitaires** : cœur 18/18, rendu serveur 7/7, caches 4/4. Syntaxe PHP (10 fichiers) et JavaScript valide.
- **Recette sur le thème réel** (WordPress local, retouches de production) : 30/30, et 10/10 en simulation de CSS regroupé.
- **Captures de l'accueil**, production figée en cache, 0.4.3 contre 0.4.4 : **0 pixel différent** à 1440, 820, 390 et 360 px (`controles/captures-accueil-043-044.txt`).
- **Données** : les tests de conservation comparent les valeurs enregistrées dans WordPress à chaque étape. Aucune retouche ni propriété ne disparaît sans action explicite. Les données de production n'ont pas été touchées : lecture seule.
- **Archive** : `visual-tweaks-0.4.4.zip`, 47 fichiers, identique au code testé (`diff -r`), sans fichier de développement. Empreinte `a83100ad96ed4bfe27b05b68c3b0a5eed28e403f911588475dc9fd93e72569ff` (`SHA256SUMS`).

**Note Analytics** : `captures-comparer.cjs` ne bloquait pas les envois vers Google. Les 27 captures du 9 octobre, prises via le relais, ont donc pu envoyer des pages vues de test (nom d'hôte `127.0.0.1`), filtrables dans GA4. L'outil les bloque désormais, comme tous ceux de cette passe.

## 8. Fichiers modifiés (projet Visual Tweaks)

- `visual-tweaks/assets/editor.js` : fluidité, journal des envois, renouvellement du jeton, conflits, onglets, caches.
- `visual-tweaks/assets/navigation.js` : `paintTree` en deux temps.
- `visual-tweaks/assets/viewport.js` : `point` et `rect` acceptent un rectangle déjà lu.
- `visual-tweaks/assets/responsive-guard.js` : annulation sur `cancel`.
- `visual-tweaks/includes/class-cache.php` (nouveau), `includes/class-plugin.php`, `includes/class-published-styles.php`, `visual-tweaks.php`.
- Numéros de version 0.4.4 : 41 imports, `readme.txt`, `package.json`, `README.md`.
- Tests : `tests/conservation-e2e.mjs`, `tests/fidelite-e2e.mjs`, `tests/cache.test.mjs` (nouveaux) ; `tests/published-styles.test.mjs` étendu ; `dev/validate.mjs`.

Outils de cette passe (`outils/`) :
- `mesure-editeur.mjs`, `trace-editeur.mjs` ;
- `exporter-options-vt.php`, `restaurer-options-vt.php` ;
- `transforme-vt-044.cjs`.

Dans `backups/perf-fluidite-20261009/outils/` : `recette-visual-tweaks.cjs` (option `--combine`), `controle-fonctions.cjs`.

## 9. Limites restantes

- **CDN Hostinger** : vidage de tout le site seulement, sur action explicite.
- **LiteSpeed** : purge non observée sur un vrai serveur LiteSpeed ; à vérifier à la première sauvegarde en production (page servie en `miss` juste après).
- **Translation posée par un thème** : au premier affichage, la retouche s'applique sans la base du thème ; le runtime la compose ensuite. Sans effet sur l'Énergie des Runes.
- **Cible devenue ambiguë après une modification de la page** : avant l'exécution du runtime, le CSS serveur s'applique à tous les éléments correspondants ; le runtime le retire ensuite.
- **Brouillons** : stockage local du navigateur, partagé par les onglets d'une même page (signalé).
- **WordPress `wp-preferences`** (chargé avec la médiathèque) : il rejette sans le traiter une requête interrompue quand on quitte la page, sous Firefox et WebKit. Comportement identique en 0.4.3, sans effet sur les données. Les tests le consignent à part.

## Vérifications réalisées

- Sauvegardes du code et des données, et restauration éprouvée.
- Mesures de l'éditeur avant et après, avec traces, 40 cycles et 6 navigations.
- Mesures publiques avant et après : relais, 2 tours, mobile et ordinateur, cache froid et cache chaud.
- Suite complète et nouveaux tests sur 3 moteurs, profil téléphone compris.
- Fidélité comparée par styles calculés et par captures.
- Code de LiteSpeed et de l'extension Hostinger relu en production, en lecture seule.

## Vérifications encore nécessaires (non réalisées)

- Installation en production et contrôles de `PROCEDURE.md`, après validation de Kevin.
- Première sauvegarde réelle : purge LiteSpeed observée, puis bouton CDN Hostinger.
- Export des brouillons locaux de Kevin avant l'installation.
