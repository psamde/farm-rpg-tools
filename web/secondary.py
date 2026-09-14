"""Validate leftover selections and dispatch to the balanced shared-pool model.

The previous credit-flow allocator remains private as a regression oracle.
Application calls use balanced.py; they never use the frozen-pool algorithm.
"""
from collections import Counter
from copy import deepcopy
import math
from planner import resolve


def validate_secondary(catalog, rows):
    if not isinstance(rows, list) or len(rows) > 20:
        raise ValueError('Use at most 20 leftover targets.')
    seen, result = set(), []
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError('Invalid leftover target.')
        ref = resolve(catalog['items'], str(row.get('item_id', '')))
        if ref in seen or not catalog['items'][ref]['craftable']:
            raise ValueError('Leftover targets must be unique craftable items.')
        assist = row.get('allow_exploration', False)
        if type(assist) is not bool:
            raise ValueError('Invalid exploration option.')
        cap = row.get('cap')
        if cap is not None and (type(cap) is not int or not 0 <= cap <= 100000000):
            raise ValueError('Leftover caps must be whole numbers from 0 to 100,000,000, or blank.')
        seen.add(ref)
        anchor = row.get('exploration_item_id')
        if anchor is not None:
            anchor = resolve(catalog['items'], str(anchor))
            def contains(parent):
                return any(child == anchor or contains(child) for child in catalog['items'][parent]['direct_ingredients'])
            if not contains(ref):
                raise ValueError('The exploration ingredient must be part of this recipe.')
        result.append({'item_id': ref, 'allow_exploration': assist, 'cap': cap, **({'exploration_item_id': anchor} if anchor is not None else {})})
    return result


def consume_leftovers(catalog, primary, requested, areas=None, max_areas=15, progress=None, defer_comparison=None):
    from balanced import consume
    goals = validate_secondary(catalog, requested)
    if not goals: return primary
    return consume(catalog,primary,goals,areas,max_areas,progress)


def _consume_priority_legacy(catalog, primary, requested, areas=None, max_areas=15, progress=None, defer_comparison=None):
    goals = validate_secondary(catalog, requested)
    if not any(g['allow_exploration'] and g.get('exploration_item_id') for g in goals):
        return _consume_leftovers(catalog, primary, goals, areas, max_areas, progress, defer_comparison)
    # Each row gets one snapshot of the route established by higher priorities.
    # Rebuild from the primary inputs each time; snapshots are credit budgets,
    # never additional physical inventory. Earlier craft quantities stay met.
    previous = primary
    metadata = {}
    for index, goal in enumerate(goals):
        minimum = {t['item_id']:t['crafts'] for t in previous.get('secondary', {}).get('crafts_in_dependency_order', [])}
        pool = {b['item_id']:max(0, b['expected_final_inventory']-b['reserved_target_output'])
                for b in previous['item_balances']}
        previous = _consume_leftovers(catalog, primary, goals[:index+1], areas, max_areas, progress,
            _minimum=minimum, _pool=pool, _reference=previous, _current=goal['item_id'])
        row = previous['secondary']['targets'][-1]
        metadata[goal['item_id']] = deepcopy(row)
    for row in previous['secondary']['targets']:
        saved = metadata[row['item_id']]
        for key in ('exploration_ingredient', 'pool_credit_used', 'pool_credit_if_first'):
            if key in saved: row[key] = saved[key]
        row['if_first'] = row['crafts']
        row['lost_to_priority'] = False
    previous['model'] = 'shared route supplies; freeze each ingredient before its extra exploration'
    previous['secondary']['semantics'] = 'Use shared supplies in priority order. Freeze each chosen ingredient before that craft adds exploration; preserve earlier craft quantities.'
    previous['secondary']['route_reoptimized'] = any(g['allow_exploration'] for g in goals)
    previous['solver']['scope'] = 'shared route supplies; ingredient budgets frozen once per priority'
    previous['secondary']['priority_matters'] = False
    for goal, row in zip(goals, previous['secondary']['targets']):
        def compare(goal=goal, row=row):
            try:
                first = _consume_leftovers(catalog, primary, [goal], areas, max_areas, progress)
                count = first['secondary']['targets'][0]['crafts']
                row['if_first'] = max(row['crafts'], count)
                row['lost_to_priority'] = count > row['crafts']
                row['comparison_status'] = 'complete'
            except ValueError:
                row['comparison_status'] = 'unavailable'
            previous['secondary']['priority_matters'] = any(t['lost_to_priority'] for t in previous['secondary']['targets'])
        if defer_comparison is not None:
            row['if_first'] = None
            row['comparison_status'] = 'pending'
            defer_comparison(compare)
        else:
            compare()
    return previous


