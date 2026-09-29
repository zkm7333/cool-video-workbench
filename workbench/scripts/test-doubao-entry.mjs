import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});await page.route('**/api/voice-settings',async route=>{await route.fulfill({json:route.request().method()==='POST'?{configured:true,source:'local'}:{configured:false,source:'not-set'}})});await page.goto('http://127.0.0.1:5317');
 await page.locator('.studio-rail').getByRole('button',{name:'逐句导演',exact:true}).click();
 await page.getByRole('textbox',{name:'导演文案',exact:true}).fill('这段文案要用豆包生成。');
 await page.getByRole('button',{name:'用豆包生成配音',exact:true}).click();
 assert.equal(await page.getByLabel('口播文案',{exact:true}).inputValue(),'这段文案要用豆包生成。');
 assert.equal(await page.getByLabel('豆包音色 ID',{exact:true}).inputValue(),'zh_male_liufei_uranus_bigtts');
 assert(await page.getByRole('button',{name:'用豆包生成这一段',exact:true}).isEnabled());
 assert.equal(await page.locator('.studio-rail button[aria-current=page]').textContent(),'豆包配音');
 await page.locator('.voice-api-settings summary').click();
 await page.getByRole('textbox',{name:'豆包语音 API Key'}).fill('fake-ui-test-key');
 await page.getByRole('button',{name:'保存 API Key',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.voice-api-settings input').value==='');
 assert((await page.locator('.voice-api-settings summary').textContent()).includes('已配置'));
 console.log('PASS visible Doubao navigation, director shortcut, script transfer, voice selector and generation button; no TTS API called');
}finally{await browser.close()}
