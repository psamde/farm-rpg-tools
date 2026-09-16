"""Refresh the static quest picker from Buddy Farm's public questline grouping."""
import json
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlencode
from datetime import datetime, timezone

QUERY = '''{ questlines { id title steps { order quest {
 id cleanTitle requiredSilver requiredItems { quantity item { id name } }
} } } }'''

def normalize(data):
    return [dict(id=str(line['id']), name=line['title'], quests=[
        dict(id=str(step['quest']['id']), name=step['quest']['cleanTitle'],
             silver=step['quest'].get('requiredSilver') or 0,
             items=[dict(id=str(r['item']['id']), name=r['item']['name'], quantity=r['quantity'])
                    for r in step['quest']['requiredItems']])
        for step in sorted(line['steps'], key=lambda s:s['order']) if step.get('quest')])
        for line in data['data']['questlines']]

if __name__ == '__main__':
    endpoint='https://api.buddy.farm/graphql'
    request=Request(endpoint+'?'+urlencode({'query':QUERY}),headers={'User-Agent':'FarmRPGTools/0.1','Accept':'application/json'})
    with urlopen(request,timeout=120) as response:data=json.load(response)
    if data.get('errors'):raise ValueError(data['errors'])
    lines=normalize(data)
    path=Path(__file__).parent/'web/quests.json'
    path.write_text(json.dumps(dict(source=endpoint,updated=datetime.now(timezone.utc).isoformat(),questlines=lines),separators=(',',':')),encoding='utf8')
    print(f'{len(lines)} questlines, {sum(len(q["quests"]) for q in lines)} quests')
