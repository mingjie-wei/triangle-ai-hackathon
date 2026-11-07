import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const root = new URL('../public/campus-explorer/', import.meta.url);
function boot() {
  const nodes = new Map(), listeners = new Map(), out = [], frames = [];
  const make = () => ({ value:'',hidden:false,dataset:{},style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},querySelectorAll:()=>[],setAttribute(){},addEventListener(){},getContext:()=>({setTransform(){}}),focus(){},getBoundingClientRect:()=>({width:1200,height:900,left:0,top:0}) });
  const get = id => { if (!nodes.has(id)) nodes.set(id,make()); return nodes.get(id); };
  const padButtons=['w','a','s','d'].map(key=>({...make(),dataset:{key},setPointerCapture(){},releasePointerCapture(){}}));
  get('pad').querySelectorAll=()=>padButtons;
  const parent = { postMessage:(data,origin)=>out.push({data,origin}) };
  const window = { parent,location:{search:'?embedded=1',origin:'https://campus.example'},addEventListener:(k,f)=>listeners.set(k,f) };
  const context = vm.createContext({window,document:{getElementById:get,documentElement:make(),querySelectorAll:()=>[],addEventListener:(k,f)=>listeners.set(k,f)},URLSearchParams,console,setTimeout:()=>1,clearTimeout:()=>{},devicePixelRatio:1,Image:class {},ResizeObserver:class{observe(){}},requestAnimationFrame:f=>frames.push(f)});
  vm.runInContext(readFileSync(new URL('data.js',root),'utf8')+'\n'+readFileSync(new URL('physics.js',root),'utf8')+'\n'+readFileSync(new URL('app.js',root),'utf8'),context);
  vm.runInContext('ready=true;prepareNavigation();paint=()=>{}',context);
  const run = code => vm.runInContext(code,context);
  const send = (data,origin=window.location.origin,source=parent) => listeners.get('message')({data:{channel:'cyber-duke-host',version:1,...data},origin,source});
  return {out,send,run,nodes,listeners,frames,window,padButtons};
}
test('embedded selection emits a slug for the host and hides the duplicate panel',()=>{
  const c=boot();c.run("select('duke-chapel')");
  assert.equal(c.out.at(-1).data.slug,'duke-chapel');
  assert.equal(c.out.at(-1).origin,'https://campus.example');
  assert.equal(c.nodes.get('panel').hidden,true);
});
test('host camera focus and ready handshake do not echo a selection',()=>{
  const c=boot();c.send({type:'hello'});assert.equal(c.out.at(-1).data.type,'ready');
  c.out.length=0;c.send({type:'focus-building',slug:'bostock-library'});
  assert.equal(c.run('chosen'),'bostock-library');assert.equal(c.run('follow'),false);assert.equal(c.out.length,0);
});
test('foreign origins, sibling frames, unknown slugs and protocol versions cannot control the map',()=>{
  const c=boot();const initial=c.run('chosen');
  c.send({type:'focus-building',slug:'duke-chapel'},'https://evil.example');
  c.send({type:'focus-building',slug:'duke-chapel'},undefined,{});
  c.send({type:'focus-building',slug:'unknown'});
  c.send({type:'focus-building',slug:'duke-chapel',version:2});
  assert.equal(c.run('chosen'),initial);
});
test('walk commands reach every painted entrance; pause freezes motion and clears held keys',()=>{
  const c=boot();const buildings=JSON.parse(c.run('JSON.stringify(painted.map(b=>({slug:b.slug,x:b.x,y:b.y})))'));
  let clock=1000;
  for (const b of buildings) {
    c.run('[px,py]=worldPoint(LAYOUT.spawn);route=[];destination=null');
    c.send({type:'walk-to',slug:b.slug});assert(c.run('route.length')>0,b.slug);
    let steps=0;
    while(c.run('route.length')&&steps++<8000){clock+=30;c.run(`tick(${clock})`);assert(c.run('walk(px,py)'),b.slug+' collision')}
    assert(steps<8000,b.slug);assert(c.run(`Math.hypot(px-${b.x},py-${b.y})`)<32,b.slug);
  }
  c.send({type:'walk-to',slug:'duke-chapel'});c.run("keys.add('d')");c.send({type:'pause',paused:true});
  const x=c.run('px'),y=c.run('py');clock+=30;c.run(`tick(${clock})`);assert(c.run('walk(px,py)'),'collision');
  assert.equal(c.run('keys.size'),0);assert.equal(c.run('px'),x);assert.equal(c.run('py'),y);
  c.send({type:'pause',paused:false});assert.equal(c.run('suspended'),false);
});
test('E opens the nearby building, Escape informs the host, and 54px avatar is retained',()=>{
  const c=boot();c.run("nearby=painted.find(b=>b.slug==='duke-chapel')");
  const key=key=>c.listeners.get('keydown')({key,repeat:false,target:{closest:()=>null},preventDefault(){}});
  key('e');assert.equal(c.out.at(-1).data.slug,'duke-chapel');key('Escape');assert.equal(c.out.at(-1).data.type,'escape');
  assert.equal(c.run('PLAYER_SIZE'),54);
});
test('all artwork URLs resolve inside the static bundle',()=>{
  const c=boot();const assets=JSON.parse(c.run('JSON.stringify(ASSETS)'));
  for (const path of Object.values(assets)) assert(existsSync(fileURLToPath(new URL(path,root))),path);
  assert.equal(Object.keys(assets).length,8);
});
test('pause cancels routes and blocks canvas and touch input until a new deliberate action',()=>{
 const c=boot();c.send({type:'walk-to',slug:'duke-chapel'});assert(c.run('route.length')>0);
 c.run("pan={id:1,x:0,y:0,cx,cy};keys.add('w')");
 c.send({type:'pause',paused:true});assert.equal(c.run('route.length'),0);assert.equal(c.run('pan'),null);
 c.nodes.get('world').onpointerdown({pointerId:3,clientX:200,clientY:200});
 c.nodes.get('world').onpointerup({pointerId:3,clientX:200,clientY:200});
 c.send({type:'walk-to',slug:'bryan-center'});
 assert.equal(c.run('keys.size'),0);assert.equal(c.run('route.length'),0);
 c.send({type:'pause',paused:false});assert.equal(c.run('route.length'),0);
});
test('lost capture, window blur and hidden document clear active input',()=>{
 const c=boot();c.run("pan={id:1};keys.add('w')");c.nodes.get('world').onlostpointercapture();
 assert.equal(c.run('pan'),null);assert.equal(c.run('keys.size'),0);
 c.run("keys.add('d');route=[[1,2]]");c.listeners.get('blur')();assert.equal(c.run('route.length'),0);
 c.run("keys.add('w');document.hidden=true");c.listeners.get('visibilitychange')();assert.equal(c.run('keys.size'),0);
});

