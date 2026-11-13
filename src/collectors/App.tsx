import React,{useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {effectiveCompleted,toggleCompleted} from './progress.mjs';
import './style.css';

type ItemPage={name:string,category:string};
type Item={id:string,name:string,pages:ItemPage[],categories:string[],completion?:number};
type Rank={name:string,slots:number};
type Saved={rsn:string,syncedCompleted:string[],manualAdd:string[],manualRemove:string[],aspirational:string[],lastSyncedAt?:string};

const key='osrs-clog-planner-v1';
const tourKey='osrs-clog-planner-tour-v1';
const empty=():Saved=>({rsn:'',syncedCompleted:[],manualAdd:[],manualRemove:[],aspirational:[]});
const tourSteps=[
  {title:'Welcome to Collector\'s Planner',body:'Track your Collection Log, shortlist goals, and see how close you are to the next staff of collection rank.'},
  {title:'Sync your account',body:'Enter your RuneScape name up top and click Sync RuneProfile (RuneLite RuneProfile plugin required — open the Collection Log in-game once). That fills obtained slots automatically.'},
  {title:'Star goals for a projected rank',body:'In the list, click ★ on missing items you plan to get. Those slots feed Aspirational Slots and Projected Rank — without marking them complete.'},
  {title:'Filter and plan',body:'Open Categories & sources to filter by Bosses, Raids, Clues, Minigames, or Other — toggle a whole category, or expand and pick individual sources for a partial filter. Green / yellow / red marks show completion in that group.'},
];

function loadSaved():Saved{
  try{
    const raw=JSON.parse(localStorage.getItem(key)||'null');
    if(!raw)return empty();
    const asId=(x:unknown)=>x!=null&&/^\d+$/.test(String(x))?String(x):'';
    return{
      rsn:String(raw.rsn||''),
      syncedCompleted:(raw.syncedCompleted||[]).map(asId).filter(Boolean),
      manualAdd:(raw.manualAdd||[]).map(asId).filter(Boolean),
      manualRemove:(raw.manualRemove||[]).map(asId).filter(Boolean),
      aspirational:(raw.aspirational||[]).map(asId).filter(Boolean),
      lastSyncedAt:raw.lastSyncedAt?String(raw.lastSyncedAt):undefined,
    };
  }catch{return empty()}
}

function compClass(pct?:number){
  if(pct==null||Number.isNaN(Number(pct)))return 'na';
  const n=Number(pct);
  if(n<0.1)return 'purple';
  if(n<1)return 'red';
  if(n<10)return 'yellow';
  if(n<50)return 'green';
  return 'blue';
}
function formatComp(pct?:number){
  if(pct==null||Number.isNaN(Number(pct)))return '—';
  const n=Number(pct);
  return `${n<0.1?'<0.1':n.toFixed(1)}%`;
}
function wikiItemUrl(name:string){
  return 'https://oldschool.runescape.wiki/w/'+encodeURIComponent(name.replace(/ /g,'_'));
}
function rankFor(count:number, ranks:Rank[]){
  let cur='None';
  for(const r of ranks){if(count>=r.slots)cur=r.name; else break}
  return cur;
}
type RollPool='all'|'uncompleted'|'aspirational';
type ProgressTone='all'|'some'|'none';

/** Category → sources tree. Category is on / off / partial from selected sources. */
function CategoryPageSelect({tree,value,onChange,catStatus,pageStatus}:{
  tree:{category:string,pages:string[]}[],
  value:string[],
  onChange:(pages:string[])=>void,
  catStatus?:Record<string,ProgressTone>,
  pageStatus?:Record<string,ProgressTone>,
}){
  const [q,setQ]=useState('');
  const [openCats,setOpenCats]=useState<Record<string,boolean>>({});
  const searchRef=React.useRef<HTMLInputElement>(null);
  const selected=useMemo(()=>new Set(value),[value]);
  const n=value.length;
  const text=!n?'Categories & sources':n===1?value[0]:`Sources · ${n}`;
  const qn=q.trim().toLowerCase();
  const shown=tree.map(group=>{
    if(!qn)return group;
    if(group.category.toLowerCase().includes(qn))return group;
    return {...group,pages:group.pages.filter(p=>p.toLowerCase().includes(qn))};
  }).filter(g=>g.pages.length);

  function setPages(next:string[]){onChange([...new Set(next)].sort())}
  function togglePage(page:string){
    setPages(selected.has(page)?value.filter(x=>x!==page):[...value,page]);
  }
  function toggleCategory(pages:string[]){
    const allOn=pages.every(p=>selected.has(p));
    if(allOn)setPages(value.filter(p=>!pages.includes(p)));
    else setPages([...value.filter(p=>!pages.includes(p)),...pages]);
  }
  function isOpen(cat:string){
    if(qn)return true;
    return !!openCats[cat];
  }
  function toggleOpen(cat:string){
    setOpenCats(s=>({...s,[cat]:!s[cat]}));
  }

  return <details className="msel msel-tree" onToggle={e=>{
    const open=(e.target as HTMLDetailsElement).open;
    if(!open)setQ('');
    else queueMicrotask(()=>searchRef.current?.focus());
  }}>
    <summary>{text}</summary>
    <div className="msel-menu" onClick={e=>e.stopPropagation()}>
      <input ref={searchRef} className="msel-search" placeholder="Search categories or sources…" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.stopPropagation()}/>
      {shown.map(group=>{
        const fullPages=tree.find(t=>t.category===group.category)?.pages||group.pages;
        const onCount=fullPages.filter(p=>selected.has(p)).length;
        const catState=onCount===0?'off':onCount===fullPages.length?'on':'partial';
        const tone=catStatus?.[group.category];
        const expanded=isOpen(group.category);
        return <div key={group.category} className={'msel-group'+(expanded?' open':'')}>
          <div className={'msel-catrow '+catState}>
            <label className={'msel-cat '+catState}>
              <input type="checkbox" checked={catState==='on'} ref={el=>{if(el)el.indeterminate=catState==='partial'}}
                onChange={()=>toggleCategory(fullPages)}/>
              <i aria-hidden="true"/>
              {tone&&<b className={'msel-log '+tone} title={tone==='all'?'All complete':tone==='some'?'Partially complete':'None complete'}/>}
              <span>{group.category}</span>
              <em>{onCount?`${onCount}/${fullPages.length}`:fullPages.length}</em>
            </label>
            <button type="button" className={'msel-chev'+(expanded?' open':'')}
              aria-expanded={expanded}
              aria-label={`${expanded?'Collapse':'Expand'} ${group.category}`}
              onClick={()=>toggleOpen(group.category)}>▸</button>
          </div>
          {expanded&&group.pages.map(page=>{
            const on=selected.has(page);
            const ptone=pageStatus?.[page];
            return <label key={page} className={'msel-page'+(on?' on':'')}>
              <input type="checkbox" checked={on} onChange={()=>togglePage(page)}/>
              <i aria-hidden="true"/>
              {ptone&&<b className={'msel-log '+ptone} title={ptone==='all'?'All complete':ptone==='some'?'Partially complete':'None complete'}/>}
              <span>{page}</span>
            </label>;
          })}
        </div>;
      })}
      {!shown.some(g=>g.pages.length)&&<div className="msel-empty">No matches</div>}
      {!!n&&<button type="button" className="msel-clear" onClick={()=>onChange([])}>Clear</button>}
    </div>
  </details>;
}

