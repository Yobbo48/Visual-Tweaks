# Texte inline riche — étude de compatibilité pour une version ultérieure

## Contrat actuel conservé en 0.4.x

`InlineEditor` travaille sur des feuilles HTML autorisées, sans élément enfant, avec une limite de 4 000 unités de chaîne JavaScript dans l’interface. L’API applique actuellement une limite plus stricte de 4 000 octets UTF-8 (`strlen` PHP) : un texte long accentué peut être refusé avant cette limite d’interface. Cette différence est une limite connue, pas un support annoncé de 4 000 caractères Unicode. Le contenu est un `content.text` littéral. Coller, déposer ou saisir du HTML ne crée aucune balise ; PHP valide une chaîne et le Runtime utilise `textContent`. Gras, italique et couleur sont des styles du bloc entier, pas des marques par sélection. Les textes simples continuent de bénéficier du draft, de l’historique, de la restauration et des fingerprints existants.

Un paragraphe avec un lien ou une emphase reste sélectionnable pour ses styles, mais ne devient pas éditable comme un unique texte : cela écraserait ses enfants. Les DIV ne sont pas ajoutés à la liste des tags éditables dans cette version.

## Pourquoi ne pas ajouter immédiatement une toolbar Selection/Range ?

Insérer des `strong`, `em` ou `a` dans une feuille la rendrait inéligible au contrat actuel. Le Runtime ne pourrait plus restaurer `content.text` en préservant ces marques. Remplacer `innerHTML` ou cloner la structure détruirait l’identité des éléments originaux et leurs listeners, fragiliserait les empreintes et pourrait autoriser du HTML non contrôlé. `document.execCommand()` ne résout aucun de ces problèmes et n’est pas introduit.

## Proposition à valider avant une implémentation

Prévoir un champ optionnel versionné de fragments inline **typés** : texte et marques connues (gras, italique, lien validé). Aucun HTML libre. Décrire les portions originales par chemins de text nodes, offsets et empreinte de la structure originale. Une sélection traversant des widgets, blocs ou descendants non autorisés doit être refusée explicitement.

Utiliser Selection/Range uniquement pour lire la sélection et appliquer les opérations validées. Le renderer doit garder les éléments originaux et leurs listeners, journaliser les fragments créés par le plugin et retirer uniquement ceux-ci au reset. Il doit restaurer les text nodes et leurs positions, sans reconstruire les sous-arbres originaux. L’historique demeure celui des overrides, sans second draft. Une structure originale devenue incompatible invalide la cible plutôt que d’être remplacée.

PHP devra valider le nombre de fragments, leur taille totale, les offsets et marques autorisées, les URL des liens, puis ignorer les données calculées côté client. Les chemins/empreintes doivent être comparés au DOM avant application ; les liens existants ne peuvent pas recevoir de liens imbriqués.

## Tests préalables indispensables

- Compatibilité des anciens `content.text`, reset, save/refresh, rendu public et fingerprints.
- Sélections à l’intérieur d’un text node et à travers plusieurs éléments inline autorisés.
- Conservation des éléments originaux, listeners, liens et attributs après édition/reset/Undo.
- Refus des widgets, blocs, scripts, handlers, HTML collé et liens exécutables.
- Sélection vide, remplacement de texte, fusion des marques, annulation par Échap.
- Undo/Redo et récupération d’un brouillon sur les trois moteurs.
- DIV feuille avec text node significatif, wrapper avec enfants et DIV vide : conserver l’éligibilité originale lors d’une suppression totale du texte pour que reset puisse restaurer le contenu.

La suite `comfort-e2e.mjs` verrouille déjà les garanties actuelles : HTML littéral, restauration du texte simple, structure imbriquée et listeners préservés, absence d’élargissement arbitraire aux DIV. Les autres tests ci-dessus sont une condition d’implémentation future, pas des fonctions annoncées comme disponibles.
