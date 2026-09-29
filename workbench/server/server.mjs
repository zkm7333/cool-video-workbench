import http from 'node:http';
import {createCaptions} from './captions.mjs';
import {createVoiceSettings} from './voice-settings.mjs';
import {createRecordlyBridge} from './recordly.mjs';
const voiceSettings=createVoiceSettings();
import {createLibraryState} from './library-state.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=process.env.STUDIO_DATA||path.join(os.homedir(),'Documents/Codex/ShotCraft Studio');
const port=Number(process.env.STUDIO_PORT||5296), origin=`http://127.0.0.1:${port}`;
for(const dir of ['uploads','projects','exports'])fs.mkdirSync(path.join(data,dir),{recursive:true});
const json=(res,code,obj)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj))};
const body=async(req,max=4e6)=>{let size=0,chunks=[];for await(const b of req){size+=b.length;if(size>max)throw new Error('文件太大');chunks.push(b)}return Buffer.concat(chunks)};
const read=async req=>JSON.parse((await body(req)).toString()||'{}');
const safe=(base,p)=>{const out=path.resolve(base,p);if(!out.startsWith(path.resolve(base)+path.sep))throw Error('无效路径');return out};
const clean=n=>String(n||'未命名').replace(/[^\p{L}\p{N}_. -]/gu,'_').slice(0,90);
const atomic=(file,obj)=>{fs.writeFileSync(file+'.tmp',JSON.stringify(obj,null,2));fs.renameSync(file+'.tmp',file)};
function validate(p){if(!p||typeof p.name!=='string'||!Array.isArray(p.tracks)||![p.width,p.height,p.fps].every(Number.isFinite)||p.width<16||p.height<16||p.width>7680||p.height>7680||p.fps<1||p.fps>120)throw Error('工程格式无效');for(const t of p.tracks){if(!Array.isArray(t.clips))throw Error('轨道格式无效');for(const c of t.clips){if(!c.cardId||![c.start,c.duration,c.speed,c.inOffset,c.opacity,c.scale,c.x,c.y].every(Number.isFinite)||c.start<0||c.duration<1||c.speed<=0||c.inOffset<0)throw Error('片段时间或参数无效')}}return p}
function execute(cmd,args,options={}){return new Promise((resolve,reject)=>{const c=spawn(cmd,args,{cwd:root,env:{...process.env,PATH:`/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:${process.env.PATH||''}`},...options});let out='',err='';c.stdout?.on('data',b=>out+=b);c.stderr?.on('data',b=>err+=b);c.on('error',reject);c.on('close',code=>code===0?resolve(out):reject(Error(err.slice(-2500)||`进程失败 ${code}`)))})}
const probe=async file=>{try{return JSON.parse(await execute(path.join(root,'bin/ffprobe'),['-v','quiet','-show_format','-show_streams','-of','json',file]))}catch{return null}};
function asset(file,name){const ext=path.extname(file).toLowerCase();return {file:'uploads/'+path.basename(file),name:name||path.basename(file),dir:'导入素材',kind:/\.(wav|mp3|m4a|aac|ogg|flac)$/.test(ext)?'audio':/\.(mp4|mov|webm)$/.test(ext)?'video':'image'}}
const mediaMetadataFile=path.join(data,'media-metadata.json');
let mediaMetadata={};try{mediaMetadata=JSON.parse(fs.readFileSync(mediaMetadataFile,'utf8'))}catch{}
async function measuredAsset(item){
 if(item.kind==='image')return item;
 const file=path.join(data,item.file),stat=fs.statSync(file),cached=mediaMetadata[item.file];
 if(cached?.size===stat.size&&cached?.mtimeMs===stat.mtimeMs)return {...item,...cached.info};
 const details=await probe(file);
 const duration=Number(details?.format?.duration)||Math.max(0,...(details?.streams||[]).map(stream=>Number(stream.duration)||0));
 const info=Number.isFinite(duration)&&duration>0?{duration}:{};
 mediaMetadata[item.file]={size:stat.size,mtimeMs:stat.mtimeMs,info};atomic(mediaMetadataFile,mediaMetadata);
 return {...item,...info};
}
const assets=async()=>{
 let received={};try{received=JSON.parse(fs.readFileSync(path.join(data,'recordly-imports.json'),'utf8'))}catch{}
 const metadata=new Map(Object.values(received).map(item=>[item.file,item]));
 const result=[];
 for(const n of fs.readdirSync(path.join(data,'uploads')).filter(n=>/\.(png|jpg|jpeg|webp|gif|mp4|mov|webm|wav|mp3|m4a|aac|ogg|flac)$/i.test(n))){const item=asset(n),info=metadata.get(item.file);result.push(info?{...item,...info,dir:'录屏成片'}:await measuredAsset(item))}
 return result;
};
const library=createLibraryState(data,root);
const recordly=createRecordlyBridge({root,data,execute,probe,hidden:()=>library.read().assets});
const captions=createCaptions({root,data});
const jobs=new Map();let serial=0;
const jobFile=id=>path.join(data,'exports',`.job-${id}.json`);
const saveJob=j=>{const {child,...record}=j;atomic(jobFile(j.id),record)};
for(const file of fs.readdirSync(path.join(data,'exports')).filter(f=>/^\.job-[a-z0-9]+\.json$/.test(f))){try{const j=JSON.parse(fs.readFileSync(path.join(data,'exports',file)));if(j.status==='running'){j.status='error';j.lastLine='上次导出因工作台退出而中断，请重试';saveJob(j)}jobs.set(j.id,j)}catch{}}
async function render(project){
 validate(project);
 if(!project.tracks.some(t=>!t.hidden&&t.clips.length))throw Error('时间线为空，请先添加镜头再导出');
 if([...jobs.values()].some(j=>j.status==='running'))throw Error('已有导出任务正在运行');
 const id=Date.now().toString(36)+(serial++),job={id,status:'running',progress:0,stage:'准备素材',lastLine:'准备渲染…',output:path.join(data,'exports',`${clean(project.name)}-${id}.mp4`),log:path.join(data,'exports',`${id}.log`)};
 jobs.set(id,job);saveJob(job);
 const dir=path.join(data,'exports',`.work-${id}`),pub=path.join(dir,'public'),props=path.join(dir,'props.json');fs.mkdirSync(pub,{recursive:true});atomic(props,{project,renderExact:true});
 (async()=>{try{
  await execute('/usr/bin/rsync',['-aL','--exclude=cardpreviews',path.join(root,'public/'),pub+'/']);
  await execute('/usr/bin/rsync',['-a',path.join(data,'uploads/'),path.join(pub,'uploads/')]);
  const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';if(!fs.existsSync(chrome))throw Error('未找到 Google Chrome，渲染需要本机 Chrome。');
  job.stage='编译镜头';saveJob(job);
  const args=[path.join(root,'node_modules/@remotion/cli/remotion-cli.js'),'render','src/remotion/index.ts','Main',job.output,`--props=${props}`,`--public-dir=${pub}`,`--browser-executable=${chrome}`,'--concurrency=2'];
  let output='',lastSave=0;
  await new Promise((resolve,reject)=>{const c=spawn(process.execPath,args,{cwd:root,env:process.env});job.child=c;
   const consume=b=>{const line=b.toString().replace(/\x1b\[[0-9;]*[A-Za-z]/g,'');output=(output+line).slice(-12000);fs.appendFileSync(job.log,line);job.lastLine=output;
    const m=[...output.matchAll(/Rendered (\d+)\/(\d+)/g)].pop();if(m){job.progress=Number(m[1])/Number(m[2]);job.stage='渲染画面'}if(/Encoding video/.test(line))job.stage='合成 MP4';
    if(Date.now()-lastSave>1000){lastSave=Date.now();saveJob(job)}
   };c.stdout.on('data',consume);c.stderr.on('data',consume);c.on('error',reject);c.on('close',code=>code===0?resolve():reject(Error(output||'渲染失败')))
  });
  if(!fs.existsSync(job.output)||fs.statSync(job.output).size===0)throw Error('渲染结束但没有生成有效视频文件');
  job.status='done';job.progress=1;job.stage='完成';job.lastLine='导出完成';
 }catch(e){job.status='error';job.stage='导出失败';job.lastLine=e.message;fs.appendFileSync(job.log,e.message+'\n');}
 finally{delete job.child;saveJob(job);fs.rmSync(dir,{recursive:true,force:true})}})();
 return {id};
}
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.mp4':'video/mp4','.mov':'video/quicktime','.webm':'video/webm','.mp3':'audio/mpeg','.wav':'audio/wav','.woff2':'font/woff2'};
function stream(req,res,file){if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('Not found');return}const size=fs.statSync(file).size;const headers={'Content-Type':mime[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes'};const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);if(range){const start=Number(range[1]),end=Math.min(size-1,range[2]?Number(range[2]):size-1);if(start>end){res.writeHead(416);res.end();return}res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':end-start+1});fs.createReadStream(file,{start,end}).pipe(res)}else{res.writeHead(200,{...headers,'Content-Length':size});fs.createReadStream(file).pipe(res)}}
const thumbnailDir=path.join(data,'.thumbnail-cache'),thumbnailJobs=new Map();let thumbnailQueue=Promise.resolve();
const thumbnailFfmpeg=[path.resolve(root,'../../modules/Recordly.app/Contents/Resources/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg'),path.resolve(root,'../../../ShotCraft Studio.app/Contents/Resources/modules/Recordly.app/Contents/Resources/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg')].find(fs.existsSync);
function thumbnail(file,mode='thumb'){
 if(typeof file!=='string'||!/^uploads\/[^/\\]+\.(png|jpg|jpeg|webp|gif)$/i.test(file))throw Error('无效图片素材');
 const source=path.join(data,file),stat=fs.lstatSync(source);if(!stat.isFile())throw Error('无效图片素材');
 const key=crypto.createHash('sha256').update(`${mode==='thumb'?'':mode+':'}${file}:${stat.size}:${stat.mtimeMs}`).digest('hex'),target=path.join(thumbnailDir,key+'.jpg');
 if(fs.existsSync(target))return Promise.resolve(target);
 if(thumbnailJobs.has(key))return thumbnailJobs.get(key);
 const job=thumbnailQueue.then(async()=>{
  if(fs.existsSync(target))return target;
  if(!thumbnailFfmpeg)throw Error('缺少缩略图组件');
  fs.mkdirSync(thumbnailDir,{recursive:true});const temp=path.join(thumbnailDir,key+'.partial.jpg');
  const filter=mode==='preview'?'scale=720:-1':'crop=iw:min(ih\\,1600):0:0,scale=320:-1';
  try{await execute(thumbnailFfmpeg,['-hide_banner','-loglevel','error','-i',source,'-vf',filter,'-frames:v','1','-q:v','6','-y',temp]);fs.renameSync(temp,target)}finally{fs.rmSync(temp,{force:true})}
  return target;
 }).finally(()=>thumbnailJobs.delete(key));
 thumbnailJobs.set(key,job);thumbnailQueue=job.catch(()=>{});return job;
}
const server=http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,origin),p=u.pathname;
 if(req.headers.host!==`127.0.0.1:${port}`&&req.headers.host!==`localhost:${port}`){json(res,403,{error:'不允许的主机'});return}
 if(req.method==='POST'&&req.headers.origin&&req.headers.origin!==origin&&req.headers.origin!==`http://localhost:${port}`){json(res,403,{error:'不允许的来源'});return}
 if(req.headers['sec-fetch-site']==='cross-site'){json(res,403,{error:'不允许跨站访问'});return}
 if(p==='/api/thumbnail'&&req.method==='GET'){const file=await thumbnail(u.searchParams.get('file'));res.setHeader('Cache-Control','private, max-age=3600');stream(req,res,file);return}
 if(p.startsWith('/preview/uploads/')&&req.method==='GET'){const file=await thumbnail(decodeURIComponent(p.slice('/preview/'.length)),'preview');res.setHeader('Cache-Control','private, max-age=3600');stream(req,res,file);return}
 if(p==='/api/captions/status'&&req.method==='GET'){json(res,200,await captions.status());return}
 if(p==='/api/captions/start'&&req.method==='POST'){json(res,200,await captions.start(await read(req)));return}
 if(p==='/api/captions/cancel'&&req.method==='POST'){const {id}=await read(req);json(res,200,captions.cancel(id));return}
 if(p.startsWith('/api/captions/job/')&&req.method==='GET'){json(res,200,captions.get(p.slice('/api/captions/job/'.length)));return}
 if(p==='/api/library-state'){json(res,200,library.read());return}
 if(p==='/api/trash'){json(res,200,library.trash());return}
 if(p==='/api/trash/remove'&&req.method==='POST'){const {type,id,name}=await read(req);json(res,200,library.remove(type,id,name));return}
 if(p==='/api/trash/purge'&&req.method==='POST'){const {type,id,currentProject,forceReferenced}=await read(req);json(res,200,library.purge(type,id,currentProject,forceReferenced===true));return}
 if(p==='/api/trash/restore'&&req.method==='POST'){const {type,id}=await read(req);json(res,200,library.restore(type,id));return}
 if(p==='/api/health'){json(res,200,{app:'shotcraft-desktop',version:'0.6.0',data});return}
 if(p==='/api/recordly'&&req.method==='GET'){json(res,200,await recordly.status());return}
 if(p==='/api/recordly/region/preview'&&req.method==='POST'){json(res,200,await recordly.previewRegion());return}
 if(p==='/api/recordly/region/preview/clear'&&req.method==='POST'){json(res,200,await recordly.clearPreview());return}
 if(p==='/api/recordly/region/preview-image'&&req.method==='GET'){stream(req,res,recordly.previewFile());return}
 if(p==='/api/recordly/region/stop'&&req.method==='POST'){const {id}=await read(req);json(res,200,recordly.stopRegion(id));return}
 if(p==='/api/recordly/region'&&req.method==='POST'){json(res,200,await recordly.recordRegion(await read(req)));return}
 if(p.startsWith('/api/recordly/region/')&&req.method==='GET'){json(res,200,recordly.regionStatus(p.slice('/api/recordly/region/'.length)));return}
 if(p==='/api/recordly/launch'&&req.method==='POST'){json(res,200,await recordly.launch());return}
 if(p==='/api/recordly/reveal'&&req.method==='POST'){json(res,200,await recordly.reveal());return}
 if(p==='/api/recordly/inbox'&&req.method==='GET'){json(res,200,await recordly.inbox());return}
 if(p==='/api/recordly/import'&&req.method==='POST'){const {name}=await read(req);const item=await recordly.importExport(name);library.restore('assets',item.file);json(res,200,item);return}
 if(p==='/api/recordly/register'&&req.method==='POST'){const {file,name}=await read(req);json(res,200,await recordly.register(file,name));return}
 if(p==='/api/autosave'){if(req.method==='POST'){atomic(path.join(data,'autosave.json'),validate(await read(req)));json(res,200,{ok:true})}else json(res,200,fs.existsSync(path.join(data,'autosave.json'))?JSON.parse(fs.readFileSync(path.join(data,'autosave.json'))):null);return}
 if(p==='/api/projects'){if(req.method==='POST'){const {project}=await read(req);validate(project);const id=crypto.createHash('sha256').update(project.name).digest('hex').slice(0,20);const f=path.join(data,'projects',id+'.json');if(fs.existsSync(f))fs.copyFileSync(f,f+'.previous');atomic(f,project);library.restore('projects',id);json(res,200,{id})}else json(res,200,fs.readdirSync(path.join(data,'projects')).filter(f=>/^[a-f0-9]+\.json$/.test(f)&&!library.read().projects[f.slice(0,-5)]).map(f=>{const p=JSON.parse(fs.readFileSync(path.join(data,'projects',f)));return {id:f.slice(0,-5),name:p.name,updated:fs.statSync(path.join(data,'projects',f)).mtime}}));return}
 if(/^\/api\/projects\/[a-f0-9]+$/.test(p)){json(res,200,JSON.parse(fs.readFileSync(path.join(data,'projects',p.split('/').pop()+'.json'))));return}
 if(p==='/api/backup'&&req.method==='POST'){const {project}=await read(req);validate(project);const f=path.join(data,'projects',clean(project.name)+'-'+Date.now()+'.backup.json');atomic(f,project);spawn('/usr/bin/open',['-R',f]);json(res,200,{ok:true});return}
 if(p==='/api/assets'){if(req.method==='POST'){const name=clean(u.searchParams.get('name')),ext=path.extname(name).toLowerCase();if(!/\.(png|jpg|jpeg|webp|gif|mp4|mov|webm|wav|mp3|m4a|aac|ogg|flac)$/.test(ext))throw Error('暂不支持此素材格式');const f=Date.now().toString(36)+'-'+crypto.randomBytes(3).toString('hex')+'-'+name;fs.writeFileSync(path.join(data,'uploads',f),await body(req,500*1024*1024));json(res,200,await measuredAsset(asset(f,name)))}else json(res,200,await assets());return}
 if(p==='/api/voice-settings'){if(req.method==='GET')json(res,200,voiceSettings.status());else if(req.method==='POST'){const {apiKey}=await read(req);json(res,200,voiceSettings.save(apiKey))}else json(res,405,{error:'不支持的操作'});return}
 if(p==='/api/voice'){const v=await read(req);if(!v.text?.trim()||v.text.length>5000)throw Error('文案需为 1–5000 字');const f=Date.now().toString(36)+'-voice.wav';const r=JSON.parse(await execute('/usr/bin/python3',[path.join(root,'server/voice.py'),path.join(data,'uploads',f),JSON.stringify(v)]));json(res,200,{...r,file:'uploads/'+f});return}
 if(p==='/api/alignment'){const {file,alignment}=await read(req);const f=safe(data,file);if(!file.startsWith('uploads/'))throw Error('请选择已导入音频');const hash=crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');if(hash!==alignment.audioSha256||!alignment.provider)throw Error('音频哈希不匹配或缺少对齐来源');const meta=await probe(f),duration=Number(meta?.format?.duration);const words=alignment.words||alignment.scenes?.flatMap(s=>s.words);let prev=0;if(!duration||!Array.isArray(words)||!words.length)throw Error('无有效音频时长或词时间');for(const w of words){if(!w.text||!Number.isFinite(w.start)||!Number.isFinite(w.end)||w.start<prev||w.end<=w.start||w.end>duration+.03)throw Error('词时间重叠或超出音频');prev=w.end}json(res,200,{file,words,duration,text:words.map(w=>w.text).join(''),verified:true,provider:alignment.provider,audioSha256:hash});return}
 if(p==='/api/capture'){const {url,selector,translate}=await read(req);const u=new URL(url);if(!['http:','https:'].includes(u.protocol))throw Error('请输入 http 或 https 网页');const f=Date.now().toString(36)+'-web.png';await execute(process.execPath,[path.join(root,'server/capture.mjs'),url,path.join(data,'uploads',f),selector||'',translate===true?'translate':'']);json(res,200,asset(f,u.hostname+(translate===true?' 中文翻译网页截图':' 网页截图')));return}
 if(p==='/api/exports'){json(res,200,[...jobs.values()].map(({child,...j})=>j).reverse());return}
 if(p==='/api/export'&&req.method==='POST'){const {project}=await read(req);json(res,200,await render(project));return}
 if(p.startsWith('/api/export/')){const id=p.split('/')[3],j=jobs.get(id);if(!j)throw Error('导出任务不存在');if(p.endsWith('/reveal')){if(j.status!=='done')throw Error('尚未导出');spawn('/usr/bin/open',['-R',j.output]);json(res,200,{ok:true})}else{const {child,...publicJob}=j;json(res,200,publicJob)}return}
 if(p.startsWith('/api/')){json(res,404,{error:'未知操作'});return}
 if(p.startsWith('/uploads/')){stream(req,res,safe(data,decodeURIComponent(p.slice(1))));return}
 let file=safe(path.join(root,'dist'),decodeURIComponent(p==='/'?'index.html':p.slice(1)));if(!fs.existsSync(file))file=safe(path.join(root,'public'),decodeURIComponent(p.slice(1)));stream(req,res,file);
 }catch(e){json(res,400,{error:e.message||'操作失败'})}});
server.listen(port,'127.0.0.1',()=>console.log(`ShotCraft Studio ${origin}`));
for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{for(const j of jobs.values())j.child?.kill();server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),2500)});
