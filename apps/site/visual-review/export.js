// A local handoff: one readable file for every noted current asset in this session.
import {scenes} from './scenes.js';

function entries(state){
  return scenes.flatMap(scene=>{
    const notes=scene.pins.flatMap((pin,i)=>{
      const text=state.drafts[scene.file]?.notes?.[i]?.trim();
      return text?[{pin,number:i+1,text}]:[];
    });
    return notes.length?[{scene,notes}]:[];
  });
}
export function hasExport(state){return entries(state).length>0}
export function exportReview(state){
  const groups=entries(state);
  if(!groups.length)return;
  const id=state.exportId??=crypto.randomUUID();
  const lines=['# Pipeup design review','','Review ID: '+id,'Exported: '+new Date().toISOString(),'Source: local review notes (not an account verification or certificate).',''];
  for(const {scene,notes} of groups){
    lines.push('## '+scene.title,'','Live page: '+new URL(scene.source,location.href).href,'Reviewed image: '+new URL('visual/assets/'+scene.file,location.href).href,'');
    for(const {number,pin,text} of notes){
      lines.push('### Pin '+number+' · '+pin.label,'','Note ID: '+id+'/'+scene.id+'/'+number,'Position: '+pin.x+'%, '+pin.y+'%','',text,'');
    }
  }
  const href=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/markdown;charset=utf-8'}));
  const link=document.createElement('a');link.href=href;link.download='pipeup-'+id+'.review.md';
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);
}
