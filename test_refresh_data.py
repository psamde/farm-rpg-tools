import unittest
from copy import deepcopy
from pathlib import Path
from farmdata import read_json
from refresh_data import content, validate

class RefreshTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = read_json(Path(__file__).parent / 'data/catalog.json')

    def test_existing_snapshot_valid(self):
        validate(self.catalog, self.catalog)

    def test_timestamps_do_not_trigger_updates(self):
        new = deepcopy(self.catalog)
        new['upstream'] = {'new_timestamp': 'today'}
        new['snapshot_sha256'] = 'changed'
        self.assertEqual(content(new), content(self.catalog))
        next(iter(new['items'].values()))['name'] += ' changed'
        self.assertNotEqual(content(new), content(self.catalog))

    def test_missing_item_and_bad_rate_rejected(self):
        new = deepcopy(self.catalog)
        del new['items'][next(iter(new['items']))]
        with self.assertRaises(ValueError): validate(new, self.catalog)
        new = deepcopy(self.catalog)
        next(s for s in new['sources'].values() if s['kind']=='explore')['expected_drops_per_explore'] = float('nan')
        with self.assertRaises(ValueError): validate(new, self.catalog)
