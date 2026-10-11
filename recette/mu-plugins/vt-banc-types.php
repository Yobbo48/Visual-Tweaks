<?php
/**
 * Banc de recette : type « ressource » et taxonomie « ressource_theme ».
 * En production, ils viennent d'un mu-plugin non fourni ; ses réglages
 * (réécriture d'URL…) et sa fonction edr_get_resource_url() sont inconnus.
 * Sans cette fonction, le thème laisse ses listes de ressources inactives :
 * différence assumée et signalée, hors de l'accueil.
 */
defined( 'ABSPATH' ) || exit;

add_action(
	'init',
	static function () {
		register_post_type( 'ressource', [
			'label'        => 'Ressources (banc)',
			'public'       => true,
			'show_in_rest' => true,
			'rewrite'      => [ 'slug' => 'ressource' ],
			'supports'     => [ 'title', 'editor', 'excerpt', 'thumbnail', 'custom-fields', 'page-attributes' ],
		] );
		register_taxonomy( 'ressource_theme', 'ressource', [
			'label'        => 'Thèmes de ressources (banc)',
			'public'       => true,
			'hierarchical' => true,
			'show_in_rest' => true,
		] );
	},
	5
);
