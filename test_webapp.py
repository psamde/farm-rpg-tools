from pathlib import Path
import unittest
from farmdata import read_json
from webapp import Application


class WebAppTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = Application(read_json(Path(__file__).parent / 'data/catalog.json'))

    @classmethod
    def tearDownClass(cls):
        cls.app.pool.shutdown(wait=True)

    def test_consumers_include_transitive_recipes(self):
        names = {x['name']: x for x in self.app.consumers('Wood')}
        self.assertTrue(names['Board']['direct'])
        self.assertFalse(names['Sturdy Shield']['direct'])

    def test_bad_requests_rejected(self):
        for payload in [{}, {'targets': {'Sturdy Shield': 0}},
                        {'targets': {'Wood': 1}}, {'targets': {'Sturdy Shield': 1}, 'areas': []}]:
            with self.assertRaises(ValueError):
                self.app.submit(payload)

    def test_metadata_has_craftable_items_and_exploration_areas(self):
        data = self.app.metadata()
        self.assertEqual(data['planner_api_version'], 2)
        self.assertGreater(sum(i['craftable'] for i in data['items']), 300)
        self.assertTrue(all(a['kind'] == 'explore' for a in data['locations']))

    def test_passive_presets_include_bait_and_exclude_random_outputs(self):
        data = self.app.metadata()
        names = {self.app.catalog['items'][x['item_id']]['name'] for x in data['passive_inputs']}
        self.assertIn('Minnows', names)
        self.assertIn('Worms', names)
        self.assertFalse(names & {'Iron', 'Nails', 'Small Screw', 'Small Spring', 'Shimmer Quartz', 'Coal'})
        ingredients = {ref for item in self.app.catalog['items'].values() if item['craftable'] for ref in item['direct_ingredients']}
        self.assertTrue(all(x['item_id'] in ingredients for x in data['passive_inputs']))
