// The Add-ons page and each add-on's own page: Copy buttons and menus, and the looping demos. Spec: docs/WEBSITE_SPEC.md.
const CDN = "https://cdn.jsdelivr.net/npm/";
const ADDONS_VERSION = "0.8.1"; // tools/set-version.sh keeps this in step with the release
// The integrity hashes of the published files, put here when the site is built (from the files on the CDN).
const SRI = { share: "{{SRI:share}}", voice: "{{SRI:voice}}", live: "{{SRI:live}}", assist: "{{SRI:assist}}", agents: "{{SRI:agents}}", emoji: "{{SRI:emoji}}", github: "{{SRI:github}}", updates: "{{SRI:updates}}", inbox: "{{SRI:inbox}}", identity: "{{SRI:identity}}" };
const tag = (pkg, file) => {
  const sri = SRI[pkg.split("/")[1]];
  return `<script src="${CDN}${pkg}@${ADDONS_VERSION}/dist/${file}"${sri.startsWith("sha384-") ? ` integrity="${sri}" crossorigin="anonymous"` : ""}><\/script>`;
};
// What an agent also does for a safer page (best effort): list the add-on, and tell the author about a policy.
const SAFE = (id, connect) => [
  `Also add data-pipeup-addons="${id}" to the <html> element, so only the add-ons I chose can run. If the attribute is already there, add ${id} to its comma-separated list and keep what is there.`,
  `Then tell me, in your reply, about a Content-Security-Policy I could add: scripts only from this page and https://cdn.jsdelivr.net, and connections ${connect}. Don't add the policy yourself, because a strict one can break a page; I will decide. This is a best-effort safeguard, not a guarantee.`,
];
const TEMPLATE = "git clone --depth 1 https://github.com/pipeup-ai/pipeup pipeup-src && cp -R pipeup-src/libs/ts/addons/template my-addon && rm -rf pipeup-src";
const OPEN = "Edit only the HTML file: this is a text change, so there is nothing to download, run or look up. If my page already has data-pipeup-doc on the <html> element, leave it exactly as it is.";
const SHARE_DEMO = "git clone https://github.com/pipeup-ai/pipeup && cd pipeup/libs/ts/pipeup && npm ci && npm run build && cd ../addons && npm ci && npm run demo";
const MAILBOX = 'CREATE_TOKEN="$(openssl rand -base64 24)" DATA_DIR=./pipeup-mailbox npx @pipeup/mailbox';
const SKILL = "https://pipeup-ai.github.io/pipeup/skills/pipeup-send-to-git-setup/SKILL.md";
const prompts = {
  sgh: () => [
    "I want to add Pipeup's Save to GitHub example to my HTML page, so reviewers can save a review as a Markdown file in a GitHub repository: it opens GitHub's own \"new file\" page with the review filled in (no server, no token). Please set it up with me, following this skill:",
    SKILL,
    "",
    "Start by asking me which GitHub repository to use (and the branch), and which HTML page. Then do the setup step by step, and tell me what a command does before you run it.",
    "",
    "Rules: never ask me to paste a token, key or password into this chat or into any page. Keep data-pipeup-doc exactly as it is. Don't change my pages except as the skill says.",
  ].join("\n"),
  stg: () => [
    "I want to try Pipeup's Send to Git example: an add-on that saves a review as a Markdown file in a GitHub repository, through a small service that I run. Please set it up with me, following this skill:",
    SKILL,
    "",
    "Start by asking me which GitHub repository to use, and whether I want to try it on this computer first or set it up for my team. Then guide me step by step, and tell me what a command does before you run it.",
    "",
    "Rules: never ask me to paste a token, key or password into this chat or into any page; tell me where to set it instead. Anything that needs my approval, such as creating a GitHub App or its permissions, I will do myself. Don't change my pages except as the skill says.",
  ].join("\n"),
  share: () => [
    "My HTML page already uses Pipeup for comments. I want to let reviewers see each other's comments. Please add the Pipeup Share add-on.",
    "",
    OPEN,
    "",
    `1. Add this script tag just after the Pipeup script tag, before </body>: ${tag("@pipeup/share", "share.min.js")}`,
    "2. Share needs a sharing address that I choose (a PrivateBin link or my own mailbox). I will give it to you: ask me for it. Do not make one up, do not pick a service, and do not try the address. When I give it, put it on the <html> element as data-pipeup-share=\"<address>\", exactly as I wrote it.",
    "",
    ...SAFE("share", "only to the sharing address I gave you"),
    "",
    "Leave everything else on the page as it is.",
  ].join("\n"),
  voice: () => [
    "My HTML page already uses Pipeup for comments. Please add the Pipeup Voice add-on, so reviewers can dictate a comment.",
    "",
    OPEN,
    "",
    `Add this script tag just after the Pipeup script tag, before </body>: ${tag("@pipeup/voice", "voice.min.js")}`,
    "",
    ...SAFE("voice", "to nowhere new (the browser's own speech engine does the listening)"),
    "",
    "Leave everything else on the page as it is.",
  ].join("\n"),
  assist: () => [
    "My HTML page already uses Pipeup for comments. Please add the Pipeup Assist add-on, so a small AI model on each reviewer's own device can read the page and point to related parts of it when they comment.",
    "",
    OPEN,
    "",
    `Add this script tag just after the Pipeup script tag, before </body>: ${tag("@pipeup/assist", "assist.min.js")}`,
    "",
    "",
    ...SAFE("assist", "to nowhere new (the model runs on the reviewer's device)"),
    "",
    "Nothing is sent anywhere: the model runs on the reviewer's device, and each reviewer is asked before it turns on. Leave everything else on the page as it is.",
  ].join("\n"),
  agents: () => [
    "My HTML page already uses Pipeup for comments. Please add the Pipeup Agents add-on, so an AI agent can answer comments and I can share the page's comments with it from my own computer.",
    "",
    OPEN,
    "",
    `Add this script tag just after the Pipeup script tag, before </body>: ${tag("@pipeup/agents", "agents.min.js")}`,
    "",
    "Do not list an agent's key unless I give you one: if I want an agent to reply, the agent can list itself, with my yes, by running npx --yes pipeup@0 agent --name <its name> --page <this page> --yes; or, if I give you its key, put it on the <html> element as data-pipeup-agents=\"<key>\" (add it to the list if the attribute is already there).",
    "",
    ...SAFE("agents", "to nowhere new (the page reads a file next to it, and sends comments only to the program on my own computer when I switch sharing on)"),
    "",
    "Nothing is sent before I switch Share with my agent on. Leave everything else on the page as it is.",
  ].join("\n"),
  emoji: () => [
    "My HTML page already uses Pipeup for comments. Please add the Pipeup Emoji add-on, so reviewers can react to comments with any emoji, not just the quick row.",
    "",
    OPEN,
    "",
    `Add this script tag just after the Pipeup script tag, before </body>: ${tag("@pipeup/emoji", "emoji.min.js")}`,
    "",
    ...SAFE("emoji", "to nowhere new (the emoji are part of the script)"),
    "",
    "Nothing is sent anywhere. Leave everything else on the page as it is.",
  ].join("\n"),
  inbox: () => [
    "My HTML page already uses Pipeup for comments. Please add the Pipeup Inbox add-on, so people I mention are told in a note that only they can read.",
    "",
    OPEN,
    "",
    `Add this script tag just after the Pipeup script tag, before </body>: ${tag("@pipeup/inbox", "inbox.min.js")}`,
    "",
    "Ask me for the address of the inbox service and put it on the <html> element as data-pipeup-inbox=\"<address>\", exactly as I give it. Do not guess one or pick a service. If I have none, tell me I can run the reference one with npx @pipeup/mailbox.",
    "",
    ...SAFE("inbox", "only to the inbox service address I gave you"),
    "",
    "Nothing is sent until each reviewer switches Mentions by inbox on. Leave everything else on the page as it is.",
  ].join("\n"),
  identity: () => [
    "My HTML page already uses Pipeup for comments. Please add the Pipeup Identity add-on, so reviewers can back up who they are with a recovery code and use it on another computer.",
    "",
    OPEN,
    "",
    `Add this script tag just after the Pipeup script tag, before </body>: ${tag("@pipeup/identity", "identity.min.js")}`,
    "",
    ...SAFE("identity", "to nowhere new (it sends nothing)"),
    "",
    "Nothing is sent anywhere. Leave everything else on the page as it is.",
  ].join("\n"),
  github: () => [
    "My HTML page already uses Pipeup for comments. Please add the Pipeup GitHub add-on, so that when a comment mentions someone on GitHub, I can open a new issue with their @name filled in.",
    "",
    OPEN,
    "",
    `Add this script tag just after the Pipeup script tag, before </body>: ${tag("@pipeup/github", "github.min.js")}`,
    "",
    "Ask me for the repository (owner/repo) and put it on the <html> element as data-pipeup-github-repo=\"owner/repo\". If I list GitHub names for the @ list, put them in data-pipeup-github-people=\"name name\". Do not guess either.",
    "",
    ...SAFE("github", "to nowhere new (it only opens github.com in a new tab when I press the menu row)"),
    "",
    "Nothing is sent by the page itself. Leave everything else on the page as it is.",
  ].join("\n"),
  updates: () => [
    "My HTML page already uses Pipeup for comments. Please add the Pipeup Updates add-on, so I am told in my own browser when a newer Pipeup or a security fix is out.",
    "",
    OPEN,
    "",
    `Add this script tag just after the Pipeup script tag, before </body>: ${tag("@pipeup/updates", "updates.min.js")}`,
    "",
    ...SAFE("updates", "only to https://pipeup-ai.github.io (the project's update list, once a day, and only on my own computer)"),
    "",
    "It runs only where I am looking (a file, localhost, or data-pipeup-updates=\"on\"). Leave everything else on the page as it is.",
  ].join("\n"),
  live: () => [
    "My HTML page already uses Pipeup for comments. Please add the Pipeup Live add-on, so reviewers can see who else is on the page.",
    "",
    OPEN,
    "",
    `Add this script tag just after the Pipeup script tag, before </body>: ${tag("@pipeup/live", "live.min.js")}`,
    "",
    ...SAFE("live", "only to the relays wss://relay.damus.io, wss://nos.lol and wss://relay.primal.net (and peer connections between the reviewers)"),
    "",
    "Leave everything else on the page as it is. Each reviewer is asked before Live does anything, so no other setting is needed.",
  ].join("\n"),
};

