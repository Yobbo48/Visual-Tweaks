<?php
namespace VisualTweaks;
defined('ABSPATH') || exit;

final class Plugin {
    public static function boot(): void {
        add_action('admin_menu', [self::class, 'settings_menu']);
        add_action('rest_api_init', [self::class, 'routes']);
        add_action('admin_bar_menu', [self::class, 'toolbar'], 90);
        add_action('wp_enqueue_scripts', [self::class, 'assets'], 99);
        // Fin du <head>, comme la feuille du runtime : même ordre de cascade (0.4.4).
        add_action('wp_head', [self::class, 'published_styles'], 1000);
        add_action('template_redirect', [self::class, 'private_preview']);
        add_filter('show_admin_bar', [self::class, 'preview_admin_bar'], PHP_INT_MAX);
        add_filter('script_loader_tag', [self::class, 'module'], 10, 3);
    }

    public static function enabled(): bool {
        if (defined('VISUAL_TWEAKS_DISABLED') && VISUAL_TWEAKS_DISABLED) return false;
        return (bool) get_option('vt_enabled', in_array(wp_get_environment_type(), ['local', 'development'], true));
    }
    public static function allowed(): bool { return self::enabled() && current_user_can('manage_options'); }
    private static function editing(): bool { return self::allowed() && isset($_GET['vt-edit']) && !isset($_GET['vt-frame']); }

    public static function preview_admin_bar(bool $show): bool {
        return self::allowed() && isset($_GET['vt-frame']) ? false : $show;
    }

    public static function private_preview(): void {
        if (self::allowed() && (isset($_GET['vt-edit']) || isset($_GET['vt-frame']))) {
            if (!defined('DONOTCACHEPAGE')) define('DONOTCACHEPAGE', true);
            nocache_headers();
            header('Cache-Control: private, no-store, max-age=0');
        }
    }

    public static function toolbar($bar): void {
        if (is_admin() || !self::allowed() || isset($_GET['vt-frame'])) return;
        $bar->add_node(['id' => 'visual-tweaks', 'title' => 'Édition visuelle', 'href' => add_query_arg('vt-edit', '1'), 'meta' => ['title' => 'Activer Visual Tweaks']]);
    }

    public static function assets(): void {
        if (is_admin() || !self::enabled()) return;
        $page = Schema::page(wp_unslash($_SERVER['REQUEST_URI'] ?? '/'));
        if (is_wp_error($page)) return;
        $data = Store::get($page);
        $editing = self::editing();
        if (!$editing && !$data['elements'] && !(self::allowed() && isset($_GET['vt-frame']))) return;
        $config = ['schemaVersion' => 1, 'page' => $page, 'revision' => $data['revision'], 'elements' => Schema::hydrate($data['elements']), 'breakpoints' => Schema::BREAKPOINTS];
        if ($editing) {
            $config['editor'] = ['api' => rest_url('visual-tweaks/v1/page'), 'nonce' => wp_create_nonce('wp_rest'), 'home' => home_url('/'), 'userId' => get_current_user_id(), 'siteStyle' => SiteStyle::get(), 'styleApi' => rest_url('visual-tweaks/v1/site-style'), 'desktopWidth' => max(320, min(3840, (int) get_option('vt_desktop_width', 1440))), 'nonceUrl' => admin_url('admin-ajax.php?action=rest-nonce')];
            wp_enqueue_media();
        }
        wp_enqueue_script('vt-runtime', VT_URL . 'assets/runtime.js', [], VT_VERSION, true);
        wp_add_inline_script('vt-runtime', 'window.VisualTweaksConfig = ' . wp_json_encode($config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) . ';', 'before');
        if ($editing) wp_enqueue_script('vt-editor', VT_URL . 'assets/editor.js', ['vt-runtime'], VT_VERSION, true);
    }

    /**
     * Overrides publiés, rendus côté serveur pour le premier affichage (0.4.3).
     * Mêmes conditions que le runtime public ; jamais dans l'éditeur ni dans
     * son cadre de prévisualisation, où le runtime reste seul comme avant.
     * Le runtime neutralise cette feuille avant sa première mesure.
     */
    public static function published_styles(): void {
        if (is_admin() || !self::enabled()) return;
        if (self::allowed() && (isset($_GET['vt-edit']) || isset($_GET['vt-frame']))) return;
        $page = Schema::page(wp_unslash($_SERVER['REQUEST_URI'] ?? '/'));
        if (is_wp_error($page)) return;
        $data = Store::get($page);
        if (empty($data['elements'])) return;
        $css = PublishedStyles::css(Schema::hydrate($data['elements']));
        if ($css !== '') echo "<style id=\"vt-published-styles\">\n" . $css . "\n</style>\n";
    }

