import React,{useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
export const Modal:React.FC<{label:string;className?:string;onClose:()=>void;children:React.ReactNode}>=({label,className='',onClose,children})=>{
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const el=ref.current!;el.showModal();return()=>el.close()},[]);
 return createPortal(<dialog ref={ref} aria-label={label} className={'studio-dialog '+className} onCancel={e=>{e.preventDefault();e.stopPropagation();onClose()}} onClick={e=>{if(e.target===ref.current){const r=ref.current.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose()}}}>{children}</dialog>,document.body);
};
