import copy
import unittest
from planner import plan
from secondary import consume_leftovers, validate_secondary
from test_planner import small_catalog


class SecondaryTests(unittest.TestCase):
    def fixture(self, shared=True):
        c = small_catalog()
        for ref, name, ingredients in [('5', 'First', {'1': 1}), ('6', 'Second', {'1' if shared else '2': 2})]:
            c['items'][ref] = dict(id=ref, name=name, craftable=True, direct_ingredients=ingredients, output_quantity=1)
        p = plan(c, 'Target', 1, inventory={'A': 11, 'B': 11})
        return c, p

    def assert_balanced(self, result):
        for r in result['item_balances']:
            self.assertAlmostEqual(r['starting_inventory']+r['expected_exploration_drops']+r['crafted']+r['free_perk_supply'],
                                   r['consumed_by_crafting']+r['expected_final_inventory'])
            self.assertAlmostEqual(r['expected_final_inventory'], r['expected_unused']+r['reserved_target_output']+r.get('reserved_secondary_output', 0))

    def test_small_route_remains_exact(self):
        c, p = self.fixture()
        result = consume_leftovers(c, p, [{'item_id':'5'}])
        self.assertEqual(result['solver']['maximum_gap_explores'], 0)
        self.assertTrue(result['solver']['optimal'])
        self.assert_balanced(result)

    def test_deferred_comparisons_preserve_route(self):
        c, p = self.fixture()
        goals = [{'item_id':'5'}, {'item_id':'6'}]
        expected = consume_leftovers(c, p, goals)
        pending = []
        actual = consume_leftovers(c, p, goals, defer_comparison=pending.append)
        self.assertTrue(pending)
        self.assertTrue(any(t.get('comparison_status') == 'pending' for t in actual['secondary']['targets']))
        quantities = [t['crafts'] for t in actual['secondary']['targets']]
        for finish in pending:
            finish()
        self.assertEqual(quantities, [t['crafts'] for t in actual['secondary']['targets']])
        self.assertEqual(actual['areas'], expected['areas'])
        self.assertEqual([t['if_first'] for t in actual['secondary']['targets']],
                         [t['if_first'] for t in expected['secondary']['targets']])
        self.assertFalse(any(t.get('comparison_status') == 'pending' for t in actual['secondary']['targets']))

    def test_missing_and_assisted_material_limit(self):
        c, p = self.fixture()
        c['items']['6']['direct_ingredients'] = {'5': 1, '2': 2}
        # Ten A surplus can make ten First; no B remains for Second.
        p = plan(c, 'Target', 1, inventory={'A': 11, 'B': 1})
        goals = [{'item_id':'5', 'source_item_id':'1'},
                 {'item_id':'6', 'source_item_id':'5'}]
        base = consume_leftovers(c, p, goals)
        self.assertEqual(base['secondary']['targets'][1]['crafts'], 0)
        self.assertEqual(base['secondary']['targets'][1]['missing_for_next_craft'],
                         [{'item_id':'2', 'name':'B', 'quantity':2}])
        self.assertEqual(next(b for b in base['item_balances'] if b['item_id']=='1')['used_by_leftover_craft'], 10)
        goals[1]['allow_exploration'] = True
        r = consume_leftovers(c, p, goals)
        self.assertNotIn('anchor_limit', r['secondary']['targets'][1])
        self.assertEqual(r['secondary']['targets'][1]['crafts'], 10)
        self.assertEqual(r['secondary']['additional_explores'], 34)
        self.assert_balanced(r)
        # New A drops cannot increase the frozen ten-item limit.
        self.assertEqual(r['targets'], p['targets'])
        restricted = consume_leftovers(c, p, goals, max_areas=0)
        self.assertEqual(restricted['secondary']['additional_explores'], 0)
        self.assertEqual(restricted['secondary']['targets'][1]['crafts'], 0)
        self.assertTrue(validate_secondary(c, [{'item_id':'6', 'allow_exploration':True}])[0]['allow_exploration'])

    def test_competing_priorities_and_reordering(self):
        c, p = self.fixture()
        original = copy.deepcopy(p)
        r = consume_leftovers(c, p, [{'item_id':'5'}, {'item_id':'6'}])
        self.assertEqual([t['crafts'] for t in r['secondary']['targets']], [10, 0])
        self.assertEqual(r['secondary']['targets'][1]['if_first'], 5)
        self.assertTrue(r['secondary']['priority_matters'])
        swapped = consume_leftovers(c, p, [{'item_id':'6'}, {'item_id':'5'}])
        self.assertEqual([t['crafts'] for t in swapped['secondary']['targets']], [5, 0])
        self.assertEqual(p, original)
        self.assertEqual(r['optimal_total_explores'], p['optimal_total_explores'])
        self.assert_balanced(r)

    def test_independent_and_caps(self):
        c, p = self.fixture(False)
        r = consume_leftovers(c, p, [{'item_id':'5'}, {'item_id':'6'}])
        self.assertFalse(r['secondary']['priority_matters'])
        self.assertEqual([t['crafts'] for t in r['secondary']['targets']], [10, 5])
        c, p = self.fixture()
        r = consume_leftovers(c, p, [{'item_id':'5', 'cap':4}, {'item_id':'6'}])
        self.assertEqual([t['crafts'] for t in r['secondary']['targets']], [4, 3])
        self.assert_balanced(r)

    def test_intermediate_credit_shared(self):
        c, p = self.fixture()
        c['items']['6']['direct_ingredients'] = {'5':1}
        r = consume_leftovers(c, p, [{'item_id':'5'}, {'item_id':'6'}])
        self.assertEqual([t['crafts'] for t in r['secondary']['targets']], [10, 10])
        self.assertFalse(r['secondary']['priority_matters'])
        self.assert_balanced(r)

    def test_free_supply_does_not_create_leftover_credit(self):
        c, p = self.fixture()
        p['assumptions']['unlimited_free_items'] = [{'id':'1', 'name':'A'}]
        r = consume_leftovers(c, p, [{'item_id':'5'}])
        self.assertEqual(r['secondary']['targets'][0]['crafts'], 0)
        self.assertTrue(r['secondary']['targets'][0]['no_pool_inputs'])
        self.assert_balanced(r)

    def test_primary_outputs_reserved_and_saver(self):
        c, p = self.fixture()
        c['items']['6']['direct_ingredients'] = {'3':1}
        r = consume_leftovers(c, p, [{'item_id':'6', 'cap':100}])
        # The existing Target output stays reserved; only NEW Target crafts feed Second.
        self.assertEqual(r['secondary']['targets'][0]['crafts'], 10)
        self.assertEqual(next(x for x in r['item_balances'] if x['item_id']=='3')['reserved_target_output'], 1)
        p['assumptions']['resource_saver'] = 45
        r = consume_leftovers(c, p, [{'item_id':'5'}])
        self.assertEqual(r['secondary']['targets'][0]['crafts'], 14)
        self.assert_balanced(r)

    def test_joint_route_replaces_primary_area(self):
        c = small_catalog()
        c['items']['3']['direct_ingredients'] = {'1': 1}
        c['items']['5'] = dict(id='5',name='Side',craftable=True,direct_ingredients={'4':1,'2':1},output_quantity=1)
        c['sources'] = {}
        for loc, drops in [('a',{'1':1,'4':1}),('b',{'2':1}),('joint',{'1':.8,'2':.8,'4':1})]:
            for ref, rate in drops.items():
                c['sources'][loc+ref] = dict(kind='explore',location_id=loc,item_id=ref,expected_drops_per_explore=rate,conditions={})
        p = plan(c, 'Target', 10)
        self.assertEqual(p['areas'][0]['location_id'], 'a')
        r = consume_leftovers(c,p,[{'item_id':'5','allow_exploration':True}],max_areas=1)
        self.assertEqual(r['optimal_total_explores'], 13)
        self.assertEqual(r['areas'][0]['location_id'],'joint')
        self.assertEqual(r['secondary']['targets'][0]['crafts'],10)
        self.assertEqual(p['optimal_total_explores'],10)
        self.assert_balanced(r)
        restricted = consume_leftovers(c,p,[{'item_id':'5','allow_exploration':True}],areas=['a'],max_areas=1)
        self.assertEqual(restricted['secondary']['targets'][0]['crafts'],0)
        self.assertEqual(restricted['areas'][0]['location_id'],'a')

    def test_imbalanced_shared_pool_topup_and_no_feedback(self):
        c, p = self.fixture()
        c['items']['6']['direct_ingredients'] = {'1':1,'2':1}
        p = plan(c, 'Target', 1, inventory={'A':11,'B':6})
        r = consume_leftovers(c,p,[{'item_id':'6','allow_exploration':True}])
        # Consume both original supplies: fill the B deficit instead of
        # choosing one manual anchor or expanding with new A byproducts.
        self.assertEqual(r['secondary']['targets'][0]['crafts'],10)
        self.assertEqual(r['optimal_total_explores'],9)
        self.assert_balanced(r)
        no_extra = consume_leftovers(c,p,[{'item_id':'6'}])
        self.assertEqual(no_extra['secondary']['targets'][0]['crafts'],5)
        self.assertEqual(no_extra['optimal_total_explores'],0)

    def test_intermediate_stock_and_no_matching_pool(self):
        c, p = self.fixture()
        c['items']['6']['direct_ingredients']={'5':1,'2':1}
        p=plan(c,'Target',1,inventory={'A':1,'B':1,'First':10})
        r=consume_leftovers(c,p,[{'item_id':'6','allow_exploration':True}])
        self.assertEqual(r['secondary']['targets'][0]['crafts'],10)
        self.assert_balanced(r)
        p=plan(c,'Target',1,inventory={'A':1,'B':1})
        r=consume_leftovers(c,p,[{'item_id':'6','allow_exploration':True}])
        self.assertEqual(r['secondary']['targets'][0]['crafts'],0)
        self.assertEqual(r['optimal_total_explores'],0)

    def test_real_diary_chain_both_priority_orders(self):
        import json
        from pathlib import Path
        c=json.loads((Path(__file__).parent/'data/catalog.json').read_text(encoding='utf8'))
        p=plan(c,'Amethyst Necklace',30000,iron_depot=True,runecube=True,resource_saver=45)
        for ids in [('81','73','83'),('83','81','73')]:
            goals=[{'item_id':ref} for ref in ids]
            before=consume_leftovers(c,p,goals,max_areas=3)
            diary=next(t for t in before['secondary']['targets'] if t['item_id']=='83')
            self.assertEqual(diary['crafts'],0)
            self.assertIn('Mushroom',[m['name'] for m in diary['missing_for_next_craft']])
            next(g for g in goals if g['item_id']=='83')['allow_exploration']=True
            after=consume_leftovers(c,p,goals,max_areas=3)
            diary=next(t for t in after['secondary']['targets'] if t['item_id']=='83')
            self.assertGreater(diary['crafts'],49000)
            self.assertEqual(diary['missing_for_next_craft'],[])
            self.assertLessEqual(len(after['areas']),3)
            self.assertEqual(after['targets'],p['targets'])
            self.assert_balanced(after)

    def test_large_leather_diary_priority_locks_remain_feasible(self):
        import json
        from pathlib import Path
        from planner import ranked_plans
        c=json.loads((Path(__file__).parent/'data/catalog.json').read_text(encoding='utf8'))
        baseline=ranked_plans(c,'Linked Lantern',90000,iron_depot=True,runecube=True,resource_saver=45,max_areas=15)
        goals=[{'item_id':ref,'allow_exploration':ref=='118'} for ref in ['118','83','82','74','81','73']]
        for p in baseline['plans']:
            r=consume_leftovers(c,p,goals,max_areas=15)
            leather=next(t for t in r['secondary']['targets'] if t['item_id']=='118')
            self.assertGreater(leather['crafts'],300000)
            self.assertIn('Forest',[a['name'] for a in r['areas']])
            self.assertGreater(r['optimal_total_explores'],p['optimal_total_explores'])
            self.assertEqual(r['targets'],p['targets'])
            self.assertFalse(r['solver']['optimal'])
            self.assertEqual(r['solver']['maximum_gap_explores'],5)
            self.assert_balanced(r)

    def test_final_route_surplus_feeds_topaz_and_canteen(self):
        import json
        from pathlib import Path
        from planner import ranked_plans
        c=json.loads((Path(__file__).parent/'data/catalog.json').read_text(encoding='utf8'))
        ids={row['name']:ref for ref,row in c['items'].items()}
        areas=[ref for ref,row in c['locations'].items() if row['kind']=='explore' and row['name'] not in ["Santa's Workshop","Gary's Crushroom"]]
        baselines=ranked_plans(c,'Linked Lantern',90000,areas=areas,iron_depot=True,runecube=True,resource_saver=45,max_areas=15)
        p=next(p for p in baselines['plans'] if any(a['name']=='Mount Banon' for a in p['areas']))
        # This reference route contains no Quartz. The final assisted route
        # switches to Black Rock Canyon, where Quartz and Horn are obtained.
        self.assertFalse(any(b['name']=='Shimmer Quartz' and b['expected_unused']>0 for b in p['item_balances']))
        names=['Leather Diary','Green Diary','Green Parchment','Purple Diary','White Parchment','Purple Parchment','Blue Parchment','Shimmer Topaz','Horn Canteen']
        goals=[dict(item_id=ids[n],allow_exploration=n in ['Leather Diary','Purple Diary']) for n in names]
        r=consume_leftovers(c,p,goals,areas=areas,max_areas=15)
        targets={t['name']:t for t in r['secondary']['targets']}
        for name,count in [('Shimmer Topaz',2600),('Horn Canteen',11932)]:
            self.assertEqual(targets[name]['crafts'],count)
            self.assertEqual(targets[name]['crafts_from_final_surplus'],count)
            self.assertFalse(targets[name]['allow_exploration'])
        self.assertGreaterEqual(r['optimal_total_explores'],32848294)
        self.assertLessEqual(r['optimal_total_explores'],32848294+5)
        self.assert_balanced(r)

    def test_caps_include_final_pass_and_intermediates(self):
        c,p=self.fixture()
        r=consume_leftovers(c,p,[{'item_id':'5','cap':4},{'item_id':'6','cap':2}])
        self.assertEqual([t['crafts'] for t in r['secondary']['targets']],[4,2])
        self.assert_balanced(r)
        c['items']['6']['direct_ingredients']={'5':1}
        r=consume_leftovers(c,p,[{'item_id':'5','cap':3},{'item_id':'6','allow_exploration':True,'cap':2}])
        self.assertLessEqual(r['secondary']['targets'][0]['crafts'],3)
        self.assertEqual(r['secondary']['targets'][1]['crafts'],2)
        self.assert_balanced(r)
        for cap in [-1, True, 1.5]:
            with self.assertRaises(ValueError): validate_secondary(c,[{'item_id':'5','cap':cap}])

    def test_validation(self):
        c, _ = self.fixture()
        for rows in [[{'item_id':'5','allow_exploration':'yes'}], [{'item_id':'1'}], [{'item_id':'5'},{'item_id':'5'}]]:
            with self.assertRaises(ValueError):
                validate_secondary(c, rows)


if __name__ == '__main__':
    unittest.main()
