/** Pipeup's stylesheet, scoped to its shadow root. Light by default; `.dark` follows a dark page. */
export const STYLES = `
/* Inherited page styles are reset on .layer below; custom properties pass through all:initial. */
:host{all:initial}
*{box-sizing:border-box}
button{-webkit-appearance:none;appearance:none;font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
svg{display:block}
.layer{all:initial;display:block;position:fixed;inset:0;pointer-events:none;font:13px/1.5 var(--pu-font,system-ui,sans-serif);color:var(--pu-ink);
--pu-ink:#2C2C2A;--pu-muted:#5F5E5A;--pu-faint:#888780;--pu-line:#E5E3DA;--pu-rule:#ECEAE2;--pu-soft:#FAFAF7;--pu-surface:#FFFFFF;--pu-hover:#F1EFE8;
--pu-accent-soft:color-mix(in srgb,var(--pu-accent,#534AB7) 12%,transparent);
--pu-shadow:0 8px 28px rgba(44,44,42,.10);
--pu-enter:.26s;--pu-move:.34s;--pu-exit:.2s;--pu-pulse:1.2s;
--pu-eo:cubic-bezier(.22,.61,.36,1);--pu-eio:cubic-bezier(.4,0,.2,1);--pu-ei:cubic-bezier(.4,0,1,1)}
.layer.dark{--pu-ink:#ECEBE6;--pu-muted:#B4B2A9;--pu-faint:#8D8B84;--pu-line:#3A3936;--pu-rule:#34332F;--pu-soft:#22221F;--pu-surface:#1B1B19;--pu-hover:#2C2C29;--pu-shadow:0 8px 28px rgba(0,0,0,.45)}
.layer.hidden .bub,.layer.hidden .col,.layer.hidden .pop,.layer.hidden .tip,.layer.hidden .mark,.layer.hidden .selbar{opacity:0!important;pointer-events:none!important}

.tx{font-size:14px;line-height:1.5;color:var(--pu-ink);white-space:pre-wrap;overflow-wrap:anywhere}
.tx.del,.who,.rest,.ctx{color:var(--pu-faint)}
.who,.rest{font-size:12px}
/* Long names are cut short on one line, never wrapped. */
.who{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rft>.who{display:block}
.ctx[hidden]{display:none}
.ctx{font-size:12px;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.tx a{color:var(--pu-accent);text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:2px}

/* Footers: details take no space until hovered, then ease open beneath the words. */
.ft,.rft{display:grid;grid-template-rows:0fr;opacity:0;transition:grid-template-rows var(--pu-enter) var(--pu-eo),opacity var(--pu-enter) var(--pu-eo)}
.ft>*,.rft>*{overflow:hidden;min-height:0;display:flex;align-items:center}
.root:hover>.ft,.root:focus-within>.ft,.it:hover>.rft,.it:focus-within>.rft{grid-template-rows:1fr;opacity:1}
.ft.has-rest{grid-template-rows:1fr;opacity:1}
.ft.has-rest>*{grid-area:1/1}
.ft .hover{opacity:0;transition:opacity var(--pu-enter) var(--pu-eo)}
.ft .rest{transition:opacity var(--pu-enter) var(--pu-eo)}
.root:hover>.ft .hover,.root:focus-within>.ft .hover,.ft:not(.has-rest) .hover{opacity:1}
.root:hover>.ft .rest,.root:focus-within>.ft .rest{opacity:0}
.acts{margin-left:6px;display:flex;flex:none}
.ib{width:24px;height:22px;display:grid;place-items:center;border-radius:6px;color:var(--pu-muted);transition:background-color .2s var(--pu-eo),color .2s var(--pu-eo)}
.ib:hover,.ib:focus-visible{background:var(--pu-hover);color:var(--pu-ink);outline:none}

/* Replies: one level in, oldest first; the reply line ends the thread at the same indent. */
.rps,.rbox{padding-left:14px}
.rps .it{padding-top:6px}
.more{display:grid;grid-template-rows:1fr;transition:grid-template-rows var(--pu-move) var(--pu-eio)}
.more>div{overflow:hidden;min-height:0}
.th:not(.on) .more{grid-template-rows:0fr}

.row{display:flex;align-items:center;gap:8px;padding:8px 0 2px;cursor:text}
.input{flex:1;min-width:0;height:27px;display:block;border:0;border-bottom:1px solid var(--pu-line);outline:none;resize:none;overflow:hidden;
font:inherit;font-size:14px;line-height:1.5;padding:3px 0;color:var(--pu-ink);background:transparent;transition:border-color var(--pu-enter) var(--pu-eo)}
.row:hover .input,.input:hover{border-bottom-color:var(--pu-muted)}
.input:focus{border-bottom-color:var(--pu-accent)}
.ed{display:flex;gap:10px;align-items:center;min-height:34px;padding:6px 10px}
.ed .input{font-size:13px;height:22px}

/* Avatars: a squircle with the writer's animal (or initial) on a soft colour. Each comment keeps a fixed area
at its top right for one, so its words are the same width with or without it. */
.root,.it{position:relative;padding-right:30px}
.av{display:grid;place-items:center;width:22px;height:22px;border-radius:32%;
font-size:12px;font-weight:600;line-height:1;opacity:0;transform:scale(.85);transition:opacity var(--pu-enter) var(--pu-eo),transform var(--pu-enter) var(--pu-eo)}
.av.in{opacity:1;transform:none}
.av svg{width:80%;height:80%}
.root>.av,.it>.av{position:absolute;top:0;right:0}
.it>.av{top:6px}
/* Ten colours (.c0 Red to .c9 Grey, as COLOURS): a soft tint and a dark drawing, swapped round on dark pages. */
.av{--av-l:92%;--av-d:30%;--s:60%;background:hsl(var(--h) var(--s) var(--av-l));color:hsl(var(--h) var(--s) var(--av-d))}
.dark .av{--av-l:20%;--av-d:78%}
.c0{--h:0}.c1{--h:25}.c2{--h:50}.c3{--h:130}.c4{--h:175}.c5{--h:215}.c6{--h:270}.c7{--h:330}.c8{--h:28;--s:35%}.c9{--h:220;--s:8%}
.me{flex:none;display:grid}
.me>.av{grid-area:1/1;width:26px;height:26px;font-size:13px}
/* Who you are, under the comment line; a name field eases open in its place. */
.you{display:grid;padding:0 34px;min-height:24px;font-size:12px;color:var(--pu-faint)}
.you>*{grid-area:1/1;display:flex;align-items:center;min-width:0;transition:opacity var(--pu-enter) var(--pu-eo),transform var(--pu-enter) var(--pu-eo)}
.say{white-space:pre;overflow:hidden}
.nm{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.say button{flex:none}
.say button{color:var(--pu-muted);text-decoration:underline;text-decoration-color:var(--pu-line);text-underline-offset:2px;transition:color .2s var(--pu-eo)}
.say button:hover,.say button:focus-visible{color:var(--pu-accent);outline:none}
.nf{opacity:0;transform:translateY(-4px);pointer-events:none}
.nf .input{font-size:13px;height:24px}
.you.naming .nf{opacity:1;transform:none;pointer-events:auto}
.you.naming .say{opacity:0;pointer-events:none}
.send{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;color:var(--pu-accent);flex:none;opacity:0;pointer-events:none;
transition:opacity var(--pu-enter) var(--pu-eo),background-color .2s var(--pu-eo)}
.send.show{opacity:1;pointer-events:auto}
.send:hover{background:var(--pu-accent-soft)}

/* Bubbles, tips, popovers, marks, pulses. */
.bub{position:fixed;left:0;top:0;width:20px;height:20px;margin:-20px 0 0 -2px;border-radius:50% 50% 50% 0;background:var(--pu-accent);
border:2px solid var(--pu-surface);box-shadow:0 1px 4px rgba(0,0,0,.2);pointer-events:auto;opacity:0;transform:translateY(-6px) scale(.9);transform-origin:2px 20px;
transition:opacity var(--pu-exit) var(--pu-ei),transform var(--pu-exit) var(--pu-ei)}
.bub.in{opacity:1;transform:none;transition:opacity var(--pu-enter) var(--pu-eo),transform var(--pu-enter) var(--pu-eo)}
.bub.in:hover,.bub.on{transform:scale(1.18)}
.bub.done{background:var(--pu-faint)}
.bub.ghost{pointer-events:none}
.tip,.pop,.menu,.all,.toast,.selbar{background:var(--pu-surface);border:1px solid var(--pu-line);box-shadow:var(--pu-shadow)}
.tip{position:fixed;max-width:260px;border-radius:10px;padding:7px 10px;opacity:0;transform:translateY(3px);
transition:opacity .22s var(--pu-eo),transform .26s var(--pu-eo)}
.tip.show{opacity:1;transform:none;pointer-events:auto;cursor:pointer;
transition:opacity .22s var(--pu-eo),transform .26s var(--pu-eo),left var(--pu-move) var(--pu-eio),top var(--pu-move) var(--pu-eio)}
.pop{position:fixed;width:var(--pu-pop);border-radius:12px;padding:10px 12px 8px;pointer-events:none;opacity:0;transform:translateY(6px) scale(.98);
transition:opacity var(--pu-exit) var(--pu-ei),transform var(--pu-exit) var(--pu-ei)}
.pop.show{opacity:1;transform:none;pointer-events:auto;transition:opacity var(--pu-enter) var(--pu-eo),transform var(--pu-move) var(--pu-eo)}
.pop.show.glide{transition:opacity var(--pu-enter) var(--pu-eo),transform var(--pu-move) var(--pu-eo),left var(--pu-move) var(--pu-eio),top var(--pu-move) var(--pu-eio)}
.mark{position:fixed;border:2px solid color-mix(in srgb,var(--pu-accent) 50%,transparent);background:var(--pu-accent-soft);border-radius:8px;opacity:0;
transition:opacity .3s var(--pu-eo)}
.mark.show{opacity:1}
.pulse{position:fixed;border:2px solid var(--pu-accent);border-radius:8px;background:var(--pu-accent-soft);animation:pu-pulse var(--pu-pulse) var(--pu-eio) forwards}
@keyframes pu-pulse{0%{opacity:0;transform:scale(.985)}35%{opacity:.85;transform:scale(1)}100%{opacity:0;transform:scale(1.02)}}

/* Document column. */
.col{position:fixed;left:0;top:0;pointer-events:none;transition:opacity var(--pu-enter) var(--pu-eo)}
.th{position:absolute;left:0;right:0;top:0;padding:4px 4px 4px 12px;pointer-events:auto;cursor:pointer;box-shadow:inset 2px 0 0 transparent;
transition:transform var(--pu-move) var(--pu-eio),box-shadow var(--pu-enter) var(--pu-eo),opacity var(--pu-enter) var(--pu-eo)}
.th.hot{box-shadow:inset 2px 0 0 var(--pu-line)}
.th.on{box-shadow:inset 2px 0 0 var(--pu-accent);cursor:default}
.th.dim{opacity:.45}
.th.resolved:not(.on):not(.hot){opacity:.6}
.th.lost .ctx{white-space:normal}
.th.wait{opacity:0!important;pointer-events:none}
.th.out{opacity:0!important;pointer-events:none;transition:opacity var(--pu-exit) var(--pu-ei)}

/* Selection bar. */
.selbar{position:fixed;display:flex;border-radius:10px;padding:2px;opacity:0;transform:translateY(4px);pointer-events:none;
transition:opacity var(--pu-enter) var(--pu-eo),transform .3s var(--pu-eo)}
.selbar.show{opacity:1;transform:none;pointer-events:auto}
.selbar button{width:32px;height:30px;display:grid;place-items:center;border-radius:8px;color:var(--pu-accent);transition:background-color .2s var(--pu-eo)}
.selbar button:hover,.selbar button:focus-visible{background:var(--pu-accent-soft);outline:none}

/* Comment mode's outline: glides between blocks; solid accent once chosen. */
.pick{position:fixed;left:0;top:0;border:2px solid color-mix(in srgb,var(--pu-accent) 70%,transparent);background:color-mix(in srgb,var(--pu-accent) 6%,transparent);
border-radius:8px;pointer-events:none;opacity:0;transition:opacity var(--pu-exit) var(--pu-ei),border-color var(--pu-exit) var(--pu-ei)}
.pick.show{opacity:1;transition-duration:var(--pu-enter);transition-timing-function:var(--pu-eo)}
.pick.show.glide{transition-property:all;transition-duration:var(--pu-move);transition-timing-function:var(--pu-eio)}
.pick.on{border-color:var(--pu-accent)}
.namebar{position:fixed;left:0;top:0;display:flex;align-items:center;gap:2px;padding:2px 2px 2px 10px;border-radius:10px;font-size:12px;color:var(--pu-muted);
white-space:nowrap;background:var(--pu-surface);border:1px solid var(--pu-line);box-shadow:var(--pu-shadow);pointer-events:none;opacity:0;transform:translateY(4px);
transition:opacity var(--pu-exit) var(--pu-ei),transform var(--pu-exit) var(--pu-ei)}
.namebar.show{opacity:1;transform:none;pointer-events:auto;transition:opacity var(--pu-enter) var(--pu-eo),transform .3s var(--pu-eo)}
.namebar.show.glide{transition-property:all;transition-duration:var(--pu-move);transition-timing-function:var(--pu-eio)}
.namebar .lbl{margin-right:6px;max-width:260px;overflow:hidden;text-overflow:ellipsis}
.namebar .nb{padding:4px;display:grid;place-items:center;border-radius:7px;transition:background-color .2s var(--pu-eo),color .2s var(--pu-eo)}
.namebar .nb:hover,.namebar .nb:focus-visible{background:var(--pu-hover);color:var(--pu-ink);outline:none}
.namebar .nb[hidden]{display:none}

/* The comment control: one round button; the open count sits inside a comment bubble. Nothing about it
grows or slides: its layers and numbers cross-fade in place. */
.launch{position:fixed;right:20px;bottom:20px;pointer-events:auto}
.launch .mode{display:grid;place-items:center;width:46px;height:46px;border-radius:50%;background:var(--pu-surface);border:1px solid var(--pu-line);
box-shadow:var(--pu-shadow);transition:background-color .3s var(--pu-eo),color .3s var(--pu-eo)}
.mode>*,.cnt>*{grid-area:1/1}
.mode>*{display:grid;place-items:center;transition:opacity var(--pu-enter) var(--pu-eo)}
.cnt,.has>.plus{opacity:0}
.has>.cnt{opacity:1}
.n{font-size:12px;font-weight:500;line-height:1;margin:-1.4px 0 0 1.4px;font-variant-numeric:tabular-nums;opacity:0;transition:opacity var(--pu-enter) var(--pu-eo)}
.n.s{font-size:9.5px;letter-spacing:-.04em}
.n.on{opacity:1}
.launch .mode:hover,.launch .mode[aria-expanded=true]{background:var(--pu-hover)}
.launch .mode.on{background:var(--pu-accent);color:#fff}
/* The tooltip eases in after a moment, above the button, and never moves it. */
.ttip{position:absolute;right:0;bottom:54px;white-space:nowrap;border-radius:8px;padding:4px 9px;font-size:12px;background:var(--pu-surface);border:1px solid var(--pu-line);
box-shadow:var(--pu-shadow);pointer-events:none;opacity:0;transform:translateY(3px);transition:opacity var(--pu-exit) var(--pu-ei),transform var(--pu-exit) var(--pu-ei)}
.ttip small{margin-left:8px}
.ttip small,.mi .kc{font-size:12px;color:var(--pu-faint)}
.mode:hover+.ttip,.mode:focus-visible+.ttip{opacity:1;transform:none;transition:opacity var(--pu-enter) var(--pu-eo) .5s,transform var(--pu-enter) var(--pu-eo) .5s}
.launch .mode[aria-expanded=true]+.ttip{opacity:0;transition:opacity var(--pu-exit) var(--pu-ei)}
@media (hover:none){.ttip,.tt{display:none}}
.menu{position:fixed;right:20px;bottom:76px;width:290px;border-radius:12px;padding:4px;pointer-events:none;opacity:0;transform:translateY(6px);
transition:opacity var(--pu-exit) var(--pu-ei),transform var(--pu-exit) var(--pu-ei)}
.menu.show{opacity:1;transform:none;pointer-events:auto;transition:opacity var(--pu-enter) var(--pu-eo),transform var(--pu-move) var(--pu-eo)}
/* Menu rows: one line each; the explanation is a tooltip beside the menu that eases in after a moment. */
.mi{position:relative;display:flex;gap:10px;align-items:center;width:100%;min-height:34px;text-align:left;padding:6px 10px;border-radius:8px;transition:background-color .2s var(--pu-eo)}
.mi:hover,.mi:focus-visible{background:var(--pu-soft);outline:none}
.mi svg{color:var(--pu-muted);flex:none}
.mi small{display:block;color:var(--pu-faint);font-size:12px}
.lb{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ma{flex:none;display:grid;margin:-2px 0}
.ma .av{width:20px;height:20px;font-size:11px}
.mi .av svg{color:inherit}
.sep{height:1px;margin:4px 10px;background:var(--pu-rule)}
.tt{position:absolute;right:calc(100% + 14px);top:50%;translate:0 -50%;width:max-content;max-width:220px;padding:4px 9px;border-radius:8px;font-size:12px;line-height:1.4;
color:var(--pu-muted);background:var(--pu-surface);border:1px solid var(--pu-line);box-shadow:var(--pu-shadow);pointer-events:none;opacity:0;transform:translateX(3px);
transition:opacity var(--pu-exit) var(--pu-ei),transform var(--pu-exit) var(--pu-ei)}
.mi:hover>.tt,.mi:focus-visible>.tt{opacity:1;transform:none;transition:opacity var(--pu-enter) var(--pu-eo) .5s,transform var(--pu-enter) var(--pu-eo) .5s}
@media (max-width:600px){.tt{right:8px;top:auto;bottom:100%;translate:none;transform:translateY(3px)}}
/* Switches: a track and a knob that slides (cross-fades with reduced motion). */
.sw{position:relative;flex:none;width:26px;height:16px;border-radius:8px;background:var(--pu-line);transition:background-color var(--pu-move) var(--pu-eio)}
.sw::before,.sw::after{content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);
transition:transform var(--pu-move) var(--pu-eio),opacity var(--pu-move) var(--pu-eio)}
.sw::before{opacity:0;transform:translateX(10px)}
[aria-checked=true]>.sw{background:var(--pu-accent)}
[aria-checked=true]>.sw::after{transform:translateX(10px)}
/* All comments: a full-height panel on the right that slides in (fades, with reduced motion). */
.all{position:fixed;top:0;right:0;bottom:0;width:var(--pu-panel);display:flex;flex-direction:column;border-width:0 0 0 1px;opacity:0;transform:translateX(100%);
transition:transform var(--pu-exit) var(--pu-ei),opacity var(--pu-exit) var(--pu-ei)}
.all.show{opacity:1;transform:none;pointer-events:auto;transition:transform var(--pu-move) var(--pu-eo),opacity var(--pu-enter) var(--pu-eo)}
.all.full{width:100%}
.hd{display:flex;align-items:center;gap:8px;padding:12px 10px 8px 16px;font-weight:600}
.pn{font-weight:400;color:var(--pu-faint)}
.hs{margin-left:auto;display:flex;align-items:center;gap:6px;padding:3px 4px 3px 6px;border-radius:6px;font-size:12px;font-weight:400;color:var(--pu-muted);
transition:background-color .2s var(--pu-eo)}
.hs:hover,.hs:focus-visible{background:var(--pu-hover);outline:none}
.list{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:4px}
.all .mi{align-items:flex-start}
.all .mi>.av{flex:none}
.all .mi>span:last-child{flex:1;min-width:0}
.all .mi small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.all .mi .av svg{margin:0}
.all .mi.done{opacity:.6}
.layer.listing .col{opacity:0;transition:opacity var(--pu-exit) var(--pu-ei)}
.sec{padding:8px 10px 2px;font-size:12px;color:var(--pu-faint)}
.toast{position:fixed;left:50%;bottom:28px;border-radius:10px;padding:8px 14px;font-size:13px;opacity:0;transform:translate(-50%,6px);
transition:opacity .3s var(--pu-eo),transform .36s var(--pu-eo)}
.toast.show{opacity:1;transform:translate(-50%,0)}

@media (prefers-reduced-motion: reduce){
.bub,.bub.in,.bub.in:hover,.bub.on,.tip,.pop,.selbar,.menu,.all,.ttip,.tt,.toast{transform:none!important}
.sw::after{transform:none!important;transition-property:opacity}
[aria-checked=true]>.sw::after{opacity:0}
[aria-checked=true]>.sw::before{opacity:1}
.th{transition-property:opacity,box-shadow}
.tip.show{transition-property:opacity}
.pick,.pick.show{transition:opacity .16s ease-in-out}
.all,.all.show{transition-property:opacity}
.namebar,.namebar.show{transform:none!important;transition:opacity .16s ease-in-out}
.av,.nf{transform:none!important}
@keyframes pu-pulse{0%{opacity:0}35%{opacity:.85}100%{opacity:0}}
}
`;
