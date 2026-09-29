import assert from 'node:assert/strict';
import {parseCaptions,createCaptions} from '../server/captions.mjs';
import {build} from 'esbuild';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'caption-timing-'));
try{
 const cues=parseCaptions({transcription:[{text:' first ',offsets:{from:1000,to:3000}},{text:'second',offsets:{from:3000,to:5000}},{text:'invalid',offsets:{from:5,to:3}}]});assert.equal(cues.length,2);assert.equal(cues[0].text,'first');
 await build({entryPoints:['src/captions/timing.ts'],bundle:true,platform:'node',format:'esm',outfile:path.join(tmp,'timing.mjs')});
 const {captionClips}=await import(path.join(tmp,'timing.mjs'));
 for(const fps of [24,30,60]){
  const source={start:fps*10,duration:fps*2,inOffset:fps*2,speed:2};
  const clips=captionClips(cues,source,fps,48,110);
  assert.equal(clips[0].start,10*fps);assert.equal(clips[0].duration,Math.round(.5*fps));assert.equal(clips[1].start,Math.round(10.5*fps));assert.equal(clips[1].duration,fps);
  assert.equal(captionClips(cues,{...source,inOffset:fps*8},fps,48,110).length,0);
 }
 const engine=createCaptions({root:tmp,data:tmp});
 await assert.rejects(()=>engine.start({file:'uploads/../../secrets.wav'}),/导入/);
 await assert.rejects(()=>engine.start({file:'uploads/a.wav',language:'--help'}),/语言/);
 console.log('PASS: caption parsing, trim/speed/offset mapping at 24/30/60fps, out-of-range omission, path/language validation');
}finally{await fs.rm(tmp,{recursive:true,force:true})}
