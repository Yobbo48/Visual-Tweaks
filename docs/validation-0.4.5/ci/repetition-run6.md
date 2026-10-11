## Deuxième répétition, même configuration — exécution n° 6 (job de mesures, commit 30f06ae, WordPress 7.1.3)

L'exécution n° 6 a été annulée (remplacée par la n° 7), mais son job de mesures a tourné jusqu'au bout. Les sites et le code mesurés sont ceux de la n° 5 : le commit 30f06ae ne change que les outils de mesure, pas l'extension.

Conditions identiques à la n° 5 :
- mobile 390 × 844, densité 3, CPU × 4, cache froid ;
- 4 tours de 5 passages, ordre alterné ;
- 0.4.5 servie par le site du port 9410, 0.4.4 par celui du port 9412.

| Tour | Version | FCP = LCP (médiane) | LoAF (médiane ; par passage) | Trames lentes | Pire trame | Requêtes / Ko |
|---|---|---|---|---|---|---|
| 1 | 0.4.4 | 860 | 1 ; 1 1 1 1 1 | 0 / 0 | 33 | 9 / 76 |
| 1 | 0.4.5 | 848 | 1 ; 1 1 1 1 0 | 0 / 0 | 50 | 9 / 76 |
| 2 | 0.4.5 | 844 | 1 ; 1 1 1 1 1 | 0 / 0 | 50 | 9 / 76 |
| 2 | 0.4.4 | 864 | 1 ; 1 1 1 1 1 | 0 / 0 | 50 | 9 / 76 |
| 3 | 0.4.4 | 828 | 1 ; 1 1 1 1 1 | 0 / 0 | 50 | 9 / 76 |
| 3 | 0.4.5 | 848 | 1 ; 1 1 1 1 1 | 0 / 0 | 33 | 9 / 76 |
| 4 | 0.4.5 | 840 | 0 ; 0 1 1 0 0 | 0 / 0 | 50 | 9 / 76 |
| 4 | 0.4.4 | 828 | 1 ; 1 0 1 1 1 | 0 / 0 | 33 | 9 / 76 |

Long animation frames, tous tours confondus : 0.4.4, 19 passages sur 20 ; 0.4.5, 16 sur 20.

Comparaison avec la n° 5, dans la même configuration :
- l'écart de FCP de la n° 5 (0.4.5 plus lente de 24 à 52 ms à chaque tour) ne se reproduit pas : ici, 0.4.5 est plus rapide aux tours 1 et 2 et plus lente aux tours 3 et 4 ;
- l'écart de LoAF s'inverse : la n° 5 donnait 13 sur 20 pour la 0.4.4, ici elle en a 19 sur 20.

Modules chargés identiques : background-layers.js, runtime.js, selection.js, styles.js.
