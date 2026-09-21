"""Missing exploration ingredients can be supplied without changing areas."""
import unittest
from unittest.mock import patch

import planner
from planner import plan, ranked_plans, InfeasiblePlan, calculation_error
from test_planner import small_catalog
from webapp import Application


class InventoryRecoveryTests(unittest.TestCase):
    def recover(self, catalog, targets, **kwargs):
        before = dict(kwargs.get('inventory', {}))
        with self.assertRaises(InfeasiblePlan) as caught:
            plan(catalog, targets, **kwargs)
        rows = caught.exception.inventory_shortfalls
        self.assertTrue(rows)
        self.assertEqual(calculation_error(caught.exception)['inventory_shortfalls'], rows)
        self.assertEqual(kwargs.get('inventory', {}), before)
        stock = dict(before)
        for row in rows:
            stock[row['item_id']] = stock.get(row['item_id'], 0) + row['quantity']
        recovered = plan(catalog, targets, **dict(kwargs, inventory=stock))
        self.assertTrue(all(a['location_id'] in kwargs['areas'] for a in recovered['areas']))
        return {row['item_id']: row['quantity'] for row in rows}, recovered

    def test_partial_stock_and_resource_saver_round_up(self):
        rows, result = self.recover(small_catalog(), {'3': 145}, areas=['a'],
                                    inventory={'2': 7.2}, resource_saver=45)
        self.assertEqual(rows, {'2': 93})
        self.assertEqual(result['crafts_in_dependency_order'][0]['crafts'], 145)

    def test_collection_and_crafting_demands_share_inventory(self):
        rows, _ = self.recover(small_catalog(), {'3': 10, '2': 7, '4': 2},
                               areas=['a'], inventory={'2': 3})
        self.assertEqual(rows, {'2': 14, '4': 2})

    def test_dropped_intermediate_does_not_request_its_raw_material(self):
        cat = small_catalog()
        cat['items']['1'].update(craftable=True, direct_ingredients={'4': 100})
        rows, _ = self.recover(cat, {'3': 10}, areas=['a'])
        self.assertEqual(rows, {'2': 10})

    def test_stocked_intermediate_reduces_missing_raw_material(self):
        cat = small_catalog()
        cat['items']['1'].update(craftable=True, direct_ingredients={'4': 2})
        rows, _ = self.recover(cat, {'3': 10}, areas=['b'],
                               inventory={'1': 2, '4': 1}, resource_saver=25)
        self.assertEqual(rows, {'4': 9})

    def test_subset_search_does_not_compute_inventory_recovery(self):
        with patch.object(planner, 'plan', wraps=plan) as call:
            ranked_plans(small_catalog(), {'3': 10})
        self.assertNotIn('suggest_inventory', call.call_args_list[0].kwargs)
        self.assertGreater(len(call.call_args_list), 1)
        self.assertTrue(all(c.kwargs['suggest_inventory'] is False for c in call.call_args_list[1:]))

    def test_native_api_keeps_actionable_error(self):
        app = Application(small_catalog())
        try:
            with patch.object(app.pool, 'submit') as dispatch:
                response = app.submit(dict(targets={'3': 10}, areas=['a'], inventory={'2': 3}))
            function, *args = dispatch.call_args.args
            function(*args)
            job = app.jobs[response['job_id']]
            self.assertEqual(job['status'], 'error')
            self.assertEqual(job['inventory_shortfalls'], [dict(item_id='2', name='B', quantity=7, starting_inventory=3)])
        finally:
            app.pool.shutdown()


if __name__ == '__main__':
    unittest.main()
