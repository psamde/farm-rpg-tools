"""Acceptance coverage through the real catalog, shared solver and browser payloads."""
import copy
import itertools
import json
from pathlib import Path
import unittest

from browser_engine import compute, guided_compute
from secondary import consume_leftovers


class MapAcceptanceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = json.loads(Path('data/catalog.json').read_text(encoding='utf-8'))
        cls.ids = {v['name']: k for k, v in cls.catalog['items'].items()}
        cls.payload = dict(targets={cls.ids['Ant Apple']: 125}, areas=['explore:3', 'explore:7'],
                           iron_depot=True, runecube=True, resource_saver=45, map_planning=True,
                           map_sources={cls.ids['Mushroom']: ['explore:7']})
        cls.primary = compute(cls.catalog, dict(cls.payload, secondary=[]))['plans'][0]
        cls.parchments = ['White Parchment', 'Green Parchment', 'Purple Parchment']
        cls.diaries = ['Leather Diary', 'Green Diary', 'Purple Diary']

    def goal(self, name, **kw):
        return dict(item_id=self.ids[name], cap=None, consumer_mode='available', allow_exploration=False, **kw)

    def goals(self, diaries=None):
        return [self.goal(name) for name in [*self.parchments, *(diaries or self.diaries)]]

    def run_map(self, goals=None, sources=None):
        return consume_leftovers(self.catalog, self.primary, self.goals() if goals is None else goals,
            areas=self.payload['areas'], map_planning=True,
            map_sources=self.payload['map_sources'] if sources is None else sources)

    def counts(self, result):
        return {t['name']: t['crafts'] for t in result['secondary']['targets']}

    def conserve(self, result):
        for b in result['item_balances']:
            self.assertAlmostEqual(b['starting_inventory'] + b['expected_exploration_drops'] + b['crafted'] + b['free_perk_supply'],
                                   b['consumed_by_crafting'] + b['expected_final_inventory'], places=5, msg=b['name'])
            self.assertGreaterEqual(b['expected_final_inventory'] + 1e-6, b['reserved_target_output'])
        self.assertEqual(sum(a['explores'] for a in result['areas']), result['optimal_total_explores'])

    def test_jundland_source_connects_before_all_other_gaps_are_filled(self):
        payload = dict(self.payload, targets={self.ids['Langstaff Crest']: 163},
                       areas=['explore:13', 'explore:8', 'explore:9', 'explore:6'])
        primary = compute(self.catalog, dict(payload, secondary=[]))['plans'][0]
        goals = [self.goal('Spool of Copper'), self.goal('Energy Coil')]
        source = {self.ids['Coal']: ['explore:8']}
        result = consume_leftovers(self.catalog, primary, goals, areas=payload['areas'],
                                  map_planning=True, map_sources=source)
        self.assertGreater(next(a['explores'] for a in result['areas'] if a['location_id'] == 'explore:8'), 0)
        balances = {b['name']: b for b in result['item_balances']}
        self.assertGreater(balances['Coal']['expected_exploration_drops'], 40000)
        self.assertGreater(self.counts(result)['Spool of Copper'], 0)
        self.assertEqual(self.counts(result)['Energy Coil'], 0)  # Emberstone still missing.
        missing = {r['item_id'] for r in result['map_potential']['missing']}
        self.assertNotIn(self.ids['Coal'], missing)
        self.assertIn(self.ids['Emberstone'], missing)
        self.conserve(result)
        restored = consume_leftovers(self.catalog, primary, goals, areas=payload['areas'],
                                     map_planning=True, map_sources={})
        self.assertEqual(restored['optimal_total_explores'], primary['optimal_total_explores'])

    def test_explicit_exploration_amounts_do_not_grow_with_new_use_void_crafts(self):
        payload = dict(self.payload, targets={self.ids['Langstaff Crest']: 163},
                       areas=['explore:13','explore:8','explore:9','explore:7','explore:1','explore:3','explore:10'])
        primary = compute(self.catalog, dict(payload, secondary=[]))['plans'][0]
        sources = {self.ids[r]: [a] for r,a in [('Coal','explore:8'),('Emberstone','explore:9'),
                   ('Mushroom','explore:7'),('Bone','explore:1'),('Purple Flower','explore:3'),('Blue Gel','explore:10')]}
        amounts = {self.ids[r]: {a:q} for r,a,q in [('Coal','explore:8',920000),('Emberstone','explore:9',3100000),
                   ('Mushroom','explore:7',650000),('Bone','explore:1',115000),('Purple Flower','explore:3',100000),('Blue Gel','explore:10',100000)]}
        goals=[self.goal(n) for n in ['Spool of Copper','Energy Coil','Spiky Bracelet','Machine Press','Belt Drive','Pear Grease','Hourglass']]
        results=[]
        for count in [2,3,4,5,6,7]:
            result=consume_leftovers(self.catalog,primary,goals[:count],areas=payload['areas'],
                                    map_planning=True,map_sources=sources,map_source_explores=amounts)
            self.assertEqual(result['secondary']['additional_explores'],sum(sum(a.values()) for a in amounts.values()))
            self.conserve(result)
            results.append(result)
        final=results[-1]
        self.assertTrue(all(t['crafts']>0 for t in final['secondary']['targets']),self.counts(final))
        for row in final['secondary']['targets']:
            self.assertGreater(row['crafts']/max(1,row['if_first']), .2, row['name'])
        outputs={s['item_id'] for s in self.catalog['sources'].values() if s.get('location_id')=='explore:13' and s['kind']=='explore'}
        usable={r for r in outputs if any(r in i['direct_ingredients'] for i in self.catalog['items'].values())}
        self.assertEqual(len(usable),12)
        balances={b['item_id']:b for b in final['item_balances']}
        for ref in usable:self.assertGreater(balances[ref]['used_by_leftover_craft'],0,self.catalog['items'][ref]['name'])
        complete=dict(payload,secondary=goals,map_sources=sources,map_source_explores=amounts)
        restored=compute(self.catalog,json.loads(json.dumps(complete)))['plans'][0]
        self.assertEqual(self.counts(restored),self.counts(final))
        preview=guided_compute(self.catalog,dict(complete,secondary=goals[:-1],replacement_goals=goals))['preview_plan']
        self.assertEqual(self.counts(preview),self.counts(final))
        self.assertEqual(preview['optimal_total_explores'],final['optimal_total_explores'])

    def test_blocked_external_craft_keeps_usable_selected_inputs_balanced(self):
        payload = dict(self.payload, targets={self.ids['Langstaff Crest']: 163},
                       areas=['explore:13','explore:8','explore:9','explore:7','explore:1','explore:3','explore:10'],inventory={self.ids['Corn']:0})
        primary = compute(self.catalog, dict(payload, secondary=[]))['plans'][0]
        routes = [('Coal','explore:8',511980),('Emberstone','explore:9',3089731),
                  ('Mushroom','explore:7',590652),('Bone','explore:1',110791),
                  ('Purple Flower','explore:3',9941462),('Blue Gel','explore:10',3231339)]
        sources = {self.ids[r]:[a] for r,a,_ in routes}
        amounts = {self.ids[r]:{a:q} for r,a,q in routes}
        goals = [self.goal(n) for n in ['Spool of Copper','Energy Coil','Spiky Bracelet',
                                       'Machine Press','Belt Drive','Pear Grease','Hourglass']]
        def run(selected, base=primary):
            result = consume_leftovers(self.catalog, base, selected, areas=payload['areas'],
                map_planning=True, map_sources=sources, map_source_explores=amounts)
            self.conserve(result)
            self.assertEqual(result['secondary']['additional_explores'],sum(q for _,_,q in routes))
            return result
        before = run(goals)
        extended = [*goals,self.goal('Corn Oil'),self.goal('Engine',user_cap=True)]
        extended[-1]['cap'] = 0  # Engine paused by a user-selected Void/Sell input.
        blocked = run(extended)
        self.assertEqual(self.counts(blocked)['Corn Oil'],0)
        self.assertGreater(self.counts(blocked)['Machine Press'],1000)
        for name,q in self.counts(before).items():
            self.assertAlmostEqual(self.counts(blocked)[name],q,delta=10,msg=name)
        # Supplying Corn enables its consumer without changing exploration.
        supplied = compute(self.catalog,dict(payload,secondary=[],inventory={self.ids['Corn']:10000}))['plans'][0]
        resumed = run(extended,supplied)
        self.assertGreater(self.counts(resumed)['Corn Oil'],0)

        # Resuming Power Monitor alone cannot invent external inputs or Pocket Watch.
        enabled = [*goals,self.goal('Engine')]
        inventory = {self.ids[name]:1000 for name in ['Small Screw','Small Spring','Small Gear']}
        supplied = compute(self.catalog,dict(payload,secondary=[],inventory=inventory))['plans'][0]
        self.assertEqual(self.counts(run(enabled,supplied))['Engine'],0)
        inventory[self.ids['Pocket Watch']] = 1000
        supplied = compute(self.catalog,dict(payload,secondary=[],inventory=inventory))['plans'][0]
        self.assertGreater(self.counts(run(enabled,supplied))['Engine'],0)

    def test_map_external_supplies_default_auto_and_manual_amounts_override(self):
        payload = dict(self.payload, targets={self.ids['Langstaff Crest']:163},
                       areas=['explore:13','explore:8','explore:9','explore:7','explore:1','explore:3','explore:10'])
        routes=[('Coal','explore:8',511980),('Emberstone','explore:9',3089731),
                ('Mushroom','explore:7',590652),('Bone','explore:1',110791),
                ('Purple Flower','explore:3',9941462),('Blue Gel','explore:10',3231339)]
        payload.update(map_sources={self.ids[r]:[a] for r,a,_ in routes},
            map_source_explores={self.ids[r]:{a:q} for r,a,q in routes},
            secondary=[self.goal(n) for n in ['Machine Press','Corn Oil','Engine']])
        def run(inventory):
            result=compute(self.catalog,dict(payload,inventory=inventory))['plans'][0]
            self.conserve(result)
            self.assertEqual(result['secondary']['additional_explores'],sum(q for _,_,q in routes))
            return result
        watch={self.ids['Pocket Watch']:1000}
        auto=run(watch)
        self.assertGreater(self.counts(auto)['Corn Oil'],0)
        self.assertGreater(self.counts(auto)['Engine'],0)
        for name in ['Corn','Small Screw','Small Spring','Small Gear']:
            b=next(b for b in auto['item_balances'] if b['name']==name)
            self.assertEqual(b['starting_inventory'],b['auto_starting_inventory'])
            self.assertGreater(b['auto_starting_inventory'],0)
            self.assertLess(b['expected_final_inventory'],1)
            self.assertNotIn(b['item_id'],{r['item_id'] for r in auto['map_potential']['missing']})
        no_watch=run({})
        self.assertEqual(self.counts(no_watch)['Engine'],0,'explorable ingredients must not be auto-provided')
        stopped=run(dict(watch,**{self.ids['Small Gear']:0,self.ids['Corn']:0}))
        self.assertEqual(self.counts(stopped)['Engine'],0)
        self.assertEqual(self.counts(stopped)['Corn Oil'],0)
        limited=run(dict(watch,**{self.ids['Corn']:80}))
        corn=next(b for b in limited['item_balances'] if b['name']=='Corn')
        self.assertEqual(corn['starting_inventory'],80)
        self.assertEqual(corn.get('auto_starting_inventory',0),0)
        self.assertLessEqual(corn['consumed_by_crafting'],80)
        self.assertGreater(self.counts(limited)['Corn Oil'],0)
        preview=guided_compute(self.catalog,dict(payload,inventory=watch,replacement_goals=payload['secondary']))['preview_plan']
        self.assertEqual(self.counts(preview),self.counts(auto))

    def test_more_than_twenty_explicit_recipes_compute(self):
        names=[item['name'] for item in self.catalog['items'].values() if item['craftable']][:32]
        stock={ref:10000000 for ref,item in self.catalog['items'].items() if not item['craftable']}
        goals=[dict(self.goal(name),cap=10,user_cap=True) for name in names]
        result=compute(self.catalog,dict(self.payload,inventory=stock,secondary=goals,map_source_explores={}))['plans'][0]
        self.assertEqual(len(result['secondary']['targets']),32)
        self.assertGreater(sum(t['crafts']>0 for t in result['secondary']['targets']),20)
        self.conserve(result)

    def copper_payload(self):
        routes=[('Coal','explore:8',511980),('Emberstone','explore:9',3089731),
                ('Mushroom','explore:7',590652),('Bone','explore:1',110791),
                ('Purple Flower','explore:3',9941462),('Blue Gel','explore:10',3231339)]
        return dict(self.payload, targets={self.ids['Langstaff Crest']:163},
            areas=['explore:13',*[a for _,a,_ in routes]],
            map_sources={self.ids[r]:[a] for r,a,_ in routes},
            map_source_explores={self.ids[r]:{a:q} for r,a,q in routes},
            inventory={self.ids[r]:q for r,q in [('Corn',758223),('Pocket Watch',9759),
                       ('Small Gear',9759),('Small Screw',87828),('Small Spring',29276)]},
            secondary=[self.goal(n) for n in ['Spool of Copper','Energy Coil','Spiky Bracelet',
                       'Machine Press','Belt Drive','Pear Grease','Hourglass','Corn Oil','Engine']])

    def test_force_wire_preserves_choices_and_uses_the_actual_shared_pool(self):
        payload=self.copper_payload(); original=copy.deepcopy(payload)
        before=compute(self.catalog,payload)['plans'][0]
        wire=self.ids['Copper Wire']
        forced=dict(payload,map_node_usage={wire:{'mode':'force'}})
        after=compute(self.catalog,forced)['plans'][0]
        def balance(plan, name):
            return next(b for b in plan['item_balances'] if b['name']==name)
        self.assertGreaterEqual(balance(after,'Copper Wire')['used_by_leftover_craft'],
                                balance(before,'Copper Wire')['used_by_leftover_craft'])
        self.assertLess(balance(after,'Copper Wire')['expected_unused'],7000)
        self.assertGreater(self.counts(after)['Spool of Copper'],18000)
        self.assertEqual(after['optimal_total_explores'],before['optimal_total_explores'])
        self.assertEqual(payload,original)
        self.assertTrue(all(g['cap'] is None for g in after['secondary']['targets']))
        # Power Monitor is only an implicit Engine input. Do not credit fake
        # surplus production that disappears when LP quantities are rounded.
        self.assertLess(balance(after,'Power Monitor')['expected_unused'],1)
        self.assertLess(balance(after,'Coal')['expected_unused'],5)
        self.conserve(after)
        preview=guided_compute(self.catalog,dict(forced,previous_map_node_usage={},
                            replacement_goals=payload['secondary']))
        self.assertEqual(self.counts(preview['preview_plan']),self.counts(after))
        reduced={r['item_id']:r['before'] for r in preview['reduced']}
        self.assertEqual(reduced[self.ids['Corn Oil']],self.counts(before)['Corn Oil'])
        restored=compute(self.catalog,json.loads(json.dumps(forced)))['plans'][0]
        self.assertEqual(self.counts(restored),self.counts(after))
        resumed=compute(self.catalog,dict(payload,map_node_usage={wire:{'mode':'use'}}))['plans'][0]
        self.assertEqual(self.counts(resumed),self.counts(before))

    def test_material_limit_is_aggregate_and_counts_every_consumption_edge_once(self):
        payload=self.copper_payload();wire=self.ids['Copper Wire'];coal=self.ids['Coal']
        for limit in [0,5000,100000]:
            with self.subTest(limit=limit):
                result=compute(self.catalog,dict(payload,map_node_usage={wire:{'mode':'limit','amount':limit}}))['plans'][0]
                b=next(b for b in result['item_balances'] if b['item_id']==wire)
                self.assertLessEqual(b['used_by_leftover_craft'],limit+1e-6)
                self.assertGreater(b['used_by_leftover_craft'],max(-1,limit-15))
                self.conserve(result)
        # Forcing one material never bypasses another material's explicit limit.
        result=compute(self.catalog,dict(payload,map_node_usage={wire:{'mode':'force'},coal:{'mode':'limit','amount':10000}}))['plans'][0]
        self.assertLessEqual(next(b['used_by_leftover_craft'] for b in result['item_balances'] if b['item_id']==coal),10000+1e-6)
        self.conserve(result)

    def test_multiple_forced_inputs_share_progress_and_respect_fixed_crafts(self):
        payload=self.copper_payload();payload['secondary'][-1].update(cap=200,consumer_mode='fixed')
        rules={self.ids[name]:{'mode':'force'} for name in ['Copper Wire','Carbon Sphere']}
        a=compute(self.catalog,dict(payload,map_node_usage=rules))['plans'][0]
        b=compute(self.catalog,dict(payload,map_node_usage=dict(reversed(list(rules.items())))))['plans'][0]
        self.assertEqual(self.counts(a),self.counts(b))
        self.assertGreaterEqual(self.counts(a)['Engine'],199)
        self.assertLessEqual(self.counts(a)['Engine'],200)
        self.assertGreater(self.counts(a)['Corn Oil'],0)
        self.conserve(a)

    def test_all_six_diary_orders_have_the_same_balanced_result(self):
        expected = None
        for permutation in itertools.permutations(self.diaries):
            result = self.run_map(self.goals(permutation))
            counts = self.counts(result)
            if expected is None: expected = counts
            self.assertEqual(counts, expected)
            values = [counts[name] for name in self.diaries]
            self.assertGreater(min(values), 80000)
            self.assertLess(max(values) - min(values), 100)
            self.assertTrue(all(t['cap'] is None for t in result['secondary']['targets']))
            self.conserve(result)

    def test_source_before_or_after_recipes_and_removal(self):
        initial = self.run_map([self.goal(name) for name in self.parchments])
        self.assertEqual(initial['optimal_total_explores'], self.primary['optimal_total_explores'])
        absent = self.run_map(sources={})
        self.assertTrue(all(self.counts(absent)[name] == 0 for name in self.diaries))
        potential = {row['item_id']: row['quantity'] for row in absent['map_potential']['missing']}
        self.assertGreater(potential[self.ids['Mushroom']], 300000)
        self.assertGreater(potential[self.ids['Hide']], 80000)
        self.assertNotIn(self.ids['Feathers'], potential)
        after = self.run_map()
        areas = {a['location_id']: a for a in after['areas']}
        self.assertEqual(areas['explore:3']['explores'], self.primary['optimal_total_explores'])
        outputs = {row['item_id']: row['expected_drops'] for row in areas['explore:7']['items']}
        self.assertGreater(outputs[self.ids['Hide']], 0)
        self.assertGreater(outputs[self.ids['Mushroom']], 0)
        self.assertEqual(after['map_potential']['missing'], [])
        # Sources are saved intent, not incidental leftover.allow_exploration flags.
        self.assertEqual(self.counts(self.run_map(sources={})), self.counts(absent))
        self.conserve(after)

    def test_bow_added_last_reclaims_optional_parchment_without_more_exploration(self):
        before = self.run_map()
        after = self.run_map([*self.goals(), self.goal('Wooden Bow')])
        self.assertEqual(before['optimal_total_explores'], after['optimal_total_explores'])
        a, b = self.counts(before), self.counts(after)
        self.assertGreater(b['Wooden Bow'], 150000)
        self.assertLess(b['Green Parchment'], a['Green Parchment'])
        for name in self.diaries: self.assertLessEqual(abs(a[name] - b[name]), 2)
        self.conserve(after)

    def test_apply_reload_and_guided_replacement_are_equivalent(self):
        goals = [*self.goals(), self.goal('Wooden Bow')]
        payload = dict(self.payload, secondary=goals, automatic_areas=['explore:3', 'explore:7'])
        fresh = compute(self.catalog, payload)['plans'][0]
        saved = json.loads(json.dumps(payload))
        restored = compute(self.catalog, saved)['plans'][0]
        preview = guided_compute(self.catalog, dict(payload, secondary=self.goals(), replacement_goals=goals))['preview_plan']
        self.assertEqual(self.counts(fresh), self.counts(restored))
        self.assertEqual(self.counts(fresh), self.counts(preview))
        self.assertEqual(fresh['optimal_total_explores'], preview['optimal_total_explores'])
        self.assertEqual(payload, saved)

    def test_guided_extra_explores_compares_previous_sources(self):
        preview = guided_compute(self.catalog, dict(self.payload, secondary=self.goals(),
            replacement_goals=self.goals(), previous_map_sources={}))
        self.assertGreater(preview['extra_explores'], 7000000)
        self.assertEqual(preview['new_locations'], ['explore:7'])

    def test_forced_quantity_precedes_soft_consumers(self):
        goals = self.goals()
        goals[3].update(consumer_mode='fixed', cap=150000)
        result = self.run_map(goals)
        counts = self.counts(result)
        self.assertGreaterEqual(counts['Leather Diary'], 149998)
        self.assertGreater(counts['Green Diary'], 40000)
        self.assertGreater(counts['Purple Diary'], 40000)
        self.assertLess(abs(counts['Green Diary'] - counts['Purple Diary']), 100)
        self.conserve(result)
        reverse = self.run_map(goals[::-1])
        self.assertEqual(self.counts(reverse), counts)

    def test_optional_limit_is_upper_bound_and_zero_is_explicit_pause(self):
        goals = self.goals()
        goals[3].update(cap=5000, user_cap=True)
        result = self.run_map(goals)
        counts = self.counts(result)
        self.assertLessEqual(counts['Leather Diary'], 5000)
        self.assertGreater(counts['Leather Diary'], 4995)
        self.assertGreater(counts['Green Diary'], 100000)
        goals[3]['cap'] = 0
        paused = self.run_map(goals)
        self.assertEqual(self.counts(paused)['Leather Diary'], 0)
        self.assertGreater(self.counts(paused)['Green Diary'], 100000)
        self.assertTrue(next(t for t in result['secondary']['targets'] if t['name'] == 'Leather Diary')['user_cap'])

    def test_missing_unavailable_recipe_does_not_zero_other_soft_goals(self):
        goals = [*self.goals(), self.goal('Chum',user_cap=True)]
        goals[-1]['cap'] = 0  # Explicitly paused, rather than absent farm supplies.
        result = self.run_map(goals)
        self.assertEqual(self.counts(result)['Chum'], 0)
        self.assertTrue(all(self.counts(result)[name] > 80000 for name in self.diaries))
        self.conserve(result)

    def test_percentage_is_applied_to_current_primary_aim_not_old_saved_basis(self):
        goals = self.goals()
        for g in goals[3:]: g.update(demand_group=self.ids['Mushroom'], demand_basis=1, demand_percent=10)
        result = self.run_map(goals)
        counts = self.counts(result)
        self.assertTrue(all(20000 < counts[name] < 30000 for name in self.diaries))
        self.assertLess(result['optimal_total_explores'], self.run_map()['optimal_total_explores'])
        self.conserve(result)


if __name__ == '__main__': unittest.main()
