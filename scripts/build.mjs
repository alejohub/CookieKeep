import {readFile,writeFile,mkdir,readdir,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {renderIcon} from './icon.mjs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(await readFile(resolve(root,'manifest.json'),'utf8'));
if(manifest.manifest_version!==3)throw new Error('Manifest V3 requerido');
await mkdir(resolve(root,'icons'),{recursive:true});
for(const size of [16,32,48,128]) await writeFile(resolve(root,`icons/${size}.png`),renderIcon(size));
const files=[];async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,entry.name);if(entry.isDirectory())await walk(path);else files.push(path);}}await walk(resolve(root,'src'));await walk(resolve(root,'scripts'));await walk(resolve(root,'tests'));
for(const path of files.filter(p=>/\.(js|mjs)$/.test(p))){const check=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});if(check.status!==0)throw new Error(check.stderr);const source=await readFile(path,'utf8');for(const match of source.matchAll(/from\s+['"](\.[^'"]+)['"]/g))await stat(resolve(dirname(path),match[1]));}
for(const path of files.filter(p=>p.endsWith('.html'))){const source=await readFile(path,'utf8');for(const match of source.matchAll(/(?:src|href)="([^"#]+)"/g))await stat(resolve(dirname(path),match[1]));if(/<script(?![^>]*src=)/.test(source))throw new Error('Script inline incompatible con CSP');}
for(const file of [manifest.background.service_worker,manifest.action.default_popup,manifest.options_ui.page,...Object.values(manifest.icons)])await stat(resolve(root,file));
if(JSON.stringify(manifest.permissions)!==JSON.stringify(['cookies','storage','alarms']))throw new Error('Permisos inesperados');
if(JSON.stringify(manifest.optional_permissions)!==JSON.stringify(['history']))throw new Error('Permisos opcionales inesperados');
console.log(`Build correcto: ${files.length} archivos validados; iconos PNG generados. Cargar directamente ${root}`);
if(process.platform==='win32'){
  const packaged=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',resolve(root,'scripts/package.ps1')],{encoding:'utf8'});
  if(packaged.status!==0)throw new Error(packaged.stderr || 'Chromium packaging failed');
  console.log(packaged.stdout.trim());
}else{
  console.log('To generate the Chromium ZIP, run scripts/package.ps1 with PowerShell on Windows.');
}
