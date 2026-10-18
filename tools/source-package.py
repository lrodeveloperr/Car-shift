"""Package reproducible source/tests/evidence; excludes installed QA dependencies and historical attempts."""
from pathlib import Path
import json,hashlib,zipfile
root=Path(__file__).resolve().parent.parent
artifact_dir=root/'artifacts';artifact_dir.mkdir(exist_ok=True)
out=artifact_dir/'shape-shifting-vehicle-race-source-tests.zip'
primary={'course-audit.json','course-metrics.json','rejected-candidates.json','foundation-audit.json','unit-results.tap','end-to-end-report.json','stress-report.json','safety-report.json','dom-soak-final-report.json','performance-report.json','package-report.json','product-count.json','acceptance-matrix.json','browser-blockers.json','review.json','local-report.json','size-report.json','build.log','domain.log','lifecycle.log','layout.log','performance.log','compliance.log'}
paths=[]
for directory in ('source','runtime','tests','tools','docs'):
    paths.extend(p for p in (root/directory).rglob('*') if p.is_file() and '__pycache__'not in p.parts)
paths.extend(p for p in (root/'qa').iterdir() if p.name in primary)
paths.extend(p for p in root.iterdir() if p.is_file() and p.suffix in ('.md','.json') and p.name!='SOURCE-MANIFEST.json')
paths.extend(root/'.qa-deps'/name for name in ('package.json','package-lock.json'))
paths.append(root/'releases/shape-shifting-vehicle-race-diagnostic.zip')
paths=sorted(set(paths));manifest={'purpose':'diagnostic source/test evidence; not production release','files':[{'path':p.relative_to(root).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for p in paths]}
def write():
    with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for name,data in [(p.relative_to(root).as_posix(),p.read_bytes())for p in paths]+[('SOURCE-MANIFEST.json',(json.dumps(manifest,indent=2)+'\n').encode())]:
            info=zipfile.ZipInfo('shape-shifting-vehicle-race/'+name,(1980,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16;z.writestr(info,data)
    return out.read_bytes()
a=write();b=write();assert a==b
with zipfile.ZipFile(out) as z:
    for row in manifest['files']:assert hashlib.sha256(z.read('shape-shifting-vehicle-race/'+row['path'])).hexdigest()==row['sha256']
print(json.dumps({'files':len(paths),'bytes':len(a),'sha256':hashlib.sha256(a).hexdigest(),'everyManifestHashVerified':True,'byteIdenticalTwoBuilds':True}))
