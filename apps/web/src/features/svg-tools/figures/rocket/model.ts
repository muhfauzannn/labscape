/** Invented educational vehicle, sea-level gravity, pressure-matched exhaust, no drag. */
export const VEHICLE = { initialMass: 12_000, dryMass: 3_600, maxThrust: 180_000, exhaustVelocity: 3_000, gravity: 9.80665, duration: 6 } as const;
export interface Flight { time:number; height:number; velocity:number; mass:number; throttle:number; started:boolean; finished:boolean; }
export const freshFlight = ():Flight => ({ time:0, height:0, velocity:0, mass:VEHICLE.initialMass, throttle:0, started:false, finished:false });
export function forces(s:Flight) {
  const thrust=s.throttle*VEHICLE.maxThrust;
  const weight=s.mass*VEHICLE.gravity;
  const freeAcceleration=(thrust-weight)/s.mass;
  return { thrust,weight,ratio:thrust/weight,acceleration:s.height<=0&&freeAcceleration<0?0:freeAcceleration,flow:thrust/VEHICLE.exhaustVelocity };
}
export function stepFlight(s:Flight, target:number, dt:number):Flight {
  if(!s.started||s.finished) return s;
  const next={...s};
  const steps=Math.max(1,Math.ceil(dt*240)),h=Math.min(dt,VEHICLE.duration-s.time)/steps;
  for(let i=0;i<steps;i++) {
    next.throttle+=(Math.max(0,Math.min(1,target))-next.throttle)*(1-Math.exp(-h/.42));
    if(next.mass<=VEHICLE.dryMass) next.throttle=0;
    const f=forces(next);
    next.mass=Math.max(VEHICLE.dryMass,next.mass-f.flow*h);
    const acceleration=(f.thrust-next.mass*VEHICLE.gravity)/next.mass;
    const height=next.height+next.velocity*h+.5*acceleration*h*h;
    next.velocity=Math.max(height<=0?0:-Infinity,next.velocity+acceleration*h);
    next.height=Math.max(0,height);
    next.time+=h;
  }
  if(next.time>=VEHICLE.duration-1e-7) {next.time=VEHICLE.duration;next.finished=true;}
  return next;
}
export function snapshot(target:number,seconds=3) {
  let s={...freshFlight(),started:true};
  for(let t=0;t<seconds;t+=1/120) s=stepFlight(s,target,Math.min(1/120,seconds-t));
  return s;
}
