<?php
/**
 * Banc de recette : préparation de la copie de test, au démarrage du site.
 * Exécuté par le blueprint (runPHP), dans le WordPress isolé seulement.
 *
 * - comptes de test ;
 * - options de Visual Tweaks importées octet pour octet depuis l'export de
 *   production, relues puis comparées par empreinte SHA-256 ; les options
 *   absentes en production restent absentes ;
 * - si l'export des contenus est fourni (contenus-production.json, suivi de
 *   son IMPORT.md) : réglages, pièces jointes sans régénération, pages
 *   (contenu brut, non filtré, vérifié par empreinte), témoignages,
 *   ressource, réglages du thème ; logo réel posé comme logo personnalisé
 *   sur le banc seulement (absent de la base de production) ;
 * - sinon : page « accueil » vide et logo de substitution (recette/substituts.py).
 *
 * Résultat : entrees/import-resultat.json, à côté des exports.
 */
require '/wordpress/wp-load.php';
global $wpdb;
$entrees  = '/wordpress/wp-content/vt-banc-entrees';
$resultat = [ 'date' => gmdate( 'c' ), 'wordpress' => get_bloginfo( 'version' ), 'php_import' => PHP_VERSION, 'visual_tweaks' => defined( 'VT_VERSION' ) ? VT_VERSION : null, 'theme' => wp_get_theme()->get( 'Version' ) ];
$contenus = is_readable( "$entrees/contenus-production.json" ) ? json_decode( file_get_contents( "$entrees/contenus-production.json" ), true ) : null;

foreach ( [ 'vt-admin' => 'administrator', 'vt-subscriber' => 'subscriber' ] as $login => $role ) {
	if ( ! get_user_by( 'login', $login ) ) {
		$id = wp_create_user( $login, 'vt-local-only-9410', "$login@example.test" );
		( new WP_User( $id ) )->set_role( $role );
	}
}

if ( ! $contenus ) {
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
}

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
if ( ! $contenus && $logo_src && preg_match( '#/wp-content/uploads/((\d{4}/\d{2})/(.+?))-(\d+)x(\d+)\.(\w+)$#', $logo_src, $m ) ) {
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
} elseif ( ! $contenus ) {
	$resultat['logo'] = [ 'erreur' => 'retouche du logo absente de l\'export : aucun substitut posé' ];
}


