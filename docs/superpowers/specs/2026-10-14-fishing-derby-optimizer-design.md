# TT2 Fishing Derby Optimizer : spec de conception

- **Date** : 14 octobre 2026.
- **Statut** : à relire par le propriétaire. Rien n'est construit. Le dépôt contient `README.md`, `LICENSE` et `fishing_derby_data/` (6 CSV, leur README, `model_check.py`).
- **Langue** : cette spec est en français pour la relecture. Le code, l'interface et la documentation publique du dépôt seront en anglais.
- **Références** : `fishing_derby_data/README.md` (provenance et vérification des CSV, 14 octobre 2026), le billet GameHive [DevUpdate #142](https://gamehive.com/blog/devupdate-142-questing-into-the-deep) (4 juillet 2025), les dépôts voisins `../tt2_hub` (DESIGN.md, PRODUCT.md, `tools.json`), `../tt2_alchemy_lab` et `../tt2_monuments`, en lecture seule.

Statuts utilisés : **[Confirmé]** (source primaire ou donnée vérifiée), **[À vérifier]** (hypothèse que l'outil affiche comme telle, à confirmer en jeu), **[Proposition]** (choix de conception validé en séance, révisable).

## 1. Objectif

Aider un joueur de Tap Titans 2 à finir le Fishing Derby avec **la plus grande longueur totale de poissons pêchés**, en lui disant dans quel ordre dépenser ses Fishing Coins entre les améliorations.

Le billet officiel indique que les récompenses dépendent de la longueur totale des Titanfish pêchés pendant l'événement, à la fois pour les paliers de collecte et pour le classement final **[Confirmé]**.

## 2. Décisions prises en séance (14 octobre 2026)

| Sujet | Décision |
| --- | --- |
| Échéance | Une première version utilisable pendant l'événement qui commence le 15 octobre 2026, puis adaptée au fil de l'expérience du propriétaire pour les derbys suivants |
| Public | Public, en anglais, comme les autres outils, ajouté au hub |
| Expérience des règles | Le propriétaire a déjà joué sans retenir les détails : les règles viennent des CSV et des relevés en jeu |
| Réponse de l'outil | Le prochain achat en grand, et le plan complet jusqu'à la fin en dessous |
| Moteur | Meilleur rendement à chaque achat, en regardant 3 achats d'avance (réglable), contrôlé dans les tests par une recherche lourde qui mesure l'écart avec le meilleur plan trouvé |
| Règles du jeu | Dans un fichier de données, chacune marquée vérifiée ou supposée ; une correction en jeu change la donnée, pas le code |
| Aspect | Base commune du hub ; couleur, emblème et allure des cartes choisis sur maquettes avec Impeccable avant de construire l'interface |
| Technique | Comme les outils voisins : HTML, CSS et JavaScript sans framework ni build, tout dans le navigateur, GitHub Pages |

## 3. Périmètre

**Dans la première version :**

- la saisie de l'état du joueur (§ 5) ;
- le prochain achat, le plan complet, la longueur finale estimée et les paliers de récompenses atteints (§ 6) ;
- les règles utilisées, avec leur statut (§ 7) ;
- la sauvegarde locale de la saisie.

**Hors de la première version :**

- l'estimation d'un rang au classement (il dépend des autres joueurs) ;
- l'import automatique depuis l'export de compte du jeu : les exports connus, faits hors événement, ne contiennent aucune donnée de pêche. À revérifier sur un export fait pendant le derby ;
- la simulation tirage par tirage (hasard réel, écarts possibles) : le moteur travaille en moyennes ;
- le conseil sur la façon de pêcher elle-même (quand se connecter, quand prestiger) : ce sont des réglages d'entrée, pas des sorties.

## 4. Utilisateurs et usage

Joueurs de Tap Titans 2 pendant un Fishing Derby, toute la communauté, en anglais. Usage attendu : après chaque session de pêche, sur téléphone en jouant ou sur ordinateur, mettre à jour quelques chiffres et lire le prochain achat **[Proposition]**.

## 5. Ce que le joueur saisit

À chaque session :

- le **niveau de chaque amélioration**, tel que le jeu l'affiche, avec des boutons − / + et une saisie au clavier (comme l'inventaire d'Alchemy) ;
- ses **Fishing Coins** actuels ;
- ses **lures en stock** (pas encore utilisés) ;
- le **temps restant** de l'événement, en jours et heures, lu sur le compte à rebours du jeu.

Réglages de jeu, rarement modifiés :

- le **nombre de prestiges par jour** ;
- le **nombre de visites par jour** (fois où le joueur ouvre le jeu et pêche).

Les 7 améliorations, avec leur nom en jeu d'après le billet officiel (correspondance tirée des descriptions, **[À vérifier]**) :

| Nom en jeu | Identifiant CSV | Effet décrit |
| --- | --- | --- |
| Fishing Line | `LuresPerPrestige` | lures en plus à chaque prestige |
| Bucket | `LuresPerDay` | plafond de lures par jour |
| Fishing Hook | `FishingHook` | taille des poissons |
| Fishing Skill | `FishingSkill` | espèces de rang supérieur |
| Tacklebox Speed | `TackleBoxSpeed` | vitesse de génération des lures |
| Tacklebox Size | `TackleBoxSize` | nombre de lures stockables |
| (inconnu) | `FishingBait` | absent du billet ; existence à vérifier en jeu |

Si `FishingBait` n'existe pas en jeu, il disparaît de l'outil.

Tout est sauvegardé dans `localStorage`, rien n'est envoyé ailleurs. Chaque accès au stockage est protégé : l'outil fonctionne aussi sans lui.

## 6. Ce que l'outil affiche

1. **Le prochain achat**, en grand : l'amélioration, le passage de niveau (par exemple « Fishing Skill, level 2 → 3 »), son coût, puis :
   - « Buy now » si les coins suffisent ;
   - sinon « Save up: N more coins », quand le moteur juge préférable d'économiser pour cet achat plutôt que d'en faire un moins cher tout de suite.
2. **Pourquoi**, en une phrase calculée par le moteur : la longueur finale estimée avec ce premier achat, comparée à celle du meilleur plan qui commence par un autre achat (écart en cm).
3. **Le plan complet** : chaque achat dans l'ordre, le moment approximatif où les coins seront disponibles (jour et heure de l'événement), et la longueur totale estimée à ce moment.
4. **La longueur finale estimée**, présentée comme une estimation, et les **paliers de récompenses solo** qu'elle atteint (fichier `MinigameFishingDerbySoloContributionRewards.csv`, 41 paliers, données réelles).
5. **Les règles utilisées**, dans une section repliable : chaque règle du § 7, son statut et sa source.

Aucun chiffre affiché n'est saisi à la main : tout sort du moteur ou des fichiers de données.

## 7. Modèle du jeu : les règles

Chaque règle vit dans `data/rules.json`, avec un identifiant, un énoncé en anglais pour l'interface, un statut (`verified` ou `assumed`), une source, et les paramètres qu'elle fixe.

| # | Règle | Hypothèse de départ | Paramètres | Statut |
| --- | --- | --- | --- | --- |
| 1 | Score | La longueur totale de toutes les prises | aucun | **[Confirmé]** (billet) |
| 2 | Une lure | Une lure = une prise | `luresPerCatch` | **[À vérifier]** |
| 3 | Lures par prestige | `LuresPerPrestige` au niveau courant (4 à 99) | aucun | **[À vérifier]** |
| 4 | Tacklebox | 1 lure toutes les `TackleBoxSpeed` unités de temps ; capacité = base + `TackleBoxSize` ; sens du `0` au dernier niveau inconnu | `tackleboxUnit`, `tackleboxBaseCapacity`, `tackleboxZeroSpeed` | **[À vérifier]** |
| 5 | Plafond par jour | Base + `LuresPerDay` ; il limite les prises d'une journée ; heure de remise à zéro | `dailyCapBase`, `dailyCapAppliesTo`, `dailyResetHourUtc` | **[À vérifier]** |
| 6 | Espèces | `FishingSkill` débloque les espèces selon `FishingLevelToCatch` ; tirage avec les mêmes chances pour chaque espèce débloquée | `speciesUnlock`, `speciesWeights` | **[À vérifier]** |
| 7 | Taille | Uniforme entre `MinSize` et `MaxSize`, multipliée par `FishingHook` ; `RaritySize` ignorée | `sizeModel` | **[À vérifier]** |
| 8 | Rareté | Tirée dans `MinigameFishingDerbyRarityInfo.csv` ; le niveau de la table vient d'une amélioration (probablement `FishingBait`) | `rarityLevelSource`, `rarityLevelOffset` | **[À vérifier]** |
| 9 | Coins par prise | `XP` de la rareté : 1, 2, 5, 25, 25 | aucun | **[À vérifier]** (relevé du 15 octobre) |
| 10 | Niveaux et coûts | Correspondance entre le niveau affiché et la position dans `XPCost` et `BonusValue` | `levelIndexing` | **[À vérifier]** (relevé du 15 octobre) |

Règles de conduite du fichier :

- **Aucune valeur de base inventée.** Les bases inconnues (règles 4 et 5) viennent des relevés en jeu du 15 octobre 2026. Si le jeu ne les affiche pas, l'interface demande au joueur la valeur qu'il voit, et la règle reste `assumed`.
- **La correspondance des niveaux est un paramètre, pas un choix caché.** `TackleBoxSize` a 11 niveaux, 12 coûts et 11 effets. Les variantes candidates de `levelIndexing` sont toutes couvertes par les tests ; la variante active est celle que confirment les relevés (vérifications 2 et 6 du rappel). Faute de relevé, l'interface l'affiche comme supposée.
- **Une contradiction en jeu change la donnée** et son statut, avec la date et la source du relevé.

## 8. Le moteur

Le moteur ne touche pas au DOM : il tourne à l'identique dans la page et dans Node pour les tests.

### 8.1 Simulation en moyennes

L'événement restant est simulé visite par visite. Les visites sont réparties régulièrement selon le nombre de visites par jour ; la première est l'instant présent. À chaque visite :

1. les lures gagnés depuis la visite précédente s'ajoutent au stock : la part des prestiges du jour, et la Tacklebox, limitée par sa capacité ;
2. le joueur pêche tout ce que le plafond du jour permet ;
3. la longueur et les coins gagnés s'ajoutent en **espérance** : longueur moyenne d'une prise × nombre de prises, coins moyens d'une prise × nombre de prises ;
4. les achats prévus par la politique d'achat sont faits si les coins suffisent.

Avec les règles de départ :

- longueur moyenne d'une prise = multiplicateur de `FishingHook` × moyenne, sur les espèces débloquées, de `(MinSize + MaxSize) / 2` ;
- coins moyens d'une prise = somme, sur les 5 raretés, de probabilité × `XP`.

Les quantités sont fractionnaires (ce sont des moyennes). Le moment d'un achat dans le plan est donc approximatif, et l'interface le dit.

### 8.2 Choix des achats

À chaque décision, le moteur considère toutes les suites de 1 à 3 prochains achats (chaque achat = le niveau suivant d'une amélioration), soit au plus 7 + 49 + 343 = 399 suites. Pour chaque suite :

1. il simule l'événement en faisant ces achats dans l'ordre, dès que les coins le permettent ;
2. après la suite, il continue avec une politique simple : à chaque visite, acheter l'amélioration abordable qui augmente le plus la longueur gagnée par heure, par coin dépensé. Une amélioration qui ne rapporte que des coins (par exemple celle qui fait monter la rareté) vaut 0 pour cette politique simple : sa valeur n'est vue que par les 3 achats d'avance, et le contrôle du § 8.3 mesure ce que cette limite coûte ;
3. il retient la longueur finale estimée.

Il garde le premier achat de la meilleure suite, l'ajoute au plan, et recommence depuis l'état atteint, jusqu'à la fin de l'événement ou jusqu'à ce qu'aucun achat ne soit plus utile. La profondeur (3) est une constante réglable **[Proposition]**.

### 8.3 Contrôle de qualité (tests seulement)

Sur des cas fixés et réduits (événement court, peu d'améliorations), une recherche lourde essaie tous les ordres d'achat possibles, ou une recherche par faisceau large quand ils sont trop nombreux, et donne le meilleur plan trouvé. Le test mesure l'écart de longueur finale entre ce plan et celui du moteur. Si l'écart dépasse 1 % sur un cas **[Proposition]**, la profondeur ou la politique simple est revue. L'écart mesuré est noté dans le README.

### 8.4 Performance

Le temps de calcul d'un plan est mesuré dans le navigateur. S'il dépasse 300 ms **[Proposition]**, le calcul passe dans un Web Worker, comme dans Alchemy. Si une profondeur de 4 reste sous ce seuil, elle est adoptée.

## 9. Interface et aspect

- Textes en anglais. Page unique : saisie, puis résultat ; sur téléphone, le résultat suit la saisie et le calcul se relance quand une valeur change.
- **Base fixée**, reprise de `../tt2_hub/DESIGN.md` : fond nuit avec grain, or pour l'action principale, Outfit pour les titres, Geist pour le texte, Geist Mono pour les chiffres, coins de 12, 8 et 6 px, courbe d'animation `cubic-bezier(0.16, 1, 0.3, 1)`, pas de petit libellé au-dessus des titres, pas de visuel officiel du jeu, mention « Unofficial. Tap Titans 2 is a trademark of Game Hive Corp. This site is not affiliated with or endorsed by Game Hive. » et licence MIT en bas de page.
- **Choisi sur maquettes** avec Impeccable, avant de construire l'interface : la couleur d'accent de l'outil (contraste d'au moins 3:1 sur `night`, règle du hub), son emblème SVG dessiné pour le hub, l'allure de la carte du prochain achat et du plan.
- Déroulé : `/impeccable init` écrit `PRODUCT.md` à partir de cette spec ; la direction est fixée dans le brief de surface ; `DESIGN.md` est écrit à la fin d'après ce qui est construit.
- Accessibilité : navigation complète au clavier, focus visible, animations retirées sous `prefers-reduced-motion`.

## 10. Fichiers

```
fishing_derby_data/   les 6 CSV (source de vérité, lus au démarrage), leur README, model_check.py
data/rules.json       les règles du § 7
lib/                  le moteur : lecture des CSV et des règles, simulation, choix des achats, paliers
index.html, style.css, index.js, favicon.svg   l'interface
server.js             serveur local de développement (Node, comme les outils voisins)
tests/                tests node --test
.github/workflows/test.yml   les tests à chaque envoi et pull request
.editorconfig, .gitattributes (fins de ligne LF), .gitignore
```

Le `README.md` racine est réécrit en anglais : ce que fait l'outil, comment le lancer, les données et leurs sources, les règles supposées.

## 11. Erreurs

- CSV ou `rules.json` illisible ou incohérent (nombres d'entrées, colonnes attendues) : un bandeau l'explique, aucun plan n'est affiché.
- Saisie : les niveaux sont bornés par le niveau maximum, les nombres négatifs refusés.
- Temps restant à zéro : un message le dit au lieu d'un plan vide.
- Règle de base inconnue et non saisie : le moteur ne calcule pas et l'interface demande la valeur manquante.

## 12. Tests et vérification

Écrits avant le code du moteur :

- lecture des données : 50 poissons, 7 améliorations, 12 niveaux de rareté, 5 raretés, 41 paliers ; colonnes attendues ;
- règles : chaque variante de `levelIndexing` ; règle inconnue → refus explicite ;
- simulation : petits cas dont le résultat est calculé indépendamment dans le test ;
- choix des achats : cas construits où le bon achat est connu d'avance (par exemple un achat gratuit qui augmente la taille) ;
- contrôle de qualité du § 8.3.

Interface (preuve par le rendu) : captures à 375 et 1 440 px, `npx impeccable detect`, parcours complet au clavier, animations réduites. Ce qui n'a pas pu être vérifié est dit.

## 13. Ordre de construction

1. Moteur, `rules.json` et tests. Commence dès le plan validé ; les relevés du 15 octobre fixent, si le jeu les affiche, les règles 3 à 6 et 8 à 10 du § 7.
2. Interface, après le choix sur maquettes ; puis mise en ligne.
3. Corrections de `rules.json` au fil des relevés pendant l'événement.
4. Ajout au hub (`../tt2_hub/tools.json` et emblème) : autre dépôt, tâche séparée, avec l'accord du propriétaire.

## 14. Publication

GitHub Pages depuis `main`. Le dépôt `kasaden/tt2_fishing_derby` répond 404 sans authentification, il semble donc privé ; GitHub Pages gratuit exige un dépôt public. Le rendre public est une décision du propriétaire, demandée au moment de la mise en ligne.

## 15. Questions ouvertes

- **Nom de l'outil** : « TT2 Fishing Derby Optimizer » est une proposition, à confirmer par le propriétaire.
- Existence et effet de `FishingBait` ; ce qui fait monter le niveau de la table de rareté.
- Bases du plafond quotidien et de la capacité de la Tacklebox ; unité de `TackleBoxSpeed` et sens de sa valeur 0.
- Le plafond quotidien limite-t-il les lures gagnés ou les prises ; heure de remise à zéro.
- Correspondance niveau affiché ↔ position dans les listes ; rôle du 12e coût de `TackleBoxSize`.
- Tirage des espèces et de la taille ; rôle de `RaritySize` et de `BaseSize`.
- Les lures non utilisés sont-ils conservés, et sans limite ?
- Un export de compte fait pendant l'événement contient-il des données de pêche ?
