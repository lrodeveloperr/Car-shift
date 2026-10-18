"""Deterministic diagnostic archive; NOT a YouTube/Playgama release packager."""
import hashlib,json,zipfile
from pathlib import Path
root=Path(__file__).resolve().parent.parent
runtime=root/'runtime';out=root/'releases'/'shape-shifting-vehicle-race-diagnostic.zip';out.parent.mkdir(exist_ok=True)
paths=sorted(p for p in runtime.rglob('*') if p.is_file())
for p in paths:
    if p.is_symlink():raise ValueError('No symlinks in runtime')
    if any(x in p.relative_to(runtime).parts for x in ('..','node_modules')):raise ValueError('Invalid runtime path')
def build():
    with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for p in paths:
            info=zipfile.ZipInfo(p.relative_to(runtime).as_posix(),(1980,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16;z.writestr(info,p.read_bytes())
    return out.read_bytes()
a=build();b=build();assert a==b
report={'scope':'standalone diagnostic only; SDK/graphics/host certification absent','byteIdenticalTwoBuilds':True,'archiveBytes':len(a),'expandedRuntimeBytes':sum(p.stat().st_size for p in paths),'sha256':hashlib.sha256(a).hexdigest(),'files':[{'path':p.relative_to(runtime).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for p in paths]}
assert report['archiveBytes']<=5000000 and report['expandedRuntimeBytes']<=5000000
(root/'qa'/'package-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
