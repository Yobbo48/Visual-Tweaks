## Exécution n° 9 (commit 7374be3, code final, WordPress 7.1.3)

### Suite complète : 42 réussies, 0 en échec, 10 non exécutées

- `RÉSUMÉ 42 réussies, 0 en échec, 10 non exécutées`.
- Cœur : `ℹ tests 18`, `ℹ pass 18`.
- PHP : `ℹ tests 11`, `ℹ pass 11`, `ℹ skipped 0`.
- 334 contrôles navigateur réussis.
- Contour replacé après une transition du thème : réussi sur les trois moteurs. Libellé : « Mode allégé : sélection, contour exact (et replacé après une transition du thème qui déplace l'élément), déplacement à la souris et au clavier, annulation jusqu'à l'état enregistré ».
- Non exécutées, faute de thème réel : les mêmes 10 qu'en n° 8.

### Mesures publiques : mobile 390 × 844, CPU × 4, cache froid, 4 tours de 5 passages, ordre alterné, extensions au même niveau

**Témoin A/A** : deux copies identiques de la 0.4.5.

| Tour | Site | TTFB | FCP après réponse | FCP = LCP |
|---|---|---|---|---|
| 1 | copie 9412 | 615 | 118 | 736 |
| 1 | copie 9410 | 591 | 119 | 712 |
| 2 | copie 9410 | 568 | 116 | 672 |
| 2 | copie 9412 | 595 | 110 | 700 |
| 3 | copie 9412 | 611 | 108 | 720 |
| 3 | copie 9410 | 559 | 111 | 672 |
| 4 | copie 9410 | 558 | 110 | 668 |
| 4 | copie 9412 | 562 | 113 | 672 |

Écart copie 9410 − copie 9412 :
- FCP après réponse : +2 ms, p = 0,645 ;
- FCP : −32 ms, **p = 0,023** ;
- TTFB : −27 ms, **p = 0,018**.

Avec un code identique, le FCP diffère « significativement » entre les deux sites, par le temps de réponse du serveur : chaque instance du banc a sa propre vitesse. Le FCP après réponse, qui retire la part serveur, ne bouge pas. C'est la mesure qui départage le code livré au navigateur.

**0.4.4 / 0.4.5** : 0.4.5 sur le port 9410, 0.4.4 sur 9412.

| Tour | Version | TTFB | FCP après réponse | FCP = LCP | LoAF (par passage) |
|---|---|---|---|---|---|
| 1 | 0.4.4 | 584 | 108 | 700 | 0 0 0 0 1 |
| 1 | 0.4.5 | 579 | 111 | 708 | 1 0 0 1 2 |
| 2 | 0.4.5 | 553 | 99 | 652 | 1 1 0 0 0 |
| 2 | 0.4.4 | 550 | 102 | 652 | 1 0 0 1 0 |
| 3 | 0.4.4 | 562 | 107 | 672 | 0 0 0 1 0 |
| 3 | 0.4.5 | 553 | 103 | 660 | 0 0 0 0 0 |
| 4 | 0.4.5 | 554 | 100 | 652 | 1 0 0 0 0 |
| 4 | 0.4.4 | 558 | 111 | 668 | 1 0 0 0 0 |

Écart 0.4.5 − 0.4.4 :
- FCP après réponse : −4 ms, p = 0,159 ;
- FCP : −8 ms, p = 0,363 ;
- TTFB : −12 ms, p = 0,409.

Passages triés, FCP après réponse :
- 0.4.4 : 93 97 98 101 101 102 102 105 107 108 109 110 110 111 112 112 116 116 117 135 ;
- 0.4.5 : 89 93 96 98 99 100 100 100 103 103 105 105 106 107 107 107 111 116 131 183.

LoAF : 5 passages sur 20 en 0.4.4, 6 sur 20 en 0.4.5. Partout : longues tâches 0, CLS 0, trames lentes 0, 9 requêtes, 76 Ko, mêmes 4 modules.

### Lecture

Seconde réplique de l'exécution n° 8. Avec les extensions au même niveau, la 0.4.5 n'est pas plus lente : −4 ms après la réponse, p = 0,16. Aucune régression reproductible des performances publiques.
