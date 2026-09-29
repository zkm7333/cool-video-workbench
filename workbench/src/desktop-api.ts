export async function api(path:string,body?:unknown){
 const r=await fetch('/api/'+path,body===undefined?undefined:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const d=await r.json();if(!r.ok)throw new Error(d.error||'操作失败');return d;
}
export async function upload(file:File){
 const r=await fetch('/api/assets?name='+encodeURIComponent(file.name),{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});
 const d=await r.json();if(!r.ok)throw new Error(d.error||'导入失败');return d;
}
export function notify(message:string){window.dispatchEvent(new CustomEvent('studio-notice',{detail:message}));}
