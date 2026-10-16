/** Educational single-zone cycle + transient, cycle-averaged shaft dynamics. SI units. */
export const ENGINE={bore:.082,stroke:.086,rod:.143,compression:10,cylinders:2,gamma:1.35,R:287,cv:820,LHV:44e6,AFR:14.7,inertia:.22,ambient:101325,wall:430};
export const RAD=Math.PI/180;
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const wrap=(n,period=720)=>((n%period)+period)%period;
export const STROKES=["Intake","Compression","Combustion","Exhaust"];
export const OFFSETS=[0,540];
export const SWEPT=Math.PI*ENGINE.bore**2/4*ENGINE.stroke;
export const CLEARANCE=SWEPT/(ENGINE.compression-1);
export const DEFAULTS={throttle:70,targetRPM:1800,load:12,advance:22,ignition:true,injection:true,governor:true,slow:.025};

export function displacement(degrees) {
  const theta=degrees*RAD,r=ENGINE.stroke/2,l=ENGINE.rod;
  return r*(1-Math.cos(theta))+l-Math.sqrt(l*l-r*r*Math.sin(theta)**2);
}
export const volume=degrees=>CLEARANCE+SWEPT*displacement(degrees)/ENGINE.stroke;
export function valveLift(degrees,type) {
  const a=wrap(degrees),centre=type==="intake"?90:630;
  // Flat follower on a convex base-circle/nose-circle cam; 180° crank opening.
  return (2/.52/1000)*Math.max(0,1-(1-Math.cos((a-centre)*RAD/2))/(1-Math.cos(Math.PI/4)));
}
export const burnFraction=(a,start,duration)=>a<=start?0:1-Math.exp(-6.9*clamp((a-start)/duration,0,1)**3);
export function phaseOf(degrees) {return STROKES[Math.min(3,Math.floor(wrap(degrees)/180))];}

