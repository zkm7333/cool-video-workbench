import {createVoiceSettings} from '../server/voice-settings.mjs';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'voice-settings-test-'));
try{
 const dir=path.join(temp,'private'),settings=createVoiceSettings(dir,{});
 assert.equal(settings.status().configured,false);
 const result=settings.save('test-only-placeholder-key');assert.deepEqual(result,{configured:true,source:'local'});assert(!JSON.stringify(result).includes('placeholder'));
 assert.equal(fs.statSync(dir).mode&0o777,0o700);assert.equal(fs.statSync(path.join(dir,'doubao.key')).mode&0o777,0o600);
 settings.save('replacement-test-key');assert.equal(fs.readFileSync(path.join(dir,'doubao.key'),'utf8'),'replacement-test-key');
 assert.throws(()=>settings.save('short'));assert.throws(()=>settings.save('new\nline-test-key'));
 fs.chmodSync(path.join(dir,'doubao.key'),0o644);assert.throws(()=>settings.save('reject-permissions-key'));
 console.log('PASS private permissions, replacement, no key in response, invalid input and unsafe permissions rejected');
}finally{fs.rmSync(temp,{recursive:true,force:true})}
