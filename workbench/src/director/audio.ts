export async function analyzeAudio(file:string){
 const response=await fetch('/'+file);if(!response.ok)throw Error('音频文件读取失败');
 const context=new AudioContext();
 try {
  const buffer=await context.decodeAudioData(await response.arrayBuffer());
  const samples=buffer.getChannelData(0),step=Math.max(1,Math.floor(buffer.sampleRate*.05));
  const energies:number[]=[];
  for(let i=0;i<samples.length;i+=step){let sum=0;const end=Math.min(samples.length,i+step);for(let j=i;j<end;j++)sum+=samples[j]*samples[j];energies.push(Math.sqrt(sum/(end-i)))}
  const max=energies.reduce((m,v)=>Math.max(m,v),0),threshold=Math.max(.004,max*.06),pauses:number[]=[];
  let quiet=-1;for(let i=0;i<=energies.length;i++){if(i<energies.length&&energies[i]<threshold){if(quiet<0)quiet=i}else if(quiet>=0){if((i-quiet)*.05>=.2&&quiet>0&&i<energies.length)pauses.push((quiet+i)*.025);quiet=-1}}
  const peaks=Array.from({length:160},(_,i)=>{const a=Math.floor(i*energies.length/160),b=Math.max(a+1,Math.floor((i+1)*energies.length/160));return energies.slice(a,b).reduce((m,v)=>Math.max(m,v),0)/Math.max(.001,max)});
  return {duration:buffer.duration,pauses,peaks};
 } finally {await context.close()}
}
