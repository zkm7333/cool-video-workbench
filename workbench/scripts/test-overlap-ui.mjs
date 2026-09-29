import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.goto('http://127.0.0.1:5312');
 await page.locator('.studio-rail').getByRole('button',{name:/视频剪辑/}).click();
 const clips=page.locator('.clip');
 const intervals=()=>clips.evaluateAll(es=>es.map(e=>({start:parseFloat(e.style.left),end:parseFloat(e.style.left)+parseFloat(e.style.width)})).sort((a,b)=>a.start-b.start));
 const check=async()=>{const rows=await intervals();for(let i=1;i<rows.length;i++)assert(rows[i].start>=rows[i-1].end,JSON.stringify(rows));return rows};
 await clips.first().click({position:{x:40,y:20}});
 await page.getByRole('button',{name:'⧉ 复制',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('.clip').length===4);
 const duplicate=await check();
 let box=await clips.nth(1).boundingBox();
 await page.mouse.move(box.x+35,box.y+20);await page.mouse.down();await page.mouse.move(box.x-165,box.y+20,{steps:10});await page.mouse.up();
 const move=await check();
 box=await clips.first().locator('.trim-r').boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+20);await page.mouse.down();await page.mouse.move(box.x+700,box.y+20,{steps:10});await page.mouse.up();
 const trim=await check();
 await page.getByRole('button',{name:'撤销',exact:true}).click();
 await check();
 console.log(JSON.stringify({duplicate,move,trim,undo:'passed'}));
} finally {await browser.close()}
