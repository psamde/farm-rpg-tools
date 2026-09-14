"""Minimize explores subject to expected drop/material balances."""
from collections import Counter
from itertools import combinations
import math
import textwrap


class InfeasiblePlan(ValueError):
    pass


def resolve(records, value):
    matches = [key for key, row in records.items()
               if value == key or value.casefold() == row['name'].casefold()
               or value == row.get('slug')]
    if len(matches) != 1:
        raise ValueError(f'Unknown or ambiguous name/ID: {value}')
    return matches[0]


def exploration_target_ids(catalog):
    return {s['item_id'] for s in catalog['sources'].values()
            if s['kind'] == 'explore' and not s.get('conditions', {}).get('frozen')
            and s.get('expected_drops_per_explore', 0) > 0}


def plan(catalog, target, quantity=1, areas=None, exclude_areas=None,
         inventory=None, iron_depot=False, runecube=False, continuous=False,
         require_all_areas=False, resource_saver=0):
    if isinstance(resource_saver, bool) or not isinstance(resource_saver, (int, float)) or not math.isfinite(resource_saver) or not 0 <= resource_saver <= 45:
        raise ValueError('Resource Saver must be a percentage from 0 to 45')
    # Resource Saver duplicates output; it is NOT a percentage discount.
    # Variables count expected credited crafts, including bonus items.
    material_factor = 1 / (1 + resource_saver / 100)
    try:
        import numpy as np
        from scipy.optimize import Bounds, LinearConstraint, milp
    except ImportError as error:
        raise ValueError('Planner requires SciPy. Run: python -m pip install -r requirements.txt') from error
    items = catalog['items']
    free_ids = {resolve(items, name) for name in ('Iron', 'Nails')} if iron_depot else set()
    requested = target if isinstance(target, dict) else {target: quantity}
    if not requested:
        raise ValueError('Add at least one target')
    goals = Counter()
    for name, count in requested.items():
        if isinstance(count, bool) or not isinstance(count, int) or count < 1:
            raise ValueError('Target quantities must be positive integers')
        ref = resolve(items, str(name))
        if not items[ref]['craftable'] and ref not in exploration_target_ids(catalog):
            raise ValueError('Targets must be craftable or directly obtainable from exploration')
        goals[ref] += count
    target_id = next(iter(goals))
    targets = [{'item_id': i, 'name': items[i]['name'], 'craft_quantity': q, 'kind': 'craft' if items[i]['craftable'] else 'collect'} for i, q in goals.items()]
    stock = Counter()
    for key, amount in (inventory or {}).items():
        if isinstance(amount, bool) or not isinstance(amount, (int, float)) or not math.isfinite(amount) or amount < 0:
            raise ValueError('Inventory quantities must be finite nonnegative numbers')
        stock[resolve(items, str(key))] += amount
    all_locations = {key: row for key, row in catalog['locations'].items() if row['kind'] == 'explore'}
    allowed = {resolve(all_locations, a) for a in areas} if areas is not None else set(all_locations)
    allowed -= {resolve(all_locations, a) for a in (exclude_areas or [])}
    if not allowed:
        raise ValueError('No exploration areas selected')
    rates = {loc: {} for loc in sorted(allowed)}
    for source in catalog['sources'].values():
        if source['kind'] != 'explore' or source['location_id'] not in allowed:
            continue
        conditions = source['conditions']
        if conditions.get('frozen'):
            continue
        if any(conditions.get(k) is not None and conditions[k] != v
               for k, v in [('ironDepot', iron_depot), ('runecube', runecube), ('manualFishing', False)]):
            continue
        loc, ref = source['location_id'], source['item_id']
        if ref in rates[loc]:
            raise ValueError(f'Ambiguous matching drop tables for {loc}, item {ref}')
        rate = source['expected_drops_per_explore']
        if not math.isfinite(rate) or rate <= 0:
            raise ValueError('Invalid expected exploration yield')
        rates[loc][ref] = rate
    missing_tables = [all_locations[i]['name'] for i, r in rates.items() if not r]
    if missing_tables:
        raise ValueError('No matching exploration table: ' + ', '.join(missing_tables))

    # Workshop ancestors only. Direct drops of intermediate items can replace
    # their crafting, but target drops do not replace target mastery crafts.
    relevant, craft_order, active = set(), [], set()
    def visit(ref):
        if ref in active:
            raise ValueError('Recipe cycle in catalog')
        if ref in relevant:
            return
        active.add(ref)
        row = items[ref]
        for ingredient in row['direct_ingredients']:
            visit(ingredient)
        active.remove(ref)
        relevant.add(ref)
        if row['craftable']:
            craft_order.append(ref)
    for ref in goals:
        visit(ref)
    external_ids = {ref for ref in relevant if not items[ref]["craftable"] and ref not in exploration_target_ids(catalog) and ref not in free_ids}
    row_ids = sorted(relevant)
    location_ids = sorted(allowed)
    nloc, ncraft = len(location_ids), len(craft_order)
    matrix = np.zeros((len(row_ids), nloc + ncraft))
    for r, ref in enumerate(row_ids):
        for col, loc in enumerate(location_ids):
            matrix[r, col] = rates[loc].get(ref, 0)
        for col, craft in enumerate(craft_order, nloc):
            matrix[r, col] = (items[craft]['output_quantity'] if craft == ref else 0) - items[craft]['direct_ingredients'].get(ref, 0) * material_factor
    demand = np.array([-stock[ref] for ref in row_ids], dtype=float)
    # Unlimited perk supply satisfies any shortfall in Iron and Nails. Keep
    # exact recipe quantities for reporting; these rows no longer constrain exploration.
    for r, ref in enumerate(row_ids):
        if ref in free_ids | external_ids:
            demand[r] = -np.inf
        if goals[ref] and not items[ref]['craftable']:
            demand[r] = goals[ref] - stock[ref]
            if ref in free_ids:
                matrix[r, nloc:] = 0
    lower, upper = np.zeros(nloc + ncraft), np.full(nloc + ncraft, np.inf)
    if require_all_areas:
        if continuous:
            raise ValueError('Distinct exact-area combinations require integer explores')
        lower[:nloc] = 1
    for ref, count in goals.items():
        if items[ref]['craftable']:
            lower[nloc + craft_order.index(ref)] = count
    objective = np.array([1.] * nloc + [0.] * ncraft)
    integrality = np.zeros(nloc + ncraft) if continuous else np.ones(nloc + ncraft)
    constraint = LinearConstraint(matrix, demand, np.inf)
    bounds = Bounds(lower, upper)
    options = {'time_limit': 60, 'mip_rel_gap': 0.0}
    first = milp(objective, integrality=integrality, bounds=bounds, constraints=constraint, options=options)
    if not first.success:
        if first.status == 2:
            raise InfeasiblePlan('Target cannot be crafted from the selected exploration drops, inventory, and enabled free supplies.')
        raise ValueError('Solver did not prove optimality: ' + first.message)
    optimum = float(first.fun) if continuous else int(round(first.fun))
    # Among minimum-explore plans, avoid arbitrary unnecessary intermediate crafts.
    fixed_explores = LinearConstraint(objective.reshape(1, -1), optimum, optimum)
    second = milp(np.array([0.] * nloc + [1.] * ncraft), integrality=integrality,
                  bounds=bounds, constraints=[constraint, fixed_explores], options=options)
    if not second.success:
        raise ValueError('Could not resolve minimum-craft tie-break: ' + second.message)
    solution = second.x if continuous else np.rint(second.x)
    if np.min(matrix @ solution - demand) < -1e-6 or abs(objective @ solution - optimum) > 1e-6:
        raise ValueError('Numerical material-balance check failed')
    relaxation = milp(objective, integrality=np.zeros_like(integrality), bounds=bounds, constraints=constraint, options=options)
    explored, produced, consumed = Counter(), Counter(), Counter()
    area_plan = []
    for col, loc in enumerate(location_ids):
        count = float(solution[col]) if continuous else int(solution[col])
        if count <= 1e-9:
            continue
        area_plan.append({'location_id': loc, 'name': all_locations[loc]['name'], 'explores': count,
                          'fraction_of_explores': count / optimum})
        for ref, rate in rates[loc].items():
            explored[ref] += count * rate
    crafts = []
    for col, ref in enumerate(craft_order, nloc):
        count = float(solution[col]) if continuous else int(solution[col])
        if count <= 1e-9:
            continue
        crafts.append({'item_id': ref, 'name': items[ref]['name'], 'crafts': count,
                       'expected_paid_crafts': count * material_factor})
        produced[ref] += items[ref]['output_quantity'] * count
        for ingredient, amount in items[ref]['direct_ingredients'].items():
            consumed[ingredient] += count * amount * material_factor
    balances, unused = [], []
    for ref in sorted(set(explored) | set(produced) | set(consumed) | set(stock), key=lambda i: items[i]['name']):
        remaining = stock[ref] + explored[ref] + produced[ref] - consumed[ref]
        # Mastery counts crafts even when their output feeds another target.
        reserved = (max(0., goals[ref] * items[ref]['output_quantity'] - consumed[ref])
                    if items[ref]['craftable'] else goals[ref])
        free_supply = max(0., reserved - remaining) if ref in free_ids else 0
        external_supply = max(0., reserved - remaining) if ref in external_ids else 0
        remaining += free_supply + external_supply
        surplus = max(0., remaining - reserved)
        row = {'item_id': ref, 'name': items[ref]['name'], 'starting_inventory': stock[ref],
               'expected_exploration_drops': explored[ref], 'crafted': produced[ref],
               'free_perk_supply': free_supply, 'required_external_supply': external_supply,
               'consumed_by_crafting': consumed[ref], 'reserved_target_output': reserved,
               'expected_final_inventory': max(0., remaining), 'expected_unused': surplus}
        balances.append(row)
        if surplus > 1e-8:
            unused.append(row)
    # Attribution is proportional across areas, not an exploration schedule.
    # Inventory and intermediate crafted output are consumed before new drops.
    balance_by_id = {row['item_id']: row for row in balances}
    for area in area_plan:
        area['items'] = []
        for ref, rate in sorted(rates[area['location_id']].items(), key=lambda pair: items[pair[0]]['name']):
            row = balance_by_id[ref]
            from_explores_used = min(explored[ref], max(0., consumed[ref] - stock[ref] - produced[ref]))
            drops = area['explores'] * rate
            used = drops * from_explores_used / explored[ref] if explored[ref] else 0.
            area['items'].append({'item_id': ref, 'name': items[ref]['name'],
                                  'expected_drops': drops, 'used': used, 'unused': max(0., drops - used)})
    def expand_raw(ref, amount, totals):
        if items[ref]['craftable']:
            for ingredient, count in items[ref]['direct_ingredients'].items():
                expand_raw(ingredient, amount * count / items[ref]['output_quantity'], totals)
        else:
            totals[ref] += amount
    raw_totals = Counter()
    # A selected intermediate's crafts count toward both its own mastery goal
    # and downstream needs, rather than being charged twice.
    baseline_needs = Counter({ref: count for ref, count in goals.items() if not items[ref]['craftable']})
    for ref in reversed(craft_order):
        count = max(goals[ref], baseline_needs[ref] / items[ref]['output_quantity'])
        for ingredient, amount in items[ref]['direct_ingredients'].items():
            baseline_needs[ingredient] += count * amount * material_factor
    raw_totals.update({ref: count for ref, count in baseline_needs.items() if not items[ref]['craftable']})
    raw_requirements = [{'item_id': ref, 'name': items[ref]['name'], 'quantity': count,
                         'free_with_perk': ref in free_ids}
                        for ref, count in sorted(raw_totals.items(), key=lambda pair: items[pair[0]]['name'])]
    return {
        'plan_schema_version': '3.0.0', 'catalog_snapshot_sha256': catalog.get('snapshot_sha256'),
        'raw_materials_needed': raw_requirements,
        'area_usage_attribution': 'Proportional across areas after consuming starting inventory and crafted intermediates; accounting only, not an exploration order.',
        'target': targets[0], 'targets': targets,
        'target_semantics': 'Craft targets count workshop crafts; collection targets reserve the requested final inventory, after crafting. Starting inventory counts toward collection goals.',
        'model': 'minimum explores under expected-yield material balances',
        'assumptions': {'empty_inventory_unless_supplied': True, 'iron_depot': iron_depot, 'runecube': runecube,
            'resource_saver': resource_saver, 'resource_saver_model': 'Expected credited output including duplicates; ingredients divided by 1 + bonus at each recipe level. No inventory-cap refunds or per-batch rounding.', 'integer_explores_and_crafts': not continuous,
            'unlimited_free_items': [{'id': i, 'name': items[i]['name']} for i in sorted(free_ids)],
            'all_selected_areas_assumed_accessible': True, 'inventory_capacity': None,
            'other_non_exploration_supply': 'Non-explorable ingredient shortfalls must be supplied separately; listed in required_external_supply',
            'completion_guaranteed': False,
            'limitations': 'Expected yields are not a stochastic stopping-time estimate. No inventory caps, exploration order, Craftworks timing/slots, or automatic secondary-target selection modeled.'},
        'allowed_areas': [{'id': i, 'name': all_locations[i]['name']} for i in location_ids],
        'optimal_total_explores': optimum,
        'continuous_lower_bound_explores': float(relaxation.fun) if relaxation.success else None,
        'solver': {'name': 'SciPy/HiGHS', 'optimal': True, 'tie_break': 'fewest total crafts'},
        'areas': area_plan, 'crafts_in_dependency_order': crafts,
        'item_balances': balances, 'unused_items': unused,
    }


