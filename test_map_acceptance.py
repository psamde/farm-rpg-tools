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
        goals = [*self.goals(), self.goal('Chum')]
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
