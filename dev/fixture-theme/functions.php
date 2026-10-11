<?php
add_action('wp_enqueue_scripts', function () { wp_enqueue_style('vt-fixture', get_stylesheet_uri(), [], '0.3.1'); });
