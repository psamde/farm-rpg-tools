import itertools
from pathlib import Path
import unittest

from farmdata import read_json
from planner import plan, ranked_plans, text_report


def small_catalog():
    # One craft uses one A and one B. Joint area gets 0.5 of each per explore;
    # specialist areas get 0.6 of one. Joint collection should win.
    items = {i: {'id': i, 'name': name, 'craftable': False, 'direct_ingredients': {}, 'output_quantity': 1}
             for i, name in [('1', 'A'), ('2', 'B'), ('3', 'Target'), ('4', 'Extra')]}
    items['3'].update(craftable=True, direct_ingredients={'1': 1, '2': 1})
    locations = {i: {'name': i, 'kind': 'explore'} for i in ['joint', 'a', 'b']}
    sources = {}
    for loc, drops in [('joint', {'1': .5, '2': .5, '4': .01}), ('a', {'1': .6}), ('b', {'2': .6})]:
        for ref, rate in drops.items():
            sources[loc + ref] = {'kind': 'explore', 'location_id': loc, 'item_id': ref,
                'expected_drops_per_explore': rate,
                'conditions': {'ironDepot': False, 'runecube': False, 'frozen': None, 'manualFishing': None}}
    return {'items': items, 'locations': locations, 'sources': sources}


class PlannerTests(unittest.TestCase):
    def test_resource_saver_is_bonus_output_not_discount(self):
        result = plan(small_catalog(), 'Target', 145, areas=['joint'], resource_saver=45)
        self.assertEqual(result['optimal_total_explores'], 200)
        self.assertAlmostEqual(result['crafts_in_dependency_order'][0]['expected_paid_crafts'], 100)
        self.assertEqual({r['name']: round(r['quantity']) for r in result['raw_materials_needed']}, {'A': 100, 'B': 100})
        for row in result['item_balances']:
            self.assertAlmostEqual(row['starting_inventory'] + row['expected_exploration_drops'] + row['crafted'], row['consumed_by_crafting'] + row['expected_final_inventory'])

    def test_saver_recurses_through_intermediate_and_ranked_options(self):
        cat = small_catalog()
        cat['items']['1'].update(craftable=True, direct_ingredients={'4': 1})
        cat['sources'] = {k:v for k,v in cat['sources'].items() if v['item_id'] != '1'}
        cat['sources']['joint4']['expected_drops_per_explore'] = .5
        result = ranked_plans(cat, 'Target', 145, areas=['joint'], resource_saver=45)
        raw = {r['name']: r['quantity'] for r in result['raw_materials_needed']}
        self.assertAlmostEqual(raw['Extra'], 100/1.45)
        self.assertAlmostEqual(raw['B'], 100)
        self.assertEqual(result['plans'][0]['optimal_total_explores'], 200)
        self.assertEqual(result['assumptions']['resource_saver'], 45)

    def test_invalid_saver(self):
        for value in [-1, 46, float('nan'), True, '45']:
            with self.assertRaises(ValueError):
                plan(small_catalog(), 'Target', resource_saver=value)

    def test_multi_target_shared_drops(self):
        catalog = small_catalog()
        catalog['items']['5'] = {'id': '5', 'name': 'Second', 'craftable': True,
                                  'direct_ingredients': {'4': .01}, 'output_quantity': 1}
        result = plan(catalog, {'Target': 1, 'Second': 1})
        self.assertEqual(result['optimal_total_explores'], 2)
        counts = {r['name']: r['crafts'] for r in result['crafts_in_dependency_order']}
        self.assertEqual(counts, {'Target': 1, 'Second': 1})
        self.assertEqual(len(result['targets']), 2)

    def test_intermediate_mastery_is_shared_not_double_charged(self):
        catalog = small_catalog()
        catalog['items']['1'].update(craftable=True, direct_ingredients={'4': 1})
        catalog['sources']['joint4']['expected_drops_per_explore'] = .5
        result = plan(catalog, {'A': 1, 'Target': 1}, areas=['joint'])
        self.assertEqual(result['optimal_total_explores'], 2)
        counts = {r['name']: r['crafts'] for r in result['crafts_in_dependency_order']}
        self.assertEqual(counts['A'], 1)
        self.assertEqual({r['name']: r['quantity'] for r in result['raw_materials_needed']}, {'B': 1, 'Extra': 1})
        balances = {r['name']: r for r in result['item_balances']}
        self.assertEqual(balances['A']['reserved_target_output'], 0)

    def test_multiple_targets_recompute_without_mutating_stock(self):
        stock = {'A': .5}
        catalog = small_catalog()
        catalog['items']['5'] = {'id': '5', 'name': 'Second', 'craftable': True,
                                  'direct_ingredients': {'1': 1}, 'output_quantity': 1}
        result = plan(catalog, {'Target': 2, 'Second': 2}, inventory=stock)
        self.assertEqual(stock, {'A': .5})
        for r in result['item_balances']:
            self.assertAlmostEqual(r['starting_inventory'] + r['expected_exploration_drops'] + r['crafted'] + r['free_perk_supply'],
                                   r['consumed_by_crafting'] + r['reserved_target_output'] + r['expected_unused'])

    def test_exact_combinations_keeps_slower_pairs(self):
        result = ranked_plans(small_catalog(), {'Target': 1}, max_areas=2, combinations_mode=True)
        keys = {tuple(sorted(a['location_id'] for a in p['areas'])) for p in result['plans']}
        self.assertIn(('a', 'joint'), keys)
        self.assertIn(('b', 'joint'), keys)
        self.assertIn(('a', 'b'), keys)
        self.assertTrue(all(a['explores'] >= 1 for p in result['plans'] for a in p['areas']))

    def test_explicit_empty_areas_are_rejected(self):
        with self.assertRaisesRegex(ValueError, 'No exploration'):
            plan(small_catalog(), 'Target', areas=[])

    def test_joint_drops_global_optimum_and_all_leftovers(self):
        result = plan(small_catalog(), 'Target')
        self.assertEqual(result['optimal_total_explores'], 2)
        self.assertEqual(result['areas'][0]['name'], 'joint')
        self.assertEqual(result['unused_items'][0]['name'], 'Extra')
        self.assertAlmostEqual(result['unused_items'][0]['expected_unused'], .02)
        self.assertNotIn('voided_items', result)

    def test_integer_optimum_against_exhaustive_enumeration(self):
        catalog = small_catalog()
        for quantity in [1, 2, 3]:
            optimum = min(a + b + joint for a, b, joint in itertools.product(range(11), repeat=3)
                          if .6 * a + .5 * joint >= quantity and .6 * b + .5 * joint >= quantity)
            self.assertEqual(plan(catalog, 'Target', quantity)['optimal_total_explores'], optimum)

    def test_intermediate_drop_avoids_raw_crafting(self):
        catalog = small_catalog()
        catalog['items']['1'].update(craftable=True, direct_ingredients={'4': 100})
        result = plan(catalog, 'Target')
        self.assertEqual(result['optimal_total_explores'], 2)
        self.assertEqual([c['name'] for c in result['crafts_in_dependency_order']], ['Target'])

    def test_target_drop_does_not_count_as_mastery_craft(self):
        catalog = small_catalog()
        catalog['sources']['target'] = {**catalog['sources']['joint1'], 'item_id': '3', 'expected_drops_per_explore': 100}
        result = plan(catalog, 'Target')
        self.assertEqual(result['optimal_total_explores'], 2)
        self.assertEqual(result['crafts_in_dependency_order'][0]['crafts'], 1)
        target = next(r for r in result['item_balances'] if r['item_id'] == '3')
        self.assertEqual(target['expected_unused'], 200)

    def test_inventory_can_eliminate_exploration(self):
        result = plan(small_catalog(), 'Target', inventory={'A': 1, 'B': 1})
        self.assertEqual(result['optimal_total_explores'], 0)
        self.assertEqual(result['areas'], [])
        self.assertEqual(result['unused_items'], [])

    def test_area_restrictions_and_infeasible(self):
        self.assertEqual(plan(small_catalog(), 'Target', exclude_areas=['joint'])['optimal_total_explores'], 4)
        with self.assertRaisesRegex(ValueError, 'cannot be crafted'):
            plan(small_catalog(), 'Target', areas=['a'])

    def test_bad_inputs(self):
        for quantity in [0, -1, 1.5, True]:
            with self.assertRaises(ValueError):
                plan(small_catalog(), 'Target', quantity)
        with self.assertRaises(ValueError):
            plan(small_catalog(), 'Target', inventory={'A': -1})
        with self.assertRaises(ValueError):
            plan(small_catalog(), 'Target', areas=['nonexistent'])

    def test_continuous_lower_bound(self):
        result = plan(small_catalog(), 'Target', exclude_areas=['joint'], continuous=True)
        self.assertAlmostEqual(result['optimal_total_explores'], 10 / 3)

    def test_matching_conditions_and_duplicate_rejection(self):
        catalog = small_catalog()
        for key, source in list(catalog['sources'].items()):
            catalog['sources']['perk' + key] = {**source, 'expected_drops_per_explore': source['expected_drops_per_explore'] * 2,
                                              'conditions': {**source['conditions'], 'runecube': True}}
        self.assertEqual(plan(catalog, 'Target')['optimal_total_explores'], 2)
        self.assertEqual(plan(catalog, 'Target', runecube=True)['optimal_total_explores'], 1)
        catalog['sources']['duplicate'] = catalog['sources']['joint1']
        with self.assertRaisesRegex(ValueError, 'Ambiguous'):
            plan(catalog, 'Target')

    def test_live_catalog_balances_and_minimum(self):
        path = Path(__file__).parent / 'data/catalog.json'
        if not path.exists():
            self.skipTest('No catalog')
        catalog = read_json(path)
        for excludes, expected in [([], 181), (["Santa's Workshop"], 220)]:
            result = plan(catalog, 'Sturdy Shield', exclude_areas=excludes)
            self.assertEqual(result['optimal_total_explores'], expected)
            self.assertEqual(sum(a['explores'] for a in result['areas']), expected)
            for row in result['item_balances']:
                self.assertAlmostEqual(row['starting_inventory'] + row['expected_exploration_drops'] + row['crafted'],
                                       row['consumed_by_crafting'] + row['reserved_target_output'] + row['expected_unused'])
            # Independently total every drop in the selected baseline area tables.
            chosen = {a['location_id']: a['explores'] for a in result['areas']}
            drops = {}
            for source in catalog['sources'].values():
                if source['kind'] == 'explore' and source['location_id'] in chosen and not any(source['conditions'].values()):
                    i = source['item_id']
                    drops[i] = drops.get(i, 0) + chosen[source['location_id']] * source['expected_drops_per_explore']
            actual = {r['item_id']: r['expected_exploration_drops'] for r in result['item_balances'] if r['expected_exploration_drops'] > 0}
            self.assertEqual(set(drops), set(actual))
            for i in drops:
                self.assertAlmostEqual(drops[i], actual[i])

    def test_ranked_sets_are_unique_and_match_brute_force(self):
        catalog = small_catalog()
        result = ranked_plans(catalog, 'Target')
        # Any subset containing joint is cheapest using joint alone. Without
        # joint, both specialist areas are necessary. No one-explore padding.
        expected = {('joint',): 2, ('a', 'b'): 4}
        actual = {tuple(sorted(a['location_id'] for a in p['areas'])): p['optimal_total_explores'] for p in result['plans']}
        self.assertEqual(actual, expected)
        for p in result['plans']:
            allowed = {a['location_id'] for a in p['areas']}
            brute = min(a+b+j for a,b,j in itertools.product(range(7), repeat=3)
                        if .6*a+.5*j >= 1 and .6*b+.5*j >= 1
                        and (a == 0 or 'a' in allowed) and (b == 0 or 'b' in allowed)
                        and (j == 0 or 'joint' in allowed))
            self.assertEqual(p['optimal_total_explores'], brute)
        self.assertEqual(len(actual), len(result['plans']))
        self.assertEqual([p['optimal_total_explores'] for p in result['plans']], sorted(actual.values()))
        reversed_input = ranked_plans(catalog, 'Target', areas=['joint', 'b', 'a'])
        self.assertEqual([p['area_set_id'] for p in result['plans']], [p['area_set_id'] for p in reversed_input['plans']])

    def test_ranked_max_areas(self):
        result = ranked_plans(small_catalog(), 'Target', max_areas=1)
        self.assertEqual(len(result['plans']), 1)
        self.assertEqual(result['plans'][0]['areas'][0]['location_id'], 'joint')

    def test_iron_depot_is_unlimited_and_free(self):
        path = Path(__file__).parent / 'data/catalog.json'
        if not path.exists():
            self.skipTest('No catalog')
        result = plan(read_json(path), 'Sturdy Shield', 1000, areas=['Forest'], iron_depot=True)
        balances = {r['name']: r for r in result['item_balances']}
        self.assertEqual(balances['Iron']['free_perk_supply'], 6000)
        self.assertEqual(balances['Nails']['free_perk_supply'], 10000)
        self.assertEqual(balances['Iron']['expected_unused'], 0)
        for row in result['item_balances']:
            self.assertAlmostEqual(row['starting_inventory'] + row['expected_exploration_drops'] + row['crafted'] + row['free_perk_supply'],
                                   row['consumed_by_crafting'] + row['reserved_target_output'] + row['expected_unused'])
        with self.assertRaisesRegex(ValueError, 'cannot be crafted'):
            plan(read_json(path), 'Sturdy Shield', areas=['Forest'])

    def test_area_usage_conserves_shared_materials_with_inventory(self):
        catalog = small_catalog()
        catalog['sources']['a2'] = {**catalog['sources']['a1'], 'item_id': '2', 'expected_drops_per_explore': .1}
        result = plan(catalog, 'Target', quantity=3, areas=['a', 'b'], inventory={'A': .25})
        by_item = {r['item_id']: r for r in result['item_balances']}
        for ref, balance in by_item.items():
            rows = [r for a in result['areas'] for r in a['items'] if r['item_id'] == ref]
            self.assertAlmostEqual(sum(r['expected_drops'] for r in rows), balance['expected_exploration_drops'])
            for row in rows:
                self.assertAlmostEqual(row['used'] + row['unused'], row['expected_drops'])
            expected_used = min(balance['expected_exploration_drops'], max(0, balance['consumed_by_crafting'] - balance['starting_inventory'] - balance['crafted']))
            self.assertAlmostEqual(sum(r['used'] for r in rows), expected_used)
        self.assertEqual({r['name']: r['quantity'] for r in result['raw_materials_needed']}, {'A': 3, 'B': 3})
        report = text_report(result)
        self.assertLess(report.index('RAW MATERIALS NEEDED'), report.index('PATH 1'))
        self.assertIn('    USED:', report)
        self.assertIn('    UNUSED:', report)


if __name__ == '__main__':
    unittest.main()
