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
 def test_potato_battery_auto_inventory_and_area_error(self):
  c=read_json(Path('data/catalog.json'))
  areas=['explore:'+str(i) for i in range(1,10)]
  with self.assertRaisesRegex(ValueError,'Jundland Desert'):
   plan(c,{'Potato Battery':10000},areas=areas,iron_depot=True,runecube=True,resource_saver=45)
  p=plan(c,{'Potato Battery':10000},areas=areas+['explore:13'],iron_depot=True,runecube=True,resource_saver=45)
  potato=next(b for b in p['item_balances'] if b['name']=='Potato')
  self.assertEqual(potato['auto_starting_inventory'],55173)
  self.assertEqual(potato['starting_inventory'],55173)
  self.assertAlmostEqual(potato['consumed_by_crafting'],80000/1.45)
  self.assertAlmostEqual(potato['starting_inventory'],potato['consumed_by_crafting']+potato['expected_final_inventory'])
  smaller=plan(c,{'Potato Battery':100},inventory={'Potato':200},iron_depot=True,runecube=True,resource_saver=45)
  potato=next(b for b in smaller['item_balances'] if b['name']=='Potato')
  self.assertEqual(potato['auto_starting_inventory'],352)
  self.assertEqual(potato['entered_starting_inventory'],200)
  self.assertEqual(potato['starting_inventory'],552)
