import unittest
from pathlib import Path
from farmdata import read_json
from planner import plan, ranked_plans
from secondary import consume_leftovers
from test_planner import small_catalog

class CollectionTargets(unittest.TestCase):
    def test_raw_stock_and_crafting_reservations(self):
        c=small_catalog()
        p=plan(c,{'1':20,'3':5},inventory={'1':7})
        b=next(b for b in p['item_balances'] if b['item_id']=='1')
        self.assertGreaterEqual(b['expected_final_inventory'],20)
        self.assertEqual(b['reserved_target_output'],20)
        self.assertEqual(next(t for t in p['targets'] if t['item_id']=='1')['kind'],'collect')
        q=consume_leftovers(c,plan(c,{'1':20}),[{'item_id':'3','allow_exploration':True,'cap':10}])
        self.assertGreaterEqual(next(b for b in q['item_balances'] if b['item_id']=='1')['expected_final_inventory'],20-1e-6)
    def test_reject_unobtainable(self):
        c=small_catalog();c['items']['none']={'name':'No source','craftable':False,'direct_ingredients':{},'output_quantity':1}
        with self.assertRaises(ValueError):plan(c,{'none':1})
    def test_ant_apple(self):
        c=read_json(Path(__file__).parent/'data/catalog.json')
        p=ranked_plans(c,{'Ant Apple':200},iron_depot=True,runecube=True,max_areas=3)
        self.assertTrue(p['plans'])
        b=next(b for b in p['plans'][0]['item_balances'] if b['name']=='Ant Apple')
        self.assertGreaterEqual(b['expected_final_inventory'],200)
        self.assertEqual(p['plans'][0]['crafts_in_dependency_order'],[])
