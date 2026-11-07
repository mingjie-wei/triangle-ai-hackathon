"use client";
import { Fragment } from "react";
import { useMapCamera } from "@/hooks/useMapCamera";
import { MAX_ZOOM, worldViewport } from "@/lib/map-camera";
import type { Place } from "@/lib/domain";
import { landmarks } from "@/lib/presentation";
import { campusPaths, westCampus } from "@/lib/campus-world";

export default function CampusMap({ places, selected, onSelect, revealSelection }: {
  places: Place[]; selected: string | null; onSelect: (id: string) => void; revealSelection: number;
}) {
  const selectedPlace = places.find(p => p.id === selected);
  const placement = westCampus.placements.find(p => p.slug === selectedPlace?.slug);
  const { surface: surfaceRef, camera, size, scale, dragging, handlers, reveal, zoom, reset, center } =
    useMapCamera(placement?.position ?? null, revealSelection, westCampus.world);
  const viewport = worldViewport(camera, size, westCampus.world);
  return <div className="map-canvas continuous-map">
    <div className="world-heading paper"><span className="eyebrow">AROUND DUKE</span><h1>West Campus</h1><small>An autumn worth exploring</small></div>
    <div ref={surfaceRef} className={`map-surface ${dragging ? "is-dragging" : ""}`} tabIndex={0}
      role="region" aria-label="West Campus map. Arrow keys pan; Home fits campus." {...handlers}>
      <div className={`scene-world campus-world ${camera.zoom > 1.5 ? "world-close" : ""}`}
        style={{ width: westCampus.world.w, height: westCampus.world.h,
          transform: `translate(-50%,-50%) translate(${camera.x}px,${camera.y}px) scale(${scale})` }}>
        <svg className="campus-terrain" viewBox="0 0 2000 1800" aria-hidden="true">
          <defs>
            <pattern id="grass" width="46" height="42" patternUnits="userSpaceOnUse"><rect width="46" height="42" fill={westCampus.ground}/><path d="M5 7h5M31 27h4" stroke="#b1b86c" strokeWidth="3"/></pattern>
            <g id="tree"><ellipse cy="25" rx="31" ry="12" fill="#53653d" opacity=".3"/><path d="M-4 3h8v27h-8z" fill="#705235"/><path d="M-30-10h7v-17h15v-9h22v9h13v16h8v24H20v10H-15V13h-15z" fill="currentColor"/><path d="M-22-12h8v-13H6v9h12v9H3V5h-25z" fill="#f7cd59" opacity=".55"/></g>
          </defs>
          <rect width="2000" height="1800" rx="80" fill="url(#grass)"/>
          <path d="M90 900Q400 140 1100 160T1880 800Q1900 1550 1300 1670T90 900" fill="none" stroke="#6f854d" strokeWidth="75" opacity=".4"/>
          {campusPaths.map(d=><path key={d} d={d} fill="none" stroke="#cbb98b" strokeWidth="37" strokeLinecap="round"/>)}
          {campusPaths.map(d=><path key={d} d={d} fill="none" stroke="#e4d4aa" strokeWidth="25" strokeLinecap="round"/>)}
          <ellipse cx="780" cy="1140" rx="135" ry="75" fill="#c7b586" stroke="#e5d6ad" strokeWidth="18"/>
          {/* Library mass and a raised, open-arch connector; Wilkinson–TEC has only a path. */}
          <path d="M1300 790L1320 982" stroke="#a18b70" strokeWidth="105"/>
          <path d="M1300 780L1320 970" stroke="#ddc49a" strokeWidth="78"/>
          <path d="M1360 555L1300 750" stroke="#716278" strokeWidth="65"/>
          <path d="M1360 555L1300 750" stroke="#d1b58a" strokeWidth="48"/>
          <path d="M1328 644l-11 37" stroke="#637848" strokeWidth="25"/>
          {Array.from({length:96},(_,i)=>{
            const x=95+(i*337%1810), y=105+(i*227%1590);
            if(westCampus.placements.some(p=>Math.abs(p.position.x-x)<p.display.w*.62 && Math.abs(p.position.y-y)<p.display.h*.9)) return null;
            return <use key={i} href="#tree" transform={`translate(${x} ${y}) scale(${1+(i%3)*.18})`} color={["#c56a36","#d99533","#a85945","#637e43"][i%4]}/>;
          })}
        </svg>
        {westCampus.placements.map((p,i)=>{
          const place=places.find(item=>item.slug===p.slug); if(!place) return null;
          return <Fragment key={p.slug}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={`world-sprite ${selected===place.id ? "selected-sprite" : ""}`} src={p.sprite} alt="" draggable={false}
              style={{left:p.position.x,top:p.position.y,width:p.display.w,height:p.display.h,zIndex:p.z,transform:`translate(${-p.anchor.x*100}%,${-p.anchor.y*100}%)`}}/>
            <button className={`world-building ${selected===place.id ? "is-selected" : ""}`}
            style={{left:p.position.x,top:p.position.y,width:Math.max(p.display.w,44/scale),height:Math.max(p.display.h,44/scale),zIndex:3000,
              transform:`translate(${-p.anchor.x*100}%,${-p.anchor.y*100}%)`}}
            aria-label={`Select ${place.name} and view details`} aria-pressed={selected===place.id}
            onClick={()=>onSelect(place.id)} onFocus={e=>{if(e.currentTarget.matches(":focus-visible")) reveal(p.position);}}>
            <span className="world-label" style={{left:`${p.labelAnchor.x*100}%`,top:`${p.labelAnchor.y*100}%`,transform:`translate(-50%,0) scale(${1/scale})`}}>
              <b>{String(i+1).padStart(2,"0")}</b><span>{landmarks[i].shortName ?? place.name}</span>
            </span>
          </button></Fragment>;
        })}
      </div>
    </div>
    <div className="map-zoom" aria-label="Map camera controls">
      <button aria-label="Zoom in" disabled={camera.zoom>=MAX_ZOOM} onClick={()=>zoom(.25)}>＋</button>
      <button aria-label="Zoom out" disabled={camera.zoom<=1} onClick={()=>zoom(-.25)}>−</button>
      <button className="fit-campus" onClick={reset}>Fit campus</button>
      <span className="camera-help" role="status">{Math.round(camera.zoom*100)}% · Drag to explore</span>
    </div>
    <div className="campus-minimap paper">
      <span>Campus overview</span>
      <svg viewBox="0 0 2000 1800" role="button" tabIndex={0} aria-label="Campus overview. Click to pan; arrow keys move the viewport."
        onKeyDown={e=>{
          const delta: Record<string,[number,number]> = {ArrowLeft:[-150,0],ArrowRight:[150,0],ArrowUp:[0,-150],ArrowDown:[0,150]};
          if(delta[e.key]) { e.preventDefault(); center({x:viewport.x+viewport.w/2+delta[e.key][0],y:viewport.y+viewport.h/2+delta[e.key][1]}); }
          if(e.key==="Home" || e.key==="Enter" || e.key===" ") { e.preventDefault(); reset(); }
        }}
        onClick={e=>{const r=e.currentTarget.getBoundingClientRect();center({x:(e.clientX-r.left)/r.width*2000,y:(e.clientY-r.top)/r.height*1800});}}>
        <rect width="2000" height="1800" fill="#899b58"/>
        {campusPaths.map(d=><path key={d} d={d} fill="none" stroke="#e4d4aa" strokeWidth="30"/>)}
        {westCampus.placements.map(p=><rect key={p.slug} x={p.position.x-55} y={p.position.y-40} width="110" height="80" fill={p.slug===selectedPlace?.slug ? "#f6c35b" : "#4c4b69"}/>)}
        <rect x={viewport.x} y={viewport.y} width={viewport.w} height={viewport.h} fill="#fff3" stroke="#fff5d5" strokeWidth="22"/>
      </svg>
      <small>Click to pan</small>
    </div>
    <details className="map-help paper"><summary>Explore the map</summary><p>Drag to pan. Tap a building for events. Zoom in for a closer look. With the map focused, use arrow keys to pan and Home to fit campus.</p></details>
    <span className="world-disclaimer">Illustrative layout · not walking navigation</span>
  </div>;
}
