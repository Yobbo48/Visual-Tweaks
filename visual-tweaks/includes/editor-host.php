<?php
/**
 * Document hôte de l'éditeur (0.4.5).
 *
 * Jusqu'à la 0.4.4, l'éditeur s'ouvrait par-dessus la page du thème : cette
 * copie, cachée derrière l'interface, exécutait les scripts et les animations
 * du thème en double de l'aperçu. Le thème ne tourne plus que dans l'aperçu
 * (le cadre `vt-frame`, rendu normal et complet). Ici : les feuilles de style
 * enfilées (polices du site pour les aperçus de police), la médiathèque et
 * l'éditeur, sans gabarit ni script du thème.
 */
namespace VisualTweaks;
defined('ABSPATH') || exit;
wp_enqueue_scripts();
?><!doctype html>
<html <?php language_attributes(); ?> class="vt-editor-document">
<head>
<meta charset="<?php bloginfo('charset'); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title><?php echo esc_html('Visual Tweaks — ' . wp_get_document_title()); ?></title>
<?php wp_print_styles(); ?>
<style id="vt-editor-document">html.vt-editor-document{overflow-y:scroll}html.vt-editor-document,html.vt-editor-document>body{margin:0;min-height:0;animation:none!important;transition:none!important}html.vt-editor-document::before,html.vt-editor-document::after,html.vt-editor-document>body::before,html.vt-editor-document>body::after{content:none!important;display:none!important}</style>
</head>
<body class="vt-editor-document">
<?php
wp_print_media_templates();
wp_print_scripts(Plugin::editor_scripts());
?>
</body>
</html>
