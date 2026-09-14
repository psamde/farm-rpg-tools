import unittest
from copy import deepcopy
from unittest.mock import patch
import browser_engine
from test_planner import small_catalog

class PrimaryCacheTests(unittest.TestCase):
    def test_reuse_invalidation_and_isolation(self):
        catalog=small_catalog()
        payload={'targets':{'Target':2},'areas':None,'max_areas':2,'performance':{'cache_primary':True}}
        with patch('browser_engine.ranked_plans',wraps=browser_engine.ranked_plans) as ranked:
            first=browser_engine.compute(catalog,payload)
            original=deepcopy(first['plans'])
            first['plans'].clear()
            second=browser_engine.compute(catalog,payload)
            self.assertEqual(second['plans'],original)
            self.assertTrue(second['performance']['primary_cache_hit'])
            self.assertEqual(ranked.call_count,1)
            # Solver toggles don't change the primary problem.
            browser_engine.compute(catalog,{**payload,'performance':{'cache_primary':True,'reuse_models':True}})
            self.assertEqual(ranked.call_count,1)
            for key,value in [('targets',{'Target':3}),('inventory',{'A':1}),('resource_saver',10),('max_areas',1)]:
                result=browser_engine.compute(catalog,{**payload,key:value})
                self.assertFalse(result['performance']['primary_cache_hit'])
            count=ranked.call_count
            browser_engine.compute(catalog,{**payload,'performance':{}})
            self.assertEqual(ranked.call_count,count+1)
            result=browser_engine.compute(deepcopy(catalog),payload)
            self.assertFalse(result['performance']['primary_cache_hit'])

if __name__=='__main__':unittest.main()