def _consume_leftovers(catalog, primary, requested, areas=None, max_areas=15, progress=None, defer_comparison=None,
                       *, _minimum=None, _pool=None, _reference=None, _current=None):
    goals = validate_secondary(catalog, requested)
    if not goals:
        return primary
    import numpy as np
    from scipy.optimize import Bounds, LinearConstraint, milp
    items = catalog['items']
    factor = 1 / (1 + primary['assumptions']['resource_saver'] / 100)
    free = {r['id'] for r in primary['assumptions']['unlimited_free_items']}
    stock = Counter({r['item_id']: r['starting_inventory'] + r.get('required_external_supply', 0) for r in primary['item_balances']})
    pool = {r['item_id']: r['expected_unused'] for r in primary['item_balances']
            if r['expected_unused'] > 1e-8 and r['item_id'] not in free}
    if _pool is not None:
        pool = {ref:q for ref,q in _pool.items() if q > 1e-8 and ref not in free}
    minimum = _minimum or {}
    reference = _reference or primary
    reserve = Counter({r['item_id']: r['reserved_target_output'] for r in primary['item_balances']})
    primary_goals = {r['item_id']: r['craft_quantity'] for r in primary['targets']}
    assisted = any(g['allow_exploration'] for g in goals if _current is None or g['item_id'] == _current)

    def graph(roots):
        order, seen, active = [], set(), set()
        def visit(ref):
            if ref in active:
                raise ValueError('Recipe cycle in catalog')
            if ref in seen:
                return
            active.add(ref)
            for child in items[ref]['direct_ingredients']:
                visit(child)
            active.remove(ref)
            seen.add(ref)
            if items[ref]['craftable']:
                order.append(ref)
        for ref in roots:
            visit(ref)
        return order, seen
    p_order, p_refs = graph(primary_goals)
    c_order, c_refs = graph(g['item_id'] for g in goals)
    refs = sorted(p_refs | c_refs)

    # Pool credit is normalized per original material and conserved along
    # recipe edges. Density bounds prevent concentrating arbitrary credit in
    # a tiny quantity of a crafted intermediate.
    # Keep credit-flow coefficients on the same scale as material quantities.
    # Unit-sized credit previously produced ~1e-6 coefficients alongside
    # millions of physical units, making priority locks numerically brittle.
    credit_scale = max((pool[ref] for ref in sorted(c_refs) if ref in pool), default=1)
    density = {}
    for ref in sorted(c_refs):
        if not items[ref]['craftable']:
            density[ref] = credit_scale / pool[ref] if ref in pool else 0
    for ref in c_order:
        inherited = sum(q * factor * density[child] for child, q in items[ref]['direct_ingredients'].items()) / items[ref]['output_quantity']
        # A fractional leftover intermediate must not inflate the credit
        # capacity of every newly crafted unit of that item.
        density[ref] = inherited if inherited > 0 else (credit_scale / pool[ref] if ref in pool else 0)
    for ref in free:
        density[ref] = 0

    def ingredient_amount(target, ingredient):
        def expand(ref, amount):
            if ref == ingredient:
                return amount
            return sum(expand(child, amount * q * factor / items[ref]['output_quantity'])
                       for child, q in items[ref]['direct_ingredients'].items())
        return sum(expand(child, q * factor) for child, q in items[target]['direct_ingredients'].items())

    # Finite solver-domain bounds, derived from all original supplies and all
    # dependency paths (not a user-selected anchor). They safely allow the
    # small top-up needed to consume a fractional final batch.
    desired = {}
    for g in goals:
        desired[g['item_id']] = sum(math.ceil(amount / need) for ref, amount in pool.items()
                                    if (need := ingredient_amount(g['item_id'], ref)) > 0)
    if _current is not None:
        desired[_current] += minimum.get(_current, 0)
    for ref, count in minimum.items():
        desired[ref] = max(desired.get(ref, 0), count)
    def craft_bounds(order, targets):
        needs, bounds = Counter(), {}
        for ref in reversed(order):
            count = max(targets.get(ref, 0), math.ceil(needs[ref] / items[ref]['output_quantity']))
            bounds[ref] = count
            for child, q in items[ref]['direct_ingredients'].items():
                needs[child] += count * q * factor
        return bounds
    c_bounds = craft_bounds(c_order, desired)
    for goal in goals:
        if goal['cap'] is not None:
            c_bounds[goal['item_id']] = min(c_bounds[goal['item_id']],goal['cap'])
    p_bounds = craft_bounds(p_order, primary_goals)
    original_p = {r['item_id']: r['crafts'] for r in reference['crafts_in_dependency_order']}
    # Keep the existing route precisely when exploration assistance is off.
    original_e = {a['location_id']: a['explores'] for a in reference['areas']}
    locations = {i: r for i, r in catalog['locations'].items() if r['kind'] == 'explore'}
    allowed = {resolve(locations, a) for a in areas} if areas is not None else set(locations)
    if not assisted:
        allowed = set(original_e)
    rates = {i: {} for i in sorted(allowed)}
    for source in catalog['sources'].values():
        if source['kind'] != 'explore' or source['location_id'] not in allowed:
            continue
        cond = source['conditions']
        if cond.get('frozen') or any(cond.get(k) is not None and cond[k] != v for k, v in
            [('ironDepot', primary['assumptions'].get('iron_depot', False)),
             ('runecube', primary['assumptions'].get('runecube', False)), ('manualFishing', False)]):
            continue
        loc, ref, rate = source['location_id'], source['item_id'], source['expected_drops_per_explore']
        if ref in rates[loc] or not math.isfinite(rate) or rate <= 0:
            raise ValueError('Invalid or ambiguous exploration table')
        rates[loc][ref] = rate
    if any(not drops for drops in rates.values()):
        raise ValueError('Missing matching exploration table')

    lower, upper, integer = [], [], []
    def variable(lo=0, hi=math.inf, whole=False):
        i = len(lower)
        lower.append(lo); upper.append(hi); integer.append(int(whole))
        return i
    P = {ref: variable(primary_goals.get(ref, 0) if assisted else original_p.get(ref, 0),
                        p_bounds[ref] if assisted else original_p.get(ref, 0), True) for ref in p_order}
    C = {ref: variable(lo=minimum.get(ref, 0), hi=c_bounds[ref], whole=True) for ref in c_order}
    N = {ref: variable(hi=c_bounds[ref], whole=True) for ref in c_order}
    E, Y = {}, {}
    total_need = Counter(reserve)
    for order, bounds in [(p_order, p_bounds), (c_order, c_bounds)]:
        for ref in order:
            for child, q in items[ref]['direct_ingredients'].items():
                total_need[child] += bounds[ref] * q * factor
    for loc, drops in rates.items():
        bound = max(original_e.get(loc, 0), math.ceil(sum(q / drops[ref] for ref, q in total_need.items() if ref in drops)) + 100)
        E[loc] = variable(0 if assisted else original_e.get(loc, 0), bound if assisted else original_e.get(loc, 0), True)
        if assisted and max_areas < len(rates):
            Y[loc] = variable(hi=1, whole=True)
    anchored = any(g.get('exploration_item_id') and g['allow_exploration'] for g in goals)
    if not anchored:
        S = {ref: variable(hi=pool[ref] * density[ref]) for ref in sorted(c_refs) if ref in pool and density[ref] > 0}
        F = {(ref, child): variable() for ref in c_order for child in items[ref]['direct_ingredients'] if density[child] > 0}
        G = {ref: variable() for ref in c_order}
    else:
        # Track each original material separately: credit from Horn cannot be
        # replaced by credit from Stone, nor created by additional exploration.
        origin_density = {}
        for origin in sorted(c_refs & pool.keys()):
            if origin in free:
                continue
            d = {ref: 0 for ref in c_refs}
            d[origin] = credit_scale / pool[origin]
            for ref in c_order:
                if ref != origin and ref not in free:
                    d[ref] = sum(q * factor * d[child] for child, q in items[ref]['direct_ingredients'].items()) / items[ref]['output_quantity']
            origin_density[origin] = d
        S = {origin: variable(hi=credit_scale) for origin in origin_density}
        F = {(origin, ref, child): variable() for origin, d in origin_density.items()
             for ref in c_order if ref != origin for child in items[ref]['direct_ingredients'] if d[child] > 0}
        G = {(origin, ref): variable() for origin, d in origin_density.items() for ref in c_order if ref != origin and d[ref] > 0}
    rules, lows, highs = [], [], []
    def rule(terms, lo=-math.inf, hi=math.inf):
        rules.append(terms); lows.append(lo); highs.append(hi)
    for ref in refs:
        if ref in free:
            if ref in primary_goals and not items[ref]['craftable']:
                rule({E[loc]: drops.get(ref, 0) for loc, drops in rates.items()}, lo=reserve[ref]-stock[ref])
            continue
        terms = {E[loc]: drops.get(ref, 0) for loc, drops in rates.items()}
        for cols in (P, C):
            for craft, col in cols.items():
                terms[col] = (items[craft]['output_quantity'] if craft == ref else 0) - items[craft]['direct_ingredients'].get(ref, 0) * factor
        rule(terms, lo=reserve[ref]-stock[ref])
    # A second material ledger proves the crafts marked "leftovers only" can
    # be supported without additional supplies, even while the joint route
    # changes. Additional intermediates can still support assisted descendants.
    for ref in sorted(c_refs):
        if ref not in free:
            rule({N[craft]: (items[craft]['output_quantity'] if craft == ref else 0) - items[craft]['direct_ingredients'].get(ref, 0) * factor
                  for craft in c_order}, lo=-pool.get(ref, 0))
    for ref in c_order:
        rule({N[ref]: 1, C[ref]: -1}, hi=-minimum.get(ref, 0))
    no_extra = {g['item_id'] for g in goals if not g['allow_exploration']}
    if not anchored:
        for (craft, child), col in F.items():
            quantity = items[craft]['direct_ingredients'][child] * factor * density[child]
            rule({col: 1, (N if craft in no_extra else C)[craft]: -quantity}, hi=0 if craft in no_extra else -quantity*minimum.get(craft, 0))
        for ref in c_order:
            terms = {G[ref]: 1}
            terms.update({col: -1 for (craft, _), col in F.items() if craft == ref})
            rule(terms, lo=0, hi=0)
            rule({G[ref]: 1, C[ref]: -items[ref]['output_quantity'] * density[ref]}, hi=-items[ref]['output_quantity']*density[ref]*minimum.get(ref, 0))
        for ref in sorted(c_refs):
            terms = {col: 1 for (_, child), col in F.items() if child == ref}
            if ref in S: terms[S[ref]] = -1
            if ref in G: terms[G[ref]] = -1
            rule(terms, hi=0)
    else:
        for (origin, craft, child), col in F.items():
            quantity = items[craft]['direct_ingredients'][child] * factor * origin_density[origin][child]
            rule({col: 1, (N if craft in no_extra else C)[craft]: -quantity}, hi=0 if craft in no_extra else -quantity*minimum.get(craft, 0))
        for (origin, ref), col in G.items():
            terms = {col: 1}
            terms.update({edge: -1 for (o, craft, _), edge in F.items() if o == origin and craft == ref})
            rule(terms, lo=0, hi=0)
            if any(g['allow_exploration'] and g.get('exploration_item_id') == ref for g in goals):
                # A crafted anchor may come from original ingredients, but
                # extra exploration must not replenish its credited supply.
                rule({col: 1, N[ref]: -items[ref]['output_quantity']*origin_density[origin][ref]}, hi=0)
        for origin, d in origin_density.items():
            for ref in sorted(c_refs):
                terms = {edge: 1 for (o, _, child), edge in F.items() if o == origin and child == ref}
                if ref == origin: terms[S[origin]] = -1
                if (origin, ref) in G: terms[G[origin, ref]] = -1
                if terms: rule(terms, hi=0)
    for loc, col in Y.items():
        rule({E[loc]: 1, col: -upper[E[loc]]}, hi=0)
    if Y:
        rule({col: 1 for col in Y.values()}, hi=max_areas)

    matrix = np.zeros((len(rules), len(lower)))
    for i, terms in enumerate(rules):
        for j, value in terms.items(): matrix[i, j] = value
    constraints = [LinearConstraint(matrix, np.array(lows), np.array(highs))]
    bounds = Bounds(lower, upper)
    def solve(objective, extra=(), explore_gap=0):
        if progress: progress()
        options = {'time_limit': 60, 'mip_rel_gap': 0.0}
        if explore_gap:
            options['mip_abs_gap'] = explore_gap
        result = milp(objective, integrality=integer, bounds=bounds, constraints=[*constraints, *extra], options=options)
        # Presolve can misclassify tightly locked mixed-integer models.
        # Retry the identical constraints, never relax material requirements.
        if result.status in (2, 4):
            result = milp(objective, integrality=integer, bounds=bounds, constraints=[*constraints, *extra], options={**options, 'presolve': False})
        if not result.success:
            raise ValueError('Could not optimize shared leftovers: ' + result.message)
        return result
    def objective(cols):
        v = np.zeros(len(lower))
        for col in cols: v[col] = 1
        return v
    explore_cost = objective(E.values())
    craft_cost = objective([*P.values(), *C.values(), *N.values()])
    # Only the explore objective may stop with a bounded absolute gap.
    # Credit priorities and craft tie-breaks remain exact. Small routes rerun
    # exactly even if the original reference route exceeded the threshold.
    explore_gap = 5 if primary['optimal_total_explores'] >= 100000 else 0
    def cheapest(extra):
        first = solve(explore_cost, extra, explore_gap)
        if explore_gap and first.fun < 100000:
            first = solve(explore_cost, extra)
        count = int(round(explore_cost @ first.x))
        fixed = LinearConstraint(explore_cost.reshape(1, -1), count, count)
        return solve(craft_cost, [*extra, fixed])
    # Credit is continuous: locks must allow solver feasibility noise after
    # integer rounding. This does not relax physical ingredient balances.
    credit_tolerance = max(1e-5, credit_scale * 1e-8)
    locked, credits, maxima, if_first = [], [], [], []
    pending_comparisons = []
    for goal in goals:
        ref = goal['item_id']
        if _current is not None and ref != _current:
            maxima.append(0); credits.append(0); if_first.append(None)
            continue
        if anchored:
            anchor = goal.get('exploration_item_id') if goal['allow_exploration'] else None
            def through_anchor(origin, child):
                if anchor is None:
                    return True
                return ((origin == anchor or ingredient_amount(anchor, origin) > 0)
                        and (child == anchor or ingredient_amount(child, anchor) > 0))
            reward = objective(col for (origin, craft, child), col in F.items() if craft == ref and through_anchor(origin, child))
        else:
            reward = objective(col for (craft, _), col in F.items() if craft == ref)
        alone = solve(-reward)
        best = float(reward @ alone.x)
        ranked = solve(-reward, locked) if locked else alone
        value = float(reward @ ranked.x)
        # Keep the credit optimum, with only numerical tolerance; crafting and
        # area quantities themselves remain integer.
        fixed = LinearConstraint(reward.reshape(1, -1), max(0, value-credit_tolerance), value+credit_tolerance)
        maxima.append(best); credits.append(value)
        if best-value > credit_scale * 1e-7:
            comparison_lock = LinearConstraint(reward.reshape(1, -1), max(0, best-credit_tolerance), best+credit_tolerance)
            if defer_comparison is not None:
                pending_comparisons.append((len(if_first), ref, comparison_lock))
                if_first.append(None)
            else:
                independent = cheapest([comparison_lock])
                if_first.append(int(round(independent.x[C[ref]])))
        else:
            if_first.append(None)
        locked.append(fixed)
    final = cheapest(locked)
    x = final.x.copy()
    for i, whole in enumerate(integer):
        if whole: x[i] = round(x[i])
    values = matrix @ x
    if np.any(values < np.array(lows)-1e-6) or np.any(values > np.array(highs)+1e-6):
        raise ValueError('Shared-pool material balance check failed')

    def crafting(cols):
        produced, consumed, rows = Counter(), Counter(), []
        for ref, col in cols.items():
            count = int(x[col])
            if not count: continue
            produced[ref] += count * items[ref]['output_quantity']
            for child, q in items[ref]['direct_ingredients'].items(): consumed[child] += count * q * factor
            rows.append(dict(item_id=ref, name=items[ref]['name'], crafts=count, expected_paid_crafts=count*factor))
        return produced, consumed, rows
    pp, pc, p_rows = crafting(P)
    cp, cc, c_rows = crafting(C)
    explored, area_rows = Counter(), []
    total = int(round(explore_cost @ x))
    for loc, col in E.items():
        count = int(x[col])
        if not count: continue
        area_rows.append(dict(location_id=loc, name=locations[loc]['name'], explores=count,
                              fraction_of_explores=count/total, items=[]))
        for ref, rate in rates[loc].items(): explored[ref] += rate*count
    # Once exploration is fixed, all actual surplus is usable. New drops
    # cannot increase the exploration objective, but can support free extra
    # crafts, including targets with no inputs in the original reference pool.
    actual_surplus = {ref: max(0, stock[ref]+explored[ref]+pp[ref]+cp[ref]-pc[ref]-cc[ref]-reserve[ref])
                      for ref in c_refs}
    extra_counts, extra_maxima = craft_actual_surplus(items, c_order, [{**g,'cap':max(0,g['cap']-int(x[C[g['item_id']]])) if g['cap'] is not None else None} for g in goals], actual_surplus, free, factor)
    for ref, count in extra_counts.items():
        cp[ref] += count * items[ref]['output_quantity']
        for child, q in items[ref]['direct_ingredients'].items(): cc[child] += count*q*factor
    c_rows = [dict(item_id=ref, name=items[ref]['name'], crafts=int(x[C[ref]])+extra_counts.get(ref,0),
                   expected_paid_crafts=(int(x[C[ref]])+extra_counts.get(ref,0))*factor)
              for ref in c_order if int(x[C[ref]])+extra_counts.get(ref,0)]
    balances = {}
    selected = {g['item_id'] for g in goals}
    for ref in set(stock) | set(pool) | set(explored) | set(pp) | set(pc) | set(cp) | set(cc):
        remaining = stock[ref]+explored[ref]+pp[ref]+cp[ref]-pc[ref]-cc[ref]
        supply = max(0, reserve[ref]-remaining) if ref in free else 0
        remaining += supply
        if remaining < reserve[ref]-1e-6:
            raise ValueError('Primary reserved outputs were consumed')
        secondary_reserve = min(max(0, cp[ref]-cc[ref]), max(0, remaining-reserve[ref])) if ref in selected else 0
        balances[ref] = dict(item_id=ref, name=items[ref]['name'], starting_inventory=stock[ref],
            expected_exploration_drops=explored[ref], crafted=pp[ref]+cp[ref], free_perk_supply=supply,
            consumed_by_crafting=pc[ref]+cc[ref], used_by_leftover_craft=cc[ref], reserved_target_output=reserve[ref],
            reserved_secondary_output=secondary_reserve, expected_final_inventory=max(0, remaining),
            expected_unused=max(0, remaining-reserve[ref]-secondary_reserve), original_leftover_pool=pool.get(ref, 0))
    for area in area_rows:
        for ref, rate in sorted(rates[area['location_id']].items(), key=lambda p: items[p[0]]['name']):
            b = balances[ref]
            needed = min(explored[ref], max(0, b['consumed_by_crafting']-stock[ref]-b['crafted']))
            amount = rate*area['explores']
            used = amount*needed/explored[ref] if explored[ref] else 0
            area['items'].append(dict(item_id=ref, name=items[ref]['name'], expected_drops=amount, used=used, unused=max(0, amount-used)))
    targets = []
    for i, g in enumerate(goals):
        ref = g['item_id']; base_count = int(x[C[ref]]); count = base_count+extra_counts.get(ref,0)
        lost = maxima[i]-credits[i] > credit_scale * 1e-7
        alternative = max(if_first[i] or 0, base_count+extra_maxima.get(ref,0))
        lost = alternative > count
        target = dict(**g, name=items[ref]['name'], crafts=count, if_first=alternative if lost else count,
                      crafts_from_final_surplus=extra_counts.get(ref,0),
                      lost_to_priority=lost, pool_credit_used=credits[i]/credit_scale, pool_credit_if_first=maxima[i]/credit_scale,
                      missing_for_next_craft=[])
        if g.get('exploration_item_id') and g['allow_exploration']:
            anchor = g['exploration_item_id']
            target['exploration_ingredient'] = dict(item_id=anchor, name=items[anchor]['name'],
                available=pool.get(anchor, 0), used=credits[i]*pool.get(anchor, 0)/credit_scale,
                planned_crafts=base_count)
        if not count:
            available = {r: max(0, b['expected_final_inventory']-b['reserved_target_output']) for r, b in balances.items()}
            missing = Counter()
            def need(r, amount):
                if r in free: return
                used = min(available.get(r, 0), amount)
                available[r] = available.get(r, 0)-used
                amount -= used
                if amount < 1e-8: return
                if not items[r]['craftable']: missing[r] += amount
                else:
                    crafts = math.ceil((amount-1e-8)/items[r]['output_quantity'])
                    available[r] += crafts*items[r]['output_quantity']-amount
                    for child, q in items[r]['direct_ingredients'].items(): need(child, crafts*q*factor)
            for child, q in items[ref]['direct_ingredients'].items(): need(child, q*factor)
            target['missing_for_next_craft'] = [dict(item_id=r, name=items[r]['name'], quantity=q) for r, q in missing.items()]
            target['no_pool_inputs'] = desired[ref] == 0
        targets.append(target)
    result = deepcopy(primary)
    result.update(areas=area_rows, item_balances=sorted(balances.values(), key=lambda b:b['name']),
                  crafts_in_dependency_order=p_rows, optimal_total_explores=total,
                  continuous_lower_bound_explores=None,
                  model='priority allocation of original leftovers, then minimum joint exploration')
    result['unused_items'] = [b for b in result['item_balances'] if b['expected_unused'] > 1e-8]
    result['solver'] = dict(name='SciPy/HiGHS', optimal=not (explore_gap and total >= 100000), maximum_gap_explores=explore_gap if total >= 100000 else 0, scope='fixed original leftover pool; joint route optimized' if assisted else 'fixed primary route', tie_break='fewest crafts')
    result['secondary'] = dict(schema_version='2.0.0', targets=targets, crafts_in_dependency_order=c_rows,
        priority_matters=any(t['lost_to_priority'] for t in targets), route_reoptimized=assisted,
        primary_explores=primary['optimal_total_explores'], additional_explores=total-primary['optimal_total_explores'],
        pool=[dict(item_id=r, name=items[r]['name'], quantity=q) for r, q in pool.items() if r in c_refs],
        semantics='Original leftover credit flows through shared recipes in priority order. New drops create no credit. Minimize full-route explores after allocation. Primary outputs remain reserved.')
    for index, ref, comparison_lock in pending_comparisons:
        target = targets[index]
        target['if_first'] = None
        target['comparison_status'] = 'pending'
        def finish(target=target, ref=ref, comparison_lock=comparison_lock, index=index):
            try:
                independent = cheapest([comparison_lock])
                alternative = max(int(round(independent.x[C[ref]])),
                                  int(x[C[ref]])+extra_maxima.get(ref, 0))
                target['lost_to_priority'] = alternative > target['crafts']
                target['if_first'] = alternative if target['lost_to_priority'] else target['crafts']
                target['comparison_status'] = 'complete'
                result['secondary']['priority_matters'] = any(t['lost_to_priority'] for t in targets)
            except ValueError:
                # An optional comparison must never discard a valid route.
                target['comparison_status'] = 'unavailable'
        defer_comparison(finish)
    return result


