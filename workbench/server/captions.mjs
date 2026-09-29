import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';

export function parseCaptions(json){
 const cues=[];
 for(const s of json.transcription||[]){
  const startMs=Number(s.offsets?.from),endMs=Number(s.offsets?.to),text=String(s.text||'').trim();
  if(text&&Number.isFinite(startMs)&&Number.isFinite(endMs)&&startMs>=0&&endMs>startMs)cues.push({text,startMs,endMs,timestampMs:null,confidence:null});
 }
 return cues.sort((a,b)=>a.startMs-b.startMs);
}
const exists=async p=>{try{await fs.access(p);return true}catch{return false}};
export function createCaptions({root,data}){
 const model=path.join(data,'models','ggml-small.bin');
 const modules=path.resolve(root,'../../modules/Recordly.app/Contents/Resources/app.asar.unpacked');
 const devModules=path.resolve(root,'../../../ShotCraft Studio.app/Contents/Resources/modules/Recordly.app/Contents/Resources/app.asar.unpacked');
 const jobs=new Map();let running=null;
 const run=(cmd,args,signal,timeout=1800000)=>new Promise((resolve,reject)=>{
  const c=spawn(cmd,args,{signal,timeout});let err='';c.stdout.on('data',()=>{});c.stderr.on('data',x=>{err=(err+x).slice(-2500)});c.on('error',reject);c.on('close',code=>code===0?resolve():reject(Error(err||'字幕处理失败')));
 });
 const status=async()=>({ready:await exists(model),job:running?jobs.get(running):null});
 return {
  status,
  get(id){const job=jobs.get(id);if(!job)throw Error('字幕任务不存在');return job},
  cancel(id){if(running===id)jobs.get(id)?.controller.abort();return {ok:true}},
  async start({file,language='zh'}){
   if(running)throw Error('已有字幕任务正在处理，请等待完成或取消');
   if(typeof file!=='string'||!/^uploads\/[^/\\]+\.(mp4|mov|webm|wav|mp3|m4a|aac|ogg|flac)$/i.test(file))throw Error('请先将视频或音频导入素材库');
   if(!['zh','en','auto'].includes(language))throw Error('不支持的识别语言');
   const input=await fs.realpath(path.join(data,file)),uploads=await fs.realpath(path.join(data,'uploads'));
   if(path.dirname(input)!==uploads||!(await fs.stat(input)).isFile())throw Error('无效素材路径');
   const base=await exists(modules)?modules:devModules;
   const whisper=path.join(base,'electron/native/bin',`${process.platform}-${process.arch}`,'whisper-cli');
   const ffmpeg=path.join(base,'node_modules/ffmpeg-static/ffmpeg');
   if(!await exists(whisper)||!await exists(ffmpeg))throw Error('缺少本地字幕运行组件，请使用完整桌面版');
   const id=crypto.randomUUID(),controller=new AbortController();
   const job={id,status:'running',message:'准备音频…',captions:[]};
   Object.defineProperty(job,'controller',{value:controller});jobs.set(id,job);running=id;
   // Retain a bounded number of completed results, not unbounded transcript history.
   if(jobs.size>20)jobs.delete(jobs.keys().next().value);
   void(async()=>{
    let temp;
    try{
     await fs.mkdir(path.join(data,'caption-jobs'),{recursive:true});temp=await fs.mkdtemp(path.join(data,'caption-jobs','job-'));
     const wav=path.join(temp,'audio.wav'),output=path.join(temp,'captions');
     await run(ffmpeg,['-hide_banner','-loglevel','error','-y','-i',input,'-map','0:a:0','-vn','-ac','1','-ar','16000','-c:a','pcm_s16le',wav],controller.signal,300000);
     if(!await exists(model)){
      job.message='首次下载本地识别模型（约 466 MB），下载完成后开始识别…';
      await fs.mkdir(path.dirname(model),{recursive:true});
      await run('/usr/bin/curl',['-L','--fail','--silent','--show-error','--connect-timeout','30','--max-time','1800','--retry','2','-o',model+'.download','https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-small.bin'],controller.signal);
      const hash=crypto.createHash('sha256');for await(const chunk of createReadStream(model+'.download'))hash.update(chunk);
      if(hash.digest('hex')!=='1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b')throw Error('识别模型校验失败，请重试');
      await fs.rename(model+'.download',model);
     }
     job.message='正在本机识别语音，较长视频需要一些时间…';
     await run(whisper,['-m',model,'-f',wav,'-l',language,'-oj','-of',output,'-np','-t','4','-ml','48'],controller.signal);
     job.captions=parseCaptions(JSON.parse(await fs.readFile(output+'.json','utf8')));
     if(!job.captions.length)throw Error('没有识别到语音，请确认素材带有清晰的人声');
     job.status='done';job.message=`识别完成，共 ${job.captions.length} 句，请校对文字`;
    }catch(e){job.status='error';job.message=controller.signal.aborted?'字幕任务已取消':`无法生成字幕：${e.message}`}
    finally{if(temp)await fs.rm(temp,{recursive:true,force:true});await fs.rm(model+'.download',{force:true});running=null}
   })();
   return {id};
  },
 };
}
