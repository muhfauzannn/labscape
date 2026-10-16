// Deterministic illustrative onion epidermis, with dimensions in specimen millimetres.
let seed=28;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
export const CELLS=Array.from({length:90},(_,row)=>Array.from({length:55},(_,col)=>{
 const x=(col-27)*.17+(row%2)*.085,y=(row-44)*.063;
 const vertices=Array.from({length:6},(_,i)=>{const a=i*Math.PI/3;return[x+Math.cos(a)*(.082+rand()*.007),y+Math.sin(a)*(.034+rand()*.004)];});
 return {x,y,vertices,nx:x+(rand()-.5)*.06,ny:y+(rand()-.5)*.017,tint:rand()};
})).flat();
export function drawSpecimen(canvas,m,s){
 const ctx=canvas.getContext('2d');if(!ctx)return;
 const size=520;if(canvas.width!==size){canvas.width=size;canvas.height=size;}
 ctx.clearRect(0,0,size,size);ctx.fillStyle='#141a19';ctx.fillRect(0,0,size,size);
 ctx.save();ctx.beginPath();ctx.arc(260,260,250,0,Math.PI*2);ctx.clip();
 const level=Math.sqrt(Math.max(0,Math.min(1,m.brightness))); // display gamma for optical throughput
 const bg=[246,232,202].map(v=>Math.round(v*level));ctx.fillStyle=`rgb(${bg})`;ctx.fillRect(0,0,size,size);
 if(level>.001){
  const px=500/m.field,blur=Math.min(28,m.blurObject/1000*px*.7+Math.max(0,m.resolution/1000*px-.5));
  ctx.filter=`blur(${blur.toFixed(2)}px)`;ctx.translate(260,260);
  // Real image is inverted; positive slide translation moves image in the opposite direction.
  ctx.scale(-px,-px);ctx.translate(s.x,s.y);
  for(const cell of CELLS){
   if(Math.abs(cell.x+s.x)>m.field*.56||Math.abs(cell.y+s.y)>m.field*.56)continue;
   ctx.beginPath();cell.vertices.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
   ctx.fillStyle=`rgba(163,82,121,${(.08+cell.tint*.12)*level})`;ctx.fill();
   ctx.lineWidth=.0015;ctx.strokeStyle=`rgba(104,61,97,${(.3+.35*(1-s.iris))*level})`;ctx.stroke();
   ctx.beginPath();ctx.ellipse(cell.nx,cell.ny,.007,.0045,.15,0,Math.PI*2);ctx.fillStyle=`rgba(85,42,97,${.67*level})`;ctx.fill();
   ctx.beginPath();ctx.ellipse(cell.nx-.001,cell.ny,.002,.0015,0,0,Math.PI*2);ctx.fillStyle=`rgba(60,25,76,${.6*level})`;ctx.fill();
  }
 }
 ctx.restore();
 const vignette=ctx.createRadialGradient(260,260,170,260,260,254);vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(0,0,0,.42)');ctx.fillStyle=vignette;ctx.fillRect(0,0,size,size);
 // Scale bar is derived from the field diameter, not a decorative fixed label.
 const bar=m.field>1?.5:m.field>.6?.2:.1,pixels=500*bar/m.field;
 ctx.strokeStyle='#ece5d2';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(260-pixels/2,446);ctx.lineTo(260+pixels/2,446);ctx.stroke();
 ctx.font='16px ui-monospace,monospace';ctx.textAlign='center';ctx.fillStyle='#f5eedf';ctx.fillText(`${bar*1000} µm`,260,471);
}
