import unittest
from itertools import combinations
from random import Random
from planner import ranked_plans, plan, InfeasiblePlan
from test_planner import small_catalog

class RankedSearchTests(unittest.TestCase):
    def test_distinct_routes_match_exhaustive_small_models(self):
        rng=Random(48)
        for _ in range(20):
            c=small_catalog()
            for s in c['sources'].values():
                s['expected_drops_per_explore']=rng.randint(1,30)/17
            actual=ranked_plans(c,{'Target':17})
            exhaustive={}
            for n in range(1,4):
                for scope in combinations(c['locations'],n):
                    try:p=plan(c,{'Target':17},areas=list(scope))
                    except InfeasiblePlan:continue
                    key='|'.join(sorted(a['location_id'] for a in p['areas']))
                    exhaustive[key]=min(exhaustive.get(key,float('inf')),p['optimal_total_explores'])
            self.assertEqual({p['area_set_id']:p['optimal_total_explores'] for p in actual['plans']},exhaustive)

    def test_many_redundant_area_sets_are_not_solved(self):
        c=small_catalog()
        for i in range(8):
            name='extra'+str(i);c['locations'][name]={'name':name,'kind':'explore'}
            c['sources'][name]=dict(c['sources']['a1'],location_id=name,expected_drops_per_explore=.01)
        r=ranked_plans(c,{'Target':100})
        self.assertLess(r['enumeration']['combinations_checked'],2047)
        self.assertEqual(r['plans'][0]['optimal_total_explores'],200)
