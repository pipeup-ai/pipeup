/* Pipeup's own behaviour in the prototype (prototype/app.js): what the Review a document journey needs beyond the
 * runtime's data-* attributes. It never styles anything; the design system does.
 * - Comment mode (⇧⌥C, the menu's Start commenting, the panel's switch): hovering outlines and names the block under
 *   the pointer (cmp-naming-bar); clicking it opens the comment box beside it (cmp-comment-card, composing); selecting
 *   words offers one comment icon past the paragraph's end; Option-click (or the bar's Pin) drops a pin (cmp-pin).
 * - Threads are kept in the runtime's ui state for the session and drawn as cards in the column level with their
 *   block; words threads mark their words with cmp-highlight. A thread takes replies, reactions (the quick row) and
 *   the More menu (Copy thread, Edit, Delete with its dialog).
 * - Cancel or Esc with words typed shows "Comment discarded." with Undo (also ⌘Z) for a few seconds.
 * - The corner tag (cmp-comment-control) counts the open threads and opens the menu (cmp-popover-menu): the name
 *   row edits in place, Copy comments as Markdown or as text, Theme, All comments, Hide comments, Start commenting.
 * - All comments (cmp-comments-panel) lists every thread beside the page with its filters and the footer the control
 *   turns into; one thread is open at a time, in the panel while it is open.
 * - Each step's route is a view of this page (#open-page … #undo-a-cancel): opening one sets the state the step
 *   starts from, so the bar's map shows every step; from #open-page the whole journey works by hand.
 * Loaded after runtime/prototype.js and before runtime/ds.js. Outside the prototype it does nothing.
 */