type SortKey='done'|'name'|'category'|'page'|'completion'|'plan';

export default function CollectorsApp(){
  useEffect(()=>{document.title="Collector's Planner — OSRS Collection Log"},[]);
  const [items,setItems]=useState<Item[]>([]);
  const [ranks,setRanks]=useState<Rank[]>([]);
  const [saved,setSaved]=useState<Saved>(loadSaved);
  const [query,setQuery]=useState('');
  const [selPages,setSelPages]=useState<string[]>([]);
  const [showCompleted,setShowCompleted]=useState(true);
  const [aspOnly,setAspOnly]=useState(false);
  const [loading,setLoading]=useState(true);
  const [syncing,setSyncing]=useState(false);
  const [error,setError]=useState('');
  const [errorHelp,setErrorHelp]=useState('');
  const [info,setInfo]=useState('');
  const [sortKey,setSortKey]=useState<SortKey>('name');
  const [sortDir,setSortDir]=useState<'asc'|'desc'>('asc');
  const [tourStep,setTourStep]=useState(()=>{
    try{return localStorage.getItem(tourKey)?'':0}catch{return 0}
  });
  const [confirmClearAsp,setConfirmClearAsp]=useState(false);
  const [rollPool,setRollPool]=useState<RollPool>('uncompleted');
  const [rolling,setRolling]=useState(false);
  const [rollPick,setRollPick]=useState<Item|null>(null);
  const [rollView,setRollView]=useState<{prev?:Item,mid?:Item,next?:Item}>({});
  const rollTimer=React.useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(()=>{
    try{localStorage.setItem(key,JSON.stringify(saved))}catch{/* ignore */}
  },[saved]);

  async function loadCatalogue(){
    const r=await fetch('/api/collectors/tasks',{cache:import.meta.env.DEV?'no-store':'default'});
    const data=await r.json();
    if(!r.ok)throw Error(data.error||'Catalogue unavailable');
    setItems(data.items||[]);
    setRanks(data.ranks||[]);
    return data.items as Item[];
  }

  useEffect(()=>{
    loadCatalogue().then(()=>setLoading(false)).catch(e=>{setError(e.message);setLoading(false)});
  },[]);

  const completed=useMemo(
    ()=>effectiveCompleted(saved.syncedCompleted,saved.manualAdd,saved.manualRemove),
    [saved.syncedCompleted,saved.manualAdd,saved.manualRemove],
  );
  const asp=useMemo(()=>new Set(saved.aspirational),[saved.aspirational]);
  const current=completed.size;
  const planned=[...asp].filter(id=>!completed.has(id)).length;
  const currentRank=rankFor(current,ranks);
  const projectedRank=rankFor(current+planned,ranks);
  const next=ranks.find(r=>r.slots>current);
  const nextRank=next?.name;

  const {catStatus,pageStatus}=useMemo(()=>{
    const catTot:Record<string,number>={},catDone:Record<string,number>={};
    const pageTot:Record<string,number>={},pageDone:Record<string,number>={};
    for(const it of items){
      for(const c of it.categories){
        catTot[c]=(catTot[c]||0)+1;
        if(completed.has(it.id))catDone[c]=(catDone[c]||0)+1;
      }
      for(const p of it.pages){
        pageTot[p.name]=(pageTot[p.name]||0)+1;
        if(completed.has(it.id))pageDone[p.name]=(pageDone[p.name]||0)+1;
      }
    }
    const tone=(tot:number,done:number):ProgressTone=>!tot||!done?'none':done>=tot?'all':'some';
    const catStatus:Record<string,ProgressTone>={};
    const pageStatus:Record<string,ProgressTone>={};
    for(const k of Object.keys(catTot))catStatus[k]=tone(catTot[k],catDone[k]||0);
    for(const k of Object.keys(pageTot))pageStatus[k]=tone(pageTot[k],pageDone[k]||0);
    return {catStatus,pageStatus};
  },[items,completed]);

  function toggleSort(k:SortKey){
    if(sortKey===k)setSortDir(d=>d==='asc'?'desc':'asc');
    else{setSortKey(k);setSortDir(k==='completion'||k==='done'?'desc':'asc')}
  }

  const filtered=useMemo(()=>{
    const list=items.filter(it=>{
      if(selPages.length&&!it.pages.some(p=>selPages.includes(p.name)))return false;
      if(!showCompleted&&completed.has(it.id))return false;
      if(aspOnly&&!(asp.has(it.id)&&!completed.has(it.id)))return false;
      if(query){
        const q=query.toLowerCase();
        return `${it.name} ${it.pages.map(p=>p.name).join(' ')} ${it.categories.join(' ')}`.toLowerCase().includes(q);
      }
      return true;
    });
    const dir=sortDir==='asc'?1:-1;
    const cmp=(a:Item,b:Item)=>{
      const doneA=completed.has(a.id)?1:0,doneB=completed.has(b.id)?1:0;
      const aspA=asp.has(a.id)?1:0,aspB=asp.has(b.id)?1:0;
      switch(sortKey){
        case 'done':return (doneA-doneB)*dir;
        case 'completion':return ((a.completion??-1)-(b.completion??-1))*dir;
        case 'plan':return (aspA-aspB)*dir;
        case 'category':return a.categories[0].localeCompare(b.categories[0])*dir||a.name.localeCompare(b.name);
        case 'page':return (a.pages[0]?.name||'').localeCompare(b.pages[0]?.name||'')*dir||a.name.localeCompare(b.name);
        default:return a.name.localeCompare(b.name)*dir;
      }
    };
    return [...list].sort(cmp);
  },[items,selPages,showCompleted,aspOnly,query,sortKey,sortDir,completed,asp]);

  const categoryTree=useMemo(()=>{
    const order=['Bosses','Raids','Clues','Minigames','Other'];
    const byCat:Record<string,Set<string>>={};
    for(const it of items){
      for(const page of it.pages){
        (byCat[page.category]||=new Set()).add(page.name);
      }
    }
    return order.filter(c=>byCat[c]?.size).map(c=>({category:c,pages:[...byCat[c]].sort((a,b)=>a.localeCompare(b))}));
  },[items]);

  function toggleDone(id:string){
    setSaved(s=>{
      const next=toggleCompleted(id,s.syncedCompleted,s.manualAdd,s.manualRemove);
      return{...s,...next};
    });
  }
  function toggleAsp(id:string){
    setSaved(s=>({...s,aspirational:s.aspirational.includes(id)?s.aspirational.filter(x=>x!==id):[...s.aspirational,id]}));
  }
  function addAllFiltered(){
    const ids=filtered.filter(t=>!completed.has(t.id)).map(t=>t.id);
    if(!ids.length)return;
    setSaved(s=>({...s,aspirational:[...new Set([...s.aspirational,...ids])]}));
    setInfo(`Added ${ids.length} item${ids.length===1?'':'s'} to aspirational from the current filter.`);
  }
  function removeAllFiltered(){
    const ids=new Set(filtered.map(t=>t.id));
    const n=filtered.filter(t=>asp.has(t.id)).length;
    if(!n)return;
    setSaved(s=>({...s,aspirational:s.aspirational.filter(id=>!ids.has(id))}));
    setInfo(`Removed ${n} item${n===1?'':'s'} from aspirational in the current filter.`);
  }
  const addableFiltered=useMemo(
    ()=>filtered.filter(t=>!completed.has(t.id)&&!asp.has(t.id)).length,
    [filtered,completed,asp],
  );
  const removableFiltered=useMemo(
    ()=>filtered.filter(t=>asp.has(t.id)).length,
    [filtered,asp],
  );

  async function syncProfile(){
    const name=saved.rsn.trim();
    if(!name){setError('Enter a RuneScape name first');setErrorHelp('');return}
    setSyncing(true);setError('');setErrorHelp('');setInfo('');
    try{
      const q=new URLSearchParams({username:name});
      const [playerRes, catalogue]=await Promise.all([
        fetch('/api/collectors/player?'+q,{cache:'no-store'}),
        loadCatalogue(),
      ]);
      const data=await playerRes.json();
      if(!playerRes.ok){
        const msg=String(data.error||'RuneProfile lookup failed');
        if(playerRes.status===404||playerRes.status===409||data.code==='NOT_FOUND'||/no user data|account not found|no profile/i.test(msg)){
          setErrorHelp('https://www.runeprofile.com/');
        }
        throw Error(msg);
      }
      const ids=(Array.isArray(data.completedIds)?data.completedIds:[]).map((x:unknown)=>String(x));
      const known=new Set(catalogue.map(t=>t.id));
      const applied=ids.filter((id:string)=>known.has(id));
      if(ids.length&&!applied.length){
        throw Error('RuneProfile returned item ids that do not match the catalogue. Hard-refresh and sync again.');
      }
      setSaved(s=>({
        ...s,
        rsn:data.username||name,
        syncedCompleted:applied,
        manualRemove:[],
        manualAdd:s.manualAdd.filter(id=>!applied.includes(id)),
        lastSyncedAt:data.syncedAt,
        aspirational:s.aspirational.filter(id=>!applied.includes(id)),
      }));
      setInfo(`Synced ${applied.length} collection log slots from RuneProfile.`);
    }catch(e){setError(String((e as Error).message||e))}
    finally{setSyncing(false)}
  }

  function exportData(){
    const blob=new Blob([JSON.stringify({version:1,...saved},null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='osrs-clog-progress.json';a.click();URL.revokeObjectURL(a.href);
  }
  async function importData(file:File){
    try{
      const data=JSON.parse(await file.text());
      if(!Array.isArray(data.syncedCompleted)&&!Array.isArray(data.manualAdd))throw Error('Invalid planner export');
      setSaved({
        rsn:String(data.rsn||''),
        syncedCompleted:(data.syncedCompleted||[]).filter((x:unknown)=>typeof x==='string'),
        manualAdd:(data.manualAdd||[]).filter((x:unknown)=>typeof x==='string'),
        manualRemove:(data.manualRemove||[]).filter((x:unknown)=>typeof x==='string'),
        aspirational:(data.aspirational||[]).filter((x:unknown)=>typeof x==='string'),
        lastSyncedAt:data.lastSyncedAt?String(data.lastSyncedAt):undefined,
      });
      setError('');setErrorHelp('');setInfo('Import complete');
    }catch(e){setError('Could not import file: '+String(e))}
  }

  const synced=!!saved.lastSyncedAt;
  const tourActive=typeof tourStep==='number';
  const step=tourActive?tourSteps[tourStep]:null;
  const aspCount=items.filter(t=>asp.has(t.id)&&!completed.has(t.id)).length;

  function finishTour(){
    try{localStorage.setItem(tourKey,'1')}catch{/* ignore */}
    setTourStep('');
  }
  function clearAspirational(){
    setSaved(s=>({...s,aspirational:[]}));
    setConfirmClearAsp(false);
  }

  const rollPoolItems=useMemo(()=>{
    if(rollPool==='aspirational')return items.filter(t=>asp.has(t.id)&&!completed.has(t.id));
    if(rollPool==='uncompleted')return items.filter(t=>!completed.has(t.id));
    return items;
  },[items,rollPool,completed,asp]);

  function clearRoll(){
    if(rollTimer.current)clearTimeout(rollTimer.current);
    setRolling(false);setRollPick(null);setRollView({});
  }
  function startRoll(){
    const pool=rollPoolItems;
    if(!pool.length){
      setError(rollPool==='aspirational'?'Star some missing items before rolling aspirational.':'No items available in this roll pool.');
      return;
    }
    setError('');setErrorHelp('');
    if(rollTimer.current)clearTimeout(rollTimer.current);
    setRolling(true);
    const pick=pool[Math.floor(Math.random()*pool.length)];
    let ticks=0;
    const tick=()=>{
      const mid=pool[Math.floor(Math.random()*pool.length)];
      const prev=pool[Math.floor(Math.random()*pool.length)];
      const next=pool[Math.floor(Math.random()*pool.length)];
      setRollView({prev,mid,next});
      ticks++;
      if(ticks<18)rollTimer.current=setTimeout(tick,50+ticks*12);
      else{
        setRollView({
          prev:pool[Math.floor(Math.random()*pool.length)],
          mid:pick,
          next:pool[Math.floor(Math.random()*pool.length)],
        });
        setRollPick(pick);
        setRolling(false);
      }
    };
    tick();
  }

  return <div className="app">
    {tourActive&&step&&<div className="tour" role="dialog" aria-modal="true">
      <div className="tour-card">
        <div className="tour-eyebrow">TIP {Number(tourStep)+1} / {tourSteps.length}</div>
        <h2>{step.title}</h2>
        <p>{step.body}</p>
        <div className="tour-actions">
          <button type="button" className="tour-skip" onClick={finishTour}>Skip</button>
          {Number(tourStep)<tourSteps.length-1
            ?<button type="button" onClick={()=>setTourStep(Number(tourStep)+1)}>Next</button>
            :<button type="button" onClick={finishTour}>Got it</button>}
        </div>
      </div>
    </div>}
    {confirmClearAsp&&<div className="tour" role="dialog" aria-modal="true">
      <div className="tour-card warn">
        <div className="tour-eyebrow">CONFIRM</div>
        <h2>Clear all aspirational?</h2>
        <p>This removes every starred item ({aspCount||saved.aspirational.length}). Your completed RuneProfile progress is kept. Projected rank will drop back to your current slots only.</p>
        <div className="tour-actions">
          <button type="button" className="tour-skip" onClick={()=>setConfirmClearAsp(false)}>Cancel</button>
          <button type="button" className="danger" onClick={clearAspirational}>Clear all ★</button>
        </div>
      </div>
    </div>}
    <header>
      <Link className="site-home" to="/" title="All planners">← Planners</Link>
      <div className="brand"><div className="brandicon">📜</div><div><strong>COLLECTOR'S PLANNER</strong><small>COLLECTION LOG</small></div></div>
      <div className="account">
        <label>PLAYER NAME
          <input placeholder="Enter RSN" value={saved.rsn} onChange={e=>setSaved(s=>({...s,rsn:e.target.value}))}
            onKeyDown={e=>{if(e.key==='Enter')syncProfile()}}/>
        </label>
        <button type="button" onClick={syncProfile} disabled={syncing}>{syncing?'Syncing…':'↻ Sync RuneProfile'}</button>
        <span className={'tag '+(synced?'':'muted')}>{synced?`RUNEPROFILE · ${current} slots`:'LOCAL / MANUAL'}</span>
      </div>
    </header>
    <main>
      <div className="intro">
        <div>
          <div className="eyebrow">OLD SCHOOL RUNESCAPE / COLLECTION LOG</div>
          <h1>Your path to <em>Gilded.</em></h1>
          <p>OSRS Collection Log tracker and rank calculator — sync slots from RuneProfile, shortlist aspirational items, and see how far Bronze through Gilded staff ranks are.</p>
        </div>
        <div className="actions">
          <button onClick={exportData}>↓ Export progress</button>
          <label className="button">↑ Import progress
            <input type="file" accept="application/json" hidden onChange={e=>{if(e.target.files?.[0])importData(e.target.files[0]);e.target.value=''}}/>
          </label>
        </div>
      </div>

      {(error||info)&&<div className={error?'error':'info'}>
        {error||info}
        {error&&errorHelp&&<>{' '}<a href={errorHelp} target="_blank" rel="noreferrer">Get RuneProfile ↗</a></>}
      </div>}

      <div className="stats">
        <section className="stat"><span>CURRENT SLOTS</span><div className="big">{current.toLocaleString()} <small>/ {(ranks[ranks.length-1]?.slots||items.length).toLocaleString()}</small></div><div className="track"><i style={{width:`${Math.min(100,current/Math.max(1,ranks[ranks.length-1]?.slots||items.length)*100)}%`}}/></div><p>{current} unique items logged{saved.lastSyncedAt?` · synced ${new Date(saved.lastSyncedAt).toLocaleString()}`:''}</p></section>
        <section className="stat"><span>CURRENT RANK</span><div className="big gold">{currentRank}</div><p>{next===undefined?'Gilded unlocked':`${next.slots-current} slots until ${nextRank}`}</p></section>
        <section className="stat">
          <div className="stat-head">
            <span>ASPIRATIONAL SLOTS</span>
            <button type="button" className="stat-clear" disabled={!saved.aspirational.length} onClick={()=>setConfirmClearAsp(true)} title="Clear all starred goals">Clear ★</button>
          </div>
          <div className="big green">+{planned.toLocaleString()}</div>
          <p>{aspCount} planned items</p>
        </section>
        <section className="stat"><span>PROJECTED RANK</span><div className="big">{projectedRank}</div><p>{(current+planned).toLocaleString()} slots with planned items</p></section>
      </div>

      <section className="roadmap">
        <div className="sectiontitle"><h2>Staff of collection ranks</h2><span>Completed + aspirational projection</span></div>
        <div className="milestones clog-ranks">{ranks.map((r,i)=><div className="milestone" key={r.name}>
          <div className={'medal '+r.name.toLowerCase()}>{['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ'][i]}</div>
          <strong>{r.name}</strong><small>{r.slots.toLocaleString()} slots</small>
          <div className="milestonebar"><i style={{width:`${Math.min(100,current/r.slots*100)}%`}}/><b style={{left:`${Math.min(100,current/r.slots*100)}%`,width:`${Math.max(0,Math.min(100,(current+planned)/r.slots*100)-Math.min(100,current/r.slots*100))}%`}}/></div>
          <span>{current>=r.slots?'✓ Unlocked':current+planned>=r.slots?'★ Within reach':`${Math.max(0,r.slots-current-planned)} beyond plan`}</span>
        </div>)}</div>
      </section>

      <section className="browser">
        <div className="sectiontitle">
          <div><h2>Collection log browser</h2><p>RuneProfile fills obtained slots; checkboxes are manual overrides. Stars are aspirational only.</p></div>
          <span>{filtered.length} of {items.length} items</span>
        </div>
        <div className="filters">
          <input className="search" placeholder="⌕ Search items, sources, categories..." value={query} onChange={e=>setQuery(e.target.value)}/>
          <CategoryPageSelect tree={categoryTree} value={selPages} onChange={setSelPages} catStatus={catStatus} pageStatus={pageStatus}/>
          <label className={'ftog'+(showCompleted?' on':'')}>
            <input type="checkbox" checked={showCompleted} onChange={e=>setShowCompleted(e.target.checked)}/>
            <i aria-hidden="true"/>
            <span>Show obtained</span>
          </label>
          <label className={'ftog'+(aspOnly?' on':'')}>
            <input type="checkbox" checked={aspOnly} onChange={e=>setAspOnly(e.target.checked)}/>
            <i aria-hidden="true"/>
            <span>Aspirational only</span>
          </label>
        </div>
        {loading?<p>Loading the OSRS Wiki collection log catalogue…</p>:<div className="tablewrap">
          <table>
            <thead><tr>{([
              ['done','GOT'],
              ['name','ITEM'],
              ['category','CATEGORY'],
              ['page','SOURCE'],
              ['completion','COMP%'],
              ['plan','PLAN'],
            ] as [SortKey,string][]).map(([k,label])=>{
              const on=sortKey===k;
              return <th key={k} className={k==='plan'?'th-plan':undefined}>
                <div className="th-planrow">
                  <button type="button" className={'thsort'+(on?' on':'')} onClick={()=>toggleSort(k)} aria-label={`Sort by ${label}${on?`, ${sortDir}ending`:''}`}>
                    {label}<span aria-hidden="true">{on?(sortDir==='asc'?'▲':'▼'):'↕'}</span>
                  </button>
                  {k==='plan'&&<details className="plan-menu">
                    <summary title="Bulk aspirational actions for the current filter" aria-label="Plan actions">⋮</summary>
                    <div className="plan-menu-pop" role="menu">
                      <button type="button" role="menuitem" disabled={!addableFiltered} onClick={e=>{
                        (e.currentTarget.closest('details') as HTMLDetailsElement|null)?.removeAttribute('open');
                        addAllFiltered();
                      }}>Add all ★{addableFiltered?` (${addableFiltered})`:''}</button>
                      <button type="button" role="menuitem" disabled={!removableFiltered} onClick={e=>{
                        (e.currentTarget.closest('details') as HTMLDetailsElement|null)?.removeAttribute('open');
                        removeAllFiltered();
                      }}>Remove all ★{removableFiltered?` (${removableFiltered})`:''}</button>
                    </div>
                  </details>}
                </div>
              </th>;
            })}</tr></thead>
            <tbody>{filtered.map(t=><tr key={t.id} className={completed.has(t.id)?'done':''}>
              <td><input aria-label={`Obtained ${t.name}`} type="checkbox" checked={completed.has(t.id)} onChange={()=>toggleDone(t.id)}/></td>
              <td className="taskname"><strong><a href={wikiItemUrl(t.name)} target="_blank" rel="noreferrer">{t.name}</a></strong><small>{t.pages.slice(0,3).map(p=>p.name).join(' · ')}{t.pages.length>3?` · +${t.pages.length-3}`:''}</small></td>
              <td><span className="type">{t.categories.join(', ')}</span></td>
              <td>{t.pages[0]?.name||'—'}{t.pages.length>1?` +${t.pages.length-1}`:''}</td>
              <td className={'comp '+compClass(t.completion)} title="Global completion rate from the OSRS Wiki">{formatComp(t.completion)}</td>
              <td><button className={'star '+(asp.has(t.id)?'selected':'')} onClick={()=>toggleAsp(t.id)} aria-label={`Toggle aspirational ${t.name}`}>{asp.has(t.id)?'★':'☆'}</button></td>
            </tr>)}</tbody>
          </table>
          {!filtered.length&&<div className="empty">No items match your filters.</div>}
        </div>}
      </section>

      <section className="roller">
        <div className="sectiontitle">
          <div>
            <h2>Random Collection Log item</h2>
            <p>Spin for a slot to chase.</p>
          </div>
        </div>
        <div className="roller-bar">
          <div className="roller-pools" role="radiogroup" aria-label="Roll pool">
            {([
              ['all','All items'],
              ['uncompleted','Missing'],
              ['aspirational','Aspirational'],
            ] as [RollPool,string][]).map(([id,label])=>(
              <label key={id} className={'ftog'+(rollPool===id?' on':'')}>
                <input type="radio" name="roll-pool" checked={rollPool===id} disabled={rolling} onChange={()=>setRollPool(id)}/>
                <i aria-hidden="true"/>
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className={'slot'+(rolling?' spinning':'')+(rollPick&&!rolling?' landed':'')} aria-live="polite">
          <div className="slot-row faded">{rollView.prev?.name||'—'}</div>
          <div className="slot-row mid">
            <strong>{rollView.mid?.name||'Pull the lever'}</strong>
            {rollView.mid&&<small>{rollView.mid.pages[0]?.category||rollView.mid.categories[0]} · {rollView.mid.pages[0]?.name||'—'}</small>}
          </div>
          <div className="slot-row faded">{rollView.next?.name||'—'}</div>
        </div>
        <div className="roller-actions">
          {rollPick&&!rolling&&<a className="button" href={wikiItemUrl(rollPick.name)} target="_blank" rel="noreferrer">Wiki ↗</a>}
          <button type="button" onClick={startRoll} disabled={rolling||!items.length}>
            {rolling?'Rolling…':rollPick?'Re-roll':'🎰 Roll'}
          </button>
          {rollPick&&!rolling&&<button type="button" className="tour-skip" onClick={clearRoll}>Clear</button>}
        </div>
      </section>

      <footer>
        Catalogue from the OSRS Wiki Module:Collection log (stable item ids). Completions load from RuneProfile; aspirational picks stay in local storage.
        Requires the RuneProfile plugin and an in-game Collection Log sync.{' '}
        <a href="https://runelite.net/plugin-hub/show/runeprofile" target="_blank" rel="noreferrer">RuneProfile plugin ↗</a>
        {' · '}
        <a href="https://www.runeprofile.com/" target="_blank" rel="noreferrer">runeprofile.com ↗</a>
        {' · '}
        <a href="https://oldschool.runescape.wiki/w/Collection_log" target="_blank" rel="noreferrer">Wiki collection log ↗</a>
        {' · '}
        <a href="https://github.com/joshJarr/Ghommals-Planner/issues" target="_blank" rel="noreferrer">Report an issue ↗</a>
      </footer>
    </main>
  </div>;
}

