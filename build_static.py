"""Build the deployable web directory from the canonical Python sources/data."""
import json
import re
from pathlib import Path
from webapp import Application
ROOT=Path(__file__).parent

def build():
    version=(ROOT/'VERSION').read_text(encoding='utf8').strip()
    if not re.fullmatch(r'\d+\.\d+(?:\.\d+)?',version):
        raise ValueError('VERSION must be a numeric release such as 0.1 or 0.1.1')
    index=ROOT/'web/index.html'
    html=index.read_text(encoding='utf8')
    html=re.sub(r'<title>.*?</title>',f"<title>Exploration Planner v{version} · psam's FarmRPG Tools</title>",html)
    html=re.sub(r'(<span class="appversion"[^>]*>).*?(</span>)',lambda m:m[1]+'v'+version+m[2],html)
    html=re.sub(r'((?:src|href)="[^"?]+\.(?:js|css)\?v=)[^"&]+',lambda m:m[1]+version,html)
    index.write_text(html,encoding='utf8')
    c=json.loads((ROOT/'data/catalog.json').read_text(encoding='utf8'))
    app=Application(c)
    try: metadata=app.metadata()
    finally: app.pool.shutdown()
    (ROOT/'web/catalog.json').write_text(json.dumps({'metadata':metadata,'catalog':c},separators=(',',':')),encoding='utf8')
    for name in ('planner.py','secondary.py','balanced.py','browser_engine.py','wasm_solver.py','automatic.py'):
        (ROOT/'web'/name).write_bytes((ROOT/name).read_bytes())
if __name__=='__main__':build()
