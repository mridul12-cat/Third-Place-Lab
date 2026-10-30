import {execFileSync} from 'node:child_process';
import {existsSync,lstatSync,readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const sensitiveNames=['QLOO_API_KEY','TURSO_AUTH_TOKEN','VERCEL_TOKEN','CLOUDFLARE_API_TOKEN'];
const secrets=new Set(sensitiveNames.map(key=>process.env[key]).filter(Boolean));
// Compare private values in memory; never echo their values, matched lines, or env files.
for(const name of readdirSync(root).filter(name=>/^\.env(?:\.|$)/.test(name)&&name!=='.env.example')){
 const file=path.join(root,name);if(!lstatSync(file).isFile())continue;
 const content=readFileSync(file,'utf8');
 for(const key of sensitiveNames){const match=content.match(new RegExp('^'+key+'\\s*=\\s*(.+)$','m'));if(match){const value=match[1].trim().replace(/^(['"])(.*)\1$/,'$2');if(value)secrets.add(value);}}
}
const source=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
function walk(relative){const dir=path.join(root,relative);if(!existsSync(dir))return [];return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(relative,e.name)):[path.join(relative,e.name)]);}
const files=[...new Set([...source,...walk('.next/server'),...walk('.next/static'),...walk('dist')])];
let found=0,envFiles=0;
for(const relative of files){
 if(/(?:^|\/)\.env(?:\.|$)/.test(relative)&&relative!=='.env.example'){envFiles++;continue;}
 const file=path.join(root,relative);if(!existsSync(file)||!lstatSync(file).isFile())continue;
 const data=readFileSync(file);if([...secrets].some(value=>data.includes(Buffer.from(value))))found++;
}
console.log(JSON.stringify({filesScanned:files.length,knownPrivateValuesCompared:secrets.size,filesWithSecretLiterals:found,unexpectedPublishedEnvironmentFiles:envFiles}));
if(found||envFiles)process.exitCode=1;
