<!doctype html><html <?php language_attributes(); ?>><head><meta charset="<?php bloginfo('charset'); ?>"><meta name="viewport" content="width=device-width, initial-scale=1"><?php wp_head(); ?></head><body <?php body_class(); ?>><?php wp_body_open(); ?>
<main>
<?php if (isset($_GET['vt-test']) && str_starts_with((string) $_GET['vt-test'], 'viewport')): ?>
<style>.viewport-reference{position:relative}.reference-nav{display:flex;gap:20px}.reference-menu{display:none}.test-asset{display:block;width:400px;height:200px;margin-left:100px;object-fit:cover;object-position:50% 50%}.reference-stage{width:100%;height:480px;padding:40px 0}.reference-transformed{transform:rotate(8deg);width:300px}.reference-transformed img{width:160px;height:120px}@media(max-width:1200px){.reference-nav{display:none}.reference-menu{display:block}}</style>
<header class="viewport-reference"><nav class="reference-nav" aria-label="Navigation de référence"><a href="#">Accueil</a><a href="#">Accompagnements</a><a href="#">Contact</a></nav><button class="reference-menu" aria-label="Ouvrir le menu">☰</button></header>
<div class="reference-stage"><img class="test-asset" data-vt-id="reference-asset" src="<?php echo esc_url(get_stylesheet_directory_uri() . '/phone.svg'); ?>" alt="Asset géométrique"></div>
<div class="reference-transformed"><img data-vt-id="reference-rotated" src="<?php echo esc_url(get_stylesheet_directory_uri() . '/phone.svg'); ?>" alt="Asset tourné"></div>
<?php endif; ?>
<header><strong>ATELIER / VT</strong><span>Banc d’essai WordPress</span></header><section class="hero" id="hero"><div><span class="eyebrow">Développement visuel</span><h1 data-vt-id="hero-title">Un détail change tout.</h1><p class="intro">Sélectionnez le téléphone, remontez-le de 25 px et enregistrez. Cette page est indépendante de vos sites.</p><a class="cta" href="?second=1">Découvrir l’atelier</a></div><div class="device-wrap"><img data-vt-id="hero-phone" class="hero-phone" src="<?php echo esc_url(get_stylesheet_directory_uri() . '/phone.svg'); ?>" alt="Téléphone de démonstration"></div></section><section class="cards"><article class="card"><h2 id="card-title">Rapide</h2><p>Un sélecteur unique par identifiant.</p></article><article class="card"><h2>Réversible</h2><p>Une cible par hiérarchie courte.</p></article></section><p class="test-links"><a href="?second=1">Autre page (isolation)</a> · <a href="<?php echo esc_url(admin_url()); ?>">Administration</a></p>
<section class="asset-fixtures" aria-label="Assets de démonstration"><h2>Assets de démonstration</h2>
<div class="asset-grid">
<div class="fixture-background" data-vt-id="fixture-background" aria-label="Fond de démonstration" style="background-image:url('<?php echo esc_url(get_stylesheet_directory_uri() . '/phone.svg'); ?>')"><div class="fixture-overlay" data-vt-id="fixture-overlay" aria-label="Voile du fond"></div></div>
<picture><source media="(max-width:767px)" srcset="<?php echo esc_url(get_stylesheet_directory_uri() . '/phone.svg'); ?>"><img data-vt-id="fixture-logo" class="fixture-logo" src="<?php echo esc_url(get_stylesheet_directory_uri() . '/phone.svg'); ?>" alt="Logo Atelier"></picture>
<div class="fixture-covered"><img data-vt-id="fixture-covered-image" src="<?php echo esc_url(get_stylesheet_directory_uri() . '/phone.svg'); ?>" alt="Asset derrière un voile"><div class="fixture-cover" aria-label="Voile transparent"></div></div>
<svg data-vt-id="fixture-icon" aria-label="Icône Atelier" width="120" height="120" viewBox="0 0 120 120"><title>Icône Atelier</title><circle cx="60" cy="60" r="54" fill="currentColor"/><path d="M35 75 L60 30 L85 75 Z" fill="#f8f7f1"/></svg>
</div></section>
<?php if (isset($_GET['vt-test']) && str_starts_with((string) $_GET['vt-test'], 'width-contract')): ?>
<section class="width-fixtures" style="padding:40px;background:#fff">
<?php foreach (['fit-content', 'max-content', 'min-content', 'calc(150px - 22.7px)', 'clamp(120px, 30vw, 170px)', '127.123456px', 'auto', '57%'] as $index => $width): ?>
<div data-vt-id="width-case-<?php echo $index; ?>" style="width:<?php echo esc_attr($width); ?>;height:70px;margin:24px 0;border:1.3px solid #778;padding:3.7px;box-sizing:content-box;background:#eee"><strong>Largeur du thème</strong></div>
<?php endforeach; ?>
<span data-vt-id="width-inline" style="width:fit-content"><strong>Zone en ligne</strong></span>
</section>
<?php endif; ?>
<?php if (isset($_GET['vt-test']) && str_starts_with((string) $_GET['vt-test'], 'ergonomics')): ?>
<style>
.erg-box{width:600px;max-width:100%;height:180px;padding:20px;background:#ecf3ee;margin:24px 0;box-sizing:border-box}
.erg-item{width:120px;height:50px;margin:0;padding:5px;background:#27755d;color:white;box-sizing:border-box;object-fit:cover}
.erg-flex{display:flex}.erg-column{flex-direction:column}.erg-grid{display:grid;grid-template-columns:1fr 1fr}
.erg-text{width:100%;margin:0}.erg-inline{display:inline-block;width:auto;text-decoration:none}
.erg-background{--hero-image:url('<?php echo esc_url(get_stylesheet_directory_uri() . '/phone.svg'); ?>');background-image:var(--hero-image);background-size:cover;position:relative}
.erg-background::before{content:"";position:absolute;inset:0;background-image:var(--hero-image);pointer-events:none;opacity:.1}
.erg-multi{background-image:linear-gradient(#fff5,#fff5),url('<?php echo esc_url(get_stylesheet_directory_uri() . '/phone.svg'); ?>'),url('<?php echo esc_url(get_stylesheet_directory_uri() . '/phone.svg'); ?>')}
</style>
<section data-vt-id="erg-zone" aria-label="Atelier ergonomie">
<h2>Atelier ergonomie</h2>
<div class="erg-box" data-vt-id="erg-normal"><img class="erg-item" data-vt-id="erg-image" alt="Image alignable" src="<?php echo esc_url(get_stylesheet_directory_uri() . '/phone.svg'); ?>"></div>
<div class="erg-box" data-vt-id="erg-normal-block"><div class="erg-item" data-vt-id="erg-normal-child">Bloc normal</div></div>
<div class="erg-box" data-vt-id="erg-button-parent"><a class="erg-item erg-inline" data-vt-id="erg-button" href="#">Bouton alignable</a></div>
<div class="erg-box erg-flex" data-vt-id="erg-flex"><div class="erg-item" data-vt-id="erg-flex-child">Flex</div></div>
<div class="erg-box erg-flex erg-column" data-vt-id="erg-column"><div class="erg-item" data-vt-id="erg-column-child">Colonne</div></div>
<div class="erg-box erg-grid" data-vt-id="erg-grid"><div class="erg-item" data-vt-id="erg-grid-child">Grid</div></div>
<div class="erg-box" data-vt-id="erg-text-parent"><p class="erg-text" data-vt-id="erg-text">Un texte qui s’aligne dans son cadre.</p></div>
<p><span data-vt-id="erg-inline-text">Texte en ligne dans son paragraphe</span></p>
<div class="erg-box erg-flex" data-vt-id="erg-flex-group"><div class="erg-item" data-vt-id="erg-flex-sibling">Premier</div><div class="erg-item">Second</div></div>
<div class="erg-box erg-background" data-vt-id="erg-background"><h3 data-vt-id="erg-background-title">Texte dans une zone avec fond</h3></div>
<div class="erg-box erg-multi" data-vt-id="erg-multi">Fond multicouche</div>
<div data-vt-id="erg-hidden" style="display:none"><img data-vt-id="erg-hidden-image" src="<?php echo esc_url(get_stylesheet_directory_uri() . '/phone.svg'); ?>" alt="Image invisible"></div>
<div data-vt-id="erg-many" aria-label="Liste de contrôle">
<?php for ($i=0;$i<80;$i++): ?><p data-vt-id="erg-row-<?php echo $i; ?>">Ligne de contrôle <?php echo $i; ?></p><?php endfor; ?>
</div></section>
<?php endif; ?>
<?php if (isset($_GET['vt-test']) && str_starts_with((string) $_GET['vt-test'], 'comfort')): ?>
<style>.comfort-wide{width:920px;height:80px;background:#dcece4;margin:20px 0}.comfort-clip{max-width:100%;width:260px;overflow:hidden;height:auto}.comfort-small{width:80px;height:44px}.comfort-collision p{width:180px;height:48px;margin:0}@media(max-width:767px){.comfort-clip{height:25px}.comfort-small{width:18px;height:18px;padding:0}.comfort-collision p+p{margin-top:-30px}}</style>
<section aria-label="Contrôles responsive"><h2>Contrôles responsive</h2><div class="comfort-wide" data-vt-id="responsive-wide">Largeur du thème : 920 px</div><p class="comfort-clip" data-vt-id="responsive-clip">Ce texte doit rester lisible sur tous les écrans et révéler une hauteur trop courte en mobile.</p><button class="comfort-small" data-vt-id="responsive-small">+</button><div class="comfort-collision"><p>Première ligne importante</p><p data-vt-id="responsive-overlap">Deuxième ligne importante</p></div></section>
<div data-vt-id="comfort-multi" aria-label="Fond à trois couches" style="width:400px;height:160px;background-image:linear-gradient(135deg,rgba(0,0,0,.2),rgba(255,255,255,.4)),url('<?php echo esc_url(get_stylesheet_directory_uri() . '/phone.svg'); ?>'),url('<?php echo esc_url(get_stylesheet_directory_uri() . '/phone.svg'); ?>');background-position:center,20% 30%,right bottom;background-size:auto,120px 90px,contain;background-repeat:no-repeat,repeat-x,no-repeat"></div>
<?php endif; ?>
</main>
<?php wp_footer(); ?></body></html>
