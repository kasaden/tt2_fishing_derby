# TT2 Fishing Derby — Données numériques publiques

Source : https://github.com/rawrzcookie/TT2_CSV/tree/main/csv
Fichiers `MinigameFishingDerby*.csv`, lus le 14 octobre 2026. Depuis le 14 octobre 2026, ils vivent dans `../site/data/`, le dossier publié par l'outil (déplacés avec `git mv`, leur historique se suit avec `git log --follow`). Ce dossier garde ce README et `model_check.py`.

Dernière modification de chaque fichier dans le dépôt source (historique des commits GitHub, consulté le 14 octobre 2026) :

| Fichier | Dernière modification | Ce qui a changé |
|---|---|---|
| RewardInfo | 13 octobre 2026 | `Title:15` → `Title:20` pour le top 5 |
| RarityInfo | 23 mars 2026 | Poids rééquilibrés (niveau 1 : Rarity1 250000 → 170000 ; niveaux 4 à 12) |
| UpgradeInfo | 5 août 2025 | — |
| FishInfo | 5 août 2025 | — |
| SoloContributionRewards | 5 août 2025 | — |
| XPInfo | 15 juillet 2025 | — |

Contenu :
- UpgradeInfo : 7 améliorations (coûts `XPCost`, bonus `BonusValue`, plafond affiché).
- RarityInfo : 12 lignes de poids/probabilités de 5 raretés.
- XPInfo : valeurs XP de la capture par rareté (1, 2, 5, 25, 25).
- FishInfo : 50 ID de poissons et tailles/conditions de niveau.
- RewardInfo : récompenses du classement (rangs 1-100).
- SoloContributionRewards : 41 paliers de taille cumulée.
- model_check.py : vérification des tableaux et calcul de l'XP moyen par capture par ligne de rareté.

## Statut de validation
L'archive reproduit les valeurs des CSV communautaires du dépôt et **ne valide pas** leur correspondance avec l'événement du 15 octobre 2026.
`MaxLevel` vaut 11 pour TackleBoxSize, mais XPCost comporte 12 valeurs et BonusValue seulement 11 valeurs.
Les tableaux `BonusValue` ne suffisent pas à inférer la fonction exacte de génération, la sélection des espèces ou la distribution de la taille.
Les niveaux de RarityInfo ne doivent pas être automatiquement assimilés à l'amélioration FishingBait avant confirmation en jeu.
Attention : les noms « XP », « coins » et l'unité des tailles sont à confirmer en jeu.

Commande : `python model_check.py` (lit les CSV dans `../site/data/`).
