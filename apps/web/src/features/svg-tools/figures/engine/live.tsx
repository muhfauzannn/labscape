"use client";

import { Button } from "@/components/ui/button";
import * as React from "react";
import {TURN} from "../../../../components/iso/turn.mjs";
import {advancePlant,clamp,cycleForPlant,DEFAULTS,initialPlant,makeCycle,OFFSETS,phaseOf,sampleCycle,settlePlant,startPlant,stopPlant,STROKES,wrap} from "./model.mjs";
import {gasAt,GRAPH,graphPaths,graphPoint,nearestSample,posesAt} from "./view.mjs";
import {mountEngineRenderer} from "./gpu.mjs";

type Controls=typeof DEFAULTS;
type Commands={power():void;pause():void;seek(angle:number):void;step(amount:number):void;change():void;refresh():void;view(delta:number):void;tilt(delta:number):void;zoom(delta:number):void;resetView():void;cylinder(index:number):void;log(value:boolean):void;reference(value:boolean):void};
interface EngineModel {width:number;height:number;parts:number;cylinderX:number[];}
type TurnData=Parameters<typeof TURN.prepare>[0];
interface MeshData {vertices:string;indices:string;edges:string;vertexCount:number;triangleCount:number;edgeCount:number;materials:string[];}
const COMPONENTS=[{id:"piston",label:"Pistons"},{id:"crank",label:"Crankshaft"},{id:"cam",label:"Camshafts"},{id:"valve",label:"Valves"},{id:"plug",label:"Spark plugs"},{id:"injector",label:"Injection"}];
const STROKE_LABELS=["Air in","Squeeze","Power","Gas out"];
const strokeLabel=(phase:string)=>STROKE_LABELS[STROKES.indexOf(phase)]??phase;

function Gauge({id,label,unit,max,min=0}:{id:string;label:string;unit:string;max:number;min?:number}) {
  const ticks=Array.from({length:9},(_,i)=>{const a=(-120+i*30)*Math.PI/180;return <line key={i} x1={60+Math.sin(a)*37} y1={55-Math.cos(a)*37} x2={60+Math.sin(a)*(i%2?34:32)} y2={55-Math.cos(a)*(i%2?34:32)}/>;});
  return <div className="engine-gauge"><div className="engine-gauge-title">{label}<span>{unit}</span></div><div className="engine-gauge-body"><svg viewBox="0 0 120 84" aria-hidden="true"><path className="gauge-track" d="M27.09 74A38 38 0 1 1 92.91 74"/><g className="gauge-ticks">{ticks}</g><text x="19" y="82">{min}</text><text x="96" y="82" textAnchor="end">{max>=1000?`${max/1000}k`:max}</text><g data-needle={id} transform="rotate(-120 60 55)"><path className="gauge-needle" d="M58.7 57L60 23L61.3 57Z"/></g><circle cx="60" cy="55" r="3.4" className="gauge-hub"/></svg><div><output data-value={id}>0</output><small>{unit}</small></div></div></div>;
}

