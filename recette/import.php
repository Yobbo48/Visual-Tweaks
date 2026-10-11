<?php
/**
 * Banc de recette : préparation de la copie de test, au démarrage du site.
 * Exécuté par le blueprint (runPHP), dans le WordPress isolé seulement.
 *
 * - comptes de test ;
 * - page « accueil » (contenu vide) en page d'accueil statique : le thème ne
 *   sert css/accueil.css qu'à une page de ce nom, comme en production ;
 *   pages des gabarits du thème pour la navigation ;
 * - options de Visual Tweaks importées octet pour octet depuis l'export de
 *   production, relues puis comparées par empreinte SHA-256 ; les options
 *   absentes en production restent absentes ;
 * - logo : pièce jointe de substitution au chemin et aux dimensions de la
 *   production (fichier réel non fourni), posée comme logo personnalisé.
 *
 * Résultat : entrees/import-resultat.json, à côté de l'export.
 */
require '/wordpress/wp-load.php';
global $wpdb;
$entrees  = '/wordpress/wp-content/vt-banc-entrees';
$resultat = [ 'date' => gmdate( 'c' ), 'wordpress' => get_bloginfo( 'version' ), 'visual_tweaks' => defined( 'VT_VERSION' ) ? VT_VERSION : null, 'theme' => wp_get_theme()->get( 'Version' ) ];

foreach ( [ 'vt-admin' => 'administrator', 'vt-subscriber' => 'subscriber' ] as $login => $role ) {
	if ( ! get_user_by( 'login', $login ) ) {
		$id = wp_create_user( $login, 'vt-local-only-9410', "$login@example.test" );
		( new WP_User( $id ) )->set_role( $role );
	}
}

$page = static function ( $slug, $titre ) {
	$existante = get_page_by_path( $slug );
	return $existante ? $existante->ID : wp_insert_post( [ 'post_type' => 'page', 'post_status' => 'publish', 'post_name' => $slug, 'post_title' => $titre, 'post_content' => '' ] );
};
$accueil = $page( 'accueil', 'Accueil' );
update_option( 'show_on_front', 'page' );
update_option( 'page_on_front', $accueil );
foreach ( [ 'soins-energetiques' => 'Soins énergétiques', 'guidances' => 'Guidances', 'contact' => 'Contact', 'a-propos' => 'À propos' ] as $slug => $titre ) {
	$page( $slug, $titre );
}
$resultat['pages'] = [ 'accueil' => $accueil ];

// Options de Visual Tweaks, octet pour octet.
$export = json_decode( file_get_contents( "$entrees/visual-tweaks-options-production.json" ), true );
$lire   = static fn( $nom ) => $wpdb->get_row( $wpdb->prepare( "SELECT option_value, autoload FROM {$wpdb->options} WHERE option_name = %s", $nom ), ARRAY_A );
$resultat['options'] = [];
foreach ( $export['options'] as $o ) {
	$brut = base64_decode( $o['raw_base64'], true );
	$ligne = [ 'option_name' => $o['option_name'], 'empreinte_export' => $o['raw_sha256'] ];
	if ( false === $brut || hash( 'sha256', $brut ) !== $o['raw_sha256'] ) {
		$ligne['erreur'] = "empreinte de l'export invalide : option non importée";
		$resultat['options'][] = $ligne;
		continue;
	}
	$wpdb->delete( $wpdb->options, [ 'option_name' => $o['option_name'] ] );
	$wpdb->insert( $wpdb->options, [ 'option_name' => $o['option_name'], 'option_value' => $brut, 'autoload' => $o['autoload'] ] );
	wp_cache_delete( $o['option_name'], 'options' );
	$relu = $lire( $o['option_name'] );
	$ligne['empreinte_relue'] = $relu ? hash( 'sha256', $relu['option_value'] ) : null;
	$ligne['autoload']        = $relu['autoload'] ?? null;
	$ligne['identique']       = $ligne['empreinte_relue'] === $o['raw_sha256'];
	$valeur = maybe_unserialize( $relu['option_value'] ?? '' );
	if ( is_array( $valeur ) ) {
		$ligne['revision'] = $valeur['revision'] ?? null;
		$ligne['elements'] = isset( $valeur['elements'] ) ? array_column( $valeur['elements'], 'selector' ) : null;
	}
	$resultat['options'][] = $ligne;
}
$resultat['absentes'] = [];
foreach ( $export['absent_options'] ?? [] as $nom ) {
	$wpdb->delete( $wpdb->options, [ 'option_name' => $nom ] );
	wp_cache_delete( $nom, 'options' );
	$resultat['absentes'][ $nom ] = null === $lire( $nom ) ? 'absente' : 'PRÉSENTE';
}
wp_cache_delete( 'alloptions', 'options' );
wp_cache_delete( 'notoptions', 'options' );

// Logo de substitution, au chemin et aux dimensions de la production : le
// chemin vient de l'empreinte enregistrée de la retouche du logo (src exact),
// les fichiers de recette/substituts.py.
$logo_src = null;
foreach ( $export['options'] as $o ) {
	foreach ( $o['value']['elements'] ?? [] as $e ) {
		if ( 'img' === ( $e['fingerprint']['tag'] ?? '' ) && in_array( 'logo__sceau', $e['fingerprint']['classes'] ?? [], true ) ) {
			$logo_src = $e['fingerprint']['src'] ?? null;
		}
	}
}
if ( $logo_src && preg_match( '#/wp-content/uploads/((\d{4}/\d{2})/(.+?))-(\d+)x(\d+)\.(\w+)$#', $logo_src, $m ) ) {
	[ , $fichier, $sous_dossier, , $l, $h, $ext ] = $m;
	$vignette = basename( $fichier ) . "-{$l}x{$h}.$ext";
	$uploads  = wp_upload_dir( $sous_dossier );
	foreach ( [ basename( $fichier ), $vignette ] as $nom ) {
		copy( "$entrees/substituts/$sous_dossier/$nom", $uploads['path'] . "/$nom" );
	}
	$logo = (int) get_theme_mod( 'custom_logo' );
	if ( ! $logo || ! get_post( $logo ) ) {
		$logo = wp_insert_attachment( [ 'post_mime_type' => 'image/jpeg', 'post_title' => 'Logo (substitut de banc)', 'post_status' => 'inherit' ], $uploads['basedir'] . "/$fichier" );
		set_theme_mod( 'custom_logo', $logo );
	}
	update_post_meta( $logo, '_wp_attached_file', $fichier );
	wp_update_attachment_metadata( $logo, [
		'width'  => 512,
		'height' => 512,
		'file'   => $fichier,
		'sizes'  => [ 'thumbnail' => [ 'file' => $vignette, 'width' => (int) $l, 'height' => (int) $h, 'mime-type' => "image/$ext" ] ],
	] );
	$resultat['logo'] = [ 'id' => $logo, 'src_identique_empreinte' => wp_get_attachment_image_src( $logo, 'thumbnail' )[0] === $logo_src ];
} else {
	$resultat['logo'] = [ 'erreur' => 'retouche du logo absente de l\'export : aucun substitut posé' ];
}

file_put_contents( "$entrees/import-resultat.json", wp_json_encode( $resultat, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) );
