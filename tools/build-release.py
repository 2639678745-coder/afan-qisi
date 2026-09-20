#!/usr/bin/env python3
"""Build source-only archives and the pinned, checksummed public installer."""
import argparse
import hashlib
from pathlib import Path
import re
import tarfile
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('--repo', required=True)
parser.add_argument('--tag', default='v1.0.0')
parser.add_argument('--output', type=Path)
args = parser.parse_args()
if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', args.repo):
    parser.error('Invalid GitHub owner/repository')
if not re.fullmatch(r'v\d+\.\d+\.\d+', args.tag):
    parser.error('Use a version tag such as v1.0.0')
root = Path(__file__).resolve().parents[1]
output = args.output or root / 'release'
output.mkdir(parents=True, exist_ok=True)
names = ['README.md', 'README.txt', 'server.js', 'afan.js', 'start.command',
         'start.cmd', 'start.ps1', 'Dockerfile', 'compose.yaml', '.dockerignore']
files = [root / name for name in names]
files += sorted(p for p in (root / 'public').rglob('*')
                if p.is_file() and p.name != '.DS_Store' and not p.name.startswith('._'))
tar_path = output / 'afan-qisi.tar.gz'
with tarfile.open(tar_path, 'w:gz', format=tarfile.PAX_FORMAT) as archive:
    for file in files:
        archive.add(file, arcname=Path('afan-qisi') / file.relative_to(root), recursive=False)
zip_path = output / 'afan-qisi.zip'
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as archive:
    for file in files:
        archive.write(file, Path('afan-qisi') / file.relative_to(root))
sha = hashlib.sha256(tar_path.read_bytes()).hexdigest()
script = (root / 'scripts/install.sh.in').read_text()
script = script.replace('__REPO__', args.repo).replace('__TAG__', args.tag).replace('__SHA256__', sha)
(output / 'install.sh').write_text(script)
(output / 'install.sh').chmod(0o755)
(output / 'SHA256SUMS').write_text(''.join(
    f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n'
    for p in [tar_path, zip_path, output / 'install.sh']))
print(f'Built {len(files)} app files into {output}')
print(f'Program SHA-256: {sha}')
