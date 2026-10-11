<?php
/**
 * Restauration des données de Visual Tweaks depuis un export brut
 * (production-options-vt.json : valeur sérialisée en base64, telle qu'en base).
 *
 *   wp eval-file restaurer-options-vt.php production-options-vt.json          # simulation
 *   wp eval-file restaurer-options-vt.php production-options-vt.json --appliquer
 *
 * - Ne supprime aucune option : seules les options de l'export sont réécrites.
 *   Une option vt_* absente de l'export n'est pas touchée (elle est signalée).
 * - Écrit la valeur brute octet pour octet (pas de re-sérialisation), puis
 *   relit et compare l'empreinte SHA-256.
 * - Avant écriture, la valeur actuelle de chaque option remplacée est copiée
 *   dans un fichier « avant-restauration-<date>.json » à côté de l'export.
 */
global $wpdb;
$fichier = $args[0] ?? '';
$appliquer = in_array( '--appliquer', $args ?? [], true );
if ( ! $fichier || ! is_readable( $fichier ) ) { echo "Export introuvable : $fichier\n"; return; }
$export = json_decode( file_get_contents( $fichier ), true );
if ( ! is_array( $export['options'] ?? null ) ) { echo "Export illisible.\n"; return; }

$lire = fn( $nom ) => $wpdb->get_row( $wpdb->prepare( "SELECT option_value, autoload FROM {$wpdb->options} WHERE option_name = %s", $nom ), ARRAY_A );
$avant = [];
foreach ( $export['options'] as $o ) {
	$brut = base64_decode( $o['raw_base64'], true );
	if ( $brut === false || hash( 'sha256', $brut ) !== $o['raw_sha256'] ) { echo "Empreinte invalide pour {$o['option_name']} : arrêt, rien n'a été écrit.\n"; return; }
	$actuel = $lire( $o['option_name'] );
	$avant[] = [ 'option_name' => $o['option_name'], 'existait' => (bool) $actuel, 'autoload' => $actuel['autoload'] ?? null,
		'raw_base64' => $actuel ? base64_encode( $actuel['option_value'] ) : null, 'raw_sha256' => $actuel ? hash( 'sha256', $actuel['option_value'] ) : null ];
	$etat = ! $actuel ? 'absente' : ( hash( 'sha256', $actuel['option_value'] ) === $o['raw_sha256'] ? 'identique' : 'différente' );
	echo str_pad( $o['option_name'], 76 ) . " actuelle : $etat\n";
}
$connues = array_column( $export['options'], 'option_name' );
foreach ( $wpdb->get_col( "SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE 'vt\\_%'" ) as $nom )
	if ( ! in_array( $nom, $connues, true ) ) echo str_pad( $nom, 76 ) . " hors export : conservée telle quelle\n";
if ( ! $appliquer ) { echo "Simulation : rien n'a été écrit. Ajoutez --appliquer.\n"; return; }

$copie = dirname( $fichier ) . '/avant-restauration-' . gmdate( 'Ymd-His' ) . '.json';
if ( false === file_put_contents( $copie, wp_json_encode( [ 'saved_at' => gmdate( 'c' ), 'options' => $avant ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) ) ) { echo "Copie de sécurité impossible ($copie) : arrêt.\n"; return; }
echo "Copie des valeurs actuelles : $copie\n";
$ok = 0;
foreach ( $export['options'] as $o ) {
	$brut = base64_decode( $o['raw_base64'], true );
	$actuel = $lire( $o['option_name'] );
	if ( $actuel ) $wpdb->update( $wpdb->options, [ 'option_value' => $brut, 'autoload' => $o['autoload'] ], [ 'option_name' => $o['option_name'] ] );
	else $wpdb->insert( $wpdb->options, [ 'option_name' => $o['option_name'], 'option_value' => $brut, 'autoload' => $o['autoload'] ] );
	wp_cache_delete( $o['option_name'], 'options' );
	$relu = $lire( $o['option_name'] );
	$bon = $relu && hash( 'sha256', $relu['option_value'] ) === $o['raw_sha256'];
	$ok += $bon ? 1 : 0;
	echo str_pad( $o['option_name'], 76 ) . ( $bon ? " restaurée (empreinte identique)\n" : " ÉCHEC de relecture\n" );
}
wp_cache_delete( 'notoptions', 'options' );
wp_cache_delete( 'alloptions', 'options' );
echo "$ok / " . count( $export['options'] ) . " options restaurées. Purger ensuite LiteSpeed et le cache Hostinger.\n";
