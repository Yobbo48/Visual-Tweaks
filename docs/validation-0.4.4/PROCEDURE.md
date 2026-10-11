# Visual Tweaks 0.4.4 — installation et retour arrière

**Rien n'est déployé.** Ce document prépare la mise en production, à faire seulement après validation de Kevin.

## Ce qui change pour les données

Rien. La 0.4.4 lit et écrit les mêmes options (`vt_page_*`, `vt_site_style`, `vt_enabled`, `vt_desktop_width`), au même format (schéma 1), avec la même protection contre les écritures concurrentes.

Le navigateur de l'éditeur ajoute une clé locale, `visual-tweaks:…:envoi` : c'est le journal des envois en cours. La 0.4.3 l'ignore.

Le retour à la 0.4.3 ne demande donc **aucune restauration de données**.

## Archives

| Fichier | Rôle |
|---|---|
| `visual-tweaks-0.4.4.zip` | Extension à installer (empreinte dans `SHA256SUMS`) |
| `sauvegardes/visual-tweaks-0.4.3.zip` | Retour arrière ; identique à l'extension en production le 11/10 (`diff -r`) |
| `sauvegardes/production-visual-tweaks-0.4.3.tar.gz` | Copie brute du dossier de l'extension en production |
| `sauvegardes/production-options-vt.json` | Export brut (octet pour octet) des options `vt_*` de production, avec révisions et empreintes |
| `outils/restaurer-options-vt.php` | Restauration de cet export, éprouvée sur un WordPress local |
| `outils/exporter-options-vt.php` | Nouvel export, à faire juste avant l'installation |

État des données au 11/10 : une seule page retouchée, `/` (révision 22, 2 éléments). Pas de style du site enregistré.

**Brouillons non enregistrés.** Ils vivent dans le navigateur de Kevin (stockage local), pas sur le serveur. Avant l'installation, ouvrir l'éditeur sur chaque page travaillée : l'enregistrer, ou « Exporter le brouillon JSON ». La 0.4.4 relit les brouillons de la 0.4.3 tels quels.

## Installation (après validation)

1. Faire un nouvel export des données :
   `wp eval-file exporter-options-vt.php > options-avant-044.json`. Vérifier que la révision de `/` est toujours 22, ou noter la nouvelle.
2. Vérifier l'empreinte du ZIP, puis : `wp plugin install visual-tweaks-0.4.4.zip --force`.
3. Contrôles :
   - `wp plugin get visual-tweaks` doit annoncer la version 0.4.4 ;
   - les fichiers en place doivent être identiques à ceux du ZIP ;
   - l'option `vt_page_…` doit être inchangée (même empreinte que l'export de l'étape 1).
4. Purger : `wp litespeed-purge all`, puis le cache Hostinger (hPanel, ou l'API Hostinger).
5. Contrôles publics, sur quelques requêtes seulement :
   - HTML de l'accueil : `runtime.js?ver=0.4.4`, et la balise `#vt-published-styles` identique à celle d'aujourd'hui ;
   - bande et logo à leur place dès la première image ;
   - aucune erreur JavaScript.
6. Contrôles par Kevin, connecté :
   - ouvrir « Édition visuelle » sur l'accueil et faire une retouche ;
   - enregistrer : le message doit annoncer « révision 23 » et « Cache LiteSpeed de cette page vidé », puis proposer de vider le cache Hostinger ;
   - annuler la retouche, puis enregistrer à nouveau ;
   - vider le cache Hostinger avec le bouton proposé ;
   - ouvrir l'accueil en navigation privée : la version enregistrée doit apparaître.

## Retour arrière (code)

`wp plugin install visual-tweaks-0.4.3.zip --force`, puis purger LiteSpeed et le cache Hostinger. Les retouches restent en place : le format n'a pas changé.

## Retour arrière (données), seulement en cas de besoin

1. `wp eval-file restaurer-options-vt.php production-options-vt.json` : c'est une simulation, qui compare chaque option à l'export.
2. `wp eval-file restaurer-options-vt.php production-options-vt.json --appliquer` :
   - les valeurs actuelles sont d'abord copiées dans `avant-restauration-<date>.json` ;
   - chaque option de l'export est réécrite octet pour octet, puis relue et comparée par empreinte ;
   - aucune autre option n'est supprimée.
3. Purger LiteSpeed et le cache Hostinger.

Pour revenir à un état postérieur au 11/10, utiliser l'export de l'étape 1 de l'installation à la place de `production-options-vt.json`.
