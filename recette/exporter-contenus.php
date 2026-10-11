<?php
/**
 * Export en lecture seule des contenus nécessaires à une recette sur pages
 * complètes (complète l'export des options vt_*). Aucune écriture : lecture
 * des pages, témoignages, menus, réglages du thème et options affichées.
 *
 * Sur le serveur de production, sortie directement sur le poste local :
 *   ssh <compte> "cd <racine WordPress> && wp eval-file -" < recette/exporter-contenus.php > contenus-production.json
 *
 * Exclus volontairement : comptes, commentaires, commandes, adresses
 * collectées (edr_inscrits), jetons (Canva…) et toute option que le thème
 * n'affiche pas. Seules les options déclarées dans les réglages du thème
 * (edr_options()) sont exportées.
 *
 * Les médias ne sont pas dans cet export : sa liste « medias » donne les
 * chemins sous wp-content/uploads/ à télécharger en HTTPS (fichiers publics).
 */
defined( 'ABSPATH' ) || exit;

$chemin_media = static function ( $url ) {
	$base = wp_get_upload_dir()['baseurl'];
	return 0 === strpos( $url, $base . '/' ) ? substr( $url, strlen( $base ) + 1 ) : null;
};
$medias  = [];
$relever = static function ( $texte ) use ( &$medias, $chemin_media ) {
	if ( preg_match_all( '#https?://[^\s"\'()<>]+/wp-content/uploads/[^\s"\'()<>?]+#', (string) $texte, $m ) ) {
		foreach ( $m[0] as $url ) {
			$p = $chemin_media( $url );
			if ( $p ) $medias[ $p ] = true;
		}
	}
};
$slug = static function ( $id ) {
	$p = $id ? get_post( $id ) : null;
	return $p ? $p->post_name : null;
};

$sortie = [
	'site'        => home_url( '/' ),
	'exported_at' => gmdate( 'c' ),
	'read_only'   => true,
	'versions'    => [
		'wordpress'     => get_bloginfo( 'version' ),
		'php'           => PHP_VERSION,
		'theme'         => wp_get_theme()->get( 'Version' ),
		'visual_tweaks' => defined( 'VT_VERSION' ) ? VT_VERSION : null,
	],
	'extensions'  => [],
];
foreach ( (array) get_option( 'active_plugins', [] ) as $fichier ) {
	$entete = get_file_data( WP_PLUGIN_DIR . '/' . $fichier, [ 'nom' => 'Plugin Name', 'version' => 'Version' ] );
	$sortie['extensions'][] = [ 'fichier' => $fichier ] + $entete;
}

$sortie['reglages'] = [
	'blogname'           => get_option( 'blogname' ),
	'blogdescription'    => get_option( 'blogdescription' ),
	'permalink_structure' => get_option( 'permalink_structure' ),
	'show_on_front'      => get_option( 'show_on_front' ),
	'page_on_front'      => $slug( (int) get_option( 'page_on_front' ) ),
];

$sortie['pages'] = [];
foreach ( get_posts( [ 'post_type' => 'page', 'post_status' => 'publish', 'numberposts' => -1, 'orderby' => 'menu_order title', 'order' => 'ASC' ] ) as $p ) {
	$relever( $p->post_content );
	$sortie['pages'][] = [
		'slug'       => $p->post_name,
		'titre'      => $p->post_title,
		'parent'     => $slug( $p->post_parent ),
		'menu_order' => $p->menu_order,
		'gabarit'    => get_post_meta( $p->ID, '_wp_page_template', true ),
		'contenu'    => $p->post_content,
	];
}

$sortie['temoignages'] = [];
foreach ( get_posts( [ 'post_type' => 'temoignage', 'post_status' => 'publish', 'numberposts' => -1, 'orderby' => [ 'menu_order' => 'ASC', 'date' => 'DESC' ] ] ) as $t ) {
	$sortie['temoignages'][] = [
		'titre'      => $t->post_title,
		'contenu'    => $t->post_content,
		'menu_order' => $t->menu_order,
		'date'       => $t->post_date_gmt,
		'service'    => get_post_meta( $t->ID, '_temo_service', true ),
	];
}

$sortie['menus'] = [];
foreach ( get_nav_menu_locations() as $emplacement => $menu_id ) {
	$elements = wp_get_nav_menu_items( $menu_id ) ?: [];
	$index    = array_flip( array_map( static fn( $e ) => $e->ID, $elements ) );
	$sortie['menus'][ $emplacement ] = array_map(
		static fn( $e ) => [
			'titre'   => $e->title,
			'url'     => $e->url,
			'type'    => $e->type,
			'objet'   => $e->object,
			'cible'   => 'post_type' === $e->type ? $slug( (int) $e->object_id ) : null,
			'parent'  => $e->menu_item_parent ? ( $index[ (int) $e->menu_item_parent ] ?? null ) : null,
			'classes' => array_values( array_filter( (array) $e->classes ) ),
			'target'  => $e->target,
		],
		$elements
	);
}

$mods = get_theme_mods() ?: [];
unset( $mods['nav_menu_locations'], $mods['custom_css_post_id'] );
$logo = (int) ( $mods['custom_logo'] ?? 0 );
if ( $logo ) {
	$meta = wp_get_attachment_metadata( $logo ) ?: [];
	$mods['custom_logo'] = [ 'fichier' => $meta['file'] ?? get_post_meta( $logo, '_wp_attached_file', true ), 'meta' => $meta, 'mime' => get_post_mime_type( $logo ) ];
	$dossier = dirname( (string) $mods['custom_logo']['fichier'] );
	$medias[ $mods['custom_logo']['fichier'] ] = true;
	foreach ( $meta['sizes'] ?? [] as $taille ) $medias[ "$dossier/{$taille['file']}" ] = true;
}
$sortie['theme_mods'] = $mods;
$relever( wp_json_encode( $mods ) );

// Options affichées : déclarées dans les réglages du thème, ou lues par
// edr_opt() dans ses gabarits (textes du bandeau d'accueil, par exemple).
$cles = [];
if ( function_exists( 'edr_options' ) ) {
	foreach ( edr_options() as $groupe ) $cles = array_merge( $cles, array_keys( $groupe['champs'] ?? [] ) );
}
$fichiers = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( get_template_directory(), FilesystemIterator::SKIP_DOTS ) );
foreach ( $fichiers as $f ) {
	if ( 'php' === $f->getExtension() && preg_match_all( "#edr_opt\\(\\s*'([a-z0-9_]+)'#", (string) file_get_contents( $f->getPathname() ), $m ) ) {
		$cles = array_merge( $cles, $m[1] );
	}
}
$sortie['options_theme'] = [];
foreach ( array_unique( $cles ) as $cle ) {
	$valeur = get_option( $cle, null );
	$sortie['options_theme'][ $cle ] = null === $valeur ? [ 'etat' => 'absente' ] : [ 'etat' => '' === $valeur ? 'vide' : 'définie', 'valeur' => $valeur ];
	$relever( $valeur );
}

$sortie['menus']  = (object) $sortie['menus'];
$sortie['medias'] = array_keys( $medias );
sort( $sortie['medias'] );
echo wp_json_encode( $sortie, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
