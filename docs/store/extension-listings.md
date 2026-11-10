# Store listings for Pipeup for browsers

Drafts of everything each store asks for: every field, the permission justifications, the privacy answers, notes for
the store's reviewer and the screenshots to take. Written from an audit of the extension's code and each store's rules
as read on 10 November 2026, then revised against the build on `feat/browser-extension`. **Nothing has been
submitted.** Submitting, the accounts and the release are the maintainer's call.

The text in each `text` block is ready to paste once the placeholders in square brackets are filled. The privacy
policy all four point to is in [privacy-policy.md](privacy-policy.md).

## Before anything is submitted

- **A release.** Bump the version off 0.9.1, publish the library (with `pipeup browser`) and the add-ons to npm, tag
  it, and build every store package from that tag. Send to my agent's setup command names the extension's own version,
  so it only works once that version is on npm, and the stores' reviewers rebuild from the tag.
- **The Safari app:** real content in the containing app (how to turn Pipeup on, a guide, privacy and support links,
  the licences), a Release archive signed by the team, a deployment target below macOS 27, and the version and
  category keys.
- **Pages and accounts:** the privacy policy and a support page on the website, a support contact, a test page for
  Share and Live, and a developer account at each store.
- **Store art:** screenshots for each store (light look, fictional pages and names), Chrome's 440×280 tile, Edge's
  300×300 logo and full-size icons for the Mac app.
- **Checks by hand:** Firefox's question before anything is sent (the automated Firefox can't show it), and the hand
  checklist (docs/testing/extension-checklist.md) in each browser on the build being sent.

## What is known and said in the listings

- **Pipeup's own text boxes are the extension's frame**, so the page hears nothing typed in a comment, reply, edit or
  the name in a new comment. Not covered yet: the menu's name row when Pipeup's button is shown on pages, and
  add-ons' own fields (My identity's recovery code); and for a moment as a box opens, until its frame is ready.
- **In Firefox, withdrawing the data permission later** (about:addons) doesn't turn Share, Live or Save to GitHub off.
- **Firefox's data declaration** doesn't list website activity, though Live shares where the pointer is.
- **Other Chromium browsers** (Vivaldi, Opera, Arc) are set up as Chrome by Send to my agent's command; the listings
  name only Chrome, Edge and Brave.
- **Voice in Chrome and Edge** may show the sentences written for Safari; to check in each.
- **The emoji table's licence** (emojibase, MIT) isn't in the package yet.
- **The manifest description** still says "any web page" and "until you send them"; a new one is the maintainer's call.

## Order of submission

1. Now, in parallel: open all four developer accounts. Apple enrolment and Partner Center verification take days, Chrome registration needs a fee and 2-step verification, and AMO needs 2FA. Draft the Chrome listing (it is missing) from the Edge draft.
2. Then: agree the spec changes (EXTENSION_SPEC sections 2, 5 and 6) and land the code and build changes marked blocker and recommended on a feature branch, with npm run check green.
3. Then: release the next stable version (library, CLI with `pipeup browser`, add-ons) to npm and tag it. Every store depends on this, and every [release version] placeholder resolves from it.
4. In parallel with the release: publish the privacy and support pages on the website, a test page with data-pipeup-doc and a sharing address, and make the screenshots and store art per store.
5. Day one after release: submit Firefox and Chrome. AMO has the longest and least predictable queue (days to over a month, plus a possible source-rebuild round trip), so start it first. Chrome is the reference Chromium listing.
6. A few days later, or once Chrome passes: submit Edge with the same Chromium zip. A rejection on either Chromium store means a version bump that both must take, so letting Chrome go first avoids two parallel resubmissions. Edge takes up to 7 business days, and any edit restarts its review.
7. Last: Safari. It needs the per-target build, the containing app and the Xcode project work. Run TestFlight on a clean Mac (prompt wording, Option-Shift-P) while the other reviews run, then submit. Review is usually 24–48 hours, but expect a 4.2 or privacy round on the first try. Use manual release so the maintainer can line it up with the others.

