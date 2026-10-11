import json, hashlib, pathlib, re, datetime, tarfile
root = pathlib.Path.cwd()
a = root / 'artifacts'
def read(name): return json.loads((a / name).read_text())
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
base = read('validation-0.4.0.json')
checkpoint = read('baseline-0.4.0.json')
log = (a / 'validation-0.4.1.log').read_text()
assert len(re.findall(r'^PASS ', log, re.M)) == 307, 'Full 307-browser-check run required'
assert 'ℹ pass 18' in log and 'ℹ fail 0' in log
assert 'AssertionError' not in log and 'TimeoutError' not in log
suites = {}
for file, count in base['suites'].items():
    d = read(file)
    assert len(d['checks']) == count, file
    assert not d.get('errors'), file
    before = json.loads((a / 'baseline-0.4.0' / file).read_text())
    assert d['checks'] == before['checks'], 'Historical checks changed: ' + file
    suites[file] = count
for engine in ['chromium', 'webkit', 'firefox']:
    for file, count in [(f'guard-visibility-{engine}.json', 1), (f'stabilisation-{engine}.json', 10)]:
        d = read(file)
        assert len(d['checks']) == count and not d.get('errors'), file
        suites[file] = count
    scroll = read(f'selection-scroll-{engine}.json')
    assert scroll['visible'] and max(scroll['samples']) - min(scroll['samples']) < 1
cache = read('cache-public-stabilisation.json')
assert len(cache['checks']) == 4
suites['cache-public-stabilisation.json'] = 4
assert sum(suites.values()) == 307
assert sha(root / checkpoint['checkpoint']) == checkpoint['checkpointSHA256']
# Historical test source is unchanged, not merely replaced by equivalent assertions.
historical_tests = {p: h for p, h in checkpoint['hashes'].items() if p.startswith('tests/')}
for p, h in historical_tests.items(): assert sha(root / p) == h, p
source = pathlib.Path('/Users/kevin/Documents/ChatGPT/Conception Site Web Kevin/wordpress/wp-content/themes/kevin-legros')
theme = read('real-theme-source-hashes.json')
changed = [p for p,h in theme.items() if not (source/p).is_file() or sha(source/p) != h]
assert len(theme) == 191 and not changed
(a / 'theme-hashes-stabilisation.json').write_text(json.dumps({'checked': len(theme), 'changed': changed, 'source': str(source)}, indent=2))
files = {str(p.relative_to(root)):sha(p) for p in (root/'visual-tweaks').rglob('*') if p.is_file()}
public = ['runtime.js', 'selection.js', 'styles.js', 'background-layers.js']
public_bytes = sum((root/'visual-tweaks/assets'/p).stat().st_size for p in public)
assert public_bytes == 18642
with tarfile.open(root / checkpoint['checkpoint']) as archive:
    for p in public:
        name = 'visual-tweaks/assets/' + p
        old = archive.extractfile(next(n for n in archive.getnames() if n.endswith(name))).read()
        now = (root/name).read_bytes().replace(b'?ver=0.4.1', b'?ver=0.4.0')
        assert now == old, 'Public behavior changed: ' + p
report = {
 'pluginVersion':'0.4.1', 'baseVersion':'0.4.0', 'verdict':'prêt avec limites',
 'validatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'command':'npm run test:all', 'log':'artifacts/validation-0.4.1.log',
 'syntax':{'phpFiles':8, 'javascript':'passed'},
 'unitTests':18, 'browserChecks':307, 'existingBrowserChecks':270, 'newBrowserChecks':37,
 'historicalTestFilesUnchanged':len(historical_tests), 'suites':suites,
 'environment':{'wordpress':read('test-report.json')['wordpress'], 'php':read('test-report.json')['php'], 'storage':'SQLite', 'browsers':{e:read(f'viewport-{e}-report.json')['version'] for e in ['chromium','webkit','firefox']}, 'localFixture':'http://127.0.0.1:9410', 'isolatedRealTheme':'http://127.0.0.1:9411'},
 'checkpoint':{'file':checkpoint['checkpoint'], 'sha256':checkpoint['checkpointSHA256'], 'baseline':'artifacts/baseline-0.4.0.json'},
 'fixes':[
  {'module':'responsive-guard.js', 'cause':'Opacity inherited through an ancestor was not checked; invisible descendants were advised as small click targets', 'change':'Exclude truly transparent subtrees using a snapshot-local ancestor cache', 'reproduction':'artifacts/guard-visibility-before.json'},
  {'module':'editor.js', 'cause':'Selection scrollIntoView inherited the real theme smooth scroll; toolbar still moved during click and the iframe could receive it', 'change':'Instant selection scrolling for listed targets and viewport switches, native browse scrolling preserved', 'reproduction':['artifacts/validation-0.4.1-before-scroll-fix.log','artifacts/smooth-scroll-before.log'], 'verification':'artifacts/selection-scroll-<engine>.json'},
  {'module':'editor.js', 'cause':'Clearing a recovered invalid override removed it from state but left its old placeholder in the input', 'change':'Refresh the empty input hint from inherited or current applied CSS values without creating an override', 'reproduction':'artifacts/placeholder-before.log'},
  {'module':'dev/fixture-theme/seed.php', 'scope':'test fixture only', 'cause':'Replacement PNG IDAT CRC was invalid, rejected by Firefox decoder', 'change':'Same pixel with valid CRC; replacement regression now waits for img.decode()'}
 ],
 'sourceDelta':read('source-delta-0.4.1.json'),
 'theme':{'source':str(source), 'filesChecked':191, 'filesModified':0},
 'public':{'modules':public, 'sourceBytesBefore':18642, 'sourceBytesAfter':18642, 'functionalChange':False, 'editorResourcesForVisitors':0, 'resourcesOnPageWithoutOverrides':0, 'editingNoncesExposed':False, 'report':'artifacts/cache-public-stabilisation.json'},
 'cache':{'browser':'tested; latest saved override visible', 'httpProxy':'tested; cached anonymous HTML keeps old override until explicit purge', 'wordpressThirdPartyCache':'not installed/not tested', 'productionCDN':'not tested', 'newPurgeIntegration':False},
 'mysqlMariaDB':{'tested':False, 'reason':'No native PHP, mysql/mariadb/mysqld, Docker/Podman or listening database service available; persistence matrix tested only on SQLite'},
 'responsiveGuard':{'realTheme':'9 measured small-link recommendations per viewport; no actual overflow in this session', 'falsePositiveFixed':'opacity-zero ancestor', 'classificationReports':['artifacts/stabilisation-'+e+'.json' for e in ['chromium','webkit','firefox']]},
 'performance':{'generalOptimization':False, 'measuredPublicSizeChangeBytes':0, 'noClaimedRuntimeSpeedup':True},
 'sourceHashes':files,
 'limits':['No production/staging session; isolated Kevin Legros theme is not a clone of L’Énergie des Runes', 'MySQL/MariaDB and provider caches/CDNs untested', 'HTML cache must be purged after saving', 'Simple-text API limit remains 4000 UTF-8 bytes; frontend counts JS string units', 'Dynamic/animated states are sampled, not exhaustively validated'],
 'deferred':['rich text','DIV text editing','components','effects','wireframe','server rendering','multi-provider cache purge']
}
(a / 'validation-0.4.1.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print('307 browser checks + 18 unit tests passed; 270 historical checks and',len(historical_tests),'test files unchanged; 191 theme hashes unchanged')
