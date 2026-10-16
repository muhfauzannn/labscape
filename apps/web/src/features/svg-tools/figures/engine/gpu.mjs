import {TURN} from "../../../../components/iso/turn.mjs";
import {effectVertices} from "./view.mjs";

export const VERTEX=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in float aGroup;
layout(location=3) in float aMaterial;
layout(location=4) in float aCategory;
uniform mat4 uGroups[20];
uniform vec4 uCam;
uniform vec2 uOrigin;
uniform float uScale;
uniform vec2 uView;
uniform vec2 uCanvas;
uniform int uPass;
out vec3 vNormal;
out float vAlpha;
flat out int vMaterial;
flat out int vCategory;
void main(){
  mat4 pose=uGroups[int(aGroup)];
  vec3 p=(pose*vec4(aPosition,1.)).xyz;
  vec2 q=uOrigin+uScale*vec2(uCam.x*p.x-uCam.y*p.y,uCam.z*(uCam.y*p.x+uCam.x*p.y)-uCam.w*p.z);
  float depth=dot(p,vec3(uCam.y*uCam.w,uCam.x*uCam.w,uCam.z));
  vec2 pixel=(q-uView*.5)*min(uCanvas.x/uView.x,uCanvas.y/uView.y);
  gl_Position=vec4(pixel.x/uCanvas.x*2.,-pixel.y/uCanvas.y*2.,-depth/600.,1.);
  vNormal=uPass==2?aNormal:mat3(pose)*aNormal;vAlpha=aMaterial;vMaterial=int(aMaterial);vCategory=int(aCategory);
}`;
export const FRAGMENT=`#version 300 es
precision highp float;
in vec3 vNormal;
in float vAlpha;
flat in int vMaterial;
flat in int vCategory;
uniform vec3 uRamp[40];
uniform vec3 uEdge[8];
uniform vec3 uLight;
uniform vec3 uBackground;
uniform int uPass;
uniform int uHighlight;
out vec4 outColor;
void main(){
  if(uPass==2){outColor=vec4(vNormal*vAlpha,vAlpha);return;}
  vec3 ink;
  if(uPass==1){ink=uEdge[vMaterial];}
  else{
    float s=dot(normalize(vNormal),uLight);
    int i=vMaterial*5;
    ink=mix(uRamp[i],uRamp[i+1],smoothstep(-.025,.025,s));
    ink=mix(ink,uRamp[i+2],smoothstep(.175,.225,s));
    ink=mix(ink,uRamp[i+3],smoothstep(.395,.445,s));
    ink=mix(ink,uRamp[i+4],smoothstep(.595,.645,s));
  }
  if(uHighlight>0&&vCategory!=uHighlight)ink=mix(ink,uBackground,.78);
  outColor=vec4(ink,1.);
}`;
const colour=hex=>hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255);
export function palettes(materials,theme) {
  const css=TURN.materialCss(),ramp=[],edge=[];
  for(const name of materials) {
    if(name==="ceramic") {ramp.push(...["#aab5ad","#bcc5bd","#d0d8cd","#e2e8de","#f6f8ee"].flatMap(colour));edge.push(...colour(theme==="light"?"#828d81":"#8e9c90"));continue;}
    const selector=`.iso[data-theme="${theme}"] [data-mat="${name}"]{`,at=css.indexOf(selector),block=css.slice(at+selector.length,css.indexOf("}",at));
    const p=Object.fromEntries([...block.matchAll(/--anatomy-([\w-]+):([^;}]+)/g)].map(m=>[m[1],m[2]]));
    const lift=theme==="dark"?(name==="rubber"?.015:name==="gunmetal"?.045:.09):0;
    ramp.push(...[p["shade-0"],p["shade-1"],p["shade-2"],p["shade-3"],p.top].flatMap(hex=>colour(hex).map(v=>v+(.8-v)*lift)));edge.push(...colour(p.lo).map(v=>v+(.75-v)*(theme==="dark"?.18:0)));
  }
  return {ramp:new Float32Array(ramp),edge:new Float32Array(edge)};
}
export function unpack(text,Type=Float32Array){const binary=atob(text),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return new Type(bytes.buffer);}
export function groupMatrices(cams) {
  const out=new Float32Array(20*16);for(let i=0;i<20;i++){out[i*16]=1;out[i*16+5]=1;out[i*16+10]=1;out[i*16+15]=1;}
  cams.forEach((c,i)=>{const R=c.R,t=c.t;out.set([R[0],R[3],R[6],0,R[1],R[4],R[7],0,R[2],R[5],R[8],0,t[0],t[1],t[2],1],(i+1)*16);});
  return out;
}
export function mountGPU(canvas,mesh,P,host) {
  const gl=canvas.getContext("webgl2",{alpha:true,antialias:true,premultipliedAlpha:true,powerPreference:"low-power"});
  if(!gl)return null;
  const resources=[];
  function shader(type,source){const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));resources.push(["shader",sh]);return sh;}
  let program;
  try {program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,VERTEX));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,FRAGMENT));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));}
  catch(error){console.error("Engine 3D renderer:",error);for(const [,sh]of resources)gl.deleteShader(sh);if(program)gl.deleteProgram(program);return null;}
  const loc=name=>gl.getUniformLocation(program,name);
  const uniforms=Object.fromEntries(["uGroups[0]","uCam","uOrigin","uScale","uView","uCanvas","uRamp[0]","uEdge[0]","uLight","uBackground","uPass","uHighlight"].map(name=>[name,loc(name)]));
  const makeBuffer=(target,array)=>{const b=gl.createBuffer();gl.bindBuffer(target,b);gl.bufferData(target,array,gl.STATIC_DRAW);resources.push(["buffer",b]);return b;};
  const vertices=makeBuffer(gl.ARRAY_BUFFER,unpack(mesh.vertices)),index=makeBuffer(gl.ELEMENT_ARRAY_BUFFER,unpack(mesh.indices,Uint32Array)),edges=makeBuffer(gl.ARRAY_BUFFER,unpack(mesh.edges)),gasBuffer=makeBuffer(gl.ARRAY_BUFFER,new Float32Array());
  const bind=buffer=>{gl.bindBuffer(gl.ARRAY_BUFFER,buffer);for(const [i,size,offset]of [[0,3,0],[1,3,3],[2,1,6],[3,1,7],[4,1,8]]){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,size,gl.FLOAT,false,36,offset*4);}};
  const az=(P.azimuth??68)*Math.PI/180,e=(P.elevation??24)*Math.PI/180;
  // Use the kit's exact orthographic camera, including its internal scale factor.
  const sceneCamera=TURN.camera(P),scale=sceneCamera.k;
  let lost=false,lastTheme="",palette=null;
  const onLost=e=>{e.preventDefault();lost=true;canvas.style.display="none";host.dataset.renderer="svg";};
  canvas.addEventListener("webglcontextlost",onLost);
  return {get active(){return !lost;},draw(cams){
    if(lost)return;
    const dpr=Math.min(window.devicePixelRatio||1,1.5),w=Math.max(1,Math.round(canvas.clientWidth*dpr)),h=Math.max(1,Math.round(canvas.clientHeight*dpr));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.BLEND);gl.useProgram(program);
    const theme=host.dataset.theme??"light",background=colour(theme==="light"?"#eeeee7":"#171c1b");
    if(theme!==lastTheme){palette=palettes(mesh.materials,theme);lastTheme=theme;}
    gl.uniformMatrix4fv(uniforms["uGroups[0]"],false,groupMatrices(cams));gl.uniform4f(uniforms.uCam,Math.sin(az),Math.cos(az),Math.sin(e),Math.cos(e));
    gl.uniform2f(uniforms.uOrigin,sceneCamera.ox,sceneCamera.oy);gl.uniform1f(uniforms.uScale,scale);gl.uniform2f(uniforms.uView,1000,740);gl.uniform2f(uniforms.uCanvas,w,h);gl.uniform3fv(uniforms["uRamp[0]"],palette.ramp);gl.uniform3fv(uniforms["uEdge[0]"],palette.edge);gl.uniform3fv(uniforms.uBackground,background);
    const length=Math.hypot(1,1.2);gl.uniform3f(uniforms.uLight,-Math.sin(az)/length,Math.cos(az)/length,1.2/length);
    gl.uniform1i(uniforms.uHighlight,{piston:1,crank:2,cam:3,valve:4,plug:5,injector:6}[host.dataset.highlight]??0);
    bind(vertices);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1,1);gl.uniform1i(uniforms.uPass,0);gl.drawElements(gl.TRIANGLES,mesh.triangleCount*3,gl.UNSIGNED_INT,0);gl.disable(gl.POLYGON_OFFSET_FILL);
    bind(edges);gl.uniform1i(uniforms.uPass,1);gl.drawArrays(gl.LINES,0,mesh.edgeCount*2);
  },effects(gases,group){if(lost)return;const data=effectVertices(gases,group);bind(gasBuffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.uniform1i(uniforms.uPass,2);gl.drawArrays(gl.TRIANGLES,0,data.length/9);gl.depthMask(true);gl.disable(gl.BLEND);},destroy(){canvas.removeEventListener("webglcontextlost",onLost);for(const [kind,r]of resources){if(kind==="buffer")gl.deleteBuffer(r);else gl.deleteShader(r);}gl.deleteProgram(program);}};
}

export function mountEngineRenderer(area,data,mesh,host) {
  const canvas=area.querySelector(".engine-gl"),scene=TURN.prepare(data),gpu=mountGPU(canvas,mesh,data.P,host);
  let fallback=null,cams=TURN.cams(scene,{});
  const ensureFallback=()=>{if(!fallback)fallback=TURN.mount(area,data,{});host.dataset.renderer="svg";canvas.style.display="none";return fallback;};
  if(gpu){host.dataset.renderer="webgl";}else ensureFallback();
  return {get mode(){return gpu?.active?"DEPTH-TESTED 3D":"SVG FALLBACK / FIXED VIEW";},set(values){
    const t=performance.now();
    if(gpu?.active){cams=TURN.cams(scene,values);gpu.draw(cams);return{ms:performance.now()-t};}
    return ensureFallback().set({...values,view:0,tilt:0});
  },effects(gases){if(gpu?.active)gpu.effects(gases,scene.groups.findIndex(g=>g.name==="view")+1);},anchor(name,point){return gpu?.active?TURN.anchor(scene,cams,name,point):ensureFallback().anchor(name,point);},destroy(){gpu?.destroy();fallback?.destroy();delete host.dataset.renderer;}};
}
