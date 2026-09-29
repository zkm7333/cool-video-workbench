import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.goto('http://127.0.0.1:5313');
 await page.locator('.studio-rail').getByRole('button',{name:/视频剪辑/}).click();
 const clips=page.locator('.clip');
 const state=()=>clips.evaluateAll(es=>es.map(e=>({id:e.dataset.clipId,start:parseFloat(e.style.left),width:parseFloat(e.style.width)})));
 const initial=await state();const last=clips.nth(2);const first=clips.nth(0);
 let a=await last.boundingBox(),b=await first.boundingBox();
 await page.mouse.move(a.x+50,a.y+20);await page.mouse.down();await page.mouse.move(b.x+35,b.y+20,{steps:12});
 assert.deepEqual(await state(),initial,'Dragging must not mutate project');
 assert.equal(await page.locator('.clip-insert-marker').count(),1);
 await page.mouse.up();
 const reordered=await state();
 assert.equal(reordered[2].start,0);assert.equal(reordered[0].start,initial[2].width);
 await page.getByRole('button',{name:'撤销',exact:true}).click();assert.deepEqual(await state(),initial);
 // Drag a first clip after the last one, then cancel; no project or undo entry changes.
 a=await first.boundingBox();b=await last.boundingBox();
 await page.mouse.move(a.x+40,a.y+20);await page.mouse.down();await page.mouse.move(b.x+b.width-30,b.y+20,{steps:10});await page.keyboard.press('Escape');await page.mouse.up();
 assert.deepEqual(await state(),initial);assert.equal(await page.locator('.clip-insert-marker').count(),0);
 // Complete the same move and verify the first clip goes to the tail without overlaps.
 a=await first.boundingBox();b=await last.boundingBox();
 await page.mouse.move(a.x+40,a.y+20);await page.mouse.down();await page.mouse.move(b.x+b.width-30,b.y+20,{steps:10});await page.mouse.up();
 const tail=await state();assert.equal(tail[0].start,initial[1].width+initial[2].width);
 const sorted=[...tail].sort((a,b)=>a.start-b.start);for(let i=1;i<sorted.length;i++)assert.equal(sorted[i].start,sorted[i-1].start+sorted[i-1].width);
 console.log(JSON.stringify({lastToFirst:reordered,firstToLast:tail,stableDuringDrag:true,undo:true,escapeCancel:true}));
} finally {await browser.close()}
