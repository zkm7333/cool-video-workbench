import {chromium} from 'playwright-core';
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});await page.goto('http://127.0.0.1:5316');
 await page.locator('.studio-rail').getByRole('button',{name:'逐句导演',exact:true}).click();
 while(await page.getByRole('button',{name:'解锁',exact:true}).count())await page.getByRole('button',{name:'解锁',exact:true}).first().click();
 await page.locator('.director-alignment summary').click();
 const alignment={provider:'test-fixture',audioSha256:crypto.createHash('sha256').update(fs.readFileSync('/private/tmp/director-test.wav')).digest('hex'),words:[{text:'看这个新工具',start:.1,end:1.7},{text:'点击按钮展示结果',start:2.1,end:3.7},{text:'效率提升50%',start:4.1,end:5.9}]};
 await page.getByRole('textbox',{name:'导演词时间 JSON'}).fill(JSON.stringify(alignment));
 await page.getByRole('button',{name:'校验词时间',exact:true}).click();
 await page.getByRole('button',{name:'更新未锁定的建议'}).waitFor({state:'visible'});
 await page.waitForFunction(()=>!document.querySelector('.director-toolbar button').disabled);
 await page.getByRole('button',{name:'更新未锁定的建议'}).click();
 await page.waitForFunction(()=>document.querySelectorAll('.timing-badge.aligned').length===3);
 assert.equal(await page.getByRole('spinbutton',{name:'第1句结束'}).inputValue(),'1.7');
 await page.getByRole('spinbutton',{name:'第1句结束'}).fill('3');
 assert.equal(await page.locator('.timing-badge.manual').count(),1);
 await page.getByRole('button',{name:'应用勾选镜头与配音到时间线'}).click();
 await page.getByRole('alert').filter({hasText:'重叠'}).waitFor();
 await page.getByRole('spinbutton',{name:'第1句结束'}).fill('1.7');
 console.log('PASS imported same-audio hash validation, aligned labels and exact boundaries, manual timing downgrade, invalid overlapping apply blocked');
}finally{await browser.close()}
