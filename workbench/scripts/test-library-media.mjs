import {bundle} from '@remotion/bundler';
import {getCompositions,renderStill,openBrowser} from '@remotion/renderer';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const wb=process.cwd(),out='/private/tmp/library-media-qa';mkdirSync(out,{recursive:true});
const source=readFileSync('src/cards/demo-index.ts','utf8');
const isSlot=f=>/^(file2?$|media_)/.test(f.key);
const entries=source.split('\n').filter(l=>l.includes('schema: [')).map(l=>({stem:l.match(/stem: "([^"]+)"/)[1],schema:JSON.parse(l.slice(l.indexOf('schema: ')+8,l.indexOf(', stem:')))}));
if(entries.length!==216)throw Error('Expected 216 templates');
const only=process.env.LIBRARY_ONLY?.split(',');
const serveUrl=await bundle({entryPoint:path.join(wb,'src/remotion/index.ts'),publicDir:'/private/tmp/camera-qa/public',outDir:path.join(out,'bundle'),webpackOverride:c=>({...c,resolve:{...c.resolve,symlinks:false,alias:{...c.resolve?.alias,'@proj':path.join(wb,'proj-stub'),'@demos':path.join(wb,'demosrc')}}})});
const browser=await openBrowser('chrome',{browserExecutable:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),results=[];
// Pixel inspection uses ffmpeg from PATH or FFMPEG_PATH.
const ffmpeg=process.env.FFMPEG_PATH||'ffmpeg';
try{
 const compositions=await getCompositions(serveUrl,{puppeteerInstance:browser});let cursor=0;
 const queue=entries.filter(e=>!only||only.includes(e.stem));
 async function worker(){while(cursor<queue.length){const e=queue[cursor++],composition=compositions.find(c=>c.id==='demo-'+e.stem),slots=e.schema.filter(isSlot);
 const props=Object.fromEntries(e.schema.map(f=>[f.key,isSlot(f)?'replace.png':f.default]));
 let peak=0,changedPixels=0,frames=[];
 try{
  for(const ratio of process.env.LIBRARY_RATIOS?process.env.LIBRARY_RATIOS.split(',').map(Number):slots.length?[.3,.7]:[.5]){
   const file=path.join(out,e.stem+'-'+ratio+'.png');
   await renderStill({serveUrl,composition:{...composition,props},inputProps:props,frame:Math.min(composition.durationInFrames-1,Math.floor(composition.durationInFrames*ratio)),output:file,puppeteerInstance:browser,scale:.35,logLevel:'error',timeoutInMilliseconds:20000});
   if(slots.length){const raw=spawnSync(ffmpeg,['-v','error','-i',file,'-vf','scale=320:180','-f','rawvideo','-pix_fmt','rgb24','-'],{maxBuffer:1e6});if(raw.status!==0)throw Error('Pixel inspection failed');let n=0;for(let k=0;k<raw.stdout.length;k+=3)if(raw.stdout[k+1]>raw.stdout[k]*1.8&&raw.stdout[k+2]>raw.stdout[k]*1.5&&raw.stdout[k+1]>60)n++;peak=Math.max(peak,n);
    if(n<30&&process.env.CHECK_BASELINE){const baseProps=Object.fromEntries(e.schema.map(f=>[f.key,f.default]));const baseFile=path.join(out,e.stem+'-baseline-'+ratio+'.png');await renderStill({serveUrl,composition:{...composition,props:baseProps},inputProps:baseProps,frame:Math.min(composition.durationInFrames-1,Math.floor(composition.durationInFrames*ratio)),output:baseFile,puppeteerInstance:browser,scale:.35,logLevel:'error',timeoutInMilliseconds:20000});const before=spawnSync(ffmpeg,['-v','error','-i',baseFile,'-vf','scale=320:180','-f','rawvideo','-pix_fmt','rgb24','-'],{maxBuffer:1e6});let changed=0;for(let k=0;k<raw.stdout.length;k+=3)if(Math.abs(raw.stdout[k]-before.stdout[k])+Math.abs(raw.stdout[k+1]-before.stdout[k+1])+Math.abs(raw.stdout[k+2]-before.stdout[k+2])>30)changed++;changedPixels=Math.max(changedPixels,changed);}
   }
   frames.push(ratio);
  }
  results.push({stem:e.stem,slots:slots.length,status:slots.length&&peak<30&&changedPixels<30?'inspect':'pass',markerPixels:peak,changedPixels,frames});
 }catch(error){results.push({stem:e.stem,slots:slots.length,status:'fail',error:String(error)})}
 console.log(results.length+'/'+queue.length,results.at(-1).status,e.stem,peak);
 writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
 }}
 await Promise.all([worker(),worker()]);
}finally{await browser.close({silent:true})}
console.log(JSON.stringify({total:results.length,passed:results.filter(r=>r.status==='pass').length,needsAttention:results.filter(r=>r.status!=='pass')},null,2));
if(results.some(r=>r.status==='fail'))process.exitCode=1;
