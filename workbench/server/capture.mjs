import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright-core');

const [url,file,selector,mode]=process.argv.slice(2);
const source=new URL(url);
const translatedUrl=()=>{
 if(!/^https?:$/.test(source.protocol)||!source.hostname.includes('.')||source.hostname.endsWith('.translate.goog'))throw Error('该网页地址不支持谷歌翻译预览');
 const translated=new URL(source);
 translated.protocol='https:';
 translated.hostname=source.hostname.replaceAll('-','--').replaceAll('.','-')+'.translate.goog';
 translated.searchParams.set('_x_tr_sl','auto');
 translated.searchParams.set('_x_tr_tl','zh-CN');
 translated.searchParams.set('_x_tr_hl','zh-CN');
 return translated.href;
};

let browser;
try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:2});
 if(mode==='translate'){
  try{
   const target=translatedUrl();
   let loaded=false;
   for(let attempt=0;attempt<2&&!loaded;attempt++){
    const response=await page.goto(target,{waitUntil:'domcontentloaded',timeout:30000});
    loaded=!!response&&response.status()<400&&new URL(page.url()).hostname.endsWith('.translate.goog');
    if(!loaded&&attempt===0)await page.waitForTimeout(800);
   }
   if(!loaded)throw Error('翻译页面未能正常加载');
   await page.locator('html.translated-ltr, html.translated-rtl').waitFor({timeout:20000}).catch(()=>{throw Error('页面文字尚未完成翻译')});
   await page.waitForLoadState('networkidle',{timeout:10000}).catch(()=>{});
   await page.addStyleTag({content:'#gt-nvframe,#goog-gt-tt,.goog-te-banner-frame{display:none!important}html,body{top:0!important}body{margin-top:0!important}'});
   // Full-page screenshots do not scroll the page. Visit each screen first so
   // lazy content appears and Google has time to translate newly inserted text.
   const fullHeight=await page.evaluate(()=>document.documentElement.scrollHeight);
   const step=await page.evaluate(()=>Math.max(600,Math.round(innerHeight*.8)));
   for(let top=0;top<Math.min(fullHeight,50000);top+=step){
    await page.evaluate(y=>scrollTo(0,y),top);
    await page.waitForTimeout(180);
   }
   await page.evaluate(()=>scrollTo(0,0));
   await page.waitForLoadState('networkidle',{timeout:8000}).catch(()=>{});
   await page.evaluate(()=>new Promise(resolve=>{
    let quiet;
    const finish=()=>{observer.disconnect();clearTimeout(quiet);clearTimeout(limit);resolve()};
    const observer=new MutationObserver(()=>{clearTimeout(quiet);quiet=setTimeout(finish,1500)});
    observer.observe(document.body,{subtree:true,childList:true,characterData:true});
    quiet=setTimeout(finish,1500);
    const limit=setTimeout(finish,8000);
   }));
  }catch(e){throw Error(`谷歌翻译中文预览失败：${e.message}。请检查网络，或取消勾选后加载原网页`)}
 }else{
  await page.goto(url,{waitUntil:'networkidle',timeout:30000}).catch(async e=>{if(!page.url().startsWith('http'))throw e;await page.waitForLoadState('domcontentloaded')});
 }
 await page.evaluate(()=>document.fonts.ready);
 if(selector)await page.locator(selector).first().screenshot({path:file,timeout:10000});
 else await page.screenshot({path:file,fullPage:true});
}finally{await browser?.close()}
