import {readFile,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {requireTool} from './toolchain.mjs';
const {PHP}=requireTool('@php-wasm/universal');
const {loadNodeRuntime}=requireTool('@php-wasm/node');
async function walk(dir){const files=[];for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())files.push(...await walk(file));else files.push(file);}return files;}
const files=[...await walk('visual-tweaks'),...await walk('dev/fixture-theme')];
for(const file of files.filter(f=>f.endsWith('.js'))){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(result.status)throw new Error(result.stderr);}
const sources={};for(const file of files.filter(f=>f.endsWith('.php')))sources[file]=await readFile(file,'utf8');
const php=new PHP(await loadNodeRuntime('8.3',{emscriptenOptions:{processId:process.pid}}));
const payload=Buffer.from(JSON.stringify(sources)).toString('base64');
const result=await php.run({code:`<?php $files=json_decode(base64_decode('${payload}'),true);foreach($files as $name=>$source){try{token_get_all($source,TOKEN_PARSE);}catch(ParseError $e){throw new Exception($name.': '.$e->getMessage());}}echo count($files).' fichiers PHP : syntaxe valide.';`});
console.log(result.text);php.exit();console.log('Modules JavaScript : syntaxe valide.');
