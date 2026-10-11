# Visual Tweaks 0.4.1 — rapport de stabilisation

Verdict : **prêt avec limites**.

**307 contrôles navigateur + 18 tests unitaires passants (325 au total)**. Les 270 contrôles historiques et leurs 14 fichiers de tests restent inchangés. Chromium, WebKit et Firefox passent sur le thème isolé. **0 fichier du thème source modifié**, 191 hashes vérifiés.

Preuves : `artifacts/validation-0.4.1.json` et `artifacts/validation-0.4.1.log`.

## Anomalies reproduites et corrigées

| Anomalie et cause | Correction locale |
| --- | --- |
| Guard : un bouton invisible dans un parent à `opacity: 0` était recommandé comme petite cible, car seule son opacité propre était contrôlée | Exclure les descendants transparents, avec cache d’ascendance limité à chaque snapshot ; les petites cibles visibles restent recommandées |
| Toolbar : `scrollIntoView` héritait du `scroll-behavior: smooth` du thème. Pendant le défilement, le clic pouvait atteindre le titre/la section derrière la toolbar en mouvement | Défilement de sélection instantané depuis la navigation et après changement de viewport. La navigation native en mode Naviguer est conservée |
| Champ vidé : après recovery puis suppression explicite de `width: "NaNpx"`, l’override disparaissait mais son indication restait `NaNpx`, au lieu de la largeur réelle `503.3px` | Actualiser l’indication après effacement depuis la valeur héritée ou le CSS appliqué. Aucune valeur calculée n’est écrite dans le draft |
| Banc d’essai : PNG avec CRC IDAT invalide, décodé par Chromium/WebKit mais refusé par Firefox | Corriger le CRC du même pixel et attendre `img.decode()` dans le parcours de remplacement |

Reproductions avant correction : `guard-visibility-before.json`, `smooth-scroll-before.log`, `validation-0.4.1-before-scroll-fix.log`, `placeholder-before.log`, dans `artifacts/`.

Les modifications fonctionnelles du plugin concernent uniquement `responsive-guard.js` et les trois ajustements locaux d’`editor.js`. Les autres changements JS sont les imports versionnés 0.4.1. Métadonnées PHP/package/readme synchronisées. **Schema v1, REST/CAS, draft/recovery, Runtime, ciblage, historique et viewport conservés.**

## Validation effectuée

Checkpoint complet de la 0.4.0 et hashes avant modification ; ses 270 contrôles et 18 tests unitaires passaient. Archive : `artifacts/backups/visual-tweaks-0.4.0-before-stabilisation.tar.gz`.

Session manuelle locale : sélection, déplacement clavier, Undo, Assets → Structure, accordéon en Naviguer, retour Modifier, save/refresh/quitter/revenir.

Les nouvelles suites ajoutent **37 contrôles** sans retirer les anciennes :

- `tests/stabilisation-e2e.mjs` : 10 par moteur. Session continue du thème réel : sélection, draft/dirty/Undo, Structure, espacement/reset, texte, Review, Assets/miniature, taille/centrage/poignée sous zoom, médiathèque, responsive/audit, navigation, sauvegarde/refresh/quitter/revenir et comparaison publique à 1440 px. Recovery invalide conservé jusqu’à correction explicite, indication du champ vérifiée.
- `tests/guard-visibility-e2e.mjs` : 1 par moteur. Ascendant transparent exclu, cible visible conservée, titre multiligne/décoration sans faux problème.
- `tests/cache-public-e2e.mjs` : 4 contrôles de ressources publiques et caches.

`dev/validate.mjs` exécute ces suites après toutes les suites historiques. Recovery valide/même révision, révision divergente, export, runtime tardif et reload des listeners restent couverts par `stability-e2e.mjs`. Fonds multicouches, Smart Guides et corrections responsive avec aperçu/Appliquer/Undo restent éprouvés dans le fixture sur les trois moteurs. Le thème réel contient des images HTML/SVG, pas de fond CSS à URL : ces cas ne sont pas prétendus présents dans ce thème.

## Responsive Guard

Sur le thème réel : neuf recommandations par écran, correspondant à des liens réellement hauts de 18 à 22,5 px. Mesures pertinentes ; priorité discutable sur desktop. Aucun débordement réel ni faux problème de titre multiligne/décoration trouvé dans cette session. Le faux positif d’ascendant transparent a été reproduit dans un cas contrôlé temporaire, sans modifier le thème. Les états animés/dynamiques ne sont pas exhaustivement validés.

## Persistance, public et caches

**Testé : WordPress 7.1.3 / PHP WebAssembly 8.5.10 / SQLite.** Première sauvegarde, mise à jour, CAS/conflit, recovery/reset, Style du site, backgroundLayers et lecture publique restent couverts.

**MySQL/MariaDB non testé.** Aucun PHP natif, serveur MySQL/MariaDB, Docker/Podman disponible ni service sur 3306/3307. La même matrice reste à exécuter sur un WordPress utilisant réellement cette base.

Public : aucun éditeur/nonce REST d’édition ; aucune ressource Visual Tweaks sans overrides. Page retouchée : seulement `runtime.js`, `selection.js`, `styles.js`, `background-layers.js`. Leur implémentation reste identique à la 0.4.0 : **18 642 octets de source avant/après**. Aucune accélération générale revendiquée.

Cache navigateur ordinaire : nouvelle retouche visible après refresh. **Cache HTTP HTML local testé : ancien override servi après sauvegarde jusqu’à purge**, puisque les données sont dans le HTML. Versionner les modules ne purge pas ce HTML. Les previews sont `private, no-store` ; sessions connectées et URLs `vt-edit`/`vt-frame` doivent être exclues des caches tiers. Aucun plugin de cache WordPress tiers ni CDN réel testé ; aucune intégration de purge ajoutée.

## Documentation et limites ouvertes

README/readme harmonisés : refus obsolète des fonds multicouches supprimé, couche URL simple remplaçable en conservant gradient/autres couches ; cadrage, libellés image, balises texte autorisées, héritage, workflow et versions/tests clarifiés. `dev/fixture-theme/seed.php` change uniquement le média de test ; README, readme WordPress et étude du texte reflètent les limites actuelles.

Aucune production utilisée. La copie Kevin Legros n’est pas un staging de L’Énergie des Runes. Texte simple : limite API de 4 000 octets UTF-8, compteur frontend en unités JavaScript ; un long texte accentué peut être refusé, avec brouillon conservé. MySQL/MariaDB et caches fournisseurs restent à valider. Texte riche/DIV, composants, effets, wireframe, rendu serveur et purge multi-fournisseur restent différés.
