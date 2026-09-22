"""Marginal savings must use joint routes, not add standalone item costs."""
import unittest
from copy import deepcopy
from unittest.mock import patch

import browser_engine
from browser_engine import compute, guided_compute, target_inventory_savings, credit_external_targets
from test_planner import small_catalog


class TargetInventoryTests(unittest.TestCase):
    def setUp(self):
        browser_engine._SAVINGS_CACHE.clear()

    def savings(self, targets, **settings):
        catalog = small_catalog()
        payload = dict(targets=targets, areas=['joint'], inventory={}, **settings)
        result, jobs = {}, []
        target_inventory_savings(catalog, payload, result, jobs)
        self.assertFalse(result['inventory_savings']['complete'])
        for job in jobs:
            job()
        return result['inventory_savings']

    def test_shared_drops_zero_marginal_savings(self):
        result = self.savings({'1': 10, '2': 10})
        self.assertEqual(result['baseline_explores'], 20)
        self.assertEqual(result['items']['1']['explores_saved'], 0)
        self.assertEqual(result['items']['2']['explores_saved'], 0)

    def test_craft_and_collection_share_the_route(self):
        result = self.savings({'3': 10, '4': 1})
        self.assertEqual(result['baseline_explores'], 100)
        self.assertEqual(result['items']['3']['explores_saved'], 0)
        self.assertEqual(result['items']['4']['explores_saved'], 80)

    def test_last_target_and_resource_saver(self):
        result = self.savings({'3': 145}, resource_saver=45)
        self.assertEqual(result['items']['3']['explores_saved'], 200)
        self.assertEqual(result['items']['3']['explores_after'], 0)

    def test_reserved_stock_cannot_pay_for_two_goals(self):
        catalog = small_catalog()
        payload = dict(targets={'1': 10, '3': 10}, areas=['joint'], inventory={'1': 10})
        before = deepcopy(payload)
        result = {}
        target_inventory_savings(catalog, payload, result)
        self.assertEqual(result['inventory_savings']['items']['1']['explores_after'], 20)
        self.assertEqual(payload, before)

    def test_cached_comparisons_do_not_resolve(self):
        catalog = small_catalog()
        payload = dict(targets={'3': 10}, areas=['joint'], inventory={})
        result = {}
        target_inventory_savings(catalog, payload, result)
        with patch.object(browser_engine, 'plan', side_effect=AssertionError('Cache missed')):
            again = {}
            target_inventory_savings(catalog, payload, again)
        self.assertEqual(result, again)

    def test_all_targets_provided_gives_zero_route(self):
        catalog = small_catalog()
        # passive_plans expects canonical location IDs in the catalog.
        for ref, location in catalog['locations'].items():
            location['id'] = ref
        result = compute(catalog, dict(targets={}, provided_targets={'3': {'quantity': 10, 'taken': 0}}, areas=['joint'], inventory={}))
        self.assertEqual(result['plans'][0]['optimal_total_explores'], 0)
        self.assertEqual(result['plans'][0]['targets'], [])

    def test_failed_optional_comparison_does_not_fail_route(self):
        result = self.savings({'3': 10}, resource_saver=0)
        self.assertTrue(result['complete'])
        catalog = small_catalog()
        result = {}
        target_inventory_savings(catalog, dict(targets={'3': 10}, areas=['a']), result)
        self.assertTrue(result['inventory_savings']['unavailable'])

    def test_route_surplus_reduces_external_supply_without_changing_explores(self):
        catalog = small_catalog()
        payload = dict(targets={'2': 20000}, provided_targets={'1': {'quantity': 60000, 'taken': 0}}, areas=['joint'])
        first = compute(catalog, payload)['plans'][0]
        self.assertEqual(first['optimal_total_explores'], 40000)
        self.assertEqual(first['external_target_supplies']['1'], dict(allocation=60000, from_route=20000, external_quantity=40000))
        a = next(b for b in first['item_balances'] if b['item_id'] == '1')
        self.assertEqual(a['expected_unused'], 0)
        self.assertEqual(a['reserved_target_output'], 20000)
        self.assertNotIn('1', [b['item_id'] for b in first['unused_items']])
        # Recomputing or reloading must not feed the displayed 40k back as a
        # smaller allocation, nor contaminate the cached primary balances.
        again = compute(catalog, payload)['plans'][0]
        self.assertEqual(again['external_target_supplies'], first['external_target_supplies'])
        self.assertEqual(again['optimal_total_explores'], first['optimal_total_explores'])
        credit_external_targets(again, payload['provided_targets'])
        self.assertEqual(again['item_balances'], first['item_balances'])
        capped = compute(catalog, dict(payload, provided_targets={'1': {'quantity': 10000, 'taken': 0}}))['plans'][0]
        self.assertEqual(capped['external_target_supplies']['1']['external_quantity'], 0)
        self.assertEqual(next(b for b in capped['item_balances'] if b['item_id'] == '1')['expected_unused'], 10000)

    def test_only_credit_output_left_after_crafting_and_match_map_preview(self):
        catalog = small_catalog()
        goals = [dict(item_id='3', cap=5000, allow_exploration=False)]
        payload = dict(targets={'4': 400}, areas=['joint'], secondary=goals,
                       provided_targets={'1': {'quantity': 60000, 'taken': 0}})
        p = compute(catalog, payload)['plans'][0]
        self.assertEqual(p['optimal_total_explores'], 40000)
        crafted = p['secondary']['targets'][0]['crafts']
        self.assertGreaterEqual(crafted, 4999)  # Existing solver's whole-craft tolerance.
        self.assertEqual(p['external_target_supplies']['1']['from_route'], 20000-crafted)
        self.assertEqual(p['external_target_supplies']['1']['external_quantity'], 40000+crafted)
        preview = guided_compute(catalog, dict(payload, replacement_goals=goals))['preview_plan']
        self.assertEqual(preview['external_target_supplies'], p['external_target_supplies'])
        self.assertEqual(preview['secondary']['targets'][0]['crafts'], crafted)

    def test_external_stock_is_not_counted_as_route_output_and_credit_rounds_down(self):
        p = dict(item_balances=[dict(item_id='1', starting_inventory=100, expected_exploration_drops=20.9,
             crafted=0, reserved_target_output=0, expected_unused=120.9, expected_final_inventory=120.9)])
        credit_external_targets(p, {'1': dict(quantity=60, taken=0)})
        self.assertEqual(p['external_target_supplies']['1']['external_quantity'], 40)
        self.assertAlmostEqual(p['item_balances'][0]['expected_unused'], 100.9)
        credit_external_targets(p, {})
        self.assertAlmostEqual(p['item_balances'][0]['expected_unused'], 120.9)


if __name__ == '__main__':
    unittest.main()
