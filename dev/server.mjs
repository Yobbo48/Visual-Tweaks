import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {requireTool} from './toolchain.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
// 0.4.5 : réglages facultatifs pour comparer deux versions dans les mêmes conditions.
// VT_WP_VERSION (version de WordPress, par ex. celle de la production), VT_PLUGIN_DIR
// (dossier de l'extension, par ex. la référence 0.4.4), VT_PORT et VT_LOCAL (données).
const wp=process.env.VT_WP_VERSION||'7.1.2',port=process.env.VT_PORT||'9410';
const plugin=process.env.VT_PLUGIN_DIR?path.resolve(process.env.VT_PLUGIN_DIR):`${root}/visual-tweaks`;
const local=process.env.VT_LOCAL?path.resolve(process.env.VT_LOCAL):path.join(root,'.local');
await mkdir(path.join(local,'database'),{recursive:true});
await mkdir(path.join(local,'uploads'),{recursive:true});
const cli=path.join(path.dirname(requireTool.resolve('@wp-playground/cli')), 'cli.js');
const blueprint=port==='9410'?`${root}/dev/blueprint.json`:path.join(local,'blueprint.json');
if(port!=='9410'){const {readFile,writeFile}=await import('node:fs/promises');await writeFile(blueprint,(await readFile(`${root}/dev/blueprint.json`,'utf8')).replaceAll('127.0.0.1:9410',`127.0.0.1:${port}`));}
const child=spawn(process.execPath,[cli,'server',`--port=${port}`,`--site-url=http://127.0.0.1:${port}`,'--php=8.3',`--wp=${wp}`,'--workers=6',`--mount=${plugin}:/wordpress/wp-content/plugins/visual-tweaks`,`--mount=${root}/dev/fixture-theme:/wordpress/wp-content/themes/vt-fixture`,`--mount=${local}/uploads:/wordpress/wp-content/uploads`,`--mount-before-install=${local}/database:/wordpress/wp-content/database`,`--blueprint=${blueprint}`],{cwd:root,stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('error',error=>{console.error(error);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code ?? 0;});
