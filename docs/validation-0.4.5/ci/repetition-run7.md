## Exécution n° 7 (commit adf7f35, WordPress 7.1.3)

### Suite complète : 41 réussies, 1 en échec, 10 non exécutées

Échec : `ressources-e2e` sur WebKit, avant tout contrôle. `page.waitForURL: Timeout 30000ms exceeded`, à la connexion (`tests/ressources-e2e.mjs:129`), journal réduit à `waiting for navigation until "load"` : aucune navigation, le formulaire n'est pas parti.

Cause, reproduite à l'identique dans le conteneur distant (Chromium) :
- `wp-login.php` donne le focus à `#user_login` 200 ms après son script, soit environ 150 ms après la fin du `goto` (mesuré : `load` à 146 ms, focus à 296 ms), en sélectionnant son texte ;
- si ce focus survient entre le focus de `#user_pass` et la saisie, le mot de passe remplace l'identifiant ;
- `#user_pass` reste vide alors qu'il est `required` : le navigateur bloque l'envoi ;
- reproduction : identifiant `vt-local-only-9410`, mot de passe vide (« requis manquant »), même erreur et même journal que la CI.

Les suites de la 0.4.4 attendent 250 ms avant de saisir (`conservation`, `fidelite`, `e2e`) ou vérifient les champs (`foundations`). Les deux tests ajoutés en 0.4.5 (`ressources-e2e`, `allege-e2e`) et l'outil de mesure ne le faisaient pas. Défaut des tests, sans lien avec l'extension : la connexion à WordPress précède tout code de Visual Tweaks.

Les tests PHP ont tourné en CI pour la première fois : `ℹ tests 11` / `ℹ pass 11`.

### Mesures publiques : mobile, cache froid, 4 tours de 5 passages, ordre alterné

Répétition A : 0.4.5 sur le port 9410, 0.4.4 sur 9412.

| Tour | Version | TTFB | FCP après réponse | FCP = LCP | LoAF (par passage) |
|---|---|---|---|---|---|
| 1 | 0.4.4 | 527 | 102 | 644 | 1 0 0 0 0 |
| 1 | 0.4.5 | 509 | 114 | 660 | 1 0 0 1 1 |
| 2 | 0.4.5 | 501 | 105 | 608 | 0 1 0 0 1 |
| 2 | 0.4.4 | 529 | 105 | 632 | 1 0 0 1 0 |
| 3 | 0.4.4 | 501 | 104 | 600 | 0 0 0 0 0 |
| 3 | 0.4.5 | 517 | 105 | 620 | 0 0 1 0 0 |
| 4 | 0.4.5 | 510 | 112 | 620 | 0 0 0 1 0 |
| 4 | 0.4.4 | 494 | 100 | 596 | 0 0 0 0 0 |

Tous passages, répétition A :
- 0.4.4 : TTFB 508, FCP 608, FCP après réponse 103 ; LoAF sur 3 passages sur 20 ;
- 0.4.5 : TTFB 510, FCP 620, FCP après réponse 107 ; LoAF sur 7 passages sur 20.

Répétition B, sites inversés : 0.4.4 sur le port 9410, 0.4.5 sur 9412, nouvelles données.

| Tour | Version | TTFB | FCP après réponse | FCP | LoAF (par passage) |
|---|---|---|---|---|---|
| 1 | 0.4.4 | 552 | 106 | 664 | 1 0 1 0 1 |
| 1 | 0.4.5 | 564 | 120 | 684 | 1 1 1 0 1 |
| 2 | 0.4.5 | 570 | 114 | 684 | 1 1 0 1 1 |
| 2 | 0.4.4 | 602 | 114 | 716 | 1 1 0 0 1 |
| 3 | 0.4.4 | 542 | 114 | 648 | 1 0 0 0 1 |
| 3 | 0.4.5 | 544 | 117 | 680 | 0 0 1 1 1 |
| 4 | 0.4.5 | 544 | 115 | 672 (LCP 680) | 0 0 1 1 0 |
| 4 | 0.4.4 | 545 | 107 | 652 | 1 1 0 0 1 |

Tous passages, répétition B :
- 0.4.4 : TTFB 552, FCP 664, FCP après réponse 110 ; LoAF sur 11 passages sur 20 ;
- 0.4.5 : TTFB 563, FCP 680, FCP après réponse 117 ; LoAF sur 13 passages sur 20.

Dans les deux répétitions : longues tâches 0, CLS 0, trames lentes 0, 9 requêtes, 76 Ko, mêmes 4 modules.

### Lecture

Le changement d'instance (port, données) ne fait pas disparaître l'écart : 0.4.5 est égale ou plus lente de 3 à 14 ms après la réponse sur les 8 tours. Or le visiteur reçoit les mêmes octets. Vérifié dans le conteneur distant : retouches publiées par l'éditeur de chaque version avec l'outil de mesure, puis HTML visiteur comparé, identique hors numéro de version. Les modules publics sont eux aussi identiques hors numéro de version.

Une différence demeure entre les deux sites : l'emplacement de l'extension (dépôt pour la 0.4.5, dossier de référence pour la 0.4.4). D'où l'exécution n° 8 :
- un témoin A/A, deux copies de la 0.4.5, pour mesurer le bruit propre au banc ;
- une comparaison 0.4.4 / 0.4.5 avec les deux extensions copiées au même niveau ;
- un test de rang sur les 20 passages de chaque site.
