/* Relais de mesure : HTML de production avec les modules de Visual Tweaks en
   0.4.4 (servis depuis le dossier local par --extension-locale). Le CSS serveur
   de l'accueil est identique octet pour octet en 0.4.3 et 0.4.4 (vérifié) :
   seul le numéro de version des modules change. */
module.exports = (html) => html.replace(/(\/wp-content\/plugins\/visual-tweaks\/assets\/[a-z-]+\.(?:js|css)\?ver=)0\.4\.3/g, "$10.4.4");
