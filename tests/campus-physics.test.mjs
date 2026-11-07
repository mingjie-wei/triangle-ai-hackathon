import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const context=vm.createContext({});vm.runInContext(readFileSync(new URL('../public/campus-explorer/physics.js',import.meta.url),'utf8'),context);
const Physics=vm.runInContext('CampusPhysics',context);
const bounds={x:0,y:0,w:300,h:300};
const wall=[[100,50],[120,50],[120,250],[100,250]];
test('ellipse footprint rejects edge and corner overlap that a foot point would miss',()=>{
 const p=Physics.create({bounds,polygons:[wall]});
 assert.equal(p.canOccupy(95,100),false);assert.equal(p.canOccupy(91,100),true);
 assert.equal(p.canOccupy(95,47),false);assert.equal(p.canOccupy(91,44),true);
 assert.equal(p.canOccupy(110,100),false);
});
test('swept segments cannot cross thin obstacles or clip diagonal corners',()=>{
 const p=Physics.create({bounds,polygons:[[[150,50],[150.1,50],[150.1,250],[150,250]]]});
 assert(p.canOccupy(20,150)&&p.canOccupy(280,150));assert.equal(p.segmentClear(20,150,280,150),false);
 const end=p.move(20,150,260,0);assert(p.canOccupy(...end));assert(end[0]<142);
 const corner=Physics.create({bounds,polygons:[wall]});assert.equal(corner.segmentClear(90,55,105,40),false);
});
test('wall sliding is deterministic and never enters an invalid occupancy state',()=>{
 const p=Physics.create({bounds,polygons:[wall]});let [x,y]=[90,100];
 for(let i=0;i<25;i++){[x,y]=p.move(x,y,8,3);assert(p.canOccupy(x,y))}
 assert(x<92&&y>170);assert.deepEqual(Array.from(p.move(90,100,8,3)),Array.from(p.move(90,100,8,3)));
 assert.deepEqual(Array.from(p.move(110,100,50,0)),[110,100]);
});
test('narrow passages use ground width, not the upright avatar rectangle',()=>{
 const narrow=Physics.create({bounds,polygons:[[[0,0],[100,0],[100,300],[0,300]],[[118,0],[300,0],[300,300],[118,300]]]});
 assert(narrow.canOccupy(109,150));assert(narrow.segmentClear(109,20,109,280));
 const closed=Physics.create({bounds,polygons:[[[0,0],[100,0],[100,300],[0,300]],[[115,0],[300,0],[300,300],[115,300]]]});
 assert.equal(closed.canOccupy(107.5,150),false);
});
test('ellipse obstacles conservatively keep the entire foot footprint outside',()=>{
 const p=Physics.create({bounds,ellipses:[{x:150,y:150,rx:30,ry:10}]});
 assert.equal(p.canOccupy(150,164),false);assert(p.canOccupy(150,166));
 assert.equal(p.canOccupy(187,150),false);assert(p.canOccupy(189,150));
});
