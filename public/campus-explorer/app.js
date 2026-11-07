/* A continuous painted campus. Original geographic records are retained in GEO. */
const $=id=>document.getElementById(id),canvas=$('world'),ctx=canvas.getContext('2d');
const VIEW=LAYOUT.view,worldPoint=p=>[VIEW.x+p[0]/LAYOUT.width*VIEW.w,VIEW.y+p[1]/LAYOUT.height*VIEW.h];
const names=[
 ['duke-chapel','Duke Chapel','Landmark · Music & reflection','A Gothic bell tower marks this illustrated West Campus landmark.','01','290','music'],
 ['bryan-center','Bryan Center','Student life · Arts & community','A student-life destination with theater and gathering spaces.','02','96','art'],
 ['penn-pavilion','Penn Pavilion','Gathering · Campus community','A low glass-fronted pavilion in the student-life area.','03','331','life'],
 ['fitzpatrick-center','Fitzpatrick Center','Engineering · Research','Two engineering wings frame a courtyard beneath a glass bridge.','04','98','engineering'],
 ['wilkinson-building','Wilkinson Engineering','Engineering · Innovation','Blue glass and vertical shading distinguish this engineering building.','05','366','engineering'],
 ['perkins-library','Perkins Library','Libraries · Study & discovery','Connected to Rubenstein and the raised passage to Bostock.','06','392','library'],
 ['bostock-library','Bostock Library','Libraries · A quiet corner','A stone-and-glass library beside Perkins.','07','399','library'],
 ['rubenstein-library','Rubenstein Library','Libraries · Rare books & history','A Gothic square tower marks the rare-book library beside Perkins.','08','1872','library'],
 ['innovation-co-lab','Innovation Co-Lab / TEC','Engineering · Make something','Co-Lab is represented within the Telecommunications Building.','09','206','engineering'],
 ['brodhead-center','Brodhead Center','Food · Friends & campus life','Historic stone meets a modern glass hall in the student-life area.','10','35','life']
];
const meta=Object.fromEntries(names.map(n=>[n[0],n])),images={},keys=new Set(),visited=new Set();
const painted=LAYOUT.buildings.map(b=>{const door=worldPoint(b.door);return {...b,x:door[0],y:door[1],polys:b.bodies.map(r=>r.map(worldPoint)),hits:(b.hits||b.bodies).map(r=>r.map(worldPoint))}});
const obstacles=LAYOUT.obstacles.map(o=>{const p=worldPoint([o.x,o.y]);return{x:p[0],y:p[1],rx:o.rx/LAYOUT.width*VIEW.w,ry:o.ry/LAYOUT.height*VIEW.h}});
const occluders=LAYOUT.occluders.map(o=>({depth:worldPoint([0,o.depth])[1],poly:o.poly.map(worldPoint),alpha:o.alpha??.78}));
let [px,py]=worldPoint(LAYOUT.spawn),[cx,cy]=worldPoint(LAYOUT.openingCamera);
let zoom=1.2,cw=1000,ch=800,dpr=1,ready=false,time=0,last=0,direction=0,follow=true,overview=false,filter='all',chosen=null,nearby=null,pan=null,dragged=false,welcomeHidden=false,route=[],destination=null,hover=null,lastNear=-100,toastUntil=0;
const PLAYER_SIZE=54;
const embedded=new URLSearchParams(window.location.search).get('embedded')==='1'&&window.parent!==window;
let suspended=false;
const startedAt=Date.now(), reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
function clearInput(cancelRoute=true){
 keys.clear(); hover=null; dragged=true;
 if(pan&&canvas.hasPointerCapture?.(pan.id))canvas.releasePointerCapture(pan.id);
 pan=null;
 for(const b of $('pad').querySelectorAll('button'))if(b._pointer!==undefined){if(b.hasPointerCapture?.(b._pointer))b.releasePointerCapture(b._pointer);delete b._pointer}
 if(cancelRoute){route=[];destination=null}
}
function sendHost(type,slug){if(embedded)window.parent.postMessage({channel:'cyber-duke-map',version:1,type,...(slug?{slug}:{})},window.location.origin)}
if(embedded){
 document.documentElement.classList.add('embedded');
 window.addEventListener('message',event=>{
  if(event.origin!==window.location.origin||event.source!==window.parent)return;
  const m=event.data;
  if(!m||m.channel!=='cyber-duke-host'||m.version!==1)return;
  if(m.type==='hello'){if(ready)sendHost('ready');return}
  if(m.type==='pause'&&typeof m.paused==='boolean'){suspended=m.paused;clearInput();canvas.dataset.paused=String(suspended);return}
  if(m.type==='clear-selection'){chosen=null;hover=null;route=[];destination=null;$('panel').hidden=true;renderList();return}
  if(!ready||typeof m.slug!=='string'||!painted.some(b=>b.slug===m.slug))return;
  if(m.type==='focus-building'){select(m.slug,true,true);route=[];destination=null}
  if(m.type==='walk-to'&&!suspended){select(m.slug,false,true);walkToChosen();canvas.focus()}
 });
}

