import { execFileSync } from 'node:child_process';
import { readFileSync,writeFileSync,mkdirSync,copyFileSync,lstatSync,existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Export a fresh source tree, never the managed checkout's Git history or credentials.
const root=fileURLToPath(new URL('../',import.meta.url));
const destination=path.resolve(process.argv[2]??'/tmp/third-place-lab-public-source');
if(destination===root||destination.startsWith(root+path.sep)||existsSync(destination))throw new Error('Choose a new destination outside the checkout. Nothing was overwritten.');
const directories=new Set(['app','components','data','db','drizzle','lib','public','scripts','tests','types','build','.github','docs','hooks','vendor']);
const rootFiles=new Set(['.gitignore','.env.example','LICENSE','README.md','SECURITY.md','package.json','package-lock.json','cloudflare-env.d.ts','components.json','next.config.ts','eslint.config.mjs','tsconfig.json','playwright.config.ts','postcss.config.mjs','drizzle.config.ts','vite.config.ts','vitest.config.ts']);
const candidates=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const files=[...new Set(candidates)].filter(file=>rootFiles.has(file)||directories.has(file.split('/')[0]));
// Compare in memory only; never print the credential, matched content, or environment file.
const localEnv=existsSync(path.join(root,'.env.local'))?readFileSync(path.join(root,'.env.local'),'utf8'):'';
const names=['QLOO_API_KEY','TURSO_AUTH_TOKEN','VERCEL_TOKEN','CLOUDFLARE_API_TOKEN'];
const privateValues=names.flatMap(key=>{const local=localEnv.match(new RegExp('^'+key+'\\s*=\\s*(.+)$','m'))?.[1]?.trim().replace(/^(['"])(.*)\1$/,'$2');return [local,process.env[key]].filter(Boolean);});
for(const file of files){
 const absolute=path.join(root,file);if(lstatSync(absolute).isSymbolicLink())throw new Error(`Symlink excluded from publication: ${file}`);
 const content=readFileSync(absolute);
 if(privateValues.some(value=>content.includes(Buffer.from(value))))throw new Error(`Credential detected; publication stopped: ${file}`);
 if(/(?:^|\/)\.env(?:\.|$)/.test(file)&&file!=='.env.example')throw new Error('Environment file excluded from publication.');
}
mkdirSync(destination,{recursive:true});
for(const file of files){mkdirSync(path.dirname(path.join(destination,file)),{recursive:true});copyFileSync(path.join(root,file),path.join(destination,file));}
mkdirSync(path.join(destination,'.openai'),{recursive:true});
writeFileSync(path.join(destination,'.openai/hosting.json'),JSON.stringify({d1:'DB',r2:null},null,2)+'\n');
console.log(`Prepared ${files.length+1} source files at ${destination}. No Git history, deployment identity, runtime state, or local environment was copied. No remote repository was created.`);
