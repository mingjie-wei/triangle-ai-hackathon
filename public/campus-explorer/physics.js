/* Ground-space ellipse footprint. No renderer, zoom or DPR dependencies. */
const CampusPhysics = (() => {
  const EPS = 1e-8;
  function inside(p, poly) {
    let yes = false;
    for (let i=0,j=poly.length-1;i<poly.length;j=i++) {
      const a=poly[i],b=poly[j];
      if ((a[1]>p[1]) !== (b[1]>p[1]) && p[0] < (b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]) yes=!yes;
    }
    return yes;
  }
  function pointDistance2(p,a,b) {
    const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
    return (p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2;
  }
  function segmentDistance2(a,b,c,d) {
    const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
    if(cross(a,b,c)*cross(a,b,d)<0 && cross(c,d,a)*cross(c,d,b)<0)return 0;
    return Math.min(pointDistance2(a,c,d),pointDistance2(b,c,d),pointDistance2(c,a,b),pointDistance2(d,a,b));
  }
  function ellipsePolygon(o) {
    // Circumscribed polygon: conservatively contains the obstacle ellipse (error <0.22%).
    const count=48,k=1/Math.cos(Math.PI/count);
    return Array.from({length:count},(_,i)=>[o.x+o.rx*k*Math.cos(i*2*Math.PI/count),o.y+o.ry*k*Math.sin(i*2*Math.PI/count)]);
  }
  function create({bounds,polygons=[],ellipses=[],rx=8,ry=5}) {
    const shapes=[...polygons,...ellipses.map(ellipsePolygon)].map(poly=>{
      const points=poly.map(([x,y])=>[x/rx,y/ry]);
      return {points,minX:Math.min(...points.map(p=>p[0]))-1,maxX:Math.max(...points.map(p=>p[0]))+1,minY:Math.min(...points.map(p=>p[1]))-1,maxY:Math.max(...points.map(p=>p[1]))+1};
    });
    const inBounds=(x,y)=>Number.isFinite(x)&&Number.isFinite(y)&&x>=bounds.x+rx&&x<=bounds.x+bounds.w-rx&&y>=bounds.y+ry&&y<=bounds.y+bounds.h-ry;
    function canOccupy(x,y) {
      if(!inBounds(x,y))return false;const p=[x/rx,y/ry];
      for(const s of shapes){if(p[0]<s.minX||p[0]>s.maxX||p[1]<s.minY||p[1]>s.maxY)continue;
        if(inside(p,s.points))return false;
        for(let i=0;i<s.points.length;i++)if(pointDistance2(p,s.points[i],s.points[(i+1)%s.points.length])<=1+EPS)return false;
      }return true;
    }
    function segmentClear(x,y,nx,ny) {
      if(!canOccupy(x,y)||!canOccupy(nx,ny))return false;
      const a=[x/rx,y/ry],b=[nx/rx,ny/ry];
      for(const s of shapes){if(Math.max(a[0],b[0])<s.minX||Math.min(a[0],b[0])>s.maxX||Math.max(a[1],b[1])<s.minY||Math.min(a[1],b[1])>s.maxY)continue;
        for(let i=0;i<s.points.length;i++)if(segmentDistance2(a,b,s.points[i],s.points[(i+1)%s.points.length])<=1+EPS)return false;
      }return true;
    }
    function move(x,y,dx,dy,slide=true){
      if(!canOccupy(x,y))return [x,y];
      const count=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/2));
      for(let i=0;i<count;i++){const sx=dx/count,sy=dy/count;
        if(segmentClear(x,y,x+sx,y+sy)){x+=sx;y+=sy}
        else if(slide){if(segmentClear(x,y,x+sx,y))x+=sx;if(segmentClear(x,y,x,y+sy))y+=sy}
        else break;
      }return [x,y];
    }
    return {canOccupy,segmentClear,move,rx,ry};
  }
  return {create,ellipsePolygon};
})();
