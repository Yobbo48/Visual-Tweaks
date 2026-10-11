## Exécution n° 8 (commit d54c91c, WordPress 7.1.3)

### Suite complète : 42 réussies, 0 en échec, 10 non exécutées

- `RÉSUMÉ 42 réussies, 0 en échec, 10 non exécutées`.
- Cœur : `ℹ tests 18`, `ℹ pass 18`.
- PHP (rendu serveur, caches) : `ℹ tests 11`, `ℹ pass 11`, `ℹ skipped 0`.
- `ressources-e2e` et `allege-e2e` réussis sur les trois moteurs, avec la connexion corrigée.
- Non exécutées, faute de thème réel :
  - `real-theme-e2e` × 3 ;
  - `cross-browser.mjs --comfort-real-theme` × 1 ;
  - `guard-visibility-e2e` × 3 ;
  - `stabilisation-e2e` × 3.

### Mesures publiques : mobile 390 × 844, CPU × 4, cache froid, 4 tours de 5 passages, ordre alterné

Les deux extensions sont copiées au même niveau (`../ext/…`), hors du dépôt. Test de rang de Mann-Whitney sur les 20 passages de chaque site, p bilatéral. L'implémentation donne les mêmes p que `scipy.stats.mannwhitneyu` (asymptotique, sans correction de continuité).

**Témoin A/A** : deux copies identiques de la 0.4.5, ports 9410 et 9412.

| Tour | Site | TTFB | FCP après réponse | FCP = LCP |
|---|---|---|---|---|
| 1 | copie 9412 | 425 | 89 | 520 |
| 1 | copie 9410 | 423 | 105 | 528 |
| 2 | copie 9410 | 419 | 90 | 508 |
| 2 | copie 9412 | 439 | 82 | 524 |
| 3 | copie 9412 | 422 | 90 | 512 |
| 3 | copie 9410 | 432 | 88 | 512 |
| 4 | copie 9410 | 426 | 82 | 508 |
| 4 | copie 9412 | 426 | 83 | 512 |

Écart copie 9410 − copie 9412 :
- FCP après réponse : +0 ms, p = 0,85 ;
- FCP : +0 ms, p = 0,557 ;
- TTFB : +0 ms, p = 0,525.

Passages triés, FCP après réponse :
- copie 9412 : 73 74 75 80 81 82 83 85 86 87 88 89 90 90 91 91 95 98 98 108 ;
- copie 9410 : 70 71 74 75 81 82 85 87 88 88 88 88 90 91 92 93 93 105 107 110.

Écart entre tours pour un même code : jusqu'à 16 ms (tour 1 : 89 contre 105).

**0.4.4 / 0.4.5** : 0.4.5 sur le port 9410, 0.4.4 sur 9412, extensions au même niveau.

| Tour | Version | TTFB | FCP après réponse | FCP = LCP | LoAF (par passage) |
|---|---|---|---|---|---|
| 1 | 0.4.4 | 444 | 87 | 520 | 0 0 0 0 0 |
| 1 | 0.4.5 | 432 | 94 | 536 | 0 0 0 0 0 |
| 2 | 0.4.5 | 417 | 85 | 504 | 0 0 0 0 0 |
| 2 | 0.4.4 | 432 | 86 | 512 | 0 0 0 0 0 |
| 3 | 0.4.4 | 414 | 86 | 492 | 0 1 0 0 0 |
| 3 | 0.4.5 | 429 | 75 | 504 | 0 0 0 0 0 |
| 4 | 0.4.5 | 417 | 84 | 496 | 0 0 0 0 0 |
| 4 | 0.4.4 | 425 | 87 | 512 | 0 0 0 0 0 |

Écart 0.4.5 − 0.4.4 :
- FCP après réponse : +0 ms, p = 0,807 ;
- FCP : −8 ms, p = 0,277 ;
- TTFB : −3 ms, p = 0,122.

Passages triés, FCP après réponse :
- 0.4.4 : 73 74 74 74 76 76 82 86 86 86 87 87 87 87 90 91 91 92 96 110 ;
- 0.4.5 : 73 74 75 75 75 75 82 84 85 85 87 87 88 90 92 92 93 94 106 112.

LoAF : 1 passage sur 20 en 0.4.4, 0 sur 20 en 0.4.5. Partout : longues tâches 0, CLS 0, trames lentes 0, 9 requêtes, 76 Ko, mêmes 4 modules.

### Lecture

Avec les deux extensions au même niveau, l'écart des exécutions n° 5 et n° 7 disparaît : 0.4.5 − 0.4.4 = +0 ms après la réponse, p = 0,81. Le témoin A/A donne lui aussi +0 ms, p = 0,85, et montre que deux copies du même code s'écartent de 16 ms d'un tour à l'autre.

Dans les exécutions n° 5 à 7, la 0.4.5 était servie depuis le dossier du dépôt, la 0.4.4 depuis un dossier voisin. L'écart observé va avec cette différence d'installation du banc, pas avec la version. Le visiteur reçoit d'ailleurs les mêmes octets, hors numéro de version.

Aucune régression reproductible des performances publiques.