def ranked_plans(catalog, target, quantity=1, areas=None, exclude_areas=None,
                 inventory=None, iron_depot=False, runecube=False, max_areas=None,
                 progress=None, combinations_mode=False, resource_saver=0):
    """Optimize every unordered allowed-area subset, then merge realized sets.

    Areas may receive zero explores. Permutations, zero-use areas, and alternate
    allocations with the same realized area set are not separate options.
    """
    if max_areas is not None and (isinstance(max_areas, bool) or not isinstance(max_areas, int) or max_areas < 1):
        raise ValueError('max_areas must be a positive integer')
    # Validate settings and detect a globally impossible target up front.
    baseline = plan(catalog, target, quantity, areas, exclude_areas, inventory, iron_depot, runecube, resource_saver=resource_saver)
    items = catalog['items']
    target_id = baseline['target']['item_id']
    free_ids = {row['id'] for row in baseline['assumptions']['unlimited_free_items']}
    ingredients = set()
    def visit(ref):
        for child in items[ref]['direct_ingredients']:
            if child not in ingredients and child not in free_ids:
                ingredients.add(child)
                visit(child)
    for goal in baseline['targets']:
        visit(goal['item_id'])
        if not items[goal['item_id']]['craftable']:
            ingredients.add(goal['item_id'])
    allowed = {row['id'] for row in baseline['allowed_areas']}
    useful = set()
    for source in catalog['sources'].values():
        if source['kind'] != 'explore' or source['location_id'] not in allowed or source['item_id'] not in ingredients:
            continue
        c = source['conditions']
        if not c.get('frozen') and all(c.get(k) is None or c[k] == v for k, v in
                [('ironDepot', iron_depot), ('runecube', runecube), ('manualFishing', False)]):
            useful.add(source['location_id'])
    candidates = sorted(useful)
    size_limit = min(max_areas or len(candidates), len(candidates))
    total = sum(math.comb(len(candidates), size) for size in range(1, size_limit + 1))
    results = [baseline] if baseline['optimal_total_explores'] == 0 else []
    infeasible = checked = 0
    for size in range(1, size_limit + 1):
        for subset in combinations(candidates, size):
            try:
                result = plan(catalog, target, quantity, list(subset), None, inventory,
                              iron_depot, runecube, require_all_areas=combinations_mode, resource_saver=resource_saver)
                results.append(result)
            except InfeasiblePlan:
                infeasible += 1
            checked += 1
            if progress and (checked % 32 == 0 or checked == total):
                progress(checked, total)
    deduplicated = {}
    for result in results:
        key = tuple(sorted(a['location_id'] for a in result['areas']))
        previous = deduplicated.get(key)
        score = lambda p: (p['optimal_total_explores'], sum(c['crafts'] for c in p['crafts_in_dependency_order']))
        if previous is None or score(result) < score(previous):
            deduplicated[key] = result
    results = list(deduplicated.values())
    results.sort(key=lambda r: (r['optimal_total_explores'], len(r['areas']),
                               tuple(a['location_id'] for a in r['areas'])))
    for rank, result in enumerate(results, 1):
        result['rank'] = rank
        result['area_set_id'] = '|'.join(sorted(a['location_id'] for a in result['areas'])) or 'no-exploration'
    if not results:
        raise InfeasiblePlan('No feasible combination within the selected maximum area count')
    return {'options_schema_version': '2.0.0', 'target': baseline['target'], 'targets': baseline['targets'],
            'raw_materials_needed': baseline['raw_materials_needed'],
            'catalog_snapshot_sha256': catalog.get('snapshot_sha256'),
            'assumptions': baseline['assumptions'],
            'enumeration': {'mode': 'combinations' if combinations_mode else 'best',
                'meaning': ('Require at least one explore in every selected area; one minimum per unordered set.' if combinations_mode else 'Optimize every unordered candidate area subset, allowing zero-use areas. Deduplicate by the areas actually used. One representative optimum per subset, not every tied allocation.'),
                'candidate_areas': [{'id': i, 'name': catalog['locations'][i]['name']} for i in candidates],
                'excluded_irrelevant_areas': [{'id': i, 'name': catalog['locations'][i]['name']} for i in sorted(allowed - useful)],
                'max_areas': size_limit, 'combinations_checked': checked, 'infeasible_combinations': infeasible,
                'feasible_options': len(results), 'complete_within_scope': True,
                'scope': 'Unordered sets of areas that drop a nonfree recipe ingredient or intermediate; no arbitrary extra explores beyond the optimum within each set.'},
            'plans': results}


