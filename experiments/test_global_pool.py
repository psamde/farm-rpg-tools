import copy
import unittest
from planner import plan
from test_planner import small_catalog
from experiments.global_pool import optimize


class GlobalPoolTests(unittest.TestCase):
    def fixture(self, feedback=0):
        c = small_catalog()
        c['items']['3']['direct_ingredients'] = {'1':1}
        for ref,name,ingredients in [('5','Net',{'4':1,'2':1}),('6','Other',{'4':1}),
                                     ('7','Intermediate',{'4':1})]:
            c['items'][ref] = dict(id=ref,name=name,craftable=True,direct_ingredients=ingredients,output_quantity=1)
        c['sources'] = {}
        for area,drops in [('a',{'1':1,'4':1}),('b',{'2':1,'4':feedback})]:
            for ref,rate in drops.items():
                if rate: c['sources'][area+ref] = dict(kind='explore',location_id=area,item_id=ref,
                                                     expected_drops_per_explore=rate,conditions={})
        return c,plan(c,'Target',10,areas=['a','b'])

    def test_extra_exploring_feeds_back_and_converges(self):
        c,p = self.fixture(.5)
        r = optimize(c,p,[{'item_id':'5','allow_exploration':True,'exploration_item_id':'4'}],['a','b'])
        # 10 original anchor + .5*20 newly found = 20 consumed by 20 nets.
        self.assertAlmostEqual(r['crafts']['5'],20,places=3)
        self.assertAlmostEqual(r['explores'],30,places=3)
        self.assertLess(r['unused']['4'],1e-4)

    def test_non_convergent_feedback_does_not_explore_forever(self):
        c,p = self.fixture(2)
        r = optimize(c,p,[{'item_id':'5','allow_exploration':True,'exploration_item_id':'4'}],['a','b'])
        self.assertAlmostEqual(r['explores'],10,places=3)
        self.assertAlmostEqual(r['unused']['4'],10,places=3)

    def test_priority_allocates_shared_anchor(self):
        c,p = self.fixture()
        rows = [{'item_id':ref,'allow_exploration':True,'exploration_item_id':'4'} for ref in ['5','6']]
        for rows in [rows,rows[::-1]]:
            r = optimize(c,p,rows,['a','b'])
            self.assertAlmostEqual(r['crafts'][rows[0]['item_id']],10,places=3)
            self.assertLess(r['crafts'][rows[1]['item_id']],1e-3)

    def test_cap_leaves_balance_for_next_item(self):
        c,p = self.fixture()
        r = optimize(c,p,[{'item_id':'5','allow_exploration':True,'exploration_item_id':'4','cap':3},
                          {'item_id':'6','allow_exploration':True,'exploration_item_id':'4'}],['a','b'])
        self.assertAlmostEqual(r['crafts']['5'],3,places=3)
        self.assertAlmostEqual(r['crafts']['6'],7,places=3)

    def test_earlier_item_sees_later_exploration(self):
        c,p = self.fixture()
        c['items']['6']['direct_ingredients'] = {'8':1,'9':1}
        for ref in ['8','9']:
            c['items'][ref] = dict(id=ref,name=ref,craftable=False,direct_ingredients={},output_quantity=1)
        for area,ref,rate in [('a','8',1),('joint','9',1),('joint','4',1)]:
            c['sources'][area+ref] = dict(kind='explore',location_id=area,item_id=ref,
                                         expected_drops_per_explore=rate,conditions={})
        p = plan(c,'Target',10,areas=['a','b','joint'])
        r = optimize(c,p,[{'item_id':'5','allow_exploration':True,'exploration_item_id':'4'},
                          {'item_id':'6','allow_exploration':True,'exploration_item_id':'8'}],['a','b','joint'])
        self.assertAlmostEqual(r['crafts']['5'],20,places=3)
        self.assertAlmostEqual(r['crafts']['6'],10,places=3)

    def test_unused_intermediate_is_not_fake_consumption(self):
        c,p = self.fixture(2)
        c['items']['5']['direct_ingredients'] = {'7':1,'2':1}
        r = optimize(c,p,[{'item_id':'5','allow_exploration':True,'exploration_item_id':'7'}],['a','b'])
        self.assertLess(r['crafts']['7'],1e-3)
        self.assertAlmostEqual(r['anchor_residuals']['7'],10,places=3)

    def test_documents_zero_surplus_priority_blocking_lower_goal(self):
        # This is a known product mismatch, not evidence that the model is ready.
        # Closing the first anchor balance forces extra b visits; those replenish
        # the second anchor faster than the second goal can consume it.
        c,p = self.fixture()
        for ref in ['8','9']:
            c['items'][ref] = dict(id=ref,name=ref,craftable=False,direct_ingredients={},output_quantity=1)
        c['items']['6']['direct_ingredients'] = {'8':1,'9':1}
        for area,ref,rate in [('b','8',1),('joint','9',1),('joint','4',2)]:
            c['sources'][area+ref] = dict(kind='explore',location_id=area,item_id=ref,
                                         expected_drops_per_explore=rate,conditions={})
        p = plan(c,'Target',10,areas=['a','b','joint'])
        r = optimize(c,p,[{'item_id':'5','allow_exploration':True,'exploration_item_id':'4'},
                          {'item_id':'6','allow_exploration':True,'exploration_item_id':'8'}],['a','b','joint'])
        self.assertAlmostEqual(r['crafts']['5'],10,places=3)
        self.assertLess(r['crafts']['6'],1e-3)

    def test_leftovers_only_cannot_add_exploring(self):
        c,p = self.fixture()
        r = optimize(c,p,[{'item_id':'5','allow_exploration':False}],['a','b'])
        self.assertAlmostEqual(r['explores'],10,places=3)
        self.assertLess(r['crafts']['5'],1e-3)

    def test_integer_mode_and_inputs_unchanged(self):
        c,p = self.fixture(.5)
        before = copy.deepcopy((c,p))
        r = optimize(c,p,[{'item_id':'5','allow_exploration':True,'exploration_item_id':'4'}],['a','b'],integer=True)
        self.assertEqual((c,p),before)
        self.assertAlmostEqual(r['crafts']['5'],20)
        self.assertAlmostEqual(r['explores'],30)

    def test_budget_stops_self_replenishing_crafts(self):
        c,p = self.fixture(2)
        r = optimize(c,p,[{'item_id':'5','allow_exploration':True,'exploration_item_id':'4'}],
                     ['a','b'],objective_mode='budgeted_crafts',explore_budget=30)
        self.assertAlmostEqual(r['crafts']['5'],20,places=3)
        self.assertAlmostEqual(r['explores'],30,places=3)
        with self.assertRaisesRegex(ValueError,'finite exploration budget'):
            optimize(c,p,[],['a','b'],objective_mode='budgeted_crafts')


if __name__=='__main__': unittest.main()
