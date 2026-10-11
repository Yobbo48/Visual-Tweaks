<?php
/**
 * Banc de recette Visual Tweaks : copie de test isolée, jamais en production.
 *
 * - Aucun envoi externe : toute requête HTTP sortante est refusée (hors
 *   127.0.0.1), aucun email ne part. WP_HTTP_BLOCK_EXTERNAL et
 *   DISABLE_WP_CRON sont posés par le banc ; ce filtre double la garde.
 * - Médias : les URL publiques des fichiers de uploads/ prennent l'origine
 *   de production (VT_BANC_ORIGINE_MEDIAS). Une retouche d'image enregistre
 *   le src exact (empreinte) : sans cela, le logo de la copie de test ne
 *   correspondrait jamais à la retouche publiée. Le navigateur de recette
 *   sert ces URL depuis la copie locale ; aucune requête n'atteint la
 *   production. Les options importées ne sont pas modifiées.
 */
defined( 'ABSPATH' ) || exit;

add_filter(
	'pre_http_request',
	static function ( $pre, $args, $url ) {
		$hote = wp_parse_url( $url, PHP_URL_HOST );
		if ( in_array( $hote, [ '127.0.0.1', 'localhost' ], true ) ) {
			return $pre;
		}
		error_log( "vt-banc : requête sortante refusée vers $hote" );
		return new WP_Error( 'vt_banc_isole', "Banc isolé : requête sortante refusée ($hote)." );
	},
	1,
	3
);

add_filter(
	'pre_wp_mail',
	static function () {
		error_log( 'vt-banc : email abandonné' );
		return false;
	},
	1
);

if ( defined( 'VT_BANC_ORIGINE_MEDIAS' ) ) {
	add_filter(
		'upload_dir',
		static function ( $dossier ) {
			$dossier['baseurl'] = VT_BANC_ORIGINE_MEDIAS;
			$dossier['url']     = VT_BANC_ORIGINE_MEDIAS . $dossier['subdir'];
			return $dossier;
		}
	);
}