## Chrome Web Store
### Listing fields
#### Name (manifest "name", 75 max)
_6 characters. Unchanged from the manifest._
```text
Pipeup
```
#### Summary (manifest "description", 132 max)
_124 characters. Chrome takes the summary from the manifest, whose description is still "Comment on any web page with Pipeup. Your comments stay in this browser until you send them." Replace it with this line in apps/extension/src/manifest.json and rebuild before the first upload: "any web page" overclaims (the browser's own pages and stores are closed to extensions), and the new line says what the extension is for._
```text
Comment on words, pictures or any part of a web page, then copy, save or send the comments to the person or agent who asked.
```
#### Detailed description (Store listing tab; about 16,000 max, unconfirmed)
_5978 characters. Revised against commit f1a7d76: the page's scripts can no longer read Pipeup's UI, add-ons' choices are kept by the extension (nothing in the site's storage), Live's consent can't be set by a page, Send to my agent's command names the release and browser and isn't offered on Windows, replies are asked for only after first use, and deleting a comment deletes its picture. Names no agent product. If Send to my agent's helper is not on npm at the release version by submission, take its bullets out and remove nativeMessaging from the build._
```text
Pipeup lets you comment on web pages and hand your comments to the person or AI agent who asked for your feedback.

Press Pipeup in the toolbar (or Alt+Shift+P) and choose Comment on this page. Point at what you mean: select a few words, click a picture or a block, or pin a spot. A box opens beside it with the cursor in it. Write your note and press Enter. You can reply, resolve and reopen, and edit or delete your own comments.

What you can do
• Comment on ordinary web pages (http and https). The browser's own pages, such as settings, the new tab page and extension stores, are closed to extensions, and Pipeup says so there.
• Right-click selected words, a picture, a link or the page and choose Comment with Pipeup.
• See every comment on the page in one list, with replies, Resolve and Reopen. Turn on Keep comments beside the page to show it in the browser's side panel; otherwise each thread opens beside its place on the page.
• Copy comments as Markdown or as text, ready to paste into a message, a ticket or a chat with an AI.
• Save comments as a Markdown file, or as a Pipeup file, which keeps every change and which Pipeup's command-line tools can read.
• Send to my agent: give the page's comments to AI agents on this computer, and see their replies in the threads. It needs a small helper program that you install yourself with one command, which Pipeup shows you, filled in for Chrome, Edge or Brave. The helper runs on macOS and Linux and needs Node.js 20 or later. Send to my agent isn't offered on Windows. Everything else works without it.
• Comments you've made lists every page you have commented on, newest first.
• Always on for this site starts Pipeup whenever you open that site, without a press. The browser asks your permission for that one site. Pages on this computer (localhost and 127.0.0.1) have one switch for every port.
• Keep a picture of where each comment was made, so a comment whose place has gone still shows what it was about.
• Add-ons, each turned on or off in the extension's settings: Emoji (on by default), Voice, Share, Live, Save to GitHub and My identity.

Where your comments are kept
Your comments, the pages you commented on (address and title), the sites where you started Pipeup, your name and signing key, your settings, the add-ons' choices (such as whether you agreed to go live, and your recent emoji) and the pictures are kept by the extension, in this browser. Nothing is written to the site's own storage. There is no account to make. Pipeup has no analytics or telemetry, sends nothing to its makers, and loads no code from the web.

Who else can see them
• Not the page you are on. Pipeup draws its highlights, comment boxes and menus inside the page but closed to the page's own scripts, so they can't read your comments, your name or the recovery code My identity shows. What you type into Pipeup's boxes on a page is typed in the extension's own frame, so the page can't see the words or the keys you press.
• Whoever you give them to with Copy comments or Save comments.
• Send to my agent sends the page's comments, with their earlier versions, and the page's full address and title, to the helper program on this computer, which keeps them in ~/.pipeup/browser. Once you have used it, the toolbar menu also asks the helper for agents' replies on pages where Pipeup is on. That request carries only a code made from the page's address.
• Add-ons that send, once you turn them on:
 – Voice: when you press the microphone, the browser turns your speech into text. Depending on the browser and the language, the audio may go to the browser maker's speech service.
 – Share: works only on pages that carry a Pipeup document id and a sharing address (yours from the settings, or the page's own if you set none). While sending is on, it sends your new comments to that server about every 10 seconds, encrypted with the key in the address, and brings others' comments back. Anyone with the address, including a page that names it, can read them. The server sees your IP address. Comments you wrote before Share was on wait until you choose.
 – Live: works only on pages that carry a Pipeup document id. After you agree in Live's own panel, it connects you through public relays (or ones the page names) to others on the same page, and sends them the page's comments, your name, where you point and select, and when you are typing. The relays, public connection (STUN) servers and the others see your IP address. A page can't give that agreement for you.
 – Save to GitHub: when you mention someone by their GitHub name and press Mention on GitHub in Pipeup's menu, it opens a github.com new-issue page with the comment, your name, the page title and its full address filled in. GitHub receives these when that page opens. Nothing is filed until you submit it there.
 – My identity shows a recovery code for your Pipeup identity, which you can copy or save. It sends nothing.

Good to know
• When you make a comment on a page where you pressed Pipeup, a picture of the visible tab is taken and cut to the comment's place. Pictures are kept by the extension, shown only in the side panel, and never copied, saved in files or sent. Deleting a comment deletes its picture, and turning pictures off deletes them all.
• Editing or deleting a comment keeps the earlier text in its history, which goes into a Pipeup file, Send to my agent, Share and Live.
• Your comments carry your name and a public key that is the same on every site, so comments shared or saved from different sites can be linked to you.
• Sites can tell that Pipeup is installed, because pages can load its files.
• To remove what the extension keeps, remove the extension. Files you saved and what Send to my agent wrote on your computer (in ~/.pipeup/browser) stay until you delete them.

Open source
Pipeup is open source under the MIT licence. Source code, build steps and issues: https://github.com/pipeup-ai/pipeup
Website: https://pipeup-ai.github.io/pipeup/
```
#### Category
_The pick list wasn't visible without signing in. Pipeup is for anyone giving feedback, not only developers, so Developer Tools is the second choice._
```text
Productivity (subcategory "Workflow & Planning" if the pick list offers it)
```
#### Language
_The package has no _locales, so there is one listing. If the dashboard offers only "English", choose that._
```text
English (United Kingdom)
```
#### Store icon
_Already meets the spec._
```text
icons/128.png from the package (128x128 RGBA, artwork within 16 px padding)
```
#### Official URL (verified publisher)
_Optional. Unverified whether a GitHub Pages URL-prefix property qualifies. Otherwise leave it empty, and the publisher name shows under "Offered by"._
```text
https://pipeup-ai.github.io/pipeup/ (only once it is verified in Google Search Console)
```
#### Homepage URL
_Better still, a page there about the extension, once one exists._
```text
https://pipeup-ai.github.io/pipeup/
```
#### Support URL
_Public GitHub Issues. The account contact email is separate: [support contact: maintainer to supply]._
```text
https://github.com/pipeup-ai/pipeup/issues
```
#### Mature content
_None_
```text
Off
```
#### Promo video (YouTube URL)
_Optional._
```text
None for the first release
```
#### Small promo tile 440x280 (text on the tile, if any)
_Brand-led: the violet bubble icon large on a solid saturated violet, plus these few words. No screenshot, no status claims, no "any web page" (browser pages and stores are closed to extensions). It has to read at half size on light grey._
```text
Pipeup: comment on web pages
```
#### Marquee promo tile 1400x560 (optional)
_Only needed to be featured in the carousel. Same rules as the small tile._
```text
Pipeup: comment on web pages, hand the comments to whoever asked
```
#### Single purpose description (Privacy tab; about 1,000 max)
_715 characters. Unchanged: still true of the build._
```text
Pipeup lets a reviewer comment on parts of a web page they choose, and hand those comments to the people or AI agents who asked for the feedback. Every feature serves that one purpose: adding Pipeup to the page when the reviewer asks, writing comments and replies, the side panel that lists them, keeping them in this browser, and getting them out with Copy comments, Save comments or Send to my agent. The optional add-ons are part of the same purpose: Emoji and Voice help write a comment; Share and Live deliver comments to the others reviewing the same page; Save to GitHub turns a comment into a draft GitHub issue; My identity lets the reviewer keep the same name and key on their comments in another browser.
```
#### Remote code (Privacy tab)
_Checked in dist/chromium: no eval, new Function, WebAssembly, importScripts or http(s) import; the only dynamic imports are chrome.runtime.getURL files; build.json is read from the package; no update_url. Share's fetch, Live's WebSocket and WebRTC, and the GitHub link carry data, not code._
```text
No, I am not using remote code.
```
#### Privacy policy URL (Privacy tab)
_Required. It must name every destination (the local helper and ~/.pipeup/browser; the sharing server the reviewer sets; the Nostr relays wss://relay.damus.io, wss://nos.lol and wss://relay.primal.net by default, or ones the page names; the STUN servers stun.l.google.com and stun.cloudflare.com; peers; github.com; the browser maker's speech service), cover retention and deletion (no delete-all in the extension; removing it removes the extension's storage, not saved files or ~/.pipeup/browser), the pictures, the signing key, no telemetry, and carry the Limited Use statement._
```text
[privacy policy URL: maintainer to supply — suggested https://pipeup-ai.github.io/pipeup/privacy/]
```
#### Payments / in-app purchases (Distribution tab)
_None_
```text
Free. No in-app purchases.
```
#### Visibility (Distribution tab)
_Use Unlisted or Private for a trusted-tester round first if wanted. All three get the same review._
```text
Public
```
#### Regions (Distribution tab)
_None_
```text
All regions
```
#### Test instructions (Test instructions tab)
_About 6,498 characters. No documented limit was found._
```text
Paste the reviewer notes (reviewerNotes) here. There are no credentials: no account is needed.
```
#### Version
_The extension's version is the Pipeup release's version (spec §7), taken by tools/build-extension.mjs from libs/ts/pipeup/package.json, and it is also the version Send to my agent's command installs (pipeup@<manifest version>). Today that file says 0.9.1, which on npm has no browser command, and the extension is not in tag v0.9.1. Build from the new release's tag. Each later upload must be higher._
```text
[release version]
```
#### Submit dialog: publish automatically after review
_This lets the maintainer first set the helper's documentation and the website's install link to the store extension ID. Publish within 30 days of approval, or the item returns to draft._
```text
Untick (deferred publishing)
```
### Permission justifications
#### activeTab
```text
The reviewer gives Pipeup one tab at a time: by opening the toolbar menu (the button or Alt+Shift+P) or by choosing Comment with Pipeup in the right-click menu. activeTab gives access to that tab for that use, so no site access is asked for at install. With it, the menu shows the page's address and uses its title to name a saved file, Comment on this page adds Pipeup to the tab, and tabs.captureVisibleTab takes the small picture of where a new comment was made. Pictures are kept by the extension in this browser only, are deleted with their comment, and can be turned off in the settings, which deletes them all. The 'tabs' permission is not requested. On a site the reviewer set to Always on, Pipeup starts through the optional host permission instead (see that justification).
```
#### scripting
```text
Used to add Pipeup to the page the reviewer chose: chrome.scripting.executeScript runs the extension's own start.js in that tab when they press Comment on this page or choose Comment with Pipeup. When the toolbar menu opens on an http or https page where Pipeup isn't running, a small packaged function runs in that tab to see whether the page already has Pipeup built in, so the extension can step aside. When the reviewer turns on Always on for this site (or Always on for local pages), registerContentScripts registers start.js for that site only and runs it once in the tab; turning the switch off unregisters it. All scripts are files packaged in the extension. Pipeup's own files (pipeup/*, addons/*) are listed in web_accessible_resources so start.js can import them as modules.
```
#### storage
```text
Pipeup keeps its data in chrome.storage.local, in this browser: the comments on each page with their full history (keyed by page), the list of pages commented on (address without query, title, time), each site's choices where Pipeup was started (look, Hide comments), the reviewer's display name and signing key, the settings (comments beside the page, Show Pipeup's button on pages, pictures on or off, which add-ons are on, the sharing address and the GitHub repository), add-ons' choices (Live's consent, Share's and Voice's choices, Emoji's recent emoji), whether Send to my agent was used and which agent replies were added, the small pictures of where comments were made, and the toolbar icon's look. Nothing is written to the site's own storage. Comments leave the browser only through features the reviewer uses: Copy, Save, Send to my agent, and add-ons they turned on (Share and Live send while on).
```
#### unlimitedStorage
```text
Comments are kept for every page the reviewer comments on, with each page's full comment history, and a small picture (JPEG, at most 480 px wide) is kept for each new comment unless the reviewer turns pictures off. Over many pages this passes chrome.storage.local's default quota, and when that happens saving a comment fails. unlimitedStorage keeps comments from being lost. The pictures are never sent. Deleting a comment deletes its picture, and turning pictures off deletes all the pictures kept.
```
#### sidePanel
```text
The browser's side panel lists every comment on the page, with threads, Reply, Resolve, Reopen, and Edit and Delete on the reviewer's own comments, plus the picture of where a comment was made when its place has gone. It opens when the reviewer turns on Keep comments beside the page, or, while that is on, presses Comment on this page, Comments or Start commenting in the toolbar menu. The panel is the extension's own page (panel.html). Because the manifest names it, the browser also lists it in its side panel picker; on a page without Pipeup it only says how to start.
```
#### clipboardWrite
```text
Used only for Copy buttons the reviewer presses: Copy comments in the toolbar menu (as Markdown or as text), Copy beside the Send to my agent setup command, Copy comments in Pipeup's own menu on the page, and Copy code in the My identity add-on. For the toolbar's Copy comments, the menu first asks the page for its comments and waits for the answer, so the write can come after the click's user activation has ended; clipboardWrite keeps Copy working then. The extension never reads the clipboard.
```
#### contextMenus
```text
Adds one right-click item, Comment with Pipeup, on selected words, a picture, a link or the page. Choosing it adds Pipeup to that tab if it isn't on and opens a comment box on what was right-clicked. The item's information (whether words were selected, the picture's or link's address) goes only to Pipeup in that tab, to find the place.
```
#### nativeMessaging
```text
Used for Send to my agent. When the reviewer presses it, the page's comments (as Markdown and as a Pipeup file with their history), the page's full address and its title go to the Pipeup helper program on this computer (host ai.pipeup.browser), which the reviewer installs separately with one npx command that the menu shows, naming this release's version (macOS and Linux; not offered on Windows). AI agents on the same computer read them there, and their replies come back into the threads. Once Send to my agent has been used, the toolbar menu also asks the helper for new replies when it is opened on a page where Pipeup is on; that request carries only the page's id, a code made from its address. If the helper isn't installed, nothing is sent and the menu shows the command. Everything else in Pipeup works without it.
```
#### Host permission (optional_host_permissions <all_urls>)
```text
No site access is granted at install. The extension asks for a host permission only when the reviewer turns on Always on for this site, and then asks the browser for that one site's origin (for example https://example.com/*); or when they turn on Always on for local pages, which asks for http://localhost/*, http://127.0.0.1/* and http://[::1]/*. With it, Pipeup starts on every load of that site without a press. Turning the switch off removes the permission. The switch is offered only on http and https pages, so only those origins are ever requested. The pattern is declared broadly because the site is not known in advance.
```
### Privacy and data-use answers
#### Personally identifiable information
```text
Yes
```
_Why:_ Pipeup keeps the display name the reviewer types and puts it in every comment they write. It travels with Copy, Save, Send to my agent, Share, Live and Save to GitHub. It is shown on the page inside Pipeup's closed UI, which the page's scripts can't read.
#### Health information
```text
No
```
_Why:_ Not asked for or handled. Comment text is the reviewer's own words, declared under Personal communications and Website content.
#### Financial and payment information
```text
No
```
_Why:_ Free. Nothing is sold, and no payment data is handled.
#### Authentication information
```text
Yes
```
_Why:_ An Ed25519 signing key, one per reviewer, is stored unencrypted in chrome.storage.local and signs every comment. It proves authorship, though there is no password or account. My identity shows it as a recovery code inside Pipeup's closed UI on the page, which the page's scripts can't read, and the reviewer can copy or save it. No GitHub token is kept: sign-in happens on github.com. The privacy policy must describe the key.
#### Personal communications
```text
Yes
```
_Why:_ Comments and replies are messages to the people or agents who asked for feedback. Share and Live deliver them to other people. Send to my agent delivers them to a local program, and agents' replies come back.
#### Location
```text
No
```
_Why:_ No location is read or kept. The servers used by Share and Live (sharing server, relays and STUN), and Live peers, see the reviewer's IP address as part of a connection, but the extension doesn't collect it. Say this in the privacy policy.
#### Web history
```text
Yes
```
_Why:_ Pipeup keeps a list of the pages commented on (address without query, title, last time) and per-site choices for every site where Pipeup was started. Send to my agent and Save to GitHub use the page's full address.
#### User activity
```text
Yes
```
_Why:_ Live, which is off by default and connects only after the reviewer agrees in its own panel, sends where the reviewer points and selects, and when they are typing, to the others on the page. There is no keystroke or click logging otherwise.
#### Website content
```text
Yes
```
_Why:_ Each comment stores the page text it is about: the selected words with the text around them, a short excerpt, the element's name (which can be a link or picture address), the headings above it and the page title. A picture of the visible tab, cut to the comment's place, is kept in this browser only and deleted with its comment. Disclose both in the policy.
#### Certification: I do not sell or transfer user data to third parties, outside of the approved use cases
```text
Certify (tick)
```
_Why:_ Nothing is sold. Data goes to others only through features the reviewer uses: Send to my agent, or an add-on they turned on that sends to a destination they chose. Live's consent is kept by the extension, so a page can't give it for the reviewer.
#### Certification: I do not use or transfer user data for purposes that are unrelated to my item's single purpose
```text
Certify (tick)
```
_Why:_ All data serves commenting and delivering comments. There are no ads, no analytics and no telemetry.
#### Certification: I do not use or transfer user data to determine creditworthiness or for lending purposes
```text
Certify (tick)
```
_Why:_ Not applicable to Pipeup in any way.
#### Privacy policy URL
```text
[privacy policy URL: maintainer to supply — suggested https://pipeup-ai.github.io/pipeup/privacy/]
```
_Why:_ Required because user data is handled, even if only locally. Include: "The use of information received from Chrome APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements." Cover every destination listed in the description.
#### Are you using remote code?
```text
No, I am not using remote code.
```
_Why:_ Every script is packaged. Dynamic imports load only chrome.runtime.getURL package files. There is no eval, new Function, WebAssembly or remote script (checked in dist/chromium).
#### Single purpose
```text
Pipeup lets a reviewer comment on parts of a web page they choose, and hand those comments to the people or AI agents who asked for the feedback. (Full text is in the listing field.)
```
_Why:_ It states one narrow purpose and frames every add-on as part of it.
### Notes for the store's reviewer
```text
No account, sign-in or setup is needed for the core features.

Try it in a few minutes
1. Pin Pipeup from the puzzle-piece menu.
2. Open https://example.com (any ordinary http or https page works; the browser's own pages and the Web Store are closed to extensions, and Pipeup says so there).
3. Press Pipeup in the toolbar (or Alt+Shift+P). The menu shows the page's address, Comment on this page, Always on for this site, the shortcut and a link to Comments you've made. Press Comment on this page.
4. Comment mode starts: an outline follows the pointer. Select the words "Example Domain", or click the heading. A box opens beside it with the cursor in it. Type "Sam: make this heading shorter" and press Enter. The place is marked on the page, and the toolbar button shows a count.
5. Press Pipeup again. The menu now lists your name, Copy comments, Save comments, Send to my agent, Theme, Comments, Keep comments beside the page, Hide comments, Start commenting, Always on for this site and Turn off on this page. Press Comments: the comment list opens on the page. Turn on Keep comments beside the page: the list moves into the browser's side panel, with Reply and Resolve.
6. Copy comments > As Markdown puts the comment on the clipboard. Save comments > As a Markdown file saves it to Downloads.
7. Right-click any word or picture and choose Comment with Pipeup to comment on it directly.
8. The extension's options page (Comments you've made, also linked from the menu) lists every page with comments, and has the settings: Show Pipeup's button on pages, Keep a picture of where each comment was made, the add-ons, and the Send to my agent setup.

What each sensitive permission is for
- activeTab: opening the toolbar menu or choosing the right-click item gives Pipeup that one tab. It is also what lets tabs.captureVisibleTab take the small picture of where a comment was made. Pictures are kept in chrome.storage.local only and never sent. They are on by default, are deleted with their comment, and can be turned off on the options page, which deletes them all.
- scripting: injects the packaged start.js into that tab, checks whether the page has Pipeup built in, and registers start.js only for sites set to Always on.
- storage: everything Pipeup keeps, including add-ons' choices (such as Live's consent), is in chrome.storage.local. Nothing is written to the site's own storage, and Pipeup's UI on the page is in a closed shadow root, so the page's scripts can't read it.
- nativeMessaging: Send to my agent (see below), plus a reply check to the same local helper when the menu is used on a page where Pipeup is on, once Send to my agent has been used.
- clipboardWrite: the Copy buttons, mainly Copy comments, which writes after an asynchronous request to the page.
- unlimitedStorage: comment histories for every page, plus one picture per comment.
- sidePanel: the list of comments beside the page. Because the manifest declares a side panel, Pipeup appears in the side panel picker from install; on a page without Pipeup it only says how to start.
- Optional host permission: Always on for this site asks the browser for that one site's origin only. Always on for local pages asks for localhost, 127.0.0.1 and [::1]. Nothing is requested at install, and turning the switch off removes the permission. Only http and https origins are ever requested.
- web_accessible_resources (pipeup/*, addons/*): start.js imports Pipeup and the add-ons the reviewer turned on as ES modules, so these files must be loadable on any site.

Send to my agent (optional; macOS and Linux)
It passes the page's comments to a helper program, pipeup browser, on the reviewer's computer over native messaging (host name ai.pipeup.browser). The helper is not in the package. The reviewer installs it with Node.js 20 or later: npx --yes pipeup@[release version] browser install --extension-id <this extension's ID> (in Edge or Brave the command adds --browser edge or --browser brave). The menu and options page show this command with this release's version and the ID filled in. The helper writes the comments to ~/.pipeup/browser/<page id>/. Agents read them with npx --yes pipeup@[release version] browser read, and answer with npx --yes pipeup@[release version] browser reply <page> --thread <id> "<words>". The replies appear in the threads after Send to my agent is pressed again or the menu is next used on that page. Without the helper, Send to my agent shows "not set up yet" and the command, and nothing else is affected. It is not offered on Windows.

Add-ons
Emoji is on by default and has no network code. Voice, Share, Live, Save to GitHub and My identity are off, and are turned on in the options page. Share and Live work only on pages whose HTML carries a Pipeup document id (data-pipeup-doc), so on example.com they say they need a document identity. To try them, open [test page URL: maintainer to supply] in two windows. Live connects only after the reviewer agrees in its own panel; that choice is kept by the extension, so a page can't make it for them. Save to GitHub needs a repository (set in the settings, or named by the page) and a comment that mentions a gh: person; it then offers Mention on GitHub in Pipeup's menu, which opens a github.com new-issue page with the comment filled in. GitHub receives it when that page opens; nothing is filed until the reviewer submits it there.

No remote code
Everything is packaged. There is no eval, new Function or remote script, and the only dynamic imports are chrome.runtime.getURL files in the package. No analytics or telemetry.

Source and rebuilding
Source (MIT): https://github.com/pipeup-ai/pipeup at tag [release tag: maintainer to supply]. pipeup/pipeup.esm.js and addons/*.esm.js are minified (esbuild, plus terser for the core), not obfuscated. The extension's own popup, panel, options, background and start scripts are shipped as written. To rebuild the package from the repository root at that tag with Node.js 22 (the add-ons need 22):
1. cd libs/ts/pipeup && npm ci && npm run build
2. cd ../addons && npm ci && npm run build
3. cd ../../.. && node tools/build-extension.mjs
The output is apps/extension/dist/chromium, zipped as apps/extension/dist/pipeup-extension-[release version]-chromium.zip. Its build.json lists what the Chrome package holds: all six add-ons, and pictures. The build stops if an add-on is missing, prints the SRI hash of pipeup/pipeup.esm.js and checks that the packed file is the one it built.
```
### Screenshots
| # | Shows | Size | Caption |
|---|---|---|---|
| 1 | 1. Comment on words. An ordinary article page in light mode. A sentence is highlighted, and the new-comment box sits beside it with the cursor in it and the text "Tighten this sentence — Ada". The page shows comment mode's outline. | 1280x800, full bleed, square corners, 24-bit PNG without alpha (or JPEG) | Point at words and write your comment beside them |
| 2 | 2. Comment on a picture. The same page with a product photo marked, and an open thread popover beside it. Sam's comment and Lee's reply are visible. The place is marked on the page. | 1280x800, full bleed, square corners, 24-bit PNG without alpha (or JPEG) | Comment on pictures, blocks or any point, and reply |
| 3 | 3. The side panel. Keep comments beside the page is on. The browser's side panel lists three threads (by Sam, Ada and Lee) with For you and Resolved, one thread open with Reply and Resolve, and its place marked on the page. | 1280x800, full bleed, square corners, 24-bit PNG without alpha (or JPEG) | Every comment on the page, beside the page |
| 4 | 4. The toolbar menu. Pipeup is on, and the menu is open from the toolbar: the page address, your name (Ada), Copy comments expanded to As Markdown / As text, Save comments, Send to my agent, Comments with a count, Start commenting, Always on for this site. Taken on macOS, where Send to my agent is offered. | 1280x800, full bleed, square corners, 24-bit PNG without alpha (or JPEG) | Copy, save or send the comments to whoever asked |
| 5 | 5. Comments you've made and the settings. The options page lists pages with comments (newest first) and the settings: Show Pipeup's button on pages, Keep a picture of where each comment was made (with its "Kept in this browser only" line), the Add-ons switches (Emoji on, others off), and the Send to my agent command showing the release's version (npx --yes pipeup@[release version] browser install --extension-id …), not 0.9.1. | 1280x800, full bleed, square corners, 24-bit PNG without alpha (or JPEG) | Your comments, your settings and the add-ons |

### Only the maintainer can supply
- Blocker, the release: publish a pipeup release on npm that has the browser command (0.9.1 has none). The extension's version, and so the version in the command it shows (pipeup@<manifest version>), comes from libs/ts/pipeup/package.json, which says 0.9.1 today; bump it to the new release before building. Otherwise remove nativeMessaging and Send to my agent from this build: a reviewer who can't make it work can reject for an unusable feature and an unneeded permission.
- Blocker, the tag: the extension is not in tag v0.9.1. Tag the release commit that contains apps/extension, build the package from that tag, and put the tag and version in the reviewer notes in place of [release tag: maintainer to supply] and [release version].
- Blocker, the privacy policy: publish docs/store/privacy-policy.md it at a public URL, matching this listing and the data-usage ticks, with the Limited Use statement.
- Blocker, support: a support contact [support contact: maintainer to supply], the publisher name shown as "Offered by", and a verified contact email.
- Blocker, the account: a Chrome Web Store developer account on a dedicated Google Account with 2-Step Verification, the developer agreement accepted, and the one-time registration fee paid (historically US$5, unconfirmed). Trader or Non-Trader declaration: Non-Trader is likely for an individual publishing an MIT project, but that is the maintainer's own legal call.
- Blocker, store art: 5 screenshots at 1280x800 with fictional names in light mode (the options page shot must show the release's version in the command), a 440x280 small promo tile, and optionally a 1400x560 marquee tile.
- A test page carrying data-pipeup-doc (and a sharing address) so reviewers can try Share and Live; put its URL in the reviewer notes.
- Change the manifest description to the new summary and rebuild (Chrome shows it as the summary).
- Advised: narrow optional_host_permissions from <all_urls> to http://*/* and https://*/*: the code only ever requests http and https origins, and minimum permission applies to optional permissions too. Consider use_dynamic_url on web_accessible_resources (not yet tested with the dynamic import).
- Advised: check minimum_chrome_version 121: the core uses Ed25519 in WebCrypto, which Chrome shipped later (believed 137, not verified here). On older versions Pipeup may fail to start.
- Advised: check Voice in Chrome: if Chrome exposes only webkitSpeechRecognition, Voice shows its Safari and Apple sentences in Chrome (libs/ts/addons/voice/src/addon.ts:141). Not tested.
- Advised: an in-extension disclosure on first use for pictures, and before Share is turned on (2026 disclosure rules). Voice and Live have consent panels; Share shows a note in the comment box and then sends automatically. In Chrome nothing asks before Share or Save to GitHub is turned on (Firefox's question is Firefox only).
- Add the emojibase-data (17.0.0, MIT) notice, or a third-party notices file, to the package. The minified emoji bundle carries none.
- Category choice from the live pick list.
- Optional: verify pipeup-ai.github.io in Google Search Console for the Official URL, and set up a group publisher for several maintainers.
- After approval: give the store-assigned extension ID to the helper installer's documentation and the website's install link. The in-extension command already fills in the ID. Decide whether to pin the ID with a manifest key.
- Test the exact zip as a packed extension before uploading. The Web Store signs the package, so no signing step is needed.

## Microsoft Edge Add-ons
### Listing fields
#### Extension name (from manifest 'name'; read-only in Partner Center)
_6 characters. Names no browser._
```text
Pipeup
```
#### Short description (from manifest 'description'; read-only in Partner Center)
_106 characters (under the 132 commonly assumed; Edge documents no limit). This proposed change to the manifest 'description' needs a rebuilt package. The current manifest text ('Comment on any web page with Pipeup. Your comments stay in this browser until you send them.') has one caveat left: once Share is on, new comments are sent without a further press._
```text
Comment on the web pages you visit and pass the comments to the person or AI agent who asked for feedback.
```
#### Description (long), language en
_5,912 characters, counted (limit 250 to 10,000). Names no other browser. Covers policy 1.2.3 (Node.js and a local program), 1.4.1 (Send to my agent not offered on Windows) and 1.5.1 (data handling). Policy 1.1.8 doesn't apply: no browser setting changes. Each sentence checked against the build after the closed UI, extension-kept add-on choices and per-browser packages: Edge gets the Chromium package with all six add-ons and pictures._
```text
Pipeup lets you comment on the web pages you visit, and pass those comments to the person or AI agent who asked for your feedback.

HOW IT WORKS
- Open a page, press Pipeup in the toolbar (or Alt+Shift+P) and choose Comment on this page.
- Point at what you mean: select words, or click a picture, a block or a point on the page. A comment box opens beside it with the cursor in it.
- Each comment is a thread. You can reply, resolve it, and edit or delete your own comments.
- Comments, in the toolbar menu, shows every comment on the page. Turn on Keep comments beside the page to see them in the browser's sidebar instead.
- Right-click words, a picture or a link and choose Comment with Pipeup to comment on just that.
- Comments you've made lists every page you have commented on, newest first.

GETTING THE COMMENTS TO WHOEVER ASKED
- Copy comments: as Markdown (for people and AIs) or as text, to the clipboard.
- Save comments: as a Markdown file, or as a Pipeup file to open again, where the browser saves downloads.
- Send to my agent: sends the page's comments to an AI agent on this computer, and the agent's replies come back into the threads. This needs other software: Node.js, and a one-time setup command run in a terminal, which the extension shows. It is offered on macOS and Linux; on Windows it isn't shown yet.
- Add-ons you turn on in the extension's settings (see below).

ACCESS TO PAGES
- Installing gives Pipeup no access to sites. Unless you turn on Always on, Pipeup reaches a page only when you press its toolbar button, its shortcut or its right-click item, and only in that tab.
- Always on for this site starts Pipeup whenever you open that site. The browser asks your permission for that one site. Turning it off removes the permission. On pages from this computer (localhost), the menu offers Always on for local pages instead.
- Some pages are closed to extensions, such as the browser's own settings pages, the new tab page and the add-ons store. There, Pipeup says it can't run.

YOUR DATA
- No account, no sign-in, no analytics or telemetry. All of Pipeup's code is in the package; none is loaded from the web.
- Your comments, the words and place on the page they are about, the page's address and title, your name, your signing key, your settings and the add-ons' choices are kept by the extension, in this browser. The developer receives none of it.
- Pipeup writes nothing into the site's own storage. The site can't read what the extension keeps, and can't set an add-on's choices for you, such as your agreement to Live.
- Pipeup's comment boxes, panels and menus on the page are closed to the page's own scripts: they can't read the comments shown there, your name or a recovery code.
- When you make a comment, the extension takes a small picture of where it was, so a comment whose place has gone still shows what it was about. It shows a little of what was around the comment on screen. It is kept in this browser only and never sent, shared or copied. Deleting the comment deletes its picture. Turning off "Keep a picture of where each comment was made" in settings stops them and deletes the pictures kept.
- Editing or deleting a comment keeps the earlier text in its history. That history is in the Pipeup file, in what Send to my agent passes on, and in what Share and Live send.
- You have one identity on every site: a name you choose and a key that signs your comments. Comments you pass on from different sites can be linked to you.
- Comments leave this browser only when you copy or save them, press Send to my agent (to a program on this computer), or turn on an add-on that sends them (Share, Live, Save to GitHub). Once you have used Send to my agent, the toolbar menu also asks that program for agents' replies to the page, while Pipeup is on in that tab.
- Removing the extension removes everything it kept; there is no button to delete it all yet. Files you saved, and what Send to my agent wrote on your computer, stay until you delete them.

ADD-ONS
- Emoji (on by default): every emoji for reactions. Sends nothing.
- Voice (off): dictate a comment with the browser's speech recognition, which may send your voice to the browser's online speech service unless it can work on this device. The browser asks for the microphone when you first press it. Pipeup keeps no audio.
- Share (off): sends your comments, encrypted, to a sharing address you set (a mailbox or PrivateBin address), and fetches others'. It works only on pages that carry a Pipeup document identity. Once on, your new comments are sent about every 10 seconds; earlier ones wait until you choose. Without an address you set, Share stays off; a page can't choose one. The server sees your network address.
- Live (off): see others reviewing the same page at the same time. After you agree, it connects through public relays (relay.damus.io, nos.lol, relay.primal.net, or ones the page names) and connection servers run by Google and Cloudflare, then directly to the others. The others receive every comment on the page, your name and where your pointer is. Relays, servers and the others see your network address. It works only on pages that carry a Pipeup document identity.
- Save to GitHub (off): for a comment that mentions a GitHub user, opens a new issue on github.com with the comment, your name, the page title and its full address filled in. GitHub receives them when that page opens; nothing is filed until you submit it there. Pipeup holds no GitHub sign-in.
- My identity (off): shows a recovery code for your identity, to copy or save, and restores one. Sends nothing.

LIMITS
- Send to my agent needs Node.js, and is offered on macOS and Linux only for now.
- The sidebar is on desktop only.

OPEN SOURCE
Pipeup is free and open source under the MIT licence. Source code, and how to build the packaged files: https://github.com/pipeup-ai/pipeup
Website: https://pipeup-ai.github.io/pipeup/
```
#### Category (Properties)
_Developer tools is the alternative. The option list is from memory (unverified)._
```text
Productivity
```
#### Website (Properties)
```text
https://pipeup-ai.github.io/pipeup/
```
#### Support contact detail (Properties)
_Or an email address: [support contact: maintainer to supply]._
```text
https://github.com/pipeup-ai/pipeup/issues
```
#### Mature content (Properties)
_Pipeup shows only what reviewers write on pages they choose._
```text
Unchecked
```
#### Visibility (Availability)
_Hidden is an option for a quiet first release._
```text
Public
```
#### Markets (Availability)
_Listing in English only._
```text
All markets, including future markets
```
#### Single Purpose Description (Privacy)
_275 characters. No limit is documented._
```text
Pipeup lets a person comment on the web page they are viewing, and pass those comments on to the person or AI agent who asked for their feedback. Everything else in it (copying, saving, sending to a local agent and the optional add-ons) is a way of passing those comments on.
```
#### Are you using remote code? (Privacy)
_True. The only dynamic imports are chrome.runtime.getURL('pipeup/pipeup.esm.js') and addons/<id>.esm.js (start.js:19,30). There is no eval, new Function, WebAssembly, remote script or update_url._
```text
No, I am not using remote code
```
#### Privacy Policy URL (Privacy)
_Required before submitting. docs/store/privacy-policy.md is a draft, but it predates the current build (it still describes site storage, readable comments and pictures kept after deletion); it must be updated, name Microsoft Edge, and match the description's Your data and Add-ons sections._
```text
[privacy policy URL: maintainer to supply, for example https://pipeup-ai.github.io/pipeup/privacy/edge]
```
#### Search terms (Store listing, en)
_7 terms, each under 30 characters, 18 words in total (limit 21). Not shown to users._
```text
comment on web page; website feedback; annotate web pages; design review; AI agent feedback; page comments; review notes
```
#### YouTube video URL (Store listing)
_Optional. If added: recorded in Edge, on a fictional page with fictional names, ads off._
```text
None for the first release
```
#### Store listing language
_The package has no _locales, so one language._
```text
English (en)
```
#### Extension logo (Store listing)
_The build makes icons only up to 128 px; a 300x300 file must be made (tools/extension-icons.mjs)._
```text
300x300 PNG of the violet bubble
```
#### Small promotional tile (optional)
_Optional._
```text
440x280 PNG: the violet bubble and 'Comment on web pages' on a light ground
```
#### Large promotional tile (optional)
_Optional._
```text
1400x560 PNG: a page with two highlighted comments and the sidebar open, light look
```
#### Publisher display name (registration)
_Max 50 characters. It must be available and the maintainer's to use. Individual account._
```text
Pipeup
```
### Permission justifications
#### activeTab
```text
Pipeup works only on the tab where the person presses its toolbar button, its shortcut (Alt+Shift+P) or its right-click item, Comment with Pipeup. That press lets the menu show the page's address and title (the title names a saved file), lets Comment on this page add Pipeup to that tab, and lets the extension take a small picture of where each new comment was made (tabs.captureVisibleTab). The picture is cropped to the comment's place, kept in the extension's storage in this browser, never sent, and deleted with its comment. Because of activeTab, installing gives no access to any site.
```
#### scripting
```text
Injects Pipeup's comment layer, which is packaged in the extension (start.js, pipeup/pipeup.esm.js), into the tab the person chose, after a press of the toolbar button, the shortcut or the right-click item. When the menu opens on a page without Pipeup, a packaged function checks whether the page already has Pipeup built in, so the extension can step aside. When the person turns on Always on for this site (or Always on for local pages), it registers the same packaged script for that site, starts it in the open tab, and unregisters it when they turn it off. Nothing remote is run.
```
#### storage
```text
Keeps everything the extension holds in this browser: each page's comments and their history, the list of pages commented on (address without query, title, time), the person's name and signing key, per-site look, Hide comments and first-run choices, settings (pinned, show button, pictures, add-ons, sharing address, GitHub repository), the add-ons' own choices (Live's consent, Share's and Voice's choices, Emoji's recent emoji and skin tone), the pictures of where comments were made, whether Send to my agent has been used, the agent replies already shown, and the toolbar icon's light or dark look. Keeping these here means nothing goes into the site's own storage, so a page can't read them or set them. Nothing is synced or sent to the developer.
```
#### unlimitedStorage
```text
Comments are kept as a growing history for every page reviewed, and each new comment has a small picture of where it was made. On long or many reviews this passes the default storage quota, and saving a comment would then fail. Everything stays in this browser; deleting a comment deletes its picture, and turning off pictures in settings deletes all of them.
```
#### sidePanel
```text
Shows the page's comments in the browser's sidebar beside the page: the list, threads, replies, Resolve, and the picture of where a comment was when its place has gone. Pipeup opens it only when the person turns on Keep comments beside the page, or, with that on, presses Comments, Comment on this page or Start commenting.
```
#### clipboardWrite
```text
Copy comments puts the page's comments on the clipboard, as Markdown or as text, when the person presses it, from the toolbar menu or from Pipeup's menu on the page. The toolbar copy happens after an async request to the page for its comments, which can outlast the click's user activation. It also copies the Send to my agent setup command, and, with the My identity add-on, the recovery code, each when the person presses Copy. The extension never reads the clipboard.
```
#### contextMenus
```text
Adds one right-click item, Comment with Pipeup, on selected words, a picture, a link or the page. Choosing it adds Pipeup to that tab and opens a comment box on what was right-clicked.
```
#### nativeMessaging
```text
Send to my agent passes the page's comments (as Markdown and as a Pipeup file, with the page address and title) to a program on this computer, ai.pipeup.browser, which the person installs themselves with a one-time npx command the extension shows; an AI agent reads them there, and its replies come back into the threads. Once Send to my agent has been used, the toolbar menu also asks that program for agents' replies to the page while Pipeup is on in that tab, sending only the page's id. It is offered on macOS and Linux only; on Windows the feature isn't shown and no message is sent. If the program is not installed, nothing happens. It contacts nothing else.
```
#### optional_host_permissions: <all_urls>
```text
Not granted at install. It is requested at run time, for one site only, when the person turns on Always on for this site (https://that-site/*), or for localhost, 127.0.0.1 and [::1] when they turn on Always on for local pages. The browser asks first and the person can decline. Pipeup then starts on that site without a press. Turning the switch off removes the permission. Only http and https origins are ever requested.
```
### Privacy and data-use answers
#### Single Purpose Description
```text
Pipeup lets a person comment on the web page they are viewing, and pass those comments on to the person or AI agent who asked for their feedback. Everything else in it (copying, saving, sending to a local agent and the optional add-ons) is a way of passing those comments on.
```
_Why:_ Frames every export route and add-on as delivery of the one purpose (policy 1.1.1).
#### Are you using remote code?
```text
No, I am not using remote code
```
_Why:_ All code, the core and all six add-ons, is in the package; imports use chrome.runtime.getURL only.
#### What user data do you plan to collect: Website content
```text
Yes
```
_Why:_ Comments quote the page (selected words, nearby text, element names, headings), and a small picture of the visible tab is taken for each new comment. All of it is kept by the extension in this browser, out of the site's reach; a picture is deleted with its comment. It leaves only when the person copies, saves or sends it, or turns on Share, Live or Save to GitHub. The developer receives none of it.
#### What user data do you plan to collect: Personally identifiable information
```text
Yes
```
_Why:_ The display name the person types is stamped on every comment and goes out with Copy, Save, Send to my agent, Share, Live and Save to GitHub. Share and Live also expose the network address to the servers and people involved. This happens only on the person's own action, or after they turn the add-on on.
#### What user data do you plan to collect: Personal communications
```text
Yes
```
_Why:_ With Share or Live on, comments written to other people are sent to them (encrypted for Share). With Voice on, the browser's own speech service may receive the person's dictated audio; Pipeup receives and keeps none. All are off by default.
#### What user data do you plan to collect: User activity
```text
Yes
```
_Why:_ With Live on, presence is sent to the others on the page: pointer position, selection and typing. Off by default, and nothing connects until the person agrees in Live's panel; that agreement is kept by the extension, so a page can't give it for them.
#### What user data do you plan to collect: Web history
```text
Yes
```
_Why:_ The extension keeps, in this browser, a list of pages commented on (address without query, title, time) and per-site settings for sites where Pipeup was started. A single page's full address goes with comments when the person sends them (Send to my agent, Save to GitHub, Markdown exports). Nothing goes to the developer.
#### What user data do you plan to collect: Authentication information
```text
No
```
_Why:_ No passwords or tokens for any service. The extension generates a signing key for comments; its seed is stored locally, shown by My identity only when the person asks, and never sent. GitHub sign-in happens on github.com.
#### What user data do you plan to collect: Health, Financial and payment, Location
```text
No
```
_Why:_ None is read or asked for (network addresses seen by Share and Live servers are covered above).
#### Certification: I do not sell or transfer user data to third parties, outside of the approved use cases
```text
Yes (certify)
```
_Why:_ Data goes only where the person sends it, as user-directed features: the clipboard, a file, a local program, a sharing address, relays and peers, github.com, or (for Voice) the browser's speech service.
#### Certification: I do not use or transfer user data for purposes unrelated to my item's single purpose
```text
Yes (certify)
```
_Why:_ Every transfer is a way of passing comments on.
#### Certification: I do not use or transfer user data to determine creditworthiness or for lending purposes
```text
Yes (certify)
```
#### Privacy Policy URL
```text
[privacy policy URL: maintainer to supply]
```
_Why:_ Required. It must refer to Microsoft Edge and cover: nothing goes to the developer, no telemetry; what the extension stores in this browser (comments with history, page list, name and key, settings, add-ons' choices, pictures); that nothing is written into the site's own storage and the page's scripts can't read Pipeup's comments, name or recovery code; what each route sends and to whom (Copy, Save, Send to my agent and its replies check after first use, Share, Live, Voice audio to the browser's speech service, Save to GitHub with what GitHub receives when its page opens); and how to delete (delete a comment and its picture, the Pictures switch, removing the extension, ~/.pipeup/browser). The draft in docs/store/privacy-policy.md needs those corrections first.
#### Mature content
```text
No (unchecked)
```
### Notes for the store's reviewer
```text
No account, login or server is needed to test Pipeup. Send to my agent needs macOS or Linux: on Windows it isn't offered, and its menu row and setup section aren't shown.

TRY IT IN TWO MINUTES
1. Install, then pin Pipeup from the Extensions (puzzle-piece) menu.
2. Open an ordinary page, for example https://example.com or any news article. (On a page that has Pipeup built in, the extension steps aside and says so.)
3. Press Pipeup in the toolbar (or Alt+Shift+P). The menu shows the page's address and Comment on this page, with Always on for this site below. Press Comment on this page.
4. Select some words on the page, or click a picture or a block. A comment box opens beside it with the cursor in it. Type "Can this be shorter?" and save it. A highlight and a pin mark the place; the toolbar button shows the count.
5. Press Pipeup again. The menu is now Pipeup's menu. Choose Copy comments > As Markdown and paste into any text field: the comment, the words it is about and the page address. Save comments > As a Markdown file saves where the browser saves downloads.
6. Press Comments: every comment on the page opens in a panel on the page. Turn on Keep comments beside the page, and Comments opens them in Edge's sidebar instead.
7. Right-click a picture and choose Comment with Pipeup: the comment box opens on that picture.
8. Right-click the toolbar button > Extension options (or Comments you've made at the bottom of the menu) opens the list of pages commented on and the settings: Show Pipeup's button on pages, Keep a picture of where each comment was made, the add-ons, and (on macOS and Linux) Send to my agent's setup command.
Pipeup's UI on the page is in a closed shadow root, so the page's scripts can't read it; DevTools still shows it.

WHAT THE SENSITIVE PERMISSIONS ARE FOR
- activeTab + scripting: the comment layer (pipeup/pipeup.esm.js, packaged) is injected only into the tab where the reviewer pressed the toolbar button, the shortcut or the right-click item, or on a site they set to Always on. When the menu opens on a page without Pipeup, a small packaged function checks whether the page already has Pipeup built in. tabs.captureVisibleTab (under activeTab) takes a small picture of where each new comment was made; it is cropped, kept in storage.local only, never sent, and removed when its comment is deleted.
- Optional host access (<all_urls>): nothing is granted at install. Only Always on for this site calls permissions.request, for that one origin (https://site/*), or for localhost, 127.0.0.1 and [::1] with Always on for local pages. The reviewer can decline. Turning the switch off unregisters the content script and removes the permission.
- nativeMessaging: Send to my agent passes the page's comments to a local program, ai.pipeup.browser, that the reviewer installs themselves. After Send to my agent has been used once, the toolbar menu also asks that program for agents' replies ({type:"replies", doc:<page id>}) while Pipeup is on in the tab. If the program is not installed, the call fails quietly. On Windows none of this is offered.
- storage: everything, including add-ons' choices such as Live's consent, is in chrome.storage.local; nothing is written into the site's own storage.
- unlimitedStorage: comments are kept as a growing history per page, with one picture per comment, on every page reviewed.
- clipboardWrite: Copy comments writes after an async request to the page for the comments, which can outlast the click's user activation.

SEND TO MY AGENT (OPTIONAL; NEEDS NODE.JS; MACOS OR LINUX ONLY)
1. Install Node.js.
2. Find Pipeup's ID on edge://extensions.
3. In a terminal, run the command the extension shows in Extension options, which is: npx --yes pipeup@[release version] browser install --browser edge --extension-id <ID>
   This writes ~/.pipeup/browser-host.sh, and ai.pipeup.browser.json in Microsoft Edge's NativeMessagingHosts folder.
4. Restart the browser, open a page with comments, and press Send to my agent. The comments appear in ~/.pipeup/browser/<page id>/. Read them with npx --yes pipeup@[release version] browser read, and answer with npx --yes pipeup@[release version] browser reply <page> --thread <id> "Done". Open the menu again and the reply shows in the thread.
Without the program, the row shows the setup command.

ADD-ONS
Extension options > Add-ons lists all six. Emoji is on by default and sends nothing. Voice, Share, Live, Save to GitHub and My identity are off. Changes apply the next time Pipeup starts on a page. Share and Live work only on pages that carry a Pipeup document identity: test page [maintainer to supply], sharing address [maintainer to supply]. Live connects nothing until the reviewer agrees in its panel. Save to GitHub: set a repository (owner/repo), write a comment that mentions a GitHub user, then choose Mention @name on GitHub in Pipeup's menu. A github.com new-issue page opens with the words, name, page title and address filled in, so GitHub receives them; GitHub's own sign-in applies, and nothing is filed unless it is submitted there.

SOURCE AND BUILD
The extension's own files (popup, panel, background, start, browser, comments) are unminified. pipeup/pipeup.esm.js and addons/*.esm.js are the project's own code, bundled and minified with esbuild (and terser for the core). There is no remote code, eval or third-party runtime code (the emoji table is data from emojibase, MIT). pipeup.esm.js is byte for byte the release file of pipeup@[release version] on npm; its SRI hash is [hash printed by the build]. build.json lists what this package holds. Source (MIT): https://github.com/pipeup-ai/pipeup , tag [release tag, maintainer to supply].
Rebuild:
  cd libs/ts/pipeup && npm ci && npm run build
  cd ../addons && npm ci && npm run build
  cd ../../.. && node tools/build-extension.mjs
The package is apps/extension/dist/pipeup-extension-[release version]-chromium.zip; the build prints the SRI hash of pipeup.esm.js.
```
### Screenshots
| # | Shows | Size | Caption |
|---|---|---|---|
| 1 | A fictional article page (for example 'Lumen: spring update', byline Sam) in Edge, toolbar menu open with Pipeup off: the page's address, Comment on this page and Always on for this site. | 1280x800 PNG | Press Pipeup and choose Comment on this page. |
| 2 | Same page with words selected and the comment box open beside them, cursor in it, Sam typing 'Can this be shorter?'; one earlier highlight and pin visible. | 1280x800 PNG | Point at words, a picture or a block, and write. |
| 3 | Keep comments beside the page on, with Comments in Edge's sidebar: three threads (Sam, Ada, Lee), one with a reply, one resolved; the matching place marked on the page. | 1280x800 PNG | Every comment on the page, beside it. |
| 4 | Toolbar menu with Pipeup on, taken on macOS (on Windows the Send to my agent row isn't shown): name 'Ada', Copy comments expanded (As Markdown, As text), Save comments, Send to my agent, Always on for this site. | 1280x800 PNG | Copy, save or send the comments to whoever asked. |
| 5 | Right-click menu on a picture in the page with Comment with Pipeup highlighted. | 1280x800 PNG | Right-click anything and comment on just that. |
| 6 | Comments you've made: a list of three fictional pages, then Settings (Keep a picture of where each comment was made, on) and the Add-ons list showing what each one sends. | 1280x800 PNG | Every page you've commented on, your settings and the add-ons. |

### Only the maintainer can supply
- Release first: bump off 0.9.1 and publish the next stable version (library, CLI with `pipeup browser`, add-ons) to npm, tag it, then build and list that version from the tag. Today npm's latest is 0.9.1, which has no browser command, and tag v0.9.1 contains no apps/extension. The extension's setup command names its own manifest version, which drops any pre-release suffix, so only a stable release makes it work. Replace every [release version] and [release tag] in the reviewer notes.
- Privacy policy page for Microsoft Edge on the website, and its URL. docs/store/privacy-policy.md is a draft but is out of date: it still says add-ons keep choices in the site's storage, that the page's scripts can read comments, and that a picture stays when its comment is deleted. Update it to match the Privacy Policy URL answer, then publish it.
- Support contact: confirm https://github.com/pipeup-ai/pipeup/issues or give an email address ([support contact: maintainer to supply]).
- Partner Center developer account in the Microsoft Edge program: a personal Microsoft account (or GitHub sign-in), Individual type, country or region, contact info, acceptance of the App Developer Agreement, and a publisher display name (proposed 'Pipeup', max 50 characters).
- Store art: a 300x300 logo (the build stops at 128 px), up to six 1280x800 screenshots taken in Edge on fictional pages (the Send to my agent shot on macOS, since Windows doesn't show it), and the optional 440x280 and 1400x560 tiles.
- A test page carrying a Pipeup document identity and a working sharing address, so reviewers can try Share and Live (policy 1.3).
- Check the Voice add-on in Edge: if Edge exposes only webkitSpeechRecognition, it shows the Safari and Apple texts (libs/ts/addons/voice/src/addon.ts:141). Choose those texts by detecting Safari instead.
- Decide whether to change the manifest 'description' to the proposed short description (needs a rebuilt package).
- Whether minified bundles are acceptable: ship unminified pipeup.esm.js and add-ons in the Edge package, or rely on the tag and SRI hash in the notes.
- Whether to narrow optional_host_permissions from <all_urls> to http/https, and whether to try use_dynamic_url for web_accessible_resources (any site can detect the extension today).
- Third-party notice: the shipped emoji data comes from emojibase-data (MIT), but the package has no LICENSE or notice; add one.
- Upload dist/pipeup-extension-[release version]-chromium.zip, never dist/chromium-test (it adds host_permissions <all_urls> and leaves Pipeup's UI open to the page). Microsoft signs the package on publish.
- Confirm against Partner Center's live form: the data-usage checkbox labels and the Category list are from memory, not Microsoft's docs.

## Firefox Add-ons (AMO)
### Listing fields
#### Name (max 50; name + summary should total 70 or less)
_6 characters. Name + summary = 68._
```text
Pipeup
```
#### Add-on URL (slug, max 30)
_6. If it's taken, use pipeup-comments._
```text
pipeup
```
#### Summary (max 250, no URLs)
_62 characters, no URL._
```text
Comment on web pages, then hand the comments to whoever asked.
```
#### Description (max 15000, limited Markdown)
_6,585 characters._
```text
Pipeup lets you comment on web pages and then hand those comments to the person or the AI agent who asked for your feedback.

**How it works**

1. Press Pipeup in the toolbar (or Alt+Shift+P) and choose **Comment on this page**.
2. Click a block, a picture or a spot on the page, or select some words, and write your comment. You can also right-click and choose **Comment with Pipeup**.
3. When you are done, open the toolbar menu again and choose how the comments go out: **Copy comments** (as Markdown or as text), **Save comments** (a Markdown file or a Pipeup file, saved to your downloads), or, on macOS and Linux, **Send to my agent**.

Comments can open beside what they are about, or sit in Firefox's sidebar if you choose **Keep comments beside the page**. **Comments you've made**, on the extension's options page, lists every page you have commented on. Pipeup is added to a page only when you choose Comment on this page or Comment with Pipeup there, or when you turn on **Always on for this site**, which starts it each time you open that site; Firefox asks you to allow that one site first. Firefox keeps some pages closed to add-ons, such as its own pages and addons.mozilla.org.

**Where your comments are kept**

- Comments, your display name, your choices and the add-ons' choices are kept by the extension, in this copy of Firefox. Nothing is written to the visited site's own storage. There is no account and no sign-in.
- Your display name and a signing key made in this browser are added to every comment you write, on every site. Comments you export or share from different sites can therefore be linked to the same person.
- When you start a comment, Pipeup also keeps a small picture of the visible page around it, so you can see where it was if the page changes. The picture stays in this browser and is never copied, saved, sent or shared. It includes whatever was on screen next to the comment. Pictures are on by default. Turning them off in the extension's settings deletes all kept pictures, and deleting a comment deletes its picture.
- Editing or deleting a comment keeps the earlier text in the extension's record of the page. That record, with the earlier text, is included in a saved Pipeup file, in Send to my agent, and in Share and Live if you turn them on.
- There is no button yet to delete kept comments. Removing the extension removes everything it keeps, but not Send to my agent's folder on your computer.
- The page's own scripts can't read Pipeup's interface: not the comments shown or typed there, your name, or a recovery code. Nor can they read the extension's storage or set the add-ons' choices. What you type into Pipeup's boxes is typed in the extension's own frame, so the page can't see the words or the keys pressed.

**What leaves your browser, and when**

The extension has no analytics or telemetry and loads no code from the web. With the add-ons that are off by default left off, comments leave Firefox only when you copy them, save them, or press Send to my agent. Before Send to my agent first sends anything, and before Share, Live or Save to GitHub is turned on, Firefox asks you to allow the extension to send data; if you decline, that feature stays off.

- **Copy comments** puts them on your clipboard. **Save comments** writes a file to your downloads folder.
- **Send to my agent** (optional, macOS and Linux only) gives the page's comments, its full address and its title to a program on your own computer, through Firefox's native messaging. It needs a free, open-source helper you install once with one command, which the menu shows. The helper writes the comments to a folder on your computer for your agents, and passes their replies back into the threads. Once you have used Send to my agent, Pipeup also asks that helper for new replies after most actions in the toolbar menu on a page where Pipeup is on; it sends only the page's comment id, which is made from the page's address. Removing the extension does not remove the helper or its folder.

**Add-ons, which you turn on in the extension's settings**

- **Emoji** (on by default): an emoji picker. It sends nothing. The extension remembers your recent emoji and skin tone.
- **Share** (off): sends your comments, encrypted, over HTTPS to a sharing server, so others on the same page can see them. It works only on pages built for it. Once on, your new comments are sent automatically. The server is the sharing address you set; a page can't choose it, and without one Share stays off. The server sees your IP address and when and how much you send.
- **Live** (off): connects you with others on the same page, after you choose Go live. It works only on pages built for it. It uses public Nostr relays (relay.damus.io, nos.lol, relay.primal.net, or relays the page names) and STUN servers (stun.l.google.com, stun.cloudflare.com) to connect, then sends the page's comments, your name and where your pointer is directly to the other people. Relays, STUN servers and the other people see your IP address. Your Go live choice is kept by the extension, so a page can't make it for you.
- **Save to GitHub** (off): when a comment mentions someone on GitHub, it can open a new GitHub issue page with the comment, your name, the page title and the full page address in its link. GitHub receives that text when the tab opens; nothing is filed until you submit it there. The repository is the one you set; a page can't choose it. Pipeup keeps no GitHub sign-in.
- **My identity** (off): shows a recovery code for your Pipeup identity so you can copy it, save it or restore it in another browser. It sends nothing. Anyone with the code can write comments as you.

Voice, which Pipeup offers in other browsers, is not included in Firefox, because Firefox can't turn speech into text.

**Permissions**

- Access to the current tab when you press Pipeup, its shortcut or its right-click item. Installing asks for no access to sites.
- Access to a site you choose for Always on for this site, asked for when you turn it on and removed when you turn it off.
- Storage, including unlimited storage, for comments and pictures kept in this browser.
- Clipboard (write only), for Copy comments. Right-click menu, for Comment with Pipeup.
- Exchange messages with programs other than Firefox, for Send to my agent.
- Optional data sending (website content, browsing activity, personal communications, personally identifying information), asked for only when you first use Send to my agent or turn on Share, Live or Save to GitHub.

Pipeup is free and open source under the MIT licence. Source: https://github.com/pipeup-ai/pipeup
```
#### This add-on is experimental
_A stable release._
```text
Unticked
```
#### This add-on requires payment, non-free services or software, or additional hardware
_The helper is free, open source and optional._
```text
Unticked
```
#### Categories (pick 1-2)
```text
Social & Communication; Web Development
```
#### Tags (from AMO's fixed list, max 10)
```text
Leave empty
```
#### Support email (max 100)
_A monitored address you can publish (section 8.1)._
```text
[support contact: maintainer to supply]
```
#### Support website (max 255)
```text
https://github.com/pipeup-ai/pipeup/issues
```
#### Homepage (max 255; set when editing the listing)
```text
https://pipeup-ai.github.io/pipeup/
```
#### License
_Predefined (slug MIT)._
```text
MIT License
```
#### This add-on has a privacy policy (checkbox) + policy text (Markdown, max 150000)
_The policy is 4,619 characters._
```text
Ticked. Policy text:

# Pipeup privacy policy

Pipeup is a free, open-source add-on for commenting on web pages. It has no account, no server of its own, no analytics and no telemetry. This policy says what it keeps, what leaves your browser, and when.

## What Pipeup keeps in your browser

Everything below is kept by the extension, in this copy of Firefox. Nothing is written to the visited site's own storage.

- **Your comments**, page by page: the words you write, your display name, the time, and a note of where on the page each comment is (the words you chose with the text around them, what the element is and is called, which can be a link address or a picture's file name, and the headings above it). Edits and deletes are added to this record; the earlier text stays in it.
- **A list of pages you commented on**: each page's address (without the part after ? or #), its title and when its comments last changed.
- **Your choices for each site where you started Pipeup** (look, Hide comments), which also amounts to a list of those sites, and the sites you set to Always on.
- **Your Pipeup identity**: your display name and a signing key made in your browser. The same key signs your comments on every site, so comments you export or share from different sites can be linked to you.
- **Pictures of where comments were made**: a small picture of the visible page around each comment you start. On by default. Turning pictures off deletes them all, and deleting a comment deletes its picture.
- **Your settings**: add-ons turned on, a sharing address and GitHub repository if you set them, whether you have used Send to my agent, and which agent replies were already added.
- **The add-ons' own choices**: Emoji's recent emoji and skin tone; Share's record of which comments were shared; Live's Go live choice for each page.

There is no button yet to delete all of this. Removing the extension removes it.

## What the site can see

The page's own scripts can't read Pipeup's interface (the comments shown or typed there, your name, a recovery code), the extension's storage, or comments kept for other pages, and can't set the add-ons' choices. What you type into Pipeup's boxes is typed in the extension's own frame, so the page can't see the words or the keys pressed. If you leave the sharing address or GitHub repository empty, a page can name its own, and it can name Live's relays.

## What leaves your browser

Nothing leaves your browser except in these cases. Before Send to my agent first sends anything, and before Share, Live or Save to GitHub is turned on, Firefox asks you to allow the extension to send data. If you decline, that feature stays off.

- **Copy comments**: to your clipboard.
- **Save comments**: a file in your downloads folder. A Pipeup file includes edited and deleted text.
- **Send to my agent** (macOS and Linux): when you press it, the page's comments (including edited and deleted text), its full address and its title go to a program on your own computer, through Firefox's native messaging, and are written to a folder there for your agents. You install that program yourself; it is optional. Once you have used it, Pipeup also asks that program for replies after most actions in the toolbar menu on a page where Pipeup is on, sending only the page's comment id, which is made from the page's address. The extension sends nothing over the internet by this route. Removing the extension does not remove the program or its folder.
- **Share** (add-on, off by default): your comments, including edited and deleted text, encrypted, go over HTTPS to the sharing server you set (a page can't choose it). Once on, new comments are sent automatically. The server sees your IP address and when and how much you send.
- **Live** (add-on, off by default, and only after you choose Go live): connection messages go through public Nostr relays (relay.damus.io, nos.lol, relay.primal.net, or relays the page names) and STUN servers (stun.l.google.com, stun.cloudflare.com). The page's comments (including edited and deleted text), your name and your pointer's place go directly to the other people on the page. All of them see your IP address.
- **Save to GitHub** (add-on, off by default): when you choose it, it opens github.com with the comment, your name, the page title and its full address in the link. GitHub receives them when the page opens; nothing is filed until you submit it there. GitHub's own privacy policy applies there.

The pictures of where comments were made are never sent, copied or shared.

## Contact

[support contact: maintainer to supply], or https://github.com/pipeup-ai/pipeup/issues

Last updated: [date: maintainer to supply]
```
#### EULA
```text
Leave empty
```
#### Notes for Reviewers (max 3000, Mozilla only)
_2,909 characters. Fill in [release version], the Node version and the test page, and keep the total at 3,000 or below. The tag must contain apps/extension._
```text
No account needed. To try it:
1. Open https://example.com (not the Pipeup website, which has Pipeup built in).
2. Press Pipeup in the toolbar (or Alt+Shift+P). The menu shows the page address. Choose Comment on this page.
3. Click the paragraph, type "Check this sentence" and press Enter. The badge shows 1.
4. Press Pipeup again: Copy comments > As Markdown, or Save comments (.md). The options page lists the page under Comments you've made.
5. Right-click a word > Comment with Pipeup opens a comment box on it.
Share and Live work only on pages whose HTML sets data-pipeup-doc; test page: [test page: maintainer to supply]. Share, Live, Save to GitHub and Send to my agent call permissions.request({data_collection}) first; declined, they stay off. Voice is not in the Firefox package.

Permissions:
- activeTab + scripting: inject start.js into the tab the user pressed Pipeup on. The menu checks for a built-in Pipeup. UI is in a closed shadow root; comment text is rendered as text only. Add-on state: storage.local only.
- optional_host_permissions <all_urls>: never at install; one http(s) origin (or localhost) requested when the user turns on Always on, removed when off.
- tabs.captureVisibleTab (under activeTab): a small picture around each new comment, kept in storage.local only, never sent.
- storage + unlimitedStorage: comments (append-only log per page) and pictures, local.
- clipboardWrite: Copy writes after an async round trip to the tab, which can outlast user activation.
- contextMenus: Comment with Pipeup.
- nativeMessaging: Send to my agent (macOS, Linux; hidden on Windows). Host ai.pipeup.browser, installed by the user with `npx --yes pipeup@[release version] browser install --browser firefox` (source libs/ts/pipeup/cli). Messages: {type:'send', doc, url, title, markdown, file} on the press; {type:'replies', doc} after most toolbar actions, only once send was used.
- web_accessible_resources pipeup/*, addons/*: start.js import()s them by runtime.getURL.
No remote code, no eval, no analytics. Fetches read only a picture's data: URL and build.json. Network code is only in the off-by-default Share, Live and Save to GitHub add-ons.
web-ext lint may warn on sidePanel.open (Chrome branch, feature-checked) and openDialog (Pipeup's own host.openDialog).

Source: https://github.com/pipeup-ai/pipeup, tag v[release version], also attached. pipeup/pipeup.esm.js and addons/*.esm.js are minified (esbuild + terser + property mangling; not obfuscated). Rebuild from the repo root:
cd libs/ts/pipeup && npm ci && npm run build
cd ../addons && npm ci && npm run build
cd ../../.. && node tools/build-extension.mjs
Needs Node [Node version] and the zip CLI. Output: apps/extension/dist/firefox. Root *.js, *.html, *.css are unminified.
No third-party code at run time. The emoji table (libs/ts/addons/emoji/src/data.ts) was generated from emojibase-data (MIT) [confirm version].
```
#### Release notes ([release version], the first release whose tag contains apps/extension, max 3000)
_415 characters._
```text
First release on Firefox Add-ons. Comment on web pages from the toolbar, the shortcut Alt+Shift+P or the right-click menu; Copy comments, Save comments and, on macOS and Linux, Send to my agent; comments kept beside the page in Firefox's sidebar; Always on for this site; add-ons Emoji (on), Share, Live, Save to GitHub and My identity (off). Firefox asks before anything is sent. Voice is not available in Firefox.
```
#### Additional details (developer comments, max 3000)
_251 characters._
```text
Pipeup is also a JavaScript library that page authors can add to their own pages. On a page that already has Pipeup built in, the add-on steps aside and the page's own copy is used. Questions and bug reports: https://github.com/pipeup-ai/pipeup/issues
```
#### Default locale
_British spelling (licence)._
```text
en-GB if AMO offers it, otherwise en-US
```
#### Contributions URL
```text
Leave empty
```
#### Compatible platforms (upload step)
_Firefox for Android lacks sidebar_action, commands, menus and native messaging. docs/EXTENSION_SPEC.md section 2 puts Firefox on Android later; desktop only now._
```text
Firefox (desktop) only
```
#### Source code question (upload step)
_Upload a git archive of tag v[release version]; v0.9.1 does not contain apps/extension. Include the lockfiles for libs/ts/pipeup, libs/ts/addons and apps/extension, plus a short reviewer README with the same commands as the Notes._
```text
Yes. Upload a git archive of the release tag that contains apps/extension.
```
### Permission justifications
#### activeTab
```text
When you press Pipeup in the toolbar, its shortcut Alt+Shift+P, or Comment with Pipeup in the right-click menu, Pipeup gets access to that one tab. It uses that access to show the page's address in its menu, to add Pipeup when you choose Comment on this page or Comment with Pipeup, and to take the small picture of where a comment was made. The access ends when the tab goes to another page. Because of this, installing asks for no access to sites.
```
#### scripting
```text
Adds Pipeup's script (start.js) to the tab when you choose Comment on this page or Comment with Pipeup. The script runs in the extension's isolated world, draws its interface in a closed shadow root that the page's scripts can't read, and shows comment text as text only. When the menu opens, a small function checks whether the page already has Pipeup built in, so the extension can step aside there. When you turn on Always on for this site, or Always on for local pages, it registers the script for that site; turning the switch off removes it.
```
#### storage
```text
Keeps the extension's data in this browser: comments for each page, the list in Comments you've made, your display name and signing key, your choices for each site, your settings, the add-ons' own choices (such as Live's Go live choice and Emoji's recent emoji), and the pictures of where comments were made. Nothing is written to the visited site's storage. The extension itself keeps nothing on a server. Share, an add-on that is off by default, sends comments to a sharing server when you turn it on.
```
#### unlimitedStorage
```text
Each page's comments are kept as a record that only grows. Each new comment you start also keeps a small picture (JPEG, at most 480 px wide) of where it was made. Across many pages, this permission keeps that local data from running into a storage quota that would make saving comments fail. Deleting a comment deletes its picture, and turning pictures off deletes them all.
```
#### clipboardWrite
```text
Used by Copy comments (as Markdown or as text) in the toolbar menu, Copy in Pipeup's own menu on the page, the Copy button beside the Send to my agent setup command, and My identity's Copy. Copy comments first fetches the comments from the tab and only then writes them, which can happen after the click's user activation has run out. Every clipboard write follows a click.
```
#### contextMenus
```text
Adds Comment with Pipeup to the right-click menu, on selected words, a picture, a link or the page. Choosing it adds Pipeup to the tab and opens a comment box on what you right-clicked.
```
#### nativeMessaging
```text
Used by Send to my agent, which is optional and offered on macOS and Linux only. When you press it, Firefox first asks you to allow the extension to send data; then the page's comments, full address and title go to a program on your own computer (native host ai.pipeup.browser). You install that program once with npx --yes pipeup@[release version] browser install --browser firefox, and it is open source (libs/ts/pipeup/cli in the repository). It writes the comments to a local folder for your agents and returns their replies, which Pipeup adds to the threads. Once you have used Send to my agent, Pipeup asks the program for new replies after most toolbar-menu actions while Pipeup is on, sending only the page's comment id, which is made from the page's address. The extension sends nothing over the internet by this route.
```
#### optional_host_permissions: <all_urls>
```text
Nothing is granted at install. When you turn on Always on for this site, Pipeup asks Firefox for access to that one site (for example https://example.com/*). On a local page, Always on for local pages asks for http://localhost, http://127.0.0.1 and http://[::1]. With that access, Pipeup starts each time you open the site, without a press. Turning the switch off removes the access. Only http and https sites are ever requested, so the declaration could be narrowed to http://*/* and https://*/*.
```
#### tabs.captureVisibleTab (covered by activeTab, no separate permission)
```text
After you start a comment, Pipeup takes a picture of the visible tab, cut to the comment's place plus a small margin. It is stored only in this browser and shown only to you, in the sidebar, when a comment's place can no longer be found on the page. It is never copied, saved, sent or shared. Deleting the comment deletes its picture, and turning pictures off deletes them all.
```
#### web_accessible_resources: pipeup/*, addons/* for <all_urls>
```text
The script added to the page loads Pipeup (pipeup/pipeup.esm.js) and any add-ons you turned on (addons/<id>.esm.js) as ES modules with import(runtime.getURL(...)). You can comment on any site, so the files must be loadable on any site. They are the extension's own bundled files; nothing is fetched from the web.
```
#### commands: _execute_action (Alt+Shift+P)
```text
A keyboard shortcut that opens Pipeup's toolbar menu for the current page, the same as pressing the toolbar button. It is not a permission and has no code of its own.
```
#### sidebar_action (manifest key, no permission)
```text
When you choose Keep comments beside the page, Firefox's sidebar lists the comments on the current tab, with Reply, Resolve, Edit and Delete. It does not open at install (open_at_install is false). It follows the active tab and gets the comments from Pipeup running in that tab, so it needs no tabs permission.
```
#### options_ui (comments.html)
```text
The extension's options page, which is also Comments you've made. It lists the pages you have commented on and holds the settings: pictures on or off, Show Pipeup's button on pages, the add-ons in this package (Emoji, Share, Live, Save to GitHub, My identity), the sharing address, the GitHub repository, and, on macOS and Linux, the Send to my agent setup command.
```
#### browser_specific_settings.gecko (id extension@pipeup.ai, strict_min_version, data_collection_permissions)
```text
The add-on ID, the minimum Firefox version (140.0) and the data-collection declaration: required ['none'], since the extension sends nothing by itself; optional ['websiteContent', 'browsingActivity', 'personalCommunications', 'personallyIdentifyingInfo']. The extension requests the optional types with permissions.request({data_collection}) when you turn on Share, Live or Save to GitHub, and when you press Send to my agent before it sends. If you decline, the feature stays off.
```
### Privacy and data-use answers
#### This add-on has a privacy policy (checkbox), then the policy text
```text
Yes. Tick it and paste the policy text from the listing. Optionally, also host it on the website and link to it.
```
_Why:_ Data leaves the device through Send to my agent (to a native app) and through the Share, Live and Save to GitHub add-ons. The submission guide requires a policy whenever any data is sent.
#### Data collection declaration (manifest gecko.data_collection_permissions; shown on the install prompt)
```text
Declared in the manifest: required ['none']; optional ['websiteContent', 'browsingActivity', 'personalCommunications', 'personallyIdentifyingInfo']. Requested with permissions.request({data_collection}) before Share, Live or Save to GitHub is turned on and before Send to my agent sends; declined, the feature stays off. strict_min_version is 140.0, so Firefox's built-in consent applies.
```
_Why:_ Policy 6.2.1 requires an accurate declaration, and section 6 covers native apps. The extension's own code makes no network requests, so 'none' is right for what is required. Share sends comments (websiteContent, personalCommunications), the page address (browsingActivity) and your name (personallyIdentifyingInfo) once it is on. Live sends the comment log, your name and your pointer position to peers. Save to GitHub puts the comment, name, title and full URL into a github.com URL. Send to my agent passes the full URL and all comments to the native host. websiteActivity is not declared; Live's pointer position may be read as that type.
#### What is stored on the device
```text
On the device, in the extension's storage only: comments with their full edit history; the list of pages commented on (address without query or fragment, title, time); per-site choices, which also list the sites where Pipeup was started; the Always-on sites; the display name and the signing key (unencrypted); settings, including the sharing address, GitHub repository and whether Send to my agent was used; the add-ons' own choices (Emoji's recent emoji and skin tone, Share's record, Live's Go live choice); and pictures of the visible tab around each comment you start. Nothing in the visited site's storage. With Send to my agent, in ~/.pipeup/browser: page.json, comments.md, comments.json and replies.json.
```
_Why:_ The policy text lists each of these. Removing the extension removes all but the helper's folder.
#### Requires payment, non-free services or software, or additional hardware (checkbox)
```text
No
```
_Why:_ Everything is free. Send to my agent's helper is free, open source and optional, and the description says so.
#### Does the add-on load remote code?
```text
No (a policy, not a form question)
```
_Why:_ It imports only its own packaged files with runtime.getURL. There is no eval, new Function, WebAssembly or remote script, and no update_url. The Firefox package holds the Emoji, Share, Live, Save to GitHub and My identity add-ons only.
#### Analytics or telemetry?
```text
None
```
_Why:_ There is no XHR, sendBeacon, WebSocket or network fetch in the extension scripts or the core library. The only fetches read the picture's own data: URL and the package's build.json. Network code exists only in the off-by-default Share, Live and Save to GitHub add-ons.
### Notes for the store's reviewer
```text
Paste the Notes for Reviewers text from the listing. In short:
- **Try it, no account:** open https://example.com, press Pipeup (or Alt+Shift+P), choose Comment on this page, click the paragraph, type a comment and press Enter; the badge shows 1. Press Pipeup again and choose Copy comments > As Markdown, or Save comments. The options page lists the page under Comments you've made. Right-click a word > Comment with Pipeup.
- **Share and Live** need a page whose HTML sets data-pipeup-doc; give reviewers a test page. Turning them on (or Save to GitHub) shows Firefox's data-sending prompt.
- **Permissions:** activeTab + scripting inject start.js on a press; the UI is in a closed shadow root. Optional host access is requested for one site when Always on is turned on, and removed when it is turned off. captureVisibleTab keeps a picture locally only. clipboardWrite covers a copy after an async round trip. contextMenus is for Comment with Pipeup. web_accessible_resources are the add-on's own ES modules.
- **Send to my agent** (macOS, Linux): nativeMessaging to ai.pipeup.browser, installed with `npx --yes pipeup@[release version] browser install --browser firefox` (source libs/ts/pipeup/cli). It sends {type:'send'} on the press, after Firefox's data prompt, and {type:'replies', doc} after most toolbar actions once it has been used.
- **Source and rebuild:** attach a git archive of tag v[release version] (v0.9.1 does not contain apps/extension). Run npm ci and npm run build in libs/ts/pipeup, then in libs/ts/addons, then node tools/build-extension.mjs (needs the zip CLI; it stops if an add-on isn't built). Compare the result with apps/extension/dist/firefox.
- **Third-party:** the committed emoji table was generated from emojibase-data (MIT).

Before submitting:
- Run web-ext lint on the release build and check the Notes still match its warnings.
- Test that the rebuild is byte-identical on Linux, and state the Node version used.
- Upload pipeup-extension-[release version]-firefox.zip, never the dist/firefox-test folder.
```
### Screenshots
| # | Shows | Size | Caption |
|---|---|---|---|
| 1 | 1. A comment on a page. An ordinary article page (fictional site, light mode), with a block highlighted and an open comment from 'Sam' beside it, plus one reply from 'Ada'. The toolbar button shows its count. | 1600x1200 PNG (4:3) | Press Pipeup and choose Comment on this page, then point at words, a picture or a spot and write. |
| 2 | 2. The toolbar menu with Pipeup on: the page address at the top, the name 'Lee', Copy comments, Save comments, Send to my agent, Theme, Comments with its count, Keep comments beside the page, Hide comments, Start commenting, Always on for this site, and Turn off on this page. | 1600x1200 PNG (4:3) | The toolbar menu: copy or save the comments, or send them to your agent. |
| 3 | 3. Comments in Firefox's sidebar. Keep comments beside the page is on. The sidebar lists the threads with the @ For you and Resolved filters, and one thread is open with Reply and Resolve. | 1600x1200 PNG (4:3) | Keep comments beside the page: the page's comments in Firefox's sidebar. |
| 4 | 4. The right-click menu on a picture, with 'Comment with Pipeup' highlighted. | 1600x1200 PNG (4:3) | Right-click words, a picture or a link and choose Comment with Pipeup. |
| 5 | 5. Copy comments > As Markdown, with the copied Markdown shown in a plain text editor beside the page (fictional page and names). | 1600x1200 PNG (4:3) | Copy comments as Markdown and paste them wherever the person or agent who asked will read them. |
| 6 | 6. The options page. Comments you've made lists three fictional pages, newest first. The settings show Keep a picture of where each comment was made (on), Show Pipeup's button on pages (off), and the add-ons Emoji (on), Share, Live, Save to GitHub and My identity (off). | 1600x1200 PNG (4:3) | Comments you've made lists every page you commented on. Add-ons are off until you turn them on, except Emoji. |
| 7 | 7. Always on for this site, at the moment Firefox asks to allow access to that one site. | 1600x1200 PNG (4:3) | Always on for this site asks Firefox for that one site only. |
| 8 | 8. Firefox's prompt asking to allow the extension to send data, shown as Share is turned on in the options page. | 1600x1200 PNG (4:3) | Firefox asks before Pipeup sends anything, and the feature stays off if you decline. |

### Only the maintainer can supply
- The release: an npm version of pipeup, [release version], that includes the `pipeup browser` command (the setup command names it as pipeup@[release version], taken from the extension's version), tagged v[release version] with apps/extension in the tag. Build the Firefox zip from that tag, and attach the tag's source archive with its lockfiles.
- The Node and npm versions the rebuild was checked with, for the Notes, and a check that the rebuild is byte-identical on Linux.
- A page with data-pipeup-doc (and a sharing address) that reviewers can use to try Share and Live, for the Notes.
- A support email you can publish and will monitor, to replace '[support contact: maintainer to supply]' in the listing and the policy. Keep the account email monitored for review messages.
- The privacy policy's 'Last updated' date, and optionally a hosted copy on the website.
- A Mozilla account with two-step sign-in on (a 6-digit authenticator), with the recovery codes kept. Accept the Add-on Policies and the Distribution Agreement; both change on 1 Dec 2026. Add co-maintainers as Authors.
- The screenshots at 1600x1200 (4:3), in light mode, with fictional pages and the names Sam, Ada and Lee.
- Confirm the emojibase-data version libs/ts/addons/emoji/src/data.ts was generated from, for the Notes, and consider shipping its MIT notice.
- Uploading, answering reviewers and publishing are the maintainer's call. AMO signs the add-on after review.

## Safari (Mac App Store)
### Listing fields
#### New App dialog: Platforms
_Add iOS later for iPhone and iPad. That needs the converter run again with --rebuild-project._
```text
macOS
```
#### Name (max 30)
_22 characters. Plain "Pipeup" (6) also works. Don't put Safari in the name (2.3.7 / 5.2.4)._
```text
Pipeup – Page Comments
```
#### Subtitle (max 30)
_23 characters._
```text
Comment on any web page
```
#### Bundle ID
_Register both under the team before the first upload. It can't change after a build is uploaded._
```text
ai.pipeup.Pipeup (extension: ai.pipeup.Pipeup.Extension)
```
#### SKU
_Internal only, and it can't change later._
```text
pipeup-mac-safari
```
#### User Access
```text
Full Access
```
#### Primary Language
_Matches the project's British spelling. Use English (U.S.) only if the maintainer prefers it._
```text
English (U.K.)
```
#### Primary Category
_Set LSApplicationCategoryType = public.app-category.productivity in Xcode so the two match._
```text
Productivity
```
#### Secondary Category
_Developer Tools is the alternative._
```text
Safari Extensions
```
#### Content Rights
_Pipeup works on web pages that the user opens, and it bundles emoji data from emojibase-data (MIT, from Unicode data). The packed Emoji add-on carries no licence notice, so add the emojibase MIT notice to the app's About or licences screen before submitting._
```text
Yes, it contains, shows or accesses third-party content, and I have the necessary rights.
```
#### Age Rating questionnaire
_If Share or Live is ever added to the app, User-Generated Content becomes Yes and guideline 1.2 applies: a way to hide or block a commenter, a way to report content, and published contact details._
```text
All content descriptors: None. Parental Controls: No. Age Assurance: No. Unrestricted Web Access: No (Safari does the browsing; Pipeup doesn't open or browse sites itself). User-Generated Content: No (Share and Live are not in the app, so the user sees only their own comments). Social Media: No. Messaging and Chat: No. Advertising: No. Expected rating: 4+.
```
#### Made for Kids
```text
Off
```
#### License Agreement
_MIT covers the source code. The description and the app's About screen mention it._
```text
Apple's standard EULA
```
#### Privacy Policy URL
_Returns 404 today and must be published first. It must cover: what the extension keeps, all in its own storage in Safari on this Mac (comments with their history, the list of pages, display name and signing key, per-site choices, settings, and add-ons' choices such as Voice's settings and Emoji's recent emoji and skin tone); that nothing is written to the site's own storage and the page's scripts can't read comments, names or recovery codes; that Save to GitHub puts the comment's words, the person's GitHub name, the user's name, the page title and its address in a github.com address, which GitHub receives when its new-issue page opens, and that nothing is filed until the user submits it there; that Voice uses Apple's speech recognition; that edited and deleted words stay in the history and in saved Pipeup files; how to delete everything (remove the app); that no data reaches the developer; and a contact. It must also be linked from inside the app._
```text
https://pipeup-ai.github.io/pipeup/privacy/
```
#### Privacy Choices URL
```text
(leave empty)
```
#### Promotional Text (max 170)
_159 characters._
```text
Comment on the words, pictures and parts of any web page in Safari. Then copy or save your comments for the person or the AI agent who asked for your feedback.
```
#### Description (max 4000)
_3,147 characters. It names no other browser or platform, and leaves out what the app doesn't have (Send to my agent, the panel beside the page, Share, Live, pictures of where comments were made)._
```text
Pipeup lets you comment on any web page you open in Safari, and hand those comments to the person or the AI agent who asked for your feedback.

This Mac app contains the Pipeup extension for Safari. The app shows you how to turn it on: open Pipeup, then choose Pipeup in Safari Settings > Extensions. The extension does the work; the app is where you set it up and find help.

HOW IT WORKS
1. On the page you want to review, press Pipeup in Safari's toolbar (or Option-Shift-P). The menu shows the page's address.
2. Choose Comment on this page. Safari may ask whether Pipeup may use this site.
3. Select some words, or click a picture, a block or a point on the page. A comment box opens beside it with the cursor in it. Type and press Return.
4. Comments show as small marks on the page. Click one to read it, reply, edit, delete or resolve it.

You can also right-click words, a picture or a link and choose Comment with Pipeup.

GETTING COMMENTS TO WHOEVER ASKED
- Copy comments: as Markdown (written for an AI agent to read) or as plain text.
- Save comments: as a Markdown file, or as a Pipeup file that holds every comment with its history.
- Comments you've made: a list of every page you have commented on, newest first.

Each comment says what it is about: the words you chose, or what the picture or block is and what it is called. So an agent or a colleague can find the place without your page open.

KEEPING IT ON A SITE
Pipeup is added to a page only when you ask. Installing it gives it no access to any site. If you review one site often, turn on Always on for this site, and Safari asks your permission for that site only. Turn it off in the same menu.

ADD-ONS
Turn add-ons on or off on the Comments you've made page.
- Emoji (on): an emoji picker for your comments.
- Voice (off): dictate a comment. Safari asks before using the microphone, and Apple's speech recognition does the listening, on your Mac or on Apple's service depending on the language.
- Save to GitHub (off): when a comment mentions someone by their GitHub name, Pipeup's menu offers to open GitHub's new-issue page in Safari, filled in with their name, your name, the comment, the page title and its address. GitHub receives these as soon as that page opens. Nothing is filed until you submit it there.
- My identity (off): shows a recovery code so you can keep the same name and identity on another Mac.

PRIVACY
- Your comments, your name and your add-ons' choices are kept by the extension, in Safari on this Mac. Nothing is written to the site's own storage, and the page's own scripts can't read your comments, your name or a recovery code.
- Pipeup has no account, no server of its own and no analytics, and loads no code from the web.
- Comments leave this Mac only when you copy or save them, or open a GitHub page with Save to GitHub, as described above. With Voice, your voice may go to Apple's speech recognition.
- Editing or deleting a comment keeps the earlier words in that page's history, which is included when you save a Pipeup file.

Pipeup is open source under the MIT licence. Source code, the privacy policy and help are on the website.
```
#### Keywords (max 100 bytes)
_87 bytes. It doesn't repeat the app name or name any company._
```text
annotate,feedback,review,markup,notes,web page,website,proofread,design review,critique
```
#### Support URL
_Not published yet. It needs [support contact: maintainer to supply] (an email address, plus a postal address and phone number where local law requires them) and a link to https://github.com/pipeup-ai/pipeup/issues._
```text
https://pipeup-ai.github.io/pipeup/support/
```
#### Marketing URL
_The website names other browsers, which App Review may see. Consider a Safari-only landing page, or accept the small risk._
```text
https://pipeup-ai.github.io/pipeup/
```
#### Version Number
_The Pipeup release this app ships, the same as the extension's manifest and npm. It must match MARKETING_VERSION / CFBundleShortVersionString in the archived build: the project file says 1.0, and only the build command sets the release's version._
```text
[release version]
```
#### Copyright
_Matches LICENSE. App Store Connect adds the ©. Also set NSHumanReadableCopyright in the app._
```text
2026 Pipeup contributors
```
#### What's New in This Version
```text
(not shown for the first version; leave empty)
```
#### App Review Information: Contact
```text
First name, last name, email and phone: [maintainer to supply; phone in +country-code format]
```
#### App Review Information: Sign-in required
```text
Off. No account is needed.
```
#### App Review Information: Notes (max 4000 bytes)
```text
See reviewerNotes (3,829 bytes, under the limit).
```
#### App Review Information: Attachment
_Whether this field exists wasn't confirmed today._
```text
Optional: a 30-second screen recording of steps 1 to 5 of the notes, in Safari on example.com.
```
#### Version Release
_Lets the maintainer line the release up with the website._
```text
Manually release this version
```
#### Pricing and Availability
```text
Price: Free (USD 0, tier 0). Availability: all countries and regions, or all except the EU if the DSA trader status isn't declared yet. Tax category: the default for software apps.
```
#### Digital Services Act trader status
_This is the maintainer's legal call. If they declare trader, their address, phone and email are shown on EU product pages._
```text
Non-trader (a free, non-commercial, open-source project)
```
#### Export compliance (encryption)
_The app uses only OS-provided HTTPS. All other cryptography runs through Safari's own Web Crypto: comments are signed with Ed25519 (authentication), and a saved Pipeup file is sealed with AES-GCM only when the page's author has given the page a document key. Share and Live, which send sealed comments, are not in the app. The maintainer should confirm the exemption. If unsure, answer the per-build questionnaire instead of setting the key._
```text
Set ITSAppUsesNonExemptEncryption = NO in the app target.
```
#### Accessibility (Accessibility URL / Support)
```text
Leave empty unless App Store Connect requires it. If it is required, answer only for what has been tested in Safari with VoiceOver and keyboard alone.
```
#### Developer name
```text
(not settable on an Individual account: the maintainer's legal name is shown)
```
### Permission justifications
#### activeTab
```text
When the user presses Pipeup in the toolbar, presses Option-Shift-P or chooses Comment with Pipeup from the right-click menu, Pipeup gets access to that one tab only. That press lets it show the page's address in the menu, use the title to name a saved file and add Pipeup to the page. The access ends when the tab goes to another page. This is why the extension needs no access to any site when it is installed.
```
#### scripting
```text
Adds Pipeup's bundled script to the tab when the user chooses Comment on this page or Comment with Pipeup. Each time the menu opens on a page where Pipeup isn't running, it checks whether the page already has Pipeup built in, and if so the extension steps aside. Only after the user turns on Always on for this site (or Always on for local pages) does it register the script for that site, so Pipeup starts there without a press. Turning the switch off unregisters it.
```
#### storage
```text
Keeps the user's comments for each page (with each comment's history), the list of pages commented on, the display name and signing key, per-site choices (look, Hide comments), settings and add-on switches, and add-ons' own choices (Voice's settings, Emoji's recent emoji and skin tone). All of it stays in the extension's storage in Safari on this Mac; nothing is written to the site's storage. None of it is sent to the developer.
```
#### unlimitedStorage
```text
Comments and their history build up over every page reviewed and are never trimmed automatically. Without this, Safari's quota for extension storage could make saving a comment fail.
```
#### clipboardWrite
```text
Copy comments (As Markdown, As text) writes the page's comments to the clipboard. The copy happens only after the menu has asked the page for its comments, and that can take longer than the click's own permission to write lasts. Every copy follows a press.
```
#### contextMenus
```text
Adds one right-click item, Comment with Pipeup, on selected words, a picture, a link or the page. Choosing it adds Pipeup to that tab and opens a comment box on what was right-clicked.
```
#### optional_host_permissions: <all_urls>
```text
Nothing is granted at install. Pipeup asks for access only when the user turns on Always on for this site, and then only for that site (for example https://example.com/*). Always on for local pages asks only for http://localhost, 127.0.0.1 and [::1]. Safari shows its own prompt. Turning the switch off removes the access. Only http and https sites are ever requested.
```
#### web_accessible_resources: pipeup/*, addons/* matching <all_urls>
```text
Pipeup's own script and its add-ons (Emoji, Voice, Save to GitHub, My identity) are bundled in the app and loaded as modules into the tab the user chose to comment on. That tab can be any site, so the match is any site. Nothing is fetched from the web. Pipeup's UI lives in a closed shadow root, so the page's scripts can't read comments, names or recovery codes, and it doesn't change the page's layout.
```
#### commands: _execute_action (Option-Shift-P)
```text
A keyboard shortcut that opens Pipeup's toolbar menu for the current page. It grants the same one-tab access as pressing the toolbar button.
```
#### Microphone (Voice add-on, off by default)
```text
Used only when the user turns on Voice, agrees to its consent panel and presses the microphone button. Safari asks for the microphone and Apple's speech recognition does the listening. Pipeup sends no audio itself.
```
### Privacy and data-use answers
#### Do you or your third-party partners collect data from this app?
```text
No, we do not collect data from this app.
```
_Why:_ There is no developer server, analytics or SDK. Comments, the list of pages, names, keys and add-ons' choices stay in Safari's extension storage on the Mac, and data handled only on the device isn't "collected". Share and Live are not in the app. Save to GitHub opens a github.com new-issue page in Safari, at the user's press, for the repository the user sets; GitHub receives the words, names, page title and address when that page opens, and GitHub is not the developer's partner. Voice uses Apple's own speech recognition through Safari.
#### If Yes: data types collected
```text
Not applicable: the answer is No.
```
_Why:_ If Share or Live is ever added to the app, revisit: Other User Content, Name, User ID, and for Live, presence (Product Interaction).
#### If Yes: purposes for each type
```text
Not applicable.
```
#### If Yes: linked to the user's identity?
```text
Not applicable.
```
#### If Yes: used for tracking?
```text
Not applicable. Nothing is used for tracking.
```
#### Optional-disclosure exemption
```text
Not needed with the answer No.
```
#### Publish confirmation
```text
Publish only after the privacy policy is live and says the same as these answers.
```
_Why:_ Only the Account Holder, Admin or App Manager can edit.
#### Privacy Policy URL
```text
https://pipeup-ai.github.io/pipeup/privacy/ (to be published)
```
#### Privacy Choices URL
```text
Leave empty.
```
### Notes for the store's reviewer
```text
No account or sign-in is needed.

TRY IT (2 minutes)
1. Open the Pipeup app. Use its button to open Safari Settings and tick Pipeup in Extensions.
2. In Safari open https://example.com (any page works except the Pipeup website, which has Pipeup built in, so the extension steps aside there).
3. Press Pipeup in the toolbar. If Safari asks to allow Pipeup on this site, choose Allow for One Day. The menu shows the page's address and Comment on this page.
4. Press Comment on this page. Select a few words. A comment box opens beside them with the cursor in it. Type "Sam: shorter please" and press Return. A mark appears on the words.
5. Press Pipeup again: the menu now shows Copy comments, Save comments, Comments, Always on for this site and Turn off on this page, among others. Choose Copy comments > As Markdown and paste into TextEdit to see the comment with the words it is on.
6. Right-click the page's link and choose Comment with Pipeup to comment on it.
7. Comments you've made (bottom of the menu) lists the page and holds the settings and add-ons.

PERMISSIONS
- activeTab: a press on the toolbar button, Option-Shift-P or the right-click item lets Pipeup into that one tab, to add Pipeup and read its address and title.
- scripting: adds Pipeup's bundled script to the tab on that press; checks whether the page already has Pipeup; registers the script for a site only after the user turns on Always on for this site.
- storage, unlimitedStorage: comments with their history, the list of pages, the user's display name and signing key, settings and add-ons' choices are kept in the extension's storage, never in the site's. They grow with every page reviewed and are never sent to us.
- clipboardWrite: Copy comments writes to the clipboard after asking the page for its comments, which can outlast the click.
- contextMenus: the Comment with Pipeup item.
- optional host access (<all_urls>): nothing is granted at install. Only when the user turns on Always on for this site (or Always on for local pages) does Pipeup ask Safari for that one site (or localhost, 127.0.0.1 and [::1]). Turning it off removes it.
- web_accessible_resources: Pipeup's own script and add-ons, bundled in the app, loaded as modules into the tab the user chose. Nothing is fetched from the web. Pipeup's UI is in a closed shadow root, so the page's scripts can't read comments, names or recovery codes.

NOT IN THIS APP
The app packs only Emoji, Voice, Save to GitHub and My identity: the Share and Live add-ons are not in it, so the user sees only their own comments. It takes no screenshots of the page. It does not use native messaging, and does not run or install any other program. Comments reach agents by Copy comments or Save comments.

ADD-ONS (bundled, none downloaded)
Emoji is on; the others are off until the user turns them on in Comments you've made.
- Voice: uses Apple's speech recognition through Safari; Safari asks for the microphone; a consent panel comes first.
- Save to GitHub: only on a comment that mentions a GitHub name, and only for the repository the user sets; opens a prefilled github.com new-issue page in Safari, which GitHub receives when it opens; nothing is filed until the user submits it; no token is kept.
- My identity: shows a recovery code; sends nothing.

DATA
No analytics, no developer server, no remote code. Nothing reaches the developer.

SOURCE
MIT, https://github.com/pipeup-ai/pipeup. The bundled files are minified. To rebuild them from the repo root on a Mac with Xcode:
cd libs/ts/pipeup && npm ci && npm run build
cd ../addons && npm ci && npm run build
cd ../../.. && node tools/build-extension.mjs --safari
The build prints the SRI hash of pipeup/pipeup.esm.js, to compare with the one for pipeup@[release version] on npm.

Contact: [support contact: maintainer to supply]
```
### Screenshots
| # | Shows | Size | Caption |
|---|---|---|---|
| 1 | 1. Safari window on a fictional article page ("Lumen Field Notes", light look). Pipeup's toolbar menu is open under its button, showing the page's address and the Comment on this page button. Real Safari window frame, no other apps. | 2880×1800 PNG, no alpha (or 1440×900) | Press Pipeup and choose Comment on this page |
| 2 | 2. The same page in comment mode. A sentence is selected and the comment box sits beside it with the cursor in it. Sam is typing "Can this be one line shorter?" | 2880×1800 PNG, no alpha | Select words, a picture or a block, then write |
| 3 | 3. The page with three comment marks. One thread is open as a popover: Sam's comment, a reply Sam added, and Reply and Resolve. (Only the user's own comments appear: Share and Live are not in the app.) | 2880×1800 PNG, no alpha | Read, reply and resolve on the page |
| 4 | 4. Pipeup's toolbar menu with Pipeup on, and Copy comments opened to As Markdown (for an AI) and As text. Save comments is visible below. | 2880×1800 PNG, no alpha | Copy or save the comments for whoever asked |
| 5 | 5. Right-click on a picture of a lamp on the fictional page, with Comment with Pipeup highlighted in Safari's menu. | 2880×1800 PNG, no alpha | Right-click anything to comment on it |
| 6 | 6. The Comments you've made page: three fictional pages (Lumen Field Notes, Lee's pricing draft, Ada's onboarding page) and below them the settings and the four add-on switches (Emoji on; Voice, Save to GitHub and My identity off). | 2880×1800 PNG, no alpha | Every page you've commented on, and your add-ons |
| 7 | 7. The Pipeup Mac app window: how to turn the extension on in Safari Settings > Extensions, with its button, plus links to Help and Privacy. | 2880×1800 PNG, no alpha | Turn Pipeup on in Safari Settings |

### Only the maintainer can supply
- The release: tag the Pipeup release this app ships and use its number wherever this listing says [release version] (Version Number, the store line, the SRI check in the notes). Stores take stable releases only. Set MARKETING_VERSION to it in the Xcode project (it says 1.0 today), and a build number that goes up with every upload.
- Apple Developer Program membership (Individual, 99 USD a year) in the maintainer's legal name, with two-factor authentication. That name becomes the seller name shown on the App Store. Accept the agreements in App Store Connect, and register the bundle IDs ai.pipeup.Pipeup and ai.pipeup.Pipeup.Extension under the team.
- Release archive with team signing: DEVELOPMENT_TEAM set and App Store distribution signing, then archive a Release build. The build script builds Debug, signed for this Mac only.
- Deployment target below macOS 27: the app inherits macOS 27.0 from the converter; the extension asks for Safari 17, which needs about macOS 13 or 14 (unverified). Also set LSApplicationCategoryType productivity, ITSAppUsesNonExemptEncryption NO and NSHumanReadableCopyright, and remove the unused network and user-selected-file entitlements. Keep these settings in source control, because build-extension.mjs regenerates the project with --force.
- A containing app with real content (guideline 4.2 / 4.4): how to turn it on, a short guide, links to privacy and support, the version, the MIT licence and the emojibase MIT notice.
- Privacy policy published at https://pipeup-ai.github.io/pipeup/privacy/ (404 today), covering every point in the Privacy Policy URL note and linked from inside the app.
- Support page at https://pipeup-ai.github.io/pipeup/support/ with [support contact: maintainer to supply] (an email address, plus a postal address and phone where local law requires them) and a link to GitHub Issues.
- App Review contact: name, email, and phone in +country-code format.
- DSA trader status: declare non-trader or trader. This is a legal call. A trader's address, phone and email are published in the EU.
- Art: app icons drawn at full size rather than scaled up from 128 px, and the 7 screenshots at 2880×1800 in Safari, light look, on fictional pages, once the containing app is done.
- Reword the popup's Save comments hint "to open again" (popup.html): nothing in the extension opens a saved Pipeup file.
- Confirm the export-compliance exemption, and confirm on a clean Mac (through TestFlight) whether Safari prompts on a toolbar press, its prompt wording, and that Option-Shift-P is applied.

## Decisions for the maintainer

- Which version to list (next stable, for example 0.10.0 or 1.0.0), and whether the setup command pins that exact version or a major.
- Whether to ship Share and Live at all in the first release of each store, given the consent fix needed, and that Safari needs them left out (or report and block features added).
- Whether to leave Voice out of the Firefox build, and whether to keep it in Edge until it is tested there.
- Whether to turn pictures off in the Safari build, and whether pictures should be deleted with their comment everywhere.
- Whether to move Emoji's recent list into extension storage and use a closed shadow root in the extension, so that the 'site can read' and 'site's storage' caveats can be cut.
- Windows: hide or explain Send to my agent there, or add registry support to the CLI before listing.
- The new manifest description (short description on Chrome and Edge), and the Safari app name ('Pipeup' or 'Pipeup – Page Comments').
- One browser-neutral privacy policy at /privacy/ for all stores, or per-browser copies (Edge prefers Edge-only wording; Chrome expects its Limited Use wording, which names Chrome).
- Support contact email to publish, and the App Review contact phone.
- Account type (Individual on every store), publisher display name ('Pipeup') and, for Apple, the seller name being the maintainer's legal name.
- DSA trader or non-trader status for the App Store (a legal call).
- Narrowing optional_host_permissions to http and https, and trying use_dynamic_url for web_accessible_resources.
- Shipping unminified bundles to Edge, or relying on the tag, SRI hash and rebuild steps.
- Categories per store (Productivity on Chrome, Edge and Safari; Social & Communication plus Web Development on AMO), visibility (Public or Hidden on Edge) and the release option (manual on Safari).
- Firefox scope: desktop only for now, with the spec updated to say Android comes later.
- When and in what order to submit, and answering reviewers. Tagging, publishing and uploading stay the maintainer's call.

## Change log

- 2026-11-10: First drafts for Chrome, Edge, Firefox and Safari, with the checks' findings, the code changes they call
  for and the privacy policy.
- 2026-11-10: The code changes are made on `feat/browser-extension`; the status noted.
- 2026-11-10: Every listing and the privacy policy revised against the new build: the UI closed to the page, add-ons'
  choices kept by the extension, each browser's add-ons, Firefox's question before sending, the setup command per
  browser and release, pictures deleted with their comment. What is still known is said above.
- 2026-11-10: What is typed into Pipeup's boxes on a page is typed in the extension's own frame; the page can't see the
  words or the keys. The caveat about keys is replaced.
