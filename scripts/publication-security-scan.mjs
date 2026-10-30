import {execFileSync,spawnSync} from 'node:child_process';
import {existsSync,lstatSync,readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const project=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2);
const option=name=>{const index=args.indexOf(name);return index<0?undefined:args[index+1];};
const tree=path.resolve(option('--tree')??project),history=path.resolve(option('--history')??project);
const names=['QLOO_API_KEY','TURSO_AUTH_TOKEN','GITHUB_TOKEN','GH_TOKEN','VERCEL_TOKEN','CLOUDFLARE_API_TOKEN'];
const privateValues=new Set(names.map(key=>process.env[key]).filter(Boolean));
const forbidden=/(?:^|\/)(?:node_modules|\.git|\.next|dist|\.wrangler|\.sites-runtime|\.agents|\.codex|outputs|work|coverage|test-results|playwright-report)(?:\/|$)|(?:^|\/)\.DS_Store$|\.tsbuildinfo$/;
const patterns=[
 ['private-key',/-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/],
 ['github-token',/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{40,})\b/],
 ['aws-access-key',/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
 ['google-api-key',/\bAIza[0-9A-Za-z_-]{35}\b/],
 ['jwt',/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/],
 ['live-service-token',/\b(?:sk_live_|sk-proj-|sk-svcacct-)[A-Za-z0-9_-]{20,}\b/],
];
function git(cwd,...parameters){return execFileSync('git',['-C',cwd,...parameters],{maxBuffer:128*1024*1024,stdio:['pipe','pipe','pipe']});}
function readPrivateEnvironment(){
 for(const file of readdirSync(project).filter(name=>/^\.env(?:\.|$)/.test(name)&&name!=='.env.example')){
  const absolute=path.join(project,file);if(!lstatSync(absolute).isFile())continue;
  const content=readFileSync(absolute,'utf8');
  for(const key of names){const match=content.match(new RegExp('^'+key+'\\s*=\\s*(.+)$','m'));if(match){const value=match[1].trim().replace(/^(['"])(.*)\1$/,'$2');if(value)privateValues.add(value);}}
 }
 if(args.includes('--github-helper')){
  const result=spawnSync('git',['credential','fill'],{cwd:project,input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',timeout:10000,env:{...process.env,GIT_TERMINAL_PROMPT:'0'},stdio:['pipe','pipe','pipe']});
  const token=(result.stdout??'').split('\n').find(line=>line.startsWith('password='))?.slice(9);if(token)privateValues.add(token);
 }
}
function findings(data,label){
 const hits=[];for(const value of privateValues)if(data.includes(Buffer.from(value))){hits.push('known-private-value');break;}
 const text=data.toString('utf8');for(const [name,pattern]of patterns)if(pattern.test(text))hits.push(name);
 const assignments=/(?:api[_-]?key|auth[_-]?token|password|client[_-]?secret)\s*[:=]\s*['"]([^\s'"\r\n]{20,})['"]/gi;
 for(const match of text.matchAll(assignments)){
  if(/(?:^|\/)tests\//.test(label)&&/^(?:synthetic[-_]|test[-_]|fixture[-_])/.test(match[1]))continue;
  if(/^(?:<|\$\{)/.test(match[1]))continue;
  hits.push('opaque-credential-assignment');break;
 }
 return [...new Set(hits)];
}
function walk(directory,prefix=''){
 return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
  if(entry.name==='.git')return [];
  const name=path.join(prefix,entry.name),absolute=path.join(directory,entry.name);
  if(entry.isSymbolicLink())throw new Error('Symlinks are not publication sources.');
  return entry.isDirectory()?walk(absolute,name):[name];
 });
}
try{
 readPrivateEnvironment();
 let files;
 if(existsSync(path.join(tree,'.git')))files=git(tree,'ls-files','--cached','--others','--exclude-standard','-z').toString().split('\0').filter(Boolean);
 else files=walk(tree);
 const violations=[];
 for(const file of files){
  if(forbidden.test(file)||(/(?:^|\/)\.env(?:\.|$)/.test(file)&&file!=='.env.example'))violations.push({file,kind:['forbidden-artifact']});
  const absolute=path.join(tree,file);if(lstatSync(absolute).isSymbolicLink())throw new Error('Symlinks are not publication sources.');
  const hits=findings(readFileSync(absolute),file);if(hits.length)violations.push({file,kind:hits});
 }
 const manifest=path.join(tree,'.openai/hosting.json');
 if(existsSync(manifest)&&JSON.parse(readFileSync(manifest,'utf8')).project_id)violations.push({file:'.openai/hosting.json',kind:['managed-deployment-identity']});
 const labels=new Map(git(history,'rev-list','--objects','--all','--reflog').toString().trim().split('\n').map(line=>[line.slice(0,40),line.slice(41)]));
 const objects=git(history,'cat-file','--batch-all-objects','--batch-check=%(objectname) %(objecttype)').toString().trim().split('\n').filter(Boolean);
 let historyObjects=0,commits=0;
 for(const item of objects){
  const [sha,type]=item.split(' ');if(!['blob','commit','tag'].includes(type))continue;
  historyObjects++;if(type==='commit')commits++;
  const hits=findings(git(history,'cat-file',type,sha),labels.get(sha)??'<unreachable-object>');
  if(hits.length)violations.push({object:sha,kind:hits});
 }
 console.log(JSON.stringify({sourceFilesScanned:files.length,gitObjectsScanned:historyObjects,gitCommitsScanned:commits,knownPrivateValuesCompared:privateValues.size,findings:violations},null,2));
 if(violations.length)process.exitCode=1;
}catch{
 console.error('Publication security scan could not complete. Refusing publication; no sensitive error details printed.');process.exitCode=1;
}
