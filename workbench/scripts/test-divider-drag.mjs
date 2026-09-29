import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 await page.goto('http://127.0.0.1:5311');
 await page.locator('.studio-rail').getByRole('button',{name:/视频剪辑/}).click();
 const divider=page.locator('.splitter.h');const before=await page.locator('.timeline-wrap').boundingBox();const box=await divider.boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y-75,{steps:8});await page.mouse.up();
 const after=await page.locator('.timeline-wrap').boundingBox();assert(after.height>before.height+60);
 const line=page.locator('.playhead');const linebox=await line.boundingBox();
 await page.mouse.move(linebox.x+5,linebox.y+40);await page.mouse.down();await page.mouse.move(linebox.x+125,linebox.y+40,{steps:8});await page.mouse.up();
 const left=await line.evaluate(e=>parseFloat(e.style.left));assert(left>=250,`playhead left ${left}`);
 const ruler=await page.locator('.ruler').boundingBox();
 await page.mouse.click(ruler.x+50,ruler.y+12);const clickLeft=await line.evaluate(e=>parseFloat(e.style.left));assert(Math.abs(clickLeft-190)<3);
 console.log(JSON.stringify({dividerBefore:before.height,dividerAfter:after.height,playheadDrag:left,rulerClick:clickLeft}));
} finally {await browser.close()}
