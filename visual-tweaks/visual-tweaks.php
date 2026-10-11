<?php
/**
 * Plugin Name: Visual Tweaks
 * Description: Retouches visuelles non destructives pour sites WordPress sur mesure.
 * Version: 0.4.5
 * Requires at least: 6.5
 * Requires PHP: 8.1
 * License: GPL-2.0-or-later
 * Text Domain: visual-tweaks
 */
defined('ABSPATH') || exit;
define('VT_VERSION', '0.4.5');
define('VT_DIR', plugin_dir_path(__FILE__));
define('VT_URL', plugin_dir_url(__FILE__));
require_once VT_DIR . 'includes/class-schema.php';
require_once VT_DIR . 'includes/class-store.php';
require_once VT_DIR . 'includes/class-site-style.php';
require_once VT_DIR . 'includes/class-published-styles.php';
require_once VT_DIR . 'includes/class-cache.php';
require_once VT_DIR . 'includes/class-plugin.php';
VisualTweaks\Plugin::boot();
