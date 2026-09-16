import unittest
from copy import deepcopy
from test_automatic import AutomaticTests
from browser_engine import compute, guided_compute
from sync_quests import normalize

class GuidedTests(unittest.TestCase):
    def test_multiple_selected_crafts_share_stock_and_reproduce(self):
        c,_=AutomaticTests().fixture()
        c['items']['5']['direct_ingredients']={'4':1}
        c['items']['6']=dict(c['items']['5'],id='6',name='Another useful craft')
        goals=[dict(item_id=r,cap=200,allow_exploration=False,automatic_batch=True) for r in ['5','6']]
        payload=dict(targets={'3':100},areas=['joint','b'],secondary=[],chosen_goals=goals)
        preview=guided_compute(c,payload)
        applied=compute(c,dict(payload,secondary=goals))['plans'][0]
        self.assertEqual(preview['total_explores'],applied['optimal_total_explores'])
        self.assertEqual({g['item_id']:g['crafts'] for g in preview['outputs']},
                         {g['item_id']:g['crafts'] for g in applied['secondary']['targets']})
        self.assertTrue(all(g['crafts']>0 for g in preview['outputs']))
        self.assertLessEqual(sum(g['crafts'] for g in preview['outputs']),200)
        self.assertTrue(all(g['crafts']<200 for g in preview['outputs']))
        with self.assertRaises(ValueError):
            guided_compute(c,dict(payload,chosen_goals=[goals[0],goals[0]]))

    def test_preview_reproduces_and_leaves_input_untouched(self):
        c,_=AutomaticTests().fixture()
        payload=dict(targets={'3':100},areas=['joint','b'],secondary=[],material='4',
                     candidates=[dict(item_id='5',cap=100,allow_exploration=True)])
        original=deepcopy(payload)
        r=guided_compute(c,payload)
        self.assertEqual(payload,original)
        self.assertTrue(r['options'])
        o=r['options'][0]
        applied=compute(c,dict(payload,secondary=[o['goal']]))['plans'][0]
        self.assertEqual(o['total_explores'],applied['optimal_total_explores'])
        self.assertEqual(o['crafts'],applied['secondary']['targets'][0]['crafts'])
        self.assertGreater(o['material_used'],0)
        self.assertLessEqual(o['material_used'],100)
        self.assertGreater(o['extra_explores'],0)

    def test_no_assistance_cannot_get_missing_ingredient(self):
        c,_=AutomaticTests().fixture()
        r=guided_compute(c,dict(targets={'3':100},areas=['joint','b'],secondary=[],material='4',
            candidates=[dict(item_id='5',cap=100,allow_exploration=False)]))
        self.assertEqual(r['options'],[])

    def test_existing_location_can_supply_more_without_growing_craft_cap(self):
        c,_=AutomaticTests().fixture()
        c['sources']['joint2']=dict(c['sources']['b2'],location_id='joint',expected_drops_per_explore=.1)
        goal=dict(item_id='5',cap=100,allow_exploration=True,automatic_batch=True)
        payload=dict(targets={'3':100},areas=['joint'],secondary=[],chosen_goals=[goal],automatic_areas=['joint'])
        preview=guided_compute(c,payload)
        self.assertEqual(preview['new_locations'],[])
        self.assertEqual(preview['preview_plan']['optimal_total_explores'], preview['total_explores'])
        self.assertTrue(all(b['expected_unused'] >= -1e-5 for b in preview['preview_plan']['item_balances']))
        self.assertGreater(preview['extra_explores'],0)
        self.assertGreater(preview['outputs'][0]['crafts'],10)
        self.assertLessEqual(preview['outputs'][0]['crafts'],100)
        applied=compute(c,dict(payload,secondary=[goal]))['plans'][0]
        self.assertAlmostEqual(preview['total_explores'],applied['optimal_total_explores'])
        self.assertEqual([a['location_id'] for a in applied['areas']],['joint'])

    def test_remove_last_craft_is_reviewable(self):
        c,_=AutomaticTests().fixture()
        goal=dict(item_id='5',cap=100,allow_exploration=True,automatic_batch=True)
        payload=dict(targets={'3':100},areas=['joint','b'],secondary=[goal],replacement_goals=[],chosen_goals=[])
        preview=guided_compute(c,payload)
        self.assertTrue(preview['replacement'])
        self.assertEqual(preview['goals'],[])
        self.assertEqual(preview['outputs'],[])
        self.assertLess(preview['extra_explores'],0)
        applied=compute(c,dict(payload,secondary=[]))['plans'][0]
        self.assertEqual(preview['total_explores'],applied['optimal_total_explores'])

    def test_quest_order_and_stable_item_ids(self):
        q=lambda id:dict(id=id,cleanTitle='Step '+str(id),requiredItems=[dict(quantity=3,item=dict(id=40,name='Stone'))])
        rows=normalize({'data':{'questlines':[dict(id=2,title='A quest',steps=[dict(order=2,quest=q(2)),dict(order=1,quest=q(1))])]}})
        self.assertEqual([q['id'] for q in rows[0]['quests']],['1','2'])
        self.assertEqual(rows[0]['quests'][0]['items'][0],dict(id='40',name='Stone',quantity=3))

if __name__=='__main__':unittest.main()
