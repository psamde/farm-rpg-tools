"""Run from the repository root: python -m experiments.benchmark_global."""
import copy
import json
from pathlib import Path
import time
import subprocess
import sys
import warnings
from planner import plan
from secondary import consume_leftovers
from experiments.global_pool import optimize


def cases():
    payload = json.loads(Path('test_shared_pool_plan.json').read_text(encoding='utf8'))
    yield 'shared_net_off', copy.deepcopy(payload)
    payload['secondary'][0]['allow_exploration'] = True
    yield 'shared_net_on_first', copy.deepcopy(payload)
    changed = copy.deepcopy(payload)
    changed['secondary'].append(changed['secondary'].pop(0))
    yield 'shared_net_on_last', changed
    changed = copy.deepcopy(payload)
    changed['secondary'][0]['cap'] = 10000
    yield 'net_cap_10000', changed
    changed = copy.deepcopy(payload)
    changed['targets']['837'] = 90001
    yield 'lantern_90001', changed
    changed = copy.deepcopy(payload)
    i = next(i for i,g in enumerate(changed['secondary']) if g['item_id']=='125')
    changed['secondary'].insert(0,changed['secondary'].pop(i))
    yield 'aquamarine_first', changed
    changed = copy.deepcopy(payload)
    for g in changed['secondary']: g['allow_exploration'] = False
    yield 'all_extra_off', changed
    yield 'anchored_save', json.loads(Path('test_anchored_plan.json').read_text(encoding='utf8'))
    for budget in (53550834,60000000):
        changed = copy.deepcopy(payload)
        changed['_experiment'] = dict(objective_mode='budgeted_crafts',explore_budget=budget)
        yield 'budget_'+str(budget),changed


def main():
    warnings.filterwarnings('ignore',message='Unrecognized options detected')
    catalog = json.loads(Path('data/catalog.json').read_text(encoding='utf8'))
    fixtures, results = [], []
    for name,payload in cases():
        primary = plan(catalog,payload['targets'],**{k:payload[k] for k in
            ('areas','inventory','iron_depot','runecube','resource_saver')})
        options = payload.get('_experiment',{})
        fixture = dict(name=name,primary=primary,goals=payload['secondary'],areas=payload['areas'],options=options)
        fixtures.append(fixture)
        row = {'name':name,'primary_explores':primary['optimal_total_explores']}
        try: row['prototype'] = optimize(catalog,primary,payload['secondary'],payload['areas'],**options)
        except ValueError as e: row['error'] = str(e)
        if name in ('shared_net_off','shared_net_on_first','anchored_save'):
            started = time.perf_counter()
            live = consume_leftovers(catalog,primary,payload['secondary'],areas=payload['areas'],max_areas=15,
                                     defer_comparison=lambda callback: None)
            row['live'] = {'seconds':time.perf_counter()-started,'explores':live['optimal_total_explores'],
                'crafts':{g['item_id']:g['crafts'] for g in live['secondary']['targets']}}
        results.append(row)
        print(name, row.get('error') or (row['prototype']['seconds'],row['prototype']['explores']),flush=True)
    Path('experiments/fixtures.json').write_text(json.dumps(fixtures,indent=2),encoding='utf8')
    Path('experiments/native-results.json').write_text(json.dumps(results,indent=2),encoding='utf8')
    if '--skip-integer' not in sys.argv: run_integer()


def run_integer():
    started = time.perf_counter()
    try:
        child = subprocess.run([sys.executable,'-m','experiments.benchmark_global','--integer-child'],
                               timeout=30,check=True,capture_output=True,text=True)
        integer = json.loads(child.stdout)
    except subprocess.TimeoutExpired:
        integer = {'error':'External wall-clock watchdog stopped integer solve after 30 seconds',
                   'seconds':time.perf_counter()-started}
    Path('experiments/integer-result.json').write_text(json.dumps(integer,indent=2),encoding='utf8')
    print('integer',integer.get('error') or integer['explores'],flush=True)


if __name__=='__main__':
    if '--integer-child' in sys.argv:
        catalog = json.loads(Path('data/catalog.json').read_text(encoding='utf8'))
        first = next(f for f in json.loads(Path('experiments/fixtures.json').read_text(encoding='utf8'))
                     if f['name']=='shared_net_on_first')
        started = time.perf_counter()
        try: result = optimize(catalog,first['primary'],first['goals'],first['areas'],integer=True)
        except ValueError as e: result = {'error':str(e),'seconds':time.perf_counter()-started}
        print(json.dumps(result))
    elif '--integer-only' in sys.argv: run_integer()
    else: main()
