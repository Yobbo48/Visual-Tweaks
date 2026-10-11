<?php
namespace VisualTweaks;
defined('ABSPATH') || exit;

final class Store {
    public static function key(string $page): string { return 'vt_page_' . hash('sha256', $page); }
    public static function get(string $page): array {
        return get_option(self::key($page), ['schemaVersion' => 1, 'page' => $page, 'revision' => 0, 'elements' => []]);
    }

    public static function save(string $page, int $revision, array $elements) {
        $next = ['schemaVersion' => 1, 'page' => $page, 'revision' => $revision + 1, 'elements' => $elements, 'updatedAt' => gmdate('c'), 'updatedBy' => get_current_user_id()];
        return self::compare_and_swap(self::key($page), $revision, $next);
    }

    // Shared atomic primitive for page overrides and the optional site palette.
    public static function compare_and_swap(string $key, int $revision, array $next) {
        global $wpdb;
        $raw = $wpdb->get_var($wpdb->prepare("SELECT option_value FROM {$wpdb->options} WHERE option_name = %s", $key));
        $previous = $raw === null ? ['revision' => 0] : maybe_unserialize($raw);
        if (($previous['revision'] ?? -1) !== $revision) return self::conflict();
        if ($raw === null) {
            // add_option() may upsert on a race. A unique INSERT must never overwrite.
            $count = $wpdb->query($wpdb->prepare("INSERT IGNORE INTO {$wpdb->options} (option_name, option_value, autoload) VALUES (%s, %s, 'no')", $key, maybe_serialize($next)));
        } else {
            $count = $wpdb->query($wpdb->prepare("UPDATE {$wpdb->options} SET option_value = %s WHERE option_name = %s AND option_value = %s", maybe_serialize($next), $key, $raw));
        }
        if ($count === false) return new \WP_Error('vt_database', 'Échec de la sauvegarde. Vos modifications restent dans l’éditeur.', ['status' => 500]);
        if ($count !== 1) return self::conflict();
        wp_cache_delete($key, 'options');
        wp_cache_delete('notoptions', 'options');
        wp_cache_delete('alloptions', 'options');
        return $next;
    }

    private static function conflict() { return new \WP_Error('vt_conflict', 'La page a été modifiée dans une autre session. Exportez votre brouillon puis rechargez ; aucun changement n’a été écrasé.', ['status' => 409]); }
}
