/** Pipeup's stylesheet, scoped to its shadow root. Light by default; `.dark` follows a dark page. */
export const STYLES = `
/* Inherited page styles are reset on .layer below; custom properties pass through all:initial. */
:host{all:initial}
*{box-sizing:border-box}
button{appearance:none;font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
svg{display:block}
.layer{all:initial;display:block;position:fixed;inset:0;pointer-events:none;font:13px/1.5 var(--pu-font,system-ui,sans-serif);color:var(--k);
--k:#2C2C2A;--mu:#5F5E5A;--fa:#888780;--ln:#E5E3DA;--ru:#ECEAE2;--so:#FAFAF7;--su:#FFFFFF;--ho:#F1EFE8;
--as:color-mix(in srgb,var(--pu-accent,#534AB7) 12%,transparent);
--sh:0 8px 28px rgba(44,44,42,.10);
--in:.26s;--mv:.34s;--out:.2s;--pl:1.2s;
--eo:cubic-bezier(.22,.61,.36,1);--eio:cubic-bezier(.4,0,.2,1);--ei:cubic-bezier(.4,0,1,1);
--pu-text:var(--k);--pu-muted:var(--mu);--pu-faint:var(--fa);--pu-line:var(--ln);--pu-surface:var(--su);--pu-soft:var(--so);--pu-hover:var(--ho);--pu-shadow:var(--sh);--pu-ease:var(--eo)}
.layer.dark{--k:#ECEBE6;--mu:#B4B2A9;--fa:#8D8B84;--ln:#3A3936;--ru:#34332F;--so:#22221F;--su:#1B1B19;--ho:#2C2C29;--sh:0 8px 28px rgba(0,0,0,.45)}
.layer.hidden .bub,.layer.hidden .col,.layer.hidden .pop,.layer.hidden .tip,.layer.hidden .mark,.layer.hidden .selbar{opacity:0!important;pointer-events:none!important}

.tx{font-size:14px;line-height:1.5;color:var(--k);white-space:pre-wrap;overflow-wrap:anywhere}
.tx.del,.who,.rest,.ctx{color:var(--fa)}
.who,.rest{font-size:12px}
/* Long names are cut short on one line, never wrapped. */
.who{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rft>.who{display:block}
.ctx[hidden]{display:none}
.ctx{font-size:12px;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.tx a{color:var(--pu-accent);text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:2px}

/* Footers: details take no space until hovered, then ease open beneath the words. */
.ft,.rft{display:grid;grid-template-rows:0fr;opacity:0;transition:grid-template-rows var(--in) var(--eo),opacity var(--in) var(--eo)}
.ft>*,.rft>*{overflow:hidden;min-height:0;display:flex;align-items:center}
.root:hover>.ft,.root:focus-within>.ft,.it:hover>.rft,.it:focus-within>.rft{grid-template-rows:1fr;opacity:1}
.ft.has-rest,.ft.open,.rft.open{grid-template-rows:1fr;opacity:1}
.ft.has-rest>*{grid-area:1/1}
.ft .hover{opacity:0;transition:opacity var(--in) var(--eo)}
.ft .rest{transition:opacity var(--in) var(--eo)}
.root:hover>.ft .hover,.root:focus-within>.ft .hover,.ft:not(.has-rest) .hover{opacity:1}
.root:hover>.ft .rest,.root:focus-within>.ft .rest{opacity:0}
.acts{margin-left:6px;display:flex;flex:none}
.ib{width:24px;height:22px;display:grid;place-items:center;border-radius:6px;color:var(--mu);transition:background-color .2s var(--eo),color .2s var(--eo)}
.ib:hover,.ib:focus-visible{background:var(--ho);color:var(--k);outline:none}

/* Replies: one level in, oldest first; the reply line ends the thread at the same indent. */
.rps,.rbox{padding-left:14px}
.rps .it{padding-top:6px}
.more{display:grid;grid-template-rows:1fr;transition:grid-template-rows var(--mv) var(--eio)}
.more>div{overflow:hidden;min-height:0}
.th:not(.on) .more{grid-template-rows:0fr}

.row{display:flex;align-items:center;gap:8px;padding:8px 0 2px;cursor:text}
.input{flex:1;min-width:0;height:27px;display:block;border:0;border-bottom:1px solid var(--ln);outline:none;resize:none;overflow:hidden;
font:inherit;font-size:14px;line-height:1.5;padding:3px 0;color:var(--k);background:transparent;transition:border-color var(--in) var(--eo)}
.row:hover .input,.input:hover{border-bottom-color:var(--mu)}
.input:focus{border-bottom-color:var(--pu-accent)}
.ed{display:flex;gap:10px;align-items:center;min-height:34px;padding:6px 10px}
.ed .input{font-size:13px;height:22px}

/* Avatars: a squircle with the writer's animal (or initial) on a soft colour. Each comment keeps a fixed area
at its top right for one, so its words are the same width with or without it. */
.root,.it{position:relative;padding-right:30px}
.av{display:grid;place-items:center;width:22px;height:22px;border-radius:32%;
font-size:12px;font-weight:600;line-height:1;opacity:0;transform:scale(.85);transition:opacity var(--in) var(--eo),transform var(--in) var(--eo)}
.av.in{opacity:1;transform:none}
.av svg{width:80%;height:80%}
.root>.av,.it>.av{position:absolute;top:0;right:0}
.it>.av{top:6px}
/* Ten colours (.c0 Red to .c9 Grey, as COLOURS): a soft tint and a dark drawing, swapped round on dark pages. */
.av{--av-l:92%;--av-d:30%;--s:60%;background:hsl(var(--h) var(--s) var(--av-l));color:hsl(var(--h) var(--s) var(--av-d))}
.dark .av{--av-l:20%;--av-d:78%}
/* An AI's reply: a plain disc with a violet ring that glows gently (opacity and scale on a pseudo-element). */
.av.ai{position:relative;border-radius:50%;background:var(--su);color:var(--pu-accent);font-size:9px;letter-spacing:.02em;box-shadow:0 0 0 1.5px var(--pu-accent)}
.av.ai::after{content:"";position:absolute;inset:-4px;border-radius:50%;box-shadow:0 0 9px 1px color-mix(in srgb,var(--pu-accent) 45%,transparent);opacity:.3;animation:pu-breathe 3.8s var(--eio) infinite;pointer-events:none}
.root>.av.ai,.it>.av.ai{position:absolute}
.av.ai.busy::after{animation-duration:2.2s}
@keyframes pu-breathe{0%,100%{opacity:.25;transform:scale(1)}50%{opacity:1;transform:scale(1.1)}}
.ghost .dots{display:inline-flex;gap:3px;margin-left:4px;vertical-align:middle}
.ghost .dots i{width:4px;height:4px;border-radius:50%;background:var(--fa);animation:pu-dot 1.6s var(--eio) infinite}
.ghost .dots i:nth-child(2){animation-delay:.2s}
.ghost .dots i:nth-child(3){animation-delay:.4s}
@keyframes pu-dot{0%,100%{opacity:.25}50%{opacity:1}}
.c0{--h:0}.c1{--h:25}.c2{--h:50}.c3{--h:130}.c4{--h:175}.c5{--h:215}.c6{--h:270}.c7{--h:330}.c8{--h:28;--s:35%}.c9{--h:220;--s:8%}
.me{flex:none;display:grid}
.me>.av{grid-area:1/1;width:26px;height:26px;font-size:13px}
/* Who you are, under the comment line; a name field eases open in its place. */
.you{display:grid;padding:0 34px;min-height:24px;font-size:12px;color:var(--fa)}
.you>*{grid-area:1/1;display:flex;align-items:center;min-width:0;transition:opacity var(--in) var(--eo),transform var(--in) var(--eo)}
.say{white-space:pre;overflow:hidden}
.nm{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.say button{flex:none}
.say button{color:var(--mu);text-decoration:underline;text-decoration-color:var(--ln);text-underline-offset:2px;transition:color .2s var(--eo)}
.say button:hover,.say button:focus-visible{color:var(--pu-accent);outline:none}
.nf{opacity:0;transform:translateY(-4px);pointer-events:none}
.nf .input{font-size:13px;height:24px}
.you.naming .nf{opacity:1;transform:none;pointer-events:auto}
.you.naming .say{opacity:0;pointer-events:none}
.send{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;color:var(--pu-accent);flex:none;opacity:0;pointer-events:none;
transition:opacity var(--in) var(--eo),background-color .2s var(--eo)}
.send.show{opacity:1;pointer-events:auto}
.send:hover{background:var(--as)}

/* Bubbles, tips, popovers, marks, pulses. */
.bub{position:fixed;left:0;top:0;width:20px;height:20px;margin:-20px 0 0 -2px;border-radius:50% 50% 50% 0;background:var(--pu-accent);
border:2px solid var(--su);box-shadow:0 1px 4px rgba(0,0,0,.2);pointer-events:auto;opacity:0;transform:translateY(-6px) scale(.9);transform-origin:2px 20px;
transition:opacity var(--out) var(--ei),transform var(--out) var(--ei)}
.bub.in{opacity:1;transform:none;transition:opacity var(--in) var(--eo),transform var(--in) var(--eo)}
.bub.in:hover,.bub.on{transform:scale(1.18)}
.bub.done{background:var(--fa)}
.bub.ghost{pointer-events:none}
.tip,.pop,.menu,.all,.xp,.toast,.selbar,.namebar,.ttip,.tt,.mode{background:var(--su);border:1px solid var(--ln);box-shadow:var(--sh)}
.tip{position:fixed;max-width:260px;border-radius:10px;padding:7px 10px;opacity:0;transform:translateY(3px);
transition:opacity .22s var(--eo),transform .26s var(--eo)}
.tip.show{opacity:1;transform:none;pointer-events:auto;cursor:pointer;
transition:opacity .22s var(--eo),transform .26s var(--eo),left var(--mv) var(--eio),top var(--mv) var(--eio)}
.pop{position:fixed;width:var(--pu-pop);border-radius:12px;padding:10px 12px 8px;pointer-events:none;opacity:0;transform:translateY(6px) scale(.98);
transition:opacity var(--out) var(--ei),transform var(--out) var(--ei)}
.pop.show{opacity:1;transform:none;pointer-events:auto;transition:opacity var(--in) var(--eo),transform var(--mv) var(--eo)}
.pop.show.glide{transition:opacity var(--in) var(--eo),transform var(--mv) var(--eo),left var(--mv) var(--eio),top var(--mv) var(--eio)}
.mark{position:fixed;border:2px solid color-mix(in srgb,var(--pu-accent) 50%,transparent);background:var(--as);border-radius:8px;opacity:0;
transition:opacity .3s var(--eo)}
.mark.show{opacity:1}
.pulse{position:fixed;border:2px solid var(--pu-accent);border-radius:8px;background:var(--as);animation:pu-pulse var(--pl) var(--eio) forwards}
@keyframes pu-pulse{0%{opacity:0;transform:scale(.985)}35%{opacity:.85;transform:scale(1)}100%{opacity:0;transform:scale(1.02)}}

/* Document column. */
.col{position:fixed;left:0;top:0;pointer-events:none;transition:opacity var(--in) var(--eo)}
.th{position:absolute;left:0;right:0;top:0;padding:4px 4px 4px 12px;pointer-events:auto;cursor:pointer;box-shadow:inset 2px 0 0 transparent;
transition:transform var(--mv) var(--eio),box-shadow var(--in) var(--eo),opacity var(--in) var(--eo)}
.th.hot{box-shadow:inset 2px 0 0 var(--ln)}
.th.on{box-shadow:inset 2px 0 0 var(--pu-accent);cursor:default}
.th.dim{opacity:.45}
.th.resolved:not(.on):not(.hot){opacity:.6}
.th.lost .ctx{white-space:normal}
.th.wait{opacity:0!important;pointer-events:none}
.th.out{opacity:0!important;pointer-events:none;transition:opacity var(--out) var(--ei)}
/* A closed thread's button has no box of its own: the thread shows its focus. */
.th:has(.opn:focus-visible){box-shadow:inset 2px 0 0 var(--ln);outline:2px solid var(--pu-accent);outline-offset:2px;border-radius:4px}

/* Selection bar. */
.selbar{position:fixed;display:flex;border-radius:10px;padding:2px;opacity:0;transform:translateY(4px);pointer-events:none;
transition:opacity var(--in) var(--eo),transform .3s var(--eo)}
.selbar.show{opacity:1;transform:none;pointer-events:auto}
.selbar button{width:32px;height:30px;display:grid;place-items:center;border-radius:8px;color:var(--pu-accent);transition:background-color .2s var(--eo)}
.selbar button:hover,.selbar button:focus-visible{background:var(--as);outline:none}

/* Comment mode's outline: glides between blocks; solid accent once chosen. */
.pick{position:fixed;left:0;top:0;border:2px solid color-mix(in srgb,var(--pu-accent) 70%,transparent);background:color-mix(in srgb,var(--pu-accent) 6%,transparent);
border-radius:8px;pointer-events:none;opacity:0;transition:opacity var(--out) var(--ei),border-color var(--out) var(--ei),border-width var(--out) var(--ei),box-shadow var(--out) var(--ei)}
.pick.show{opacity:1;transition-duration:var(--in);transition-timing-function:var(--eo)}
.pick.show.glide{transition-property:all;transition-duration:var(--mv);transition-timing-function:var(--eio)}
.pick.on{border-color:var(--pu-accent)}
/* The block cursor: its focus is drawn on the outline (3px accent with a surface halo, 3:1 on any page); the
markers that hold focus are invisible. */
.pick.kf{border:3px solid var(--pu-accent);box-shadow:0 0 0 2px var(--su)}
.km{position:fixed;left:0;top:0;pointer-events:none;outline:none}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.namebar{position:fixed;left:0;top:0;display:flex;align-items:center;gap:2px;padding:2px 2px 2px 10px;border-radius:10px;font-size:12px;color:var(--mu);
white-space:nowrap;pointer-events:none;opacity:0;transform:translateY(4px);
transition:opacity var(--out) var(--ei),transform var(--out) var(--ei)}
.namebar.show{opacity:1;transform:none;pointer-events:auto;transition:opacity var(--in) var(--eo),transform .3s var(--eo)}
.namebar.show.glide{transition-property:all;transition-duration:var(--mv);transition-timing-function:var(--eio)}
.namebar .lbl{margin-right:6px;max-width:260px;overflow:hidden;text-overflow:ellipsis}
.namebar .nb{padding:4px;display:grid;place-items:center;border-radius:7px;transition:background-color .2s var(--eo),color .2s var(--eo)}
.namebar .nb:hover,.namebar .nb:focus-visible{background:var(--ho);color:var(--k);outline:none}
.namebar .nb[hidden]{display:none}

/* The comment control: one round button; the open count sits inside a comment bubble. Nothing about it
grows or slides: its layers and numbers cross-fade in place. */
.launch{position:fixed;right:20px;bottom:20px;pointer-events:auto}
.launch .mode{position:relative;display:grid;place-items:center;width:46px;height:46px;border-radius:50%;transition:background-color .3s var(--eo),color .3s var(--eo)}
.mode>*,.cnt>*{grid-area:1/1}
.mode>*{display:grid;place-items:center;transition:opacity var(--in) var(--eo)}
.cnt,.has>.plus{opacity:0}
.has>.cnt{opacity:1}
.n{font-size:12px;font-weight:500;line-height:1;margin:-1.4px 0 0 1.4px;font-variant-numeric:tabular-nums;opacity:0;transition:opacity var(--in) var(--eo)}
.n.s{font-size:9.5px;letter-spacing:-.04em}
.n.on{opacity:1}
.launch .mode:hover,.launch .mode[aria-expanded=true]{background:var(--ho)}
.launch .mode.on{background:var(--pu-accent);color:var(--pu-on,#fff)}
/* Open threads on other slides or views: a small dot at the button's top right, easing in and out. */
.mode>.dot{position:absolute;top:3px;right:3px;width:9px;height:9px;border-radius:50%;background:var(--pu-accent);border:2px solid var(--su);opacity:0}
.mode.else>.dot{opacity:1}
/* The tooltip eases in after a moment, above the button, and never moves it. */
.ttip{position:absolute;right:0;bottom:54px;white-space:nowrap;border-radius:8px;padding:4px 9px;font-size:12px;pointer-events:none;opacity:0;transform:translateY(3px);transition:opacity var(--out) var(--ei),transform var(--out) var(--ei)}
.ttip small{margin-left:8px}
.ttip small,.mi .kc{font-size:12px;color:var(--fa)}
.mode:hover+.ttip,.mode:focus-visible+.ttip{opacity:1;transform:none;transition:opacity var(--in) var(--eo) .5s,transform var(--in) var(--eo) .5s}
.launch .mode[aria-expanded=true]+.ttip{opacity:0;transition:opacity var(--out) var(--ei)}
@media (hover:none){.ttip,.tt{display:none}}
.menu{position:fixed;right:20px;bottom:76px;width:290px;border-radius:12px;padding:4px;pointer-events:none;opacity:0;transform:translateY(6px);
transition:opacity var(--out) var(--ei),transform var(--out) var(--ei)}
.menu.show{opacity:1;transform:none;pointer-events:auto;transition:opacity var(--in) var(--eo),transform var(--mv) var(--eo)}
/* Menu rows: one line each; the explanation is a tooltip beside the menu that eases in after a moment. */
.mi{position:relative;display:flex;gap:10px;align-items:center;width:100%;min-height:34px;text-align:left;padding:6px 10px;border-radius:8px;transition:background-color .2s var(--eo)}
.mi:hover,.mi:focus-visible{background:var(--so);outline:none}
.mi svg{color:var(--mu);flex:none}
.mi small{display:block;color:var(--fa);font-size:12px}
.lb{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ma{flex:none;display:grid;margin:-2px 0}
.ma .av{width:20px;height:20px;font-size:11px}
.mi .av svg{color:inherit}
.sep{height:1px;margin:4px 10px;background:var(--ru)}
.tt{position:absolute;right:calc(100% + 14px);top:50%;translate:0 -50%;width:max-content;max-width:220px;padding:4px 9px;border-radius:8px;font-size:12px;line-height:1.4;
color:var(--mu);pointer-events:none;opacity:0;transform:translateX(3px);
transition:opacity var(--out) var(--ei),transform var(--out) var(--ei)}
.mi:hover>.tt,.mi:focus-visible>.tt{opacity:1;transform:none;transition:opacity var(--in) var(--eo) .5s,transform var(--in) var(--eo) .5s}
@media (max-width:600px){.tt{right:8px;top:auto;bottom:100%;translate:none;transform:translateY(3px)}}
/* Switches: a track and a knob that slides (cross-fades with reduced motion). */
.sw{position:relative;flex:none;width:26px;height:16px;border-radius:8px;background:var(--ln);transition:background-color var(--mv) var(--eio)}
.sw::before,.sw::after{content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);
transition:transform var(--mv) var(--eio),opacity var(--mv) var(--eio)}
.sw::before{opacity:0;transform:translateX(10px)}
[aria-checked=true]>.sw{background:var(--pu-accent)}
[aria-checked=true]>.sw::after{transform:translateX(10px)}
.tools{display:flex;flex:none;gap:2px}
.tools[hidden]{display:none}
.tool[aria-pressed=true]{background:var(--as);color:var(--pu-accent)}
.note{display:block;padding:0 0 4px;font-size:12px;color:var(--fa)}
.note[hidden]{display:none}
.ov{position:absolute;inset:0;pointer-events:none;overflow:hidden}
/* An add-on's panel (.xp) is the same full-height panel as All comments (.all), with its own body. */
.xb{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:4px 16px 16px;font-size:13px}
.xb p{margin:0 0 10px}
/* All comments: a full-height panel on the right that slides in (fades, with reduced motion). */
.all,.xp{position:fixed;top:0;right:0;bottom:0;width:var(--pu-panel);display:flex;flex-direction:column;border-width:0 0 0 1px;opacity:0;transform:translateX(100%);
transition:transform var(--out) var(--ei),opacity var(--out) var(--ei)}
.all.show,.xp.show{opacity:1;transform:none;pointer-events:auto;transition:transform var(--mv) var(--eo),opacity var(--in) var(--eo)}
.all.full{width:100%}
.hd{display:flex;align-items:center;gap:8px;padding:12px 10px 8px 16px;font-weight:600}
.pn{font-weight:400;color:var(--fa)}
.hs{margin-left:auto;display:flex;align-items:center;gap:6px;padding:3px 4px 3px 6px;border-radius:6px;font-size:12px;font-weight:400;color:var(--mu);
transition:background-color .2s var(--eo)}
.hs:hover,.hs:focus-visible{background:var(--ho);outline:none}
.list{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:4px}
.all .mi{align-items:flex-start}
.all .mi>.av{flex:none}
.all .mi>span:last-child{flex:1;min-width:0}
.all .mi small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.all .mi.done{opacity:.6}
.all .mi.open{background:var(--so)}
.all .mi.open>.av,.all .mi.open .clamp{display:none}
.xr{padding:2px 12px 10px 16px}
/* The line from an open thread in the panel to its place on the page. */
.cx{position:fixed;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;opacity:0;transition:opacity var(--in) var(--eo)}
.cx.show{opacity:1}
.cx path{fill:none;stroke:var(--pu-accent);stroke-width:1.5;stroke-linecap:round;opacity:.7}
.cx circle{fill:var(--pu-accent)}
.layer.listing .col{opacity:0;transition:opacity var(--out) var(--ei)}
.sec{padding:8px 10px 2px;font-size:12px;color:var(--fa)}
.sec b{margin-left:6px;font-weight:500;color:var(--pu-accent)}
.toast{position:fixed;left:50%;bottom:28px;border-radius:10px;padding:8px 14px;font-size:13px;opacity:0;transform:translate(-50%,6px);
transition:opacity .3s var(--eo),transform .36s var(--eo)}
.toast.show{opacity:1;transform:translate(-50%,0)}

@media (forced-colors: active){
.pick.kf{border:3px solid Highlight}
.layer :is(.ib,.mi,.nb,.hs,.selbar button,.say button,.xb button):focus-visible{outline:2px solid Highlight}
}

@media (prefers-reduced-motion: reduce){
.bub,.bub.in,.bub.in:hover,.bub.on,.tip,.pop,.selbar,.menu,.all,.xp,.ttip,.tt,.toast{transform:none!important}
.sw::after{transform:none!important;transition-property:opacity}
[aria-checked=true]>.sw::after{opacity:0}
[aria-checked=true]>.sw::before{opacity:1}
.th{transition-property:opacity,box-shadow}
.tip.show{transition-property:opacity}
.pick,.pick.show{transition:opacity .16s ease-in-out}
.all,.all.show,.xp,.xp.show{transition-property:opacity}
.namebar,.namebar.show{transform:none!important;transition:opacity .16s ease-in-out}
.av,.nf{transform:none!important}
.av.ai::after{animation:none;opacity:.5}
.ghost .dots i{animation:none;opacity:.6}
@keyframes pu-pulse{0%{opacity:0}35%{opacity:.85}100%{opacity:0}}
}
`;
