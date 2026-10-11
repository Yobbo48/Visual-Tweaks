## Répétition de la mesure ambiguë — exécution n° 5 (job de mesures, commit 2e2a784, WordPress 7.1.3)

Mobile 390 × 844, densité 3, CPU × 4, cache froid ; 4 tours de 5 passages, ordre alterné.
0.4.5 servie par le site du port 9410, 0.4.4 par celui du port 9412.

| Tour | Version | FCP = LCP (médiane) | LoAF (médiane ; par passage) | Trames lentes | Pire trame | Requêtes / Ko |
|---|---|---|---|---|---|---|
| 1 | 0.4.4 | 828 | 1 ; 1 1 0 1 0 | 0 / 0 | 33 | 9 / 76 |
| 1 | 0.4.5 | 876 | 1 ; 1 0 1 1 1 | 0 / 0 | 50 | 9 / 76 |
| 2 | 0.4.5 | 860 | 1 ; 1 1 0 0 1 | 0 / 0 | 50 | 9 / 76 |
| 2 | 0.4.4 | 832 | 1 ; 1 1 1 1 1 | 0 / 0 | 50 | 9 / 76 |
| 3 | 0.4.4 | 832 | 1 ; 1 1 0 0 1 | 0 / 0 | 33 | 9 / 76 |
| 3 | 0.4.5 | 884 | 1 ; 1 1 1 1 1 | 0 / 0 | 33 | 9 / 76 |
| 4 | 0.4.5 | 852 | 1 ; 1 1 1 0 1 | 0 / 0 | 33 | 9 / 76 |
| 4 | 0.4.4 | 828 | 0 ; 1 0 0 1 0 | 0 / 0 | 50 | 9 / 76 |

Long animation frames, tous tours confondus : 0.4.4, 13 passages sur 20 ; 0.4.5, 16 sur 20.
Modules chargés identiques : background-layers.js, runtime.js, selection.js, styles.js.
