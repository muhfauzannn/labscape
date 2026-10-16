import {MECH,mechanism,OFFSETS,sampleCycle,wrap} from "./model.mjs";

export function posesAt(degrees,yaw=0,tilt=0) {
  const m=mechanism(degrees),out={tilt,view:yaw,crank:-wrap(degrees),intakeCam:-wrap(degrees)/2,exhaustCam:-wrap(degrees)/2};
  for(let i=0;i<2;i++) {
    out[`piston${i}`]=i===0?m[i].pistonDrop:2*MECH.radius-m[i].pistonDrop;
    const a=m[i].rodAngle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
    out[`rod${i}`]={R:[1,0,0,0,c,-s,0,s,c],t:[0,m[i].pinY,m[i].pinZ-(MECH.crankZ+(i===0?MECH.radius:-MECH.radius))]};
    out[`valve${i}.0`]=m[i].intake;out[`valve${i}.1`]=m[i].exhaust;
  }
  return out;
}
const path=points=>points.map((p,i)=>`${i?"L":"M"}${p[0].toFixed(3)} ${p[1].toFixed(3)}`).join("")+"Z";
export function gasAt(project,degrees,cycle,yaw=0) {
  const m=mechanism(degrees),facing=Math.max(0,Math.min(1,Math.sin((68-yaw)*Math.PI/180)/.3));
  return m.map((p,i)=>{
    const x=MECH.x[i],sample=sampleCycle(cycle,degrees+OFFSETS[i]);
    const bottom=Math.min(153,p.wristZ+4.5),top=153.5;
    const corners=[[x-20.5,.1,bottom],[x+20.5,.1,bottom],[x+20.5,.1,top],[x-20.5,.1,top]];
    const shape=path(corners.map(project));
    const colour=sample.a<180?"#6f9d9e":sample.a<360?"#8a91a6":sample.a<540?"#c58d61":"#a5958c";
    const energy=Math.max(0,Math.min(1,(sample.T-350)/2300));
    const alpha=(.07+.23*energy+.07*Math.min(1,sample.p/5e6))*facing;
    const jetTop=project([x+9,.3,152]),jetLeft=project([x+4,.3,Math.max(bottom,128)]),jetRight=project([x+14,.3,Math.max(bottom,128)]);
    const sparkWorld=[x-10,1.6,150.6],star=project(sparkWorld);
    return {d:shape,corners,colour,alpha,spray:path([jetTop,jetLeft,jetRight]),sprayWorld:[[x+9,.3,152],[x+4,.3,Math.max(bottom,128)],[x+14,.3,Math.max(bottom,128)]],sprayAlpha:sample.inject*.6*facing,spark:star,sparkWorld,sparkAlpha:sample.spark*facing,burn:sample.burn*facing};
  });
}

export function effectVertices(gases,group) {
  const out=[];
  const colour=hex=>hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255);
  const tri=(a,b,c,ink,alpha)=>{for(const p of [a,b,c])out.push(...p,...ink,group,alpha,0);};
  for(const gas of gases) {
    const p=gas.corners,ink=colour(gas.colour);
    tri(p[0],p[1],p[2],ink,gas.alpha);tri(p[0],p[2],p[3],ink,gas.alpha);
    tri(...gas.sprayWorld,[.89,.7,.36],gas.sprayAlpha);
    const c=gas.sparkWorld,star=Array.from({length:16},(_,i)=>{const r=i%2?.4:1.6,a=i*Math.PI/8;return[c[0]+Math.cos(a)*r,c[1]+.2,c[2]+Math.sin(a)*r];});
    for(let i=0;i<16;i++)tri([c[0],c[1]+.2,c[2]],star[i],star[(i+1)%16],[1,.83,.52],gas.sparkAlpha);
  }
  return new Float32Array(out);
}

export const GRAPH={left:55,right:610,top:22,bottom:230,width:650,height:275};
export const graphPoint=(sample,log=false)=>{
  const x=GRAPH.left+(sample.V*1e6-40)/500*(GRAPH.right-GRAPH.left);
  const bar=sample.p/1e5;
  const normalized=log?(Math.log10(Math.max(.2,bar))-Math.log10(.2))/(Math.log10(110)-Math.log10(.2)):bar/110;
  return [x,GRAPH.bottom-normalized*(GRAPH.bottom-GRAPH.top)];
};
export function graphPaths(cycle,log=false) {
  return Array.from({length:4},(_,phase)=>cycle.samples.slice(phase*180,phase*180+181).map((s,i)=>{const p=graphPoint(s,log);return`${i?"L":"M"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`;}).join(""));
}
export function nearestSample(cycle,x,y,log=false) {
  let best=0,d=Infinity;
  for(let i=0;i<720;i++) {const p=graphPoint(cycle.samples[i],log),dist=(p[0]-x)**2+(p[1]-y)**2;if(dist<d){d=dist;best=i;}}
  return best;
}
