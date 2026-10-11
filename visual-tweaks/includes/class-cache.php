<?php
namespace VisualTweaks;
defined('ABSPATH') || exit;

/**
 * Caches de page après une publication (0.4.4).
 *
 * Les retouches publiées sont dans le HTML de la page (configuration du runtime
 * et CSS serveur) : un cache de page sert l'ancienne version tant qu'il n'est
 * pas purgé. Après une sauvegarde confirmée, et seulement alors :
 * - LiteSpeed Cache : purge de la seule URL publiée (`litespeed_purge_url`,
 *   exécutée par LiteSpeed à la fin de la requête REST) ;
 * - CDN Hostinger : son extension ne sait vider que tout le site (cache serveur
 *   et CDN). Ce n'est jamais fait automatiquement : l'éditeur propose l'action,
 *   explicite, avec l'adresse de la route officielle de l'extension Hostinger.
 * Une purge ne peut jamais faire échouer la sauvegarde : son état est seulement
 * rapporté, pour que l'éditeur ne présente pas la page publique comme à jour.
 * Le style du site n'est jamais rendu côté public : aucune page à purger.
 */
final class Cache {
    public static function after_publish(string $page): array {
        $url = home_url($page);
        $report = ['url' => $url, 'litespeed' => 'absent', 'cdn' => null];
        if (defined('LSCWP_V') || has_action('litespeed_purge_url')) {
            try {
                // Pas de notification « Purge url » laissée dans l'administration.
                if (!defined('LITESPEED_PURGE_SILENT')) define('LITESPEED_PURGE_SILENT', true);
                do_action('litespeed_purge_url', $url);
                $report['litespeed'] = 'purged';
            } catch (\Throwable $error) {
                $report['litespeed'] = 'failed';
            }
        }
        if (defined('HOSTINGER_PLUGIN_REST_API_BASE') && current_user_can('manage_options')) {
            $report['cdn'] = ['provider' => 'hostinger', 'scope' => 'site', 'purge' => rest_url(trim((string) HOSTINGER_PLUGIN_REST_API_BASE, '/') . '/clear-cache')];
        }
        /** Permet à un site de brancher sa propre invalidation (CDN, proxy). */
        return apply_filters('visual_tweaks_after_publish', $report, $page);
    }
}
