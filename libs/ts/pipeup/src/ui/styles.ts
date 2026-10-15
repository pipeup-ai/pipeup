/** Pipeup's stylesheet, scoped to its shadow root. Light by default; `.dark` follows a dark page. */
export const STYLES = `
/* Inherited page styles are reset on .layer below; custom properties pass through all:initial. */
:host{all:initial;direction:ltr;unicode-bidi:normal}
*{box-sizing:border-box}
button{appearance:none;font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
svg{display:block}
.layer{all:initial;direction:ltr;unicode-bidi:normal;display:block;position:fixed;inset:0;pointer-events:none;font:13px/1.5 var(--pu-font,system-ui,sans-serif);color:var(--k);
--k:#2C2C2A;--mu:#5F5E5A;--fa:#6B6A64;--ln:#E5E3DA;--ru:#ECEAE2;--so:#FAFAF7;--su:#FFFFFF;--ho:#F1EFE8;
--as:color-mix(in srgb,var(--pu-accent,#534AB7) 12%,transparent);
--sh:0 8px 28px rgba(44,44,42,.10);
--in:.26s;--mv:.34s;--out:.2s;--pl:1.2s;
--eo:cubic-bezier(.22,.61,.36,1);--eio:cubic-bezier(.4,0,.2,1);--ei:cubic-bezier(.4,0,1,1);
--pu-text:var(--k);--pu-muted:var(--mu);--pu-faint:var(--fa);--pu-line:var(--ln);--pu-surface:var(--su);--pu-soft:var(--so);--pu-hover:var(--ho);--pu-shadow:var(--sh);--pu-ease:var(--eo)}
.layer{transition:opacity .24s var(--eo)}.layer.sw{opacity:0;transition-duration:.16s;transition-timing-function:var(--ei)}
.layer.dark{--k:#ECEBE6;--mu:#B4B2A9;--fa:#9A9892;--ln:#3A3936;--ru:#34332F;--so:#22221F;--su:#1B1B19;--ho:#2C2C29;--sh:0 8px 28px rgba(0,0,0,.45)}
.layer.hidden .bub,.layer.hidden .col,.layer.hidden .pop,.layer.hidden .tip,.layer.hidden .mark,.layer.hidden .selbar{opacity:0!important;pointer-events:none!important}

.tx{font-size:14px;line-height:1.5;color:var(--k);white-space:pre-wrap;overflow-wrap:anywhere}
.tx.del,.rest,.ctx,.ago{color:var(--fa)}
.rest,.ago{font-size:12px}
.rest{display:block;margin-top:3px}
/* A card's top line: avatar, who (cut short on one line, never wrapped), how long ago, then its actions. */
.hdr{position:relative;display:flex;align-items:center;gap:7px;min-height:22px}
.who{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600;color:var(--k)}
.ago{flex:none;white-space:nowrap}
.ago::before{content:"·";margin-right:6px}
.root>.tx,.it>.tx,.root>.ctx{margin-top:2px}
.ctx[hidden]{display:none}
.ctx{font-size:12px;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cd>.thread .tx,.clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
/* A long comment at rest in the column: its first four lines, fading out, then "more"; opened, it eases out to all of it. */
.th.long .root>.tx{max-height:var(--full);overflow:hidden;transition:max-height var(--mv) var(--eio)}
.th.long:not(.on) .root>.tx{max-height:84px;mask-image:linear-gradient(#000 calc(100% - 21px),transparent)}
.mr{display:grid;grid-template-rows:0fr;opacity:0;font-size:12px;color:var(--pu-accent);text-align:end;transition:grid-template-rows var(--mv) var(--eio),opacity var(--in) var(--eo)}
.mr>span{min-height:0;overflow:hidden}
.th.long:not(.on) .mr{grid-template-rows:1fr;opacity:1}
.tx a{color:var(--pu-accent);text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:2px}

/* Actions sit at the card's top right: always on an open card, on hover (or focus) on one at rest. In All comments a
closed card keeps them while its ⋯ menu is open, and focus put there for the keyboard (not a click) shows them. */
.acts{margin-left:auto;display:flex;flex:none;transition:opacity var(--in) var(--eo)}
.th:not(.on):not(:hover):not(:focus-within) .acts,.cd:not(.open):not(:hover):not(:has(:focus-visible,.pm)) .acts{opacity:0}
/* On a closed card they lie over the end of the top line, on the card's own colour, so the name has the whole line
while they're hidden and the card never changes size as they ease in. */
.th:not(.on) .acts,.cd:not(.open) .acts{position:absolute;right:0;padding-left:16px;background:linear-gradient(90deg,transparent,var(--bg) 14px)}
.th.on .rest{display:none}
/* A comment's ⋯ menu: Copy thread, Edit, Delete (asked twice). */
.pm{position:absolute;right:0;top:100%;z-index:5;display:flex;flex-direction:column;min-width:150px;padding:4px;border:1px solid var(--ln);border-radius:10px;background:var(--su);box-shadow:var(--sh)}
.pm.in{animation:pu-in var(--in) var(--eo) both}
.pm button{padding:6px 10px;border-radius:7px;text-align:left;font-size:13px;transition:background-color .2s var(--eo),color .2s var(--eo)}
.pm button:hover,.pm button:focus-visible{background:var(--ho)}
.pm .dl{color:#C9402F}.dark .pm .dl{color:#F08A7E}
.edit{margin-top:2px}
.ib{width:24px;height:22px;display:grid;place-items:center;border-radius:6px;color:var(--mu);transition:background-color .2s var(--eo),color .2s var(--eo)}
.ib:hover,.ib:focus-visible{background:var(--ho);color:var(--k)}

/* Replies: one level in, oldest first; the reply line ends the thread at the same indent. */
.rps,.rbox{padding-left:14px}
.rps .it{padding-top:8px}
.more{display:grid;grid-template-rows:1fr;transition:grid-template-rows var(--mv) var(--eio)}
.more>div{overflow:hidden;min-height:0}
.th:not(.on) .more{grid-template-rows:0fr}

/* Writing boxes: a rounded box that says what it's for, then Cancel and Send (named) while it is in use. */
.row{position:relative;padding-top:6px}
.line{display:flex;align-items:center;gap:6px;padding:3px 12px;border:1px solid var(--ln);border-radius:16px;cursor:text;transition:border-color var(--in) var(--eo),box-shadow var(--in) var(--eo)}
.line:hover{border-color:var(--mu)}
.line:focus-within{border-color:var(--pu-accent);box-shadow:0 0 0 1px var(--pu-accent)}
.input{flex:1;min-width:0;height:24px;display:block;border:0;outline:none;resize:none;overflow:hidden;
font:inherit;font-size:14px;line-height:1.5;padding:1px 0;color:var(--k);background:transparent}
.input::placeholder{color:var(--fa);opacity:1}
.bts{display:flex;justify-content:flex-end;gap:4px;max-height:0;opacity:0;overflow:hidden;transition:max-height var(--in) var(--eo),opacity var(--in) var(--eo),padding var(--in) var(--eo)}
.row:focus-within .bts,.row.has .bts{max-height:40px;opacity:1;padding-top:4px}
.bts button{padding:2px 10px;border-radius:14px;font-size:13px;font-weight:600;color:var(--pu-accent);transition:background-color .2s var(--eo),color .2s var(--eo)}
.cnl:hover,.cnl:focus-visible{background:var(--as)}
.send{background:var(--pu-accent);color:var(--pu-on,#fff)!important}
.send:not(.show){background:var(--ru);color:var(--fa)!important;cursor:default}
.ed{display:flex;gap:10px;align-items:center;min-height:34px;padding:6px 10px}
.ed .input,.nf .input{font-size:13px;height:22px;border-bottom:1px solid var(--ln)}
.ed .input:focus,.nf .input:focus{border-bottom-color:var(--pu-accent)}

/* Avatars: a squircle with the writer's animal (or initial) on a soft colour, at the start of the card's top line. */
.av{flex:none;display:grid;place-items:center;width:22px;height:22px;border-radius:32%;
font-size:12px;font-weight:600;line-height:1;opacity:0;transform:scale(.85);transition:opacity var(--in) var(--eo),transform var(--in) var(--eo)}
.av.in{opacity:1;transform:none}
/* The animal nearly fills its tint (its drawing has room round it in its 24 grid), in a lighter line so it stays thin. */
.av svg{width:122%;height:122%;stroke-width:1.3}
/* Ten colours (.c0 Red to .c9 Grey, as COLOURS): a soft tint and a dark drawing, swapped round on dark pages. */
.av{--av-l:92%;--av-d:30%;--s:60%;background:hsl(var(--h) var(--s) var(--av-l));color:hsl(var(--h) var(--s) var(--av-d))}
.dark .av{--av-l:20%;--av-d:78%}
/* An AI's reply: a plain disc with a violet ring, all inside the avatar's own box so nothing is cropped. */
.av.ai{position:relative;border-radius:50%;background:var(--su);color:var(--pu-accent);font-size:9px;letter-spacing:.02em}
.av.ai::before{content:"";position:absolute;inset:3px;border-radius:50%;border:1.5px solid var(--pu-accent);pointer-events:none}
.refs{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;white-space:normal}
.refs .ref{display:inline-flex;align-items:center;gap:5px;max-width:160px;padding:1px 9px;border:1px solid var(--ln);border-radius:999px;background:var(--so);color:var(--mu);font:inherit;font-size:11.5px;line-height:1.6;text-decoration:none;cursor:pointer;transition:background-color .2s var(--eo),color .2s var(--eo),border-color .2s var(--eo)}
.refs .ref:hover,.refs .ref:focus-visible{background:var(--as);color:var(--pu-accent);border-color:var(--pu-accent)}
.ref span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rxp{position:fixed;width:320px;height:340px;border-radius:12px;overflow:hidden;pointer-events:none;opacity:0;transform:translateY(4px);transition:opacity var(--in) var(--eo),transform var(--in) var(--eo)}
.rxp.show{opacity:1;transform:none;pointer-events:auto}
.mn{border-radius:4px;padding:0 2px;background:var(--as);color:var(--pu-accent)}
.mn.me{font-weight:600}
.mnl{position:absolute;left:0;bottom:100%;margin:0 0 4px;padding:4px;list-style:none;min-width:180px;max-width:100%;border:1px solid var(--ln);border-radius:10px;background:var(--su);box-shadow:var(--sh);opacity:0;transform:translateY(4px);pointer-events:none;z-index:4;transition:opacity var(--in) var(--eo),transform var(--in) var(--eo)}
.mnl.show{opacity:1;transform:none;pointer-events:auto}
.mnl li{display:flex;align-items:baseline;gap:8px;padding:5px 8px;border-radius:6px;font-size:13px;color:var(--k);cursor:pointer}
.mnl li small{font-size:11px;color:var(--fa)}
.mnl li.on,.mnl li:hover{background:var(--as);color:var(--pu-accent)}
.dlg{position:fixed;left:50%;top:18vh;width:min(380px,calc(100vw - 32px));padding:16px 18px;border:1px solid var(--ln);border-radius:14px;background:var(--su);box-shadow:var(--sh);color:var(--k);opacity:0;transform:translate(-50%,6px);pointer-events:none;transition:opacity var(--in) var(--eo),transform var(--in) var(--eo)}
.dlg.show{opacity:1;transform:translate(-50%,0);pointer-events:auto}
.toast.act{pointer-events:auto}
.ta{margin-left:4px;color:var(--pu-accent);text-decoration:underline;text-underline-offset:2px}
.rx .n{font-size:11px;font-variant-numeric:tabular-nums}
.rx.mine{background:var(--as);color:var(--pu-accent);border-color:var(--pu-accent)}
.rx:disabled{cursor:default;opacity:.7}
.rx.new,.rxq.new{animation:pu-in var(--mv) var(--eo) both}
.rxs{align-items:center}
.rxq{display:inline-flex;gap:2px}
.rxo{padding:2px 5px;border-radius:8px;font-size:16px;line-height:1.3;transition:background-color .2s var(--eo)}
.rxo:hover,.rxo:focus-visible,.rxo[aria-pressed=true]{background:var(--as)}
.refs .ref{position:relative}.ref .rc{position:absolute;left:0;top:calc(100% + 6px);z-index:3;width:max-content;max-width:min(240px,70vw);padding:6px 9px;border:1px solid var(--ln);border-radius:8px;background:var(--su);box-shadow:var(--sh);color:var(--k);font-size:12px;line-height:1.45;white-space:normal;text-align:left;overflow:visible;opacity:0;visibility:hidden;transform:translateY(-3px);pointer-events:none;transition:opacity .2s var(--eo),transform .2s var(--eo),visibility 0s .2s}.ref:hover .rc,.ref:focus-visible .rc{opacity:1;visibility:visible;transform:none;transition-delay:0s}
.ref .sl{width:10px;height:7px;border:1.3px solid currentColor;border-radius:2px;flex:none}
.seen{display:flex;align-items:center;gap:6px;padding:6px 0 0 14px;font-size:12px;color:var(--fa)}
.seen button{margin-left:auto;padding:0 6px;border:0;border-radius:6px;background:none;color:var(--fa);font:inherit;cursor:pointer;transition:color .2s var(--eo),background-color .2s var(--eo)}.seen button:hover,.seen button:focus-visible{color:var(--pu-accent);background:var(--as)}
.seen i{width:12px;height:12px;border-radius:50%;border:1.5px solid var(--pu-accent);flex:none}
.c0{--h:0}.c1{--h:25}.c2{--h:50}.c3{--h:130}.c4{--h:175}.c5{--h:215}.c6{--h:270}.c7{--h:330}.c8{--h:28;--s:35%}.c9{--h:220;--s:8%}
button.me{flex:none;display:grid}
button.me>.av{grid-area:1/1}
/* Who you are, at the top of a new comment; a name field eases open in its place. */
.you{flex:1;display:grid;min-width:0;min-height:22px;font-size:12px;color:var(--fa)}
.you .nm{font-size:13px;font-weight:600;color:var(--k)}
.you>*{grid-area:1/1;display:flex;align-items:center;min-width:0;transition:opacity var(--in) var(--eo),transform var(--in) var(--eo)}
.say{white-space:pre;overflow:hidden}
.nm{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.say button{flex:none}
.say button{color:var(--mu);text-decoration:underline;text-decoration-color:var(--ln);text-underline-offset:2px;transition:color .2s var(--eo)}
.say button:hover,.say button:focus-visible{color:var(--pu-accent)}
.nf{opacity:0;transform:translateY(-4px);pointer-events:none}
.nf .input{font-size:13px;height:24px}
.you.naming .nf{opacity:1;transform:none;pointer-events:auto}
.you.naming .say{opacity:0;pointer-events:none}

/* Bubbles, tips, popovers, marks, pulses. */
.bub{position:fixed;left:0;top:0;width:20px;height:20px;margin:-20px 0 0 -2px;border-radius:50% 50% 50% 0;background:var(--pu-accent);
border:2px solid var(--su);box-shadow:0 1px 4px rgba(0,0,0,.2);pointer-events:auto;opacity:0;transform:translateY(-6px) scale(.9);transform-origin:2px 20px;
transition:opacity var(--out) var(--ei),transform var(--out) var(--ei)}
.bub.in{opacity:1;transform:none;transition:opacity var(--in) var(--eo),transform var(--in) var(--eo)}
.bub.in:hover,.bub.on{transform:scale(1.18)}
.bub.done{background:var(--fa)}
.bub.ghost{pointer-events:none}
.tip,.pop,.menu,.all,.xp,.toast,.selbar,.namebar,.tt,.rxp{background:var(--su);border:1px solid var(--ln);box-shadow:var(--sh)}
.tip{position:fixed;max-width:260px;border-radius:10px;padding:7px 10px;opacity:0;transform:translateY(3px);
transition:opacity .22s var(--eo),transform .26s var(--eo)}
.tip.show{opacity:1;transform:none;pointer-events:auto;cursor:pointer;
transition:opacity .22s var(--eo),transform .26s var(--eo),left var(--mv) var(--eio),top var(--mv) var(--eio)}
.pop{position:fixed;width:var(--pu-pop);border-radius:12px;padding:8px 10px 10px;pointer-events:none;opacity:0;transform:translateY(6px) scale(.98);
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
/* Each thread is a compact card; the open one lifts with a soft shadow. */
.th,.cd{--bg:var(--su);background:var(--bg);opacity:var(--o,1)}
.th{position:absolute;left:0;right:0;top:0;padding:8px 10px 10px;border:1px solid var(--ln);border-radius:10px;pointer-events:auto;cursor:pointer;
transition:transform var(--mv) var(--eio),box-shadow var(--in) var(--eo),border-color var(--in) var(--eo),opacity var(--in) var(--eo)}
.th.hot{border-color:var(--mu)}
.th.on{border-color:transparent;box-shadow:var(--sh);cursor:default}
.th.dim{--o:.45}
.th.resolved:not(.on):not(.hot){--o:.6}
.th.lost .ctx{white-space:normal}
.th.wait{opacity:0!important;pointer-events:none}
.th:is(.out,.hop){opacity:0!important;pointer-events:none;transition:opacity var(--out) var(--ei)}
/* A closed thread's button has no box of its own: the thread shows its focus. */
.th:has(.opn:focus-visible){outline:2px solid var(--pu-accent);outline-offset:2px}

/* Selection bar. */
.selbar{position:fixed;display:flex;border-radius:10px;padding:2px;opacity:0;transform:translateY(4px);pointer-events:none;
transition:opacity var(--in) var(--eo),transform .3s var(--eo)}
.selbar.show{opacity:1;transform:none;pointer-events:auto}
.selbar button{width:32px;height:30px;display:grid;place-items:center;border-radius:8px;color:var(--pu-accent);transition:background-color .2s var(--eo)}
.selbar button:hover,.selbar button:focus-visible{background:var(--as)}

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
.sr,.mn-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.namebar{position:fixed;left:0;top:0;display:flex;align-items:center;gap:2px;padding:2px 2px 2px 10px;border-radius:10px;font-size:12px;color:var(--mu);
white-space:nowrap;pointer-events:none;opacity:0;transform:translateY(4px);
transition:opacity var(--out) var(--ei),transform var(--out) var(--ei)}
.namebar.show{opacity:1;transform:none;pointer-events:auto;transition:opacity var(--in) var(--eo),transform .3s var(--eo)}
.namebar.show.glide{transition-property:all;transition-duration:var(--mv);transition-timing-function:var(--eio)}
.namebar .lbl{margin-right:6px;max-width:260px;overflow:hidden;text-overflow:ellipsis}
.namebar .nb{padding:4px;display:grid;place-items:center;border-radius:7px;transition:background-color .2s var(--eo),color .2s var(--eo)}
.namebar .nb:hover,.namebar .nb:focus-visible{background:var(--ho);color:var(--k)}
.namebar .nb[hidden]{display:none}

/* The comment control: a small square of frosted glass tucked into the page's corner (flush right and bottom, its
top left rounded), with the open count inside a comment bubble. Pointed at, it reaches left just far enough to show
its shortcut (and anything add-ons say). Its layers and numbers cross-fade in place. */
.launch{position:fixed;right:0;bottom:0;display:flex;flex-direction:row-reverse;align-items:center;border-top-left-radius:10px;pointer-events:auto;transform-origin:100% 100%;
background:color-mix(in srgb,var(--su) 62%,transparent);-webkit-backdrop-filter:blur(10px) saturate(1.5);backdrop-filter:blur(10px) saturate(1.5);
transition:opacity var(--in) var(--eo),transform var(--mv) var(--eo),background-color .3s var(--eo),color .3s var(--eo)}
.launch:has(.mode.on){background:color-mix(in srgb,var(--pu-accent) 90%,transparent);color:var(--pu-on,#fff)}
/* While All comments is open, the control is the panel's footer: it draws in, and the footer takes its place. */
.layer.listing .launch{opacity:0;transform:scale(.6);pointer-events:none}
.menu.inp{right:8px;bottom:60px;z-index:1}
.menu.inp :is([data-item=comment],[data-item=all]){display:none}
.launch .mode{position:relative;display:grid;place-items:center;width:32px;height:32px;border-radius:10px 0 0}
.mode>*,.cnt>*{grid-area:1/1}
.mode>*{display:grid;place-items:center;transition:opacity var(--in) var(--eo)}
.cnt,.has>.plus{opacity:0}
.has>.cnt{opacity:1}
.cnt>.n{font-size:11px;font-weight:500;line-height:1;margin:-1.2px 0 0 1.2px;font-variant-numeric:tabular-nums lining-nums;opacity:0;transition:opacity var(--in) var(--eo)}
.n.s{font-size:10px;letter-spacing:-.03em}
.w>.n{margin-top:-3.4px}
.cnt>svg{transition:opacity var(--in) var(--eo)}
.cnt>svg+svg,.cnt.w>svg{opacity:0}
.cnt.w>svg+svg{opacity:1}
.n.on{opacity:1}
.launch .mode:focus-visible{outline:2px solid var(--pu-accent);outline-offset:-2px}
/* Open threads on other slides or views: a small dot at the bubble's top right, easing in and out. */
.mode>.dot{position:absolute;top:2px;right:2px;width:8px;height:8px;border-radius:50%;background:var(--pu-accent);opacity:0;transition:opacity var(--in) var(--eo),background-color .3s var(--eo)}
.mode.else>.dot{opacity:1}
.mode.on>.dot{background:var(--pu-on,#fff)}
/* What it reaches out to show when pointed at: the shortcut, after anything add-ons say. Its width eases to exactly what
the words need (a 0fr to 1fr column), so it opens and folds evenly, and it folds at once when the pointer leaves. */
.ttip{display:grid;grid-template-columns:minmax(0,0fr);overflow:hidden;font-size:12px;color:var(--mu);pointer-events:none;opacity:0;transition:grid-template-columns var(--out) var(--ei),opacity var(--out) var(--ei)}
.ttip>span{min-width:0;white-space:nowrap;padding-left:10px}
.ttip small{font-size:12px}
.ttip small,.mi .kc{color:var(--fa)}
.launch:has(.mode.on) :is(.ttip,.ttip small){color:inherit}
.launch:hover .ttip{grid-template-columns:minmax(0,1fr);opacity:1;transition:grid-template-columns var(--mv) var(--eo) .4s,opacity var(--in) var(--eo) .4s}
.launch .mode[aria-expanded=true]+.ttip{grid-template-columns:minmax(0,0fr);opacity:0}
@media (hover:none){.ttip,.tt,.cd>.thread .acts{display:none}}
.menu{position:fixed;right:8px;bottom:40px;width:290px;border-radius:12px;padding:4px;pointer-events:none;opacity:0;transform:translateY(6px);
transition:opacity var(--out) var(--ei),transform var(--out) var(--ei)}
.menu.show{opacity:1;transform:none;pointer-events:auto;transition:opacity var(--in) var(--eo),transform var(--mv) var(--eo)}
/* Menu rows: one line each; the explanation is a tooltip beside the menu that eases in after a moment. */
.mi{position:relative;display:flex;gap:10px;align-items:center;width:100%;min-height:34px;text-align:left;padding:6px 10px;border-radius:8px;transition:background-color .2s var(--eo)}
.mi:hover,.mi:focus-visible{background:var(--so)}
.mi svg{color:var(--mu);flex:none}
.mi small{display:block;color:var(--fa);font-size:12px}
.lb{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ma{flex:none;display:grid;margin:-2px 0}
.ma .av{width:20px;height:20px;font-size:11px}
.mi .av svg{color:inherit}
.sep{height:1px;margin:4px 10px;background:var(--ru)}
/* Copy comments opens to its two choices beneath it, set in under it; folding and unfolding ease. */
.subs{display:grid;grid-template-rows:0fr;opacity:0;transition:grid-template-rows var(--in) var(--eo),opacity var(--in) var(--eo)}
.subs.open{grid-template-rows:1fr;opacity:1}
.subs>div{min-height:0;overflow:hidden}
.subs .mi{padding-left:30px}
.chev{display:grid;transition:transform var(--in) var(--eo)}
[aria-expanded=true]>.chev{transform:rotate(90deg)}
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
/* The header: no title, two filters (an icon and a word in a pill: grey off, a soft accent fill on) and Close. */
.hd{display:flex;align-items:center;gap:4px;padding:8px 8px 6px}
.sp{flex:1}
.tg{position:relative;display:flex;align-items:center;gap:5px;height:28px;padding:0 11px 0 9px;border-radius:99px;white-space:nowrap;line-height:1;color:var(--mu);transition:background-color .2s var(--eo),color .2s var(--eo)}
.tg:hover{background:var(--ho);color:var(--k)}
.tg[aria-pressed=true]{background:var(--as);color:var(--pu-accent)}
.tg[aria-pressed=true]:hover{background:color-mix(in srgb,var(--pu-accent) 20%,transparent)}
.tg:focus-visible{outline:2px solid var(--pu-accent);outline-offset:1px}
/* What each filter does: a tooltip under it that eases in after a moment, on hover or focus. */
.tg::after{content:attr(data-tip);position:absolute;left:0;top:calc(100% + 4px);z-index:3;width:max-content;max-width:220px;padding:4px 9px;border:1px solid var(--ln);border-radius:8px;background:var(--su);box-shadow:var(--sh);font-size:12px;line-height:1.4;color:var(--mu);pointer-events:none;opacity:0;transform:translateY(-3px);transition:opacity var(--out) var(--ei),transform var(--out) var(--ei)}
.tg:not([aria-pressed=true]):is(:hover,:focus-visible)::after{opacity:1;transform:none;transition:opacity var(--in) var(--eo) .4s,transform var(--in) var(--eo) .4s}
.list{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:4px 8px 8px;background:var(--so)}
/* Threads in the panel are the same cards; opened, a card shows the thread beneath the words it's about. */
.cd{position:relative;margin-top:6px;border:1px solid var(--ln);border-radius:10px}
/* What filters take away or bring back folds out or in, and a card opening or closing eases to its new height. */
.list :is(.cd,[role=group],.sec){transition:all var(--mv) var(--eio)}
.list .out{opacity:0!important;margin-top:0;padding-block:0;border-width:0;overflow:hidden}
.cd.open{border-color:transparent;box-shadow:var(--sh)}
.cd.done{--o:.6}
/* Closed, its button lies over it (choosing the card opens it), beneath its actions and what they open. */
.cd>.mi{position:absolute;inset:0;border-radius:10px;background:none}
.cd>.thread :is(.acts,.refs,.edit){position:relative;z-index:1}
.cd:not(.open,.new):is(:hover,:has(>.mi:focus-visible)){--bg:var(--so)}
.cd.open>.mi{display:none}
.cd.open .root>.hdr{cursor:pointer}
.cd.new,.xr,.cd>.thread{padding:8px 10px 10px}
/* The footer: who you are, Comment (its shortcut and switch), and ⋯ for the menu. */
.pf{display:flex;align-items:center;gap:8px;min-height:52px;padding:0 8px 0 14px;border-top:1px solid var(--ln)}
.fs{display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:8px;font-size:13px;transition:background-color .2s var(--eo)}
.fs:hover,.fs:focus-visible{background:var(--ho)}
.fs small{font-size:12px;color:var(--fa)}
.pf .ib{width:30px;height:30px}
/* The line from an open thread in the panel to its place on the page. */
.cx{position:fixed;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;opacity:0;transition:opacity var(--in) var(--eo)}
.cx.show{opacity:1}
.cx path{fill:none;stroke:var(--pu-accent);stroke-width:1.5;stroke-linecap:round;opacity:.7}
.cx circle{fill:var(--pu-accent)}
.layer.listing .col{opacity:0;transition:opacity var(--out) var(--ei)}
.sec{padding:8px 10px 2px;font-size:12px;color:var(--fa)}
.ag{display:flex;align-items:center;gap:8px;padding:6px 14px;font-size:12px;color:var(--fa);border-bottom:1px solid var(--ln)}
.ag[hidden]{display:none}
.lns{display:flex;flex-direction:column}
.ln{display:grid;grid-template-rows:0fr;opacity:0;transition:grid-template-rows var(--in) var(--eo),opacity var(--in) var(--eo)}
.ln.show{grid-template-rows:1fr;opacity:1}
.ln>.lw{overflow:hidden;min-height:0}
.ag button{margin-left:auto;flex:none;padding:0 6px;border-radius:6px;color:var(--fa);transition:color .2s var(--eo),background-color .2s var(--eo)}.ag button:hover:not(:disabled),.ag button:focus-visible{color:var(--pu-accent);background:var(--as)}.ag button:disabled{opacity:.5;cursor:default}
.adr{margin:8px 0 0 14px;padding:8px 10px;border-radius:8px;background:var(--so);font-size:13px;color:var(--k);animation:pu-in var(--mv) var(--eo) both}
.adr small{display:block;font-size:12px;color:var(--fa)}
.adr .go{display:flex;gap:6px;margin-top:6px}
.adr .go button{padding:2px 8px;border-radius:6px;font-size:12px;color:var(--mu);transition:color .2s var(--eo),background-color .2s var(--eo)}.adr .go button:hover,.adr .go button:focus-visible{color:var(--pu-accent);background:var(--as)}
@keyframes pu-in{0%{opacity:0;transform:translateY(3px)}100%{opacity:1;transform:none}}
.sec b{margin-left:6px;font-weight:500;color:var(--pu-accent)}
/* Messages sit beside the comment control, never over the page's own bottom bar; beside the panel while it is open,
and above its footer when it fills the screen. */
.toast{--r:40px;position:fixed;right:var(--r);bottom:4px;max-width:min(320px,calc(100vw - var(--r) - 16px));border-radius:10px;padding:8px 14px;font-size:13px;opacity:0;transform:translateY(6px);transition:.3s var(--eo)}
.toast.show{opacity:1;transform:none}
.layer:is(.listing,:has(.xp.show)) .toast{--r:calc(var(--pu-panel) + 16px)}
@media (max-width:480px){.layer:is(.listing,:has(.xp.show)) .toast{--r:12px;bottom:64px}}

/* Touch: fingers need bigger targets than pointers (44 px for the menu's rows, 36 and more for buttons). */
@media (pointer:coarse){
.mi{min-height:44px}
.ib{min-width:36px;min-height:36px}
.rxo{min-width:40px;min-height:40px}
.refs .ref{min-height:34px}
.mnl li{min-height:40px}
.bts button,.tg{min-height:36px}
.launch .mode{width:44px;height:44px}
}

/* Keyboard focus is always plainly marked: a 2 px ring in the accent, which reads at 4.5 to 1 on Pipeup's surfaces. */
.layer :is(button,a):not(.mi,.opn,.mode,.tg):focus-visible{outline:2px solid var(--pu-accent);outline-offset:1px}
.layer .mi:focus-visible{outline:2px solid var(--pu-accent);outline-offset:-2px}
/* A look that differs from the page's keeps its see-through parts solid: a dimmed card dims its words, not the card. */
.flip .launch{background:var(--su)}
.flip :is(.th,.cd){opacity:1}
.flip :is(.th,.cd)>*{opacity:var(--o,1);transition:opacity var(--in) var(--eo)}

@media (forced-colors: active){
.pick.kf{border:3px solid Highlight}
.layer :is(.ib,.mi,.nb,.tg,.fs,.selbar button,.say button,.xb button):focus-visible{outline:2px solid Highlight}
/* Switches, the filters, your own reactions and comment mode draw in system colours, so every state shows. */
.sw{forced-color-adjust:none;border:1px solid CanvasText;background:Canvas}
.sw::before,.sw::after{top:1px;left:1px;background:CanvasText}
[aria-checked=true]>.sw{background:Highlight;border-color:Highlight}
[aria-checked=true]>.sw::before,[aria-checked=true]>.sw::after{background:HighlightText}
.layer :is(.tg,.rxo,.rx)[aria-pressed=true],.launch:has(.mode.on){forced-color-adjust:none;background:Highlight;color:HighlightText;border-color:Highlight}
}

@media (prefers-reduced-motion: reduce){
.ln,.subs{transition-property:opacity}
@keyframes pu-in{0%{opacity:0}100%{opacity:1}}
.bub,.bub.in,.bub.in:hover,.bub.on,.tip,.pop,.selbar,.menu,.all,.xp,.tt,.toast,.ref .rc,.rxp,.mnl{transform:none!important}
.ttip{transition-property:opacity!important}
.dlg{transform:translate(-50%,0)!important}
.sw::after{transform:none!important;transition-property:opacity}
[aria-checked=true]>.sw::after{opacity:0}
[aria-checked=true]>.sw::before{opacity:1}
.th,.th.long .root>.tx,.mr,.list :is(.cd,[role=group],.sec){transition-property:opacity,box-shadow}
.tip.show,.toast{transition-property:opacity}
.pick,.pick.show{transition:opacity .16s ease-in-out}
.all,.all.show,.xp,.xp.show{transition-property:opacity}
.namebar,.namebar.show{transform:none!important;transition:opacity .16s ease-in-out}
.av,.nf,.launch{transform:none!important}
@keyframes pu-pulse{0%{opacity:0}35%{opacity:.85}100%{opacity:0}}
}
`;
