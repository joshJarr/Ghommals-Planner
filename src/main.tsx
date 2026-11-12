import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {effectiveCompleted,toggleCompleted} from './progress.mjs';
import './style.css';

type Task={id:string,name:string,boss:string,description:string,type:string,tier:string,points:number,completion?:number};
type Saved={rsn:string,profile:string,wikiSyncCompleted:string[],manualAdd:string[],manualRemove:string[],aspirational:string[],lastSyncedAt?:string};

const tiers=['Easy','Medium','Hard','Elite','Master','Grandmaster'];
const thresholds=[41,169,436,1100,1965,2697];
const statusOpts=['Completed','Uncompleted','Aspirational'];
const key='osrs-ca-planner-v2';
const empty=():Saved=>({rsn:'',profile:'STANDARD',wikiSyncCompleted:[],manualAdd:[],manualRemove:[],aspirational:[]});

function loadSaved():Saved{
  try{
    const raw=JSON.parse(localStorage.getItem(key)||localStorage.getItem('osrs-ca-planner-v1')||'null');
    if(!raw)return empty();
    if(Array.isArray(raw.wikiSyncCompleted)){
      const asId=(x:unknown)=>x!=null&&/^\d+$/.test(String(x))?String(x):'';
      return{
        rsn:String(raw.rsn||''),
        profile:'STANDARD',
        wikiSyncCompleted:raw.wikiSyncCompleted.map(asId).filter(Boolean),
        manualAdd:(raw.manualAdd||[]).map(asId).filter(Boolean),
        manualRemove:(raw.manualRemove||[]).map(asId).filter(Boolean),
        aspirational:(raw.aspirational||[]).map(asId).filter(Boolean),
        lastSyncedAt:raw.lastSyncedAt?String(raw.lastSyncedAt):undefined,
      };
    }
    const nums=(raw.completed||[]).filter((x:unknown)=>typeof x==='string'&&/^\d+$/.test(x as string));
    return{...empty(),rsn:String(raw.rsn||''),manualAdd:nums,aspirational:(raw.aspirational||[]).filter((x:unknown)=>typeof x==='string'&&/^\d+$/.test(x as string))};
  }catch{return empty()}
}

function MultiSelect({label,options,value,onChange,searchable}:{label:string,options:string[],value:string[],onChange:(v:string[])=>void,searchable?:boolean}){
  const [q,setQ]=useState('');
  const searchRef=React.useRef<HTMLInputElement>(null);
  const text=!value.length?label:value.length===1?value[0]:`${label} · ${value.length}`;
  const shown=searchable&&q?options.filter(o=>o.toLowerCase().includes(q.toLowerCase())):options;
  return <details className="msel" onToggle={e=>{
    const open=(e.target as HTMLDetailsElement).open;
    if(!open)setQ('');
    else if(searchable)queueMicrotask(()=>searchRef.current?.focus());
  }}>
    <summary>{text}</summary>
    <div className="msel-menu" onClick={e=>e.stopPropagation()}>
      {searchable&&<input ref={searchRef} className="msel-search" placeholder={`Search ${label.toLowerCase()}…`} value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.stopPropagation()}/>}
      {shown.map(opt=>{
        const on=value.includes(opt);
        return <label key={opt} className={on?'on':''}>
          <input type="checkbox" checked={on} onChange={()=>onChange(on?value.filter(x=>x!==opt):[...value,opt])}/>
          <i aria-hidden="true"/>
          <span>{opt}</span>
        </label>;
      })}
      {!shown.length&&<div className="msel-empty">No matches</div>}
      {!!value.length&&<button type="button" className="msel-clear" onClick={()=>onChange([])}>Clear</button>}
    </div>
  </details>;
}

