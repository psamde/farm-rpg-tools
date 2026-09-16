import unittest
from copy import deepcopy
from test_planner import small_catalog
from planner import plan
from automatic import maximize
from secondary import consume_leftovers

class AutomaticTests(unittest.TestCase):
 def fixture(self):
  c=small_catalog();c['items']['3']['direct_ingredients']={'1':1}
  c['items']['5']=dict(id='5',name='Useful',craftable=True,direct_ingredients={'4':1,'2':1},output_quantity=1)
  c['sources']['joint2']['expected_drops_per_explore']=0
  del c['sources']['joint2']
  c['sources']['joint4']['expected_drops_per_explore']=1
  c['sources']['b2']['expected_drops_per_explore']=100
  return c,plan(c,'Target',100,areas=['joint'])
 def test_limits_budget_physical_balance_and_reproduction(self):
  c,p=self.fixture();original=deepcopy(p)
  r=maximize(c,p,['joint','b'],0)
  self.assertEqual(p,original)
  for option in r['options']:
   m=option['metrics'];self.assertLessEqual(len(m['new_locations']),option['max_extra_locations'])
   self.assertLessEqual(m['extra_explores'],r['extra_explore_budget'])
   again=consume_leftovers(c,p,option['goals'],areas=option['areas'])
   self.assertEqual(again,option['plan'])
   for b in option['plan']['item_balances']:
    self.assertAlmostEqual(b['starting_inventory']+b['expected_exploration_drops']+b['crafted']+b['free_perk_supply'],b['consumed_by_crafting']+b['expected_final_inventory'])
  self.assertEqual(r['options'][0]['metrics']['extra_explores'],0)
  self.assertEqual(r['options'][1]['metrics']['crafted_types'],0)
  self.assertGreater(r['options'][2]['metrics']['crafted_types'],0)
 def test_unavailable_location_and_external_ingredients(self):
  c,p=self.fixture()
  r=maximize(c,p,['joint'],1)
  self.assertTrue(all(not o['goals'] for o in r['options']))
  c['items']['8']=dict(id='8',name='Farm only',craftable=False,direct_ingredients={},output_quantity=1)
  c['items']['5']['direct_ingredients']['8']=1
  r=maximize(c,p,['joint','b'],1)
  self.assertTrue(all(not o['goals'] for o in r['options']))
 def test_invalid_limit(self):
  c,p=self.fixture()
  for n in [-1,16,True,1.5]:
   with self.assertRaises(ValueError):maximize(c,p,['joint'],n)

if __name__=='__main__':unittest.main()
