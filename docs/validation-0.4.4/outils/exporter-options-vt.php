<?php
// Export brut (valeur sérialisée telle qu'en base) de toutes les options vt_*.
global $wpdb;
$rows = $wpdb->get_results("SELECT option_name, option_value, autoload FROM {$wpdb->options} WHERE option_name LIKE 'vt\\_%' ORDER BY option_name", ARRAY_A);
$out = [];
foreach ($rows as $r) {
  $v = maybe_unserialize($r['option_value']);
  $out[] = ['option_name' => $r['option_name'], 'autoload' => $r['autoload'], 'raw_base64' => base64_encode($r['option_value']), 'raw_sha256' => hash('sha256', $r['option_value']),
    'page' => is_array($v) ? ($v['page'] ?? null) : null, 'revision' => is_array($v) ? ($v['revision'] ?? null) : null,
    'elements' => is_array($v) && isset($v['elements']) ? count($v['elements']) : null, 'updatedAt' => is_array($v) ? ($v['updatedAt'] ?? null) : null];
}
echo json_encode(['site' => home_url('/'), 'exported_at' => gmdate('c'), 'plugin_version' => defined('VT_VERSION') ? VT_VERSION : null, 'options' => $out], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
