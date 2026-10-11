=== Visual Tweaks ===
Contributors: visual-tweaks
Tags: development, visual-editor, css
Requires at least: 6.5
Tested up to: 7.1
Requires PHP: 8.1
Stable tag: 0.4.5
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
Les textes sont des overrides des balises texte autorisées, sans enfants HTML.
Les DIV et textes imbriqués ne sont pas éditables dans cette version. Depuis la 0.4.3, les
overrides de style publiés sont aussi imprimés côté serveur dans <head> : ils sont présents
dès le premier affichage, sans saut. Les contenus (texte, lien, image) et les fonds qui
dépendent d'une mesure restent appliqués par le runtime et peuvent brièvement apparaître avant.
Le thème doit appeler wp_head/wp_footer et autoriser une iframe de même origine.

Breakpoints : Desktop base, Tablette <= 1023px, Mobile <= 767px.
data-vt-id unique recommandé ; les cibles ambiguës ou incompatibles sont ignorées.
Les caches publics existants doivent être purgés après sauvegarde.

Désactiver dans Réglages > Visual Tweaks ou définir VISUAL_TWEAKS_DISABLED=true
retire tous les overrides sans supprimer les données. Désinstaller conserve les données.
Voir le README.md du projet pour architecture, banc d'essai, limites et roadmap.

== Changelog ==
= 0.4.5 =
Éditeur économe en ressources. L'éditeur s'ouvre dans son propre document (styles, médiathèque,
éditeur) : le thème ne tourne plus en double, invisible, derrière l'interface, mais seulement dans
l'aperçu, inchangé. Navigation : délai fixe au lieu d'un report à chaque mutation (une animation
continue ne bloque plus les mises à jour), panneau Assets reconstruit seulement si son contenu
change, Structure reconstruite par branche, rien n'est traité tant que la navigation est masquée
(panneau fermé, onglet en arrière-plan). Contour : aucune lecture de géométrie sans sélection,
barre contextuelle placée sans mise en page forcée. Édition allégée (facultative, réversible d'un
clic) : dans l'aperçu, boucles d'animation du thème ralenties, animations infinies et vidéos en
pause. Site public, données, historique et brouillons inchangés.

= 0.4.4 =
Éditeur plus fluide : le contour de sélection suit le défilement une fois par image, lectures de
géométrie regroupées avant les écritures (moins de recalculs forcés), arbre de navigation peint en
deux temps. Conservation : une sauvegarde interrompue par un départ de page est reconnue au retour
(plus de faux conflit), une réponse perdue n'est plus prise pour un conflit, le jeton REST expiré
est renouvelé une fois, les réponses illisibles et coupures réseau ont un message clair, un conflit
réel propose d'exporter ou de remplacer explicitement la version enregistrée (téléchargée avant),
un autre onglet sur la même page est signalé. Publication : purge LiteSpeed de la seule page
publiée ; le CDN Hostinger (vidé seulement pour tout le site) est proposé, jamais vidé
automatiquement ; le message dit ce que voient les visiteurs. Rendu serveur : imprimé en fin de
<head> (même cascade que le runtime) ; pour un élément avec voile, couches ou zoom de fond, seules
ces parties restent au runtime. Aucune donnée ni format de stockage modifiés.

= 0.4.3 =
Overrides de style publiés rendus côté serveur dans <head> (#vt-published-styles) : même CSS
que le runtime, même !important, mêmes media queries, même spécificité (0,1,0), présents dès
le premier affichage. Le runtime neutralise cette feuille avant sa première mesure, dans la
même tâche que son propre rendu : aucune double application ni image intermédiaire.
Second verrou : chaque règle exige html:not([data-vt-runtime]), attribut posé par le runtime,
pour rester sûr si un optimiseur (LiteSpeed CSS Combine, etc.) déplace ces règles.
Restent au runtime seul : contenus (texte, lien, image), voile, couches et zoom de fond.
Jamais imprimé dans l'éditeur ni dans son cadre de prévisualisation. Stockage, REST,
brouillon, éditeur et garde d'empreinte inchangés.

= 0.4.2 =
Audit responsive : limite des 1500 éléments présentée comme couverture partielle,
sans faux bouton Voir ni comptage comme problème. Nombre total d’éléments indiqué.
L’information reste visible même lorsque les 40 recommandations sont atteintes.
Voir conservé pour les alertes qui ciblent un élément ; aucune règle nouvelle.

= 0.4.1 =
Correction d’un faux positif Responsive Guard : enfants d’un parent transparent exclus.
Contrôle de visibilité hérité mis en cache seulement pendant chaque mesure.
Défilement de sélection instantané malgré le scroll animé du thème : toolbar stabilisée.
Effacer un réglage actualise son indication avec la valeur réellement appliquée.
Documentation harmonisée : fonds multicouches remplaçables par couche URL simple,
libellés image, texte simple autorisé, workflow de confort et limites cache/base de données.
Tests supplémentaires de session réelle, décodage image et cache public ; PNG du fixture corrigé.
Aucune nouvelle fonction.
Stockage schema v1, REST/CAS, draft, Runtime, sélection et historique conservés.

= 0.4.0 =
Base 0.3.4 corrigée conservée, checkpoint et tests de référence avant modification.
Modifications : liste dérivée des overrides, Voir, reset annulable et reset page confirmé.
Modifier / Naviguer sans perte de sélection ou brouillon ; autre page en nouvel onglet.
Guides et snap en pixels CSS logiques, Ctrl suspend le snap pendant le drag.
Exceptions responsive et origine héritée explicites ; audit des trois viewports à la demande.
Corrections proposées, prévisualisées puis appliquées explicitement comme overrides normaux.
Remplacement média d’une couche URL de fond sans retirer gradients/autres couches/styles.
Mesure à la demande, profilage et tests de confort sur les trois moteurs.
Texte riche et DIV reportés après étude ; édition du texte simple et architecture conservées.

= 0.3.4 =
Correction du blocage par brouillon local : restauration automatique sur la même révision,
décision visible et export fidèle pour une révision différente ; retour à la bonne révision CAS.
Cycle de vie iframe réactivable, attente du runtime et état editor-ready réel.
Prévisualisation ciblée du drag sans mutation/state/REST jusqu’au relâchement.
Mises à jour CSSOM ciblées pour les petites retouches, avec renderer complet en fallback.
Caches Structure/Assets et miniatures, découverte incrémentale avec MutationObserver.
Cadres de survol synchronisés avec les panneaux et polices système correctement appliquées.
Presets d’arrondi/espacement, copier/coller des overrides, palette globale facultative
avec validation stricte et sauvegarde atomique indépendante. Aucun effet/composant ajouté.

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
