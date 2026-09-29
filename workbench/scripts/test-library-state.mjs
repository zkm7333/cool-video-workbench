import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createLibraryState} from '../server/library-state.mjs';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'shotcraft-trash-test-'));
try{
 const data=path.join(tmp,'data'),root=path.join(tmp,'root');for(const p of ['data/uploads','data/projects','root/public/textures'])fs.mkdirSync(path.join(tmp,p),{recursive:true});
 const id='abcdef1234567890abcd';fs.writeFileSync(path.join(data,'projects',id+'.json'),'{}');fs.writeFileSync(path.join(data,'uploads/a.png'),'asset bytes');fs.writeFileSync(path.join(root,'public/textures/b.png'),'built-in bytes');
 let state=createLibraryState(data,root);state.remove('assets','uploads/a.png','A');state.remove('assets','textures/b.png','B');state.remove('projects',id,'作品');
 assert.equal(state.trash().length,3);assert.equal(fs.readFileSync(path.join(data,'uploads/a.png'),'utf8'),'asset bytes');assert.equal(fs.readFileSync(path.join(root,'public/textures/b.png'),'utf8'),'built-in bytes');
 state=createLibraryState(data,root);assert.equal(state.trash().length,3);state.restore('assets','uploads/a.png');state.restore('assets','textures/b.png');state.restore('projects',id);assert.equal(state.trash().length,0);
 assert.throws(()=>state.remove('assets','../projects/'+id+'.json','escape'));assert.throws(()=>state.remove('projects','../oops','escape'));assert.throws(()=>state.remove('assets','uploads/missing.png','missing'));
 state.remove('assets','uploads/a.png','A');
 assert.throws(()=>state.purge('assets','uploads/a.png',{tracks:[{file:'uploads/a.png'}]}),/工程/);
 fs.writeFileSync(path.join(data,'autosave.json'),JSON.stringify({file:'uploads/a.png'}));
 assert.throws(()=>state.purge('assets','uploads/a.png'),/工程/);
 fs.unlinkSync(path.join(data,'autosave.json'));
 fs.writeFileSync(path.join(data,'projects',id+'.json'),JSON.stringify({file:'uploads/a.png'}));
 assert.throws(()=>state.purge('assets','uploads/a.png'),/工程/);
 state.remove('projects',id,'作品');state.purge('projects',id);assert.equal(fs.existsSync(path.join(data,'projects',id+'.json')),false);
 state.purge('assets','uploads/a.png');assert.equal(fs.existsSync(path.join(data,'uploads/a.png')),false);
 assert.throws(()=>state.purge('assets','uploads/a.png'),/回收站/);
 state.remove('assets','textures/b.png','B');state.purge('assets','textures/b.png');assert.equal(state.trash().length,0);assert.equal(state.read().assets['textures/b.png'].purged,true);assert.equal(fs.existsSync(path.join(root,'public/textures/b.png')),true);
 fs.symlinkSync(path.join(root,'public/textures/b.png'),path.join(data,'uploads/link.png'));
 state.remove('assets','uploads/link.png','link');assert.throws(()=>state.purge('assets','uploads/link.png'),/路径/);
 console.log('PASS: permanent deletion, current/saved/autosave reference protection, bundled tombstones, symlink rejection');
 console.log('PASS: imported/built-in asset and project soft deletion, restart persistence, restoration, reference preservation, path validation');
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
