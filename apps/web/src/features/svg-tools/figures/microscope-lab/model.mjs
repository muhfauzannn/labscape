export const OBJECTIVES=[
  {power:4,na:.10,colour:'#a85550',name:'Scanning'},
  {power:10,na:.25,colour:'#b99642',name:'Low power'},
  {power:40,na:.65,colour:'#4e7fa8',name:'High dry'},
];
export const PARTS=[
  {id:'eyepiece',name:'Eyepiece',short:'Ocular',tag:'01',role:'Magnify the intermediate image',body:'A 10× ocular acts as a magnifier for the real image formed by the objective. Its field stop defines the visible circular field.',connect:['head'],chain:'Objective → intermediate image → eyepiece → eye',move:[0,26,115],anchor:[0,48,264],fact:'10× · field number 18 mm'},
  {id:'head',name:'Optical head & body tube',short:'Optical head',tag:'02',role:'Keep the image planes aligned',body:'The rigid body holds the optical spacing. A prism folds the path into the inclined viewing tube; the objective forms an inverted real image near the ocular field lens.',connect:['arm','objective','eyepiece'],chain:'Arm → head mount → folded body tube → ocular',move:[0,0,72],anchor:[0,24,227],fact:'Finite-tube teaching system · 160 mm'},
  {id:'objective',name:'Objective lenses & nosepiece',short:'Objectives',tag:'03',role:'Form the first magnified image',body:'The objective collects light transmitted by the specimen and forms a real, inverted image. The revolving nosepiece brings a different objective onto the optical axis.',connect:['head','slide'],chain:'Specimen → active objective → real intermediate image',move:[0,100,30],anchor:[0,12,148],fact:'4× / 0.10 · 10× / 0.25 · 40× / 0.65'},
  {id:'slide',name:'Specimen slide',short:'Specimen',tag:'04',role:'Place a thin sample in the focal plane',body:'The glass slide carries the specimen and its coverslip. Moving the slide right makes its image move left: the objective reverses the image in both lateral directions.',connect:['stage','objective','condenser'],chain:'Condenser → thin specimen → objective',move:[0,68,38],anchor:[0,12,106.6],fact:'Illustrated specimen · onion epidermis'},
  {id:'stage',name:'Mechanical stage',short:'Stage',tag:'05',role:'Position and support the specimen',body:'The stage aperture passes transmitted light. The slide holder and X/Y drives move the sample laterally; the focus carriage moves the stage vertically without moving the optical head.',connect:['focus','slide','condenser'],chain:'Focus rack → stage carriage → slide holder → specimen',move:[0,52,13],anchor:[37,35,103],fact:'X/Y translation · Z focusing'},
  {id:'condenser',name:'Condenser & iris diaphragm',short:'Condenser',tag:'06',role:'Shape the illumination cone',body:'The condenser concentrates illumination onto the specimen. Its aperture iris controls the illumination angle: closing it reduces brightness and effective aperture while increasing depth of field.',connect:['base','stage','slide'],chain:'Collector → condenser + iris → specimen',move:[0,65,-25],anchor:[0,12,83],fact:'Adjustable illumination numerical aperture'},
  {id:'focus',name:'Coarse & fine focus',short:'Focus drive',tag:'07',role:'Move the specimen into focus',body:'The coarse drive turns a pinion against the stage rack for large movements. The concentric fine control makes much smaller adjustments. Both change the specimen–objective spacing, not magnification.',connect:['arm','stage'],chain:'Focus knob → pinion → rack → stage → focal plane',move:[-50,0,0],anchor:[-37.7,-43,77],fact:'Coarse: mm · fine: µm'},
  {id:'arm',name:'Arm & support frame',short:'Arm',tag:'08',role:'Hold the optical and mechanical axes',body:'The cast frame joins the head to the base and guides the focus carriage. Its stiffness keeps the objective centered over the specimen as the stage travels.',connect:['base','head','focus'],chain:'Base → rigid arm → head + focus bearings',move:[-45,-37,0],anchor:[15,-43,151],fact:'Rigid cast support · dovetail guide'},
  {id:'base',name:'Base & illuminator',short:'Illuminator',tag:'09',role:'Provide stable, adjustable light',body:'A weighted base supports the instrument. The LED and collector direct light upward into the condenser; the intensity control changes illumination without changing magnification.',connect:['arm','condenser'],chain:'LED → collector → field stop → condenser',move:[0,0,0],anchor:[19,39,14],fact:'Transmitted brightfield illumination'},
];
export const DEFAULTS={objective:1,coarse:0,fine:12,iris:.78,light:.8,power:true,x:0,y:0};
export function optics(s){
  const obj=OBJECTIVES[s.objective],M=obj.power,wavelength=.55;
  const focus=s.coarse*1000+s.fine; // µm, positive raises specimen toward objective
  const f=160/(M+1),u=160/M-focus/1000,v=1/(1/f-1/u);
  const illuminationNA=obj.na*(.2+.8*s.iris),effectiveNA=Math.min(obj.na,illuminationNA);
  const pupil=2*f*effectiveNA;
  const blurImage=Math.abs(pupil*(160/v-1));
  const blurObject=blurImage/M*1000;
  return {obj,total:M*10,field:18/M,resolution:.61*wavelength/effectiveNA,dof:wavelength/(effectiveNA*effectiveNA),focus,u,v,imageShift:v-160,blurObject,brightness:s.power?s.light*((.2+.8*s.iris)**2):0,stage:focus/1000,sharpness:Math.exp(-Math.abs(focus)/(wavelength/(effectiveNA*effectiveNA)))};
}
export function stageOffset(part,focus){return ['stage','slide','condenser'].includes(part)?focus/1000:0;}
export function componentOffset(part,share,focus=0,x=0,y=0){
  const move=PARTS.find(p=>p.id===part)?.move??[0,0,0];
  return [move[0]*share+(part==='slide'?x:0),move[1]*share+(part==='slide'?y:0),move[2]*share+stageOffset(part,focus)];
}
export function rayWorld(s){
  const m=optics(s),z=106.7+m.stage,r=3+4*s.iris;
  const imageOffset=Math.max(-7,Math.min(7,m.imageShift*.07)),front=[139,128,113][s.objective];
  return [-1,0,1].map(side=>[[side*5,12,21],[side*r,12,88+m.stage],[0,12,z],[side*4.2,12,front],[side*4,12,169],[side*3,12,201],[side*2,30+imageOffset*.5,236+imageOffset],[side*-3,43,260],[side*-4.5,55,280]]);
}
