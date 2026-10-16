"use client";

import { Button } from "@/components/ui/button";
import * as React from "react";
import { forces,freshFlight,snapshot,stepFlight } from "./model";

const PARTS=[
  {id:"nose",name:"Nose",title:"A smooth path through the air.",description:"The pointed nose helps the rocket move through the air."},
  {id:"tank",name:"Fuel tanks",title:"Fuel for the flight.",description:"Two tanks hold what the engines need to launch. Open the rocket to look inside."},
  {id:"engine",name:"Engines",title:"Gas down. Rocket up.",description:"The engines push hot gas down, lifting the rocket up."},
  {id:"fins",name:"Fins",title:"Keep the rocket steady.",description:"The fins help keep the rocket pointed in the right direction."},
];
interface RocketModel {width:number;height:number;zscale:number;unitsPerMeter:number;solids:number;}

export function RocketLive({artwork,model}:{artwork:React.ReactNode;model:RocketModel}) {
  const root=React.useRef<HTMLElement>(null),stage=React.useRef<HTMLDivElement>(null);
  const actions=React.useRef<{launch():void;reset():void;throttle(value:number):void;touch():void}|null>(null);
  const [theme,setTheme]=React.useState<"light"|"dark">("light");
  const [cutaway,setCutaway]=React.useState(false);
  const [selected,setSelected]=React.useState<string>("");
  const [throttle,setThrottle]=React.useState(85);
  const [mode,setMode]=React.useState<"ready"|"running"|"paused"|"finished">("ready");
  const description=PARTS.find(p=>p.id===selected)??PARTS[2];

  React.useEffect(()=>{
    const host=root.current,area=stage.current;
    if(!host||!area) return;
    const svg=area.querySelector("svg")!;
    const flight=svg.querySelector<SVGGElement>("[data-flight]")!;
    const deck=svg.querySelector<SVGGElement>("[data-deck]")!;
    const scene=svg.querySelector<SVGGElement>("[data-scene]")!;
    const jets=Array.from(svg.querySelectorAll<SVGGElement>("[data-jet]"));
    const shocks=Array.from(svg.querySelectorAll<SVGEllipseElement>("[data-shock]"));
    const pool=svg.querySelector<SVGPathElement>("[data-pool]")!;
    const outputs=Object.fromEntries(Array.from(host.querySelectorAll<HTMLElement>("[data-value]")).map(el=>[el.dataset.value!,el]));
    const thrustBar=host.querySelector<HTMLElement>("[data-thrust-bar]")!;
    const weightBar=host.querySelector<HTMLElement>("[data-weight-bar]")!;
    const still=window.matchMedia("(prefers-reduced-motion: reduce)");
    let state=freshFlight(),target=.85,paused=false,frame=0,previous=0,visible=false;
    let tour=!still.matches,clock=0,cycle=0,plumeClock=0,hover=false,focused=false;
    let lastPhase="",lastReadout=0;
    const say=(key:string,text:string)=>{if(outputs[key])outputs[key].textContent=text;};
    function draw() {
      const f=forces(state),worldRise=state.height*model.unitsPerMeter;
      const rise=Math.min(worldRise,62),tracking=Math.max(0,worldRise-62);
      flight.setAttribute("transform",`translate(0 ${(-rise*model.zscale).toFixed(3)})`);
      deck.setAttribute("transform",`translate(0 ${(tracking*model.zscale).toFixed(3)})`);
      const intensity=state.throttle;
      jets.forEach((jet,i)=>{
        jet.style.opacity=String(intensity*.92);
        const variation=still.matches||paused||state.finished?1:1+.025*Math.sin(plumeClock*9+i*2);
        jet.setAttribute("transform",`scale(${(.55+.45*intensity).toFixed(4)} ${((.18+.82*intensity)*variation).toFixed(4)})`);
      });
      shocks.forEach((el,i)=>{
        const pulse=still.matches||paused||state.finished?1:.8+.2*Math.sin(plumeClock*7-i*.7);
        el.style.opacity=String((.23-(i%4)*.035)*pulse);
      });
      pool.style.opacity=String(intensity*Math.max(0,1-state.height/8));
      const phase=state.finished?"Flight complete":!state.started?"Ready to launch":paused?"Flight paused":state.height>.005?"Rocket is rising":f.thrust>0?"Engines started":"Ready to launch";
      if(phase!==lastPhase) {say("phase",phase);say("announce",phase.toLowerCase()+".");lastPhase=phase;}
      if(clock-lastReadout>.06||paused||state.finished||!state.started||still.matches) {
        say("height",state.height.toFixed(1));say("velocity",state.velocity.toFixed(1));
        say("thrust",(f.thrust/1000).toFixed(1));say("ratio",f.ratio.toFixed(2));
        say("force-thrust",`${(f.thrust/1000).toFixed(1)} kN`);say("force-weight",`${(f.weight/1000).toFixed(1)} kN`);
        say("readout",!state.started?"Ready to launch":`${state.time.toFixed(1)} seconds into flight`);
        lastReadout=clock;
      }
      thrustBar.style.width=`${f.thrust/180000*100}%`;
      weightBar.style.width=`${f.weight/180000*100}%`;
    }
    const markMode=()=>setMode(state.finished?"finished":!state.started?"ready":paused?"paused":"running");
    const takeOver=()=>{tour=false;scene.style.opacity="1";};
    function reset() {state=freshFlight();paused=false;markMode();lastReadout=-1;draw();}
    function launch() {
      takeOver();
      if(!state.started||state.finished) {
        state=still.matches?snapshot(target,6):{...freshFlight(),started:true};paused=false;
      } else paused=!paused;
      markMode();lastReadout=-1;draw();run();
    }
    function tick(now:number) {
      const dt=previous?Math.min((now-previous)/1000,1/30):1/60;previous=now;clock+=dt;
      const inspecting=tour&&(hover||focused);
      if(tour&&!still.matches&&!inspecting) {
        cycle+=dt;
        if(cycle>2&&!state.started) {state={...freshFlight(),started:true};markMode();}
        if(cycle>16) scene.style.opacity=String(Math.max(0,1-(cycle-16)/.8));
        if(cycle>17) {reset();cycle=-1.6;scene.style.opacity="0";}
        if(cycle<0) scene.style.opacity=String(Math.min(1,(cycle+1.6)/.8));
      }
      if(state.started&&!paused&&!state.finished&&!inspecting) {
        state=stepFlight(state,target,dt);plumeClock+=dt;
        if(state.finished) markMode();
      }
      draw();
      const active=!inspecting&&(tour||(state.started&&!paused&&!state.finished&&!still.matches));
      frame=visible&&active?requestAnimationFrame(tick):0;
    }
    function run() {if(!visible||frame)return;previous=0;frame=requestAnimationFrame(tick);}
    const observer=new IntersectionObserver(entries=>{
      visible=Boolean(entries.at(-1)?.isIntersecting);
      if(visible)run();else{cancelAnimationFrame(frame);frame=0;}
    },{rootMargin:"80px 0px"});
    const onKey=(e:KeyboardEvent)=>{
      if(e.metaKey||e.ctrlKey||e.altKey)return;
      if(e.key===" "||e.key==="Enter"){e.preventDefault();if(!e.repeat)launch();}
      else if(e.key==="Escape"||e.key.toLowerCase()==="r"){e.preventDefault();takeOver();reset();run();}
      else if(e.key==="ArrowUp"||e.key==="ArrowDown") {e.preventDefault();takeOver();target=Math.max(0,Math.min(1,target+(e.key==="ArrowUp"?.05:-.05)));setThrottle(Math.round(target*100));run();}
      else if(e.key.toLowerCase()==="c") {e.preventDefault();takeOver();setCutaway(v=>!v);}
    };
    const onStillness=()=>{if(still.matches){tour=false;paused=true;markMode();}draw();run();};
    const onEnter=()=>{hover=true;};
    const onLeave=()=>{hover=false;run();};
    const onFocus=()=>{focused=true;};
    const onBlur=()=>{focused=false;run();};
    const onClick=(e:MouseEvent)=>{
      if(!(e.target instanceof Element))return;
      const part=e.target.closest<SVGGElement>("[data-assembly]")?.dataset.assembly;
      if(part&&part!=="deck") {takeOver();setSelected(v=>v===part?"":part);if(part==="tank")setCutaway(true);}
    };
    actions.current={launch,reset(){takeOver();reset();run();},touch:takeOver,throttle(value){takeOver();target=value/100;if(still.matches&&state.started){state=snapshot(target,6);paused=false;markMode();}draw();run();}};
    observer.observe(area);area.addEventListener("keydown",onKey);area.addEventListener("pointerenter",onEnter);area.addEventListener("pointerleave",onLeave);area.addEventListener("focus",onFocus);area.addEventListener("blur",onBlur);svg.addEventListener("click",onClick);still.addEventListener("change",onStillness);draw();
    return()=>{cancelAnimationFrame(frame);observer.disconnect();area.removeEventListener("keydown",onKey);area.removeEventListener("pointerenter",onEnter);area.removeEventListener("pointerleave",onLeave);area.removeEventListener("focus",onFocus);area.removeEventListener("blur",onBlur);svg.removeEventListener("click",onClick);still.removeEventListener("change",onStillness);actions.current=null;};
  },[model]);

  function select(id:string) {actions.current?.touch();setSelected(selected===id?"":id);if(id==="tank")setCutaway(true);}

  return <figure ref={root} className="rocket iso" data-theme={theme} data-cutaway={cutaway} data-focus={selected}>
    <div className="rocket-card">
      <div className="rocket-card-top"><span><b>FIG. 03</b><i/> ROCKET LAUNCH</span><Button variant="secondary" onClick={()=>setTheme(theme==="light"?"dark":"light")} aria-label={`Switch to ${theme==="light"?"night":"day"} view`}>{theme==="light"?"◐ Night view":"◑ Day view"}</Button></div>
      <div className="rocket-workbench">
        <div ref={stage} className="rocket-stage" tabIndex={0} role="group" aria-label="Rocket launch. Press Space to launch or pause. Up and down change engine power. C shows the inside. R starts over.">
          <div className="rocket-scene-note">ROCKET LAUNCH<span>WATCH THE ROCKET RISE</span></div>
          {artwork}
          <div className="rocket-direction" aria-hidden="true"><span><b>↑</b> ROCKET</span><span><b>↓</b> EXHAUST</span></div>
          <div className="rocket-stage-corner"><b data-value="phase">Ready to launch</b></div>
        </div>
        <aside className="rocket-panel" aria-label="Rocket parts and launch controls">
          <div className="rocket-panel-heading"><i/> Explore the rocket</div>
          <ol className="rocket-part-list">{PARTS.map((p,i)=><li key={p.id}><Button variant="secondary" aria-pressed={selected===p.id} onClick={()=>select(p.id)}><span>0{i+1}</span><strong>{p.name}</strong><i>{selected===p.id?"−":"+"}</i></Button></li>)}</ol>
          <div className="rocket-part-description"><h3>{description.title}</h3><p>{description.description}</p></div>
          <label className="rocket-cutaway">Show inside rocket<input type="checkbox" checked={cutaway} onChange={e=>{actions.current?.touch();setCutaway(e.target.checked);}}/><i aria-hidden="true"/></label>
          <div className="rocket-throttle"><label htmlFor="rocket-throttle">Engine power<output>{throttle}%</output></label><input id="rocket-throttle" type="range" min="0" max="100" step="1" value={throttle} onChange={e=>{const value=Number(e.target.value);setThrottle(value);actions.current?.throttle(value);}}/><div className="rocket-range-notes"><span>Off</span><span>Full power</span></div></div>
          <div className="rocket-force"><div>Engine push ↑<span><i data-thrust-bar=""/></span><b data-value="force-thrust">0.0 kN</b></div><div>Rocket weight ↓<span><i data-weight-bar=""/></span><b data-value="force-weight">117.7 kN</b></div></div>
          <Button variant="primary" className="rocket-launch" onClick={()=>actions.current?.launch()}><span aria-hidden="true">{mode==="running"?"Ⅱ":mode==="paused"?"▷":"↑"}</span>{mode==="running"?"Pause flight":mode==="paused"?"Resume flight":mode==="finished"?"Launch again":"Launch rocket"}</Button>
          <Button variant="secondary" className="rocket-reset" onClick={()=>actions.current?.reset()}>↻ Start over</Button>
        </aside>
      </div>
      <div className="rocket-card-bottom"><span>Press Space to launch</span><output data-value="readout">Ready to launch</output></div>
    </div>
    <dl className="rocket-telemetry"><div><dt>Height</dt><dd><span data-value="height">0.0</span><small>m</small></dd></div><div><dt>Climbing speed</dt><dd><span data-value="velocity">0.0</span><small>m/s</small></dd></div><div><dt>Engine push</dt><dd><span data-value="thrust">0.0</span><small>kN</small></dd></div><div><dt>Lift vs. weight</dt><dd><span data-value="ratio">0.00</span><small>×</small></dd></div></dl>
    <span className="rocket-sr" data-value="announce" aria-live="polite"/>
    <figcaption className="rocket-sr">The engines push gas down to lift the rocket. This illustration shows six seconds of flight. <a href="https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/rocket-thrust-equation/">Learn how rocket engines work at NASA</a>.</figcaption>
  </figure>;
}
