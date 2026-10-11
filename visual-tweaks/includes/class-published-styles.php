<?php
namespace VisualTweaks;
defined('ABSPATH') || exit;

/**
 * Rendu serveur des retouches publiées (0.4.3).
 *
 * Le runtime n'applique ses overrides qu'une fois les modules JavaScript
 * chargés, donc après le premier affichage : une retouche de position ou de
 * taille provoquait un saut visible. Ce rendu imprime dans <head> le même CSS
 * que styles.js/generateCSS(), pour les visiteurs, afin qu'il soit présent
 * dès le premier rendu.
 *
 * - Mêmes déclarations, même !important, mêmes media queries.
 * - Même spécificité que [data-vt-target="…"] (0,1,0) : :where() sur le
 *   sélecteur enregistré et sur l'empreinte (étiquette, classes stables,
 *   src d'une image), plus :not([data-vt-published-off]).
 * - Le runtime neutralise ces règles avant sa première mesure, dans la
 *   même tâche que son propre rendu : il reste seul maître ensuite (bases
 *   de translation, garde d'empreinte, contenus, éditeur). Aucune double
 *   application, aucune image intermédiaire.
 * - Deux verrous : la balise reçoit media="not all", et chaque règle exige
 *   html:not([data-vt-runtime]), attribut posé par le runtime. Le second
 *   tient même si un optimiseur (LiteSpeed « CSS Combine » avec le CSS en
 *   ligne, etc.) déplace ces règles dans un fichier où la balise n'existe plus.
 * - Restent au runtime seul, parce qu'ils dépendent de mesures dans la page :
 *   voile coloré, couches de fond, image de fond remplacée, zoom de fond.
 *   Depuis la 0.4.4, seules ces parties sont retirées : les autres réglages du
 *   même élément (position du fond, dimensions…) sont imprimés.
 *   Les contenus (texte, lien, image) sont des mutations du DOM : inchangés.
 */
final class PublishedStyles {
    /** Une retouche dépend-elle d'une mesure que seul le navigateur peut faire ? */
    public static function needs_runtime(array $element): bool {
        $content = $element['content'] ?? [];
        // Le verrou html:not([data-vt-runtime]) suppose une cible descendante de <html>.
        if (($element['fingerprint']['tag'] ?? '') === 'html') return true;
        if (!empty($content['backgroundLayers']) || ($content['assetKind'] ?? '') === 'background') return true;
        foreach ((array) $element['changes'] as $values) {
            $values = (array) $values;
            if (array_key_exists('overlay-color', $values)) return true;
            // styles.js zoome le fond mesuré dès qu'il y en a un, même sur une image.
            if (array_key_exists('imageZoom', $values) && (($element['fingerprint']['tag'] ?? '') !== 'img' || isset($element['fingerprint']['background']))) return true;
        }
        return false;
    }

    /** Réglages qui dépendent d'une mesure : jamais imprimés, le runtime les applique. */
    public static function measured(array $element): array {
        $tag = $element['fingerprint']['tag'] ?? '';
        $zoomMeasured = $tag !== 'img' || isset($element['fingerprint']['background']);
        return $zoomMeasured ? ['overlay-color', 'imageZoom'] : ['overlay-color'];
    }

    public static function selector(array $element): string {
        $fp = $element['fingerprint'];
        $extra = $fp['tag'];
        foreach ($fp['classes'] as $class) $extra .= '.' . $class;
        $out = ':where(html:not([data-vt-runtime])) :where(' . $element['selector'] . '):where(' . $extra . ')';
        if (isset($fp['src']) && $fp['tag'] === 'img') $out .= ':where([src="' . self::string($fp['src']) . '"])';
        return $out . ':not([data-vt-published-off])';
    }

    /** Port de styles.js/declarations() : même ordre, même format. */
    public static function declarations(array $properties, array $inherited): string {
        $lines = [];
        if (array_key_exists('translateX', $properties) || array_key_exists('translateY', $properties)) {
            $x = $properties['translateX'] ?? $inherited['translateX'] ?? '0px';
            $y = $properties['translateY'] ?? $inherited['translateY'] ?? '0px';
            $lines[] = "  translate: calc(var(--vt-base-x, 0px) + {$x}) calc(var(--vt-base-y, 0px) + {$y}) !important;";
        }
        foreach ($properties as $property => $value) {
            if ($property === 'overlay-color') $lines[] = "  --vt-overlay-color: {$value} !important;";
            elseif (!in_array($property, ['translateX', 'translateY', 'imageZoom'], true)) $lines[] = "  {$property}: {$value} !important;";
        }
        return implode("\n", $lines);
    }

    /** Port de styles.js/generateCSS() sans les bases mesurées ni les fonds. */
    public static function css(array $elements): string {
        $buckets = ['desktop' => [], 'tablet' => [], 'mobile' => []];
        foreach ($elements as $element) {
            // Le verrou html:not([data-vt-runtime]) suppose une cible descendante de <html>.
            if (($element['fingerprint']['tag'] ?? '') === 'html') continue;
            $selector = self::selector($element);
            $changes = (array) $element['changes'];
            $measured = array_flip(self::measured($element));
            $inherited = [];
            foreach (array_keys(Schema::BREAKPOINTS) as $mode) {
                $values = array_diff_key(isset($changes[$mode]) ? (array) $changes[$mode] : [], $measured);
                $body = self::declarations($values, $inherited);
                $effective = array_merge($inherited, $values);
                if (array_key_exists('imageZoom', $effective) && $element['fingerprint']['tag'] === 'img') {
                    $zoom = ((float) $effective['imageZoom']) / 100;
                    $body .= "\n  object-view-box: inset(" . number_format((1 - 1 / $zoom) * 50, 2, '.', '') . '%) !important;';
                }
                if ($body !== '') $buckets[$mode][] = "/* {$element['selector']} */\n{$selector} {\n{$body}\n}";
                $inherited = array_merge($inherited, $values);
            }
        }
        if (!$buckets['desktop'] && !$buckets['tablet'] && !$buckets['mobile']) return '';
        $css = "/* Visual Tweaks — overrides publiés (rendu serveur) */\n" . implode("\n", $buckets['desktop']);
        foreach (['tablet', 'mobile'] as $mode) {
            if ($buckets[$mode]) $css .= "\n@media (max-width: " . Schema::BREAKPOINTS[$mode] . "px) {\n" . implode("\n", $buckets[$mode]) . "\n}";
        }
        // Les valeurs et sélecteurs sont validés par Schema ; « < » est tout de même
        // neutralisé pour qu'aucune donnée ne puisse fermer la balise <style>.
        return str_replace('<', '\\3c ', $css);
    }

    private static function string(string $value): string {
        return str_replace(['\\', '"', "\n", "\r", "\f"], ['\\\\', '\\"', '\\a ', '', ''], $value);
    }
}
