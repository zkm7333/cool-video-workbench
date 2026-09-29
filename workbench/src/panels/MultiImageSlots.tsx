import React, {useEffect, useState} from 'react';
import type {PropField} from '../cards/types';
import {loadAssetCatalog, thumbnailSrc} from '../assetCatalog';
import {upload} from '../desktop-api';
import type {MediaItem} from '../mediaManifest';
import {Modal} from '../ui/Modal';

export const imageSlots = (fields: PropField[]) => fields.filter(f => f.key === 'file' || f.key === 'file2' || f.key.startsWith('media_'));

export const MultiImageSlots: React.FC<{fields: PropField[]; values: Record<string, unknown>; onApply: (changes: Record<string, string>) => void}> = ({fields, values, onApply}) => {
  const slots = imageSlots(fields);
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<MediaItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    let active = true;
    loadAssetCatalog().then(result => {if (active) setAssets(result.assets.filter(a => a.kind === 'image'));}).catch(e => {if (active) setError(String(e));});
    return () => {active = false;};
  }, [open]);
  if (slots.length < 2) return null;
  const apply = (files: string[]) => {
    if (!files.length) return;
    onApply(Object.fromEntries(slots.slice(0, files.length).map((slot, i) => [slot.key, files[i]])));
    setOpen(false);
    setSelected([]);
  };
  const importFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true); setError('');
    try {
      const files: string[] = [];
      for (const file of Array.from(list).slice(0, slots.length)) {
        if (!file.type.startsWith('image/')) continue;
        const asset = await upload(file);
        files.push(asset.file);
      }
      if (files.length) {window.dispatchEvent(new Event('assets-changed')); apply(files);}
      else setError('请选择图片文件。');
    } catch (e) {setError(String(e));} finally {setBusy(false);}
  };
  return <div className="multi-image-slots">
    <div className="multi-image-head"><b>图片位 · {slots.length} 张</b><button type="button" className="btn" onClick={() => {setSelected([]);setError('');setOpen(true);}}>批量添加图片</button></div>
    <div className="multi-image-grid">{slots.map((slot, i) => <div className="multi-image-slot" key={slot.key} title={slot.label}>{values[slot.key] ? <img src={thumbnailSrc(String(values[slot.key]))} alt={slot.label}/> : <span>{i + 1}</span>}<small>{slot.label}</small></div>)}</div>
    {open && <Modal label="批量添加图片" className="asset-library-dialog" onClose={() => setOpen(false)}><div className="dialog-heading"><div><b>批量添加图片</b><span>按点击顺序填入前 {slots.length} 个图片位</span></div><button className="btn" onClick={() => apply(selected)} disabled={!selected.length}>应用 {selected.length} 张</button></div>
      <div className="multi-image-actions"><label className="btn">从电脑选择多张<input hidden type="file" accept="image/*" multiple onChange={e => {void importFiles(e.target.files);e.target.value='';}}/></label><span>{busy ? '正在导入…' : `已选择 ${selected.length} / ${slots.length} 张`}</span></div>
      {error && <p role="alert" className="asset-picker-error">{error}</p>}
      <div className="asset-library-grid">{assets.map(asset => {const index = selected.indexOf(asset.file);return <button type="button" key={asset.file} className={index >= 0 ? 'selected' : ''} onClick={() => setSelected(old => old.includes(asset.file) ? old.filter(x => x !== asset.file) : old.length < slots.length ? [...old, asset.file] : old)}><img loading="lazy" src={thumbnailSrc(asset.file)} alt=""/><b>{asset.name}</b><small>{index >= 0 ? `第 ${index + 1} 张` : asset.dir || '工程素材'}</small></button>;})}</div>
    </Modal>}
  </div>;
};
