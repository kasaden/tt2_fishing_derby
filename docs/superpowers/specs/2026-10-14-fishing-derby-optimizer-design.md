# TT2 Fishing Derby Optimizer : spec de conception

- **Date** : 14 octobre 2026.
- **Statut** : à relire par le propriétaire. Rien n'est construit. Le dépôt contient `README.md`, `LICENSE` et `fishing_derby_data/` (6 CSV, leur README, `model_check.py`).
- **Révision du 14 octobre 2026** : publication sur Cloudflare Pages au lieu de GitHub Pages, et séparation du dossier publié (`site/`), d'après les décisions du propriétaire prises dans la session du hub (surtout § 10 et § 14 ; touches aux § 2, 5, 7, 8, 12, 13 et 15).
- **Révision du 14 octobre 2026 (soir)** : à la demande du propriétaire, première mise en ligne sur GitHub Pages, par un workflow GitHub Actions qui ne publie que `site/` ; Cloudflare Pages (§ 14) reste prévu ensuite.
- **Langue** : cette spec est en français pour la relecture. Le code, l'interface et la documentation publique du dépôt seront en anglais.
- **Références** : `fishing_derby_data/README.md` (provenance et vérification des CSV, 14 octobre 2026), le billet GameHive [DevUpdate #142](https://gamehive.com/blog/devupdate-142-questing-into-the-deep) (4 juillet 2025), les dépôts voisins `../tt2_hub` (DESIGN.md, PRODUCT.md, `tools.json`), `../tt2_alchemy_lab` et `../tt2_monuments`, en lecture seule. La documentation Cloudflare citée au § 14, lue le 14 octobre 2026.

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
| Moteur | Révisé après prototype (§ 8) : plusieurs méthodes de recherche en arrière-plan dans un délai fixé, le meilleur plan trouvé est gardé et présenté comme « meilleur trouvé », jamais comme prouvé. La décision initiale (3 achats d'avance seuls) laissait jusqu'à un tiers de la longueur sur un cas de 72 h |
| Règles du jeu | Dans un fichier de données, chacune marquée vérifiée ou supposée ; une correction en jeu change la donnée, pas le code |
| Aspect | Base commune du hub ; couleur, emblème et allure des cartes choisis sur maquettes avec Impeccable avant de construire l'interface |
| Technique | Comme les outils voisins : HTML, CSS et JavaScript sans framework ni build, tout dans le navigateur, aucun code côté serveur. Publié par Cloudflare Pages depuis le dossier `site/` (§ 14) |

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
- le **temps restant** de l'événement, en jours et heures, lu sur le compte à rebours du jeu ;
- la **longueur totale déjà pêchée**, affichée en jeu (ajout du 14 octobre à l'écriture du plan : sans elle, l'outil ne peut estimer ni la longueur finale ni les paliers atteints).

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

Tout est sauvegardé dans `localStorage`, rien n'est envoyé ailleurs. Chaque accès au stockage est protégé : l'outil fonctionne aussi sans lui. La sauvegarde est liée à l'adresse du site : elle ne suivra pas le passage à un autre domaine (§ 14).

## 6. Ce que l'outil affiche

1. **Le prochain achat**, en grand : l'amélioration, le passage de niveau (par exemple « Fishing Skill, level 2 → 3 »), son coût, puis :
   - « Buy now » si les coins suffisent ;
   - sinon « Save up: N more coins », quand le moteur juge préférable d'économiser pour cet achat plutôt que d'en faire un moins cher tout de suite.
2. **Pourquoi**, en une phrase calculée par le moteur : la longueur finale estimée avec ce premier achat, comparée à celle du meilleur plan qui commence par un autre achat fait avant la fin (ou à « ne rien acheter » s'il n'y en a aucun). Les longueurs s'affichent sans unité tant que l'unité n'est pas vérifiée en jeu.
3. **Le plan complet** : chaque achat dans l'ordre, le moment approximatif où les coins seront disponibles (jour et heure de l'événement), et la longueur totale estimée à ce moment.
4. **La longueur finale estimée**, présentée comme une estimation, et les **paliers de récompenses solo** qu'elle atteint (fichier `MinigameFishingDerbySoloContributionRewards.csv`, 41 paliers, données réelles).
5. **Les règles utilisées**, dans une section repliable : chaque règle du § 7, son statut et sa source.

Le plan s'affiche d'abord vite, puis s'améliore pendant le délai de calcul, avec la mention « Improving the plan… ». Il est présenté comme « Best plan found », jamais comme le meilleur possible.

Aucun chiffre affiché n'est saisi à la main : tout sort du moteur ou des fichiers de données.

## 7. Modèle du jeu : les règles

Chaque règle vit dans `site/data/rules.json`, avec un identifiant, un énoncé en anglais pour l'interface, un statut (`verified` ou `assumed`), une source, et les paramètres qu'elle fixe.

| # | Règle | Hypothèse de départ | Paramètres | Statut |
| --- | --- | --- | --- | --- |
| 1 | Score | La longueur totale de toutes les prises | aucun | **[Confirmé]** (billet) |
| 2 | Une lure | Une lure = une prise | `luresPerCatch` | **[À vérifier]** |
| 3 | Lures par prestige | `LuresPerPrestige` au niveau courant (4 à 99) | aucun | **[À vérifier]** |
| 4 | Tacklebox | 1 lure toutes les `TackleBoxSpeed` unités de temps ; capacité = base + `TackleBoxSize` ; sens du `0` au dernier niveau inconnu | `tackleboxUnit`, `tackleboxBaseCapacity`, `tackleboxZeroSpeed` | **[À vérifier]** |
| 5 | Plafond par jour | Base + `LuresPerDay` ; il limite les prises d'une journée, comptée par tranches de 24 h à partir de maintenant | `dailyCapBase`, `dailyCapAppliesTo`, `dailyWindow` | **[À vérifier]** |
| 6 | Espèces | `FishingSkill` débloque les espèces selon `FishingLevelToCatch` ; tirage avec les mêmes chances pour chaque espèce débloquée | `speciesUnlock`, `speciesWeights` | **[À vérifier]** |
| 7 | Taille | Uniforme entre `MinSize` et `MaxSize`, multipliée par `FishingHook` ; `RaritySize` ignorée | `sizeModel` | **[À vérifier]** |
| 8 | Rareté | Tirée dans `MinigameFishingDerbyRarityInfo.csv` ; le niveau de la table vient d'une amélioration (probablement `FishingBait`) | `rarityLevelSource`, `rarityLevelOffset` | **[À vérifier]** |
| 9 | Coins par prise | `XP` de la rareté : 1, 2, 5, 25, 25 | aucun | **[À vérifier]** (relevé du 15 octobre) |
| 10 | Niveaux et coûts | Correspondance entre le niveau affiché et la position dans `XPCost` et `BonusValue` | `levelIndexing` | **[À vérifier]** (relevé du 15 octobre) |
| 11 | Lures non utilisés | Ils restent en stock, sans limite | aucun | **[À vérifier]** |

L'unité des longueurs (`sizeUnit`) reste vide tant qu'elle n'est pas vérifiée : l'interface affiche alors les longueurs sans unité.

Règles de conduite du fichier :

- **Aucune valeur de base inventée.** Les bases inconnues (règles 4 et 5) viennent des relevés en jeu du 15 octobre 2026. Si le jeu ne les affiche pas, l'interface demande au joueur la valeur qu'il voit, et la règle reste `assumed`.
- **La correspondance des niveaux est un paramètre, pas un choix caché.** `TackleBoxSize` a 11 niveaux, 12 coûts et 11 effets. Les variantes candidates de `levelIndexing` sont toutes couvertes par les tests ; la variante active est celle que confirment les relevés (vérifications 2 et 6 du rappel). Faute de relevé, l'interface l'affiche comme supposée.
- **Une contradiction en jeu change la donnée** et son statut, avec la date et la source du relevé.

## 8. Le moteur

Le moteur ne touche pas au DOM : il tourne à l'identique dans la page et dans Node pour les tests, qui l'importent depuis `site/lib/`.

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

Au-delà de 12 visites par jour, les achats et les prises se décident par pas de 2 heures, la Tacklebox se remplissant toujours visite par visite (révision du 14 octobre 2026 après la relecture : avec 48 visites par jour, la recherche en 2 s ne trouvait qu'un tiers de la longueur atteignable, le coût d'une simulation croissant avec le nombre de pas).

### 8.2 Choix des achats (révisé le 14 octobre 2026 après prototype)

Un plan est un **ordre d'achats** : chaque achat est le niveau suivant d'une amélioration, fait dès que les coins le permettent. Tous les plans sont évalués par la même simulation (§ 8.1), qui rend leur longueur finale estimée. Le moteur essaie plusieurs méthodes et garde le meilleur plan trouvé (à longueur égale : celui qui compte le moins d'achats, puis qui laisse le plus de coins, puis le moins cher en premier achat ; révision du 14 octobre 2026 : départager d'abord par les coins faisait recommander, en fin d'événement, des achats qui n'ajoutent aucune longueur) :

1. **Regard d'avance** : à chaque décision, toutes les suites de 1 à 3 prochains achats sont simulées, suivies d'une politique simple (acheter l'amélioration abordable qui augmente le plus la longueur gagnée par heure, par coin). Le premier achat de la meilleure suite rejoint le plan. Un achat qui n'ajoute aucune longueur n'est jamais retenu.
2. **Faisceau** : à chaque étape, les 30 meilleurs débuts de plan sont gardés (jugés par la même politique simple après eux) et prolongés de chaque achat possible ; deux débuts qui mènent aux mêmes niveaux ne comptent qu'une fois.
3. **Retouche** : sur le meilleur plan obtenu, le moteur essaie de retirer un achat, d'en ajouter un, ou d'en déplacer un, et garde chaque changement qui allonge la longueur finale, jusqu'à ce qu'aucun n'aide ou que le délai soit écoulé.

Le calcul tourne dans un Web Worker, avec un délai de 2 s **[Proposition]**. Un premier plan (regard d'avance d'un seul achat) est publié tout de suite, puis remplacé à chaque amélioration. Le calcul est déterministe : la même saisie donne le même plan. Profondeur, largeur et délai sont des constantes réglables.

Mesures du prototype (données réelles, valeurs de base inventées pour le test, événement de 72 h) : 3 achats d'avance seuls, 8 873 ; 4 achats d'avance, 11 775 ; faisceau de 30, 13 310. Sur 168 h : 45 933, 46 939, 46 105, et 47 693 avec la retouche. Aucune méthode ne gagne partout, d'où le portefeuille.

### 8.3 Contrôle de qualité (tests seulement)

Sur des cas fixés et réduits où tous les ordres d'achat peuvent être essayés, le plan du moteur doit atteindre au moins 99 % de la longueur finale du meilleur ordre **[Proposition]**. Sur les données réelles, un script de mesure compare les méthodes et le portefeuille ; les écarts mesurés sont notés dans le README.

### 8.4 Performance

Les longueurs et coins moyens sont précalculés pour chaque combinaison de niveaux utile, et les simulations repartent d'états déjà calculés plutôt que du début. Le temps du premier plan et le résultat obtenu dans le délai sont mesurés, sur ordinateur et dans le navigateur.

Tout le calcul reste dans le navigateur : aucun code ne tourne côté serveur (§ 14).

## 9. Interface et aspect

- Textes en anglais. Page unique : saisie, puis résultat ; sur téléphone, le résultat suit la saisie et le calcul se relance quand une valeur change.
- **Base fixée**, reprise de `../tt2_hub/DESIGN.md` : fond nuit avec grain, or pour l'action principale, Outfit pour les titres, Geist pour le texte, Geist Mono pour les chiffres, coins de 12, 8 et 6 px, courbe d'animation `cubic-bezier(0.16, 1, 0.3, 1)`, pas de petit libellé au-dessus des titres, pas de visuel officiel du jeu, mention « Unofficial. Tap Titans 2 is a trademark of Game Hive Corp. This site is not affiliated with or endorsed by Game Hive. » et licence MIT en bas de page.
- **Choisi sur maquettes** avec Impeccable, avant de construire l'interface : la couleur d'accent de l'outil (contraste d'au moins 3:1 sur `night`, règle du hub), son emblème SVG dessiné pour le hub, l'allure de la carte du prochain achat et du plan.
- Déroulé : `/impeccable init` écrit `PRODUCT.md` à partir de cette spec ; la direction est fixée dans le brief de surface ; `DESIGN.md` est écrit à la fin d'après ce qui est construit.
- Accessibilité : navigation complète au clavier, focus visible, animations retirées sous `prefers-reduced-motion`.

## 10. Fichiers

```
site/                 le dossier publié, et lui seul (§ 14)
  index.html, style.css, index.js, favicon.svg   l'interface
  worker.js           le calcul en arrière-plan (§ 8.2)
  lib/                le moteur : lecture des CSV et des règles, simulation, choix des achats, paliers
  data/rules.json     les règles du § 7
  data/*.csv          les 6 CSV MinigameFishingDerby* (source de vérité, lus au démarrage)
fishing_derby_data/   le README de provenance des CSV et model_check.py, qui lit ../site/data/
docs/                 cette spec et les autres documents de travail
server.js             serveur local de développement (Node, comme les outils voisins) : il sert site/ et rien d'autre
tests/                tests node --test, qui importent ../site/lib/
.github/workflows/test.yml   les tests à chaque envoi et pull request
.editorconfig, .gitattributes (fins de ligne LF), .gitignore, README.md, LICENSE
```

Règles du dossier publié :

- **Tout ce qui est dans `site/` est publié**, même si le dépôt reste privé (§ 14). Seuls les fichiers que la page sert y entrent. Restent dehors : la spec et `docs/`, `tests/`, les README, `model_check.py`, `.github/` et tout script de mesure ou de développement.
- **Liens relatifs partout dans `site/`** (imports `./lib/…`, `data/rules.json`, `new Worker("worker.js", …)`) : aucun chemin ne commence par `/`. Le site marche ainsi sous `*.pages.dev`, sous les adresses de prévisualisation et sous `derby.kasaden.io`.
- **Le serveur de développement sert `site/`**, comme Cloudflare Pages : un fichier oublié hors de `site/` se voit en local, avant la mise en ligne.
- Les 6 CSV passent de `fishing_derby_data/` à `site/data/` avec `git mv`, pour que `git log --follow` retrouve leur historique. Le README de provenance et `model_check.py` sont mis à jour avec ce chemin.

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
- choix des achats : cas construits où le bon achat est connu d'avance (par exemple un achat gratuit qui augmente la taille), cas où un achat bon marché n'apporte rien et ne doit jamais être recommandé, déterminisme, respect du délai ;
- contrôle de qualité du § 8.3 ;
- dossier publié : un test liste le contenu de `site/` et échoue sur un fichier non prévu (un `.md`, un `.py`, un fichier caché) ou sur un chemin qui commence par `/` dans les fichiers servis **[Proposition]**.

Interface (preuve par le rendu) : captures à 375 et 1 440 px, `npx impeccable detect`, parcours complet au clavier, animations réduites. Ce qui n'a pas pu être vérifié est dit.

## 13. Ordre de construction

1. Moteur, `rules.json` et tests. Commence dès le plan validé ; les relevés du 15 octobre fixent, si le jeu les affiche, les règles 3 à 6 et 8 à 10 du § 7.
2. Interface, après le choix sur maquettes ; puis mise en ligne sur Cloudflare Pages (§ 14), une fois que le propriétaire a créé le compte et le projet.
3. Corrections de `rules.json` au fil des relevés pendant l'événement.
4. Ajout au hub (`../tt2_hub/tools.json` et emblème) : autre dépôt, tâche séparée, avec l'accord du propriétaire. Son `url` sera l'adresse en `*.pages.dev`, puis `derby.kasaden.io`.

## 14. Publication

**Pour l'instant (propriétaire, 14 octobre 2026, soir)** : GitHub Pages, via le workflow `.github/workflows/pages.yml` (tests, puis publication du seul dossier `site/` à chaque envoi sur `main`). Adresse attendue : `https://kasaden.github.io/tt2_fishing_derby/`. GitHub Pages gratuit exige un dépôt public. Les décisions Cloudflare ci-dessous restent la cible suivante.

Décisions du propriétaire du 14 octobre 2026, prises dans la session du hub. La documentation Cloudflare citée en bas de section a été lue le même jour.

- **Hébergeur** : Cloudflare Pages, connecté au dépôt GitHub (Git integration). Branche de production : `main`. Chaque autre branche poussée donne une version de prévisualisation, à sa propre adresse.
- **Réglages du projet**, saisis par le propriétaire, qui crée lui-même le compte et le projet :
  - Framework preset : aucun ;
  - Build command : vide (« If you do not need a build step, leave the Build command field blank ») ;
  - Build output directory : `site`.
- **Ce qui est publié** : Cloudflare met en ligne tout le contenu du dossier de sortie. Tout ce qui est dans `site/` devient donc public, même si le dépôt reste privé. C'est pour cela que le § 10 n'y met que les fichiers servis.
- **Adresse** : d'abord une adresse en `*.pages.dev`, que Cloudflare tire du nom du projet. Nom proposé, avec des tirets : `tt2-fishing-derby`. L'adresse exacte se lit dans le tableau de bord une fois le projet créé **[À vérifier]**. Ensuite `derby.kasaden.io`, une fois le domaine acheté : le sous-domaine s'ajoute dans le projet (Custom domains, puis Set up a domain), et pour un sous-domaine, le domaine n'a pas besoin d'être une zone Cloudflare.
- **Dépôt** : Cloudflare Pages accepte les dépôts privés comme publics. Le dépôt peut rester privé, et sa visibilité reste une décision du propriétaire. La contrainte de GitHub Pages gratuit (dépôt public) ne s'applique plus. Conséquence à trancher avec cette décision (§ 15) : si le dépôt reste privé, le lien vers le code source que le pied de page du hub prévoit (`../tt2_hub/DESIGN.md`, Footer) et le champ `repo` de `tools.json` mèneront les visiteurs à une 404.
- **Aucun code côté serveur**, donc pas de Pages Functions. Leurs appels sont comptés comme des requêtes Workers. Le plan gratuit des Workers les limite à 100 000 par jour et à 10 ms de CPU par requête HTTP. Les requêtes vers des fichiers statiques, elles, sont gratuites et sans limite. L'outil n'est fait que de fichiers statiques : tout le calcul tourne dans le navigateur (§ 8).
- **Sauvegarde du navigateur** : `localStorage` est propre à chaque adresse. Au passage de `*.pages.dev` à `derby.kasaden.io`, la saisie gardée ne suivra pas. Aucune migration n'est prévue : le propriétaire l'accepte.
- **Hub** : `../tt2_hub` reste en lecture seule depuis ce dépôt. L'ajout au hub reste la tâche séparée du § 13.4.

Sources : [Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/), [Custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/).

## 15. Questions ouvertes

- **Nom de l'outil** : « TT2 Fishing Derby Optimizer » est une proposition, à confirmer par le propriétaire.
- **Visibilité du dépôt** (décision du propriétaire) et, s'il reste privé, ce que deviennent le lien vers le code source du pied de page et le champ `repo` du hub (§ 14).
- Adresse exacte en `*.pages.dev`, connue une fois le projet Cloudflare créé.
- Existence et effet de `FishingBait` ; ce qui fait monter le niveau de la table de rareté.
- Bases du plafond quotidien et de la capacité de la Tacklebox ; unité de `TackleBoxSpeed` et sens de sa valeur 0.
- Le plafond quotidien limite-t-il les lures gagnés ou les prises ; heure de remise à zéro.
- Correspondance niveau affiché ↔ position dans les listes ; rôle du 12e coût de `TackleBoxSize`.
- Tirage des espèces et de la taille ; rôle de `RaritySize` et de `BaseSize`.
- Les lures non utilisés sont-ils conservés, et sans limite ?
- Un export de compte fait pendant l'événement contient-il des données de pêche ?
