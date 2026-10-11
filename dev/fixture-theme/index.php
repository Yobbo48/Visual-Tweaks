<!doctype html><html <?php language_attributes(); ?>><head><meta charset="<?php bloginfo('charset'); ?>"><meta name="viewport" content="width=device-width, initial-scale=1"><?php wp_head(); ?></head><body <?php body_class(); ?>><?php wp_body_open(); ?>
<main>
<?php if (isset($_GET['vt-test']) && str_starts_with((string) $_GET['vt-test'], 'animated')): $vt_phone = esc_url(get_stylesheet_directory_uri() . '/phone.svg'); ?>
<style>
.anim-header{position:sticky;top:0;z-index:5;padding:14px 24px;background:#10251f;color:#fff;transition:background .3s,padding .3s}.anim-header.is-scrolled{padding:8px 24px;background:#0b1a16}
.anim-hero{position:relative;height:520px;overflow:hidden;background:linear-gradient(135deg,#1b3a33,#3c2a4d);color:#fff;padding:40px}
.anim-rune{position:absolute;left:0;top:0;width:64px;height:64px;border-radius:50%;background:radial-gradient(circle,#f6d58e,#c08a2e);box-shadow:0 0 24px #f6d58e;will-change:transform}
.anim-cta{display:inline-block;padding:14px 24px;border-radius:9px;background:#f6d58e;color:#10251f;text-decoration:none}
.anim-glow{animation:anim-pulse 2.4s ease-in-out infinite}@keyframes anim-pulse{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}
.anim-sceau{position:absolute;right:60px;top:80px;width:160px;height:200px;animation:anim-spin 12s linear infinite}@keyframes anim-spin{to{transform:rotate(360deg)}}
.anim-shimmer{max-width:520px;background:linear-gradient(90deg,#fff0,#fff4,#fff0);background-size:200% 100%;animation:anim-shimmer 3s linear infinite}@keyframes anim-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}
.anim-section{padding:60px 24px;min-height:380px}.anim-reveal{opacity:0;transform:translateY(30px);transition:opacity .6s,transform .6s}.anim-reveal.is-visible{opacity:1;transform:none}
.anim-slides{position:relative;height:140px}.anim-slide{position:absolute;inset:0;opacity:0;transition:opacity .8s;padding:24px;background:#fff;border-radius:12px}.anim-slide.is-active{opacity:1}
.anim-ticker{display:flex;gap:24px;overflow:hidden;white-space:nowrap}.anim-ticker span{padding:10px 18px;background:#dcece4;border-radius:20px}
</style>
<header class="anim-header" data-vt-id="anim-header"><strong>Atelier des Runes</strong> — banc animé</header>
<section class="anim-hero" data-vt-id="anim-hero"><h1 class="anim-title" data-vt-id="anim-title">Énergie en mouvement</h1><p class="anim-shimmer" data-vt-id="anim-shimmer">Un thème vivant : boucle d’animation, effets CSS infinis, diaporama et bandeau.</p><a class="anim-cta anim-glow" data-vt-id="anim-cta" href="#">Réserver une séance</a><img class="anim-sceau" data-vt-id="anim-sceau" src="<?php echo $vt_phone; ?>" alt="Sceau animé"><?php for ($i = 0; $i < 6; $i++): ?><span class="anim-rune" data-vt-rune aria-hidden="true"></span><?php endfor; ?></section>
<section class="anim-section" aria-label="Témoignages"><h2 data-vt-id="anim-temoignages">Témoignages</h2><div class="anim-slides"><?php for ($i = 1; $i <= 3; $i++): ?><blockquote class="anim-slide<?php echo $i === 1 ? ' is-active' : ''; ?>" data-vt-id="anim-slide-<?php echo $i; ?>">Témoignage <?php echo $i; ?> : une séance apaisante.</blockquote><?php endfor; ?></div></section>
<section class="anim-section" aria-label="Bandeau"><div class="anim-ticker"><?php foreach (['Runes', 'Soins', 'Ateliers', 'Méditation', 'Tirages', 'Rencontres'] as $word): ?><span><?php echo $word; ?></span><?php endforeach; ?></div></section>
<?php for ($i = 1; $i <= 4; $i++): ?><section class="anim-section anim-reveal" data-vt-id="anim-reveal-<?php echo $i; ?>"><h2>Section <?php echo $i; ?></h2><p>Contenu révélé au défilement.</p><img src="<?php echo $vt_phone; ?>" alt="Illustration <?php echo $i; ?>" width="160" height="200"></section><?php endfor; ?>
<script src="<?php echo esc_url(get_stylesheet_directory_uri() . '/animated.js'); ?>" defer></script>
<?php endif; ?>
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
