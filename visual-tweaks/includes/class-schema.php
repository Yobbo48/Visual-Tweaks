<?php
namespace VisualTweaks;
defined('ABSPATH') || exit;

final class Schema {
    public const BREAKPOINTS = ['desktop' => 0, 'tablet' => 1023, 'mobile' => 767];
    private const ENUMS = [
        'display' => ['block'],
        'align-self' => ['auto', 'start', 'end', 'center', 'stretch', 'flex-start', 'flex-end'],
        'justify-self' => ['auto', 'start', 'end', 'center', 'stretch'],
        'justify-items' => ['normal', 'start', 'end', 'center', 'stretch'],
        'position' => ['static', 'relative', 'sticky'],
        'text-align' => ['left', 'center', 'right', 'justify', 'start', 'end'],
        'align-items' => ['normal', 'start', 'end', 'center', 'stretch', 'baseline', 'flex-start', 'flex-end'],
        'justify-content' => ['normal', 'start', 'end', 'center', 'space-between', 'space-around', 'space-evenly', 'flex-start', 'flex-end'],
        'background-size' => ['cover', 'contain', 'auto'],
        'background-repeat' => ['no-repeat', 'repeat'],
        'object-fit' => ['fill', 'contain', 'cover', 'none', 'scale-down'],
        'visibility' => ['visible', 'hidden'],
        'border-style' => ['none', 'solid', 'dashed', 'dotted'],
        'font-style' => ['normal', 'italic'],
        'text-transform' => ['none', 'uppercase', 'lowercase', 'capitalize'],
    ];
    private const LENGTHS = ['translateX', 'translateY', 'width', 'height', 'max-width', 'min-width', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'gap', 'font-size', 'letter-spacing', 'border-radius', 'border-width'];

