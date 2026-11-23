import {scenes} from './scenes.js';
import {el,button,draw} from './canvas.js';
import {hasExport,exportReview} from './export.js';
import {activity} from './activity.js';
const $=id=>document.getElementById(id), key='pipeup:visual-review:v1';
const service='https://pipeup-design-reviews.noisyniche8.chatgpt.site';
const auth=window.DAReviewAuth.create(service);
let state={},user=null,busy=false,checked=false,storageOK=true;
try{state=JSON.parse(sessionStorage.getItem(key))||{}}catch{state={}}
state.drafts??={};
const hash=location.hash.slice(1).split('/');
let scene=scenes.find(s=>s.id===hash[0])||scenes.find(s=>s.id===state.scene)||scenes[0];
const draft=()=>state.drafts[scene.file];
const countNotes=d=>Object.values(d.notes||{}).filter(n=>n.trim()).length;
const pin=()=>Math.min(scene.pins.length-1,Math.max(0,Number(draft()?.pin??state.pin)||0));
function save(){try{sessionStorage.setItem(key,JSON.stringify(state));storageOK=true}catch{storageOK=false;$('status').textContent='Browser storage is unavailable. Enable it to keep your draft through sign-in.'}}
function trackable(){const d=draft();return d && !d.pending && !d.receipt ? d:null}
const clock=activity(trackable,save);
function select(s,i){if(busy)return;clock.pause();scene=s;state.scene=s.id;const d=draft();if(d&&!d.pending&&!d.receipt){d.pin=i;d.seen[i]=true}state.pin=i;checked=false;history.replaceState(null,'','#'+s.id+'/'+(pin()+1));save();paint();clock.touch()}
function stats(d){return Math.floor(d.ms/1000)+'s estimated active · '+Object.keys(d.seen).length+' of '+scene.pins.length+' details visited · '+(d.noteCount??countNotes(d))+' suggestions'}
function update(){if($('export'))$('export').disabled=busy||!hasExport(state);const d=draft();if($('metrics')&&d)$('metrics').textContent=stats(d);if($('submit'))$('submit').disabled=busy||!user||!storageOK||(!checked&&!d?.pending)||(d?.pending&&d.pending.reviewer!==user?.id)}
setInterval(update,1000);
function exportAction(host){const b=button('Export review',()=>{exportReview(state);save();$('status').textContent='Review file exported. Attach it to your email or chat to share it.'});b.id='export';b.disabled=busy||!hasExport(state);host.append(b)}
function paint(){
 const d=draft(),i=pin(),spot=scene.pins[i],w=$('work'),f=$('finish');
 draw(scene,i,(s,j)=>select(s,s!==scene?(state.drafts[s.file]?.pin??0):j),busy);
 $('index').textContent='PUBLISHED PRODUCT  /  0'+(scenes.indexOf(scene)+1)+' OF 03';$('title').textContent=scene.title;
 $('live-page').href=scene.source;$('kind').textContent=scene.kind.toUpperCase()+' REVIEW';$('prompt').textContent=scene.question;
 $('context').textContent='0'+(i+1)+' / '+spot.label;w.replaceChildren();f.replaceChildren();$('status').textContent='';
 $('account').hidden=!d||!!d.receipt;
 if(!d){w.append(el('p','Review this asset, then certify it with or without a suggestion.'),el('p','Only when you send: your account, asset version, estimated active time and marked details visited go privately to the owner.'));
   w.append(button('Start reviewing',()=>{state.drafts[scene.file]={pin:i,seen:{[i]:true},ms:0,notes:{}};save();paint();clock.touch()},'primary'));if(hasExport(state))exportAction(f);return}
 if(d.receipt){w.append(el('h2','Review certified'),el('p',d.who+' · '+new Date(d.receipt.receivedAt).toLocaleString()),el('p',stats(d)),el('small','Private receipt · '+d.receipt.id));
   const next=scenes.find(s=>!state.drafts[s.file]?.receipt);if(next)f.append(button('Review '+next.kind.toLowerCase()+' →',()=>select(next,0),'primary'));if(hasExport(state))exportAction(f);return}
 const lab=el('label','Suggestion for this detail (optional)');lab.htmlFor='note';const note=el('textarea');note.id='note';note.maxLength=12000;note.value=d.notes[i]||'';note.readOnly=!!d.pending;note.oninput=()=>{d.notes[i]=note.value;checked=false;if($('certify'))$('certify').checked=false;save();update()};w.append(lab,note);
 const m=el('p',stats(d));m.id='metrics';m.className='stats';w.append(m);
 const l=el('label');l.className='attest';const c=el('input');c.type='checkbox';c.id='certify';c.checked=checked||!!d.pending;c.disabled=!!d.pending;c.onchange=()=>{checked=c.checked;update()};l.append(c,' I reviewed this version of the asset.');f.append(l);
 const b=button(d.pending?'Retry private submission':'Certify and send privately',send,'primary');b.id='submit';f.append(b);exportAction(f);update();
 if(d.pending)$('status').textContent='A submission is awaiting its receipt. Retry with the same account.';
}
async function send(){
 const d=draft();if(busy||!user||(!checked&&!d.pending))return;
 clock.pause();const i=pin(),spot=scene.pins[i];if(d.pending&&d.pending.reviewer!==user.id)return;
 if(!d.pending){const snapshot=scene.file.split('.')[0], id=crypto.randomUUID();
   const threads=scene.pins.flatMap((p,j)=>d.notes[j]?.trim()?[{id:id+'-'+j,element:scene.id+'-'+j,where:p.label,view:{pin:j+1,x:p.x,y:p.y},comments:[{by:user.name,text:d.notes[j].trim()}]}]:[]);
   d.pending={v:1,id,project:'pipeup',reviewer:user.id,snapshot,pages:[{page:'./#'+scene.id+'/'+(i+1),title:scene.title,snapshot,threads}],certificate:{attestation:'reviewed-v1',file:scene.file,title:scene.title,label:spot.label,pin:i+1,x:spot.x,y:spot.y,activeSeconds:Math.floor(d.ms/1000),detailsVisited:Object.keys(d.seen).length}};d.who=user.name
 }
 save();if(!storageOK)return;busy=true;paint();$('status').textContent='Sending privately…';
 try{const res=await auth.request('/api/reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d.pending)});const result=await res.json();if(!res.ok)throw Error(result.error||'Submission failed.');
   if(result.id!==d.pending.id||!result.receivedAt)throw Error('Receipt unavailable.');d.receipt=result;delete d.pending;d.noteCount=countNotes(d);save();busy=false;checked=false;paint()
 }catch(e){busy=false;paint();$('status').textContent=e.message+' Your review is kept.'}
}
if(!draft()&&hash[0]===scene.id&&scene.pins[Number(hash[1])-1])state.pin=Number(hash[1])-1;
auth.mount($('account'),v=>{if(user?.id!==v.user?.id)checked=false;user=v.user;if($('certify')&&!draft()?.pending)$('certify').checked=checked;update()});
paint();
