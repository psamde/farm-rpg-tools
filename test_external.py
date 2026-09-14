import unittest
from pathlib import Path
from farmdata import read_json
from planner import plan
from secondary import consume_leftovers

class ExternalSupplyTests(unittest.TestCase):
 def test_chum_requires_explicit_external_supplies(self):
  c=read_json(Path('data/catalog.json'))
  p=plan(c,{'Chum':10},iron_depot=True)
  external={b['name']:b['required_external_supply'] for b in p['item_balances'] if b['required_external_supply']}
  self.assertEqual(external,{'Grubs':70,'Minnows':40,'Worms':100})
  self.assertGreater(p['optimal_total_explores'],0)
  stocked=plan(c,{'Chum':10},inventory=external,iron_depot=True)
  self.assertFalse(any(b['required_external_supply'] for b in stocked['item_balances']))
  secondary=consume_leftovers(c,p,[{'item_id':'Chum','allow_exploration':True}])
  self.assertEqual(secondary['secondary']['targets'][0]['crafts'],0)
