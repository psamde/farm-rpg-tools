import copy
import json
from pathlib import Path
import unittest
from planner import plan
from secondary import consume_leftovers
from test_planner import small_catalog


class BalancedTests(unittest.TestCase):
    def fixture(self):
        c=small_catalog()
        c['items']['3']['direct_ingredients']={'1':1}
        for r,name,recipe in [('5','First',{'1':1}),('6','Second',{'1':1}),('7','Missing',{'4':1,'8':1})]:
            c['items'][r]=dict(id=r,name=name,craftable=True,direct_ingredients=recipe,output_quantity=1)
        c['items']['8']=dict(id='8',name='External',craftable=False,direct_ingredients={},output_quantity=1)
        return c,plan(c,'Target',1,inventory={'1':101})

    def balanced(self,r):
        for b in r['item_balances']:
            supplied=b['starting_inventory']+b['expected_exploration_drops']+b['crafted']+b['free_perk_supply']
            self.assertAlmostEqual(supplied,b['consumed_by_crafting']+b['expected_final_inventory'],places=5,msg=b['name'])
            self.assertGreaterEqual(b['expected_final_inventory']+1e-6,b['reserved_target_output'])
        self.assertEqual(sum(a['explores'] for a in r['areas']),r['optimal_total_explores'])

    def test_breadth_and_soft_reordering(self):
        c,p=self.fixture()
        rows=[{'item_id':'5','allow_exploration':False},{'item_id':'6','allow_exploration':False}]
        a=consume_leftovers(c,p,rows)
        b=consume_leftovers(c,p,rows[::-1])
        counts={x['item_id']:x['crafts'] for x in a['secondary']['targets']}
        swapped={x['item_id']:x['crafts'] for x in b['secondary']['targets']}
        self.assertGreater(counts['5'],0); self.assertGreater(counts['6'],0)
        self.assertGreater(counts['5'],counts['6'])
        self.assertGreater(swapped['6'],swapped['5'])
        self.assertEqual(a['optimal_total_explores'],p['optimal_total_explores'])
        self.balanced(a); self.balanced(b)

    def test_cap_and_zero_cap(self):
        c,p=self.fixture()
        for cap in [0,10]:
            r=consume_leftovers(c,p,[{'item_id':'5','cap':cap},{'item_id':'6'}])
            self.assertLessEqual(r['secondary']['targets'][0]['crafts'],cap)
            self.assertGreater(r['secondary']['targets'][1]['crafts'],0)
            self.balanced(r)

    def test_missing_external_does_not_break_other_goals(self):
        c,p=self.fixture()
        r=consume_leftovers(c,p,[{'item_id':'7','allow_exploration':True,'exploration_item_id':'4'},{'item_id':'5'}])
        self.assertEqual(r['secondary']['targets'][0]['crafts'],0)
        self.assertIn('8',[x['item_id'] for x in r['secondary']['targets'][0]['missing_for_next_craft']])
        self.assertGreater(r['secondary']['targets'][1]['crafts'],0)
        self.balanced(r)

    def test_existing_finished_stock_does_not_cancel_new_crafts(self):
        c,_=self.fixture(); p=plan(c,'Target',1,inventory={'1':101,'5':1000})
        r=consume_leftovers(c,p,[{'item_id':'5'}])
        self.assertEqual(r['secondary']['targets'][0]['crafts'],100)
        self.balanced(r)

    def test_caps_include_intermediates_and_order_is_dependencies_first(self):
        c,p=self.fixture(); c['items']['6']['direct_ingredients']={'5':1}
        r=consume_leftovers(c,p,[{'item_id':'6'},{'item_id':'5','cap':30}])
        rows=r['secondary']['crafts_in_dependency_order']; ids=[x['item_id'] for x in rows]
        self.assertLess(ids.index('5'),ids.index('6'))
        self.assertLessEqual(next(x['crafts'] for x in rows if x['item_id']=='5'),30)
        self.balanced(r)

    def test_empty_and_inputs_unchanged(self):
        c,p=self.fixture(); before=copy.deepcopy((c,p))
        self.assertIs(consume_leftovers(c,p,[]),p)
        consume_leftovers(c,p,[{'item_id':'5'}])
        self.assertEqual((c,p),before)

    def test_multi_ingredient_focus_and_area_limit(self):
        c,p=self.fixture()
        c['items']['6']['direct_ingredients']={'1':1,'2':1}
        c['items']['5']['direct_ingredients']={'6':1,'2':1}
        p=plan(c,'Target',1,inventory={'1':101,'6':10})
        r=consume_leftovers(c,p,[{'item_id':'5','allow_exploration':True,'exploration_item_id':'6'}],max_areas=1)
        self.assertLessEqual(len(r['areas']),1)
        self.assertGreater(r['secondary']['targets'][0]['crafts'],0)
        self.balanced(r)

    def test_saved_shared_pool_and_later_antlers(self):
        c=json.loads(Path('data/catalog.json').read_text(encoding='utf8'))
        payload=json.loads(Path('test_shared_pool_plan.json').read_text(encoding='utf8'))
        p=plan(c,payload['targets'],**{k:payload[k] for k in ('areas','inventory','iron_depot','runecube','resource_saver')})
        counts=[]
        for enabled in [False,True]:
            payload['secondary'][0]['allow_exploration']=enabled
            r=consume_leftovers(c,p,payload['secondary'],payload['areas'],15)
            values={x['item_id']:x['crafts'] for x in r['secondary']['targets']}
            for ref in ['118','83','82','896','125']: self.assertGreater(values[ref],1000)
            bottle=next(b for b in r['item_balances'] if b['item_id']=='117')
            self.assertLess(bottle['expected_unused'],2)
            self.assertLessEqual(len(r['areas']),15)
            counts.append(values['500']); self.balanced(r)
        self.assertGreater(counts[1],counts[0])

    def test_focus_stock_respects_shared_ingredients(self):
        c,_=self.fixture()
        c['items']['5']['direct_ingredients']={'1':3}
        c['items']['6']['direct_ingredients']={'5':1,'1':1}
        c['items']['7']['direct_ingredients']={'6':1,'2':1}
        p=plan(c,'Target',1,inventory={'1':11,'5':4})
        r=consume_leftovers(c,p,[{'item_id':'7','allow_exploration':True,'exploration_item_id':'6'}])
        # Four stored intermediates consume four raw A in the focus recipe;
        # the remaining six A make 1.5 more focus items, not 2.5.
        self.assertAlmostEqual(r['secondary']['exploration_reference_crafts']['7'],5.5)
        self.balanced(r)

    def test_purple_bag_stored_bottles_and_perks(self):
        from browser_engine import compute
        c=json.loads(Path('data/catalog.json').read_text(encoding='utf8'))
        payload=json.loads(Path('test_purple_bag_plan.json').read_text(encoding='utf8'))
        results=[]
        for saver,rune in [(0,False),(45,False),(0,True),(45,True)]:
            result=compute(c,{**payload,'resource_saver':saver,'runecube':rune},deferred=[])
            self.assertFalse(result['performance']['primary_cache_hit'])
            r=result['plans'][0]; results.append(r); self.balanced(r)
            bag=next(t for t in r['secondary']['targets'] if t['item_id']=='539')
            self.assertGreaterEqual(bag['crafts'],9990)
            self.assertAlmostEqual(r['secondary']['exploration_reference_crafts']['539'],20000*(1+saver/100)**2)
        bag_counts=[next(t['crafts'] for t in r['secondary']['targets'] if t['item_id']=='539') for r in results]
        self.assertGreater(bag_counts[1],bag_counts[0]*2)
        self.assertNotEqual(results[0]['optimal_total_explores'],results[2]['optimal_total_explores'])
        # Resource Saver changes crafting, not the collection rate of Ant Apples.
        self.assertEqual(results[0]['secondary']['primary_explores'],results[1]['secondary']['primary_explores'])


if __name__=='__main__': unittest.main()
