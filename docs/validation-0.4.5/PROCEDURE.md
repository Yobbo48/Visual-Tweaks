# Visual Tweaks 0.4.5 — installation et retour arrière

**Rien n'est déployé.** Cette procédure ne doit être suivie qu'après le contrôle restant (mode allégé sur Firefox et WebKit avec le thème réel, `CONTROLE.md`, sections 0 et 8) et l'accord de Kevin.

## Ce qui change pour les données

Rien. La 0.4.5 lit et écrit les mêmes options, au même format (schéma 1), avec la même protection contre les écritures concurrentes (révision) :
- `vt_page_*` ;
- `vt_site_style` ;
- `vt_enabled` ;
- `vt_desktop_width`.

Côté navigateur, une seule clé locale nouvelle : `visual-tweaks-light:<site>:<utilisateur>`. Elle mémorise le choix « Édition allégée » ; la 0.4.3 et la 0.4.4 l'ignorent.

Les brouillons et le journal des envois (`visual-tweaks:…`, `…:envoi`) gardent le format de la 0.4.4. La 0.4.3 ignore le journal des envois.

Le retour arrière ne demande donc **aucune restauration de données**.

## Archives (dossier `artifacts/`)

| Fichier | Rôle |
|---|---|
| `visual-tweaks-0.4.5.zip` | Extension à installer ; empreinte dans `visual-tweaks-0.4.5.zip.sha256` |
| `visual-tweaks-0.4.4.zip` | Retour arrière vers la 0.4.4 (jamais installée en production à ce jour) |
| `visual-tweaks-0.4.3.zip` | Retour arrière vers la 0.4.3, version en production au 11/10 |

Empreintes vérifiées le 11/10 :
- `visual-tweaks-0.4.3.zip` : `9ccc15d087f5b9eeb944255b8773fc7b79379b9eefcf668a17257246900fb8db` ;
- `visual-tweaks-0.4.4.zip` : `a83100ad96ed4bfe27b05b68c3b0a5eed28e403f911588475dc9fd93e72569ff`, identique au commit `fbbf381` (`diff -r`).

Outils de données (inchangés depuis la 0.4.4) : `docs/validation-0.4.4/outils/exporter-options-vt.php` et `restaurer-options-vt.php`.

## Avant l'installation

1. Relever la version en place : `wp plugin get visual-tweaks --field=version`. C'est la version de retour arrière (0.4.3 au 11/10).
2. Exporter les données : `wp eval-file exporter-options-vt.php > options-avant-045.json`. Noter la révision de `/` (22 au 11/10).
3. Brouillons non enregistrés : ils sont dans le navigateur de Kevin, pas sur le serveur. Ouvrir l'éditeur sur chaque page travaillée, puis enregistrer, ou cliquer « Exporter le brouillon JSON ».
4. Vérifier l'empreinte de l'archive : `sha256sum -c visual-tweaks-0.4.5.zip.sha256`.
5. **Logo, avant toute purge de cache.** L'export du 11/10 indique que `custom_logo` est absent de la base. Sans lui, le thème n'affiche aucun logo : celui qu'on voit aujourd'hui viendrait du cache, et la purge de l'étape « Installation » le ferait disparaître du site, quelle que soit la version de Visual Tweaks.
   - Vérifier : `wp theme mod get custom_logo`.
   - S'il est vide, décider avant d'installer : rétablir le logo dans le Personnalisateur (le média existe, ID 22, déjà utilisé comme icône du site), ou accepter son absence. La retouche du logo n'aurait alors plus de cible, ce qui est sans effet sur le reste.
   - Cette vérification ne modifie rien ; la décision appartient à Kevin.

## Installation

1. `wp plugin install visual-tweaks-0.4.5.zip --force`
2. Contrôles :
   - `wp plugin get visual-tweaks --field=version` donne `0.4.5` ;
   - l'option `vt_page_…` est inchangée : même empreinte que l'export de l'étape 2.
3. Purger : `wp litespeed-purge all`, puis le cache Hostinger (hPanel).
4. Contrôles publics, quelques requêtes seulement, sans campagne :
   - HTML de l'accueil : `runtime.js?ver=0.4.5` ;
   - balise `#vt-published-styles` identique à celle d'avant (le CSS serveur n'a pas changé) ;
   - bande et logo à leur place dès la première image ;
   - aucune erreur JavaScript.
5. Contrôles par Kevin, connecté (quelques minutes, sur le Mac, sans campagne de mesure) :
   - ouvrir « Édition visuelle » sur l'accueil : l'éditeur s'affiche, l'aperçu montre le thème animé ;
   - sélectionner le logo, le déplacer d'un pixel au clavier, puis annuler ;
   - cliquer « Édition allégée » : les animations de l'aperçu ralentissent ou s'arrêtent ; cliquer à nouveau : le rendu animé réel revient aussitôt ;
   - ouvrir la médiathèque (« Remplacer » sur une image), puis fermer sans rien choisir ;
   - quitter sans enregistrer.

## Retour arrière (code)

1. `wp plugin install visual-tweaks-<version relevée>.zip --force` (0.4.3 au 11/10).
2. Purger LiteSpeed et le cache Hostinger.

Les retouches restent en place, le format n'a pas changé. La clé locale du mode allégé est simplement ignorée.

## Retour arrière (données), seulement en cas de besoin

1. Simulation, qui compare chaque option à l'export : `wp eval-file restaurer-options-vt.php options-avant-045.json`.
2. Application : `wp eval-file restaurer-options-vt.php options-avant-045.json --appliquer`.
   - Les valeurs actuelles sont d'abord copiées dans `avant-restauration-<date>.json`.
   - Chaque option est réécrite octet pour octet, puis vérifiée par empreinte.
   - Aucune autre option n'est supprimée.
3. Purger LiteSpeed et le cache Hostinger.
