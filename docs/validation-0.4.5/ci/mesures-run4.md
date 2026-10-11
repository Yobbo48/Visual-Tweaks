## Ressources (Chromium, banc animé, une fenêtre par ligne)

| Scénario | Version | CPU moyen % | pic % | fil principal % | script ms/s | style/s | mise en page/s | thème ms/s | éditeur ms/s | runtime ms/s | rendu natif ms/s | rAF thème haut / cadre | tas Mo | nœuds |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| public | 0.4.4 | 23.2 | 28 | 3.8 | 5.3 | 120.3 | 0.8 | 7.3 | 0 | 0 | 33.3 | 60.1 / 0 | 1 | 202 |
| public | 0.4.5 | 23 | 27 | 3.7 | 5.3 | 120.2 | 0.8 | 7.9 | 0 | 0 | 31.4 | 60.1 / 0 | 1 | 202 |
| public-defilement | 0.4.4 | 16.7 | 33 | 4.3 | 4.9 | 120.9 | 4.5 | 8 | 0 | 0 | 33.2 | 60.1 / 0 | 1.66 | 202 |
| public-defilement | 0.4.5 | 17.1 | 34 | 4.2 | 4.8 | 120.5 | 4.5 | 7.1 | 0 | 0 | 34 | 60.1 / 0 | 1.66 | 202 |
| repos | 0.4.4 | 32.3 | 69.9 | 9.6 | 10.7 | 240.8 | 1.8 | 17.9 | 0.5 | 0 | 55.2 | 60.2 / 60.2 | 3.81 | 1696 |
| repos | 0.4.5 | 23.1 | 54.9 | 7.2 | 6.3 | 120.5 | 0.9 | 6.6 | 0.2 | 0 | 42.3 | 0 / 60.2 | 3.77 | 1402 |
| repos | 0.4.5 allégé | 7.1 | 38.9 | 2.6 | 0.9 | 7.9 | 0.9 | 0.3 | 0.3 | 0 | 2.9 | 0 / 0 | 4.35 | 1407 |
| repos-selection | 0.4.4 | 33.6 | 69.9 | 11.1 | 11.1 | 241 | 1.7 | 19.4 | 0.3 | 0 | 61.4 | 60.2 / 60.2 | 5.19 | 3153 |
| repos-selection | 0.4.5 | 24.3 | 60 | 9 | 7 | 120.5 | 0.8 | 7.1 | 0.8 | 0.3 | 50 | 0 / 60.2 | 5.15 | 2859 |
| repos-selection | 0.4.5 allégé | 8.2 | 38.9 | 3.3 | 1.6 | 11.3 | 0.8 | 0.3 | 0.3 | 0.6 | 3.5 | 0 / 0 | 5.16 | 2864 |
| defilement | 0.4.4 | 33.3 | 78 | 13 | 12.7 | 262.6 | 19.6 | 16.8 | 3.4 | 0 | 76.4 | 60.2 / 60.2 | 5.14 | 2879 |
| defilement | 0.4.5 | 22.5 | 69.9 | 10.7 | 8.1 | 145.5 | 13.2 | 7.1 | 3.2 | 0 | 65 | 0 / 60.2 | 5.07 | 2585 |
| defilement | 0.4.5 allégé | 17.6 | 60 | 5.9 | 3.8 | 69.8 | 16.8 | 1 | 2.1 | 0.1 | 26.6 | 0 / 0 | 5.1 | 2590 |
| interactions | 0.4.4 | 33.9 | 73 | 13 | 16.1 | 271.3 | 28.2 | 17.8 | 8.5 | 0.6 | 76.6 | 60.1 / 60.1 | 5.59 | 3171 |
| interactions | 0.4.5 | 21.9 | 64 | 10.3 | 10.9 | 149.1 | 22.1 | 7.5 | 7.2 | 0.8 | 62.5 | 0 / 60.1 | 5.55 | 2877 |
| interactions | 0.4.5 allégé | 14.6 | 51.9 | 5.3 | 6 | 58.2 | 22.9 | 0.3 | 7 | 1.1 | 20.5 | 0 / 0 | 5.57 | 2883 |
| navigations | 0.4.4 | 35.2 | 44 | 10.4 | 11 | 242.4 | 1.8 | 17.2 | 0.5 | 0 | 81.9 | 60.3 / 60.3 | 5.02 | 2878 |
| navigations | 0.4.5 | 23.2 | 27 | 7.6 | 6.6 | 121.2 | 0.9 | 6.8 | 0.5 | 0 | 60.6 | 0 / 60.3 | 5.03 | 2584 |
| navigations | 0.4.5 allégé | 5.9 | 8 | 1 | 1.3 | 10.2 | 1 | 0.4 | 0.2 | 0 | 5.4 | 0 / 0 | 4.99 | 2589 |
| masque-retour | 0.4.4 | 34.9 | 71 | 11.6 | 10.8 | 240.8 | 1.9 | 17.5 | 0.5 | 0 | 63.5 | 60.2 / 60.2 | 5.19 | 3153 |
| masque-retour (retour) | 0.4.4 | 38.2 | 45 | 8.9 | 11.1 | 240.4 | 1.8 | 17.6 | 0.7 | 0 | 71 | 60.2 / 60.2 | 5.2 | 3153 |
| masque-retour | 0.4.5 | 25.1 | 60.9 | 9.5 | 7.1 | 120.6 | 1 | 6.7 | 0.5 | 0.2 | 49.3 | 0 / 60.3 | 5.23 | 2859 |
| masque-retour (retour) | 0.4.5 | 23.2 | 25.9 | 6.3 | 6.9 | 120.2 | 0.9 | 6.4 | 0.9 | 0.2 | 49.9 | 0 / 60.1 | 5.26 | 2859 |
| masque-retour | 0.4.5 allégé | 9.6 | 45 | 4.3 | 2 | 11.8 | 1 | 0.6 | 0.6 | 0.5 | 5 | 0 / 0 | 5.24 | 2864 |
| masque-retour (retour) | 0.4.5 allégé | 5.8 | 9 | 0.8 | 2 | 11.1 | 0.9 | 0.1 | 1 | 0.6 | 4.3 | 0 / 0 | 5.25 | 2864 |

