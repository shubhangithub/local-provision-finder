import {useRef,useState,type ReactNode} from 'react';
import '../styles/resizable-results.css';
export default function ResizableResults({view,children}:{view:'list'|'map';children:ReactNode[]}) {
 const [width,setWidth]=useState(50);const container=useRef<HTMLDivElement>(null);
 function move(x:number){const box=container.current?.getBoundingClientRect();if(box)setWidth(Math.max(25,Math.min(75,(x-box.left)/box.width*100)));}
 return <div ref={container} className={`directory-results-layout resizable-results grid-split view-${view}`} style={{'--results-list-width':`${width}%`} as React.CSSProperties}>
 {children[0]}<div className="results-divider" role="separator" aria-label="Resize service list and map" aria-orientation="vertical" aria-valuemin={25} aria-valuemax={75} aria-valuenow={Math.round(width)} tabIndex={0}
 onPointerDown={event=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);}}
 onPointerMove={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))move(event.clientX);}}
 onPointerUp={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
 onKeyDown={event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();setWidth(value=>event.key==='Home'?25:event.key==='End'?75:Math.max(25,Math.min(75,value+(event.key==='ArrowRight'?5:-5))));}}}><span aria-hidden="true">⋮</span></div>{children[1]}
 </div>;
}
