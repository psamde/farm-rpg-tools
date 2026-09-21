"""Marginal savings must use joint routes, not add standalone item costs."""
import unittest
from copy import deepcopy
from unittest.mock import patch

import browser_engine
from browser_engine import compute, target_inventory_savings
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


if __name__ == '__main__':
    unittest.main()