// The demos: each is a timeline of steps (ms into a 10 s loop); a step switches its class on, the CSS eases the change.
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
for (const demo of document.querySelectorAll(".demo")) {
  const stage = demo.querySelector(".stage");
  const steps = JSON.parse(demo.dataset.steps);
  const len = +demo.dataset.len;
  const [from, to] = demo.dataset.type.split(",").map(Number);
  const box = demo.querySelector(".cb[data-say]");
  const txt = box && box.querySelector(".txt");
  const fit = () => { const k = demo.clientWidth / 400; stage.style.transform = `scale(${k})`; demo.style.height = 300 * k + "px"; };
  fit(); addEventListener("resize", fit);
  const at = (t) => {
    for (const [ms, cls] of steps) stage.classList.toggle(cls, t >= ms);
    stage.classList.toggle("out", t >= len - 500);
    if (box) { const n = Math.round(Math.max(0, Math.min(1, (t - from) / (to - from))) * box.dataset.say.length); txt.textContent = box.dataset.say.slice(0, n); box.classList.toggle("sent", t >= to); }
  };
  let start = 0, raf = 0, seen = false;
  const frame = (now) => { at((now - start) % len); raf = requestAnimationFrame(frame); };
  const still = new URLSearchParams(location.search).get("t"); // e.g. ?t=4000 shows that moment, for checking
  if (still) { stage.style.transition = "none"; at(+still); continue; }
  if (reduced) { at(len - 600); continue; }
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !seen) { seen = true; start = performance.now(); raf = requestAnimationFrame(frame); }
    else if (!e.isIntersecting && seen) { seen = false; cancelAnimationFrame(raf); }
  }).observe(demo);
}
// What a Copy button or a Copy menu's row copies: a prompt, a script tag or a command.
const copyText = (key) => {
  const [id, what] = key.split("-");
  return what === "cmd" ? (id === "share" ? SHARE_DEMO : id === "make" ? TEMPLATE : MAILBOX) : what === "tag" ? tag("@pipeup/" + id, id + ".min.js") : prompts[id]();
};
const copy = async (text) => {
  try { await navigator.clipboard.writeText(text); } catch { const t = document.createElement("textarea"); t.value = text; document.body.append(t); t.select(); document.execCommand("copy"); t.remove(); }
};
/** Says "Copied" on the button for a moment, then its own words again. */
const copied = (b) => {
  const label = b.querySelector(".label");
  if (b.dataset.was === undefined) b.dataset.was = label.textContent;
  clearTimeout(b.copiedTimer);
  b.classList.add("copied"); label.textContent = "Copied";
  b.copiedTimer = setTimeout(() => { b.classList.remove("copied"); label.textContent = b.dataset.was; delete b.dataset.was; }, 2000);
};
// A card's Copy menu: a click opens it with the first row focused; Esc, Tab or a click elsewhere closes it; arrows move.
const menuButtons = [...document.querySelectorAll(".copy [aria-haspopup=menu]")];
const menuOf = (b) => document.getElementById(b.getAttribute("aria-controls"));
const setMenu = (b, open) => {
  b.setAttribute("aria-expanded", String(open));
  menuOf(b).classList.toggle("open", open);
  if (open) menuOf(b).querySelector("[role=menuitem]").focus();
};
for (const b of menuButtons) {
  b.addEventListener("click", () => {
    const open = b.getAttribute("aria-expanded") !== "true";
    for (const other of menuButtons) if (other !== b) setMenu(other, false);
    setMenu(b, open);
  });
  b.addEventListener("keydown", (e) => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setMenu(b, true); } });
  menuOf(b).addEventListener("keydown", (e) => {
    const rows = [...menuOf(b).querySelectorAll("[role=menuitem]")];
    const at = rows.indexOf(document.activeElement);
    if (e.key === "Escape") { e.preventDefault(); setMenu(b, false); b.focus(); }
    else if (e.key === "Tab") setMenu(b, false);
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); rows[(at + (e.key === "ArrowDown" ? 1 : rows.length - 1)) % rows.length].focus(); }
    else if (e.key === "Home" || e.key === "End") { e.preventDefault(); rows[e.key === "Home" ? 0 : rows.length - 1].focus(); }
  });
}
document.addEventListener("click", (e) => { for (const b of menuButtons) if (b.getAttribute("aria-expanded") === "true" && !b.parentElement.contains(e.target)) setMenu(b, false); });
for (const b of document.querySelectorAll("[data-copy]")) {
  b.addEventListener("click", async () => {
    await copy(copyText(b.dataset.copy));
    // A row in a menu: the menu closes and its Copy button says it was copied.
    const menu = b.closest(".cmenu");
    const shown = menu ? menuButtons.find((m) => menuOf(m) === menu) : b;
    if (menu) { setMenu(shown, false); shown.focus(); }
    copied(shown);
  });
}
  // For agents: hover or focus shows the menu; on touch screens (no hover) the first tap opens it.
  const agents = document.querySelector(".agents");
  const agentsLink = agents.querySelector(".agents-link");
  const setAgents = (on) => { agents.classList.toggle("open", on); agentsLink.setAttribute("aria-expanded", String(on)); };
  agentsLink.addEventListener("click", (e) => {
    if (matchMedia("(hover: none)").matches && !agents.classList.contains("open")) { e.preventDefault(); setAgents(true); }
  });
  agents.addEventListener("mouseenter", () => agentsLink.setAttribute("aria-expanded", "true"));
  agents.addEventListener("mouseleave", () => setAgents(false));
  agents.addEventListener("keydown", (e) => { if (e.key === "Escape") { setAgents(false); agentsLink.blur(); } });
  document.addEventListener("click", (e) => { if (!agents.contains(e.target)) setAgents(false); });
