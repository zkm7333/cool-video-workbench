import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

export function createVoiceSettings(directory=path.join(os.homedir(),'.config','skill-video-agent'),environment=process.env){
 const file=path.join(directory,'doubao.key');
 const check=(target,mode)=>{if(!fs.existsSync(target)&&!fs.lstatSync(target,{throwIfNoEntry:false}))return;const stat=fs.lstatSync(target);if(stat.isSymbolicLink()||stat.uid!==process.getuid()||(stat.mode&0o777)!==mode)throw Error('豆包凭证目录或文件权限不符合要求，请检查本机私有凭证目录');if(mode===0o700&&!stat.isDirectory()||mode===0o600&&!stat.isFile())throw Error('豆包凭证路径类型不正确')};
 const status=()=>{check(directory,0o700);check(file,0o600);const local=fs.existsSync(file)&&fs.statSync(file).size>0;return {configured:Boolean(environment.DOUBAO_TTS_API_KEY?.trim()||local),source:environment.DOUBAO_TTS_API_KEY?.trim()?'environment':local?'local':'not-set'}};
 return {status,save(value){
  if(typeof value!=='string'||value.trim().length<8||value.length>1024||/[\r\n\0]/.test(value))throw Error('请输入有效的单行 API Key');
  fs.mkdirSync(directory,{recursive:true,mode:0o700});check(directory,0o700);check(file,0o600);
  const temp=path.join(directory,'.doubao-'+crypto.randomBytes(8).toString('hex'));
  try{fs.writeFileSync(temp,value.trim(),{mode:0o600,flag:'wx'});fs.renameSync(temp,file)}finally{if(fs.existsSync(temp))fs.unlinkSync(temp)}
  return status();
 }};
}