    public static function module(string $tag, string $handle, string $src): string {
        if (in_array($handle, ['vt-runtime', 'vt-editor'], true)) {
            // WordPress may include before/after inline configuration in this fragment.
            $html = new \WP_HTML_Tag_Processor($tag);
            while ($html->next_tag('SCRIPT')) {
                if ($html->get_attribute('id') === $handle . '-js') $html->set_attribute('type', 'module');
            }
            return $html->get_updated_html();
        }
        return $tag;
    }

    public static function routes(): void {
        register_rest_route('visual-tweaks/v1', '/site-style', [
            ['methods' => 'GET', 'permission_callback' => [self::class, 'permission'], 'callback' => [SiteStyle::class, 'read']],
            ['methods' => 'PUT', 'permission_callback' => [self::class, 'permission'], 'callback' => [SiteStyle::class, 'write']],
        ]);
        register_rest_route('visual-tweaks/v1', '/page', [
            ['methods' => 'GET', 'permission_callback' => [self::class, 'permission'], 'callback' => [self::class, 'read']],
            ['methods' => 'PUT', 'permission_callback' => [self::class, 'permission'], 'callback' => [self::class, 'write']],
        ]);
    }
    public static function permission($request) {
        if (!self::allowed()) return new \WP_Error('vt_forbidden', 'Accès réservé aux administrateurs autorisés.', ['status' => 403]);
        if (!wp_verify_nonce($request->get_header('X-WP-Nonce'), 'wp_rest')) return new \WP_Error('vt_nonce', 'Session expirée : exportez votre brouillon puis reconnectez-vous.', ['status' => 403]);
        return true;
    }
    public static function read($request) {
        $page = Schema::page($request->get_param('page'));
        if (is_wp_error($page)) return $page;
        $data = Store::get($page); $data['elements'] = Schema::hydrate($data['elements']);
        $response = new \WP_REST_Response($data); $response->header('Cache-Control', 'private, no-store'); return $response;
    }
    public static function write($request) {
        if (strlen($request->get_body()) > 300000) return new \WP_Error('vt_size', 'Brouillon trop volumineux.', ['status' => 413]);
        $body = $request->get_json_params();
        if (!is_array($body) || !isset($body['page'], $body['revision'], $body['elements']) || !is_int($body['revision']) || $body['revision'] < 0) return new \WP_Error('vt_request', 'Requête invalide.', ['status' => 400]);
        $page = Schema::page($body['page']); if (is_wp_error($page)) return $page;
        $elements = Schema::elements($body['elements']); if (is_wp_error($elements)) return $elements;
        $saved = Store::save($page, $body['revision'], $elements); if (is_wp_error($saved)) return $saved;
        $saved['elements'] = Schema::hydrate($saved['elements']);
        // La sauvegarde est confirmée : l'état des caches est seulement rapporté.
        $saved['cache'] = Cache::after_publish($page);
        $response = new \WP_REST_Response($saved); $response->header('Cache-Control', 'private, no-store'); return $response;
    }

    public static function settings_menu(): void {
        add_options_page('Visual Tweaks', 'Visual Tweaks', 'manage_options', 'visual-tweaks', [self::class, 'settings']);
    }
    public static function settings(): void {
        if (!current_user_can('manage_options')) return;
        if (isset($_POST['vt_settings'])) {
            check_admin_referer('vt_settings');
            update_option('vt_enabled', isset($_POST['vt_enabled']), false);
            $width = isset($_POST['vt_desktop_width']) ? filter_var(wp_unslash($_POST['vt_desktop_width']), FILTER_VALIDATE_INT) : false;
            if ($width !== false && $width >= 320 && $width <= 3840) update_option('vt_desktop_width', $width, false);
            echo '<div class="notice notice-success"><p>Configuration enregistrée.</p></div>';
        }
        echo '<div class="wrap"><h1>Visual Tweaks</h1><p>Retouches non destructives, enregistrées séparément du thème. Désactiver retire l’éditeur et les overrides sans supprimer les données.</p><form method="post">';
        wp_nonce_field('vt_settings');
        echo '<input type="hidden" name="vt_settings" value="1"><label><input type="checkbox" name="vt_enabled" value="1" ' . checked(self::enabled(), true, false) . '> Activer Visual Tweaks sur cet environnement</label>';
        echo '<p>Environnement : <code>' . esc_html(wp_get_environment_type()) . '</code>. Activé par défaut uniquement en local/development.</p>';
        if (defined('VISUAL_TWEAKS_DISABLED') && VISUAL_TWEAKS_DISABLED) echo '<p><strong>Arrêt forcé par VISUAL_TWEAKS_DISABLED.</strong></p>';
        echo '<p><label>Largeur Desktop par défaut <input type="number" name="vt_desktop_width" min="320" max="3840" value="' . esc_attr((string) get_option('vt_desktop_width', 1440)) . '"> px</label></p>';
        submit_button(); echo '</form></div>';
    }
}
