import {createElement} from "react";
import type { CardDef } from "./types";
import { DEMO_MODULES } from "./demo-index";
import { DEMO_CATEGORIES, DEMO_META } from "./demoMeta";

/** Source-derived, instance-local editable content fields. */
export const DEMO_CARDS: CardDef[] = DEMO_MODULES.map((m) => {
  const meta = DEMO_META[m.stem];
  const original = m.stem === "Fracture" ? (props: Record<string, unknown>) => createElement(m.component,{...props, content_0:5}) : m.component;
  return {
    id: `demo:${m.stem}`,
    name: meta?.name ?? m.stem,
    category: meta?.category ?? "动效库",
    durationInFrames: Math.max(2, Math.round(m.duration)),
    component: (props) => {
      const title = String(props.studioTitle || '');
      const subtitle = String(props.studioSubtitle || '');
      const position = String(props.studioTextPosition || 'bottom');
      const align = position === 'top' ? 'flex-start' : position === 'center' ? 'center' : 'flex-end';
      return createElement('div', {style:{position:'relative',width:'100%',height:'100%'}},
        createElement(original, props),
        (title || subtitle) && createElement('div', {style:{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:align,padding:'90px 120px',boxSizing:'border-box',pointerEvents:'none',zIndex:50,textAlign:'center',fontFamily:'system-ui,sans-serif',color:'#fff',textShadow:'0 2px 16px rgba(0,0,0,.9),0 2px 3px rgba(0,0,0,.8)'}},
          title && createElement('div',{style:{fontSize:Math.max(24,Number(props.studioTitleSize)||76),fontWeight:800,lineHeight:1.15,whiteSpace:'pre-wrap'}},title),
          subtitle && createElement('div',{style:{fontSize:Math.max(18,Number(props.studioSubtitleSize)||38),fontWeight:600,lineHeight:1.3,marginTop:title?18:0,whiteSpace:'pre-wrap'}},subtitle))
      );
    },
    schema: [
      ...(m.stem === "Fracture" ? m.schema.filter(f=>f.label!=="N").map(f=>({...f,label:f.label==="ACCENT_HUE"?"强调色色相":f.default==="REASSEMBLE"?"中央文字":f.label})) : m.schema),
      {type:'text',key:'studioTitle',label:'画面标题',default:''},
      {type:'text',key:'studioSubtitle',label:'画面副标题',default:''},
      {type:'select',key:'studioTextPosition',label:'文字位置',default:'bottom',options:[{value:'top',label:'顶部'},{value:'center',label:'居中'},{value:'bottom',label:'底部'}]},
      {type:'number',key:'studioTitleSize',label:'标题字号',default:76,min:24,max:180,step:1},
      {type:'number',key:'studioSubtitleSize',label:'副标题字号',default:38,min:18,max:100,step:1},
    ],
    accent: "#c58a2a",
    preview: meta?.preview ? `cardpreviews/${meta.preview}` : undefined,
    summary: meta?.summary,
  };
});

export { DEMO_CATEGORIES };