// Contenus de production (IMPORT.md), à chaque démarrage, sans doublon.
if ( $contenus ) {
	kses_remove_filters(); // contenu brut : commentaires de blocs et marqueurs intacts
	$r = $contenus['reglages'];
	foreach ( [ 'blogname', 'blogdescription', 'permalink_structure', 'show_on_front' ] as $cle ) update_option( $cle, $r[ $cle ] );
	$trouver = static function ( $type, $cle, $valeur ) {
		$ids = get_posts( [ 'post_type' => $type, 'post_status' => 'any', 'numberposts' => 1, 'fields' => 'ids', 'meta_key' => $cle, 'meta_value' => (string) $valeur ] );
		return $ids ? (int) $ids[0] : 0;
	};
	$carte = []; // id_source → nouvel ID (pièces jointes et pages)

	// Pièces jointes, depuis les fichiers fournis, sans régénération.
	foreach ( $contenus['pieces_jointes'] as $pj ) {
		$id = $trouver( 'attachment', '_vt_banc_id_source', $pj['id_source'] );
		$donnees = [ 'post_title' => $pj['titre'], 'post_mime_type' => $pj['mime'], 'post_status' => 'inherit', 'post_type' => 'attachment' ];
		$id = $id ? wp_update_post( [ 'ID' => $id ] + $donnees ) : wp_insert_post( $donnees );
		update_post_meta( $id, '_vt_banc_id_source', $pj['id_source'] );
		update_post_meta( $id, '_wp_attached_file', $pj['fichier'] );
		update_post_meta( $id, '_wp_attachment_metadata', $pj['meta'] );
		update_post_meta( $id, '_wp_attachment_image_alt', $pj['alt'] );
		$carte[ (int) $pj['id_source'] ] = $id;
		$manquants = array_values( array_filter( $pj['fichiers'], static fn( $f ) => ! is_file( WP_CONTENT_DIR . "/uploads/$f" ) ) );
		$resultat['pieces_jointes'][] = [ 'id_source' => $pj['id_source'], 'id' => $id, 'fichiers' => count( $pj['fichiers'] ), 'fichiers_absents' => $manquants ];
	}

	// Pages : parents d'abord, contenu brut vérifié par empreinte.
	$pages = $contenus['pages'];
	usort( $pages, static fn( $a, $b ) => ( null !== $a['parent'] ) <=> ( null !== $b['parent'] ) );
	$par_slug = [];
	foreach ( $pages as $p ) {
		$parent = $p['parent'] ? ( $par_slug[ $p['parent'] ] ?? 0 ) : 0;
		$existante = get_page_by_path( $p['parent'] ? "{$p['parent']}/{$p['slug']}" : $p['slug'] );
		$donnees = [ 'post_type' => 'page', 'post_status' => 'publish', 'post_name' => $p['slug'], 'post_title' => $p['titre'], 'post_content' => $p['contenu'], 'post_excerpt' => $p['extrait'] ?? '', 'menu_order' => (int) $p['menu_order'], 'post_parent' => $parent ];
		$id = $existante ? wp_update_post( wp_slash( [ 'ID' => $existante->ID ] + $donnees ) ) : wp_insert_post( wp_slash( $donnees ) );
		if ( $p['gabarit'] ) update_post_meta( $id, '_wp_page_template', $p['gabarit'] );
		foreach ( $p['metadonnees_publiques'] ?? [] as $cle => $valeur ) update_post_meta( $id, $cle, wp_slash( $valeur ) );
		if ( isset( $p['id_source'] ) ) $carte[ (int) $p['id_source'] ] = $id;
		$par_slug[ $p['slug'] ] = $id;
		$stocke = get_post_field( 'post_content', $id, 'raw' );
		$resultat['pages'][ $p['slug'] ] = [ 'id' => $id, 'contenu_identique' => hash( 'sha256', $stocke ) === hash( 'sha256', $p['contenu'] ), 'octets' => strlen( $p['contenu'] ) ];
	}
	update_option( 'page_on_front', $par_slug[ $r['page_on_front'] ] ?? 0 );
	// Contenus par défaut de WordPress, absents de la production.
	foreach ( [ [ 'sample-page', 'page' ], [ 'hello-world', 'post' ] ] as [ $slug, $type ] ) {
		$defaut = get_page_by_path( $slug, OBJECT, $type );
		if ( $defaut ) wp_delete_post( $defaut->ID, true );
	}

	// Témoignages : remplacés à chaque import.
	foreach ( get_posts( [ 'post_type' => 'temoignage', 'post_status' => 'any', 'numberposts' => -1, 'fields' => 'ids' ] ) as $ancien ) wp_delete_post( $ancien, true );
	foreach ( $contenus['temoignages'] as $t ) {
		$id = wp_insert_post( wp_slash( [ 'post_type' => 'temoignage', 'post_status' => 'publish', 'post_title' => $t['titre'], 'post_content' => $t['contenu'], 'menu_order' => (int) $t['menu_order'], 'post_date_gmt' => $t['date'], 'post_date' => get_date_from_gmt( $t['date'] ) ] ) );
		if ( '' !== (string) $t['service'] ) update_post_meta( $id, '_temo_service', $t['service'] );
	}
	$resultat['temoignages'] = count( $contenus['temoignages'] );

	// Ressource publiée, taxonomies, métadonnées publiques remappées.
	foreach ( $contenus['contenus_dynamiques'] as $c ) {
		// Pas get_page_by_path() : il cherche aussi les pièces jointes (même slug que l'image de la ressource).
		$existante = get_posts( [ 'post_type' => $c['type'], 'name' => $c['slug'], 'post_status' => 'any', 'numberposts' => 1 ] )[0] ?? null;
		$donnees = [ 'post_type' => $c['type'], 'post_status' => 'publish', 'post_name' => $c['slug'], 'post_title' => $c['titre'], 'post_content' => $c['contenu'], 'post_excerpt' => $c['extrait'], 'menu_order' => (int) $c['menu_order'], 'post_date' => $c['date'] ];
		$id = $existante ? wp_update_post( wp_slash( [ 'ID' => $existante->ID ] + $donnees ) ) : wp_insert_post( wp_slash( $donnees ) );
		$remap = [];
		foreach ( $c['metadonnees_publiques'] as $cle => $valeur ) {
			if ( in_array( $cle, [ '_thumbnail_id', '_edr_linked_page_id' ], true ) ) {
				$valeur = $carte[ (int) $valeur ] ?? null;
				// Page liée sans id_source dans l'export : seule page enfant de « ressources »
				// sans identifiant source, déduction signalée.
				if ( null === $valeur && '_edr_linked_page_id' === $cle ) {
					foreach ( $contenus['pages'] as $p ) {
						if ( ! isset( $p['id_source'] ) && 'ressources' === $p['parent'] ) {
							$valeur = $par_slug[ $p['slug'] ];
							$remap[ $cle ] = "déduit : {$p['slug']}";
						}
					}
				}
				if ( null === $valeur ) { $remap[ $cle ] = 'non remappé'; continue; }
				$remap[ $cle ] = $remap[ $cle ] ?? 'remappé';
			}
			update_post_meta( $id, $cle, $valeur );
		}
		foreach ( $c['taxonomies'] as $terme ) {
			$t = term_exists( $terme['slug'], $terme['taxonomy'] ) ?: wp_insert_term( $terme['name'], $terme['taxonomy'], [ 'slug' => $terme['slug'], 'description' => $terme['description'] ] );
			wp_set_object_terms( $id, [ (int) ( $t['term_id'] ?? 0 ) ], $terme['taxonomy'], true );
		}
		$resultat['ressources'][ $c['slug'] ] = [ 'id' => $id, 'remappage' => $remap ];
	}

	// Icône du site, réglages du thème, options réellement définies.
	if ( ! empty( $r['site_icon'] ) ) update_option( 'site_icon', $carte[ (int) $r['site_icon'] ] ?? 0 );
	foreach ( $contenus['theme_mods'] as $cle => $valeur ) set_theme_mod( $cle, $valeur );
	foreach ( $contenus['options_theme'] as $cle => $o ) {
		if ( 'définie' === ( $o['etat'] ?? '' ) ) update_option( $cle, $o['valeur'] );
	}
	// Menus : recréés s'ils sont fournis (liste vide : emplacement laissé libre).
	$resultat['menus'] = array_map( 'count', $contenus['menus'] );

	// Logo : absent de la base de production (custom_logo) ; le média réel
	// (site_icon, ID 22) est posé comme logo sur le banc seulement.
	$logo = $carte[ (int) ( $r['site_icon'] ?? 0 ) ] ?? 0;
	set_theme_mod( 'custom_logo', $logo );
	$src = $logo ? ( wp_get_attachment_image_src( $logo, 'thumbnail' )[0] ?? null ) : null;
	$resultat['logo'] = [ 'id' => $logo, 'adaptation' => 'custom_logo posé sur le banc seulement', 'src_identique_empreinte' => $src === $logo_src ];
}

file_put_contents( "$entrees/import-resultat.json", wp_json_encode( $resultat, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) );