(function () {
  "use strict";

  var P = window.DAPrototype;
  if (!P) return;
  var doc = document;
  var root = doc.documentElement;
  var DEFAULT_NAME = "Maya Lindqvist";
  var CLOCK = (window.DA_PROTOTYPE && window.DA_PROTOTYPE.clock) || "2026-10-28T10:47";
  var ORDER = ["kicker", "title", "lede", "river-heading", "river-rose", "raise-the-deck", "gone", "path-heading", "pin-spot", "path-washed"];
  var SECTIONS = { "river-heading": "The river", "river-rose": "The river", "raise-the-deck": "The river", "path-heading": "The path", "pin-spot": "The path", "path-washed": "The path" };
  var EMOJI = [["👍", "thumbs up"], ["❤️", "heart"], ["😂", "laughing"], ["🎉", "party"], ["🤔", "thinking"]];
  var SEED = [
    { id: "t1", block: "raise-the-deck", kind: "block", quote: "", text: "Two days is optimistic. Last time the same job took a week; say so, or give a range.", at: "2026-10-28T10:42" },
    { id: "t2", block: "river-rose", kind: "words", quote: "rose twice that week", text: "Was it twice? The log says once, on the 14th.", at: "2026-10-28T10:45" },
    { id: "t3", block: "pin-spot", kind: "pin", quote: "", text: "A map of the north bank here would help.", at: "2026-10-28T10:47" }
  ];
  var REPLY_SAMPLE = "Or give a range: two days with the water low, a week otherwise.";
  var PAGE = doc.body.getAttribute("data-page") || "review";
  var DECK = PAGE === "deck";
  var SLIDES = ["Autumn at the footbridge", "Raise the deck before spring", "Mend the path"];
  var DECK_SEED = [
    { id: "d1", block: "slide-2", kind: "pin", quote: "", text: "Cut the second bullet; it repeats the title.", at: "2026-10-28T10:41" },
    { id: "d2", block: "slide-2", kind: "words", quote: "One course higher", text: "Say how high: one course is clear to us, not to the council.", at: "2026-10-28T10:43" },
    { id: "d3", block: "slide-3", kind: "words", quote: "Twenty metres washed out", text: "Twenty metres or thirty? The survey said thirty.", at: "2026-10-28T10:47" }
  ];
  var AUTHOR_SEED = [
    { id: "a1", block: "lede", kind: "block", quote: "", text: "Lead with the recommendation; the finding can follow.", at: "2026-10-28T10:43", who: "Red Fox", ini: "RF" },
    { id: "a2", block: "river-rose", kind: "words", quote: "rose twice that week", text: "Was it twice? The log says once, on the 14th.", at: "2026-10-28T10:45", who: "Maya Lindqvist", ini: "ML" },
    { id: "a3", block: "raise-the-deck", kind: "block", quote: "", text: "Two days is optimistic. Last time the same job took a week; say so, or give a range.", at: "2026-10-28T10:42", who: "Maya Lindqvist", ini: "ML", replies: [{ text: "Agreed. A range it is.", at: "2026-10-28T10:50", who: "Otter", ini: "OT" }] },
    { id: "a4", block: "pin-spot", kind: "pin", quote: "", text: "Walkers need a sign here before the meadow is gone.", at: "2026-10-28T10:52", who: "Red Fox", ini: "RF" }
  ];

  // ---- state, in the runtime's ui store (kept for the session; Reset clears it)

  function get(k, d) { var v = P.ui(k); return v === undefined || v === null || v === "" ? d : v; }
  function set(k, v) { P.ui(k, v); }
  function json(k, d) { try { return JSON.parse(get(k, d)); } catch (e) { return JSON.parse(d); } }
  function threads() { return json("threads", "[]"); }
  function saveThreads(list) { set("threads", JSON.stringify(list)); }
  function thread(id) { return threads().filter(function (t) { return t.id === id; })[0] || null; }
  function updateThread(id, fn) { var list = threads(); list.forEach(function (t) { if (t.id === id) fn(t); }); saveThreads(list); }
  function compose() { return json("compose", "null"); }
  function selection() { return json("selection", "null"); }
  function mode() { return get("mode", "") === "1"; }
  function hidden() { return get("hide", "") === "1"; }
  function panelOpen() { return get("panel", "") === "1"; }
  function name() { return get("name", PAGE === "author" ? "Tom Adeyemi" : DEFAULT_NAME); }
  function writer(t) { return t && t.who ? t.who : name(); }
  function writerInitials(t) { return t && t.ini ? t.ini : initials(); }
  function slide() { return parseInt(get("slide", "1"), 10) || 1; }
  function initials() { return name().split(/\s+/).map(function (w) { return w.charAt(0); }).join("").slice(0, 2).toUpperCase() || "?"; }

  // ---- time, as the comment card's content rules read it

  function ago(iso) {
    var t = Date.parse(iso), now = Date.parse(CLOCK);
    if (isNaN(t) || isNaN(now)) return "just now";
    var min = Math.round((now - t) / 60000);
    if (min < 1) return "just now";
    if (min < 60) return min + "m ago";
    var h = Math.round(min / 60);
    if (h < 24) return h + "h ago";
    return Math.round(h / 24) + "d ago";
  }
  function clockTime(iso) { return String(iso).slice(11, 16); }
  function settle() {
    var v = getComputedStyle(root).getPropertyValue("--ds-motion-settle").trim();
    return v.indexOf("ms") > 0 ? parseFloat(v) : v ? parseFloat(v) * 1000 : 0;
  }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function isMac() { return /Mac|iPhone|iPad/.test(navigator.platform); }
  function shortcut() { return isMac() ? "⇧⌥C" : "Shift+Alt+C"; }

  // ---- showing and hiding with the components' arriving and leaving states (never hidden alone)

  function arrive(el) {
    if (!el) return;
    el.removeAttribute("data-ds-leaving");
    el.hidden = false;
    el.setAttribute("data-ds-arriving", "");
    void getComputedStyle(el).opacity; // flush the start of the fade, then let it run (no animation frame needed)
    el.removeAttribute("data-ds-arriving");
  }
  function leave(el, done) {
    if (!el || el.hidden) { if (done) done(); return; }
    el.setAttribute("data-ds-leaving", "");
    setTimeout(function () {
      if (!el.hasAttribute("data-ds-leaving")) return; // it arrived again meanwhile
      el.hidden = true; el.removeAttribute("data-ds-leaving"); if (done) done();
    }, settle());
  }

  // ---- the page

  var report = doc.querySelector('[data-ref="report"], [data-ref="deck"]');
  var body = doc.querySelector("[data-body]");
  var control = doc.querySelector('[data-ref="comment-control"]');
  var controlRow = doc.querySelector('[data-ref="control-row"]');
  var panel = doc.querySelector('.ds-popover-menu[data-ref="menu"] > .ds-popover-menu__panel');
  var side = doc.querySelector('[data-ref="comments-panel"]');
  var copiedMessage = doc.querySelector('[data-ref="copied-message"]');
  var blockedMessage = doc.querySelector('[data-ref="clipboard-message"]');
  var discardedMessage = doc.querySelector('[data-ref="discarded-message"]');
  var undoButton = doc.querySelector("[data-undo]");
  var pinRow = doc.querySelector("[data-pin-row]");
  var dialog = doc.getElementById("delete-dialog");
  var shown = {};
  var hoverBlock = "";
  var messageTimer = null;
  var undoTimer = null;
  var deleting = "";

  function blockEl(id) { return report.querySelector('.ds-naming-bar[data-block="' + id + '"]'); }
  function contentOf(wrap) { return wrap.querySelector("[data-ref]"); }
  function columnOf(id) { return report.querySelector('[data-column="' + id + '"]'); }
  function words(w) { return contentOf(w).textContent.trim().split(/\s+/).slice(0, 5).join(" "); }

  doc.querySelectorAll(".ds-naming-bar[data-block]").forEach(function (w) {
    var c = contentOf(w);
    c.setAttribute("data-original", c.innerHTML);
  });

  // ---- rendering

  function avatar(t) { return '<span class="ds-avatar ds-avatar--sm" aria-hidden="true"><span class="ds-avatar__initials">' + esc(t ? writerInitials(t) : initials()) + "</span></span>"; }
  function moreMenu(t) {
    var mine = !t.who; // Edit and Delete only on your own comment
    return '<div class="ds-popover-menu ds-popover-menu--icon" data-ds="popover-menu"><button class="ds-icon-button ds-icon-button--quiet ds-popover-menu__trigger" type="button" aria-expanded="false" aria-label="More"><span class="ds-icon" data-icon="dots-three"></span></button><div class="ds-popover-menu__panel" hidden><ul class="ds-popover-menu__items" aria-label="More">' +
      '<li><button class="ds-button ds-button--quiet ds-popover-menu__item" type="button" data-more="copy" data-thread-id="' + t.id + '">Copy thread</button></li>' +
      (mine ? '<li><button class="ds-button ds-button--quiet ds-popover-menu__item" type="button" data-more="edit" data-thread-id="' + t.id + '">Edit</button></li><li><button class="ds-button ds-button--quiet ds-popover-menu__item" type="button" data-more="delete" data-thread-id="' + t.id + '" data-ds-dialog-open="delete-dialog">Delete</button></li>' : "") +
      "</ul></div></div>";
  }
  function actions(t) {
    var reacting = get("react", "") === t.id;
    return '<span class="ds-comment-card__actions">' +
      '<button class="ds-icon-button ds-icon-button--quiet" type="button" aria-label="React" aria-pressed="' + (reacting ? "true" : "false") + '" data-react="' + t.id + '"><span class="ds-icon" data-icon="smiley"></span></button>' +
      (t.resolved ? '<button class="ds-icon-button ds-icon-button--quiet" type="button" aria-label="Reopen" data-reopen="' + t.id + '"><span class="ds-icon" data-icon="arrow-counter-clockwise"></span></button>' : '<button class="ds-icon-button ds-icon-button--quiet" type="button" aria-label="Resolve" data-resolve="' + t.id + '"><span class="ds-icon" data-icon="check"></span></button>') +
      moreMenu(t) + "</span>";
  }
  function timeOf(t) { return '<span class="ds-comment-card__time" title="Today at ' + clockTime(t.at) + '">' + ago(t.at) + (t.edited ? " · edited" : "") + (t.resolved ? " · resolved" : "") + "</span>"; }
  function reactionsRow(t) {
    var r = t.reactions || {}, keys = Object.keys(r), reacting = get("react", "") === t.id;
    if (!keys.length && !reacting) return "";
    var h = '<div class="ds-comment-card__reactions">';
    keys.forEach(function (e) {
      var label = (EMOJI.filter(function (x) { return x[0] === e; })[0] || [e, e])[1];
      h += '<button class="ds-chip ds-chip--filter" type="button" aria-pressed="true" aria-label="' + esc(label) + ", " + r[e] + ', you reacted" data-emoji="' + e + '" data-thread-id="' + t.id + '">' + e + " " + r[e] + "</button>";
    });
    if (reacting) {
      h += '<span class="ds-comment-card__quick" data-quick>';
      EMOJI.forEach(function (x) { h += '<button class="ds-button ds-button--quiet" type="button" aria-label="React with ' + x[1] + '" data-emoji="' + x[0] + '" data-thread-id="' + t.id + '">' + x[0] + "</button>"; });
      h += "</span>";
    }
    return h + "</div>";
  }
  function card(t, open) {
    var h = '<article class="ds-comment-card' + (open ? " ds-comment-card--open" : "") + '" data-thread="' + t.id + '" aria-label="Thread by ' + esc(writer(t)) + '" data-ref="thread-' + t.id + '">';
    if (open) h += '<div class="ds-comment-card__head">' + avatar(t) + '<span class="ds-comment-card__name">' + esc(writer(t)) + "</span>" + timeOf(t) + actions(t) + "</div>";
    else h += '<div class="ds-comment-card__head" role="button" tabindex="0" aria-expanded="false" aria-label="Open the thread by ' + esc(writer(t)) + '" data-open>' + avatar(t) + '<span class="ds-comment-card__name">' + esc(writer(t)) + "</span>" + timeOf(t) + actions(t) + "</div>";
    if (open && get("edit", "") === t.id) {
      h += '<div class="ds-comment-card__box"><div class="ds-text-field"><label class="ds-text-field__label ds-visually-hidden" for="edit-' + t.id + '">Edit comment</label><textarea class="ds-text-field__input" id="edit-' + t.id + '" rows="3" data-edit-text>' + esc(t.text) + "</textarea></div>" +
        '<div class="ds-comment-card__buttons"><button class="ds-button ds-button--quiet" type="button" data-edit-cancel>Cancel</button><button class="ds-button ds-button--primary" type="button" data-edit-save="' + t.id + '">Save</button></div></div>';
    } else h += '<p class="ds-comment-card__text">' + esc(t.text) + "</p>";
    if (open) {
      h += reactionsRow(t);
      if (t.replies && t.replies.length) {
        h += '<ul class="ds-comment-card__replies">';
        t.replies.forEach(function (r) { h += '<li class="ds-comment-card__reply"><div class="ds-comment-card__head">' + avatar(r) + '<span class="ds-comment-card__name">' + esc(writer(r)) + '</span><span class="ds-comment-card__time" title="Today at ' + clockTime(r.at) + '">' + ago(r.at) + '</span></div><p class="ds-comment-card__text">' + esc(r.text) + "</p></li>"; });
        h += "</ul>";
      }
      h += '<div class="ds-comment-card__box"><div class="ds-text-field"><label class="ds-text-field__label ds-visually-hidden" for="reply-' + t.id + '">Reply</label><textarea class="ds-text-field__input" id="reply-' + t.id + '" rows="2" placeholder="Reply or add others with @" data-reply="' + t.id + '"></textarea></div>' +
        '<div class="ds-comment-card__buttons"><button class="ds-button ds-button--quiet" type="button" data-cancel-reply>Cancel</button><button class="ds-button ds-button--primary" type="button" aria-disabled="true" data-reply-send="' + t.id + '">Reply</button></div></div>';
    } else if (t.replies && t.replies.length) h += '<p class="ds-comment-card__count">' + t.replies.length + (t.replies.length === 1 ? " reply" : " replies") + "</p>";
    return h + "</article>";
  }
  function composingCard(c) {
    var text = c.text || "";
    var you = get("nameEditing", "") === "compose"
      ? '<div class="ds-comment-card__you ds-text-field">' + avatar() + '<label class="ds-text-field__label ds-visually-hidden" for="compose-name">Your name</label><input class="ds-text-field__input" id="compose-name" type="text" autocomplete="name" data-name-input value="' + esc(name()) + '"></div>'
      : '<div class="ds-comment-card__you">' + avatar() + "<span>You're " + esc(name()) + '</span><button class="ds-button ds-button--link" type="button" data-edit-name="compose">edit name</button></div>';
    return '<article class="ds-comment-card ds-comment-card--composing" aria-label="New comment" data-ref="new-comment" data-compose>' + you +
      '<div class="ds-comment-card__box"><div class="ds-text-field"><label class="ds-text-field__label ds-visually-hidden" for="new-comment-text">Comment</label><textarea class="ds-text-field__input" id="new-comment-text" rows="3" placeholder="Comment or add others with @" data-compose-text>' + esc(text) + "</textarea></div>" +
      '<div class="ds-comment-card__buttons"><button class="ds-button ds-button--quiet" type="button" data-cancel>Cancel</button><button class="ds-button ds-button--primary" type="button"' + (text.trim() ? "" : ' aria-disabled="true"') + " data-send>Comment</button></div></div></article>";
  }
  function barHtml(w) {
    return '<span class="ds-naming-bar__kind">' + w.getAttribute("data-kind") + '</span><span class="ds-naming-bar__words">' + esc(words(w)) + "</span>" +
      '<button class="ds-icon-button ds-icon-button--quiet" type="button" aria-label="Around it" title="Around it" data-bar-around><span class="ds-icon" data-icon="caret-up"></span></button>' +
      '<button class="ds-icon-button ds-icon-button--quiet" type="button" aria-label="Inside it" title="Inside it" disabled><span class="ds-icon" data-icon="caret-down"></span></button>' +
      '<button class="ds-icon-button ds-icon-button--quiet" type="button" aria-label="Pin" title="Pin" data-bar-pin><span class="ds-icon" data-icon="push-pin"></span></button>';
  }
  function injectWords(content, quote, html) {
    var s = content.getAttribute("data-original");
    var i = s.indexOf(quote);
    if (i < 0) return s;
    return s.slice(0, i) + html + s.slice(i + quote.length);
  }
  function about(t) {
    if (t.kind === "section") return "Section · " + (SECTIONS[t.block] || "The river");
    if (t.kind === "page") return "Page · Autumn at the footbridge";
    if (t.kind === "words") return '"' + t.quote + '"';
    if (t.kind === "pin") return DECK ? "Pin · top right" : "Pin · under The path";
    if (t.block === "gone") return "Content gone · was in The river";
    var w = blockEl(t.block);
    return (w ? w.getAttribute("data-kind") : "Block") + " · " + (w ? words(w) : t.block);
  }
  function listed() {
    var all = threads().filter(function (t) { return !t.resolved || get("showResolved", "") === "1"; });
    if (get("forYou", "") === "1") all = all.filter(function (t) { return (t.text + " " + (t.replies || []).map(function (r) { return r.text; }).join(" ")).indexOf("@" + name()) >= 0; });
    return all.sort(function (a, b) { return DECK ? (String(a.block).localeCompare(String(b.block)) || (a.kind === "pin" ? -1 : 1)) : ORDER.indexOf(a.block) - ORDER.indexOf(b.block); });
  }

  function renderColumn(col, html) {
    var cur = col.getAttribute("data-rendered") || "";
    var key = html.replace(/>[^<]*<\/textarea>/g, "></textarea>").replace(/ aria-disabled="true"( data-send)/, "$1").replace(/ aria-disabled="true"( data-reply-send)/, "$1");
    if (cur === key) return;
    var drafts = {};
    col.querySelectorAll("textarea, [data-name-input]").forEach(function (ta) { drafts[ta.id] = ta.value; });
    col.innerHTML = html;
    col.setAttribute("data-rendered", key);
    col.querySelectorAll("textarea, [data-name-input]").forEach(function (ta) { if (drafts[ta.id] !== undefined && !ta.value) ta.value = drafts[ta.id]; });
    col.querySelectorAll(".ds-comment-card").forEach(function (el) {
      var id2 = (el.getAttribute("data-thread") || "compose") + ":" + (col.getAttribute("data-column") || "panel");
      if (!shown[id2]) { arrive(el); shown[id2] = 1; }
    });
    col.querySelectorAll("[data-quick]").forEach(function (q) { if (!q.hasAttribute("data-shown")) { q.setAttribute("data-shown", ""); arrive(q); } });
  }

  function render() {
    var list = threads(), open = list.filter(function (t) { return !t.resolved; });
    var c = compose(), sel = selection(), on = mode(), hide = hidden(), inPanel = panelOpen();
    var openId = get("open", "");
    var n = open.length;
    var here = DECK ? open.filter(function (t) { return t.block === "slide-" + slide(); }).length : n;
    // the tag and the menu's words
    control.setAttribute("aria-pressed", on ? "true" : "false");
    var said = DECK ? here + " here · " + (n - here) + " on other slides. " : (n ? "Comments: " + n + " open. " : "No comments yet. ");
    control.setAttribute("aria-label", said + (on ? "Stop commenting" : "Start commenting") + " (" + shortcut() + ")");
    var mark = control.querySelector(".ds-comment-control__mark");
    if (DECK && n - here > 0 && !mark) { mark = doc.createElement("span"); mark.className = "ds-comment-control__mark"; control.appendChild(mark); }
    if (mark && !(DECK && n - here > 0)) mark.remove();
    if (DECK) {
      doc.querySelectorAll("[data-slide-row]").forEach(function (row) { var k = row.getAttribute("data-slide-row"); var cur = k === String(slide()); if (cur && row.hidden) { row.hidden = false; arrive(row.querySelector(".ds-slide")); } else if (!cur && !row.hidden) { var sl = row.querySelector(".ds-slide"); leave(sl, function () { row.hidden = true; }); } var col = doc.querySelector('[data-column="slide-' + k + '"]'); if (col) col.hidden = !cur; });
      doc.querySelector("[data-deck-count]").textContent = slide() + " / 3";
    }
    n = here;
    var count = control.querySelector(".ds-comment-control__count");
    if (n && !count) { count = doc.createElement("span"); count.className = "ds-comment-control__count"; control.appendChild(count); }
    if (count) { if (n) count.textContent = n > 9 ? "9+" : String(n); else count.remove(); }
    doc.querySelector("[data-count]").textContent = String(open.length);
    doc.querySelectorAll("[data-mode-label]").forEach(function (e) { e.textContent = on ? "On" : "Off"; });
    doc.querySelector('[data-menu="mode"]').setAttribute("aria-pressed", on ? "true" : "false");
    doc.querySelectorAll("[data-hide-label]").forEach(function (e) { e.textContent = hide ? "On" : "Off"; });
    doc.querySelectorAll('[data-menu="hide"]').forEach(function (e) { e.setAttribute("aria-pressed", hide ? "true" : "false"); });
    var theme = root.getAttribute("data-ds-theme");
    doc.querySelectorAll("[data-theme-label]").forEach(function (e) { e.textContent = theme === "light" ? "Light" : theme === "dark" ? "Dark" : "Automatic"; });
    doc.querySelectorAll("[data-name-text]").forEach(function (e) { e.textContent = name(); });
    doc.querySelectorAll("[data-initials]").forEach(function (e) { e.textContent = initials(); });
    doc.querySelectorAll("[data-shortcut]").forEach(function (e) { e.textContent = shortcut(); });
    doc.querySelectorAll(".ds-comment-control__reach").forEach(function (r) { r.textContent = shortcut(); });
    var key = doc.querySelector("[data-copy-key]");
    if (key) key.textContent = isMac() ? "⌘" : "Ctrl";
    // the name row in the menu
    var editingMenu = get("nameEditing", "") === "menu";
    doc.querySelector("[data-name-row]").hidden = editingMenu;
    doc.querySelector("[data-name-edit]").hidden = !editingMenu;
    var menuInput = doc.querySelector("[data-name-edit] [data-name-input]");
    if (editingMenu && !menuInput.hasAttribute("data-filled")) { menuInput.value = name(); menuInput.setAttribute("data-filled", ""); }
    if (!editingMenu) menuInput.removeAttribute("data-filled");
    // a paragraph the author cut (come-back-later): its row and column are gone
    doc.querySelectorAll('.ds-naming-bar[data-block="raise-the-deck"]').forEach(function (w) { var row = w.parentElement, col = columnOf("raise-the-deck"); var cut = get("cut", "") === "1"; if (row) row.hidden = cut; if (col) col.hidden = cut; });
    // the blocks: words, selection, outline and bar
    doc.querySelectorAll(".ds-naming-bar[data-block]").forEach(function (w) {
      var id = w.getAttribute("data-block"), content = contentOf(w), html = content.getAttribute("data-original");
      var wordsThread = open.filter(function (t) { return t.block === id && t.kind === "words"; })[0];
      if (wordsThread && !hide) html = injectWords(content, wordsThread.quote, '<button class="ds-highlight" type="button" aria-label="Comment by ' + esc(name()) + ": " + esc(wordsThread.text) + '" data-open-thread="' + wordsThread.id + '">' + esc(wordsThread.quote) + "</button>");
      else if (c && c.block === id && c.kind === "words") html = injectWords(content, c.quote, '<span class="ds-highlight">' + esc(c.quote) + "</span>");
      else if (sel && sel.block === id) html = injectWords(content, sel.quote, '<span class="ds-highlight ds-highlight--selection">' + esc(sel.quote) + "</span>") + ' <button class="ds-icon-button ds-icon-button--quiet" type="button" aria-label="Comment on the selected words" data-ref="selection-icon" data-selection-icon><span class="ds-icon" data-icon="chat-circle"></span></button>';
      if (content.innerHTML !== html) content.innerHTML = html;
      var picked = on && !sel && hoverBlock === id;
      var bar = w.querySelector(".ds-naming-bar__bar");
      content.classList.toggle("ds-naming-bar__target", picked);
      if (picked && bar.hidden) { bar.innerHTML = barHtml(w); bar.setAttribute("aria-label", w.getAttribute("data-kind") + " · " + words(w)); arrive(bar); }
      else if (!picked && !bar.hidden && !bar.hasAttribute("data-ds-leaving")) leave(bar);
    });
    // pins on slides: each on its slide's layer
    if (DECK) doc.querySelectorAll("[data-pins]").forEach(function (layer) {
      var sid = layer.getAttribute("data-pins");
      var html = "";
      if (!hide) open.filter(function (t) { return t.kind === "pin" && t.block === sid; }).forEach(function (t, i) { html += '<button class="ds-pin" type="button" aria-label="Comment by ' + esc(writer(t)) + ": " + esc(t.text) + '" aria-expanded="' + (openId === t.id ? "true" : "false") + '" data-open-thread="' + t.id + '"><span class="ds-pin__number">' + (i + 1) + "</span></button>"; });
      if (c && c.kind === "pin" && c.block === sid) html += '<button class="ds-pin" type="button" aria-label="New pin" aria-expanded="true"><span class="ds-icon" data-icon="push-pin"></span></button>';
      if ((layer.getAttribute("data-rendered") || "") !== html) { layer.innerHTML = html; layer.setAttribute("data-rendered", html); layer.querySelectorAll(".ds-pin").forEach(function (el) { arrive(el); }); }
    });
    // the pin row
    var pinThread = DECK ? null : open.filter(function (t) { return t.kind === "pin"; })[0];
    var pinComposing = c && c.kind === "pin";
    var spot = doc.querySelector('[data-ref="pin-spot"]');
    var wantPin = !hide && (pinThread || pinComposing);
    var pinCol = columnOf("pin-spot");
    if (!pinRow) { /* no pin row on this page */ }
    else if (wantPin) {
      pinRow.hidden = false; pinCol.hidden = false;
      var pin = spot.querySelector(".ds-pin");
      if (!pin) { spot.innerHTML = '<button class="ds-pin" type="button" data-pin></button>'; pin = spot.querySelector(".ds-pin"); arrive(pin); }
      var isOpen = pinComposing || (pinThread && openId === pinThread.id);
      pin.setAttribute("aria-expanded", isOpen ? "true" : "false");
      pin.setAttribute("aria-label", pinThread ? "Comment by " + name() + ": " + pinThread.text : "New pin");
      var number = pinThread ? String(open.indexOf(pinThread) + 1) : "";
      var want = number ? '<span class="ds-pin__number">' + number + "</span>" : '<span class="ds-icon" data-icon="push-pin"></span>';
      if (pin.innerHTML !== want) pin.innerHTML = want;
    } else if (!pinRow.hidden) {
      var p = spot.querySelector(".ds-pin");
      leave(p, function () { spot.innerHTML = ""; pinRow.hidden = true; pinCol.hidden = true; });
    }
    // the columns beside the page
    var blockedText = get("blockedText", "");
    doc.querySelectorAll("[data-column]").forEach(function (col) {
      var id = col.getAttribute("data-column");
      var html = "";
      if (id === "kicker" && get("handoff", "") === "1" && PAGE === "author") html = promptCard(open);
      else if (id === "river-rose" && blockedText && !blockedMessage.hidden) html = '<div class="ds-code-block ds-code-block--compact" data-ds="code-block" data-ref="markdown-text"><div class="ds-code-block__header"><span class="ds-code-block__title">Your comments as Markdown, selected</span></div><pre class="ds-code-block__code"><code>' + esc(blockedText) + "</code></pre></div>";
      else {
        if (c && c.block === id && !inPanel) html += composingCard(c);
        if (!hide) open.filter(function (t) { return t.block === id; }).forEach(function (t) { html += card(t, openId === t.id && !inPanel); });
      }
      renderColumn(col, html);
    });
    // All comments
    body.className = inPanel ? "ds-split ds-split--end" : "ds-stack ds-stack--fill";
    doc.querySelector("[data-footer-mode]").setAttribute("aria-checked", on ? "true" : "false");
    doc.querySelectorAll("[data-filter]").forEach(function (f) { f.setAttribute("aria-pressed", get(f.getAttribute("data-filter"), "") === "1" ? "true" : "false"); });
    if (inPanel) {
      if (side.hidden) arrive(side);
      if (!controlRow.hidden) leave(controlRow);
      var items = listed();
      var listEl = side.querySelector('[data-ref="panel-list"]'), empty = side.querySelector('[data-ref="panel-empty"]');
      var html = "";
      if (c && inPanel) html += "<li>" + '<p class="ds-comments-panel__about">' + esc(about(c)) + "</p>" + composingCard(c) + "</li>";
      var lastSlide = "";
      items.forEach(function (t) {
        if (DECK && t.block !== lastSlide) { lastSlide = t.block; var sn = parseInt(String(t.block).replace("slide-", ""), 10); var cnt = items.filter(function (x) { return x.block === t.block && !x.resolved; }).length; html += '<li class="ds-comments-panel__group"' + (sn === slide() ? ' aria-current="true"' : "") + ' data-group="' + sn + '">Slide ' + sn + " · " + cnt + " open</li>"; }
        html += '<li data-panel-thread="' + t.id + '"><p class="ds-comments-panel__about">' + esc(about(t)) + "</p>" + card(t, openId === t.id) + "</li>";
      });
      var emptyText = !threads().length ? "No comments yet" : get("forYou", "") === "1" && !items.length ? "No comments mention you" : get("showResolved", "") === "1" && !items.length ? "No resolved comments" : "";
      if (emptyText && !html) { listEl.hidden = true; empty.textContent = emptyText; if (empty.hidden) arrive(empty); }
      else { if (!empty.hidden) empty.hidden = true; listEl.hidden = false; renderColumn(listEl, html); }
    } else {
      if (!side.hidden && !side.hasAttribute("data-ds-leaving")) leave(side);
      if (controlRow.hidden) arrive(controlRow);
    }
    // focus the design names
    if (get("focusCompose", "") === "1") {
      var ta = doc.querySelector("[data-compose-text]");
      if (ta && doc.activeElement !== ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
      set("focusCompose", "");
    }
    if (get("focusReply", "") === "1") {
      var ra = doc.querySelector("[data-reply]");
      if (ra && !("ontouchstart" in window)) ra.focus();
      set("focusReply", "");
    }
    if (get("focusName", "") === "1") {
      var ni = doc.querySelector("[data-name-input]");
      if (ni) { ni.focus(); ni.setSelectionRange(ni.value.length, ni.value.length); }
      set("focusName", "");
    }
  }

  // ---- messages beside the tag

  function message(el, text, fadeAfter) {
    clearTimeout(messageTimer);
    [copiedMessage, blockedMessage, discardedMessage].forEach(function (m) { if (m !== el && !m.hidden) leave(m); });
    if (el !== discardedMessage && !undoButton.hidden) leave(undoButton);
    if (text) { var t = el.querySelector("[data-message], [data-discarded-text]"); if (t) t.textContent = text; }
    if (el.hidden) arrive(el);
    if (fadeAfter) messageTimer = setTimeout(function () { leave(el); }, fadeAfter);
  }

  // ---- the Markdown and the text

  function where(t) {
    if (DECK) { var sn = parseInt(String(t.block).replace("slide-", ""), 10) || 1; var sw = "Slide " + sn + " › " + SLIDES[sn - 1]; return t.kind === "words" ? sw + " › \"" + t.quote + "\"" : sw + " › Pin"; }
    var section = SECTIONS[t.block] || "Autumn at the footbridge";
    if (t.block === "gone") return "The river › Content gone (was a paragraph)";
    if (t.kind === "section") return section + " › Section";
    if (t.kind === "page") return "Page";
    if (t.kind === "words") return section + " › Paragraph › \"" + t.quote + "\"";
    if (t.kind === "pin") return section + " › Pin under the heading";
    var w = blockEl(t.block);
    return section + " › " + (w ? w.getAttribute("data-kind") : "Block") + " \"" + (w ? words(w) : t.block) + "…\"";
  }
  function threadLines(t) {
    var out = ["## " + where(t), "- " + writer(t) + ", " + clockTime(t.at) + ": " + t.text];
    (t.replies || []).forEach(function (r) { out.push("  - " + writer(r) + ", " + clockTime(r.at) + ": " + r.text); });
    return out;
  }
  function markdown(list) {
    var out = ["# Comments on Autumn at the footbridge", list.length + " open thread" + (list.length === 1 ? "" : "s") + " · exported today at " + clockTime(CLOCK) + " (resolved threads left out)"];
    list.forEach(function (t) { out.push(""); out = out.concat(threadLines(t)); });
    out.push("", "Work through each thread and say what changed.");
    return out.join("\n");
  }
  function plain(list) {
    var out = [];
    list.forEach(function (t) { out.push(where(t), writer(t) + ": " + t.text); (t.replies || []).forEach(function (r) { out.push(writer(r) + ": " + r.text); }); out.push(""); });
    return out.join("\n").trim();
  }
  function closeMenu() { if (panel && !panel.hidden) control.click(); }
  function promptCard(open) {
    var text = "Work through each thread below and say what changed.\n\n" + markdown(open);
    return '<section class="ds-prompt-card ds-prompt-card--ring" aria-label="Prompt: Ask your agent" data-ds="prompt-card" data-ref="agent-prompt"><div class="ds-prompt-card__header"><div class="ds-prompt-card__heading ds-visually-hidden"><h2 class="ds-prompt-card__title">Ask your agent</h2><p class="ds-prompt-card__meta">For any coding agent · ' + open.length + ' threads</p></div><div class="ds-prompt-card__actions"><button class="ds-button ds-button--secondary ds-button--join-start ds-button--ringed" type="button" data-ds-copy data-prompt-copy><span class="ds-icon ds-button__copy-icon" data-icon="copy"></span><span class="ds-icon ds-button__done-icon" data-icon="check"></span><span class="ds-button__label"><span data-ds-copy-label>Copy prompt</span><span class="ds-button__sizer" aria-hidden="true">Press Ctrl+C</span><span class="ds-button__sizer" aria-hidden="true">Copy prompt</span></span></button><div class="ds-popover-menu ds-popover-menu--split" data-ds="popover-menu"><button class="ds-button ds-button--secondary ds-button--join-end ds-button--ringed ds-popover-menu__trigger" type="button" aria-expanded="false"><span class="ds-icon" data-icon="chevron-down"></span><span class="ds-visually-hidden">More ways to take this prompt</span></button><div class="ds-popover-menu__panel" hidden><ul class="ds-popover-menu__items" aria-label="More ways to take this prompt"><li><button class="ds-button ds-button--quiet ds-popover-menu__item" type="button" data-ds-prompt-view>View prompt</button></li><li><button class="ds-button ds-button--quiet ds-popover-menu__item" type="button" data-ds-prompt-save><span data-ds-prompt-save-label>Save as Markdown</span></button></li></ul></div></div></div></div><div class="ds-prompt-card__text"><div class="ds-code-block ds-code-block--flush ds-code-block--compact" data-ds="code-block"><pre class="ds-code-block__code"><code>' + esc(text) + "</code></pre></div></div></section>";
  }

  function copyAll(kind) {
    var open = threads().filter(function (t) { return !t.resolved; });
    var text = kind === "markdown" ? markdown(open) : plain(open);
    var labels = doc.querySelectorAll('[data-menu="' + kind + '"] [data-label]');
    if (!open.length) { closeMenu(); message(copiedMessage, "No open comments to copy.", 4000); return; }
    function ok() {
      labels.forEach(function (label) { var original = label.textContent; label.textContent = "Copied"; setTimeout(function () { label.textContent = original; }, 1500); });
      closeMenu();
      message(copiedMessage, "Copied " + open.length + " comment" + (open.length === 1 ? "" : "s") + " as " + (kind === "markdown" ? "Markdown" : "text") + ".", 4000);
      if (PAGE === "author" && kind === "markdown") { set("handoff", "1"); render(); }
    }
    function blocked() {
      closeMenu();
      message(blockedMessage, "", 0);
      set("blockedText", text);
      var code = columnOf("river-rose").querySelector("code");
      try { var r = doc.createRange(); r.selectNodeContents(code); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) { /* no selection */ }
      doc.addEventListener("copy", function once() { doc.removeEventListener("copy", once); setTimeout(function () { leave(blockedMessage, function () { set("blockedText", ""); render(); message(copiedMessage, "Copied " + open.length + " comment" + (open.length === 1 ? "" : "s") + " as Markdown.", 4000); }); }, 0); });
    }
    if (get("clipboardBlocked", "") === "1" || !navigator.clipboard || !navigator.clipboard.writeText) { blocked(); return; }
    navigator.clipboard.writeText(text).then(ok, blocked);
  }
  function copyThread(id) {
    var t = thread(id); if (!t) return;
    var text = threadLines(t).join("\n");
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () {}, function () {});
  }

  // ---- comment mode, composing, threads

  function setMode(on) {
    set("mode", on ? "1" : "");
    if (!on) { hoverBlock = ""; set("selection", ""); }
    render();
  }
  function startCompose(c) {
    var cur = compose();
    if (cur && cur.text && cur.text.trim() && c.kind !== "pin" && c.kind !== "section" && c.kind !== "page") return; // typed words are never lost
    c.text = cur ? cur.text : "";
    set("compose", JSON.stringify(c)); set("selection", ""); set("open", ""); set("focusCompose", "1");
    delete shown["compose:" + c.block]; delete shown["compose:panel"];
    render();
  }
  function discard(kind) {
    var c = compose(), ta = doc.querySelector("[data-compose-text]");
    if (ta && c) c.text = ta.value;
    var el = doc.querySelector("[data-compose]");
    leave(el, function () {
      set("compose", ""); Object.keys(shown).forEach(function (k) { if (k.indexOf("compose:") === 0) delete shown[k]; });
      render();
      if (c && c.text && c.text.trim()) {
        set("undo", JSON.stringify(c));
        message(discardedMessage, kind === "reply" ? "Reply discarded." : "Comment discarded.", 0);
        arrive(undoButton);
        clearTimeout(undoTimer);
        undoTimer = setTimeout(function () { leave(discardedMessage); leave(undoButton); set("undo", ""); }, 6000);
      }
    });
  }
  function undo() {
    var c = json("undo", "null"); if (!c) return;
    clearTimeout(undoTimer);
    leave(discardedMessage); leave(undoButton);
    set("undo", "");
    set("compose", JSON.stringify(c)); set("open", ""); set("focusCompose", "1");
    Object.keys(shown).forEach(function (k) { if (k.indexOf("compose:") === 0) delete shown[k]; });
    render();
  }
  function send() {
    var c = compose(), ta = doc.querySelector("[data-compose-text]");
    if (!c || !ta || !ta.value.trim()) return;
    var list = threads();
    var t = { id: "t" + (Date.now() % 100000) + list.length, block: c.block, kind: c.kind, quote: c.quote || "", text: ta.value.trim(), at: CLOCK, replies: [], reactions: {} };
    list.push(t);
    saveThreads(list);
    Object.keys(shown).forEach(function (k) { if (k.indexOf("compose:") === 0) delete shown[k]; });
    set("compose", ""); set("open", t.id); set("focusReply", "1");
    render();
  }
  function openThread(id) {
    var th = thread(id);
    if (DECK && th && th.block !== "slide-" + slide()) set("slide", String(th.block).replace("slide-", ""));
    set("open", id); set("react", ""); set("edit", ""); set("focusReply", "1"); render();
    var t = thread(id), w = t && blockEl(t.block === "pin-spot" ? "path-heading" : t.block);
    if (panelOpen() && w && w.scrollIntoView) w.scrollIntoView({ block: "center" });
  }
  function closeThread() {
    var id = get("open", "");
    set("open", ""); set("react", ""); set("edit", ""); render();
    var el = doc.querySelector('[data-thread="' + id + '"] [data-open]') || doc.querySelector('[data-open-thread="' + id + '"]') || doc.querySelector("[data-pin]");
    if (el) el.focus();
  }
  function resolve(id, reopen) {
    var el = doc.querySelector('[data-thread="' + id + '"]');
    var stays = reopen || get("showResolved", "") === "1";
    var done = function () { updateThread(id, function (t) { t.resolved = !reopen; }); if (get("open", "") === id && !stays) set("open", ""); Object.keys(shown).forEach(function (k) { if (k.indexOf(id + ":") === 0) delete shown[k]; }); render(); message(copiedMessage, reopen ? "Reopened." : "Resolved.", 3000); };
    if (stays) done(); else leave(el, done);
  }
  function sendReply(id) {
    var ta = doc.querySelector('[data-reply="' + id + '"]');
    if (!ta || !ta.value.trim()) return;
    var text = ta.value.trim();
    updateThread(id, function (t) { t.replies = (t.replies || []).concat([{ text: text, at: CLOCK }]); });
    set("focusReply", "1");
    render();
    var r = doc.querySelector('[data-reply="' + id + '"]'); if (r) r.value = "";
    var b = doc.querySelector('[data-reply-send="' + id + '"]'); if (b) b.setAttribute("aria-disabled", "true");
    var last = doc.querySelector('[data-thread="' + id + '"] .ds-comment-card__reply:last-child'); if (last) arrive(last);
  }
  function react(id, emoji) {
    updateThread(id, function (t) { t.reactions = t.reactions || {}; t.reactions[emoji] = (t.reactions[emoji] || 0) + 1; });
    var q = doc.querySelector("[data-quick]");
    leave(q, function () { set("react", ""); render(); });
  }
  function deleteThread(id) {
    var el = doc.querySelector('[data-thread="' + id + '"]');
    leave(el, function () { saveThreads(threads().filter(function (t) { return t.id !== id; })); if (get("open", "") === id) set("open", ""); render(); });
  }
  function editName(where) { set("nameEditing", where); set("focusName", "1"); render(); }
  function saveName(input, keep) {
    var v = keep ? input.value.trim() : name();
    if (keep) set("name", v || DEFAULT_NAME);
    set("nameEditing", ""); render();
    var row = doc.querySelector('[data-menu="name"]'); if (row && !row.closest("li").hidden && keep !== null) row.focus();
  }

  // ---- what the pointer does

  report.addEventListener("mousemove", function (e) {
    if (!mode()) return;
    var w = e.target.closest ? e.target.closest(".ds-naming-bar[data-block]") : null;
    if (e.target.closest(".ds-naming-bar__bar")) return;
    var id = w ? w.getAttribute("data-block") : "";
    if (id !== hoverBlock) { hoverBlock = id; render(); }
  });
  report.addEventListener("mouseleave", function () { if (hoverBlock) { hoverBlock = ""; render(); } });

  doc.addEventListener("mouseup", function () {
    if (!mode()) return;
    var s = window.getSelection();
    if (!s || s.isCollapsed) return;
    var text = s.toString().trim();
    var node = s.anchorNode && s.anchorNode.nodeType === 3 ? s.anchorNode.parentElement : s.anchorNode;
    var w = node && node.closest ? node.closest(".ds-naming-bar[data-block]") : null;
    if (!w || !text || contentOf(w).getAttribute("data-original").indexOf(text) < 0) return;
    s.removeAllRanges();
    set("selection", JSON.stringify({ block: w.getAttribute("data-block"), quote: text }));
    hoverBlock = "";
    render();
  });

  doc.addEventListener("click", function (e) {
    var t = e.target;
    if (t.closest("[data-gap]")) return; // the runtime says it is not designed
    var h;
    if (t.closest('[data-ref="comment-control"]')) { // the copy choices are folded each time the menu opens
      doc.querySelectorAll("[data-copy-choice]").forEach(function (li) { li.hidden = true; });
      doc.querySelector('[data-menu="copy"]').setAttribute("aria-expanded", "false");
      if (get("nameEditing", "") === "menu") set("nameEditing", "");
      return;
    }
    if (t.closest("[data-undo]")) { undo(); return; }
    if ((h = t.closest("[data-selection-icon]"))) { var sel = selection(); if (sel) startCompose({ block: sel.block, kind: "words", quote: sel.quote }); return; }
    if ((h = t.closest("[data-open-thread]"))) { openThread(h.getAttribute("data-open-thread")); return; }
    if (t.closest("[data-pin]")) { var pt = threads().filter(function (x) { return x.kind === "pin" && !x.resolved; })[0]; if (pt) openThread(pt.id); return; }
    if (t.closest("[data-bar-pin]")) { startCompose({ block: DECK ? (hoverBlock || "slide-" + slide()) : "pin-spot", kind: "pin" }); return; }
    if (t.closest("[data-bar-around]")) {
      var cur = compose(), from = (cur && cur.block) || hoverBlock || "raise-the-deck", kindNow = cur ? cur.kind : "block";
      if (kindNow === "section" || from === "kicker" || from === "title" || from === "lede") startCompose({ block: "title", kind: "page" });
      else startCompose({ block: SECTIONS[from] === "The path" ? "path-heading" : "river-heading", kind: "section" });
      return;
    }
    if ((h = t.closest("[data-resolve]"))) { resolve(h.getAttribute("data-resolve"), false); return; }
    if ((h = t.closest("[data-reopen]"))) { resolve(h.getAttribute("data-reopen"), true); return; }
    if ((h = t.closest("[data-react]"))) { var rid = h.getAttribute("data-react"); if (get("react", "") === rid) { var q = doc.querySelector("[data-quick]"); leave(q, function () { set("react", ""); render(); }); } else { set("react", rid); render(); } return; }
    if ((h = t.closest("[data-emoji]")) && h.closest("[data-quick]")) { react(h.getAttribute("data-thread-id"), h.getAttribute("data-emoji")); return; }
    if ((h = t.closest("[data-more]"))) {
      var kind = h.getAttribute("data-more"), tid = h.getAttribute("data-thread-id");
      if (kind === "copy") { copyThread(tid); }
      else if (kind === "edit") { set("edit", tid); render(); var et = doc.querySelector("[data-edit-text]"); if (et) { et.focus(); et.setSelectionRange(et.value.length, et.value.length); } }
      else if (kind === "delete") { deleting = tid; dialog.setAttribute("data-for", tid); var th = thread(tid); var meta = doc.querySelector("[data-delete-meta]"); var n = th && th.replies ? th.replies.length : 0; meta.textContent = n ? "Its " + n + (n === 1 ? " reply goes" : " replies go") + " with it." : "It has no replies."; }
      return;
    }
    if (t.closest("[data-ds-dialog-close]") && dialog.open) { focusMoreAfterDialog(); return; }
    if (t.closest("[data-delete-confirm]")) { var did = deleting; deleting = ""; var cb = dialog.querySelector("[data-ds-dialog-close]"); if (cb) cb.click(); deleteThread(did); return; }
    if (t.closest("[data-edit-cancel]")) { set("edit", ""); render(); return; }
    if ((h = t.closest("[data-edit-save]"))) { var ev = doc.querySelector("[data-edit-text]"); if (ev && ev.value.trim()) updateThread(h.getAttribute("data-edit-save"), function (x) { x.text = ev.value.trim(); x.edited = true; }); set("edit", ""); render(); return; }
    if ((h = t.closest("[data-reply-send]"))) { sendReply(h.getAttribute("data-reply-send")); return; }
    if (t.closest("[data-open]")) { openThread(t.closest("[data-thread]").getAttribute("data-thread")); return; }
    if (t.closest("[data-cancel]")) { discard("comment"); return; }
    if (t.closest("[data-send]")) { send(); return; }
    if (t.closest("[data-cancel-reply]")) { var rt = doc.querySelector("[data-reply]"); if (rt && rt.value.trim()) { rt.value = ""; message(discardedMessage, "Reply discarded.", 4000); } else closeThread(); return; }
    if ((h = t.closest("[data-edit-name]"))) { editName(h.getAttribute("data-edit-name")); return; }
    if ((h = t.closest("[data-filter]"))) { var f = h.getAttribute("data-filter"); set(f, get(f, "") === "1" ? "" : "1"); render(); return; }
    if (t.closest("[data-panel-close]")) { closePanel(); return; }
    if (t.closest("[data-deck-next]")) { turn(1); return; }
    if (t.closest("[data-deck-prev]")) { turn(-1); return; }
    if (t.closest("[data-footer-mode]")) { setMode(!mode()); return; }
    if ((h = t.closest("[data-menu]"))) {
      var m = h.getAttribute("data-menu");
      if (m === "copy") {
        var wasOpen = h.getAttribute("aria-expanded") === "true";
        h.setAttribute("aria-expanded", wasOpen ? "false" : "true");
        doc.querySelectorAll("[data-copy-choice]").forEach(function (li) { li.hidden = wasOpen; }); // instant: the choices unfold inside the open panel, which has already settled
      } else if (m === "markdown" || m === "text") copyAll(m);
      else if (m === "theme") { var cur = root.getAttribute("data-ds-theme"); if (!cur) root.setAttribute("data-ds-theme", "light"); else if (cur === "light") root.setAttribute("data-ds-theme", "dark"); else root.removeAttribute("data-ds-theme"); render(); }
      else if (m === "hide") { var h2 = !hidden(); if (h2) { doc.querySelectorAll(".ds-comment-card, .ds-pin").forEach(function (el) { el.setAttribute("data-ds-leaving", ""); }); setTimeout(function () { set("hide", "1"); render(); }, settle()); } else { set("hide", ""); render(); } }
      else if (m === "mode") setMode(!mode());
      else if (m === "all") { closeMenu(); openPanel(); }
      else if (m === "name") editName("menu");
      return;
    }
    if (t.closest(".ds-popover-menu") || t.closest(".ds-comment-card") || t.closest(".ds-naming-bar__bar") || t.closest(".ds-inline-alert") || t.closest(".ds-comments-panel") || t.closest(".ds-dialog")) return;
    // the page itself
    if (mode()) {
      var w = t.closest(".ds-naming-bar[data-block]");
      if (selection()) { set("selection", ""); render(); if (!w) return; }
      if (w) {
        e.preventDefault();
        if (e.altKey) startCompose({ block: DECK ? w.getAttribute("data-block") : "pin-spot", kind: "pin" });
        else startCompose({ block: w.getAttribute("data-block"), kind: "block" });
        return;
      }
      var c = compose(), ct = doc.querySelector("[data-compose-text]");
      if (c && !(ct && ct.value.trim())) { discard("comment"); return; }
    }
    if (get("open", "") && !panelOpen()) closeThread();
  }, true);

  function turn(d) {
    var n = Math.min(3, Math.max(1, slide() + d));
    if (n === slide()) return;
    set("slide", String(n)); set("open", ""); hoverBlock = ""; render();
  }
  function focusMoreAfterDialog() {
    // the second question answered: focus goes back to the thread's More, whatever was decided
    var id = deleting || dialog.getAttribute("data-for") || "";
    setTimeout(function () { var more = doc.querySelector('[data-thread="' + id + '"] button[aria-label="More"]'); if (more) more.focus(); }, settle() + 50); // after the dialog's own script has restored focus
  }
  function openPanel() {
    set("panel", "1"); set("forYou", ""); set("showResolved", ""); Object.keys(shown).forEach(function (k) { if (k.indexOf(":panel") > 0) delete shown[k]; });
    render();
  }
  function closePanel() {
    set("panel", ""); set("react", ""); set("edit", ""); render();
    control.focus();
  }

  doc.addEventListener("input", function (e) {
    var ta = e.target.closest ? e.target.closest("[data-compose-text]") : null;
    if (ta) {
      var c = compose(); if (c) { c.text = ta.value; set("compose", JSON.stringify(c)); }
      var b = doc.querySelector("[data-send]");
      if (b) { if (ta.value.trim()) b.removeAttribute("aria-disabled"); else b.setAttribute("aria-disabled", "true"); }
      return;
    }
    var ra = e.target.closest ? e.target.closest("[data-reply]") : null;
    if (ra) { var rb = doc.querySelector('[data-reply-send="' + ra.getAttribute("data-reply") + '"]'); if (rb) { if (ra.value.trim()) rb.removeAttribute("aria-disabled"); else rb.setAttribute("aria-disabled", "true"); } }
  });

  doc.addEventListener("focusout", function (e) {
    var ni = e.target.closest ? e.target.closest("[data-name-input]") : null;
    if (ni && get("nameEditing", "")) setTimeout(function () { if (get("nameEditing", "") && doc.activeElement !== ni) saveName(ni, true); }, 0);
  });

  doc.addEventListener("keydown", function (e) {
    var inField = e.target.closest && e.target.closest("input, textarea");
    if (e.code === "KeyC" && e.shiftKey && e.altKey && !e.metaKey && !e.ctrlKey && !e.repeat) { e.preventDefault(); setMode(!mode()); return; }
    if (DECK && !inField && (e.key === "ArrowRight" || e.key === "ArrowLeft")) { turn(e.key === "ArrowRight" ? 1 : -1); return; }
    if (e.key === "z" && (e.metaKey || e.ctrlKey) && !(inField && e.target.value) && json("undo", "null")) { e.preventDefault(); undo(); return; }
    if (e.key === "Enter" && e.target.closest && e.target.closest("[data-name-input]")) { e.preventDefault(); e.stopPropagation(); saveName(e.target, true); return; }
    if (e.key === "Enter" && !e.shiftKey && e.target.closest && e.target.closest("[data-compose-text]")) { e.preventDefault(); send(); return; }
    if (e.key === "Enter" && !e.shiftKey && e.target.closest && e.target.closest("[data-reply]")) { e.preventDefault(); sendReply(e.target.getAttribute("data-reply")); return; }
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("[data-open]")) { e.preventDefault(); openThread(e.target.closest("[data-thread]").getAttribute("data-thread")); return; }
    if (e.key === "Escape") {
      if (e.target.closest && e.target.closest("[data-name-input]")) { e.preventDefault(); e.stopPropagation(); saveName(e.target, false); return; }
      if (doc.querySelector('.ds-popover-menu__panel:not([hidden])')) return; // the menu's own script closes it
      if (dialog.open) { focusMoreAfterDialog(); return; } // the dialog's own script closes it
      if (get("edit", "")) { set("edit", ""); render(); return; }
      if (get("react", "")) { var q = doc.querySelector("[data-quick]"); leave(q, function () { set("react", ""); render(); }); return; }
      if (e.target.closest && e.target.closest("[data-compose-text]")) { discard("comment"); return; }
      if (compose()) { discard("comment"); return; }
      if (get("open", "")) { closeThread(); return; }
      if (panelOpen()) { closePanel(); return; }
      if (selection()) { set("selection", ""); render(); return; }
      if (!blockedMessage.hidden) { leave(blockedMessage, function () { set("blockedText", ""); render(); }); return; }
      if (mode()) setMode(false);
    }
  }, true);

  // ---- the steps as views of this page

  function seed(n) { return SEED.slice(0, n).map(function (t) { var c = JSON.parse(JSON.stringify(t)); c.replies = []; c.reactions = {}; return c; }); }
  var batching = false;
  function view(name) {
    batching = true;
    var all = { threads: "[]", compose: "", open: "", selection: "", mode: "", hide: "", clipboardBlocked: "", blockedText: "", panel: "", forYou: "", showResolved: "", react: "", edit: "", undo: "", nameEditing: "", slide: "1", handoff: "", cut: "" };
    Object.keys(all).forEach(function (k) { set(k, all[k]); });
    hoverBlock = ""; shown = {};
    var after = null;
    switch (name) {
      case "pick-a-block": set("mode", "1"); hoverBlock = "raise-the-deck"; break;
      case "write-comment": set("mode", "1"); set("compose", JSON.stringify({ block: "raise-the-deck", kind: "block", text: "" })); set("focusCompose", "1"); break;
      case "read-thread": saveThreads(seed(1)); set("open", "t1"); set("focusReply", "1"); break;
      case "answer-a-thread": saveThreads(seed(1)); set("open", "t1"); after = function () { var ta = doc.querySelector('[data-reply="t1"]'); if (ta) { ta.value = REPLY_SAMPLE; ta.dispatchEvent(new Event("input", { bubbles: true })); } var more = doc.querySelector('[data-thread="t1"] .ds-popover-menu__trigger'); if (more) more.click(); }; break;
      case "select-words": saveThreads(seed(1)); set("mode", "1"); set("selection", JSON.stringify({ block: "river-rose", quote: "rose twice that week" })); break;
      case "drop-a-pin": saveThreads(seed(2)); set("mode", "1"); set("compose", JSON.stringify({ block: "pin-spot", kind: "pin", text: "" })); set("focusCompose", "1"); break;
      case "all-comments": saveThreads(seed(3)); set("panel", "1"); set("open", "t1"); break;
      case "delete-a-thread": saveThreads(seed(1)); set("open", "t1"); after = function () { var more = doc.querySelector('[data-thread="t1"] .ds-popover-menu__trigger'); if (more) more.click(); var del = doc.querySelector('[data-more="delete"]'); if (del) del.click(); }; break;
      case "resolve-a-thread": saveThreads(seed(3)); break;
      case "show-resolved": var sr = seed(3); sr[0].resolved = true; saveThreads(sr); set("panel", "1"); set("showResolved", "1"); break;
      case "add-your-name": saveThreads(seed(3)); set("nameEditing", "menu"); set("focusName", "1"); after = function () { if (panel.hidden) control.click(); set("nameEditing", "menu"); set("focusName", "1"); render(); }; break;
      case "copy-for-ai": saveThreads(seed(3)); after = function () { if (panel.hidden) control.click(); doc.querySelector('[data-menu="copy"]').click(); }; break;
      case "clipboard-blocked": saveThreads(seed(3)); set("clipboardBlocked", "1"); after = function () { copyAll("markdown"); }; break;
      case "undo-a-cancel": set("mode", "1"); hoverBlock = "raise-the-deck"; set("undo", JSON.stringify({ block: "raise-the-deck", kind: "block", text: "Two days is optimistic." })); after = function () { message(discardedMessage, "Comment discarded.", 0); arrive(undoButton); clearTimeout(undoTimer); undoTimer = setTimeout(function () { leave(discardedMessage); leave(undoButton); set("undo", ""); }, 6000); }; break;
      case "open-on-phone": break;
      case "tap-to-comment": set("mode", "1"); hoverBlock = "raise-the-deck"; break;
      case "all-comments-on-phone": saveThreads(seed(3)); set("panel", "1"); set("open", "t1"); break;
      case "reopen-page": saveThreads(seed(3)); break;
      case "hide-comments": saveThreads(seed(3)); set("hide", "1"); break;
      case "content-gone": var gs = seed(3); gs[0].block = "gone"; saveThreads(gs); set("cut", "1"); set("panel", "1"); break;
      case "open-deck": break;
      case "pin-on-a-slide": set("slide", "2"); set("mode", "1"); hoverBlock = "slide-2"; break;
      case "turn-the-slide": saveThreads(JSON.parse(JSON.stringify(DECK_SEED.slice(0, 2)))); set("slide", "3"); set("mode", "1"); break;
      case "comments-by-slide": saveThreads(JSON.parse(JSON.stringify(DECK_SEED))); set("slide", "2"); set("panel", "1"); set("open", "d2"); break;
      case "see-everyones-comments": saveThreads(JSON.parse(JSON.stringify(AUTHOR_SEED))); set("open", "a3"); break;
      case "hand-to-agent": saveThreads(JSON.parse(JSON.stringify(AUTHOR_SEED))); after = function () { if (panel.hidden) control.click(); doc.querySelector('[data-menu="copy"]').click(); }; break;
      default: break;
    }
    batching = false;
    render();
    if (after) setTimeout(after, 0); // once every script (the menu's and the dialog's own) has attached
  }
  function current() { return (location.hash || "").replace(/^#/, "").split(";")[0]; }

  function start() {
    var v = current();
    if (v) view(v); else render();
  }
  P.on("change", function () { if (batching) return; try { render(); } catch (e) { if (window.console) console.error(e); } });
  window.addEventListener("hashchange", function () { var v = current(); if (v) view(v); });
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})();
