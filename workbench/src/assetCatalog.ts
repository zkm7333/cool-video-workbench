import {api} from './desktop-api';
import {MEDIA_ITEMS,type MediaItem} from './mediaManifest';
export type LibraryAsset=MediaItem&{duration?:number;width?:number;height?:number};
type Catalog={assets:LibraryAsset[];hidden:Set<string>};
let catalog:Promise<Catalog>|null=null;
export function loadAssetCatalog(){
 if(!catalog)catalog=Promise.all([api('assets'),api('library-state')]).then(([imports,state])=>{
  const hidden=new Set<string>(Object.keys(state.assets||{}));
  return {assets:[...new Map<string,LibraryAsset>([...MEDIA_ITEMS,...imports].map(a=>[a.file,a])).values()].filter(a=>!hidden.has(a.file)),hidden};
 }).catch(e=>{catalog=null;throw e});
 return catalog;
}
if(typeof window!=='undefined')window.addEventListener('assets-changed',()=>{catalog=null});
export const thumbnailSrc=(file:string)=>file.startsWith('uploads/')?'/api/thumbnail?file='+encodeURIComponent(file):'/'+file;
export const previewImageFile=(file:string)=>/^uploads\/[^/]+\.(png|jpg|jpeg|webp|gif)$/i.test(file)?'preview/'+file:file;
export async function removeLibraryItem(type:'assets'|'projects',id:string,name:string){
 await api('trash/remove',{type,id,name});libraryChanged();
}
export function libraryChanged(){window.dispatchEvent(new Event('assets-changed'));window.dispatchEvent(new Event('projects-changed'));}