def craft_actual_surplus(items, order, goals, stock, free, factor):
    """Maximize additional crafts from a fixed finished route, without explores."""
    import numpy as np
    from scipy.optimize import Bounds, LinearConstraint, milp
    refs = sorted({child for ref in order for child in items[ref]['direct_ingredients']} | set(order))
    matrix = np.array([[(items[c]['output_quantity'] if c == ref else 0)-items[c]['direct_ingredients'].get(ref,0)*factor
                        for c in order] for ref in refs],dtype=float)
    demand = np.array([-np.inf if ref in free else -stock.get(ref,0) for ref in refs])
    base = LinearConstraint(matrix,demand,np.inf)
    upper = np.full(len(order),np.inf)
    for g in goals:
        if g.get('cap') is not None: upper[order.index(g['item_id'])] = g['cap']
    locks, maxima = [], {}
    def solve(objective, constraints):
        result = milp(objective,integrality=np.ones(len(order)),bounds=Bounds(np.zeros(len(order)),upper),
                      constraints=constraints,options={'time_limit':30,'mip_rel_gap':0.0})
        if result.status in (2,4):
            result = milp(objective,integrality=np.ones(len(order)),bounds=Bounds(np.zeros(len(order)),upper),
                          constraints=constraints,options={'time_limit':30,'mip_rel_gap':0.0,'presolve':False})
        return result
    for goal in goals:
        ref = goal['item_id']; col = order.index(ref)
        objective = np.zeros(len(order)); objective[col] = -1
        alone = solve(objective,[base])
        if alone.status == 3:
            # Perk-only crafts have no finite leftover maximum. They may still
            # be crafted as intermediates; the final tie-break minimizes them.
            maxima[ref] = 0
            continue
        if not alone.success: raise ValueError('Could not allocate final leftovers: '+alone.message)
        maxima[ref] = int(round(alone.x[col]))
        ranked = solve(objective,[base,*locks])
        if not ranked.success: raise ValueError('Could not allocate final leftover priority: '+ranked.message)
        count = int(round(ranked.x[col]))
        locks.append(LinearConstraint((-objective).reshape(1,-1),count,count))
    final = solve(np.ones(len(order)),[base,*locks])
    if not final.success: raise ValueError('Could not finish leftover crafting: '+final.message)
    counts = np.rint(final.x)
    if np.min(matrix@counts-demand) < -1e-6: raise ValueError('Final leftover material balance check failed')
    return {ref:int(count) for ref,count in zip(order,counts) if count}, maxima