export function EngineLive({artwork,turn,mesh,model}:{artwork:React.ReactNode;turn:TurnData;mesh:MeshData;model:EngineModel}) {
  const root=React.useRef<HTMLElement>(null),stage=React.useRef<HTMLDivElement>(null),graph=React.useRef<SVGSVGElement>(null);
  const commands=React.useRef<Commands|null>(null),controlRef=React.useRef<Controls>({...DEFAULTS});
  const [controls,setControls]=React.useState<Controls>({...DEFAULTS});
  const [theme,setTheme]=React.useState<"light"|"dark">("light");
  const [ui,setUI]=React.useState({running:false,paused:true,stall:false});
  const [cylinder,setCylinder]=React.useState(0),[log,setLog]=React.useState(false),[reference,setReference]=React.useState(true),[highlight,setHighlight]=React.useState("");
  function update<K extends keyof Controls>(key:K,value:Controls[K]) {controlRef.current={...controlRef.current,[key]:value};setControls({...controlRef.current});commands.current?.change();}

  React.useEffect(()=>{
    const host=root.current,area=stage.current,plot=graph.current;
    if(!host||!area||!plot)return;
    const controller=mountEngineRenderer(area,turn,mesh,host);
    const still=window.matchMedia("(prefers-reduced-motion: reduce)");
    const s=initialPlant();
    let cycle=makeCycle({throttle:s.opening,rpm:350,ignition:false});
    let dirty=true,frame=0,last=0,visible=false,wallTime=0,lastCycle=-1,lastGauges=-1,auto=!still.matches,autoAge=0;
    let activeCylinder=0,useLog=false,showReference=true,yaw=0,yawTarget=0,tilt=0,tiltTarget=0,zoom=1,zoomTarget=1,renderCost=0,lastRender=0;
    let drag:{id:number;x:number;y:number;yaw:number;tilt:number;distance:number}|null=null,graphDrag=false;
    const outputs=Object.fromEntries(Array.from(host.querySelectorAll<HTMLElement>("[data-value]")).map(el=>[el.dataset.value!,el]));
    const needles=Object.fromEntries(Array.from(host.querySelectorAll<SVGGElement>("[data-needle]")).map(el=>[el.dataset.needle!,el]));
    const flow=area.querySelector<SVGSVGElement>(".engine-gas")!,scene=area.querySelector<HTMLElement>(".engine-scene")!;
    const gas=Array.from(flow.querySelectorAll<SVGPathElement>("[data-gas]")),spray=Array.from(flow.querySelectorAll<SVGPathElement>("[data-spray]")),spark=Array.from(flow.querySelectorAll<SVGGElement>("[data-spark]"));
    const clip=Array.from(flow.querySelectorAll<SVGPathElement>("[data-gas-clip]"));
    const paths=Array.from(plot.querySelectorAll<SVGPathElement>("[data-cycle-path]")),referencePath=plot.querySelector<SVGPathElement>("[data-reference]")!;
    const dot=plot.querySelector<SVGCircleElement>("[data-live-dot]")!,halo=plot.querySelector<SVGCircleElement>("[data-live-halo]")!;
    const graphV=plot.querySelector<SVGLineElement>("[data-cursor-v]")!,graphH=plot.querySelector<SVGLineElement>("[data-cursor-h]")!;
    const strokeButtons=Array.from(host.querySelectorAll<HTMLButtonElement>("[data-stroke]"));
    const say=(key:string,text:string)=>{if(outputs[key])outputs[key].textContent=text;};
    function syncUI(announce="") {setUI({running:s.running,paused:s.paused,stall:s.stall});if(announce)say("announcement",announce);}
    function takeOver(){auto=false;}
    function recompute() {
      const c=controlRef.current;
      cycle=cycleForPlant(s,c);
      graphPaths(cycle,useLog).forEach((d,i)=>paths[i].setAttribute("d",d));
      const motoring=makeCycle({throttle:s.opening,rpm:s.rpm,advance:c.advance,ignition:false,injection:false});
      referencePath.setAttribute("d",graphPaths(motoring,useLog).join(""));referencePath.style.display=showReference?"":"none";
      const ticks=Array.from(plot!.querySelectorAll<SVGTextElement>("[data-y-tick]"));
      ticks.forEach((el,i)=>{el.textContent=useLog?["0.2","1","10","100"][i]:["0","35","70","105"][i];const p={V:0,p:(useLog?[.2,1,10,100][i]:[0,35,70,105][i])*1e5},y=graphPoint(p,useLog)[1];el.setAttribute("y",String(y+3));const grid=plot!.querySelector(`[data-y-grid="${i}"]`);grid?.setAttribute("y1",String(y));grid?.setAttribute("y2",String(y));});
      dirty=false;lastCycle=wallTime;
    }
    function draw() {
      if(dirty||(!s.paused&&wallTime-lastCycle>.08))recompute();
      const renderStats=controller.set(posesAt(s.angle,yaw,tilt));
      renderCost=renderCost*.9+renderStats.ms*.1;
      say("renderer",controller.mode);
      scene.style.transform=`scale(${zoom.toFixed(4)})`;
      const projector=(p:number[])=>controller.anchor("view",p).screen;
      const atmos=gasAt(projector,s.angle,cycle,controller.mode==="DEPTH-TESTED 3D"?yaw:0);
      controller.effects(atmos);
      atmos.forEach((a,i)=>{
        gas[i].setAttribute("d",a.d);gas[i].setAttribute("fill",a.colour);gas[i].style.opacity=String(a.alpha);
        clip[i].setAttribute("d",a.d);spray[i].setAttribute("d",a.spray);spray[i].style.opacity=String(a.sprayAlpha);
        spark[i].setAttribute("transform",`translate(${a.spark[0]} ${a.spark[1]})`);spark[i].style.opacity=String(a.sparkAlpha);
      });
      const sample=sampleCycle(cycle,s.angle+OFFSETS[activeCylinder]);
      const [gx,gy]=graphPoint(sample,useLog);
      for(const el of [dot,halo]){el.setAttribute("cx",String(gx));el.setAttribute("cy",String(gy));}
      graphV.setAttribute("x1",String(gx));graphV.setAttribute("x2",String(gx));graphH.setAttribute("y1",String(gy));graphH.setAttribute("y2",String(gy));
      const phaseIndex=Math.floor(wrap(sample.a)/180);
      host!.dataset.phase=String(phaseIndex);
      strokeButtons.forEach((b,i)=>b.setAttribute("aria-pressed",String(i===phaseIndex)));
      const status=s.paused?"Paused":s.stall?"Engine stopped. Start it again.":!s.running&&s.rpm>1?"Engine slowing down":!s.running?"Engine is off":s.starter>0&&s.rpm<720?"Engine starting":!controlRef.current.ignition?"Turn on the spark":!controlRef.current.injection?"Turn on the fuel":s.rpm>=6200?"Engine at top speed":s.opening>=controlRef.current.throttle/100-.015&&s.rpm<controlRef.current.targetRPM-100?"Engine power is limited":"Engine is running";
      say("status",status);say("phase",strokeLabel(phaseOf(sample.a)));
      say("angle",`${Math.round(wrap(sample.a)/720*100)}% through cycle`);say("cam-angle",`${(wrap(s.angle)/2).toFixed(1)}°`);
      say("cylinder-phase-0",strokeLabel(phaseOf(s.angle)));say("cylinder-phase-1",strokeLabel(phaseOf(s.angle+540)));
      say("intake",`${(sample.intake*1000).toFixed(2)} mm`);say("exhaust",`${(sample.exhaust*1000).toFixed(2)} mm`);
      say("spark",controlRef.current.ignition?(sample.spark>.08?"Sparking":"Ready"):"Off");say("injection",controlRef.current.injection&&s.running?(sample.inject>.05?"Adding fuel":"Ready"):"Off");
      say("opening",`${Math.round(s.opening*100)}%`);
      say("graph-point",`Pressure: ${(sample.p/1e5).toFixed(2)} bar · Space: ${(sample.V*1e6).toFixed(1)} cm³`);
      say("work",`${cycle.work.toFixed(0)} J`);say("fuel",`${(cycle.fuel*1e6).toFixed(1)} mg/cycle`);
      if(wallTime-lastGauges>.045||s.paused||s.rpm<1) {
        const values={pressure:sample.p/1e5,temperature:sample.T-273.15,torque:s.brakeTorque,rpm:s.rpm};
        const limits={pressure:[0,110],temperature:[0,3200],torque:[-20,120],rpm:[0,6500]};
        for(const id of Object.keys(values) as (keyof typeof values)[]) {
          say(id,id==="pressure"?values[id].toFixed(1):Math.round(values[id]).toLocaleString("en-US"));
          needles[id].setAttribute("transform",`rotate(${-120+240*clamp((values[id]-limits[id][0])/(limits[id][1]-limits[id][0]),0,1)} 60 55)`);
        }
        lastGauges=wallTime;
      }
    }
    function run(){if(frame||!visible)return;last=0;frame=requestAnimationFrame(tick);}
    function tick(now:number){
      const dt=last?Math.min((now-last)/1000,1/30):1/60;last=now;wallTime+=dt;
      if(auto&&!still.matches){autoAge+=dt;if(autoAge>1.6&&!s.running){startPlant(s);syncUI("Automatic engine demonstration started.");dirty=true;}}
      const wasStalled=s.stall;
      if(!still.matches)advancePlant(s,controlRef.current,dt,cycle);
      if(wasStalled!==s.stall)syncUI(s.stall?"Engine stalled. Press restart to engage the starter.":"");
      yaw+=((yawTarget-yaw)*(still.matches?1:1-Math.exp(-dt/.09)));tilt+=(tiltTarget-tilt)*(still.matches?1:1-Math.exp(-dt/.09));zoom+=(zoomTarget-zoom)*(still.matches?1:1-Math.exp(-dt/.1));
      if(Math.abs(yawTarget-yaw)<.01)yaw=yawTarget;if(Math.abs(tiltTarget-tilt)<.01)tilt=tiltTarget;if(Math.abs(zoomTarget-zoom)<.001)zoom=zoomTarget;
      if(renderCost<16||now-lastRender>32||s.paused){draw();lastRender=now;}
      const moving=!still.matches&&!s.paused&&(s.rpm>.1||s.starter>0||(s.running&&!s.stall));
      frame=visible&&(moving||auto||yaw!==yawTarget||tilt!==tiltTarget||zoom!==zoomTarget)?requestAnimationFrame(tick):0;
    }
    function seek(angle:number){takeOver();s.paused=true;s.angle=wrap(angle-OFFSETS[activeCylinder]);syncUI("Cycle inspection paused at "+phaseOf(angle)+".");draw();run();}
    function power(){takeOver();if(!s.running||s.stall){startPlant(s);if(still.matches){settlePlant(s,controlRef.current);s.paused=true;}syncUI(still.matches?"Operating point calculated. Use cycle controls to inspect without motion.":"Starter engaged.");}else{stopPlant(s);if(still.matches){settlePlant(s,controlRef.current);s.paused=true;}syncUI("Combustion stopped. The crankshaft is coasting down.");}dirty=true;draw();run();}
    commands.current={power,refresh(){draw();run();},pause(){takeOver();s.paused=!s.paused;if(still.matches)s.paused=true;syncUI(s.paused?"Simulation paused.":"Simulation resumed.");draw();run();},seek,step(amount){seek(s.angle+OFFSETS[activeCylinder]+amount);},change(){takeOver();if(still.matches&&s.running){settlePlant(s,controlRef.current);s.paused=true;syncUI();}dirty=true;draw();run();},view(delta){takeOver();yawTarget+=delta;run();},tilt(delta){takeOver();tiltTarget=clamp(tiltTarget+delta,-12,18);run();},zoom(delta){takeOver();zoomTarget=clamp(zoomTarget+delta,.75,1.65);run();},resetView(){yawTarget=0;tiltTarget=0;zoomTarget=1;run();},cylinder(index){activeCylinder=index;draw();},log(value){useLog=value;dirty=true;draw();},reference(value){showReference=value;dirty=true;draw();}};
    const pointerDown=(e:PointerEvent)=>{if(e.button!==0||(e.target instanceof Element&&e.target.closest("button")))return;takeOver();drag={id:e.pointerId,x:e.clientX,y:e.clientY,yaw:yawTarget,tilt:tiltTarget,distance:0};area.setPointerCapture(e.pointerId);area.dataset.dragging="true";};
    const pointerMove=(e:PointerEvent)=>{if(!drag)return;const dx=e.clientX-drag.x;drag.distance=Math.abs(dx);yawTarget=drag.yaw+dx*.36;tiltTarget=clamp(drag.tilt+(e.clientY-drag.y)*.12,-12,18);run();};
    const pointerUp=(e:PointerEvent)=>{if(drag?.id!==e.pointerId)return;drag=null;area.dataset.dragging="false";if(area.hasPointerCapture(e.pointerId))area.releasePointerCapture(e.pointerId);};
    const key=(e:KeyboardEvent)=>{if(e.metaKey||e.ctrlKey||e.altKey)return;if(e.key===" "){e.preventDefault();if(!e.repeat)commands.current?.pause();}else if(e.key==="ArrowRight"||e.key==="ArrowLeft"){e.preventDefault();commands.current?.step(e.key==="ArrowRight"?5:-5);}else if(e.key.toLowerCase()==="r"){e.preventDefault();commands.current?.resetView();}};
    function graphSeek(e:PointerEvent){const rect=plot!.getBoundingClientRect(),x=(e.clientX-rect.left)*GRAPH.width/rect.width,y=(e.clientY-rect.top)*GRAPH.height/rect.height;const angle=nearestSample(cycle,x,y,useLog);seek(angle);}
    const graphDown=(e:PointerEvent)=>{if(e.button!==0)return;graphDrag=true;plot.setPointerCapture(e.pointerId);graphSeek(e);};
    const graphMove=(e:PointerEvent)=>{if(graphDrag)graphSeek(e);};
    const graphUp=(e:PointerEvent)=>{graphDrag=false;if(plot.hasPointerCapture(e.pointerId))plot.releasePointerCapture(e.pointerId);};
    const reduced=()=>{if(still.matches){auto=false;s.paused=true;syncUI("Reduced motion enabled. Use the cycle controls to inspect.");}draw();run();};
    const observer=new IntersectionObserver(entries=>{visible=Boolean(entries.at(-1)?.isIntersecting);if(visible)run();else{cancelAnimationFrame(frame);frame=0;}},{rootMargin:"100px 0px"});
    const resize=new ResizeObserver(()=>run());resize.observe(area);
    observer.observe(host);area.addEventListener("pointerdown",pointerDown);area.addEventListener("pointermove",pointerMove);area.addEventListener("pointerup",pointerUp);area.addEventListener("pointercancel",pointerUp);area.addEventListener("keydown",key);plot.addEventListener("pointerdown",graphDown);plot.addEventListener("pointermove",graphMove);plot.addEventListener("pointerup",graphUp);plot.addEventListener("pointercancel",graphUp);still.addEventListener("change",reduced);draw();
    return()=>{cancelAnimationFrame(frame);observer.disconnect();resize.disconnect();controller.destroy();area.removeEventListener("pointerdown",pointerDown);area.removeEventListener("pointermove",pointerMove);area.removeEventListener("pointerup",pointerUp);area.removeEventListener("pointercancel",pointerUp);area.removeEventListener("keydown",key);plot.removeEventListener("pointerdown",graphDown);plot.removeEventListener("pointermove",graphMove);plot.removeEventListener("pointerup",graphUp);plot.removeEventListener("pointercancel",graphUp);still.removeEventListener("change",reduced);commands.current=null;};
  },[turn,mesh,model]);
  React.useEffect(()=>{commands.current?.refresh();},[theme,highlight]);

  const slider=(id:keyof Pick<Controls,"throttle"|"targetRPM"|"load"|"advance"|"slow">,label:string,min:number,max:number,step:number,unit:string)=> <label className="engine-slider" key={id}><span>{label}<output>{id==="slow"?`${Math.round(1/controls.slow)}× slower`:controls[id].toLocaleString("en-US")+unit}</output></span><input type="range" min={min} max={max} step={step} value={controls[id]} onChange={e=>update(id,Number(e.target.value))}/></label>;
  return <figure ref={root} className="engine-lab iso" data-theme={theme} data-highlight={highlight}>
    <div className="engine-topbar"><span><b>FIG. 04</b><i/> ENGINE</span><div><span className="engine-state-dot"/><output data-value="status">Engine is off</output><Button variant="secondary" onClick={()=>setTheme(theme==="light"?"dark":"light")} aria-label={`Switch to ${theme==="light"?"night":"day"} view`}>{theme==="light"?"◐":"◑"}</Button></div></div>
    <div className="engine-gauges"><Gauge id="pressure" label={`Cylinder ${cylinder+1} pressure`} unit="bar" max={110}/><Gauge id="temperature" label={`Cylinder ${cylinder+1} temperature`} unit="°C" max={3200}/><Gauge id="torque" label="Turning force" unit="N·m" min={-20} max={120}/><Gauge id="rpm" label="Engine speed" unit="rpm" max={6500}/></div>
    <div className="engine-main">
      <div className="engine-visual-panel">
        <div className="engine-view-top"><span>Inside the engine <i/> <output data-value="renderer">3D view</output></span><div><Button variant="secondary" onClick={()=>{setCylinder(0);commands.current?.cylinder(0);}} aria-pressed={cylinder===0}>Cylinder 1</Button><Button variant="secondary" onClick={()=>{setCylinder(1);commands.current?.cylinder(1);}} aria-pressed={cylinder===1}>Cylinder 2</Button></div></div>
        <div ref={stage} className="engine-stage iso-turn" tabIndex={0} role="group" aria-label="Interactive engine. Drag to turn the view. Left and right arrows move the parts, Space pauses, and R resets the view.">
          <div className="engine-scene">{artwork}<canvas className="engine-gl" aria-hidden="true"/><svg className="engine-gas iso-layer" viewBox="0 0 1000 740" aria-hidden="true"><defs>{[0,1].map(i=><clipPath id={`engine-gas-${i}`} key={i}><path data-gas-clip={i}/></clipPath>)}</defs>{[0,1].map(i=><g key={i}><path data-gas={i}/><path data-spray={i} clipPath={`url(#engine-gas-${i})`} fill="#e2b467"/><g data-spark={i} opacity="0"><path d="M0 -6L1.5 -1.5L6 0L1.5 1.5L0 6L-1.5 1.5L-6 0L-1.5 -1.5Z" fill="#ffd28a"/><circle r="1.4" fill="#fffbea"/></g></g>)}</svg></div>
          <div className="engine-view-corner"><b>Drag to turn</b><span>Look inside the engine</span></div>
          <div className="engine-view-tools"><Button variant="secondary" onClick={()=>commands.current?.zoom(.1)} aria-label="Zoom in">+</Button><Button variant="secondary" onClick={()=>commands.current?.zoom(-.1)} aria-label="Zoom out">−</Button><Button variant="secondary" onClick={()=>commands.current?.tilt(6)} aria-label="Tilt view up">⌃</Button><Button variant="secondary" onClick={()=>commands.current?.tilt(-6)} aria-label="Tilt view down">⌄</Button><Button variant="secondary" onClick={()=>commands.current?.resetView()} aria-label="Reset 3D view">↺</Button></div>
        </div>
        <div className="engine-components">{COMPONENTS.map(p=><Button variant="secondary" key={p.id} aria-pressed={highlight===p.id} onClick={()=>setHighlight(highlight===p.id?"":p.id)}>{p.label}</Button>)}</div>
        <div className="engine-cylinder-strip"><span><i className="cylinder-one"/> 1 <b data-value="cylinder-phase-0">Air in</b></span><span><i className="cylinder-two"/> 2 <b data-value="cylinder-phase-1">Gas out</b></span><span>Top shaft <b data-value="cam-angle">0.0°</b></span></div>
      </div>
      <aside className="engine-controls" aria-label="Physical engine controls">
        <div className="engine-panel-title">Engine controls</div>
        <div className="engine-power-row"><Button variant="primary" className="engine-power" onClick={()=>commands.current?.power()}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2v7M5.5 4.8a6.6 6.6 0 1 0 9 0"/></svg>{ui.stall?"Restart engine":ui.running?"Stop engine":"Start engine"}</Button><Button variant="secondary" className="engine-pause" onClick={()=>commands.current?.pause()} aria-label={ui.paused?"Resume simulation":"Pause simulation"}>{ui.paused?"▷":"Ⅱ"}</Button></div>
        <div className="engine-control-note">Stop the engine or pause the animation.</div>
        {slider("throttle","Maximum power",0,100,1,"%")}
        <div className="engine-opening">Current power <output data-value="opening">12%</output></div>
        {slider("targetRPM","Target speed",600,6000,50," rpm")}
        <label className="engine-toggle"><span>Keep speed steady</span><input type="checkbox" checked={controls.governor} onChange={e=>update("governor",e.target.checked)}/><i/></label>
        {slider("load","Resistance",0,80,1," N·m")}
        <div className="engine-control-divider"/>
        <div className="engine-switch-row"><Button variant="secondary" aria-pressed={controls.ignition} onClick={()=>update("ignition",!controls.ignition)}><i/> Spark <b>{controls.ignition?"On":"Off"}</b></Button><Button variant="secondary" aria-pressed={controls.injection} onClick={()=>update("injection",!controls.injection)}><i/> Fuel <b>{controls.injection?"On":"Off"}</b></Button></div>
        {slider("advance","Spark timing",0,40,1,"°")}
        <div className="engine-control-divider"/>
        {slider("slow","Animation speed",.005,.1,.005,"")}
        <div className="engine-control-note">This changes how quickly the parts move on screen.</div>
      </aside>
    </div>
    <div className="engine-cycle-panel"><div className="engine-cycle-title"><span>How the engine works</span><output data-value="angle">0% through cycle</output></div><div className="engine-strokes">{STROKES.map((stroke,i)=><Button variant="secondary" key={stroke} data-stroke={i} aria-pressed={i===0} onClick={()=>commands.current?.seek(i*180+90)}><span>0{i+1}</span><strong>{STROKE_LABELS[i]}</strong></Button>)}</div><div className="engine-stepbar"><span>Move through the cycle</span><div><Button variant="secondary" onClick={()=>commands.current?.step(-5)}>← Previous</Button><Button variant="secondary" onClick={()=>commands.current?.step(5)}>Next →</Button><Button variant="secondary" onClick={()=>commands.current?.seek(360-controls.advance)}>See spark ↗</Button></div><span data-value="phase">Air in</span></div></div>
    <div className="engine-analysis"><section className="engine-pv"><div className="engine-panel-title">Pressure as the piston moves <span>Cylinder {cylinder+1}</span></div><div className="engine-graph-options"><label><input type="checkbox" checked={reference} onChange={e=>{setReference(e.target.checked);commands.current?.reference(e.target.checked);}}/> Show engine without fuel</label><label><input type="checkbox" checked={log} onChange={e=>{setLog(e.target.checked);commands.current?.log(e.target.checked);}}/> Show more detail</label></div>
      <svg ref={graph} className="engine-graph" viewBox="0 0 650 275" role="img" aria-label="Interactive pressure volume graph. Drag the curve to pause and inspect a crank angle."><g className="pv-grid">{[0,1,2,3].map(i=><line key={i} data-y-grid={i} x1="55" x2="610" y1={230-i*66} y2={230-i*66}/>)}{[50,150,250,350,450,500].map(v=><line key={v} x1={55+(v-40)/500*555} x2={55+(v-40)/500*555} y1="22" y2="230"/>)}</g><g className="pv-ticks">{[0,1,2,3].map(i=><text key={i} data-y-tick={i} x="44" y={233-i*66} textAnchor="end">{i*35}</text>)}{[50,150,250,350,450,500].map(v=><text key={v} x={55+(v-40)/500*555} y="246" textAnchor="middle">{v}</text>)}<text x="330" y="270" textAnchor="middle">VOLUME (cm³)</text><text transform="translate(15 128) rotate(-90)" textAnchor="middle">PRESSURE (bar)</text></g><path data-reference="" className="pv-reference"/>{[0,1,2,3].map(i=><path key={i} data-cycle-path={i} className={`pv-cycle pv-phase-${i}`}/>)}<line data-cursor-v="" className="pv-cursor" y1="22" y2="230"/><line data-cursor-h="" className="pv-cursor" x1="55" x2="610"/><circle data-live-halo="" r="7" className="pv-dot-halo"/><circle data-live-dot="" r="3" className="pv-dot"/></svg>
      <div className="engine-graph-bottom"><span>Drag the line to explore</span><output data-value="graph-point">—</output></div></section>
      <section className="engine-event-panel"><div className="engine-panel-title">Inside the cylinder</div><dl><div><dt>Air valve opening</dt><dd data-value="intake">0.00 mm</dd></div><div><dt>Exhaust valve opening</dt><dd data-value="exhaust">0.00 mm</dd></div><div><dt>Spark</dt><dd data-value="spark">Ready</dd></div><div><dt>Fuel</dt><dd data-value="injection">Off</dd></div><div><dt>Energy from one cycle</dt><dd data-value="work">—</dd></div><div><dt>Fuel used in one cycle</dt><dd data-value="fuel">—</dd></div></dl><p>These readings change as the parts move.</p></section></div>
    <span className="engine-sr" data-value="announcement" aria-live="polite"/>
  </figure>;
}