## Performances publiques (médianes de 3 passages)

| Profil | Cache | Tour | Version | FCP | LCP | CLS | longues tâches | LoAF | trames lentes chargement / défilement | pire trame | requêtes | Ko | modules VT |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| desktop | froid | 1 | 0.4.4 | 648 | 648 | 0 | 0 | 0 | 0 / 0 | 17 | 9 | 76 | assets/background-layers.js, assets/runtime.js, assets/selection.js, assets/styles.js |
| desktop | froid | 1 | 0.4.5 | 648 | 648 | 0 | 0 | 0 | 0 / 0 | 17 | 9 | 76 | assets/background-layers.js, assets/runtime.js, assets/selection.js, assets/styles.js |
| desktop | froid | 2 | 0.4.5 | 624 | 624 | 0 | 0 | 0 | 0 / 0 | 17 | 9 | 76 | assets/background-layers.js, assets/runtime.js, assets/selection.js, assets/styles.js |
| desktop | froid | 2 | 0.4.4 | 652 | 652 | 0 | 0 | 0 | 0 / 0 | 17 | 9 | 76 | assets/background-layers.js, assets/runtime.js, assets/selection.js, assets/styles.js |
| desktop | chaud | 1 | 0.4.4 | 636 | 636 | 0 | 0 | 0 | 0 / 0 | 17 | 9 | 76 | assets/background-layers.js, assets/runtime.js, assets/selection.js, assets/styles.js |
| desktop | chaud | 1 | 0.4.5 | 632 | 632 | 0 | 0 | 0 | 0 / 0 | 17 | 9 | 76 | assets/background-layers.js, assets/runtime.js, assets/selection.js, assets/styles.js |
| desktop | chaud | 2 | 0.4.5 | 624 | 624 | 0 | 0 | 0 | 0 / 0 | 17 | 9 | 76 | assets/background-layers.js, assets/runtime.js, assets/selection.js, assets/styles.js |
| desktop | chaud | 2 | 0.4.4 | 608 | 608 | 0 | 0 | 0 | 0 / 0 | 17 | 9 | 76 | assets/background-layers.js, assets/runtime.js, assets/selection.js, assets/styles.js |
| mobile | froid | 1 | 0.4.4 | 748 | 748 | 0 | 0 | 0 | 0 / 0 | 33 | 9 | 76 | assets/background-layers.js, assets/runtime.js, assets/selection.js, assets/styles.js |
| mobile | froid | 1 | 0.4.5 | 720 | 720 | 0 | 0 | 1 | 0 / 0 | 33 | 9 | 76 | assets/background-layers.js, assets/runtime.js, assets/selection.js, assets/styles.js |
| mobile | froid | 2 | 0.4.5 | 732 | 732 | 0 | 0 | 1 | 0 / 0 | 33 | 9 | 76 | assets/background-layers.js, assets/runtime.js, assets/selection.js, assets/styles.js |
| mobile | froid | 2 | 0.4.4 | 716 | 716 | 0 | 0 | 0 | 0 / 0 | 33 | 9 | 76 | assets/background-layers.js, assets/runtime.js, assets/selection.js, assets/styles.js |
| mobile | chaud | 1 | 0.4.4 | 748 | 748 | 0 | 0 | 0 | 0 / 0 | 33 | 9 | 76 | assets/background-layers.js, assets/runtime.js, assets/selection.js, assets/styles.js |
| mobile | chaud | 1 | 0.4.5 | 724 | 724 | 0 | 0 | 0 | 0 / 0 | 33 | 9 | 76 | assets/background-layers.js, assets/runtime.js, assets/selection.js, assets/styles.js |
| mobile | chaud | 2 | 0.4.5 | 720 | 720 | 0 | 0 | 0 | 0 / 0 | 33 | 9 | 76 | assets/background-layers.js, assets/runtime.js, assets/selection.js, assets/styles.js |
| mobile | chaud | 2 | 0.4.4 | 724 | 724 | 0 | 0 | 0 | 0 / 0 | 50 | 9 | 76 | assets/background-layers.js, assets/runtime.js, assets/selection.js, assets/styles.js |