test('D-pad capture cancellation and suspension never leave held movement',()=>{
 const c=boot(),up=c.padButtons[0];
 up.onpointerdown({pointerId:7,preventDefault(){}});assert.equal(c.run("keys.has('w')"),true);
 up.onpointercancel();assert.equal(c.run('keys.size'),0);
 up.onpointerdown({pointerId:8,preventDefault(){}});c.send({type:'pause',paused:true});
 up.onpointerdown({pointerId:9,preventDefault(){}});assert.equal(c.run('keys.size'),0);
 c.send({type:'pause',paused:false});up.onpointerdown({pointerId:10,preventDefault(){}});
 up.onlostpointercapture();assert.equal(c.run('keys.size'),0);
});
test('idle has no implicit selection; only valid host clear removes explicit selection and route',()=>{
 const c=boot();assert.equal(c.run('chosen'),null);
 c.send({type:'walk-to',slug:'duke-chapel'});
 c.send({type:'clear-selection'},'https://foreign.example');assert.equal(c.run('chosen'),'duke-chapel');
 c.send({type:'clear-selection'});assert.equal(c.run('chosen'),null);assert.equal(c.run('route.length'),0);
 assert.equal(c.out.filter(x=>x.data.type==='select-building').length,0);
});
test('screen-space labels stay readable, unnumbered and non-overlapping at DPR 1 and 2',()=>{
 for(const [width,height] of [[1440,900],[390,844],[844,390]])for(const ratio of [1,2]){
  const c=boot();c.run(`cw=${width};ch=${height};dpr=${ratio};chosen='duke-chapel';setOverview();
   var labelsDrawn=[],rectsDrawn=[],transforms=[];
   Object.assign(ctx,{save(){},restore(){},setTransform(...args){transforms.push(args)},measureText(t){return {width:t.length*8}},fillRect(x,y,w,h){rectsDrawn.push({x,y,w,h})},strokeRect(){},fillText(t){labelsDrawn.push(t)}});
   overviewLabels();`);
  const labels=JSON.parse(c.run('JSON.stringify(labelsDrawn)')),rects=JSON.parse(c.run('JSON.stringify(rectsDrawn)'));
  assert.ok(labels.includes('Duke Chapel'));assert.ok(labels.every(t=>!/^\d/.test(t)));assert.equal(c.run('ctx.font').includes('15px'),true);
  assert.deepEqual(JSON.parse(c.run('JSON.stringify(transforms[0])')),[ratio,0,0,ratio,0,0]);
  for(let i=0;i<rects.length;i++){const a=rects[i];assert(a.x>=0&&a.x+a.w<=width&&a.y>=0&&a.y+a.h<=height);for(const b of rects.slice(i+1))assert(!(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y))}
 }
});
test('manual, diagonal, sprint and touch input use footprint-safe motion under long frames',()=>{
 const c=boot();let now=1000;
 for(const keyset of ["['w']","['w','d']","['a','shift']","['s','d','shift']"]){
  c.run(`keys.clear();for(const k of ${keyset})keys.add(k)`);
  for(let i=0;i<60;i++){now+=500;c.run(`tick(${now})`);assert(c.run('walk(px,py)'))}
 }
 c.run('keys.clear()');c.padButtons[0].onpointerdown({pointerId:42,preventDefault(){}});
 for(let i=0;i<20;i++){now+=300;c.run(`tick(${now})`);assert(c.run('walk(px,py)'))}
 c.padButtons[0].onpointerup();assert.equal(c.run('keys.size'),0);
});
test('invalid spawn recovery, blocked destination and first route segments share clearance',()=>{
 const c=boot();c.run('[px,py]=worldPoint([536,782])');assert.equal(c.run('walk(px,py)'),false);
 assert.equal(c.run('routeTo(...worldPoint(LAYOUT.spawn))'),false);
 c.run('recoverSpawn()');assert(c.run('walk(px,py)'));
 c.run('[px,py]=worldPoint(LAYOUT.spawn)');assert(c.run("routeTo(...worldPoint([487,1180]))"));
 assert(c.run('walk(...destination)'));assert(c.run('physics.segmentClear(px,py,...route[0])'));
 assert(c.run('route.every((p,i)=>!i||physics.segmentClear(...route[i-1],...p))'));
 // A bad queued arrival must not perform the old unchecked waypoint snap.
 c.run('[px,py]=worldPoint([536,782]);recoverSpawn();route=[[px+.5,py]];const oldSegment=physics.segmentClear;physics.segmentClear=()=>false;var before=[px,py];tick(1000);physics.segmentClear=oldSegment');
 assert(c.run('px===before[0]&&py===before[1]&&route.length===0'));
});
test('raised Fitzpatrick and library passage clearance survives footprint inflation',()=>{
 const c=boot();
 for(const [a,b] of [[[315,310],[315,380]],[[985,488],[985,555]]]){
  assert(c.run(`physics.segmentClear(...worldPoint(${JSON.stringify(a)}),...worldPoint(${JSON.stringify(b)}))`));
 }
});
test('occlusion uses foot baseline, not unconditional leaf color or camera scale',()=>{
 const c=boot();c.run('var layer={x:100,y:100,w:100,h:100,depth:190};');
 assert.equal(c.run('occludesAt(layer,150,180)'),true);assert.equal(c.run('occludesAt(layer,150,205)'),false);
 for(const ratio of [1,2])for(const z of [.4,1.5,2.7]){c.run(`dpr=${ratio};zoom=${z}`);assert.equal(c.run('occludesAt(layer,150,180)'),true);assert(c.run('walk(...worldPoint(LAYOUT.spawn))'))}
});
test('a blocked nearest route start or destination does not create a teleporting connector',()=>{
 const c=boot();
 c.run('var blockedStart=nodePoint(closestNode(px,py));var realClear=physics.segmentClear;physics.segmentClear=(x,y,nx,ny)=>nx===blockedStart[0]&&ny===blockedStart[1]?false:realClear(x,y,nx,ny)');
 assert(c.run("routeTo(...worldPoint([315,380]))"));assert(c.run('route[0][0]!==blockedStart[0]||route[0][1]!==blockedStart[1]'));
 c.run('physics.segmentClear=realClear;route=[];destination=null;var targetPoint=worldPoint([315,380]),isolated=closestNode(...targetPoint);var ic=isolated%COLS,ir=Math.floor(isolated/COLS);for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)if(dc||dr)nav[(ir+dr)*COLS+ic+dc]=0');
 assert(c.run('routeTo(...targetPoint)'));
 assert(c.run('walk(...destination)'));assert(c.run('route.every((p,i)=>!i||physics.segmentClear(...route[i-1],...p))'));
});
test('angled building front depth follows the local facade rather than the lowest distant corner',()=>{
 const c=boot();c.run('var angled={building:true,poly:[[100,100],[200,100],[200,200],[100,150]],depth:200,x:100,y:100,w:100,h:100}');
 assert.equal(c.run('occludesAt(angled,110,165)'),false);assert.equal(c.run('occludesAt(angled,110,145)'),true);
});
