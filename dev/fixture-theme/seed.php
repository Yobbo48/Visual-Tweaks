<?php
if (!get_option('vt_fixture_attachment')) {
    $image = wp_upload_bits('vt-replacement.png', null, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII='));
    if (!empty($image['error'])) throw new Exception($image['error']);
    $id = wp_insert_attachment(['post_title' => 'VT replacement', 'post_mime_type' => 'image/png', 'post_status' => 'inherit'], $image['file']);
    require_once ABSPATH . 'wp-admin/includes/image.php';
    wp_update_attachment_metadata($id, wp_generate_attachment_metadata($id, $image['file']));
    update_post_meta($id, '_wp_attachment_image_alt', 'Image de test remplacée');
    update_option('vt_fixture_attachment', $id, false);
}