const bitmaps={},bodyBounds=new Map();let occlusionLayers=[],sceneArt=null;
function baseZoom(){return cw<700?.9:1.2}
function ring(x,y,r){let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++){let a=r[i],b=r[j];if((a[1]>y)!=(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside}
for(const b of painted){const points=b.polys.flat();bodyBounds.set(b.slug,{x:Math.min(...points.map(p=>p[0])),y:Math.min(...points.map(p=>p[1])),right:Math.max(...points.map(p=>p[0])),bottom:Math.max(...points.map(p=>p[1]))})}
// Demonstrated planter/tree bases; keep the canopy and entrance stairs traversable.
for(const o of [{x:556,y:784,rx:21,ry:9},{x:453,y:804,rx:18,ry:8},{x:345,y:1139,rx:16,ry:7}]){
 const p=worldPoint([o.x,o.y]);obstacles.push({x:p[0],y:p[1],rx:o.rx/LAYOUT.width*VIEW.w,ry:o.ry/LAYOUT.height*VIEW.h});
}
const physics=CampusPhysics.create({bounds:VIEW,polygons:painted.flatMap(b=>b.polys),ellipses:obstacles,rx:8,ry:5});
function walk(x,y){return physics.canOccupy(x,y)}
function nearest(x,y){let n=null,d=Infinity;for(const b of painted){let dd=Math.hypot(x-b.x,y-b.y);for(const poly of b.polys)for(let i=0;i<poly.length;i++){const a=poly[i],z=poly[(i+1)%poly.length],dx=z[0]-a[0],dy=z[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));dd=Math.min(dd,Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy))}if(dd<d){d=dd;n=b}}return{building:n,distance:d}}
function hit(x,y){return [...painted].reverse().find(b=>b.hits.some(r=>ring(x,y,r)))}
function hideWelcome(){if(welcomeHidden)return;welcomeHidden=true;$('welcome').style.opacity=0;$('welcome').style.pointerEvents='none'}
function notice(text){$('map-status').textContent=text;$('welcome').textContent=text;welcomeHidden=false;$('welcome').style.opacity=1;$('welcome').style.pointerEvents='none';toastUntil=time+3.5}
function zone(x,y){const yy=(y-VIEW.y)/VIEW.h,xx=(x-VIEW.x)/VIEW.w;return yy>.66?'Student-life plaza':yy<.36?'Engineering quad':xx>.59?'Library courtyard':'Chapel gardens'}
function canvasPatch(im,x,y,w,h,dw=w,dh=h){const c=document.createElement('canvas');c.width=Math.max(1,Math.round(dw));c.height=Math.max(1,Math.round(dh));const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(im,x,y,w,h,0,0,c.width,c.height);return c}
function makeDetailMaster(base){
 const regions=[['nw',0,0,593,733],['ne',529,0,593,733],['sw',0,669,593,733],['se',529,669,593,733]];
 if(!regions.every(r=>images['detail-'+r[0]+'.png']?.naturalWidth))return base;
 const master=document.createElement('canvas');master.width=base.naturalWidth*2;master.height=base.naturalHeight*2;const m=master.getContext('2d');m.imageSmoothingEnabled=false;m.drawImage(base,0,0,master.width,master.height);
 for(const[name,x,y,w,h]of regions){
  const tile=document.createElement('canvas');tile.width=w*2;tile.height=h*2;const g=tile.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(images['detail-'+name+'.png'],0,0,tile.width,tile.height);
  // Adjacent detail restorations overlap in source coordinates. Feather only their shared margins.
  const blend=128;g.globalCompositeOperation='destination-in';
  if(x>0){const grad=g.createLinearGradient(0,0,blend,0);grad.addColorStop(0,'rgba(0,0,0,0)');grad.addColorStop(1,'rgba(0,0,0,1)');g.fillStyle=grad;g.fillRect(0,0,tile.width,tile.height)}
  else{const grad=g.createLinearGradient(tile.width-blend,0,tile.width,0);grad.addColorStop(0,'rgba(0,0,0,1)');grad.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=grad;g.fillRect(0,0,tile.width,tile.height)}
  if(y>0){const grad=g.createLinearGradient(0,0,0,blend);grad.addColorStop(0,'rgba(0,0,0,0)');grad.addColorStop(1,'rgba(0,0,0,1)');g.fillStyle=grad;g.fillRect(0,0,tile.width,tile.height)}
  else{const grad=g.createLinearGradient(0,tile.height-blend,0,tile.height);grad.addColorStop(0,'rgba(0,0,0,1)');grad.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=grad;g.fillRect(0,0,tile.width,tile.height)}
  m.drawImage(tile,x*2,y*2);
 }
 master.naturalWidth=master.width;master.naturalHeight=master.height;return master;
}
function prepareArt(){
 const atlas=images['texture-atlas.png'];if(atlas?.naturalWidth){const half=atlas.naturalWidth/2,paper=canvasPatch(atlas,0,half,half,half);document.documentElement.style.setProperty('--paper',`url(${paper.toDataURL()})`)}
 if(images['chapel-reference.webp']?.naturalWidth)$('crest').src=images['chapel-reference.webp'].src;
 const art=makeDetailMaster(images['campus-world.png']);sceneArt=art;for(const b of painted){let a=bodyBounds.get(b.slug),x=(a.x-VIEW.x)/VIEW.w*art.naturalWidth,y=(a.y-VIEW.y)/VIEW.h*art.naturalHeight,w=(a.right-a.x)/VIEW.w*art.naturalWidth,h=(a.bottom-a.y)/VIEW.h*art.naturalHeight;bitmaps[b.slug]=canvasPatch(art,x,y,w,h,Math.min(180,w),Math.min(180,w)*h/w)}
 makeOcclusionLayers(art);$('panel').hidden=true;if(chosen)updatePanel(chosen);ready=true;
}
function makeOcclusionLayers(art){
 const sx=art.naturalWidth/VIEW.w,sy=art.naturalHeight/VIEW.h;
 const definitions=painted.flatMap(b=>b.polys.map(poly=>({poly,depth:Math.max(...poly.map(p=>p[1])),building:true,foliage:false})));
 definitions.push(...occluders.map(o=>({...o,foliage:o.alpha!==1})));
 // The audited student-life tree's narrow trunk is separate from its canopy and planter base.
 definitions.push({poly:[[482,1110],[495,1110],[494,1180],[480,1180]].map(worldPoint),depth:worldPoint([0,1180])[1],foliage:false});
 definitions.push(...obstacles.map(o=>({poly:CampusPhysics.ellipsePolygon(o),depth:o.y+o.ry,foliage:false})));
 occlusionLayers=definitions.map(o=>{
  const x=Math.floor((Math.min(...o.poly.map(p=>p[0]))-VIEW.x)*sx),y=Math.floor((Math.min(...o.poly.map(p=>p[1]))-VIEW.y)*sy);
  const w=Math.ceil((Math.max(...o.poly.map(p=>p[0]))-VIEW.x)*sx)-x,h=Math.ceil((Math.max(...o.poly.map(p=>p[1]))-VIEW.y)*sy)-y;
  const mask=document.createElement('canvas');mask.width=w;mask.height=h;const g=mask.getContext('2d');
  pathShape(g,o.poly.map(p=>[(p[0]-VIEW.x)*sx-x,(p[1]-VIEW.y)*sy-y]));g.clip();g.drawImage(art,x,y,w,h,0,0,w,h);
  // Color only extracts leaf pixels INSIDE an authored canopy; the foot baseline decides depth.
  if(o.foliage){const pixels=g.getImageData(0,0,w,h),p=pixels.data;for(let i=0;i<p.length;i+=4){const r=p[i],green=p[i+1],b=p[i+2],gold=r>150&&green>65&&green>b*1.65&&r>green*.95&&r-green<120&&b<135,red=r>110&&r>green*1.5&&r>b*1.4&&green<160,leaf=green>45&&green>r*.85&&green>b*1.2;if(!(gold||red||leaf))p[i+3]=0}g.putImageData(pixels,0,0)}
  return {...o,mask,x:VIEW.x+x/sx,y:VIEW.y+y/sy,w:w/sx,h:h/sy};
 });
}
function isShown(n){const q=$('search').value.trim().toLowerCase();return(filter==='all'||n[6]===filter)&&(!q||n.join(' ').toLowerCase().includes(q))}
function renderList(){const list=names.filter(isShown);$('list').innerHTML=list.length?list.map(n=>`<button class="place ${chosen===n[0]?'active':''}" data-slug="${n[0]}" aria-pressed="${chosen===n[0]}"><span><strong>${n[1]}</strong><small>${n[2]}${visited.has(n[0])?' · discovered':''}</small></span></button>`).join(''):'<p class="empty">No buildings match.<br>Try Chapel, library or engineering.</p>';for(const b of $('list').querySelectorAll('button'))b.onclick=()=>select(b.dataset.slug,true)}
function updatePanel(slug){const n=meta[slug];$('panel-kicker').textContent='YOUR NEXT DISCOVERY';$('panel-name').textContent=n[1];$('panel-kind').textContent=n[2];$('panel-description').textContent=n[3];$('official-link').href='https://maps.duke.edu/?focus='+n[5];if(bitmaps[slug])$('panel-icon').src=bitmaps[slug].toDataURL()}
function select(slug,focus=false,silent=false){const b=painted.find(b=>b.slug===slug);if(!b)return;chosen=slug;visited.add(slug);if(focus){follow=false;overview=false;const a=bodyBounds.get(slug);cx=(a.x+a.right)/2;cy=(a.y+a.bottom)/2+50;zoom=cw<700?1.05:1.5;if(cw<700)cx=b.x;if(ch<500)cy=b.y-40/zoom}$('panel').hidden=embedded;updatePanel(slug);if(!silent){keys.clear();route=[];destination=null;sendHost('select-building',slug)}$('progress').textContent=`YOUR JOURNEY · ${visited.size} / 10 PLACES`;renderList();$('side').classList.remove('open')}
function setOverview(){overview=!overview;if(overview){follow=false;zoom=Math.min(cw/VIEW.w,ch/VIEW.h)*.97;cx=VIEW.x+VIEW.w/2;cy=VIEW.y+VIEW.h/2;$('panel').hidden=true;$('mode').textContent='WEST CAMPUS · FULL MAP'}else{follow=true;zoom=baseZoom();$('mode').textContent='Golden hour, all autumn'}$('overview').setAttribute('aria-pressed',String(overview));hideWelcome()}
function clampCamera(){const hw=cw/(2*zoom),hh=ch/(2*zoom);cx=hw*2>=VIEW.w?VIEW.x+VIEW.w/2:Math.max(VIEW.x+hw,Math.min(VIEW.x+VIEW.w-hw,cx));cy=hh*2>=VIEW.h?VIEW.y+VIEW.h/2:Math.max(VIEW.y+hh,Math.min(VIEW.y+VIEW.h-hh,cy))}
// Cardinal grid graph with diagonal, corner-safe movement. Free lawns remain traversable.
const STEP=12,COLS=Math.ceil(VIEW.w/STEP),ROWS=Math.ceil(VIEW.h/STEP),nav=new Uint8Array(COLS*ROWS);
function nodePoint(i){return[VIEW.x+(i%COLS+.5)*STEP,VIEW.y+(Math.floor(i/COLS)+.5)*STEP]}
function prepareNavigation(){for(let i=0;i<nav.length;i++){const p=nodePoint(i);nav[i]=walk(...p)?1:0}}
function closestNode(x,y,from=null){let cc=Math.floor((x-VIEW.x)/STEP),rr=Math.floor((y-VIEW.y)/STEP),best=-1,dist=Infinity;for(let r=Math.max(0,rr-8);r<=Math.min(ROWS-1,rr+8);r++)for(let c=Math.max(0,cc-8);c<=Math.min(COLS-1,cc+8);c++){let i=r*COLS+c;if(!nav[i])continue;let p=nodePoint(i);if(from&&!physics.segmentClear(...from,...p))continue;let d=(p[0]-x)**2+(p[1]-y)**2;if(d<dist){dist=d;best=i}}return best}
function routeTo(x,y){
 if(!walk(px,py))return false;
 const start=closestNode(px,py,[px,py]),goal=closestNode(x,y);if(start<0||goal<0)return false;
 const costs=new Float64Array(nav.length);costs.fill(Infinity);const parents=new Int32Array(nav.length);parents.fill(-1);const closed=new Uint8Array(nav.length),heap=[];
 const push=n=>{heap.push(n);let i=heap.length-1;while(i>0){let p=(i-1)>>1;if(heap[p][0]<=n[0])break;heap[i]=heap[p];i=p}heap[i]=n};
 const pop=()=>{let top=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let a=i*2+1,b=a+1,j=b<heap.length&&heap[b][0]<heap[a][0]?b:a;if(heap[j][0]>=last[0])break;heap[i]=heap[j];i=j}heap[i]=last}return top};
 const gc=goal%COLS,gr=Math.floor(goal/COLS),heuristic=i=>Math.hypot(i%COLS-gc,Math.floor(i/COLS)-gr);costs[start]=0;push([heuristic(start),start]);
 while(heap.length){const[,u]=pop();if(closed[u])continue;closed[u]=1;if(u===goal)break;const c=u%COLS,r=Math.floor(u/COLS);
  for(const[dc,dr]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const nc=c+dc,nr=r+dr;if(nc<0||nr<0||nc>=COLS||nr>=ROWS)continue;let v=nr*COLS+nc;if(!nav[v]||closed[v])continue;if(dc&&dr&&(!nav[r*COLS+nc]||!nav[nr*COLS+c]))continue;const up=nodePoint(u),vp=nodePoint(v);if(!physics.segmentClear(...up,...vp))continue;let cost=costs[u]+Math.hypot(dc,dr);if(cost<costs[v]){costs[v]=cost;parents[v]=u;push([cost+heuristic(v),v])}}
 }
 let reached=goal;
 if(!closed[goal]){reached=-1;let best=96*96;for(let i=0;i<closed.length;i++)if(closed[i]){const p=nodePoint(i),d=(p[0]-x)**2+(p[1]-y)**2;if(d<best){best=d;reached=i}}if(reached<0)return false}
 let path=[],u=reached;while(u!==start&&u>=0){path.push(nodePoint(u));u=parents[u]}path.push(nodePoint(start));path.reverse();const end=nodePoint(reached);if(walk(x,y)&&physics.segmentClear(...end,x,y))path.push([x,y]);route=path;destination=path.at(-1);overview=false;follow=true;zoom=Math.max(baseZoom(),zoom);hideWelcome();return true;
}
function recoverSpawn(){if(walk(px,py))return;const i=closestNode(px,py);if(i<0)throw new Error('No safe spawn position');[px,py]=nodePoint(i);clearInput()}
function walkToChosen(){if(suspended||!ready)return;const b=painted.find(b=>b.slug===chosen);if(!b)return;if(routeTo(b.x,b.y)){$('panel').hidden=true;notice('Walking through the illustration to '+meta[b.slug][1]+'.')}else notice('No illustrated route found. Try a nearby open plaza.')}
$('search').oninput=renderList;for(const b of document.querySelectorAll('[data-filter]'))b.onclick=()=>{filter=b.dataset.filter;for(const q of document.querySelectorAll('[data-filter]')){q.classList.toggle('active',q===b);q.setAttribute('aria-pressed',String(q===b))}renderList()};renderList();
$('guide-show').onclick=()=>select('duke-chapel',true);for(const b of document.querySelectorAll('.guide-shortcuts button'))b.onclick=()=>select(b.dataset.slug,true);
$('menu').onclick=()=>$('side').classList.toggle('open');$('close-panel').onclick=()=>$('panel').hidden=true;$('welcome-close').onclick=hideWelcome;$('walk-to').onclick=walkToChosen;
$('plus').onclick=()=>{overview=false;zoom=Math.min(2.7,zoom+.2)};$('minus').onclick=()=>{overview=false;zoom=Math.max(.42,zoom-.2)};$('follow').onclick=()=>{overview=false;follow=true;zoom=baseZoom();$('panel').hidden=true;hideWelcome()};$('overview').onclick=setOverview;$('mini-expand').onclick=setOverview;$('minimap').onclick=setOverview;$('minimap').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setOverview()}};$('near').onclick=()=>nearby&&select(nearby.slug);
function typing(e){return !!e.target.closest?.('input,textarea,select,[contenteditable=true]')}
const movement=['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'];
window.addEventListener('keydown',e=>{if(typing(e)||suspended||!ready||e.altKey||e.ctrlKey||e.metaKey)return;let k=e.key.toLowerCase();if(movement.includes(k)||k==='shift'){e.preventDefault();keys.add(k);route=[];destination=null;hideWelcome()}if(k==='e'&&!e.repeat&&nearby)select(nearby.slug);if(k==='m'&&!e.repeat)setOverview();if(k==='escape'){sendHost('escape');$('panel').hidden=true;$('side').classList.remove('open');route=[];destination=null}});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>clearInput());document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput()});
for(const b of $('pad').querySelectorAll('button')){
 b.onpointerdown=e=>{if(suspended||!ready)return;e.preventDefault();b._pointer=e.pointerId;b.setPointerCapture(e.pointerId);keys.add(b.dataset.key);route=[];destination=null;hideWelcome()};
 b.onpointerup=b.onpointercancel=b.onlostpointercapture=()=>{keys.delete(b.dataset.key);delete b._pointer};
}
function pointFromEvent(e){const r=canvas.getBoundingClientRect();return[(e.clientX-r.left-cw/2)/zoom+cx,(e.clientY-r.top-ch/2)/zoom+cy]}
canvas.onpointerdown=e=>{
 if(suspended||!ready||(e.button!==undefined&&e.button!==0))return;
 if(pan||e.isPrimary===false){clearInput();return}
 canvas.focus();canvas.setPointerCapture(e.pointerId);pan={id:e.pointerId,x:e.clientX,y:e.clientY,cx,cy};dragged=false;follow=false;hideWelcome();
};
canvas.onpointermove=e=>{
 if(suspended||!ready)return;
 if(pan){if(pan.id!==e.pointerId)return;let dx=e.clientX-pan.x,dy=e.clientY-pan.y;if(Math.hypot(dx,dy)>6)dragged=true;if(dragged){cx=pan.cx-dx/zoom;cy=pan.cy-dy/zoom}return}
 const p=pointFromEvent(e);hover=hit(...p);canvas.style.cursor=hover?'pointer':'grab';
};
canvas.onpointerup=e=>{
 if(suspended||!ready){clearInput();return}
 if(!pan||pan.id!==e.pointerId)return;
 const wasDragged=dragged;pan=null;
 if(canvas.hasPointerCapture?.(e.pointerId))canvas.releasePointerCapture(e.pointerId);
 if(!wasDragged){const p=pointFromEvent(e),b=hit(...p);if(b)select(b.slug);else if(walk(...p)&&!routeTo(...p))notice('No illustrated route found. Try a nearby open plaza.')}
};
canvas.onpointerleave=()=>{hover=null;canvas.style.cursor='grab'};
canvas.onpointercancel=canvas.onlostpointercapture=()=>{pan=null;dragged=true;keys.clear()};
canvas.addEventListener('wheel',e=>{
 if(suspended||!ready||e.ctrlKey||e.metaKey)return;
 e.preventDefault();const old=zoom;overview=false;zoom=Math.max(.42,Math.min(2.7,zoom*Math.exp(-e.deltaY*.001)));
 if(!follow){const r=canvas.getBoundingClientRect(),mx=e.clientX-r.left-cw/2,my=e.clientY-r.top-ch/2;cx+=mx/old-mx/zoom;cy+=my/old-my/zoom}hideWelcome();
},{passive:false});
function refreshPixelRatio(){const ratio=Math.min(2,Math.max(1,devicePixelRatio||1));if(ratio===dpr)return;dpr=ratio;canvas.width=Math.round(cw*dpr);canvas.height=Math.round(ch*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)}
window.addEventListener('resize',refreshPixelRatio);
new ResizeObserver(es=>{cw=es[0].contentRect.width;ch=es[0].contentRect.height;dpr=Math.min(2,Math.max(1,devicePixelRatio||1));canvas.width=Math.round(cw*dpr);canvas.height=Math.round(ch*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);if(overview)zoom=Math.min(cw/VIEW.w,ch/VIEW.h)*.97;else if(!ready)zoom=baseZoom();if(ready&&!overview&&!follow&&chosen){const b=painted.find(b=>b.slug===chosen);cx=b.x;cy=b.y-40/zoom}}).observe(canvas);
function pathShape(g,poly){g.beginPath();poly.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.closePath()}
function player(){ctx.fillStyle='#403c2859';ctx.beginPath();ctx.ellipse(px+1,py+1,9.5,3,0,0,Math.PI*2);ctx.fill();let im=images['student-walk.webp'];if(!im?.naturalWidth)return;const sw=im.naturalWidth/4,sh=im.naturalHeight/4,col=(!suspended&&(keys.size||route.length))?Math.floor(time*8)%4:1;ctx.drawImage(im,col*sw,direction*sh,sw,sh,Math.round(px-PLAYER_SIZE/2),Math.round(py-PLAYER_SIZE*34/36),PLAYER_SIZE,PLAYER_SIZE)}
function scene(g){const im=sceneArt||images['campus-world.png'];g.drawImage(im,VIEW.x,VIEW.y,VIEW.w,VIEW.h)}
function buildingBaseline(poly,x,fallback){
 const crossings=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];if(a[0]!==b[0]&&x>=Math.min(a[0],b[0])&&x<=Math.max(a[0],b[0]))crossings.push(a[1]+(x-a[0])/(b[0]-a[0])*(b[1]-a[1]))}return crossings.length?Math.max(...crossings):fallback;
}
function occludesAt(layer,x,y){const depth=layer.building?buildingBaseline(layer.poly,x,layer.depth):layer.depth;return y<depth&&x+PLAYER_SIZE/2>layer.x&&x-PLAYER_SIZE/2<layer.x+layer.w&&y>layer.y&&y-PLAYER_SIZE<layer.y+layer.h}
function drawOcclusion(){
 for(const layer of occlusionLayers)if(occludesAt(layer,px,py))ctx.drawImage(layer.mask,layer.x,layer.y,layer.w,layer.h);
}
function minimap(){const el=$('minimap'),r=el.getBoundingClientRect(),w=Math.round(r.width||198),h=Math.round(r.height||146);if(el.width!==Math.round(w*dpr)||el.height!==Math.round(h*dpr)){el.width=Math.round(w*dpr);el.height=Math.round(h*dpr)}let m=el.getContext('2d');m.setTransform(dpr,0,0,dpr,0,0);m.imageSmoothingEnabled=true;m.fillStyle='#e6d4a4';m.fillRect(0,0,w,h);m.drawImage(sceneArt||images['campus-world.png'],0,0,w,h);m.strokeStyle='#fff7d3';m.lineWidth=1.5;m.strokeRect((cx-cw/zoom/2-VIEW.x)/VIEW.w*w,(cy-ch/zoom/2-VIEW.y)/VIEW.h*h,cw/zoom/VIEW.w*w,ch/zoom/VIEW.h*h);m.fillStyle='#1554c7';m.strokeStyle='#fff9dd';m.lineWidth=1.5;m.beginPath();m.arc((px-VIEW.x)/VIEW.w*w,(py-VIEW.y)/VIEW.h*h,4,0,Math.PI*2);m.fill();m.stroke()}
// Screen-space labels retain readable CSS-pixel sizing at every zoom and DPR.
function screenPoint(x,y){return[(x-cx)*zoom+cw/2,(y-cy)*zoom+ch/2]}
function entranceMarker(){
 const selected=painted.find(b=>b.slug===chosen);
 const targets=[];
 if(selected&&!overview)targets.push([selected.x,selected.y]);
 if(destination&&(!selected||Math.hypot(destination[0]-selected.x,destination[1]-selected.y)>32))targets.push(destination);
 ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);
 for(const p of targets){const[x,y]=screenPoint(...p);ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);ctx.fillStyle='#fff2d6';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#163f83';ctx.stroke();ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fillStyle='#163f83';ctx.fill()}
 ctx.restore();
}
function overviewLabels(){
 const candidates=painted.filter(b=>overview||b.slug===chosen||b===hover).sort((a,b)=>Number(b.slug===chosen)*2+Number(b===hover)-Number(a.slug===chosen)*2-Number(a===hover));
 const boxes=[];
 // Reserve host controls and actual embedded HUD rectangles before placing labels.
 if(embedded){if(cw<700&&ch>500)boxes.push({x:0,y:0,w:cw,h:220});else boxes.push({x:cw-190,y:0,w:190,h:170})}
 for(const el of document.querySelectorAll('.top,.tools,.mini-shell,.bottom,.pad,.near,#map-status,.mapnote')){const r=el.getBoundingClientRect();if(!el.hidden&&r.width&&r.height)boxes.push({x:r.left,y:r.top,w:r.width,h:r.height})}
 const reserved=boxes.length;ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.textAlign='center';ctx.textBaseline='middle';
 for(const b of candidates){
  const active=b.slug===chosen,[x,y]=screenPoint(b.x,b.y);if(x<0||x>cw||y<0||y>ch)continue;
  const name=meta[b.slug][1];ctx.font=(active?'bold ':'')+'15px Georgia';
  const w=ctx.measureText(name).width+22,h=30;let box=null;
  for(const [offset,shift] of [-44,-80,18,54,-116,90,-152,126].flatMap(offset=>[0,-w,w].map(shift=>[offset,shift]))){
   const next={x:Math.max(8,Math.min(cw-w-8,x-w/2+shift)),y:Math.max(8,Math.min(ch-h-8,y+offset)),w,h};
   if(!boxes.some(r=>next.x<r.x+r.w+6&&next.x+next.w+6>r.x&&next.y<r.y+r.h+6&&next.y+next.h+6>r.y)){box=next;break}
  }
  if(!box)continue;boxes.push(box);ctx.fillStyle=active?'#173f83':'#fff1d8f5';ctx.fillRect(box.x,box.y,w,h);ctx.strokeStyle=active?'#fff2d6':b===hover?'#173f83':'#947246';ctx.lineWidth=active?3:1;ctx.strokeRect(box.x,box.y,w,h);ctx.fillStyle=active?'#fff6e3':'#3f2c1b';ctx.fillText(name,box.x+w/2,box.y+h/2);
 }
 canvas.dataset.labels=String(boxes.length-reserved);ctx.restore();
}
function paint(){ctx.fillStyle='#e1c990';ctx.fillRect(0,0,cw,ch);if(!ready){ctx.fillStyle='#725732';ctx.font='16px Georgia';ctx.textAlign='center';ctx.fillText('Preparing an autumn worth exploring…',cw/2,ch/2);return}ctx.save();ctx.translate(Math.round((cw/2-cx*zoom)*dpr)/dpr,Math.round((ch/2-cy*zoom)*dpr)/dpr);ctx.scale(zoom,zoom);ctx.imageSmoothingEnabled=false;scene(ctx);
 entranceMarker();player();drawOcclusion();
 ctx.restore();overviewLabels();minimap();debugOverlay();$('near').hidden=!nearby||!$('panel').hidden||overview;if(nearby)$('near-name').textContent=meta[nearby.slug][1];
}
const debugEnabled=new URLSearchParams(window.location.search).get('debug')==='1';
const debugProbes={
 'Chapel wall':[536,782],
 'Chapel steps':[503,825],
 'Fitzpatrick connector':[315,310],
 'Fitzpatrick front':[315,380],
 'Library passage':[985,488],
 'Library front':[985,555],
 'Planter front':[487,1206],
 'Planter behind':[487,1147]
};
if(debugEnabled){
 const panel=document.createElement('section');panel.id='physics-debug';panel.setAttribute('aria-label','Map developer tools');
 panel.innerHTML='<strong>Developer collision view</strong><label>Inspect location <select id="debug-probe">'+Object.keys(debugProbes).map(name=>'<option>'+name+'</option>').join('')+'</select></label><button id="debug-place">Place character</button><button id="debug-walk">Walk to probe</button><label><input id="debug-geometry" type="checkbox" checked> Show geometry</label><output id="debug-position"></output>';
 $('stage').appendChild(panel);
 $('debug-walk').onclick=()=>{if(!ready)return;const p=worldPoint(debugProbes[$('debug-probe').value]);if(!routeTo(...p))notice('No clear route to this probe.')};
 $('debug-place').onclick=()=>{if(!ready)return;clearInput();[px,py]=worldPoint(debugProbes[$('debug-probe').value]);recoverSpawn();cx=px;cy=py-50;follow=false;overview=false;zoom=2;chosen=null;clampCamera()};
}
function debugOverlay(){
 if(!debugEnabled)return;
 $('debug-position').textContent='Feet '+px.toFixed(1)+', '+py.toFixed(1)+' · '+(walk(px,py)?'clear':'blocked');
 if(!$('debug-geometry').checked)return;
 ctx.save();ctx.translate(cw/2-cx*zoom,ch/2-cy*zoom);ctx.scale(zoom,zoom);
 ctx.strokeStyle='#ef437d';ctx.lineWidth=1/zoom;for(const b of painted)for(const poly of b.polys){pathShape(ctx,poly);ctx.stroke()}
 for(const o of obstacles){pathShape(ctx,CampusPhysics.ellipsePolygon(o));ctx.stroke()}
 ctx.strokeStyle='#2ddadc';for(const o of occluders){pathShape(ctx,o.poly);ctx.stroke();ctx.beginPath();ctx.moveTo(Math.min(...o.poly.map(p=>p[0])),o.depth);ctx.lineTo(Math.max(...o.poly.map(p=>p[0])),o.depth);ctx.stroke()}
 ctx.strokeStyle='#ffea59';ctx.beginPath();ctx.moveTo(px,py);for(const p of route)ctx.lineTo(...p);ctx.stroke();
 ctx.strokeStyle='#ffffff';ctx.beginPath();ctx.ellipse(px,py,8,5,0,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#ff3870';ctx.fillRect(px-1,py-1,2,2);ctx.restore();
}
function tick(now){const dt=Math.min((now-last)/1000||0,.035);last=now;time+=dt;let dx=+(keys.has('d')||keys.has('arrowright'))-+(keys.has('a')||keys.has('arrowleft')),dy=+(keys.has('s')||keys.has('arrowdown'))-+(keys.has('w')||keys.has('arrowup'));
 if(ready&&!suspended&&(dx||dy||route.length)){const manual=!!(dx||dy);if(!manual){const target=route[0],dist=Math.hypot(target[0]-px,target[1]-py);if(dist<1.2){if(physics.segmentClear(px,py,...target)){[px,py]=target;route.shift();if(!route.length)destination=null}else{route=[];destination=null}}else{dx=(target[0]-px)/dist;dy=(target[1]-py)/dist}}
  if(dx||dy){direction=Math.abs(dx)>Math.abs(dy)?dx<0?1:2:dy<0?3:0;const n=Math.hypot(dx,dy),speed=keys.has('shift')?235:150;let travel=speed*dt;if(!manual&&route.length)travel=Math.min(travel,Math.hypot(route[0][0]-px,route[0][1]-py));dx=dx/n*travel;dy=dy/n*travel;const oldPx=px,oldPy=py;[px,py]=physics.move(px,py,dx,dy,manual);if(!manual&&Math.hypot(px-oldPx,py-oldPy)<.01){route=[];destination=null}if(manual){if(overview){overview=false;zoom=baseZoom()}follow=true}}
 }
 if(follow&&!suspended){cx+=(px-40-cx)*(reducedMotion?1:Math.min(1,dt*7));cy+=(py-110-cy)*(reducedMotion?1:Math.min(1,dt*7))}clampCamera();if(ready&&time-lastNear>.1){lastNear=time;const n=nearest(px,py);nearby=n.distance<92?n.building:null;$('location').textContent=n.distance<58?meta[n.building.slug][1]:zone(px,py)}if(toastUntil&&time>toastUntil){toastUntil=0;hideWelcome();$('map-status').textContent=''}paint();canvas.dataset.position=px.toFixed(1)+','+py.toFixed(1);canvas.dataset.selection=chosen||'';canvas.dataset.route=String(route.length);canvas.dataset.camera=[cx,cy,zoom].map(n=>n.toFixed(2)).join(',');window.__campus={x:px,y:py,zoom,ready,buildings:painted.length,visited:visited.size,overview,routeLength:route.length,scene:'continuous-painted-campus',season:'autumn',playerSize:PLAYER_SIZE,renderDpr:dpr,backgroundPixels:sceneArt?[sceneArt.naturalWidth,sceneArt.naturalHeight]:null};requestAnimationFrame(tick)}
function loadAsset(key,src){
 return new Promise((resolve,reject)=>{
  const im=new Image();images[key]=im;
  const timeout=setTimeout(()=>reject(new Error('Timed out loading '+key)),12000);
  im.onload=()=>{clearTimeout(timeout);resolve()};im.onerror=()=>{clearTimeout(timeout);reject(new Error('Could not load '+key))};
  im.src=src;if(im.complete&&im.naturalWidth){clearTimeout(timeout);resolve()}
 });
}
const required=['campus-world.png','student-walk.webp'];
Promise.all(required.map(key=>loadAsset(key,ASSETS[key]))).then(()=>{
 if(!ctx)throw new Error('Canvas unavailable');
 prepareArt();prepareNavigation();recoverSpawn()
 canvas.dataset.readyMs=String(Date.now()-startedAt);canvas.dataset.art='base';sendHost('ready');
 // Detail/texture assets enhance an already usable base world. They never gate navigation.
 return Promise.allSettled(Object.entries(ASSETS).filter(([key])=>!required.includes(key)).map(([key,src])=>loadAsset(key,src))).then(()=>{
  try{prepareArt();canvas.dataset.art=sceneArt===images['campus-world.png']?'base':'detail'}catch{notice('Using the base illustration; optional detail artwork is unavailable.')}
 });
}).catch(e=>{ready=false;notice('The illustrated map could not load. Please retry from the host page.');sendHost('error');console.error(e)});
requestAnimationFrame(tick);
