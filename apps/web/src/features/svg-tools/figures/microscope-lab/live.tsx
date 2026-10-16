'use client';
import { Button } from "@/components/ui/button";
import {useEffect,useRef,useState,type ReactNode,type KeyboardEvent} from 'react';
import {iso,type Projection,type Point3} from '@/components/iso/iso-kit';
import {DEFAULTS,OBJECTIVES,optics,componentOffset,rayWorld} from './model.mjs';
import {drawSpecimen} from './specimen.mjs';

type Mode='structure'|'exploded'|'working';
type Part={id:string;name:string;short:string;tag:string;role:string;body:string;connect:string[];chain:string;move:number[];anchor:number[];fact:string;screen:number[];delta:number[]};
type Settings=typeof DEFAULTS;
const MODES:[Mode,string,string][]=[['structure','Whole microscope','01'],['exploded','Parts apart','02'],['working','Light path','03']];
const SLIDES=['base','condenser','slide','objective','head','eyepiece'];
const STAGES=[{id:'base',title:'Shine light',text:'Light starts at the base and passes through the sample.'},{id:'objective',title:'Make it bigger',text:'The lens above the sample makes its details easier to see.'},{id:'eyepiece',title:'Look closer',text:'The eyepiece magnifies the image again for your eye.'},{id:'focus',title:'Make it clear',text:'Move the sample up or down until the image looks sharp.'}];
const PART_COPY:Record<string,{name:string;short:string;role:string;body:string}>={
 eyepiece:{name:'Eyepiece',short:'Eyepiece',role:'Look at the enlarged image',body:'Look through this lens to see the sample larger.'},
 head:{name:'Viewing tube',short:'Viewing tube',role:'Guide the image to your eye',body:'This tube keeps the lenses lined up so the image reaches your eye.'},
 objective:{name:'Lenses',short:'Lenses',role:'Make the sample look bigger',body:'Choose a lens to change how much detail you can see.'},
 slide:{name:'Sample slide',short:'Sample',role:'Hold the sample',body:'The sample sits on this glass slide. Move it to explore a different area.'},
 stage:{name:'Sample holder',short:'Holder',role:'Keep the sample in place',body:'The holder keeps the slide steady while you move or focus it.'},
 condenser:{name:'Light lens',short:'Light lens',role:'Aim light at the sample',body:'This lens gathers light and sends it through the sample.'},
 focus:{name:'Focus knobs',short:'Focus',role:'Make the image clear',body:'Turn these knobs to move the sample until it looks sharp.'},
 arm:{name:'Support arm',short:'Arm',role:'Hold the microscope together',body:'The arm supports the lenses and the sample holder.'},
 base:{name:'Base and light',short:'Base',role:'Light the sample',body:'The base keeps the microscope steady and shines light upward.'},
};
const partCopy=(part:Part)=>PART_COPY[part.id]??part;
export function MicroscopeLab({artwork,projection,parts,count}:{artwork:ReactNode;projection:Projection;parts:Part[];count:number}){
 const root=useRef<HTMLDivElement>(null),field=useRef<HTMLCanvasElement>(null),kick=useRef<()=>void>(()=>{});
 const [mode,setMode]=useState<Mode>('structure'),[selected,setSelected]=useState('objective'),[isolated,setIsolated]=useState(false),[labels,setLabels]=useState(true),[theme,setTheme]=useState('light'),[paused,setPaused]=useState(false),[step,setStep]=useState(0),[settings,setSettings]=useState<Settings>(DEFAULTS);
 const desired=useRef({mode,selected,isolated,paused,settings});
 const chosen=parts.find(p=>p.id===selected)!,metric=optics(settings);
 const update=(key:keyof Settings,value:number|boolean)=>setSettings(s=>({...s,[key]:value}));
 const inspect=(id:string)=>{setSelected(id);};
 function changeMode(next:Mode){setMode(next);setIsolated(false);}
 function reset(){setSettings({...DEFAULTS,fine:0});setMode('structure');setIsolated(false);setSelected('objective');setPaused(false);setStep(0);}
 useEffect(()=>{desired.current={mode,selected,isolated,paused,settings};kick.current();},[mode,selected,isolated,paused,settings,theme,labels]);
 useEffect(()=>{
  const mounted=root.current;if(!mounted)return;const node:HTMLDivElement=mounted;
  const svg=node.querySelector<SVGSVGElement>('.mp-svg')!,layer=svg.querySelector<SVGGElement>('[data-parts]')!,rays=node.querySelector<SVGSVGElement>('.ml-rays')!,canvas=field.current!;
  const pieces=Array.from(layer.querySelectorAll<SVGGElement>('.mp-piece')).map(el=>({el,id:el.dataset.component!,key:Number(el.dataset.key),keys:el.dataset.keys!.split(',').map(Number),move:el.dataset.move!.split(',').map(Number),variant:Number(el.dataset.variant),bounds:el.dataset.bounds!.split(',').map(Number)}));
  const hotspots=Array.from(node.querySelectorAll<HTMLButtonElement>('[data-hotspot]'));
  const mq=window.matchMedia('(prefers-reduced-motion: reduce)');
  let visible=true,frame=0,last=0,share=0,phase=0,working=0,focus=12,slideX=0,slideY=0,lastOrder='',fieldKey='',light=.8,view=[0,0,960,840];
  const project=(p:number[])=>iso(p as Point3,projection);
  const origin=project([0,0,0]);
  const offset=(p:number[])=>{const a=project(p);return[a[0]-origin[0],a[1]-origin[1]];};
  const easing=(a:number,b:number,dt:number)=>mq.matches||Math.abs(a-b)<.0002?b:a+(b-a)*(1-Math.exp(-dt/.22));
  function draw(now:number){
   frame=0;const dt=last?Math.min(.05,(now-last)/1000):1/60;last=now;
   const target=desired.current,s=target.settings;
   const targetShare=target.mode==='exploded'&&working<.005?1:0;
   share=easing(share,targetShare,dt);
   // Functional content enters only after the assemblies have returned home.
   working=easing(working,target.mode==='working'&&share<.005?1:0,dt);
   focus=easing(focus,s.coarse*1000+s.fine,dt);slideX=easing(slideX,s.x,dt);slideY=easing(slideY,s.y,dt);light=easing(light,s.power?s.light:0,dt);

   const cam=(projection.azimuth??48)*Math.PI/180,elev=(projection.elevation??23)*Math.PI/180;
   const V=[Math.cos(cam)*Math.cos(elev),Math.sin(cam)*Math.cos(elev),Math.sin(elev)];
   const posed=pieces.map(p=>{
    const d=componentOffset(p.id,share,focus,slideX,slideY),assembly=parts.find(part=>part.id===p.id)!;
    d.forEach((_,i)=>d[i]+=(p.move[i]-assembly.move[i])*share);
    const screen=offset(d);
    p.el.setAttribute('transform',`translate(${screen[0]} ${screen[1]})`);
    const isSelected=p.id===target.selected,isNeighbor=parts.find(part=>part.id===target.selected)?.connect.includes(p.id);
    p.el.style.opacity=String(target.isolated&&!isSelected?0:isSelected?1:isNeighbor?.96:.72);
    p.el.style.pointerEvents=target.isolated&&!isSelected?'none':'auto';
    p.el.dataset.selected=isSelected?'true':'false';p.el.dataset.neighbor=isNeighbor?'true':'false';
    p.el.style.display=p.variant>=0&&p.variant!==s.objective?'none':'';
    return {...p,screen,depth:p.keys[s.objective]+d.reduce((sum,v,i)=>sum+v*V[i],0)};
   }).sort((a,b)=>a.depth-b.depth);
   let targetView=[-142.857142857*share,-245*share,960+285.714285714*share,840+250*share];
   if(target.isolated){
    const bounds=posed.filter(p=>p.id===target.selected&&(p.variant<0||p.variant===s.objective)).map(p=>[p.bounds[0]+p.screen[0],p.bounds[1]+p.screen[1],p.bounds[2]+p.screen[0],p.bounds[3]+p.screen[1]]);
    const x0=Math.min(...bounds.map(b=>b[0])),y0=Math.min(...bounds.map(b=>b[1])),x1=Math.max(...bounds.map(b=>b[2])),y1=Math.max(...bounds.map(b=>b[3]));
    const w=Math.max(360,x1-x0+140,(y1-y0+140)*960/840),h=w*840/960;
    targetView=[(x0+x1-w)/2,(y0+y1-h)/2,w,h];
   }
   view=view.map((v,i)=>easing(v,targetView[i],dt));
   svg.setAttribute('viewBox',view.join(' '));rays.setAttribute('viewBox',view.join(' '));
   const order=posed.map(p=>p.el.dataset.item).join('|');if(order!==lastOrder){const fragment=document.createDocumentFragment();posed.forEach(p=>fragment.appendChild(p.el));layer.appendChild(fragment);lastOrder=order;}
   for(const button of hotspots){
    const part=parts.find(p=>p.id===button.dataset.hotspot)!;
    const d=componentOffset(part.id,share,focus,slideX,slideY),p=project(part.anchor.map((v,i)=>v+d[i]));
    button.style.left=`${(p[0]-view[0])/view[2]*100}%`;button.style.top=`${(p[1]-view[1])/view[3]*100}%`;
    button.style.opacity=target.isolated&&part.id!==target.selected?'0':'1';button.style.pointerEvents=target.isolated&&part.id!==target.selected?'none':'';
   }
   const rendered={...s,light,power:light>.001,coarse:0,fine:focus,x:slideX,y:slideY};
   const m=optics(rendered),raysets=rayWorld(rendered);
   rays.style.opacity=String(working*(target.isolated?0:1)*Math.min(1,light*1.5));
   raysets.forEach((points,index)=>{const d=points.map((p,i)=>`${i?'L':'M'}${project(p)[0]} ${project(p)[1]}`).join(' ');rays.querySelector(`[data-ray="${index}"]`)?.setAttribute('d',d);});
   if(!target.paused&&!mq.matches)phase+=dt*22;
   rays.querySelectorAll<SVGPathElement>('[data-ray]').forEach(el=>{el.style.strokeDashoffset=String(-phase);});
   node.style.setProperty('--working',String(working));
   const key=[s.objective,focus.toFixed(3),s.iris,light.toFixed(3),slideX.toFixed(3),slideY.toFixed(3)].join();
   if(fieldKey!==key){drawSpecimen(canvas,m,rendered);fieldKey=key;}
   const needle=node.querySelector<SVGLineElement>('[data-focus-needle]');
   needle?.setAttribute('transform',`rotate(${focus*.8} 70 70)`);
   node.querySelectorAll<SVGPathElement>('[data-focus-index]').forEach(el=>{const side=Number(el.dataset.focusIndex),angle=focus/1000/6.7*100,c=project([side*37.7,-43,77]),p=project([side*37.7,-43+Math.sin(angle)*4.5,77+Math.cos(angle)*4.5]);el.setAttribute('d',`M${c[0]} ${c[1]}L${p[0]} ${p[1]}`);});
   node.querySelector<SVGGElement>('[data-rack]')?.setAttribute('transform',`translate(0 ${-focus*.015})`);
   const unsettled=view.some((v,i)=>Math.abs(v-targetView[i])>.001)||Math.abs(share-targetShare)>.0001||Math.abs(focus-(s.coarse*1000+s.fine))>.001||Math.abs(working-(target.mode==='working'&&share<.005?1:0))>.001||Math.abs(slideX-s.x)>.001||Math.abs(slideY-s.y)>.001||Math.abs(light-(s.power?s.light:0))>.001;
   if(visible&&(unsettled||target.mode==='working'&&target.settings.power&&light>.001&&!target.paused&&!mq.matches))frame=requestAnimationFrame(draw);
  }
  const run=()=>{if(!frame&&visible){last=0;frame=requestAnimationFrame(draw);}};kick.current=run;
  const observer=new IntersectionObserver(entries=>{visible=Boolean(entries.at(-1)?.isIntersecting);if(visible)run();else{cancelAnimationFrame(frame);frame=0;}},{rootMargin:'120px'});observer.observe(node);
  const onMotion=()=>run();mq.addEventListener('change',onMotion);run();
  return()=>{observer.disconnect();mq.removeEventListener('change',onMotion);cancelAnimationFrame(frame);kick.current=()=>{};};
 },[parts,projection]);
 function keys(e:KeyboardEvent<HTMLDivElement>){
  if((e.target as HTMLElement).matches('input,button,select'))return;
  if(e.key==='Escape'){setIsolated(false);e.preventDefault();}
  if(e.key==='ArrowRight'||e.key==='ArrowLeft'){const index=parts.findIndex(p=>p.id===selected);setSelected(parts[(index+(e.key==='ArrowRight'?1:8))%9].id);e.preventDefault();}
  if(e.key===' '){setPaused(p=>!p);e.preventDefault();}
 }
 return <div ref={root} className="microscope-lab iso" data-theme={theme} data-mode={mode} data-labels={labels} data-isolated={isolated} onKeyDown={keys}>
  <div className="ml-toolbar"><div className="ml-mode-switch" role="group" aria-label="Microscope view">{MODES.map(([id,label,n])=><Button variant="secondary" key={id} aria-pressed={mode===id} onClick={()=>changeMode(id)}><span>{n}</span>{label}</Button>)}</div><div className="ml-utility"><Button variant="secondary" onClick={()=>setLabels(v=>!v)} aria-pressed={labels}>◉ <span>Part names</span></Button><Button variant="secondary" onClick={()=>setTheme(t=>t==='light'?'dark':'light')} aria-label={`Switch to ${theme==='light'?'dark':'light'} theme`}>{theme==='light'?'◐':'◑'}</Button><Button variant="secondary" onClick={reset} aria-label="Reset microscope">↺</Button></div></div>
  <div className="ml-main">
   <section className="ml-instrument" aria-label="Interactive microscope">
    <div className="ml-corner"><span>FIG. 05 / LABORATORY MICROSCOPE</span><span><i/> {mode==='working'?'FOLLOW THE LIGHT':mode==='exploded'?'PARTS APART':'WHOLE MICROSCOPE'}</span></div>
    <div className="ml-scene" tabIndex={0} role="group" aria-label="Choose a numbered part, or use arrow keys to explore. Escape shows all parts again. Space pauses the light." onClick={e=>{const component=(e.target as Element).closest('[data-component]')?.getAttribute('data-component');if(component)inspect(component);}}>
     {artwork}
     <svg className="ml-rays" viewBox="0 0 960 840" aria-hidden="true"><defs><filter id="ml-ray-bloom"><feGaussianBlur stdDeviation="2"/></filter></defs>{[0,1,2].map(i=><path key={i} data-ray={i} className={i===1?'ml-ray ml-ray-center':'ml-ray'} d=""/>)}</svg>
     <div className="ml-hotspots">{parts.map(p=><Button variant="secondary" key={p.id} data-hotspot={p.id} className={`ml-hotspot ml-hotspot-${p.id}`} aria-label={`Inspect ${partCopy(p).name}`} disabled={isolated&&selected!==p.id} tabIndex={isolated&&selected!==p.id?-1:0} aria-pressed={selected===p.id} onClick={()=>inspect(p.id)} style={{left:`${p.screen[0]/9.6}%`,top:`${p.screen[1]/8.4}%`}}><b>{p.tag}</b><span>{partCopy(p).short}</span></Button>)}</div>
     <div className="ml-view-note">{isolated?<><strong>ONE PART</strong><Button variant="secondary" onClick={()=>setIsolated(false)}>Show all parts ↗</Button></>:mode==='working'?<><strong>FOLLOW THE LIGHT</strong><span>See how light reaches your eye</span></>:mode==='exploded'?<><strong>PARTS APART</strong><span>Select a part to learn more</span></>:<><strong>EXPLORE THE MICROSCOPE</strong><span>Click a part to learn more</span></>}</div>
    </div>
    <div className="ml-instrument-foot"><span><i className="ml-key-dot"/> SELECTED PART <i className="ml-key-line"/> LIGHT PATH</span><span>{count} PARTS / 9 ASSEMBLIES</span></div>
   </section>
   <aside className="ml-inspector" aria-label="Component inspector">
    <div className="ml-panel-kicker"><span>Selected part</span><span>{chosen.tag} / 09</span></div>
    <h2>{partCopy(chosen).name}</h2><h3>{partCopy(chosen).role}</h3><p>{partCopy(chosen).body}</p>
    <Button variant="secondary" className="ml-isolate" aria-pressed={isolated} onClick={()=>setIsolated(v=>!v)}><span>{isolated?'⊞':'⊡'}</span>{isolated?'Show all parts':'Show only this part'}<span>↗</span></Button>
    <div className="ml-connections"><h4>Related parts</h4><div>{chosen.connect.map(id=><Button variant="secondary" key={id} onClick={()=>inspect(id)}>{partCopy(parts.find(p=>p.id===id)!).short}<span>↗</span></Button>)}</div><p>{chosen.chain}</p></div>
    <div className="ml-parts-list"><h4>Explore the parts</h4>{parts.map(p=><Button variant="secondary" key={p.id} aria-pressed={selected===p.id} onClick={()=>inspect(p.id)}><span>{p.tag}</span>{partCopy(p).short}<i>{selected===p.id?'●':'↗'}</i></Button>)}</div>
   </aside>
  </div>
  <div className="ml-mechanism-head"><div><span className="ml-eyebrow">FROM LIGHT TO DETAIL</span><h2>Small movements.<em> A different world.</em></h2></div><Button variant="secondary" className="ml-working-link" onClick={()=>changeMode('working')}>Follow the light <span>↗</span></Button></div>
  <div className="ml-lab-grid">
   <section className="ml-field-panel"><div className="ml-panel-kicker"><span>What you see</span><span>{metric.total}×</span></div><div className="ml-field-wrap"><canvas ref={field} width={520} height={520} aria-label={`Illustrative onion epidermis at ${metric.total} times magnification, field diameter ${metric.field.toFixed(2)} millimeters, focus offset ${metric.focus.toFixed(1)} micrometers.`}/><div className="ml-field-cross" aria-hidden="true">+</div></div><div className="ml-field-caption"><span>Onion skin</span><span>Example sample</span></div><div className="ml-field-readouts"><div><span>View width</span><strong>{metric.field.toFixed(2)} <small>mm</small></strong></div><div><span>Smallest visible detail</span><strong>{metric.resolution.toFixed(2)} <small>µm</small></strong></div></div><div className="ml-stage-xy"><span>Move sample <small>The view moves the other way</small></span><Button variant="secondary" aria-label="Move slide left" onClick={()=>update('x',Math.max(-1.3,settings.x-.1))}>←</Button><Button variant="secondary" aria-label="Move slide up" onClick={()=>update('y',Math.min(1.3,settings.y+.1))}>↑</Button><Button variant="secondary" aria-label="Move slide down" onClick={()=>update('y',Math.max(-1.3,settings.y-.1))}>↓</Button><Button variant="secondary" aria-label="Move slide right" onClick={()=>update('x',Math.min(1.3,settings.x+.1))}>→</Button></div></section>
   <section className="ml-optics-panel"><div className="ml-panel-kicker"><span>Light and zoom</span><span>Adjust the view</span></div><h3>Change what you see.</h3><label className="ml-control-label">Choose a lens <span>Eyepiece adds 10×</span></label><div className="ml-objectives">{OBJECTIVES.map((obj,i)=><Button variant="secondary" key={obj.power} aria-pressed={settings.objective===i} onClick={()=>{update('objective',i);setSelected('objective');}}><i style={{background:obj.colour}}/><strong>{obj.power}×</strong></Button>)}</div><div className="ml-magnification"><span>Total zoom</span><p>{metric.obj.power}× <i>×</i> 10× <i>=</i> <strong>{metric.total}×</strong></p></div><div className="ml-control-title"><label htmlFor="ml-light">Brightness</label><output>{Math.round(settings.light*100)}%</output><Button variant="secondary" aria-pressed={settings.power} onClick={()=>update('power',!settings.power)}>{settings.power?'ON':'OFF'}</Button></div><input id="ml-light" type="range" min={0} max={100} value={settings.light*100} onChange={e=>update('light',Number(e.target.value)/100)}/><div className="ml-control-title"><label htmlFor="ml-iris">Light opening</label><output>{Math.round(20+settings.iris*80)}%</output></div><input id="ml-iris" type="range" min={20} max={100} step={.1} value={20+settings.iris*80} onChange={e=>{update('iris',(Number(e.target.value)-20)/80);setSelected('condenser');}}/><p className="ml-control-help">Narrow the illumination cone from 100% to 20% of objective NA. The image darkens; depth of field grows while the resolution estimate worsens.</p><Button variant="secondary" className="ml-pause" aria-pressed={paused} onClick={()=>{setPaused(p=>!p);changeMode('working');}}>{paused?'▶ Play light':'Ⅱ Pause light'}</Button></section>
   <section className="ml-focus-panel"><div className="ml-panel-kicker"><span>Focus</span><span>Make the image clear</span></div><div className="ml-focus-visual"><svg viewBox="0 0 250 140" role="img" aria-label="Focus wheel turns a pinion against a vertical rack. Rack travel is enlarged for clarity."><path className="ml-focus-ground" d="M118 16h45v112h-45z"/><g data-rack><path className="ml-focus-rack" d="M125 23h20v94h-20z"/>{Array.from({length:14},(_,i)=><path key={i} d={`M125 ${26+i*6}h-8v3h8`}/>)}</g><circle cx="70" cy="70" r="39"/><circle cx="70" cy="70" r="30"/><circle cx="70" cy="70" r="9"/><line data-focus-needle x1="70" y1="70" x2="91" y2="49"/><path d="M109 62h9v16h-9M145 37h64v9h-64"/><circle cx="70" cy="70" r="2"/></svg><div><strong>{metric.focus>0?'+':''}{metric.focus.toFixed(1)}</strong><span>Focus position (µm)</span><small>{metric.v<=0?'Move the focus to see the sample':Math.abs(metric.focus)<metric.dof*.5?'In focus':'Move toward zero to sharpen'}</small></div></div><div className="ml-control-title"><label htmlFor="ml-coarse">Quick focus</label><output>{settings.coarse.toFixed(3)} mm</output></div><input id="ml-coarse" type="range" min={-.3} max={.3} step={.005} value={settings.coarse} onChange={e=>{update('coarse',Number(e.target.value));setSelected('focus');}}/><div className="ml-control-title"><label htmlFor="ml-fine">Precise focus</label><output>{settings.fine>0?'+':''}{settings.fine.toFixed(1)} µm</output></div><input id="ml-fine" type="range" min={-25} max={25} step={.5} value={settings.fine} onChange={e=>{update('fine',Number(e.target.value));setSelected('focus');}}/><div className="ml-fine-buttons"><Button variant="secondary" onClick={()=>update('fine',Math.max(-25,settings.fine-.5))}>− 0.5 µm</Button><Button variant="secondary" onClick={()=>{setSettings(s=>({...s,coarse:0,fine:0}));setSelected('focus');}}>Auto focus</Button><Button variant="secondary" onClick={()=>update('fine',Math.min(25,settings.fine+.5))}>+ 0.5 µm</Button></div><p className="ml-control-help">Both knobs move the stage. Higher numerical aperture makes precise fine focus more important. Rack movement above is enlarged for clarity.</p></section>
  </div>
  <section className="ml-learning"><div className="ml-learning-nav" role="group" aria-label="Working mechanism steps">{STAGES.map((s,i)=><Button variant="secondary" key={s.id} aria-pressed={step===i} onClick={()=>{setStep(i);setSelected(s.id);changeMode('working');}}><span>0{i+1}</span>{s.title}<i>↗</i></Button>)}</div><div className="ml-learning-copy"><span>How it works / {step+1}</span><h3>{STAGES[step].title}</h3><p>{STAGES[step].text}</p><div className="ml-image-formation" aria-label="The objective makes an inverted real image; the eyepiece magnifies it again"><div><b>↑</b><span>SAMPLE<small>Where light begins</small></span></div><i>→</i><div><b className="ml-inverted">↓</b><span>BIGGER IMAGE<small>{metric.obj.power}× zoom</small></span></div><i>→</i><div><b className="ml-viewed">↓</b><span>WHAT YOU SEE<small>{metric.total}× zoom</small></span></div></div><div className="ml-optical-chain">{SLIDES.map((id,i)=><span key={id} data-active={selected===id}><Button variant="secondary" onClick={()=>{inspect(id);changeMode('working');}}>{partCopy(parts.find(p=>p.id===id)!).short}</Button>{i<5?<i>→</i>:null}</span>)}</div></div></section>
  <p className="ml-sr" aria-live="polite">{partCopy(chosen).name}. {partCopy(chosen).role}. {isolated?'Showing only this part.':`Related to ${chosen.connect.map(id=>partCopy(parts.find(p=>p.id===id)!).short).join(', ')}.`} {mode==='working'?'Showing the light path.':mode==='exploded'?'Showing parts apart.':'Showing the whole microscope.'}</p>
 </div>;
}
