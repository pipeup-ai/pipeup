import {scenes} from './scenes.js';
export const el=(tag,text)=>Object.assign(document.createElement(tag),{textContent:text??''});
export function button(text,fn,cls=''){const b=el('button',text);b.type='button';b.className=cls;b.onclick=fn;return b}
export function draw(scene,pin,select,locked){
  const art=document.querySelector('#art'),strip=document.querySelector('#strip');
  const img=new Image();img.alt=scene.alt;img.src='visual/assets/'+scene.file;art.replaceChildren(img);art.classList.toggle('phone',scene.id==='mobile');
  scene.pins.forEach((spot,i)=>{const b=button(String(i+1).padStart(2,'0'),()=>select(scene,i),'pin');b.style.left=spot.x+'%';b.style.top=spot.y+'%';b.disabled=locked;b.setAttribute('aria-label','Mark '+spot.label);b.setAttribute('aria-pressed',i===pin);art.append(b)});
  strip.replaceChildren(...scenes.map((s,i)=>{const b=button('',()=>select(s,0));const thumb=new Image();thumb.src='visual/assets/'+s.file;thumb.alt='';const label=el('span',s.kind);label.prepend(el('small','0'+(i+1)));b.append(thumb,label);b.disabled=locked;b.setAttribute('aria-pressed',s===scene);return b}));
}
