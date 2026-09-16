import json
import unittest
from pathlib import Path
from browser_engine import compute, catalog_with_perks, COCKATRICE_ITEMS

class CockatriceTests(unittest.TestCase):
    def test_yields_and_cache_toggle(self):
        c=json.loads(Path('data/catalog.json').read_text(encoding='utf8'))
        boosted=catalog_with_perks(c, {'cockatrice_ether_source':True})
        self.assertIs(catalog_with_perks(boosted, {'cockatrice_ether_source':True}), boosted)
        self.assertIs(catalog_with_perks(c, {}), c)
        affected=set()
        for key, source in c['sources'].items():
            rate=source.get('expected_drops_per_explore')
            if rate is None: continue
            name=c['items'][source['item_id']]['name']
            multiplier=2 if source['kind']=='explore' and name in COCKATRICE_ITEMS else 1
            self.assertEqual(boosted['sources'][key]['expected_drops_per_explore'], rate*multiplier)
            if multiplier==2: affected.add(name)
        self.assertEqual(affected, COCKATRICE_ITEMS)
        ant=next(i for i,x in c['items'].items() if x['name']=='Fire Ant')
        area=next(i for i,x in c['locations'].items() if x['name']=='Forest')
        payload=dict(targets={ant:1000},areas=[area],secondary=[],runecube=True)
        before=compute(c,payload)['plans'][0]['optimal_total_explores']
        after=compute(c,dict(payload,cockatrice_ether_source=True))['plans'][0]['optimal_total_explores']
        self.assertLessEqual(abs(after-before/2),1)
        self.assertEqual(compute(c,payload)['plans'][0]['optimal_total_explores'],before)
        print(f'Fire Ant 1000: {before} explores without perk; {after} with perk')
