import {loadAssetCatalog,removeLibraryItem,thumbnailSrc,type LibraryAsset} from "../assetCatalog";
import {Icon} from "../ui/Icon";
import {hasImageSlots} from "../cards/types";
import React, { useEffect, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import type { CardDef } from "../cards/types";
import { cardFps, cardSize } from "../cards/types";
import { themedProps } from '../theme';
import { CARD_LIST } from "../cards/registry";
import { DEMO_CATEGORIES } from "../cards/demoCards";
import { MANIFEST } from "../cards/projectCards";
import { useStore } from "../store";
import { sfxUsage } from "../projectImport";
import { BGM_LIB, SFX_LIB } from "../mediaManifest";
import { PROJ_HAS_MANIFEST, PROJ_LINKED } from "../projMeta";
import { setDragPayload } from "../dnd";
import { upload, notify } from "../desktop-api";
import { ThemePanel } from './ThemePanel';

const TABS = [
  { id: "media", label: "素材" },
  { id: "cards", label: "动效库" },
  { id: "sfx", label: "音效" },
  { id: "themes", label: "主题" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/** 不进动效库的分类：成片单元只在素材 tab；媒体走素材 / 音效 tab；预设幕底卡不进素材库
 *  （已有工程里的幕底 clip 仍由注册表渲染） */
const NON_MOTION_CATS = new Set(["成片单元", "音频", "素材", "背景"]);

/** 进入视口才挂载重内容（预览视频 / 实时 Player） */
const useVisible = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([en]) => setVisible(en.isIntersecting), {
      rootMargin: "100px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, visible };
};

/** 进入视口才加载并循环播放的预览视频 */
export const LazyLoopVideo: React.FC<{ src: string }> = ({ src }) => {
  const ref = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([en]) => setVisible(en.isIntersecting), {
      rootMargin: "100px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (visible) setLoaded(true);
  }, [visible]);
  useEffect(() => {
    const el = ref.current;
    if (!el || !loaded) return;
    if (visible) el.play().catch(() => {});
    else el.pause();
  }, [visible, loaded]);
  return (
    <video
      ref={ref}
      className="lib-thumb"
      src={loaded ? src : undefined}
      muted
      loop
      playsInline
      autoPlay
      preload="none"
    />
  );
};

/** 没有预渲染视频的卡：可见时用实时 Player 当缩略图——**静止在 45% 处的定妆帧**，鼠标悬停才循环播放。
 *  曾经默认自动循环：十几个 1080p 场景同时跑、闪白转场卡每 0.3s 白一次、字卡每 1.8s 淡出重来，
 *  首屏像在闪光灯下；大图反复解码还刷出一串 EncodingError。 */
export const LazyCardLoop: React.FC<{ card: CardDef }> = ({ card }) => {
  const themeId = useStore(s => s.project.themeId);
  const themeColors = useStore(s => s.project.themeColors);
  const { ref, visible } = useVisible();
  const { width, height } = cardSize(card);
  const player = useRef<PlayerRef>(null);
  const [hover, setHover] = useState(false);
  const total = Math.max(2, card.durationInFrames);
  const poster = Math.min(total - 1, Math.round(total * 0.45));
  // .lib-thumb 本身 pointer-events:none（让拖拽落到 .lib-cell 上），悬停监听挂到所属 cell
  useEffect(() => {
    const cell = ref.current?.closest(".lib-cell");
    if (!cell) return;
    const on = () => setHover(true);
    const off = () => setHover(false);
    cell.addEventListener("pointerenter", on);
    cell.addEventListener("pointerleave", off);
    return () => {
      cell.removeEventListener("pointerenter", on);
      cell.removeEventListener("pointerleave", off);
    };
  }, [ref]);
  useEffect(() => {
    const p = player.current;
    if (!p) return;
    if (hover) {
      p.seekTo(0);
      p.play();
    } else {
      p.pause();
      p.seekTo(poster);
    }
  }, [hover, poster, visible]);
  return (
    <div ref={ref} className="lib-thumb" style={{ position: "relative" }}>
      {visible && (
        <Player
          ref={player}
          component={card.component}
          inputProps={themedProps(MANIFEST, card, themeId, {}, themeColors)}
          durationInFrames={total}
          compositionWidth={width}
          compositionHeight={height}
          fps={cardFps(card)}
          initialFrame={poster}
          loop
          controls={false}
          initiallyMuted
          numberOfSharedAudioTags={0}
          style={{ width: "100%", height: "100%", pointerEvents: "none" }}
          acknowledgeRemotionLicense
        />
      )}
    </div>
  );
};

const groupBy = <T,>(items: T[], key: (t: T) => string) => {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const g = m.get(k);
    if (g) g.push(it);
    else m.set(k, [it]);
  }
  return [...m.entries()];
};

export const LibraryPanel = React.memo(function LibraryPanel({gallery=false,initialTab,onNavigate}:{gallery?:boolean;initialTab?:TabId;onNavigate?:(id:string)=>void}) {
  const [category,setCategory]=useState('全部');
  const [favoritesOnly,setFavoritesOnly]=useState(false);
  const [favorites,setFavorites]=useState<string[]>(()=>{try{return JSON.parse(localStorage.getItem('studio-favorite-cards')||'[]')}catch{return []}});
  const toggleFavorite=(id:string)=>setFavorites(old=>{const next=old.includes(id)?old.filter(x=>x!==id):[...old,id];localStorage.setItem('studio-favorite-cards',JSON.stringify(next));return next});
  const setPreview = useStore((s) => s.setPreview);
  const [query,setQuery]=useState('');
  const [editableOnly,setEditableOnly]=useState(false);
  const [assets,setAssets]=useState<LibraryAsset[]>([]);
  const [busy,setBusy]=useState(false);
  const [hiddenAssets,setHiddenAssets]=useState<Set<string>>(new Set());
  const uploadRef=useRef<HTMLInputElement>(null);
  const refreshAssets=()=>loadAssetCatalog().then(c=>{setAssets(c.assets);setHiddenAssets(c.hidden)});
  useEffect(()=>{void refreshAssets().catch(e=>notify(String(e)));const refresh=()=>void refreshAssets().catch(e=>notify(String(e)));window.addEventListener('assets-changed',refresh);return()=>window.removeEventListener('assets-changed',refresh)},[]);
  const deleteAsset=async(file:string,name:string)=>{try{await removeLibraryItem('assets',file,name);const current=useStore.getState().previewItem;if(current?.kind==='card'&&current.props?.file===file)setPreview(null);notify('素材已移入回收站，已有镜头仍可使用')}catch(e){notify(String(e))}};
  const importFiles=async(files:FileList|null)=>{if(!files)return;setBusy(true);try{for(const f of Array.from(files))await upload(f);await refreshAssets();notify('素材已导入，点击预览或拖到时间线');}catch(e){notify(String(e))}finally{setBusy(false)}};
  const [tab, setTab] = useState<TabId>(initialTab||(PROJ_LINKED ? "media" : "cards"));
  // 折叠分组默认收起，点击标题展开
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());
  const toggleCat = (cat: string) =>
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });

  /** 网格单元通用外壳：点击=中屏预览，拖拽=上轨 */
  const Cell: React.FC<{
    name: string;
    meta?: string;
    title?: string;
    onClick: () => void;
    payload: Parameters<typeof setDragPayload>[1];
    children: React.ReactNode;
    onRemove?:()=>void;
  }> = ({ name, meta, title, onClick, payload, children,onRemove }) => (
    <div
      className="lib-cell" aria-label={`预览 ${name}`}
      role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onClick()}}}
      draggable
      onDragStart={(e) => setDragPayload(e, payload)}
      onClick={onClick}
      title={`${name}${title ? `\n${title}` : ""}\n点击预览，拖到时间轨添加`}
    >
      <div className="lib-visual">{children}{onRemove&&<button className="asset-delete" aria-label={"删除素材 "+name} title="移入回收站" onKeyDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onRemove()}}><Icon name="trash" size={16}/></button>}<span className="thumb-play"><Icon name="play" size={18}/></span></div>
      <div className="lib-cell-name">{name}</div>
      {meta && <div className="lib-cell-meta dim">{meta}</div>}
    </div>
  );

  /** 动效卡网格单元 */
  const CardCell: React.FC<{ card: CardDef }> = ({ card }) => (
    <Cell
      name={card.name.split(" · ")[0]}
      meta={`${(card.durationInFrames / cardFps(card)).toFixed(1)}s${hasImageSlots(card) ? " · 可换图/网页" : " · 文字/图形"}`}
      title={card.summary}
      onClick={() => setPreview({ kind: "card", cardId: card.id })}
      payload={{ cardId: card.id, label: card.name }}
    >
      {card.preview ? <LazyLoopVideo src={`/${card.preview}`} /> : <LazyCardLoop card={card} />}
      {gallery&&<><span className="card-duration">{(card.durationInFrames/cardFps(card)).toFixed(1)}s</span><button className={'favorite-button'+(favorites.includes(card.id)?' active':'')} aria-label={(favorites.includes(card.id)?'取消收藏 ':'收藏 ')+card.name} aria-pressed={favorites.includes(card.id)} onKeyDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();toggleFavorite(card.id)}}><Icon name="star" size={17}/></button></>}
    </Cell>
  );

  /** 音效等无画面素材的列表行 */
  const Row: React.FC<{
    dot: string;
    name: string;
    meta?: string;
    onClick: () => void;
    payload: Parameters<typeof setDragPayload>[1];
    onRemove?:()=>void;
  }> = ({ dot, name, meta, onClick, payload,onRemove }) => (
    <div
      className="lib-card"
      draggable
      onDragStart={(e) => setDragPayload(e, payload)}
      onClick={onClick}
      title={`${name} · 点击预览，拖到时间轨添加`}
    >
      <span className="lib-dot" style={{ background: dot }} />
      <span className="lib-name">{name}</span>
      {meta && <span className="lib-dur">{meta}</span>}{onRemove&&<button className="icon-button" aria-label={"删除素材 "+name} onClick={e=>{e.stopPropagation();onRemove()}}><Icon name="trash" size={14}/></button>}
    </div>
  );

  /** 可折叠分组标题 */
  const Group: React.FC<{ id: string; label: string; count: number; children: React.ReactNode; defaultOpen?: boolean }> =
    ({ id, label, count, children, defaultOpen }) => {
      const open = defaultOpen ? !openCats.has(id) : openCats.has(id);
      return (
        <div>
          <button className="lib-cat-toggle" onClick={() => toggleCat(id)}>
            <span className={`caret${open ? " open" : ""}`}>▸</span>
            {label}
            <span className="dim" style={{ marginLeft: "auto" }}>{count}</span>
          </button>
          {open && children}
        </div>
      );
    };

  const motionCards = CARD_LIST.filter((c) => !NON_MOTION_CATS.has(c.category) && (!gallery||category==='全部'||c.category===category) && (!favoritesOnly||favorites.includes(c.id)) && (!editableOnly||hasImageSlots(c)) && `${c.name} ${c.summary||""} ${c.category}`.toLowerCase().includes(query.toLowerCase()));
  const projectCards = CARD_LIST.filter((c) => c.category === "成片单元");
  const usage = sfxUsage(MANIFEST);
  const projectAudio = assets.filter((m) => m.kind === "audio");
  const projectVisual = assets.filter((m) => m.kind !== "audio");

  // 动效库：工作台原生卡靳前，然后按画廊分类
  const motionGroups = ["可编辑镜头", "工作台", ...DEMO_CATEGORIES]
    .map((cat) => ({ cat, cards: motionCards.filter((c) => c.category === cat) }))
    .filter((g) => g.cards.length > 0);

  const audioPayload = (file: string, label: string, volume: number, duration: number) =>
    ({ cardId: "audio-clip", props: { file, volume }, label, duration }) as const;

  const featuredIds=['demo:SpotlightHeroCard','demo:Fracture','demo:CursorFlyover'];
  const featuredTitles=['让网页的主角，站到前面','一张图片，也能有出场方式','跟随光标，看清每个重点'];
  const featuredCaptions=['聚光主角卡 · 页面与主角独立替换','碎片聚合飞散 · 真实图片切片','四角巡览指点 · 网页聚焦运镜'];
  const priorities=['demo:SpotlightHeroCard','demo:Fracture','demo:CursorFlyover','demo:Carousel3D','demo:CubeNavigation','demo:CardStack','demo:ExplodedView','demo:SlowPushIn','demo:OrbitRingTitleOpen','demo:GridFlashMosaic','demo:NeonFrameForerun','demo:QuadSplitParallelScenes'];
  const visibleCards=[...motionCards].sort((a,b)=>{const ai=priorities.indexOf(a.id),bi=priorities.indexOf(b.id);return (ai<0?999:ai)-(bi<0?999:bi)});
  const headings={cards:['发现好镜头','从一个喜欢的镜头，开始你的视频。'],media:['我的素材','图片、网页截图、视频，集中在这里管理。'],sfx:['音乐与音效','为画面找到合适的声音。'],themes:['画面主题','统一视频的色彩与文字风格。']};
  return (
    <div className={'library'+(gallery?' library-gallery':'')}>
      {gallery&&<div className="gallery-heading"><div><h1>{headings[tab][0]}</h1><p>{headings[tab][1]}</p></div>{tab==='cards'&&<label className="gallery-search"><Icon name="search"/><input aria-label="搜索镜头模板" placeholder="搜索镜头、运镜、转场效果…" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button aria-label="清除搜索" onClick={()=>setQuery('')}><Icon name="close" size={16}/></button>}</label>}{tab==='media'&&<button className="btn primary" onClick={()=>onNavigate?.('capture')}><Icon name="globe" size={17}/>从网站获取素材</button>}</div>}
      {gallery&&tab==='cards'&&!query&&!favoritesOnly&&category==='全部'&&<div className="gallery-intro"><div className="featured-grid">{featuredIds.map((id,i)=>{const card=CARD_LIST.find(c=>c.id===id);return card&&<button className={'featured-card featured-'+i+' lib-cell'} key={id} onClick={()=>setPreview({kind:'card',cardId:id})}><LazyCardLoop card={card}/><div className="featured-copy"><span>{['网页聚焦','图片动效','空间运镜'][i]}</span><h2>{featuredTitles[i]}</h2><p>{featuredCaptions[i]}</p></div><span className="featured-arrow"><Icon name="arrow" size={18}/></span></button>})}</div><div className="quick-tools">{[['edit','film','视频剪辑','自由组合镜头与时间线'],['voice','mic','文案配音','选音色，让画面跟随口播'],['capture','globe','网页采集','把真实页面变成视频素材'],['assets','image','我的素材','导入图片、视频和音频']].map(([id,icon,title,desc])=><button key={id} onClick={()=>onNavigate?.(id)}><span className="quick-icon"><Icon name={icon}/></span><span><b>{title}</b><small>{desc}</small></span><Icon name="arrow" size={16}/></button>)}</div></div>}
      {!gallery&&<>
      <div className="lib-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`lib-tab${tab === t.id ? " on" : ""}`}
            aria-pressed={tab === t.id}
            onClick={() => {
              setTab(t.id);
              if (t.id === 'themes') setPreview(null);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="library-tools"><input aria-label="搜索镜头模板" placeholder="搜索镜头、场景、效果…" value={query} onChange={e=>setQuery(e.target.value)}/><label><input type="checkbox" checked={editableOnly} onChange={e=>setEditableOnly(e.target.checked)}/> 仅可换图镜头</label></div>
      </>}
      {gallery&&tab==='cards'&&<div className="gallery-filters"><div className="gallery-view-tabs"><button className={!favoritesOnly?'on':''} onClick={()=>setFavoritesOnly(false)}>全部镜头 <small>{CARD_LIST.filter(c=>!NON_MOTION_CATS.has(c.category)).length}</small></button><button className={favoritesOnly?'on':''} onClick={()=>setFavoritesOnly(true)}><Icon name="star" size={16}/>我的收藏 <small>{favorites.length}</small></button><label className="image-only-toggle"><input type="checkbox" checked={editableOnly} onChange={e=>setEditableOnly(e.target.checked)}/>仅可换图 / 网页</label></div><div className="category-chips" aria-label="镜头分类">{['全部','可编辑镜头',...DEMO_CATEGORIES].map(cat=><button key={cat} className={category===cat?'on':''} aria-pressed={category===cat} onClick={()=>setCategory(cat)}>{cat==='可编辑镜头'?'基础镜头':cat}</button>)}</div></div>}
      <div className="library-list">
        {tab === 'themes' && <ThemePanel />}
        {tab === "media" && (
          <>
            <button className="btn wide" disabled={busy} onClick={()=>uploadRef.current?.click()}>{busy?'正在导入…':'＋ 导入图片 / 视频 / 音频'}</button>
            <input ref={uploadRef} type="file" multiple accept="image/*,video/*,audio/*" hidden onChange={e=>{importFiles(e.target.files);e.target.value=''}}/>
            <p className="panel-help">素材保存在本机。点击查看，或在剪辑页拖到时间线。</p>
            {!projectVisual.length&&<div className="empty-state"><Icon name="image" size={36}/><h3>给镜头准备一些素材</h3><p>导入本地图片与视频，或从网站截取真实页面。</p><button className="btn" onClick={()=>uploadRef.current?.click()}>导入素材</button></div>}


            {projectCards.length > 0 && (
              <>
                <div className="lib-cat">成片单元（可再加一份）</div>
                <div className="lib-grid">
                  {projectCards.map((card) => (
                    <Cell
                      key={card.id}
                      name={card.name}
                      meta={`${(card.durationInFrames / cardFps(card)).toFixed(1)}s${hasImageSlots(card) ? " · 可换图/网页" : " · 文字/图形"}`}
                      onClick={() => setPreview({ kind: "card", cardId: card.id })}
                      payload={{ cardId: card.id, label: card.name }}
                    >
                      <LazyCardLoop card={card} />
                    </Cell>
                  ))}
                </div>
              </>
            )}

            {projectVisual.length > 0 && <div className="lib-cat">图片与视频</div>}
            {groupBy(projectVisual, (m) => m.dir || "/").map(([dir, items]) => (
              <Group key={dir} id={`media:${dir}`} label={dir} count={items.length} defaultOpen={items.length <= 12}>
                <div className="lib-grid">
                  {items.map((m) => (
                    <Cell
                      key={m.file}
                      name={m.name}
                      onRemove={()=>void deleteAsset(m.file,m.name)}
                      meta={m.kind === "video" ? `视频${m.duration?` · ${m.duration.toFixed(1)} 秒`:''}` : "图片"}
                      onClick={() => setPreview({ kind: "card", cardId: m.kind === "video" ? "video-clip" : "image-clip", props: {file:m.file},duration:m.duration?Math.max(2,Math.round(m.duration*30)):undefined })}
                      payload={
                        m.kind === "video"
                          ? { cardId: "video-clip", props: { file: m.file }, label: m.name, duration: m.duration?Math.max(2,Math.round(m.duration*30)):150 }
                          : { cardId: "image-clip", props: { file: m.file }, label: m.name, duration: 90 }
                      }
                    >
                      {m.kind === "video" ? (
                        <LazyLoopVideo src={`/${m.file}`} />
                      ) : (
                        <img className="lib-thumb" alt={m.name} loading="lazy" src={thumbnailSrc(m.file)} />
                      )}
                    </Cell>
                  ))}
                </div>
              </Group>
            ))}
          </>
        )}

        {tab === "cards" && gallery && <><div className="gallery-result-line"><span>{query?`“${query}” 的搜索结果`:category==='全部'?'为你挑选，随时替换成自己的内容':category}</span><span>{visibleCards.length} 个镜头</span></div>{visibleCards.length?<div className="lib-grid">{visibleCards.map(card=><CardCell key={card.id} card={card}/>)}</div>:<div className="empty-state"><Icon name="search" size={32}/><h3>{favoritesOnly?'这里还没有符合条件的收藏':'没有找到这个镜头'}</h3><p>试试“聚焦”“网页”或“飞散”，也可以查看全部镜头。</p><button className="btn" onClick={()=>{setQuery('');setCategory('全部');setEditableOnly(false);setFavoritesOnly(false)}}>查看全部镜头</button></div>}</>}
        {tab === "cards" && !gallery &&
          motionGroups.map((g) => (
            <Group key={g.cat} id={`cat:${g.cat}`} label={g.cat} count={g.cards.length} defaultOpen={g.cat === "可编辑镜头" || !!query}>
              <div className="lib-grid">
                {g.cards.map((card) => (
                  <CardCell key={card.id} card={card} />
                ))}
              </div>
            </Group>
          ))}

        {tab === "sfx" && (
          <>
            {projectAudio.length > 0 && (
              <Group id="sfx:proj" label="本片音频" count={projectAudio.length} defaultOpen>
                {projectAudio.map((m) => (
                  <Row
                    key={m.file}
                    dot="#ff9f0a"
                    name={m.name}
                    onRemove={()=>void deleteAsset(m.file,m.name)}
                    meta={usage.has(m.file) ? `片中×${usage.get(m.file)}` : "未用"}
                    onClick={() => setPreview({ kind: "card", cardId: "audio-clip", props: {file:m.file},duration:m.duration?Math.max(2,Math.round(m.duration*30)):undefined })}
                    payload={audioPayload(m.file, m.name.replace(/\.[^.]+$/, ""), 0.4, m.duration?Math.max(2,Math.round(m.duration*30)):90)}
                  />
                ))}
              </Group>
            )}
            {BGM_LIB.some(b=>!hiddenAssets.has(b.file)) && (
              <Group id="sfx:bgm" label="背景音乐" count={BGM_LIB.filter(b=>!hiddenAssets.has(b.file)).length}>
                {BGM_LIB.filter(b=>!hiddenAssets.has(b.file)).map((b) => (
                  <Row
                    key={b.file}
                    dot="#bf5af2"
                    name={b.name}
                    onRemove={()=>void deleteAsset(b.file,b.name)}
                    onClick={() => setPreview({ kind: "card", cardId: "audio-clip", props: {file:b.file} })}
                    payload={audioPayload(b.file, b.name, 0.35, 900)}
                  />
                ))}
              </Group>
            )}
            {groupBy(SFX_LIB.filter(s=>!hiddenAssets.has(s.file)), (s) => s.cat).map(([cat, items]) => (
              <Group key={cat} id={`sfx:${cat}`} label={`音效库 · ${cat}`} count={items.length}>
                {items.map((s) => (
                  <Row
                    key={s.file}
                    dot="#ff9f0a"
                    name={s.name}
                    onRemove={()=>void deleteAsset(s.file,s.name)}
                    onClick={() => setPreview({ kind: "card", cardId: "audio-clip", props: {file:s.file} })}
                    payload={audioPayload(s.file, s.name, 0.4, 90)}
                  />
                ))}
              </Group>
            ))}
          </>
        )}
      </div>

      <div className="lib-foot dim">
        {tab === 'themes' ? '切换主题可撤销 · 随工程自动保存' : <>
        动效 {motionCards.length} 卡（{motionCards.filter(hasImageSlots).length} 张可换图）
        · 音效库 {SFX_LIB.length}
        {PROJ_LINKED && PROJ_HAS_MANIFEST ? ` · 成片单元 ${projectCards.length}` : ""}
        <br />
        点击预览 · 拖拽到时间轨添加
        </>}
      </div>
    </div>
  );
});