function App(){
  const [tasks,setTasks]=useState<Task[]>([]);
  const [saved,setSaved]=useState<Saved>(loadSaved);
  const [query,setQuery]=useState('');
  const [selTiers,setSelTiers]=useState<string[]>([]);
  const [selBosses,setSelBosses]=useState<string[]>([]);
  const [selTypes,setSelTypes]=useState<string[]>([]);
  const [selStatus,setSelStatus]=useState<string[]>([]);
  const [loading,setLoading]=useState(true);
  const [syncing,setSyncing]=useState(false);
  const [error,setError]=useState('');
  const [info,setInfo]=useState('');
  const [sort,setSort]=useState('tier');

  useEffect(()=>{localStorage.setItem(key,JSON.stringify(saved))},[saved]);
  async function loadTasks(){
    // Allow CDN cache in production (Vercel s-maxage); bypass locally so deploys stay fresh
    const r=await fetch('/api/tasks',{cache:import.meta.env.DEV?'no-store':'default'});
    if(!r.ok)throw Error('Catalogue unavailable');
    const d=await r.json();
    const list=(d.tasks||[]).map((t:Task)=>({...t,id:String(t.id)}));
    setTasks(list);
    return list as Task[];
  }

  useEffect(()=>{
    loadTasks().then(()=>setLoading(false)).catch(e=>{setError(e.message);setLoading(false)});
  },[]);

  // Close other multi-selects when one opens
  useEffect(()=>{
    function onToggle(e:Event){
      const t=e.target as HTMLDetailsElement;
      if(!t.classList?.contains('msel')||!t.open)return;
      document.querySelectorAll('details.msel[open]').forEach(d=>{if(d!==t)(d as HTMLDetailsElement).open=false});
    }
    document.addEventListener('toggle',onToggle,true);
    return ()=>document.removeEventListener('toggle',onToggle,true);
  },[]);

  const completed=useMemo(
    ()=>effectiveCompleted(saved.wikiSyncCompleted,saved.manualAdd,saved.manualRemove),
    [saved.wikiSyncCompleted,saved.manualAdd,saved.manualRemove],
  );
  const asp=useMemo(()=>new Set(saved.aspirational),[saved.aspirational]);

  const completedCount=tasks.reduce((n,t)=>n+(completed.has(t.id)?1:0),0);
  const current=tasks.reduce((n,t)=>n+(completed.has(t.id)?t.points:0),0);
  const planned=tasks.reduce((n,t)=>n+(!completed.has(t.id)&&asp.has(t.id)?t.points:0),0);
  const achieved=[...thresholds].reverse().findIndex(x=>current>=x);
  const currentTier=achieved<0?'None':tiers[5-achieved];
  const projected=[...thresholds].reverse().findIndex(x=>current+planned>=x);
  const projectedTier=projected<0?'None':tiers[5-projected];
  const next=thresholds.find(x=>x>current);
  const nextTier=next===undefined?'Grandmaster':tiers[thresholds.indexOf(next)];

  const filtered=useMemo(()=>tasks
    .filter(t=>{
      if(selTiers.length&&!selTiers.includes(t.tier))return false;
      if(selBosses.length&&!selBosses.includes(t.boss))return false;
      if(selTypes.length&&!selTypes.includes(t.type))return false;
      if(selStatus.length){
        const hit=selStatus.some(s=>
          (s==='Completed'&&completed.has(t.id))
          ||(s==='Uncompleted'&&!completed.has(t.id))
          ||(s==='Aspirational'&&asp.has(t.id)&&!completed.has(t.id)));
        if(!hit)return false;
      }
      return `${t.name} ${t.boss} ${t.description}`.toLowerCase().includes(query.toLowerCase());
    })
    .sort((a,b)=>sort==='completion'?(b.completion??-1)-(a.completion??-1)
      :sort==='boss'?a.boss.localeCompare(b.boss)
      :tiers.indexOf(a.tier)-tiers.indexOf(b.tier)||a.boss.localeCompare(b.boss)),
  [tasks,selTiers,selBosses,selTypes,selStatus,query,sort,completed,asp]);

  function toggleDone(id:string){
    setSaved(s=>{
      const next=toggleCompleted(id,s.wikiSyncCompleted,s.manualAdd,s.manualRemove);
      return{...s,...next};
    });
  }
  function toggleAsp(id:string){
    setSaved(s=>({...s,aspirational:s.aspirational.includes(id)?s.aspirational.filter(x=>x!==id):[...s.aspirational,id]}));
  }

  async function syncWiki(){
    const name=saved.rsn.trim();
    if(!name){setError('Enter a RuneScape name first');return}
    setSyncing(true);setError('');setInfo('');
    try{
      const q=new URLSearchParams({username:name,profile:'STANDARD'});
      const [playerRes, catalogue]=await Promise.all([
        fetch('/api/player?'+q,{cache:'no-store'}),
        loadTasks(),
      ]);
      const data=await playerRes.json();
      if(!playerRes.ok)throw Error(data.error||'WikiSync lookup failed');
      const ids=(Array.isArray(data.completedIds)?data.completedIds:[]).map((x:unknown)=>String(x));
      const known=new Set(catalogue.map(t=>t.id));
      const applied=ids.filter((id:string)=>known.has(id));
      if(ids.length&&!applied.length){
        throw Error('WikiSync returned CA ids that do not match the task catalogue. Hard-refresh the page and sync again.');
      }
      setSaved(s=>({
        ...s,
        rsn:data.username||name,
        profile:'STANDARD',
        wikiSyncCompleted:applied,
        manualRemove:[],
        manualAdd:s.manualAdd.filter(id=>!applied.includes(id)),
        lastSyncedAt:data.syncedAt,
        aspirational:s.aspirational.filter(id=>!applied.includes(id)),
      }));
      const points=catalogue.reduce((n,t)=>n+(applied.includes(t.id)?t.points:0),0);
      setInfo(`Synced ${applied.length} completed CAs (${points.toLocaleString()} pts) from WikiSync.`);
    }catch(e){setError(String((e as Error).message||e))}
    finally{setSyncing(false)}
  }

  function exportData(){
    const blob=new Blob([JSON.stringify({version:2,...saved},null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='osrs-ca-progress.json';a.click();URL.revokeObjectURL(a.href);
  }
  async function importData(file:File){
    try{
      const data=JSON.parse(await file.text());
      if(Array.isArray(data.wikiSyncCompleted)){
        setSaved({
          rsn:String(data.rsn||''),
          profile:'STANDARD',
          wikiSyncCompleted:data.wikiSyncCompleted.filter((x:unknown)=>typeof x==='string'),
          manualAdd:(data.manualAdd||[]).filter((x:unknown)=>typeof x==='string'),
          manualRemove:(data.manualRemove||[]).filter((x:unknown)=>typeof x==='string'),
          aspirational:(data.aspirational||[]).filter((x:unknown)=>typeof x==='string'),
          lastSyncedAt:data.lastSyncedAt?String(data.lastSyncedAt):undefined,
        });
      }else if(Array.isArray(data.completed)&&Array.isArray(data.aspirational)){
        const nums=data.completed.filter((x:unknown)=>typeof x==='string'&&/^\d+$/.test(x as string));
        setSaved({...empty(),rsn:String(data.rsn||''),manualAdd:nums,aspirational:data.aspirational.filter((x:unknown)=>typeof x==='string')});
      }else throw Error('Invalid planner export');
      setError('');setInfo('Import complete');
    }catch(e){setError('Could not import file: '+String(e))}
  }

  const bosses=[...new Set(tasks.map(t=>t.boss))].sort();
  const types=[...new Set(tasks.map(t=>t.type))].sort();
  const synced=!!saved.lastSyncedAt;

  return <div className="app">
    <header>
      <div className="brand"><div className="brandicon">⚔</div><div><strong>GHOMMAL'S PLANNER</strong><small>COMBAT ACHIEVEMENTS</small></div></div>
      <div className="account">
        <label>PLAYER NAME
          <input placeholder="Enter RSN" value={saved.rsn} onChange={e=>setSaved(s=>({...s,rsn:e.target.value}))}
            onKeyDown={e=>{if(e.key==='Enter')syncWiki()}}/>
        </label>
        <button type="button" onClick={syncWiki} disabled={syncing}>{syncing?'Syncing…':'↻ Sync WikiSync'}</button>
        <span className={'tag '+(synced?'':'muted')}>{synced?`WIKISYNC · ${completedCount} CAs`:'LOCAL / MANUAL'}</span>
      </div>
    </header>
    <main>
      <div className="intro">
        <div>
          <div className="eyebrow">OLD SCHOOL RUNESCAPE / COMBAT ACHIEVEMENTS</div>
          <h1>Your path to <em>Grandmaster.</em></h1>
          <p>Sync completed tasks from RuneLite WikiSync, shortlist goals, and see how far your next tier is.</p>
        </div>
        <div className="actions">
          <button onClick={exportData}>↓ Export progress</button>
          <label className="button">↑ Import progress
            <input type="file" accept="application/json" hidden onChange={e=>{if(e.target.files?.[0])importData(e.target.files[0]);e.target.value=''}}/>
          </label>
        </div>
      </div>

      {(error||info)&&<div className={error?'error':'info'}>{error||info}</div>}

      <div className="stats">
        <section className="stat"><span>CURRENT POINTS</span><div className="big">{current.toLocaleString()} <small>/ {thresholds[5].toLocaleString()}</small></div><div className="track"><i style={{width:`${Math.min(100,current/thresholds[5]*100)}%`}}/></div><p>{completedCount} tasks completed{saved.lastSyncedAt?` · synced ${new Date(saved.lastSyncedAt).toLocaleString()}`:''}</p></section>
        <section className="stat"><span>CURRENT REWARD TIER</span><div className="big gold">{currentTier}</div><p>{next===undefined?'All rewards unlocked':`${next-current} points until ${nextTier}`}</p></section>
        <section className="stat"><span>ASPIRATIONAL POINTS</span><div className="big green">+{planned.toLocaleString()}</div><p>{tasks.filter(t=>asp.has(t.id)&&!completed.has(t.id)).length} planned tasks</p></section>
        <section className="stat"><span>PROJECTED REWARD TIER</span><div className="big">{projectedTier}</div><p>{(current+planned).toLocaleString()} points with planned tasks</p></section>
      </div>

      <section className="roadmap">
        <div className="sectiontitle"><h2>Reward milestones</h2><span>Completed + aspirational projection</span></div>
        <div className="milestones">{tiers.map((t,i)=><div className="milestone" key={t}>
          <div className={'medal '+t.toLowerCase()}>{['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ'][i]}</div>
          <strong>{t}</strong><small>{thresholds[i].toLocaleString()} pts</small>
          <div className="milestonebar"><i style={{width:`${Math.min(100,current/thresholds[i]*100)}%`}}/><b style={{left:`${Math.min(100,current/thresholds[i]*100)}%`,width:`${Math.max(0,Math.min(100,(current+planned)/thresholds[i]*100)-Math.min(100,current/thresholds[i]*100))}%`}}/></div>
          <span>{current>=thresholds[i]?'✓ Unlocked':current+planned>=thresholds[i]?'★ Within reach':`${Math.max(0,thresholds[i]-current-planned)} pts beyond plan`}</span>
        </div>)}</div>
      </section>

      <section className="browser">
        <div className="sectiontitle">
          <div><h2>Achievement browser</h2><p>WikiSync fills completed tasks; checkboxes are manual overrides. Stars are aspirational only.</p></div>
          <span>{filtered.length} of {tasks.length} tasks</span>
        </div>
        <div className="filters">
          <input className="search" placeholder="⌕ Search tasks, bosses, descriptions..." value={query} onChange={e=>setQuery(e.target.value)}/>
          <MultiSelect label="Tiers" options={tiers} value={selTiers} onChange={setSelTiers}/>
          <MultiSelect label="Bosses" options={bosses} value={selBosses} onChange={setSelBosses} searchable/>
          <MultiSelect label="Types" options={types} value={selTypes} onChange={setSelTypes}/>
          <MultiSelect label="Tasks" options={statusOpts} value={selStatus} onChange={setSelStatus}/>
          <select value={sort} onChange={e=>setSort(e.target.value)}><option value="tier">Sort: Tier</option><option value="boss">Sort: Boss</option><option value="completion">Sort: Most completed</option></select>
        </div>
        {loading?<p>Loading the latest OSRS Wiki task catalogue…</p>:<div className="tablewrap">
          <table>
            <thead><tr><th>DONE</th><th>ACHIEVEMENT</th><th>BOSS / MONSTER</th><th>TYPE</th><th>TIER</th><th>POINTS</th><th>PLAN</th></tr></thead>
            <tbody>{filtered.map(t=><tr key={t.id} className={completed.has(t.id)?'done':''}>
              <td><input aria-label={`Completed ${t.name}`} type="checkbox" checked={completed.has(t.id)} onChange={()=>toggleDone(t.id)}/></td>
              <td className="taskname"><strong>{t.name}</strong><small>{t.description}</small></td>
              <td>{t.boss}</td>
              <td><span className="type">{t.type}</span></td>
              <td><span className={'tier '+t.tier.toLowerCase()}>{t.tier}</span></td>
              <td className="points">+{t.points}</td>
              <td><button className={'star '+(asp.has(t.id)?'selected':'')} onClick={()=>toggleAsp(t.id)} aria-label={`Toggle aspirational ${t.name}`}>{asp.has(t.id)?'★':'☆'}</button></td>
            </tr>)}</tbody>
          </table>
          {!filtered.length&&<div className="empty">No achievements match your filters.</div>}
        </div>}
      </section>

      <footer>
        Catalogue from the OSRS Wiki Bucket API (stable CA ids). Completions load from RuneLite WikiSync via this app’s API; aspirational picks stay in local storage.
        Requires the WikiSync plugin and a prior in-game sync.{' '}
        <a href="https://oldschool.runescape.wiki/w/RuneScape:WikiSync" target="_blank" rel="noreferrer">WikiSync ↗</a>
        {' · '}
        <a href="https://oldschool.runescape.wiki/w/Combat_Achievements/All_tasks" target="_blank" rel="noreferrer">Wiki tasks ↗</a>
      </footer>
    </main>
  </div>;
}

createRoot(document.getElementById('root')!).render(<App/>);
