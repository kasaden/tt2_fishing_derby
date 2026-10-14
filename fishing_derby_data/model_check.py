"""Statistiques reproductibles des tables de Fishing Derby (sans simuler les règles inconnues)."""
import csv
from pathlib import Path
BASE = Path(__file__).resolve().parent

def read(filename):
    with (BASE / filename).open(newline='', encoding='utf-8') as f:
        return list(csv.DictReader(f))

rarities = read('MinigameFishingDerbyRarityInfo.csv')
xp = read('MinigameFishingDerbyXPInfo.csv')
fish = read('MinigameFishingDerbyFishInfo.csv')
upgrades = read('MinigameFishingDerbyUpgradeInfo.csv')
assert len(rarities) == 12 and len(fish) == 50 and len(upgrades) == 7
xp_by_rarity = {r['FishingDerbyRarity']: int(r['XP']) for r in xp}
print('Probabilités conditionnelles et XP espéré par capture (sans hypothèse de poisson):')
for r in rarities:
    probs = [float(r[f'Rarity{i}%']) for i in range(5)]
    assert abs(sum(probs) - 1) < 1e-6, r['Level']
    expectation = sum(probs[i] * xp_by_rarity[f'Rarity{i}'] for i in range(5))
    print(f"Niveau table rareté {r['Level']:>2}: E[XP] = {expectation:.5f} ; "
          f"P(rareté 4) = {probs[4]*100:.5f}%")

for u in upgrades:
    costs = list(map(int, u['XPCost'].split(',')))
    effects = [float(x) for x in u['BonusValue'].split(',')]
    print(u['FishingDerbyUpgradeID'], 'MaxLevel', u['MaxLevel'],
          'cost entries:', len(costs), 'bonus entries:', len(effects))
    if len(costs) != len(effects) or len(costs) != int(u['MaxLevel']):
        print('  ATTENTION: incohérence de longueurs, contrôler l’indexation en jeu.')
