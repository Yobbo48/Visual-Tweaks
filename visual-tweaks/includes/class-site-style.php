<?php
namespace VisualTweaks;
defined('ABSPATH') || exit;

final class SiteStyle {
    public const COLORS = ['primary', 'secondary', 'accent', 'text', 'background'];
    public const FONTS = ['heading', 'body'];
    public static function get(): array {
        return get_option('vt_site_style', ['revision' => 0, 'colors' => (object) [], 'fonts' => (object) [], 'radius' => '', 'shadow' => '']);
    }
    public static function read($request) {
        $response = new \WP_REST_Response(self::get());
        $response->header('Cache-Control', 'private, no-store');
        return $response;
    }
    public static function write($request) {
        $input = $request->get_json_params();
        if (strlen($request->get_body()) > 4000 || !is_array($input) || !isset($input['revision']) || !is_int($input['revision']) || $input['revision'] < 0 || array_diff(array_keys($input), ['revision', 'colors', 'fonts', 'radius', 'shadow'])) return self::error();
        $next = ['revision' => $input['revision'] + 1];
        foreach (['colors' => self::COLORS, 'fonts' => self::FONTS] as $group => $roles) {
            $values = $input[$group] ?? [];
            if (!is_array($values) || array_diff(array_keys($values), $roles)) return self::error();
            $clean = [];
            foreach ($values as $role => $value) {
                if (!is_string($value) || ($value !== '' && !Schema::value($group === 'colors' ? 'color' : 'font-family', $value))) return self::error();
                if ($value !== '') $clean[$role] = $value;
            }
            $next[$group] = (object) $clean;
        }
        foreach (['radius' => 'border-radius', 'shadow' => 'box-shadow'] as $key => $property) {
            $value = $input[$key] ?? '';
            if (!is_string($value) || ($value !== '' && !Schema::value($property, $value))) return self::error();
            $next[$key] = $value;
        }
        $saved = Store::compare_and_swap('vt_site_style', $input['revision'], $next);
        if (is_wp_error($saved)) return $saved;
        $response = new \WP_REST_Response($saved);
        $response->header('Cache-Control', 'private, no-store');
        return $response;
    }
    private static function error() { return new \WP_Error('vt_style', 'Style du site invalide. Utilisez les couleurs, polices et presets autorisés.', ['status' => 400]); }
}
