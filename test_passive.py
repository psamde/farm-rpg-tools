import unittest
from planner import passive_plans
from secondary import consume_leftovers
from test_planner import small_catalog

class PassiveTests(unittest.TestCase):
    def test_supplies_without_primary(self):
        c=small_catalog();p=passive_plans(c,{'1':20,'2':10},['joint','a','b'])['plans'][0]
        r=consume_leftovers(c,p,[{'item_id':'3','allow_exploration':False,'cap':None}])
        self.assertEqual(r['secondary']['targets'][0]['crafts'],10)
        self.assertEqual(r['optimal_total_explores'],0)
        self.assertEqual(r['targets'],[])
    def test_exploration_fills_missing_inputs_and_caps(self):
        c=small_catalog();p=passive_plans(c,{'1':20},['joint','a','b'])['plans'][0]
        r=consume_leftovers(c,p,[{'item_id':'3','allow_exploration':True,'cap':15}])
        self.assertEqual(r['secondary']['targets'][0]['crafts'],15)
        self.assertGreater(r['optimal_total_explores'],0)
    def test_empty_supplies(self):
        c=small_catalog();p=passive_plans(c,{},['joint','a','b'])['plans'][0]
        r=consume_leftovers(c,p,[{'item_id':'3','allow_exploration':True,'cap':None}])
        self.assertEqual(r['secondary']['targets'][0]['crafts'],0)
        self.assertEqual(r['optimal_total_explores'],0)