def number(value):
    if value == 0:
        return '0'
    if abs(value) < .001:
        return f'{value:.3g}'
    return f'{value:,.3f}'.rstrip('0').rstrip('.')


def item_list(rows, field):
    return '; '.join(f"{r['name']}: {number(r[field])}" for r in rows if r[field] > 1e-10) or 'None'


def raw_lines(result):
    lines = ['RAW MATERIALS NEEDED', '']
    for row in result['raw_materials_needed']:
        note = ' (free with Iron Depot)' if row['free_with_perk'] else ''
        lines.append(f"  {row['name']}: {number(row['quantity'])}{note}")
    lines += ['', 'Baseline if all intermediates are crafted, before using inventory.',
              'Direct intermediate drops can reduce these raw requirements in each path.', '']
    return lines


def text_report(result):
    target = result['target']
    lines = ['CRAFT ' + item_list(result.get('targets', [target]), 'craft_quantity'), ''] + raw_lines(result)
    lines += [f"Iron Depot: {'ON - Iron and Nails are free' if result['assumptions']['iron_depot'] else 'OFF'}",
              f"Expected quantities; Resource Saver {result['assumptions']['resource_saver']}%. Areas are assumed accessible.",
              'Shared drops used are split proportionally across areas after inventory',
              'and crafted intermediates. This is accounting, not an exploration order.', '']
    options = result.get('plans', [result])
    for rank, p in enumerate(options, 1):
        lines += ['=' * 76, f"PATH {rank} / {len(options)}  |  {number(p['optimal_total_explores'])} explores", '']
        lines.append(textwrap.fill('Craft: ' + item_list(p['crafts_in_dependency_order'], 'crafts'), width=96, subsequent_indent='       '))
        free = item_list(p['item_balances'], 'free_perk_supply')
        if free != 'None':
            lines.append('Free perk supply used: ' + free)
        starting = item_list(p['item_balances'], 'starting_inventory')
        if starting != 'None':
            lines.append(textwrap.fill('Starting inventory: ' + starting, width=96, subsequent_indent='  '))
        lines.append('')
        if not p['areas']:
            lines += ['  No exploration needed.', '']
        for area in p['areas']:
            lines += [f"  {area['name']} - {number(area['explores'])} explores ({area['fraction_of_explores']:.1%})", '']
            for field, label in [('used', 'USED'), ('unused', 'UNUSED')]:
                lines.append(textwrap.fill(f'    {label}: ' + item_list(area['items'], field), width=96, subsequent_indent='      ', break_long_words=False, break_on_hyphens=False))
                lines.append('')
        lines.append(textwrap.fill('  TOTAL UNUSED AFTER CRAFTING: ' + item_list(p['unused_items'], 'expected_unused'), width=96, subsequent_indent='    ', break_long_words=False, break_on_hyphens=False))
        lines += ['', '']
    return '\n'.join(lines)