    public static function page($value) {
        if (!is_string($value) || strlen($value) > 1000 || !preg_match('~^/(?!/)[^<>\\x00-\\x20#]*$~D', $value)) {
            return new \WP_Error('vt_page', 'Chemin de page invalide.', ['status' => 400]);
        }
        $parts = wp_parse_url($value);
        if (!$parts || isset($parts['host'])) return new \WP_Error('vt_page', 'Page invalide.', ['status' => 400]);
        $query = [];
        if (!empty($parts['query'])) parse_str($parts['query'], $query);
        foreach (array_keys($query) as $key) {
            if (in_array($key, ['vt-edit', 'vt-frame', 'vt-session', '_wpnonce', 'fbclid', 'gclid'], true) || str_starts_with($key, 'utm_')) unset($query[$key]);
        }
        ksort($query);
        return ($parts['path'] ?? '/') . ($query ? '?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986) : '');
    }

    public static function selector($value): bool {
        if (!is_string($value) || strlen($value) > 500) return false;
        if (preg_match('/^\[data-vt-id="[a-zA-Z0-9_-]{1,100}"\]$/D', $value)) return true;
        $part = '(?:[a-z][a-z0-9-]*)?(?:[.#][a-zA-Z_][a-zA-Z0-9_-]*)*(?::nth-of-type\([1-9][0-9]{0,3}\))?';
        return $value !== '' && !preg_match('/(?:^| > )(?:html|script|style|iframe|input|textarea|select|option|form)(?:$|[.#: >])/i', $value)
            && (bool) preg_match('/^' . $part . '(?: > ' . $part . '){0,5}$/D', $value)
            && !preg_match('/(?:^| > )(?= > |$)/', $value);
    }

    public static function value(string $property, $value): bool {
        if (!is_string($value) || strlen($value) > ($property === 'font-family' ? 240 : 80)) return false;
        if (isset(self::ENUMS[$property])) return in_array($value, self::ENUMS[$property], true);
        if ($property === 'font-family') return (bool) preg_match('/^(?:"[\p{L}\p{N} _-]{1,80}"|[a-zA-Z][a-zA-Z0-9 -]{0,79})(?:, (?:"[\p{L}\p{N} _-]{1,80}"|[a-zA-Z][a-zA-Z0-9 -]{0,79})){0,5}$/uD', $value);
        if (in_array($property, self::LENGTHS, true)) {
            if ($value === 'fit-content') return $property === 'width';
            if ($value === 'auto') return str_starts_with($property, 'margin-') || in_array($property, ['width', 'height'], true);
            if ($value === 'none') return $property === 'max-width';
            if (!preg_match('/^(-?(?:\d{1,5}(?:\.\d{1,4})?|\.\d{1,4}))(px|%|rem|em|vw|vh)?$/D', $value, $match)) return false;
            $number = (float) $match[1];
            if ($number !== 0.0 && empty($match[2])) return false;
            return $number >= 0 || in_array($property, ['translateX', 'translateY', 'letter-spacing'], true) || str_starts_with($property, 'margin-');
        }
        if (in_array($property, ['color', 'background-color', 'border-color'], true)) return (bool) preg_match('/^(?:#[a-fA-F0-9]{3}|#[a-fA-F0-9]{6}|#[a-fA-F0-9]{8}|transparent|currentColor)$/D', $value);
        if ($property === 'opacity') return is_numeric($value) && (float) $value >= 0 && (float) $value <= 1;
        if ($property === 'font-weight') return (bool) preg_match('/^[1-9]00$/D', $value);
        if ($property === 'z-index') return $value === 'auto' || (bool) preg_match('/^-?\d{1,6}$/D', $value);
        if ($property === 'line-height') return (bool) preg_match('/^(?:normal|(?:\d{1,3}(?:\.\d{1,4})?|\.\d{1,4})(?:px|%|rem|em)?)$/D', $value);
        if ($property === 'imageZoom') return (bool) preg_match('/^(?:1[0-9]{2}|200)$/D', $value);
        if ($property === 'overlay-color') return (bool) preg_match('/^(?:#[a-fA-F0-9]{6}|#[a-fA-F0-9]{8}|transparent)$/D', $value);
        if ($property === 'box-shadow') return $value === 'none' || (bool) preg_match('/^(?:-?\d{1,3}px ){2}\d{1,3}px -?\d{1,3}px #[a-fA-F0-9]{8}$/D', $value);
        if ($property === 'filter') return $value === 'none' || (bool) preg_match('/^blur\((?:[0-9]|1[0-2])px\)$/D', $value);
        if (in_array($property, ['object-position','background-position'], true)) return (bool) preg_match('/^(?:100|[0-9]{1,2})(?:\.\d{1,2})?% (?:100|[0-9]{1,2})(?:\.\d{1,2})?%$/D', $value) && max(array_map('floatval', explode(' ', $value))) <= 100;
        return false;
    }

    public static function elements($input) {
        if (!is_array($input) || !array_is_list($input) || count($input) > 200) return self::error('Maximum 200 éléments par page, sous forme de liste.');
        $clean = []; $seen = [];
        foreach ($input as $element) {
            if (!is_array($element) || !isset($element['id'], $element['selector'], $element['fingerprint'], $element['changes'])) return self::error('Élément incomplet.');
            $id = $element['id'];
            if (!is_string($id) || !preg_match('/^[a-zA-Z0-9_-]{1,100}$/D', $id) || isset($seen[$id]) || !self::selector($element['selector'])) return self::error('Identifiant ou sélecteur invalide.');
            $seen[$id] = true;
            $fp = $element['fingerprint'];
            if (!is_array($fp) || !isset($fp['tag'], $fp['classes']) || !is_string($fp['tag']) || !preg_match('/^[a-z][a-z0-9-]{0,40}$/D', $fp['tag']) || in_array($fp['tag'], ['script','style','iframe','input','textarea','select','form','html','body'], true) || !is_array($fp['classes']) || count($fp['classes']) > 30) return self::error('Empreinte invalide.');
            foreach ($fp['classes'] as $class) if (!is_string($class) || !preg_match('/^[a-zA-Z_][a-zA-Z0-9_-]{0,100}$/D', $class)) return self::error('Classe invalide.');
            $fingerprint = ['tag' => $fp['tag'], 'classes' => array_values($fp['classes'])];
            foreach (['anchor', 'text', 'src', 'background'] as $key) {
                if (isset($fp[$key])) {
                    if (!is_string($fp[$key]) || strlen($fp[$key]) > 4000) return self::error('Empreinte trop longue.');
                    $fingerprint[$key] = $fp[$key];
                }
            }
            $changes = [];
            if (!is_array($element['changes'])) return self::error('Réglages invalides.');
            foreach ($element['changes'] as $mode => $properties) {
                if (!array_key_exists($mode, self::BREAKPOINTS) || !is_array($properties) || count($properties) > 64) return self::error('Breakpoint invalide.');
                $changes[$mode] = [];
                foreach ($properties as $property => $value) {
                    if (!self::value($property, $value)) return self::error('Valeur refusée : ' . sanitize_text_field($property));
                    $changes[$mode][$property] = $value;
                }
            }
            $result = ['id' => $id, 'selector' => $element['selector'], 'strategy' => in_array($element['strategy'] ?? '', ['data', 'id', 'class', 'hierarchy'], true) ? $element['strategy'] : 'hierarchy', 'fingerprint' => $fingerprint, 'changes' => $changes];
            if (isset($element['content'])) {
                if (!is_array($element['content'])) return self::error('Contenu invalide.');
                if (array_key_exists('text', $element['content'])) {
                    $text = $element['content']['text'];
                    if (!is_string($text) || strlen($text) > 4000 || !in_array($fp['tag'], ['p','h1','h2','h3','h4','h5','h6','span','strong','em','a','button','li','small','figcaption'], true)) return self::error('Texte non éditable.');
                    // Applied with textContent, never interpreted as HTML. Preserve literal < and >.
                    $result['content']['text'] = str_replace(["\0", "\r"], ['', ''], $text);
                }
                if (isset($element['content']['href'])) {
                    $href = $element['content']['href'];
                    if ($fp['tag'] !== 'a' || !is_string($href) || strlen($href) > 2000 || !self::href($href)) return self::error('Lien invalide : utilisez https, http, mailto, tel ou un chemin relatif.');
                    $result['content']['href'] = $href;
                }
                if (isset($element['content']['backgroundLayers'])) {
                    $layers = $element['content']['backgroundLayers'];
                    if ($fp['tag'] === 'img' || !isset($fp['background']) || !is_array($layers) || !array_is_list($layers) || count($layers) > 20 || !current_user_can('upload_files')) return self::error('Couches de fond invalides.');
                    $indexes = []; $clean_layers = [];
                    foreach ($layers as $layer) {
                        if (!is_array($layer) || !isset($layer['layer'], $layer['attachmentId']) || !is_int($layer['layer']) || $layer['layer'] < 0 || $layer['layer'] > 19 || isset($indexes[$layer['layer']]) || !is_int($layer['attachmentId']) || $layer['attachmentId'] < 1 || !wp_attachment_is_image($layer['attachmentId'])) return self::error('Couche ou image de médiathèque invalide.');
                        $indexes[$layer['layer']] = true;
                        $clean_layers[] = ['layer' => $layer['layer'], 'attachmentId' => $layer['attachmentId']];
                    }
                    $result['content']['backgroundLayers'] = $clean_layers;
                }
                if (isset($element['content']['attachmentId'])) {
                    $attachment = $element['content']['attachmentId'];
                    if (($fp['tag'] !== 'img' && !isset($fp['background'])) || !is_int($attachment) || $attachment < 1 || !wp_attachment_is_image($attachment) || !current_user_can('upload_files')) return self::error('Image de médiathèque invalide.');
                    if ($fp['tag'] !== 'img') $result['content']['assetKind'] = 'background';
                    $result['content']['attachmentId'] = $attachment;
                }
            }
            $clean[] = $result;
        }
        return $clean;
    }

    public static function hydrate(array $elements): array {
        foreach ($elements as &$element) {
            // JSON object maps must stay objects even when empty (legacy storage uses arrays).
            foreach ($element['changes'] as &$properties) $properties = (object) $properties;
            unset($properties);
            $element['changes'] = (object) $element['changes'];
            if (!empty($element['content']['backgroundLayers'])) {
                foreach ($element['content']['backgroundLayers'] as &$layer) {
                    $src = wp_get_attachment_image_url($layer['attachmentId'], 'full');
                    if ($src) $layer['image'] = ['src' => esc_url_raw($src), 'alt' => (string) get_post_meta($layer['attachmentId'], '_wp_attachment_image_alt', true)];
                }
                unset($layer);
            }
            if (!empty($element['content']['attachmentId'])) {
                $id = $element['content']['attachmentId'];
                $src = wp_get_attachment_image_url($id, 'full');
                if ($src) $element['content']['image'] = ['src' => esc_url_raw($src), 'alt' => (string) get_post_meta($id, '_wp_attachment_image_alt', true)];
            }
        }
        return $elements;
    }

    public static function href(string $value): bool {
        if ($value === '') return true;
        if (preg_match('/[\x00-\x20<>"\\\\]/', $value) || str_starts_with($value, '//')) return false;
        if (preg_match('~^(?:https?://|mailto:|tel:)~i', $value)) return (bool) esc_url_raw($value, ['http', 'https', 'mailto', 'tel']);
        return !preg_match('~^[^/?#]*:~', $value);
    }

    private static function error(string $message) { return new \WP_Error('vt_schema', $message, ['status' => 400]); }
}
