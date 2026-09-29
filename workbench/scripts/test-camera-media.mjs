import {bundle} from '@remotion/bundler';
import {getCompositions,renderStill,openBrowser} from '@remotion/renderer';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const wb=process.cwd(),out='/private/tmp/camera-qa';mkdirSync(out,{recursive:true});
const source=readFileSync('src/cards/demo-index.ts','utf8');
const entries=source.split('\n').filter(l=>l.includes('schema: [')).map(l=>({stem:l.match(/stem: "([^"]+)"/)[1],schema:JSON.parse(l.slice(l.indexOf('schema: ')+8,l.indexOf(', stem:')))})).filter(x=>x.schema.some(f=>f.key.startsWith('media_')));
if(!entries.length)throw Error('No image adapters found');
const serveUrl=await bundle({entryPoint:path.join(wb,'src/remotion/index.ts'),publicDir:path.join(out,'public'),outDir:path.join(out,'bundle'),webpackOverride:c=>({...c,resolve:{...c.resolve,symlinks:false,alias:{...c.resolve?.alias,'@proj':path.join(wb,'proj-stub'),'@demos':path.join(wb,'demosrc')}}})});
const browser=await openBrowser('chrome',{browserExecutable:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const results=[];
try{
 const compositions=await getCompositions(serveUrl,{puppeteerInstance:browser});
 for(const e of entries.filter(e=>!process.env.CAMERA_ONLY||process.env.CAMERA_ONLY.split(',').includes(e.stem))){
  const composition=compositions.find(c=>c.id==='demo-'+e.stem);
  const inputProps=Object.fromEntries(e.schema.map(f=>[f.key,f.key.startsWith('media_')?'replace.png':f.default]));
  if(e.stem==='SpotlightHeroCard')inputProps.media_hero='';
  try{
   for(const ratio of [.28,.68])await renderStill({serveUrl,composition:{...composition,props:inputProps},inputProps,frame:Math.floor((composition.durationInFrames-1)*ratio),output:path.join(out,e.stem+'-'+ratio+'.png'),puppeteerInstance:browser,scale:.5,logLevel:'error'});
   results.push({stem:e.stem,slots:e.schema.filter(f=>f.key.startsWith('media_')).length,status:'pass'});
   console.log('PASS',e.stem,results.at(-1).slots);
  }catch(error){results.push({stem:e.stem,status:'fail',error:String(error)});console.log('FAIL',e.stem,String(error));}
 }
}finally{await browser.close({silent:true});writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));}
if(results.some(r=>r.status==='fail'))process.exitCode=1;
