=== Visual Tweaks ===
Contributors: visual-tweaks
Tags: development, visual-editor, css
Requires at least: 6.5
Tested up to: 7.1
Requires PHP: 8.1
Stable tag: 0.3.3
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Retouches visuelles non destructives pour sites WordPress sur mesure.

== Installation ==
Téléverser le ZIP dans Extensions > Ajouter, activer, puis vérifier Réglages > Visual Tweaks.
L'activation est automatique seulement sur les environnements local/development.
Cliquer Édition visuelle dans la barre d'administration sur une page frontend.
Cliquer un élément pour ses actions ; Assets et Structure donnent accès aux éléments
recouverts. Flèches clavier : 1 px ; Maj + flèche : 10 px, sauf pendant la saisie.
Alt/Cmd clic affiche les éléments empilés. Enregistrer confirme l'état WordPress.
Un échec reste visible et le brouillon est conservé ; un conflit ne force aucun écrasement.

== Description ==
JavaScript natif : édition du texte dans la page, actions contextuelles, déplacement,
poignées de taille, couleurs, polices, espacement, médiathèque et cadrage visuel,
desktop/tablet/mobile, sauvegarde atomique,
undo/redo, reset élément/page et export JSON. Aucun fichier du thème n'est modifié.

Les retouches enregistrées sont visibles publiquement ; l'interface et les brouillons
sont réservés aux comptes manage_options. Les routes exigent un nonce REST.
Les textes sont des overrides de feuilles HTML sans enfants. Les contenus ne sont
pas modifiés côté PHP et peuvent brièvement apparaître avant l'application du runtime.
Le thème doit appeler wp_head/wp_footer et autoriser une iframe de même origine.

Breakpoints : Desktop base, Tablet <= 1023px, Mobile <= 767px.
data-vt-id unique recommandé ; les cibles ambiguës ou incompatibles sont ignorées.
Les caches publics existants doivent être purgés après sauvegarde.

Désactiver dans Réglages > Visual Tweaks ou définir VISUAL_TWEAKS_DISABLED=true
retire tous les overrides sans supprimer les données. Désinstaller conserve les données.
Voir le README.md du projet pour architecture, banc d'essai, limites et roadmap.

== Changelog ==
= 0.3.3 =
Navigation Structure/Assets repliable à gauche, propriétés contextuelles à droite.
Sélection unique synchronisée, expansion des parents, scroll conservé et états de l’arbre.
Inventaire complet des occurrences, fonds résolus/multicouches/pseudo, miniatures et regroupement.
Alignement sémantique élément/contenu, feedback explicite, espacement lié atomique et resets par groupe.
Double-clic stable malgré l’ouverture des propriétés, sélection visible lors des changements d’écran.
Tests ergonomiques Chromium/WebKit/Firefox, sauvegarde et rendu public ; architecture existante conservée.

= 0.3.2 =
Viewport logique indépendant du panneau, canvas zoomé, Adapter / 100 %, largeur Desktop configurable.
Conversions centralisées des coordonnées, preview sans barre admin, diagnostic géométrique.
Reset d’un réglage ou du breakpoint, tests Chromium/WebKit/Firefox et thème réel isolé.

= 0.3.1 =
Dimensions canoniques à quatre décimales avant écriture des retouches et envoi REST.
Correction des mesures de redimensionnement sur les boîtes CSS fractionnaires.
Récupération des anciens brouillons numériques, validation locale explicite sans perte silencieuse.
Tests fit-content, dimensions du thème non persistées, unités, responsive et rechargement.

= 0.3.0 =
Correction des groupes vides JSON pour une sauvegarde fidèle après rechargement.
Erreurs visibles, brouillons préservés, état canonique confirmé par WordPress.
Flèches clavier et boutons, Assets, images adaptatives, SVG racine et fonds CSS.
Remplacement des fonds par médiathèque, point focal, zoom, ombres et voile.
Structure de sélection et Alt/Cmd clic pour les éléments superposés.

= 0.2.0 =
Édition directe sécurisée, toolbar contextuelle, panneau simplifié, couleurs et polices,
redimensionnement 2D avec proportions, déplacement direct et cadrage visuel.
Conservation du stockage, des empreintes, de la sécurité et des conflits.

= 0.1.0 =
Premier MVP autonome, sans IA et sans page builder.