export function makeCycle({throttle=.5,rpm=1800,advance=22,ignition=true,injection=true}={}) {
  const airPressure=ENGINE.ambient*(.23+.75*clamp(throttle,0,1));
  const airTemp=325,exhaustPressure=ENGINE.ambient*1.055;
  const speed=Math.max(350,rpm),duration=42+speed/550;
  const sparkAt=360-clamp(advance,0,40),burnAt=sparkAt+3;
  const trapped=airPressure*volume(180)/(ENGINE.R*airTemp);
  const fuel=injection?trapped/ENGINE.AFR:0;
  const heat=ignition&&injection?fuel*ENGINE.LHV*.7:0;
  const samples=[];
  let temp=airTemp,mass=trapped,p=airPressure,work=0,peak=0;
  for(let a=0;a<=720;a++) {
    const V=volume(a),Vprev=volume(Math.max(0,a-1));
    if(a<=180) {p=airPressure;temp=airTemp;mass=p*V/(ENGINE.R*temp);}
    else if(a<540) {
      mass=trapped;
      const dq=heat*(burnFraction(a,burnAt,duration)-burnFraction(a-1,burnAt,duration));
      temp=temp*(Vprev/V)**(ENGINE.gamma-1)+dq/(mass*ENGINE.cv);
      // Wall transfer acts over physical crank time; high speed leaves less time.
      temp+=(ENGINE.wall-temp)*(1-Math.exp(-1/(speed*6*.18)));
      temp=Math.max(220,temp);p=mass*ENGINE.R*temp/V;
      // Smooth blowdown, beginning as the exhaust event opens at BDC.
    } else {p=exhaustPressure;temp=600+Math.min(450,heat/(trapped*ENGINE.cv)*.08);mass=p*V/(ENGINE.R*temp);}
    if(a) work+=(p+samples[a-1].p)/2*(V-Vprev);
    peak=Math.max(peak,p);
    const dv=(volume(a+.01)-volume(a-.01))/(.02*RAD);
    const torque=(p-ENGINE.ambient)*dv;
    const spark=Math.exp(-(((a-sparkAt)/3.1)**2))*(ignition?1:0);
    const injected=injection&&a>20&&a<20+Math.max(15,95*throttle)?Math.sin(Math.PI*(a-20)/Math.max(15,95*throttle)):0;
    samples.push({a,V,p,T:temp,mass,torque,intake:valveLift(a,"intake"),exhaust:valveLift(a,"exhaust"),spark,inject:injected,burn:heat?Math.max(0,burnFraction(a,burnAt,duration)-burnFraction(a-8,burnAt,duration))*4:0});
  }
  return {samples,work,meanTorque:work*ENGINE.cylinders/(4*Math.PI),peak,fuel,airPressure,sparkAt,throttle,rpm};
}
export function sampleCycle(cycle,degrees) {
  const a=wrap(degrees),i=Math.floor(a),t=a-i,A=cycle.samples[i],B=cycle.samples[i+1];
  /** @type {Record<string,number>} */
  const out={};for(const key of Object.keys(A))out[key]=A[key]+(B[key]-A[key])*t;
  return out;
}
export function initialPlant() {return {rpm:0,omega:0,angle:0,time:0,opening:.12,integral:0,running:false,paused:true,starter:0,brakeTorque:0,indicatedTorque:0,cycles:0,stall:false};}
export function startPlant(state) {state.running=true;state.paused=false;state.starter=1.35;state.stall=false;state.integral=0;}
export function stopPlant(state) {state.running=false;state.paused=false;state.starter=0;state.integral=0;}
export function frictionAt(rpm) {return 4.3+.0045*rpm+1.7e-7*rpm*rpm;}
export function advancePlant(state,controls,dt,cycle) {
  if(state.paused)return state;
  const n=Math.max(1,Math.ceil(dt*240)),h=dt/n;
  for(let i=0;i<n;i++) {
    const limit=controls.throttle/100,error=(controls.targetRPM-state.rpm)/1800;
    const demand=.08+error*.6+state.integral;
    if(state.running&&controls.governor&&((demand<limit&&demand>0)||(demand>=limit&&error<0)||(demand<=0&&error>0)))state.integral=clamp(state.integral+error*h*.42,-.15,.8);
    const requested=controls.governor?clamp(.08+error*.6+state.integral,0,limit):limit;
    const target=state.running?requested:0;
    state.opening+=(target-state.opening)*(1-Math.exp(-h/.18));
    const ignition=state.running&&controls.ignition&&controls.injection;
    // Cycle is recalculated at the actual manifold opening and RPM by the caller.
    const indicated=ignition?cycle.meanTorque:Math.min(0,cycle.meanTorque);
    state.indicatedTorque=indicated;
    state.brakeTorque=indicated-frictionAt(state.rpm);
    let starter=0;
    if(state.starter>0) {state.starter=Math.max(0,state.starter-h);starter=state.rpm<720?50:0;}
    const net=state.brakeTorque-controls.load+starter;
    state.omega=Math.max(0,state.omega+net/ENGINE.inertia*h);
    if(state.rpm<50&&starter===0&&net<0)state.omega=0;
    state.rpm=state.omega*60/(2*Math.PI);
    if(state.rpm>6500) {state.omega=6500*2*Math.PI/60;state.rpm=6500;}
    state.angle+=state.rpm*6*h*controls.slow;
    state.time+=h;state.cycles=Math.floor(state.angle/720);
    state.stall=state.running&&state.starter===0&&state.rpm<80;
  }
  return state;
}

export function cycleForPlant(state,controls) {
  return makeCycle({throttle:state.opening,rpm:state.rpm,advance:controls.advance,ignition:state.running&&controls.ignition&&state.rpm>250&&state.rpm<6200,injection:state.running&&controls.injection&&state.rpm>250});
}
/** A reduced-motion operating point is reached by integration, never by assigning RPM. */
export function settlePlant(state,controls,seconds=12) {
  const angle=state.angle,wasPaused=state.paused;
  state.paused=false;let cycle=cycleForPlant(state,controls);
  for(let i=0;i<seconds*120;i++){if(i%6===0)cycle=cycleForPlant(state,controls);advancePlant(state,controls,1/120,cycle);}
  state.angle=angle;state.paused=wasPaused;return state;
}

/** World mechanics, millimetre-like drawing units; exact 180° twin kinematics. */
export const MECH={scale:.52,crankZ:49,rod:ENGINE.rod*1000*.52,radius:ENGINE.stroke*500*.52,x:[-31,31],headZ:155};
export function mechanism(degrees) {
  return OFFSETS.map(offset=>{
    const a=wrap(degrees+offset),theta=a*RAD,r=MECH.radius,l=MECH.rod;
    const pinY=r*Math.sin(theta),pinZ=MECH.crankZ+r*Math.cos(theta);
    const wristZ=pinZ+Math.sqrt(l*l-pinY*pinY);
    return {a,pinY,pinZ,wristZ,rodAngle:Math.asin(pinY/l)/RAD,pistonDrop:displacement(a)*1000*MECH.scale,intake:valveLift(a,"intake")*1000*MECH.scale,exhaust:valveLift(a,"exhaust")*1000*MECH.scale};
  });
}