def markdown(result):
    description = item_list(result.get('targets', [result['target']]), 'craft_quantity')
    if 'plans' in result:
        lines = [f"# Ranked exploration options: {description}", '',
                 f"Iron Depot: **{'on — Iron and Nails are unlimited and free' if result['assumptions']['iron_depot'] else 'off'}**.", '',
                 '```text\n' + '\n'.join(raw_lines(result)) + '\n```', '',
                 result['enumeration']['meaning'], '',
                 'Only areas supplying nonfree recipe ingredients are considered. Quantities use expected drops, with the configured Resource Saver bonus. All selected areas are assumed accessible.', '',
                 '| Rank | Explores | Area counts | Unused item types |', '|---:|---:|---|---:|']
        for p in result['plans']:
            areas = '; '.join(f"{a['name']}: {a['explores']}" for a in p['areas']) or 'None'
            lines.append(f"| {p['rank']} | {p['optimal_total_explores']} | {areas} | {len(p['unused_items'])} |")
        for p in result['plans']:
            lines += ['', f"## Option {p['rank']}", '', markdown(p).replace('# Exploration plan:', '### Exploration plan:', 1).replace('\n## ', '\n#### ')]
        return '\n'.join(lines)
    lines = [f"# Exploration plan: {description}", '',
             f"**Minimum: {result['optimal_total_explores']:.6g} explores in the expected-yield model.**", '',
             '```text\n' + '\n'.join(raw_lines(result)) + '\n```', '',
             f"Iron Depot: {'on (unlimited free Iron and Nails)' if result['assumptions']['iron_depot'] else 'off'}. All selected areas are assumed accessible. Resource Saver {result['assumptions']['resource_saver']}%; no Craftworks scheduling modeled. Quantities are expected averages.", '',
             '## Exploration', '', '| Area | Explores | Share |', '|---|---:|---:|']
    for row in result['areas']:
        lines.append(f"| {row['name']} | {row['explores']:.6g} | {row['fraction_of_explores']:.2%} |")
    for area in result['areas']:
        lines += ['', f"### {area['name']} - {number(area['explores'])} explores", '',
                  '**Used:** ' + item_list(area['items'], 'used'), '',
                  '**Unused:** ' + item_list(area['items'], 'unused'), '']
    lines += ['', '## Craft in dependency order', '', '| Item | Crafts |', '|---|---:|']
    for row in result['crafts_in_dependency_order']:
        lines.append(f"| {row['name']} | {row['crafts']:.6g} |")
    lines += ['', '## All expected item balances', '',
              '| Item | Starting | Explored | Free perk supply | Crafted | Consumed | Target reserved | Unused |',
              '|---|---:|---:|---:|---:|---:|---:|---:|']
    for row in result['item_balances']:
        values = [row[k] for k in ['starting_inventory', 'expected_exploration_drops', 'free_perk_supply', 'crafted', 'consumed_by_crafting', 'reserved_target_output', 'expected_unused']]
        lines.append('| ' + row['name'] + ' | ' + ' | '.join(f'{v:.8g}' for v in values) + ' |')
    lines += ['']
    return '\n'.join(lines)


def passive_plans(catalog, inventory, areas, iron_depot=False, runecube=False, resource_saver=0, max_areas=15):
    """One production batch is the original surplus pool; no reserved targets."""
    if isinstance(resource_saver, bool) or not isinstance(resource_saver, (int,float)) or not math.isfinite(resource_saver) or not 0 <= resource_saver <= 45:
        raise ValueError('Resource Saver must be from 0 to 45')
    items=catalog['items']; stock=Counter()
    for key, quantity in inventory.items():
        if isinstance(quantity,bool) or not isinstance(quantity,(int,float)) or not math.isfinite(quantity) or quantity<0:
            raise ValueError('Production quantities must be finite and nonnegative')
        stock[resolve(items,str(key))]+=quantity
    locations={k:v for k,v in catalog['locations'].items() if v['kind']=='explore'}
    allowed=[resolve(locations,i) for i in areas]
    free=[{'id':resolve(items,n),'name':n} for n in ('Iron','Nails')] if iron_depot else []
    balances=[dict(item_id=i,name=items[i]['name'],starting_inventory=q,expected_exploration_drops=0,crafted=0,free_perk_supply=0,consumed_by_crafting=0,reserved_target_output=0,expected_final_inventory=q,expected_unused=q) for i,q in stock.items()]
    assumptions=dict(iron_depot=iron_depot,runecube=runecube,resource_saver=resource_saver,unlimited_free_items=free,integer_explores_and_crafts=True)
    base=dict(plan_schema_version='3.0.0',target=None,targets=[],raw_materials_needed=[],assumptions=assumptions,allowed_areas=[dict(id=i,name=locations[i]['name']) for i in allowed],optimal_total_explores=0,continuous_lower_bound_explores=0,areas=[],crafts_in_dependency_order=[],item_balances=balances,unused_items=[b for b in balances if b['expected_unused']>0],solver=dict(name='production inventory',optimal=True),model='Consume one passive production batch',rank=1,area_set_id='no-exploration')
    return dict(options_schema_version='2.0.0',target=None,targets=[],raw_materials_needed=[],assumptions=assumptions,plans=[base],enumeration=dict(mode='passive',max_areas=max_areas,combinations_checked=0,feasible_options=1))
