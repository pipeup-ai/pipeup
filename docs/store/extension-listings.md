# Store listings for Pipeup for browsers

Drafts of everything each store asks for, written from an audit of the extension's code and each store's rules as
read on 10 November 2026. **Nothing has been submitted.** Submitting, the accounts and the release are the
maintainer's call.

The text in each `text` block is ready to paste once the placeholders in square brackets are filled. Each store's
draft was checked against the code and that store's rules by a separate reviewer; their findings are listed under
each store. The privacy policy all four point to is in [privacy-policy.md](privacy-policy.md).

## Before anything is submitted

These block submission to at least one store. Details, and the recommended changes, are under
[Code and build changes](#code-and-build-changes).

- **Bump the version off 0.9.1, release the library, CLI and add-ons to npm, tag it, and build the store packages from that tag (tools/build-extension.mjs takes the version from libs/ts/pipeup/package.json).** Tag v0.9.1 has no apps/extension, and npm 0.9.1 has no `browser` command, so Send to my agent and nativeMessaging can't be tested (Edge 1.3) and AMO can't rebuild the minified files from the source. _(All (blocks Chrome, Edge and Firefox outright; Safari for the version number and SRI claim))_
- **In browser.js agentSetup(), add Edge detection (navigator.userAgentData brands or the 'Edg/' token) and `--browser edge`, and make `pipeup@<major>` match the release being listed.** Today Edge is treated as 'chrome', so the host file goes into Chrome's folder and Send to my agent never works in Edge. If the release is 1.x, `pipeup@0` never gets the command in any browser. _(Edge (blocker); Chrome and Firefox if the major changes)_
- **Add accurate Firefox data_collection_permissions: required ['none'] plus optional websiteContent, browsingActivity, personalCommunications, personallyIdentifyingInfo and websiteActivity. Call permissions.request({data_collection}) when Share, Live or Save to GitHub is turned on or Send to my agent is first pressed, and raise strict_min_version from 128.0 to 140.0. Spec section 6 first.** build-extension.mjs:60-63 declares only 'none', but those features transmit data. AMO policy 6.2.1 requires an accurate declaration, and Firefox 128–139 would need a custom consent screen. _(Firefox)_
- **Move Live's consent flag {on, seen} and Share's policy (and ideally Voice's choice) from the site's IndexedDB (kit/src/settings.ts:25) into chrome.storage.local, or leave Live and Share out of that store's build.** A page could pre-set consent and go live without the consent panel (live/src/addon.ts:65-70,186-191). That breaks every store's consent rules and makes 'after you agree' untrue. _(Firefox (would-be-rejected), Chrome and Edge (should-fix); Safari only if Live ships)_
- **Per-target add-on lists in tools/build-extension.mjs:17 (Safari without Share and Live; Firefox without Voice if agreed), and hide the missing add-ons' switches in comments.js.** The Safari listing, age rating (no user-generated content) and 'No data collected' answer depend on Share and Live being absent. Guideline 1.2 needs report and block features Pipeup lacks. Voice is a dead switch in Firefox. _(Safari (blocker), Firefox (recommended))_
- **Safari app: a real containing app (guide, privacy and support links, licence and emojibase notice), Release archive with team signing, a lower deployment target than the inherited 27.0, version and build numbers, category and encryption keys, and unused entitlements removed, kept in source control because the converter runs with --force.** Guidelines 4.2/4.4 (minimum functionality) and 2.1/2.5.1 (installs only on macOS 27; Debug ad-hoc build). _(Safari)_

## Order of submission

1. Now, in parallel: open all four developer accounts. Apple enrolment and Partner Center verification take days, Chrome registration needs a fee and 2-step verification, and AMO needs 2FA.
2. Then: agree the spec changes (EXTENSION_SPEC sections 2, 5 and 6) and land the code and build changes marked blocker and recommended on a feature branch, with npm run check green.
3. Then: release the next stable version (library, CLI with `pipeup browser`, add-ons) to npm and tag it. Every store depends on this, and every [release version] placeholder resolves from it.
4. In parallel with the release: publish the privacy and support pages on the website, a test page with data-pipeup-doc and a sharing address, and make the screenshots and store art per store.
5. Day one after release: submit Firefox and Chrome. AMO has the longest and least predictable queue (days to over a month, plus a possible source-rebuild round trip), so start it first. Chrome is the reference Chromium listing.
6. A few days later, or once Chrome passes: submit Edge with the same Chromium zip. A rejection on either Chromium store means a version bump that both must take, so letting Chrome go first avoids two parallel resubmissions. Edge takes up to 7 business days, and any edit restarts its review.
7. Last: Safari. It needs the per-target build, the containing app and the Xcode project work. Run TestFlight on a clean Mac (prompt wording, Option-Shift-P) while the other reviews run, then submit. Review is usually 24–48 hours, but expect a 4.2 or privacy round on the first try. Use manual release so the maintainer can line it up with the others.

## Chrome Web Store
**Checker's verdict:** Not ready to submit. The Chrome draft avoids the worst sentences the Firefox and Edge checkers found (it never says 'no fetch' or 'nothing on a server'), and every field is within its limit with no emoji, superlatives or real names. But it still had the same family of untrue claims: the storage justification said the extension keeps comments out of the page's reach and that nothing leaves unless the reviewer copies, saves or sends (the open shadow root, Share's automatic sending and site-origin add-on storage all contradict it), the description said the same, and the reviewer notes claimed the packed core is byte for byte npm's pipeup@0.9.1 when the source has moved on and the extension isn't in that tag. Three things block approval or an honest certification, and rewording can't fix them: Send to my agent's setup command fails because the published pipeup has no browser command (so nativeMessaging can't be tested), a page can pre-set Live's consent in its own IndexedDB (so the Limited Use 'transfer' certification isn't yet true), and the version and source tag don't match what is packed. I also found that My identity draws the private recovery code into the page where site scripts can read it. The corrected draft in chrome-verified.json fixes the untrue sentences behind the 30 problems listed, discloses every remaining caveat, and leaves the version, tag, test page and helper version to the maintainer. Submit it only after the helper is published (or nativeMessaging is removed), Live's consent moves to extension storage, and the build comes from a tagged commit.
### Listing fields
#### Name (manifest "name", 75 max)
_6 characters. Unchanged from the manifest. No BETA suffix needed because 0.9.1 is a stable release._
```text
Pipeup
```
#### Summary (manifest "description", 132 max)
_124 characters. Replaces the manifest's current description, "Comment on any web page with Pipeup. Your comments stay in this browser until you send them.", which is untrue: Share sends new comments automatically once on, Live sends after one consent, and the page's own scripts can read the comments shown on it. Changing it means editing apps/extension/src/manifest.json and rebuilding before the first upload._
```text
Comment on words, pictures or any part of a web page, then copy, save or send the comments to the person or agent who asked.
```
#### Detailed description (Store listing tab; about 16,000 max, unconfirmed)
_5997 characters. Names no other browser and no agent product (the STUN servers' operators are named in the privacy policy, not here). "Comment" appears often, but in ordinary sentences, never in a keyword list. Every caveat from the audit is in it. If the maintainer fixes one before submitting (open shadow root, site-origin storage, pictures kept after deletion), take that line out. If Send to my agent's helper is not on npm by submission, take its bullets out and remove nativeMessaging from the build._
```text
Pipeup lets you comment on web pages and hand your comments to the person or AI agent who asked for your feedback.

Press Pipeup in the toolbar (or Alt+Shift+P) and choose Comment on this page. Point at what you mean: select a few words, click a picture or a block, or pin a spot. A box opens beside it with the cursor in it. Write your note and press Enter. You can reply, resolve and reopen, and edit or delete your own comments.

What you can do
• Comment on ordinary web pages (http and https). The browser's own pages, such as settings, the new tab page and extension stores, are closed to extensions, and Pipeup says so there.
• Right-click selected words, a picture, a link or the page and choose Comment with Pipeup.
• See every comment on the page in one list, with replies, Resolve and Reopen. Turn on Keep comments beside the page to show it in the browser's side panel; otherwise each thread opens beside its place on the page.
• Copy comments as Markdown or as text, ready to paste into a message, a ticket or a chat with an AI.
• Save comments as a Markdown file, or as a Pipeup file, which keeps every change and which Pipeup's command-line tools can read.
• Send to my agent: give the page's comments to AI agents on this computer, and see their replies in the threads. It needs a small helper program that you install yourself with one command, which Pipeup shows you. The helper runs on macOS and Linux and needs Node.js. Everything else works without it.
• Comments you've made lists every page you have commented on, newest first.
• Always on for this site starts Pipeup whenever you open that site, without a press. The browser asks your permission for that one site. Pages on this computer (localhost and 127.0.0.1) have one switch for every port.
• Keep a picture of where each comment was made, so a comment whose place has gone still shows what it was about.
• Add-ons, each turned on or off in the extension's settings: Emoji (on by default), Voice, Share, Live, Save to GitHub and My identity.

Where your comments are kept
Your comments, the pages you commented on (address and title), the sites where you started Pipeup, your name and signing key, your settings and the pictures are kept by the extension, in this browser. There is no account to make. Pipeup has no analytics or telemetry, sends nothing to its makers, and loads no code from the web.

Who else can see them
• The page you are on. Pipeup draws its highlights, comment boxes and menus inside the page, so the page's own scripts can read the comments shown there, what you type in them, and the recovery code My identity shows.
• Whoever you give them to with Copy comments or Save comments.
• Send to my agent sends the page's comments, with their earlier versions, and the page's full address and title, to the helper program on this computer, which keeps them in ~/.pipeup/browser. After you use Pipeup's toolbar menu on a page where Pipeup is on, the menu also asks the helper, if it is installed, for agents' replies. That request carries only a code made from the page's address.
• Add-ons that send, once you turn them on:
 – Voice: when you press the microphone, the browser turns your speech into text. Depending on the browser and the language, the audio may go to the browser maker's speech service.
 – Share: works only on pages that carry a Pipeup document id and a sharing address (yours from the settings, or the page's own if you set none). While sending is on, it sends your new comments to that server about every 10 seconds, encrypted with the key in the address, and brings others' comments back. Anyone with the address, including a page that names it, can read them. The server sees your IP address. Comments you wrote before Share was on wait until you choose.
 – Live: works only on pages that carry a Pipeup document id. After you choose to go live, it connects you through public relays (or ones the page names) to others on the same page, and sends them the page's comments, your name, where you point and select, and when you are typing. The relays, public connection (STUN) servers and the others see your IP address.
 – Save to GitHub: when you mention someone by their GitHub name and press Mention on GitHub in Pipeup's menu, it opens a github.com new-issue page with the comment, your name, the page title and its full address filled in. GitHub receives these when that page opens. Nothing is filed until you submit it there.
 – My identity shows a recovery code for your Pipeup identity, which you can copy or save. It sends nothing, but the code is shown inside the page.

Good to know
• When you make a comment on a page where you pressed Pipeup, a picture of the visible tab is taken and cut to the comment's place. Pictures are kept by the extension, shown only in the side panel, and never copied, saved in files or sent. Turning pictures off deletes them all. Deleting a comment does not delete its picture.
• Editing or deleting a comment keeps the earlier text in its history, which goes into a Pipeup file, Send to my agent, Share and Live.
• Some add-ons keep small things in the site's own storage, where the site can read and change them and where they stay after the extension is removed: Emoji (recent emoji and skin tone), Voice (language and consent choice), Share (which comments were sent) and Live (whether you chose to go live).
• Your comments carry your name and a public key that is the same on every site, so comments shared or saved from different sites can be linked to you.
• Sites can tell that Pipeup is installed, because pages can load its files.
• To remove what the extension keeps, remove the extension. Files you saved, what Send to my agent wrote on your computer (in ~/.pipeup/browser) and what add-ons kept in sites' own storage stay until you delete them.

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
```text
Off
```
#### Promo video (YouTube URL)
_Optional._
```text
None for 0.9.1
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
_715 characters. "when the reviewer presses the toolbar button" became "when the reviewer asks", because Always on starts Pipeup with no press._
```text
Pipeup lets a reviewer comment on parts of a web page they choose, and hand those comments to the people or AI agents who asked for the feedback. Every feature serves that one purpose: adding Pipeup to the page when the reviewer asks, writing comments and replies, the side panel that lists them, keeping them in this browser, and getting them out with Copy comments, Save comments or Send to my agent. The optional add-ons are part of the same purpose: Emoji and Voice help write a comment; Share and Live deliver comments to the others reviewing the same page; Save to GitHub turns a comment into a draft GitHub issue; My identity lets the reviewer keep the same name and key on their comments in another browser.
```
#### Remote code (Privacy tab)
_Checked in dist/chromium: no eval, new Function, WebAssembly, importScripts or http(s) import; the only dynamic imports are chrome.runtime.getURL files; no update_url. Share's fetch, Live's WebSocket and WebRTC, and the GitHub link carry data, not code._
```text
No, I am not using remote code.
```
#### Privacy policy URL (Privacy tab)
_Required. A draft exists at docs/store/privacy-policy.md (untracked, not published). It must match this listing and the data-usage ticks, name every destination (the local helper and ~/.pipeup/browser; the sharing server, which the page may name; the Nostr relays wss://relay.damus.io, wss://nos.lol and wss://relay.primal.net by default, or ones the page names; the STUN servers stun.l.google.com and stun.cloudflare.com; peers; github.com; the browser maker's speech service; and the website itself, which can read what Pipeup shows on it and what add-ons keep in its storage), cover retention and deletion (no delete-all in the extension; removing it removes the extension's storage, not site storage or files), the pictures, no telemetry, and carry the Limited Use statement._
```text
[privacy policy URL: maintainer to supply — suggested https://pipeup-ai.github.io/pipeup/privacy/]
```
#### Payments / in-app purchases (Distribution tab)
```text
Free. No in-app purchases.
```
#### Visibility (Distribution tab)
_Use Unlisted or Private for a trusted-tester round first if wanted. All three get the same review._
```text
Public
```
#### Regions (Distribution tab)
```text
All regions
```
#### Test instructions (Test instructions tab)
_About 5,500 characters. No documented limit was found._
```text
Paste the reviewer notes (reviewerNotes) here. There are no credentials: no account is needed.
```
#### Version
_build-extension.mjs takes the version from libs/ts/pipeup/package.json (0.9.1), but the packed core and add-ons are built from feat/browser-extension, which differs from tag v0.9.1 (19 files in libs/ts/pipeup/src). Release the core (with the browser command) first, or give the extension a version of its own, then build. Each later upload must be higher._
```text
[version: maintainer to supply — not 0.9.1 unless the package is rebuilt from the v0.9.1 sources]
```
#### Submit dialog: publish automatically after review
_This lets the maintainer first set the helper's documentation and the website's install link to the store extension ID. Publish within 30 days of approval, or the item returns to draft._
```text
Untick (deferred publishing)
```
### Permission justifications
#### activeTab
```text
The reviewer gives Pipeup one tab at a time: by opening the toolbar menu (the button or Alt+Shift+P) or by choosing Comment with Pipeup in the right-click menu. activeTab gives access to that tab for that use, so no site access is asked for at install. With it, the menu shows the page's address and uses its title to name a saved file, Comment on this page adds Pipeup to the tab, and tabs.captureVisibleTab takes the small picture of where a new comment was made. Pictures are kept by the extension in this browser only and can be turned off in the settings, which deletes them. The 'tabs' permission is not requested. On a site the reviewer set to Always on, Pipeup starts through the optional host permission instead (see that justification).
```
#### scripting
```text
Used to add Pipeup to the page the reviewer chose: chrome.scripting.executeScript runs the extension's own start.js in that tab when they press Comment on this page or choose Comment with Pipeup. When the toolbar menu opens on an http or https page where Pipeup isn't running, a small packaged function runs in that tab to see whether the page already has Pipeup built in, so the extension can step aside. When the reviewer turns on Always on for this site (or Always on for local pages), registerContentScripts registers start.js for that site only and runs it once in the tab; turning the switch off unregisters it. All scripts are files packaged in the extension. Pipeup's own files (pipeup/*, addons/*) are listed in web_accessible_resources so start.js can import them as modules.
```
#### storage
```text
Pipeup keeps its data in chrome.storage.local, in this browser: the comments on each page with their full history (keyed by page), the list of pages commented on (address without query, title, time), each site's choices where Pipeup was started (look, Hide comments), the reviewer's display name and signing key, the settings (comments beside the page, Show Pipeup's button on pages, pictures on or off, which add-ons are on, the sharing address and the GitHub repository), which agent replies were already added, the small pictures of where comments were made, and whether the toolbar icon is drawn light or dark. Comments leave the browser through the features the reviewer uses: Copy, Save, Send to my agent, and add-ons they turned on (Share and Live send while they are on). The page's own scripts can read the comments Pipeup shows on that page.
```
#### unlimitedStorage
```text
Comments are kept for every page the reviewer comments on, with each page's full comment history, and a small picture (JPEG, at most 480 px wide) is kept for each new comment unless the reviewer turns pictures off. Over many pages this passes chrome.storage.local's default quota, and when that happens saving a comment fails. unlimitedStorage keeps comments from being lost. The pictures are never sent. Turning pictures off deletes all the pictures kept.
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
Used for Send to my agent. When the reviewer presses it, the page's comments (as Markdown and as a Pipeup file with their history), the page's full address and its title go to the Pipeup helper program on this computer (host ai.pipeup.browser), which the reviewer installs separately with one npx command that the menu shows (macOS and Linux). AI agents on the same computer read them there, and their replies come back into the threads. After the reviewer uses the toolbar menu on a page where Pipeup is on, the menu also asks the helper for new replies; that request carries only the page's id, a code made from its address. If the helper isn't installed, nothing is sent and the menu shows the command. Everything else in Pipeup works without it.
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
_Why:_ Pipeup keeps the display name the reviewer types and puts it in every comment they write. It travels with Copy, Save, Send to my agent, Share, Live and Save to GitHub, and is shown inside the page.
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
_Why:_ An Ed25519 signing key, one per reviewer, is stored unencrypted in chrome.storage.local and signs every comment. It proves authorship, though there is no password or account. My identity shows it as a recovery code inside the page, where the page's scripts can read it. No GitHub token is kept: sign-in happens on github.com. The privacy policy must describe the key.
#### Personal communications
```text
Yes
```
_Why:_ Comments and replies are messages to the people or agents who asked for feedback. Share and Live deliver them to other people. Send to my agent delivers them to a local program, and agents' replies come back.
#### Location
```text
No
```
_Why:_ No location is read or kept. The servers used by Share and Live (relays and STUN), and Live peers, see the reviewer's IP address as part of a connection, but the extension doesn't collect it. Say this in the privacy policy.
#### Web history
```text
Yes
```
_Why:_ Pipeup keeps a list of the pages commented on (address without query, title, last time) and per-site choices for every site where Pipeup was started. Send to my agent and Save to GitHub use the page's full address.
#### User activity
```text
Yes
```
_Why:_ Live, which is off by default and asks for consent, sends where the reviewer points and selects, and when they are typing, to the others on the page. There is no keystroke or click logging otherwise.
#### Website content
```text
Yes
```
_Why:_ Each comment stores the page text it is about: the selected words with the text around them, a short excerpt, the element's name (which can be a link or picture address), the headings above it and the page title. A picture of the visible tab, cut to the comment's place, is kept in this browser only. Disclose both in the policy.
#### Certification: I do not sell or transfer user data to third parties, outside of the approved use cases
```text
Certify (tick), only once Live's consent is kept where the page can't set it (see needsFromMaintainer)
```
_Why:_ Nothing is sold. Data goes to others only through features the reviewer uses: Send to my agent, or an add-on they turned on that sends to a destination they or the page chose. Today a page that carries a Pipeup document id can pre-set Live's consent in its own IndexedDB and start Live without the consent panel, which would send comments, name and pointer to relays and peers without the reviewer agreeing. Fix that before ticking.
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
- activeTab: opening the toolbar menu or choosing the right-click item gives Pipeup that one tab. It is also what lets tabs.captureVisibleTab take the small picture of where a comment was made. Pictures are kept in chrome.storage.local only and never sent. They are on by default and can be turned off on the options page, which deletes them.
- scripting: injects the packaged start.js into that tab, checks whether the page has Pipeup built in, and registers start.js only for sites set to Always on.
- nativeMessaging: Send to my agent (see below), plus a reply check to the same local helper after the menu is used on a page where Pipeup is on.
- clipboardWrite: the Copy buttons, mainly Copy comments, which writes after an asynchronous request to the page.
- unlimitedStorage: comment histories for every page, plus one picture per comment.
- sidePanel: the list of comments beside the page. Because the manifest declares a side panel, Pipeup appears in the side panel picker from install; on a page without Pipeup it only says how to start.
- Optional host permission: Always on for this site asks the browser for that one site's origin only. Always on for local pages asks for localhost, 127.0.0.1 and [::1]. Nothing is requested at install, and turning the switch off removes the permission. Only http and https origins are ever requested.
- web_accessible_resources (pipeup/*, addons/*): start.js imports Pipeup and the add-ons the reviewer turned on as ES modules, so these files must be loadable on any site.

Send to my agent (optional; macOS and Linux)
It passes the page's comments to a helper program, pipeup browser, on the reviewer's computer over native messaging (host name ai.pipeup.browser). The helper is not in the package. The reviewer installs it with Node.js 20 or later: npx --yes pipeup@[version: maintainer to supply] browser install --extension-id <this extension's ID>. The menu and options page show this command with the ID filled in. The helper writes the comments to ~/.pipeup/browser/<page id>/. Agents read them with npx --yes pipeup@[version] browser read, and answer with npx --yes pipeup@[version] browser reply <page> --thread <id> "<words>". The replies appear in the threads after Send to my agent is pressed again or the menu is next used on that page. Without the helper, Send to my agent shows "not set up yet" and the command, and nothing else is affected. Windows is not supported yet.

Add-ons
Emoji is on by default and has no network code. Voice, Share, Live, Save to GitHub and My identity are off, and are turned on in the options page. Share and Live work only on pages whose HTML carries a Pipeup document id (data-pipeup-doc), so on example.com they say they need a document identity. To try them, open [test page URL: maintainer to supply] in two windows. Save to GitHub needs a repository (set in the settings, or named by the page) and a comment that mentions a gh: person; it then offers Mention on GitHub in Pipeup's menu, which opens a github.com new-issue page. Nothing is filed until the reviewer submits it there.

No remote code
Everything is packaged. There is no eval, new Function or remote script, and the only dynamic imports are chrome.runtime.getURL files in the package. No analytics or telemetry.

Source and rebuilding
Source (MIT): https://github.com/pipeup-ai/pipeup at tag [tag: maintainer to supply]. pipeup/pipeup.esm.js and addons/*.esm.js are minified (esbuild, plus terser for the core), not obfuscated. The extension's own popup, panel, options, background and start scripts are shipped as written. To rebuild the package from the repository root with Node.js 22 (the add-ons need 22):
1. cd libs/ts/pipeup && npm ci && npm run build
2. cd ../addons && npm ci && npm run build
3. cd ../../.. && node tools/build-extension.mjs
The output is apps/extension/dist/chromium, zipped as apps/extension/dist/pipeup-extension-<version>-chromium.zip. The build prints the SRI hash of pipeup/pipeup.esm.js and checks that the packed file is the one it built.
```
### Screenshots
| # | Shows | Size | Caption |
|---|---|---|---|
| 1 | 1. Comment on words. An ordinary article page in light mode. A sentence is highlighted, and the new-comment box sits beside it with the cursor in it and the text "Tighten this sentence — Ada". The page shows comment mode's outline. | 1280x800, full bleed, square corners, 24-bit PNG without alpha (or JPEG) | Point at words and write your comment beside them |
| 2 | 2. Comment on a picture. The same page with a product photo marked, and an open thread popover beside it. Sam's comment and Lee's reply are visible. The place is marked on the page. | 1280x800, full bleed, square corners, 24-bit PNG without alpha (or JPEG) | Comment on pictures, blocks or any point, and reply |
| 3 | 3. The side panel. Keep comments beside the page is on. The browser's side panel lists three threads (by Sam, Ada and Lee) with For you and Resolved, one thread open with Reply and Resolve, and its place marked on the page. | 1280x800, full bleed, square corners, 24-bit PNG without alpha (or JPEG) | Every comment on the page, beside the page |
| 4 | 4. The toolbar menu. Pipeup is on, and the menu is open from the toolbar: the page address, your name (Ada), Copy comments expanded to As Markdown / As text, Save comments, Send to my agent, Comments with a count, Start commenting, Always on for this site. | 1280x800, full bleed, square corners, 24-bit PNG without alpha (or JPEG) | Copy, save or send the comments to whoever asked |
| 5 | 5. Comments you've made and the settings. The options page lists pages with comments (newest first) and the settings: Show Pipeup's button on pages, Keep a picture of where each comment was made (with its "Kept in this browser only" line), the Add-ons switches (Emoji on, others off), and the Send to my agent command. | 1280x800, full bleed, square corners, 24-bit PNG without alpha (or JPEG) | Your comments, your settings and the add-ons |

### Only the maintainer can supply
- Before submitting: publish a pipeup release on npm that has the browser command (0.9.1 has none, so npx --yes pipeup@0 browser install fails today), and put that version in the command the extension shows (apps/extension/src/browser.js) and in the reviewer notes. Otherwise remove nativeMessaging and Send to my agent from this build: a reviewer who can't make it work can reject for an unusable feature and an unneeded permission.
- Version and source: the extension is not in tag v0.9.1, and the packed core differs from npm's pipeup@0.9.1. Tag the commit you build from, give the package a version that matches it, and put the tag in the reviewer notes.
- Fix Live's consent before ticking the Limited Use certification: {on, seen} is kept in the site's IndexedDB (pipeup-addon-live), so a page with a Pipeup document id can pre-set it and Live connects without the consent panel. Keep consent in chrome.storage.local, or ask every time.
- Strongly advised: stop showing My identity's recovery code (the private key) inside the page's open shadow root, or open it on an extension page instead. Today the site's scripts can read it.
- Chrome Web Store developer account: a dedicated Google Account with 2-Step Verification, the developer agreement accepted, and the one-time registration fee paid (historically US$5, unconfirmed).
- Publisher name (shown as "Offered by") and a verified contact email: [support contact: maintainer to supply].
- Trader or Non-Trader declaration. Non-Trader is likely for an individual publishing an MIT project, but that is the maintainer's own legal call.
- Publish the privacy policy (draft at docs/store/privacy-policy.md, untracked) at a public URL, matching this listing and the data-usage ticks, with the Limited Use statement.
- Change the manifest description to the new summary and rebuild. Also change the toolbar menu's own line "Comments stay in this browser until you send them" (popup.html) and Save to GitHub's "nothing is sent until you submit it" (github addon), which say the same untrue things inside the product.
- Decide whether to fix the remaining audit findings instead of disclosing them: Emoji writes to the site's localStorage, Share, Live and Voice keep state in site-origin IndexedDB, the core calls navigator.storage.persist() for the site, the open shadow root lets the page read comments, pictures survive comment deletion, and there is no delete-all. Each fix means taking the matching line out of the description.
- Narrow optional_host_permissions from <all_urls> to http://*/* and https://*/*: the code only ever requests http and https origins, and minimum permission applies to optional permissions too. Consider use_dynamic_url on web_accessible_resources (not yet tested with the dynamic import).
- Check minimum_chrome_version 121: the core uses Ed25519 in WebCrypto, which Chrome shipped later (believed 137, not verified here). On older versions Pipeup may fail to start.
- Check Voice in Chrome: if Chrome exposes only webkitSpeechRecognition, Voice shows its Safari and Apple sentences in Chrome (voice/src/addon.ts:141). Not tested.
- An in-extension disclosure and consent on first use for pictures, and before an add-on that sends is turned on (2026 disclosure rules). Voice and Live have consent panels; Share shows a note in the comment box and then sends automatically.
- A test page carrying data-pipeup-doc (and a sharing address) so reviewers can try Share and Live; put its URL in the reviewer notes.
- Listing images: 5 screenshots at 1280x800 with fictional names in light mode, a 440x280 small promo tile, and optionally a 1400x560 marquee tile.
- Category choice from the live pick list.
- Optional: verify pipeup-ai.github.io in Google Search Console for the Official URL, and set up a group publisher for several maintainers.
- After approval: give the store-assigned extension ID to the helper installer's documentation and the website's install link. The in-extension command already fills in the ID. Decide whether to pin the ID with a manifest key.
- Test the exact zip as a packed extension before uploading. The Web Store signs the package, so no signing step is needed.
- Add the emojibase-data (17.0.0, MIT) notice, or a third-party notices file, to the package. The minified emoji bundle carries none.
- Add the add-on build step (npm run build in libs/ts/addons) to apps/extension/README.md. Without it the build packs no add-ons.

### What the check found (fixed in the text above unless it needs code)
| Where | Problem | Fix |
|---|---|---|
| nativeMessaging justification; description (Send to my agent); reviewer notes | The setup command can't work today. npx --yes pipeup@0 browser install resolves to npm's pipeup 0.9.1, which has no browser command. A reviewer can't test Send to my agent, so nativeMessaging looks unneeded (Purple Potassium) and the feature looks broken (Yellow Magnesium). | Publish a pipeup release with the browser command before submitting and pin that version in browser.js and the notes, or remove nativeMessaging and Send to my agent from this build. |
| Description, nativeMessaging justification, reviewer notes | The helper works only on macOS and Linux, and nothing in the draft said so. Chrome reviewers often test on Windows or ChromeOS. | Say 'macOS and Linux' in the description, the justification and the notes, and that Windows is not supported yet. |
| Privacy answers: Limited Use certification (sell or transfer) | 'Transfers happen only when the reviewer acts' is untrue. Live keeps its consent flag {on, seen} in the site's own IndexedDB, so a page with a Pipeup document id can pre-set it and Live connects to relays and peers, sending comments, name and pointer, without the consent panel. Found by reading the code, not tested. | Keep Live's consent in chrome.storage.local (or ask each time) before ticking. Until then the certification is at risk. |
| storage justification | 'Keeping comments in the extension, rather than in the site's storage, keeps them out of the page's reach' is untrue: Pipeup's UI is an open shadow root in the page. 'Nothing in storage is sent anywhere unless the reviewer copies, saves or sends it' is untrue: Share sends new comments automatically while on, Live sends after consent, and the reply check runs automatically. 'Pipeup keeps everything in chrome.storage.local' is untrue: add-ons keep state in site storage. | Rewritten: lists what is kept, says comments leave through the features used (Share and Live while on), and that the page can read what Pipeup shows. |
| Description, 'Good to know' | 'Comments kept by the extension are out of the page's reach' contradicts the sentence before it. The comments shown on the page are the ones the extension keeps for that page. | Removed. The new 'Who else can see them' section says the page can read what Pipeup shows and what you type. |
| Description; Authentication privacy answer | My identity's recovery code is the private signing key, and it is drawn inside the page's open shadow root, so the site's scripts can read it. The draft said only 'It sends nothing'. | Disclosed in the description and the Authentication answer; maintainer asked to move the code off the page. |
| Description bullet 'Comment on ... any page you can open'; promo tiles 'any web page' | Overclaim. Only http and https pages work; browser pages, stores and file:// pages are blocked, and the popup says so. | 'Comment on ordinary web pages (http and https)' with the exception named; tiles say 'comment on web pages'. |
| Description opening paragraph | 'You and others can reply, edit, delete or resolve' is untrue: Edit and Delete appear only on the reviewer's own comments. | 'You can reply, resolve and reopen, and edit or delete your own comments.' |
| Description: Save comments 'as a Pipeup file to open again later' | Nothing in the extension opens a Pipeup file again; importFile exists only in the library API and the CLI. | 'a Pipeup file, which keeps every change and which Pipeup's command-line tools can read'. |
| Description and nativeMessaging justification: reply check | 'opening the toolbar menu also asks that helper' is untrue: the check runs after a row in the menu is used (done()) or after Send, not on opening. 'It sends only the page's id' hides that the id is made from the page's address. | 'After you use Pipeup's toolbar menu ... carries only a code made from the page's address.' |
| Description: Share | 'sends your comments, encrypted' suggests the site can't read them. The key is in the sharing address, and when the page names the address it holds the key. The draft also left out that Share brings others' comments back and holds earlier comments until the reviewer chooses. | Says anyone with the address, including a page that names it, can read them; adds receiving and the hold. |
| Description: Live; User activity answer | Left out the STUN servers that see the reviewer's IP address, and 'where you point and select' left out the typing indicator.  | Adds the STUN servers and 'when you are typing'. |
| Description: Save to GitHub | Didn't say what triggers it: a comment that mentions a gh: person, then Mention on GitHub in Pipeup's menu. | Trigger added. |
| Description: site storage line; removal line | Said Emoji, Share, Live and Voice keep choices in the site's storage, but not that the site can read and change them, nor that they survive removing the extension. 'To remove all comments and pictures, remove the extension' read as if that cleans up everything. | Both said; removal line names site storage as staying. |
| Description: identity line | 'a signing key that is the same on every site' – comments carry the public key, not the signing key. | 'a public key that is the same on every site'. |
| activeTab justification; single purpose | 'Pipeup is added only to the tab the reviewer chooses, when they press ...' leaves out Always on, which starts Pipeup with no press. Alt+Shift+P opens the menu; it doesn't add Pipeup itself. | Rewritten to say the menu or right-click item grants the tab, and Always on uses the optional host permission. |
| sidePanel justification | Left out two openings: Comment on this page and Start commenting while comments are pinned. | All openings listed; the picker listing is explained. |
| clipboardWrite justification | 'writes to it only on these presses' leaves out Copy in Pipeup's own menu on the page and Copy code in My identity. | All four Copy buttons listed. |
| Host permission justification | 'that one site (https://site/*)' – the request is the page's origin, which can be http. <all_urls> is broader than the code needs (it only requests http and https origins); minimum permission covers optional permissions. | Origin wording fixed; narrowing to http://*/* and https://*/* added to needsFromMaintainer. |
| Reviewer notes step 3 | 'The menu shows the page's address and one action' is untrue: it also shows Always on, the shortcut and Comments you've made. | Lists what the menu shows. |
| Reviewer notes step 5 | 'Press Comments: the side panel lists the comment' is untrue unless comments are pinned; unpinned, Comments opens Pipeup's own list on the page. The menu list also left out the name row, Send to my agent and Theme. | Step rewritten: Comments opens on the page, then Keep comments beside the page moves it to the side panel. |
| Reviewer notes step 4; screenshot 2 | 'A highlight and a pin mark the place' – pins are only for point comments (Pin, Option-click); a heading comment gets no pin. | 'The place is marked on the page.' |
| Reviewer notes: agent commands | 'browser reply' needs a page, --thread and the words; 'replies appear the next time the menu is opened' is untrue (see reply check). | Full usage given; timing corrected. |
| Reviewer notes: Source and rebuilding; Version field | 'pipeup/pipeup.esm.js is byte for byte the file published to npm as pipeup@<version>' is untrue: the build packs the local build, and libs/ts/pipeup/src differs from v0.9.1 in 19 files. The extension is not in tag v0.9.1 and the branch is 36 commits ahead of main, so the linked source can't rebuild the zip, yet the zip is labelled 0.9.1. | Claim removed; the notes ask for a tag; the version is left to the maintainer. |
| Reviewer notes: Add-ons | No way for a reviewer to test Share and Live, which need data-pipeup-doc. 'Save to GitHub needs a repository set in the settings' – the page can also name it. | Placeholder for a test page; repository source corrected. |
| Screenshot 5 caption | 'Your comments and choices, kept in this browser' is misleading on a screen listing add-ons that send, and some choices are in site storage. | 'Your comments, your settings and the add-ons'. |
| Product text (not the listing) | The toolbar menu says 'Comments stay in this browser until you send them' and Save to GitHub says 'nothing is sent until you submit it'. Both are untrue, and a reviewer comparing product to listing will see them. | In needsFromMaintainer. |
| Manifest minimum_chrome_version (not verified) | 121 may be too low: the core needs Ed25519 in WebCrypto, which Chrome shipped later (believed 137). | In needsFromMaintainer to check. |
| Voice in Chrome (not tested) | If Chrome exposes only webkitSpeechRecognition, Voice shows its Safari and Apple sentences in Chrome, which is untrue and names another browser. | In needsFromMaintainer to check. |
| Description and policy: site storage (not in the draft) | The core calls navigator.storage.persist() in the visited site's origin on every start, which changes how the site's storage is kept. | In needsFromMaintainer (skip it when the extension supplies the store). |

## Microsoft Edge Add-ons
**Checker's verdict:** Not ready to submit. Three things would fail certification as drafted. (1) Send to my agent can't be set up by anyone: `npx pipeup@0` resolves to npm's pipeup 0.9.1, which has no `browser` command (libs/ts/pipeup/cli/browser.mjs is not in tag v0.9.1). Policy 1.3 requires every feature to be testable. (2) In Edge, the setup command the extension itself shows (apps/extension/src/browser.js:41-45) leaves out --browser edge, so the host is installed into Chrome's folder and Edge never finds it. (3) There is no privacy policy URL. The 'byte for byte pipeup@0.9.1' and 'tag v0.9.1' claims are also untrue. Tag v0.9.1 contains no apps/extension, and 21 library source files have changed since that tag. So the package must ship as the next stable release, with the CLI published to npm. The listing also had untrue sentences, now fixed: reviewer step 6 said the sidebar opens unpinned, 'one action' left out the Always on row, 'only when you press' was contradicted by Always on, and 'PDFs' had no support in the code. The privacy answers had gaps, now fixed: Web history is now Yes, and Voice audio and the site storage that outlives uninstall are now stated. Character limits are fine: the long description is 5,968 characters after the fixes, and the 7 search terms add up to 18 words. Every permission in the Chromium manifest has a justification, and none is justified that the manifest lacks. Remote code: No is true.
### Listing fields
#### Extension name (from manifest 'name'; read-only in Partner Center)
_6 characters. Names no browser._
```text
Pipeup
```
#### Short description (from manifest 'description'; read-only in Partner Center)
_106 characters (under the 132 commonly assumed; Edge documents no limit). This proposed change to the manifest 'description' needs a rebuilt package. The current text ('...Your comments stay in this browser until you send them.') is true only with caveats: with Share on, new comments are sent automatically, and the page's scripts can read comments shown on it._
```text
Comment on the web pages you visit and pass the comments to the person or AI agent who asked for feedback.
```
#### Description (long), language en
_5,968 characters, counted (limit 250 to 10,000). Names no other browser. Covers policy 1.2.3 (Node.js and a local program), 1.4.1 (not on Windows yet) and 1.5.1 (data handling). Policy 1.1.8 doesn't apply: no browser setting changes. If any of these are fixed before release, remove the matching sentence: picture deleted with its comment, the add-ons moved out of the site's storage, a delete-all button, Windows host support. The setup-command sentence is true only once the extension shows --browser edge in Edge and the CLI is on npm._
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
- Send to my agent: sends the page's comments to an AI agent on this computer, and the agent's replies come back into the threads. This needs other software: Node.js, and a one-time setup command run in a terminal, which the extension shows. It can be set up on macOS and Linux; not on Windows yet.
- Add-ons you turn on in the extension's settings (see below).

ACCESS TO PAGES
- Installing gives Pipeup no access to sites. Unless you turn on Always on, Pipeup reaches a page only when you press its toolbar button, its shortcut or its right-click item, and only in that tab.
- Always on for this site starts Pipeup whenever you open that site. The browser asks your permission for that one site. Turning it off removes the permission. On pages from this computer (localhost), the menu offers Always on for local pages instead.
- Some pages are closed to extensions, such as the browser's own settings pages, the new tab page and the add-ons store. There, Pipeup says it can't run.

YOUR DATA
- No account, no sign-in, no analytics or telemetry. All of Pipeup's code is in the package; none is loaded from the web.
- Your comments, the words and place on the page they are about, the page's address and title, your name, your signing key and your settings are kept by the extension, in this browser. The developer receives none of it.
- When you make a comment, the extension takes a small picture of where it was, so a comment whose place has gone still shows what it was about. It shows a little of what was around the comment on screen. It is kept in this browser only and never sent, shared or copied. It stays when its comment is deleted. Turning off "Keep a picture of where each comment was made" in settings stops it and deletes the pictures kept.
- Editing or deleting a comment keeps the earlier text in its history. That history is in the Pipeup file, in what Send to my agent passes on, and in what Share and Live send.
- You have one identity on every site: a name you choose and a key that signs your comments. Comments you pass on from different sites can be linked to you.
- Comments leave this browser only when you copy or save them, press Send to my agent (to a program on this computer), or turn on an add-on that sends them (Share, Live, Save to GitHub). While Pipeup is on in a tab, the toolbar menu also asks the program on this computer, if you have set it up, for agents' replies to that page.
- While Pipeup is on a page, the comments shown and typed there are part of that page, so the page's own scripts could read them. The comments the extension keeps can't be read by the site.
- Emoji keeps your recent emoji and skin tone in the site's own storage, and Share, Live and Voice keep their choices there. The site can read them, and they stay after the extension is removed. Clearing the site's data removes them.
- Removing the extension removes the comments it kept; there is no button to delete them all yet. Files you saved, and what Send to my agent wrote on your computer, stay until you delete them.

ADD-ONS
- Emoji (on by default): every emoji for reactions. Sends nothing.
- Voice (off): dictate a comment with the browser's speech recognition, which may send your voice to the browser's online speech service unless it can work on this device. The browser asks for the microphone when you first press it. Pipeup keeps no audio.
- Share (off): sends your comments, encrypted, to a sharing address you set (a mailbox or PrivateBin address), and fetches others'. It works only on pages that carry a Pipeup document identity. Once on, your new comments are sent about every 10 seconds; earlier ones wait until you choose. If you set no address, the page may name one. The server sees your network address.
- Live (off): see others reviewing the same page at the same time. After you agree, it connects through public relays (relay.damus.io, nos.lol, relay.primal.net, or ones the page names) and connection servers run by Google and Cloudflare, then directly to the others. The others receive every comment on the page, your name and where your pointer is. Relays, servers and the others see your network address. It works only on pages that carry a Pipeup document identity.
- Save to GitHub (off): for a comment that mentions a GitHub user, opens a new issue on github.com with the comment, your name, the page title and its full address filled in. GitHub receives them when that tab opens; nothing is filed until you submit it there. Pipeup holds no GitHub sign-in.
- My identity (off): shows a recovery code for your identity, to copy or save, and restores one. Sends nothing.

LIMITS
- Send to my agent needs Node.js, and can be set up on macOS and Linux only for now.
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
_Required before submitting. It must refer to Microsoft Edge and match the description's Your data and Add-ons sections._
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
Pipeup works only on the tab where the person presses its toolbar button, its shortcut (Alt+Shift+P) or its right-click item, Comment with Pipeup. That press lets the menu show the page's address and title (the title names a saved file), lets Comment on this page add Pipeup to that tab, and lets the extension take a small picture of where each new comment was made (tabs.captureVisibleTab). The picture is cropped to the comment's place, kept in the extension's storage in this browser and never sent. Because of activeTab, installing gives no access to any site.
```
#### scripting
```text
Injects Pipeup's comment layer, which is packaged in the extension (start.js, pipeup/pipeup.esm.js), into the tab the person chose, after a press of the toolbar button, the shortcut or the right-click item. When the menu opens on a page without Pipeup, a packaged function checks whether the page already has Pipeup built in, so the extension can step aside. When the person turns on Always on for this site (or Always on for local pages), it registers the same packaged script for that site, starts it in the open tab, and unregisters it when they turn it off. Nothing remote is run.
```
#### storage
```text
Keeps everything the extension holds in this browser: each page's comments and their history, the list of pages commented on (address without query, title, time), the person's name and signing key, per-site look, Hide comments and first-run choices, settings (pinned, show button, pictures, add-ons, sharing address, GitHub repository), the pictures of where comments were made, the agent replies already shown, and the toolbar icon's light or dark look. Nothing is synced or sent to the developer.
```
#### unlimitedStorage
```text
Comments are kept as a growing history for every page reviewed, and each new comment has a small picture of where it was made. On long or many reviews this passes the default storage quota, and saving a comment would then fail. Everything stays in this browser; turning off pictures in settings deletes the pictures kept.
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
Send to my agent passes the page's comments (as Markdown and as a Pipeup file, with the page address and title) to a program on this computer, ai.pipeup.browser, which the person installs themselves with a one-time npx command; an AI agent reads them there, and its replies come back into the threads. While Pipeup is on in a tab, the toolbar menu also asks that program for agents' replies to the page, sending only the page's id. If the program is not installed, nothing happens. It contacts nothing else.
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
_Why:_ Comments quote the page (selected words, nearby text, element names, headings), and a small picture of the visible tab is taken for each new comment. All of it is kept in this browser. It leaves only when the person copies, saves or sends it, or turns on Share, Live or Save to GitHub. The developer receives none of it.
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
_Why:_ With Live on, presence is sent to the others on the page: pointer position, selection and typing. Off by default, and shown after a consent panel.
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
_Why:_ Required. It must refer to Microsoft Edge and cover: nothing goes to the developer, no telemetry; what is stored locally (comments with history, page list, name and key, settings, pictures); what goes into the site's own storage (Emoji, Share, Live, Voice), that the site can read it, and that it survives removal; what each route sends and to whom (Copy, Save, Send to my agent and its replies check, Share, Live, Voice audio to the browser's speech service, Save to GitHub); that the page's scripts can read comments shown on it; and how to delete (the Pictures switch, removing the extension, clearing site data, ~/.pipeup/browser).
#### Mature content
```text
No (unchecked)
```
### Notes for the store's reviewer
```text
No account, login or server is needed to test Pipeup.

TRY IT IN TWO MINUTES
1. Install, then pin Pipeup from the Extensions (puzzle-piece) menu.
2. Open an ordinary page, for example https://example.com or any news article. (On a page that has Pipeup built in, the extension steps aside and says so.)
3. Press Pipeup in the toolbar (or Alt+Shift+P). The menu shows the page's address and Comment on this page, with Always on for this site below. Press Comment on this page.
4. Select some words on the page, or click a picture or a block. A comment box opens beside it with the cursor in it. Type "Can this be shorter?" and save it. A highlight and a pin mark the place; the toolbar button shows the count.
5. Press Pipeup again. The menu is now Pipeup's menu. Choose Copy comments > As Markdown and paste into any text field: the comment, the words it is about and the page address. Save comments > As a Markdown file saves where the browser saves downloads.
6. Press Comments: every comment on the page opens in a panel on the page. Turn on Keep comments beside the page, and Comments opens them in Edge's sidebar instead.
7. Right-click a picture and choose Comment with Pipeup: the comment box opens on that picture.
8. Right-click the toolbar button > Extension options (or Comments you've made at the bottom of the menu) opens the list of pages commented on and the settings: Show Pipeup's button on pages, Keep a picture of where each comment was made, the add-ons, and Send to my agent's setup command.

WHAT THE SENSITIVE PERMISSIONS ARE FOR
- activeTab + scripting: the comment layer (pipeup/pipeup.esm.js, packaged) is injected only into the tab where the reviewer pressed the toolbar button, the shortcut or the right-click item, or on a site they set to Always on. When the menu opens on a page without Pipeup, a small packaged function checks whether the page already has Pipeup built in. tabs.captureVisibleTab (under activeTab) takes a small picture of where each new comment was made; it is cropped, kept in storage.local only and never sent.
- Optional host access (<all_urls>): nothing is granted at install. Only Always on for this site calls permissions.request, for that one origin (https://site/*), or for localhost, 127.0.0.1 and [::1] with Always on for local pages. The reviewer can decline. Turning the switch off unregisters the content script and removes the permission.
- nativeMessaging: Send to my agent passes the page's comments to a local program, ai.pipeup.browser, that the reviewer installs themselves. While Pipeup is on in a tab, the toolbar menu also asks that program for agents' replies ({type:"replies", doc:<page id>}). If the program is not installed, the call fails quietly and nothing else happens.
- unlimitedStorage: comments are kept as a growing history per page, with one picture per comment, on every page reviewed.
- clipboardWrite: Copy comments writes after an async request to the page for the comments, which can outlast the click's user activation.

SEND TO MY AGENT (OPTIONAL; NEEDS NODE.JS; MACOS OR LINUX ONLY)
1. Install Node.js.
2. Find Pipeup's ID on edge://extensions.
3. In a terminal: npx --yes pipeup@[release version] browser install --browser edge --extension-id <ID>
   This writes ~/.pipeup/browser-host.sh, and ai.pipeup.browser.json in Microsoft Edge's NativeMessagingHosts folder.
4. Restart the browser, open a page with comments, and press Send to my agent. The comments appear in ~/.pipeup/browser/<page id>/. Read them with npx --yes pipeup@[release version] browser read, and answer with npx --yes pipeup@[release version] browser reply <page> --thread <id> "Done". Open the menu again and the reply shows in the thread.
It can't be set up on Windows yet. Without the program, the row shows the setup command.

ADD-ONS
Extension options > Add-ons. Emoji is on by default and sends nothing. Voice, Share, Live, Save to GitHub and My identity are off. Changes apply the next time Pipeup starts on a page. Share and Live work only on pages that carry a Pipeup document identity: test page [maintainer to supply], sharing address [maintainer to supply]. Save to GitHub: set a repository (owner/repo), write a comment that mentions a GitHub user, then choose Mention @name on GitHub in Pipeup's menu. A github.com new-issue page opens; GitHub's own sign-in applies, and nothing is filed unless it is submitted there.

SOURCE AND BUILD
The extension's own files (popup, panel, background, start, browser, comments) are unminified. pipeup/pipeup.esm.js and addons/*.esm.js are the project's own code, bundled and minified with esbuild (and terser for the core). There is no remote code, eval or third-party runtime code (the emoji table is data from emojibase, MIT). pipeup.esm.js is byte for byte the release file of pipeup@[release version] on npm; its SRI hash is [hash printed by the build]. Source (MIT): https://github.com/pipeup-ai/pipeup , tag [release tag, maintainer to supply].
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
| 4 | Toolbar menu with Pipeup on: name 'Ada', Copy comments expanded (As Markdown, As text), Save comments, Send to my agent, Always on for this site. | 1280x800 PNG | Copy, save or send the comments to whoever asked. |
| 5 | Right-click menu on a picture in the page with Comment with Pipeup highlighted. | 1280x800 PNG | Right-click anything and comment on just that. |
| 6 | Comments you've made: a list of three fictional pages, then Settings (Keep a picture of where each comment was made, on) and the Add-ons list showing what each one sends. | 1280x800 PNG | Every page you've commented on, your settings and the add-ons. |

### Only the maintainer can supply
- Release first: publish the next stable version (library, CLI with `pipeup browser`, add-ons) to npm and tag it, then build and list that version. Today npm's pipeup@0 is 0.9.1, which has no browser command, and tag v0.9.1 contains no extension. Replace every [release version] and [release tag] in the reviewer notes.
- Fix before submitting: in Edge, the setup command the extension shows (apps/extension/src/browser.js:41-45) needs --browser edge. Without it the host goes into Chrome's folder and Send to my agent never works in Edge.
- Windows: hide or explain the Send to my agent row on Windows (policy 1.4.1), or add the HKCU/Software/Microsoft/Edge/NativeMessagingHosts registry key to the CLI. Edge reviewers usually test on Windows.
- Privacy policy page for Microsoft Edge on the website, and its URL (contents listed in the Privacy Policy URL answer). None exists in the repo.
- Check the Voice add-on in Edge: if Edge exposes only webkitSpeechRecognition, it shows the Safari and Apple texts (libs/ts/addons/voice/src/addon.ts:57-95). Choose those texts by detecting Safari instead.
- Change Save to GitHub's own text ('nothing is sent until you submit it there', libs/ts/addons/github/src/addon.ts:58,77): GitHub receives the text in the URL when the tab opens.
- Move Live's consent flag and Share's policy out of the site's IndexedDB into chrome.storage.local, so a page can't pre-set consent (libs/ts/addons/live/src/addon.ts:65-70,186-191).
- Partner Center developer account in the Microsoft Edge program: a personal Microsoft account (or GitHub sign-in), Individual type, country or region, contact info, acceptance of the App Developer Agreement, and a publisher display name (proposed 'Pipeup', max 50 characters).
- Support contact: confirm https://github.com/pipeup-ai/pipeup/issues or give an email address.
- Store art: a 300x300 logo (the build stops at 128 px), up to six 1280x800 screenshots taken in Edge on fictional pages, and the optional 440x280 and 1400x560 tiles.
- Decide whether to change the manifest 'description' to the proposed short description (needs a rebuilt package).
- Whether minified bundles are acceptable: ship unminified pipeup.esm.js and add-ons in the Edge package, or rely on the tag and SRI hash in the notes.
- A test page carrying a Pipeup document identity and a working sharing address, so reviewers can try Share and Live (policy 1.3).
- Whether to narrow optional_host_permissions from <all_urls> to http/https, and whether to try use_dynamic_url for web_accessible_resources (any site can detect the extension today).
- Third-party notice: the shipped emoji data comes from emojibase-data (MIT), but the package has no LICENSE or notice; add one.
- The extension spec (sections 5 and 6), the README and the start.js header still say nothing goes into the site's storage and the site can't read comments. Those claims are untrue: don't copy them into the listing or the privacy policy.
- Upload dist/pipeup-extension-[release version]-chromium.zip, never dist/chromium-test (it adds host_permissions <all_urls>). Microsoft signs the package on publish.
- Confirm against Partner Center's live form: the data-usage checkbox labels and the Category list are from memory, not Microsoft's docs.

### What the check found (fixed in the text above unless it needs code)
| Where | Problem | Fix |
|---|---|---|
| Reviewer notes (Send to my agent step 3); Description; nativeMessaging justification | The setup command can't work today. `npx --yes pipeup@0 browser install` resolves to the latest 0.x on npm, which is 0.9.1, and 0.9.1 has no `browser` command. A reviewer gets an unknown-command error, so Send to my agent and the nativeMessaging permission can't be tested. | Publish the release that contains the `pipeup browser` CLI to npm before submitting, and list that release (not 0.9.1). The reviewer notes now name the version as [release version]. |
| Extension UI: Send to my agent row and options page (apps/extension/src/browser.js:41-45) | In Edge the extension shows `npx --yes pipeup@0 browser install --extension-id <id>` with no `--browser edge`. The CLI defaults to chrome and writes the host file into Google Chrome's NativeMessagingHosts folder, which Edge doesn't read. So a reviewer who follows the extension's own instructions never gets Send to my agent working. | Fix the code before packaging: detect Edge (navigator.userAgentData brands, or an 'Edg/' token in the user agent) and add `--browser edge`. Until then the description must not say the extension shows a working command. The corrected reviewer notes give the right command. |
| Privacy Policy URL (Privacy) and privacy answer | There is no privacy policy, but one is required: the extension stores comments, names and pictures of the tab, and its add-ons transmit personal data. | Publish an Edge-specific privacy page before submitting (contents listed in the Privacy Policy URL answer) and enter its URL. |
| Reviewer notes, SOURCE AND BUILD | 'pipeup.esm.js is byte for byte the file published to npm as pipeup@0.9.1' is untrue, and 'tag e.g. v0.9.1' points at a tag with no extension in it. | Say instead that pipeup.esm.js is byte for byte the release file of pipeup@[release version] on npm, give the SRI hash the build prints, and name that tag. |
| Listing version / package name (packaging) | The zip is named 0.9.1 because libs/ts/pipeup/package.json still says 0.9.1, but it contains unreleased library code and an unreleased CLI. | Bump to the next stable version, release it, rebuild, and upload pipeup-extension-[release version]-chromium.zip. |
| Reviewer notes step 6 | 'Press Comments: every comment on the page opens in the browser's sidebar' is untrue unless pinned. Unpinned, Comments opens Pipeup's own panel on the page. | Step 6 now says the list opens on the page, and in Edge's sidebar after Keep comments beside the page is turned on. |
| Reviewer notes step 3; Screenshot 1 | 'The menu shows the page's address and one action: Comment on this page' is untrue. With Pipeup off, the menu also shows Always on for this site (or Always on for local pages), the shortcut and Comments you've made. | Say the menu shows the page's address and Comment on this page, with Always on for this site below. Screenshot 1 is reworded to match. |
| Description, ACCESS TO PAGES bullet 1 | 'Pipeup reaches a page only when you press its toolbar button, its shortcut or its right-click item' is contradicted by the next bullet: Always on starts it with no press. | Begin it with 'Unless you turn on Always on'. |
| Description, ACCESS TO PAGES bullet 3 | 'such as ... PDFs' has nothing behind it. The extension's own message names settings, the new tab page and the stores, not PDFs, and nothing in the code handles PDFs. | List what the extension itself says: settings pages, the new tab page and the add-ons store. |
| Description, first line; Short description | 'any web page you can open' and 'any web page' overclaim: browser pages and the store are closed to extensions, as the description itself says later. | Use 'the web pages you visit'. The proposed manifest description becomes 'Comment on the web pages you visit and pass the comments to the person or AI agent who asked for feedback.' (106 characters). |
| Privacy answer: Web history | 'No' contradicts the draft's own standard. Website content counts as 'Yes' for data kept locally and passed on when the person acts. By that standard the extension keeps a list of pages commented on (address, title, time) and per-origin entries for every site where Pipeup started, and it sends full page addresses with Send to my agent, Save to GitHub and the Markdown exports. | Answer Yes and say what it is: the pages commented on, kept locally, and a single page address with comments the person passes on. |
| Privacy answers (no row covers Voice audio) | Voice audio isn't disclosed in the data-usage answers. With Voice on, the browser's speech service may receive the microphone audio. | Mention it in the Personal communications reason, and in the privacy policy requirements. |
| Description, YOUR DATA (site storage) | The description didn't say that what is in the site's own storage can be read by the site and stays after the extension is removed. The next bullet ('Removing the extension removes the comments it kept') read as if removing the extension cleans up everything. | Add 'The site can read them, and they stay after the extension is removed.' |
| sidePanel justification | 'It opens only when the person presses Comments while pinned, or turns on Keep comments beside the page' leaves out two cases: Comment on this page while pinned, and Start commenting on a page whose comments are in the panel. Because side_panel.default_path is set, the browser can also list Pipeup in its own sidebar picker. | Say 'Pipeup opens it only when...' and list all three presses. |
| clipboardWrite and storage justifications | clipboardWrite leaves out the Copy in Pipeup's own menu on the page and the My identity recovery code. storage leaves out the toolbar icon's light or dark choice and the per-site record of where Pipeup was started. | Added to both justifications. |
| scripting justification | 'after a press of the toolbar button or the right-click item' leaves out the keyboard shortcut and turning on Always on, which both inject start.js. | Name all four. |
| Search terms note | The note says the terms add up to 17 words. They add up to 18 (4+2+3+2+3+2+2), which is still within the limit of 21. | Correct the note. |
| Screenshot 6 caption | 'Your comments and choices stay in this browser' is misleading on a screen that also lists add-ons which send comments, and Emoji writes to the site's storage. | Use 'Every page you've commented on, your settings and the add-ons.' |
| Reviewer notes step 8 | 'Extensions > Pipeup > Extension options' isn't the path in Edge. | Give both routes. |
| Reviewer notes, agent reply command | `npx --yes pipeup@0 browser reply` is incomplete: it needs a page, --thread and the words. | Give the full form, with `browser read` to find the thread id. |
| Product UI: Voice add-on in Edge (policy 1.1.2, other browsers) | The Voice add-on picks its 'webkit' texts whenever unprefixed SpeechRecognition is missing. Those texts name Safari and Apple ('Safari uses Apple's speech recognition...'). If Edge exposes only webkitSpeechRecognition, an Edge user turning on Voice reads about Safari and Apple. That would be untrue, and it names another browser. | Check this in Edge before submitting. Choose the Safari texts by detecting Safari, not by which constructor is present. |
| Product UI: Save to GitHub add-on wording | The add-on's own text says 'nothing is sent until you submit it there', but the comment, name, title and full address are in the github.com URL, so GitHub receives them when the tab opens. The listing is truthful, but the in-product claim misleads (policy 2.1). | Change the add-on text to say nothing is filed until you submit it there, and that GitHub receives the text when the page opens. |
| Description, Live 'After you agree' | The consent flag Live checks is kept in the site's own IndexedDB, so a hostile page could pre-set it and skip the consent panel. This was found by reading the code, not tested. | Move Live's consent (and Share's policy) into chrome.storage.local before release. The listing wording stays and becomes true. |
| Windows (policy 1.4.1) | Edge reviewers usually test on Windows. There, Send to my agent shows a command that fails ('isn't supported yet'), and the extension shows no message saying it isn't available on Windows. | Hide or explain the Send to my agent row on Windows, or add the HKCU/Software/Microsoft/Edge/NativeMessagingHosts registry key to the CLI. The listing and notes already say 'not on Windows yet'. |

## Firefox Add-ons (AMO)
**Checker's verdict:** Not ready to submit. The listing copy is corrected and every field fits its limit, but three things outside the copy would get it rejected: (1) the manifest declares data_collection_permissions required ['none'], although Share sends comments automatically and Send to my agent passes them to a native app; (2) tag v0.9.1 does not contain apps/extension, so reviewers cannot rebuild the minified files from that source; (3) Live keeps its Go-live consent in the visited site's IndexedDB, where a page could set it in advance. Two more practices are risky under 6.3 even though the listing now discloses them: Emoji writes to the site's localStorage, and the open shadow root lets the page read comments. The copy also had untrue sentences: 'nothing stored on a server', 'no fetch', 'the site cannot read the stored comments', 'any web page', and test step 3. web-ext lint on dist/firefox: 0 errors, 2 warnings, both explained in the notes.
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
_6,282 characters. If the code fixes land (a closed shadow root; Emoji and add-on state in extension storage; Voice left out), cut the matching sentences._
```text
Pipeup lets you comment on web pages and then hand those comments to the person or the AI agent who asked for your feedback.

**How it works**

1. Press Pipeup in the toolbar (or Alt+Shift+P) and choose **Comment on this page**.
2. Click a block, a picture or a spot on the page, or select some words, and write your comment. You can also right-click and choose **Comment with Pipeup**.
3. When you are done, open the toolbar menu again and choose how the comments go out: **Copy comments** (as Markdown or as text), **Save comments** (a Markdown file or a Pipeup file, saved to your downloads), or **Send to my agent**.

Comments can open beside what they are about, or sit in Firefox's sidebar if you choose **Keep comments beside the page**. **Comments you've made**, on the extension's options page, lists every page you have commented on. Pipeup is added to a page only when you choose Comment on this page or Comment with Pipeup there, or when you turn on **Always on for this site**, which starts it each time you open that site; Firefox asks you to allow that one site first. Firefox keeps some pages closed to add-ons, such as its own pages and addons.mozilla.org.

**Where your comments are kept**

- Comments, your display name and your choices are kept by the extension, in this copy of Firefox. There is no account and no sign-in.
- Your display name and a signing key made in this browser are added to every comment you write, on every site. Comments you export or share from different sites can therefore be linked to the same person.
- When you start a comment, Pipeup also keeps a small picture of the visible page around it, so you can see where it was if the page changes. The picture stays in this browser and is never copied, saved, sent or shared. It includes whatever was on screen next to the comment. Pictures are on by default. Turning them off in the extension's settings deletes all kept pictures. Deleting a comment does not delete its picture.
- Editing or deleting a comment keeps the earlier text in the extension's record of the page. That record, with the earlier text, is included in a saved Pipeup file, in Send to my agent, and in Share and Live if you turn them on.
- There is no button yet to delete kept comments. Removing the extension removes what the extension keeps, but not what is kept in sites' own storage (see the add-ons below) or in Send to my agent's folder.
- While Pipeup is shown on a page, that page's own scripts can read the comments shown or typed there, because Pipeup's comments are drawn inside the page. The site cannot read the extension's storage or the comments kept for other pages.

**What leaves your browser, and when**

The extension has no analytics or telemetry and loads no code from the web. With the add-ons that are off by default left off, comments leave Firefox only when you copy them, save them, or press Send to my agent.

- **Copy comments** puts them on your clipboard. **Save comments** writes a file to your downloads folder.
- **Send to my agent** (optional) gives the page's comments, its full address and its title to a program on your own computer, through Firefox's native messaging. It needs a free, open-source helper you install once with one command, which the menu shows. The helper writes the comments to a folder on your computer for your agents, and passes their replies back into the threads. After most actions in the toolbar menu on a page where Pipeup is on, Pipeup also asks that helper whether there are new replies; it sends only the page's comment id, which is made from the page's address. If the helper is not installed, nothing happens. Removing the extension does not remove the helper or its folder.

**Add-ons, which you turn on in the extension's settings**

- **Emoji** (on by default): an emoji picker. It sends nothing. It remembers your recent emoji and skin tone in the visited site's own storage, where that site can read them.
- **Voice** (off): dictation through the browser's speech recognition. Firefox does not offer speech recognition by default, so in Firefox Voice turns itself off.
- **Share** (off): sends your comments, encrypted, over HTTPS to a sharing server, so others on the same page can see them. It works only on pages built for it. Once on, your new comments are sent automatically. The server is the sharing address you set, or, if you leave it empty, the one the page names. The server sees your IP address and when and how much you send.
- **Live** (off): connects you with others on the same page, after you choose Go live. It works only on pages built for it. It uses public Nostr relays (relay.damus.io, nos.lol, relay.primal.net, or relays the page names) and STUN servers (stun.l.google.com, stun.cloudflare.com) to connect, then sends the page's comments, your name and where your pointer is directly to the other people. Relays, STUN servers and the other people see your IP address.
- **Save to GitHub** (off): when a comment mentions someone on GitHub, it can open a new GitHub issue page with the comment, your name, the page title and the full page address in its link. GitHub receives that text when the tab opens; nothing is filed until you submit it there. The repository is the one you set, or the one the page names. Pipeup keeps no GitHub sign-in.
- **My identity** (off): shows a recovery code for your Pipeup identity so you can copy it, save it or restore it in another browser. It sends nothing. Anyone with the code can write comments as you.

Share, Live and Voice keep their own settings, including Live's Go live choice, in the visited site's storage, where that site can read and change them.

**Permissions**

- Access to the current tab when you press Pipeup, its shortcut or its right-click item. Installing asks for no access to sites.
- Access to a site you choose for Always on for this site, asked for when you turn it on and removed when you turn it off.
- Storage, including unlimited storage, for comments and pictures kept in this browser.
- Clipboard (write only), for Copy comments. Right-click menu, for Comment with Pipeup.
- Exchange messages with programs other than Firefox, for Send to my agent.

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
_The policy is 4,383 characters._
```text
Ticked. Policy text:

# Pipeup privacy policy

Pipeup is a free, open-source add-on for commenting on web pages. It has no account, no server of its own, no analytics and no telemetry. This policy says what it keeps, what leaves your browser, and when.

## What Pipeup keeps in your browser

Kept by the extension, in this copy of Firefox:

- **Your comments**, page by page: the words you write, your display name, the time, and a note of where on the page each comment is (the words you chose with the text around them, what the element is and is called, which can be a link address or a picture's file name, and the headings above it). Edits and deletes are added to this record; the earlier text stays in it.
- **A list of pages you commented on**: each page's address (without the part after ? or #), its title and when its comments last changed.
- **Your choices for each site where you started Pipeup** (look, Hide comments), which also amounts to a list of those sites, and the sites you set to Always on.
- **Your Pipeup identity**: your display name and a signing key made in your browser. The same key signs your comments on every site, so comments you export or share from different sites can be linked to you.
- **Pictures of where comments were made**: a small picture of the visible page around each comment you start. On by default. Turning pictures off deletes them all. Deleting a comment does not delete its picture.
- **Your settings**: add-ons turned on, a sharing address and GitHub repository if you set them, and which agent replies were already added.

There is no button yet to delete all of this. Removing the extension removes it.

Kept in the visited site's own storage (the site can read and change it, and it stays after you remove the extension until you clear that site's data):

- Emoji (on by default): your recent emoji and skin tone.
- Share, Live and Voice, if you turn them on: their own settings for that page, including Live's Go live choice.

## What the site can see

While Pipeup is shown on a page, that page's own scripts can read the comments shown or typed there. They cannot read the extension's storage or comments kept for other pages. If you leave the sharing address or GitHub repository empty, a page can name its own, and it can name Live's relays.

## What leaves your browser

Nothing leaves your browser except in these cases:

- **Copy comments**: to your clipboard.
- **Save comments**: a file in your downloads folder. A Pipeup file includes edited and deleted text.
- **Send to my agent**: when you press it, the page's comments (including edited and deleted text), its full address and its title go to a program on your own computer, through Firefox's native messaging, and are written to a folder there for your agents. You install that program yourself; it is optional. After most actions in the toolbar menu on a page where Pipeup is on, Pipeup also asks that program for replies, sending only the page's comment id, which is made from the page's address. The extension sends nothing over the internet by this route.
- **Share** (add-on, off by default): your comments, including edited and deleted text, encrypted, go over HTTPS to the sharing server you set, or that the page names. Once on, new comments are sent automatically. The server sees your IP address and when and how much you send.
- **Live** (add-on, off by default, and only after you choose Go live): connection messages go through public Nostr relays (relay.damus.io, nos.lol, relay.primal.net, or relays the page names) and STUN servers (stun.l.google.com, stun.cloudflare.com). The page's comments (including edited and deleted text), your name and your pointer's place go directly to the other people on the page. All of them see your IP address.
- **Save to GitHub** (add-on, off by default): when you choose it, it opens github.com with the comment, your name, the page title and its full address in the link. GitHub receives them when the page opens. GitHub's own privacy policy applies there.
- **Voice** (add-on, off by default): uses the browser's speech recognition. Firefox does not offer it by default, so Voice turns itself off in Firefox.

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
_2,993 characters. Fill in <version>, the Node version and the test page, and keep the total at 3,000 or below. <version> must be a tag that contains apps/extension._
```text
No account needed. To try it:
1. Open https://example.com (not the Pipeup website: it has Pipeup built in, so the add-on steps aside).
2. Press Pipeup in the toolbar (or Alt+Shift+P). The menu shows the page address. Choose Comment on this page.
3. Click the paragraph, type "Check this sentence" and press Enter. The badge shows 1.
4. Press Pipeup again: Copy comments > As Markdown puts them on the clipboard; Save comments saves a .md file. The options page (about:addons) lists the page under Comments you've made.
5. Right-click a word > Comment with Pipeup opens a comment box on it.
Share and Live work only on pages whose HTML sets data-pipeup-doc; test page: [maintainer to supply]. Voice turns itself off in Firefox.

Permissions:
- activeTab + scripting: inject start.js into the tab the user pressed Pipeup on. Opening the menu runs a small check for a built-in Pipeup. UI lives in a shadow root; comment text is rendered as text only.
- optional_host_permissions <all_urls>: never at install. permissions.request for one origin (or localhost, 127.0.0.1, [::1]) when the user turns on Always on; removed when turned off. Only http(s) origins.
- tabs.captureVisibleTab (under activeTab): a small picture around each new comment, kept in storage.local only, never sent.
- storage + unlimitedStorage: comments (append-only log per page) and pictures kept locally.
- clipboardWrite: Copy writes after an async round trip to the tab, which can outlast user activation.
- contextMenus: Comment with Pipeup.
- nativeMessaging: Send to my agent. Host ai.pipeup.browser, installed by the user with `npx --yes pipeup@0 browser install --browser firefox` (source libs/ts/pipeup/cli). Messages: {type:'send', doc, url, title, markdown, file} on the user's press; {type:'replies', doc} after most toolbar actions while Pipeup is on. Fails silently if not installed.
- web_accessible_resources pipeup/*, addons/*: start.js import()s them by runtime.getURL.
No remote code, no eval, no analytics. Its only fetch reads the picture's data: URL. Network code is only in the off-by-default Share, Live and Save to GitHub add-ons.
web-ext lint: 0 errors, 2 warnings: sidePanel.open (Chrome branch, feature-checked) and openDialog in addons/identity.esm.js (Pipeup's own host.openDialog, not window.openDialog).

Source: https://github.com/pipeup-ai/pipeup, tag v<version>, also attached. pipeup/pipeup.esm.js and addons/*.esm.js are minified (esbuild + terser + property mangling; not obfuscated). Rebuild from the repo root:
cd libs/ts/pipeup && npm ci && npm run build
cd ../addons && npm ci && npm run build
cd ../../.. && node tools/build-extension.mjs
Needs Node [version: maintainer to supply] and the zip CLI. Output: apps/extension/dist/firefox. Root *.js, *.html, *.css are unminified.
Third-party: none at run time. The emoji table (libs/ts/addons/emoji/src/data.ts, committed) was generated from emojibase-data (MIT), https://www.npmjs.com/package/emojibase-data/v/17.0.0 [confirm version].
```
#### Release notes (first stable version whose tag contains apps/extension, max 3000)
_356 characters._
```text
First release on Firefox Add-ons. Comment on web pages from the toolbar, the shortcut Alt+Shift+P or the right-click menu; Copy comments, Save comments and Send to my agent; comments kept beside the page in Firefox's sidebar; Always on for this site; add-ons Emoji (on), Share, Live, Save to GitHub and My identity (off). Voice is not available in Firefox.
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
_Firefox for Android lacks sidebar_action, commands, menus and native messaging. docs/EXTENSION_SPEC.md section 2 lists Firefox on Android as a target; the spec should say Android comes later._
```text
Firefox (desktop) only
```
#### Source code question (upload step)
_Tag v0.9.1 does not contain apps/extension. Include the lockfiles for libs/ts/pipeup, libs/ts/addons and apps/extension, plus a short reviewer README with the same commands as the Notes._
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
Adds Pipeup's script (start.js) to the tab when you choose Comment on this page or Comment with Pipeup. The script runs in the extension's isolated world, draws its interface in a shadow root and shows comment text as text only. When the menu opens, a small function checks whether the page already has Pipeup built in, so the extension can step aside there. When you turn on Always on for this site, or Always on for local pages, it registers the script for that site; turning the switch off removes it.
```
#### storage
```text
Keeps the extension's data in this browser: comments for each page, the list in Comments you've made, your display name and signing key, your choices for each site, your settings and add-on choices, and the pictures of where comments were made. The extension itself keeps nothing on a server. Share, an add-on that is off by default, sends comments to a sharing server when you turn it on.
```
#### unlimitedStorage
```text
Each page's comments are kept as a record that only grows. Each new comment you start also keeps a small picture (JPEG, at most 480 px wide) of where it was made. Across many pages, this permission keeps that local data from running into a storage quota that would make saving comments fail. Turning pictures off deletes all kept pictures.
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
Used by Send to my agent, which is optional. When you press it, the page's comments, full address and title go to a program on your own computer (native host ai.pipeup.browser). You install that program once with npx --yes pipeup@0 browser install --browser firefox, and it is open source (libs/ts/pipeup/cli in the repository). It writes the comments to a local folder for your agents and returns their replies, which Pipeup adds to the threads. After most toolbar-menu actions while Pipeup is on, Pipeup asks the program for new replies, sending only the page's comment id, which is made from the page's address. If the program isn't installed, these calls fail silently. The extension sends nothing over the internet by this route.
```
#### optional_host_permissions: <all_urls>
```text
Nothing is granted at install. When you turn on Always on for this site, Pipeup asks Firefox for access to that one site (for example https://example.com/*). On a local page, Always on for local pages asks for http://localhost, http://127.0.0.1 and http://[::1]. With that access, Pipeup starts each time you open the site, without a press. Turning the switch off removes the access. Only http and https sites are ever requested, so the declaration could be narrowed to http://*/* and https://*/*.
```
#### tabs.captureVisibleTab (covered by activeTab, no separate permission)
```text
After you start a comment, Pipeup takes a picture of the visible tab, cut to the comment's place plus a small margin. It is stored only in this browser and shown only to you, in the sidebar, when a comment's place can no longer be found on the page. It is never copied, saved, sent or shared. You can turn pictures off, which deletes them all.
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
The extension's options page, which is also Comments you've made. It lists the pages you have commented on and holds the settings: pictures on or off, Show Pipeup's button on pages, add-ons, the sharing address, the GitHub repository, and the Send to my agent setup command.
```
#### browser_specific_settings.gecko (id extension@pipeup.ai, strict_min_version, data_collection_permissions)
```text
The add-on ID, the minimum Firefox version and the data-collection declaration. The current build declares required ['none']. That is accurate for the extension's own code, but not for the add-ons or Send to my agent. Before submitting, add the optional data types from the privacy answers, request them when those features are turned on, and set strict_min_version to 140.0.
```
### Privacy and data-use answers
#### This add-on has a privacy policy (checkbox), then the policy text
```text
Yes. Tick it and paste the policy text from the listing. Optionally, also host it on the website and link to it.
```
_Why:_ Data leaves the device through Send to my agent (to a native app) and through the Share, Live and Save to GitHub add-ons. The submission guide requires a policy whenever any data is sent.
#### Data collection declaration (manifest gecko.data_collection_permissions; shown on the install prompt)
```text
Required before submitting: required ['none'] plus optional ['websiteContent', 'browsingActivity', 'personalCommunications', 'personallyIdentifyingInfo', 'websiteActivity']. Ask for them with permissions.request({data_collection: [...]}) when Share, Live or Save to GitHub is turned on, or when Send to my agent is first pressed. Raise strict_min_version from 128.0 to 140.0 so Firefox's built-in consent applies. Update docs/EXTENSION_SPEC.md section 6 first. Submitting with ['none'] only is likely to be rejected.
```
_Why:_ Policy 6.2.1 requires an accurate declaration, and section 6 covers native apps. Share automatically sends comments (websiteContent, personalCommunications), the page address (browsingActivity) and your name (personallyIdentifyingInfo) once it is on. Live sends the whole comment log, your name and your pointer position (websiteActivity) to peers. Save to GitHub puts the comment, name, title and full URL into a github.com URL. Send to my agent passes the full URL and all comments to the native host. The extension's own code makes no network requests, so 'none' is right for what is required.
#### What is stored on the device
```text
On the device: comments with their full edit history; the list of pages commented on (address without query or fragment, title, time); per-site choices, which also list the sites where Pipeup was started; the Always-on sites; the display name and the signing key (unencrypted); settings, including the sharing address and GitHub repository; and pictures of the visible tab around each comment you start. In the visited site's own storage: Emoji's recent emoji and skin tone, and the Share, Live and Voice settings. With Send to my agent, in ~/.pipeup/browser: page.json, comments.md, comments.json and replies.json.
```
_Why:_ The policy text lists each of these. What is kept in a site's storage and in the helper's folder stays after the extension is removed.
#### Requires payment, non-free services or software, or additional hardware (checkbox)
```text
No
```
_Why:_ Everything is free. Send to my agent's helper is free, open source and optional, and the description says so.
#### Does the add-on load remote code?
```text
No (a policy, not a form question)
```
_Why:_ It imports only its own packaged files with runtime.getURL. There is no eval, new Function, WebAssembly or remote script, and no update_url. The updates add-on is left out of the build.
#### Analytics or telemetry?
```text
None
```
_Why:_ There is no XHR, sendBeacon, WebSocket or network fetch in the extension scripts or the core library. The only fetch reads the picture's own data: URL. Network code exists only in the off-by-default Share, Live and Save to GitHub add-ons.
### Notes for the store's reviewer
```text
Paste the Notes for Reviewers text from the listing (2,993 characters). In short:
- **Try it, no account:** open https://example.com, press Pipeup (or Alt+Shift+P), choose Comment on this page, click the paragraph, type a comment and press Enter; the badge shows 1. Press Pipeup again and choose Copy comments > As Markdown, or Save comments. The options page lists the page under Comments you've made. Right-click a word > Comment with Pipeup.
- **Share and Live** need a page whose HTML sets data-pipeup-doc; give reviewers a test page. Voice turns itself off in Firefox.
- **Permissions:** activeTab + scripting inject start.js on a press. Optional host access is requested for one site when Always on is turned on, and removed when it is turned off. captureVisibleTab keeps a picture locally only. clipboardWrite covers a copy after an async round trip. contextMenus is for Comment with Pipeup. web_accessible_resources are the add-on's own ES modules.
- **Send to my agent:** nativeMessaging to ai.pipeup.browser, installed with `npx --yes pipeup@0 browser install --browser firefox` (source libs/ts/pipeup/cli). It sends {type:'send'} on the press, and {type:'replies', doc} after most toolbar actions. Without the host it fails silently.
- **Source and rebuild:** attach a git archive of the release tag that contains apps/extension (v0.9.1 does not). Run npm ci and npm run build in libs/ts/pipeup, then in libs/ts/addons, then node tools/build-extension.mjs (needs the zip CLI). Compare the result with apps/extension/dist/firefox.
- **Lint:** web-ext lint gives 0 errors and 2 warnings: sidePanel.open, and Pipeup's own host.openDialog. Both are explained in the notes.
- **Third-party:** the committed emoji table was generated from emojibase-data 17.0.0 (MIT).

Before submitting:
- Fix the data-collection declaration and set strict_min_version to 140.0.
- Move Live's consent and Share's state out of the site's storage, or leave those add-ons out of the Firefox build.
- Test that the rebuild is byte-identical on Ubuntu ARM64 with Node 24, or state the environment used.
- Make the build fail, not just warn, when the add-ons aren't built.
- Upload pipeup-extension-<version>-firefox.zip, never the dist/firefox-test folder.
```
### Screenshots
| # | Shows | Size | Caption |
|---|---|---|---|
| 1 | 1. A comment on a page. An ordinary article page (fictional site, light mode), with a block highlighted and an open comment from 'Sam' beside it, plus one reply from 'Ada'. The toolbar button shows its count. | 1600x1200 PNG (4:3) | Press Pipeup and choose Comment on this page, then point at words, a picture or a spot and write. |
| 2 | 2. The toolbar menu with Pipeup on: the page address at the top, the name 'Lee', Copy comments, Save comments, Send to my agent, Theme, Comments with its count, Keep comments beside the page, Hide comments, Start commenting, Always on for this site, and Turn off on this page. | 1600x1200 PNG (4:3) | The toolbar menu: copy or save the comments, or send them to your agent. |
| 3 | 3. Comments in Firefox's sidebar. Keep comments beside the page is on. The sidebar lists the threads with the @ For you and Resolved filters, and one thread is open with Reply and Resolve. | 1600x1200 PNG (4:3) | Keep comments beside the page: the page's comments in Firefox's sidebar. |
| 4 | 4. The right-click menu on a picture, with 'Comment with Pipeup' highlighted. | 1600x1200 PNG (4:3) | Right-click words, a picture or a link and choose Comment with Pipeup. |
| 5 | 5. Copy comments > As Markdown, with the copied Markdown shown in a plain text editor beside the page (fictional page and names). | 1600x1200 PNG (4:3) | Copy comments as Markdown and paste them wherever the person or agent who asked will read them. |
| 6 | 6. The options page. Comments you've made lists three fictional pages, newest first. The settings show Keep a picture of where each comment was made (on), Show Pipeup's button on pages (off), and the add-ons, with Emoji on and the rest off. | 1600x1200 PNG (4:3) | Comments you've made lists every page you commented on. Add-ons are off until you turn them on, except Emoji. |
| 7 | 7. Always on for this site, at the moment Firefox asks to allow access to that one site. | 1600x1200 PNG (4:3) | Always on for this site asks Firefox for that one site only. |

### Only the maintainer can supply
- A Mozilla account with two-step sign-in on (a 6-digit authenticator), with the recovery codes kept. Accept the Add-on Policies and the Distribution Agreement; both change on 1 Dec 2026. Add co-maintainers as Authors.
- A support email you can publish and will monitor, to replace '[support contact: maintainer to supply]' in the listing and the policy. Keep the account email monitored for review messages.
- The privacy policy's 'Last updated' date, and optionally a hosted copy.
- The data-collection declaration, which is required: required ['none'] plus optional websiteContent, browsingActivity, personalCommunications, personallyIdentifyingInfo and websiteActivity, requested when the add-ons or Send to my agent are first used, and strict_min_version 140.0. Agree the change to docs/EXTENSION_SPEC.md section 6 first.
- The version to list: the first stable release whose tag contains apps/extension (tag v0.9.1 does not), and that tag's source archive.
- How to fix Live's consent flag and Share's state in the site's IndexedDB: move them to extension storage, or leave Live and Share out of the Firefox build. Also decide whether to move Emoji's recent list out of the site's localStorage, use a closed shadow root in the extension, leave Voice out of the Firefox build, and fix Save to GitHub's 'nothing is sent' text. Agree the spec first, then cut the matching sentences from the description and the policy.
- Correct the spec and README claims that are false today: 'the site can't read' comments, 'nothing goes into the site's own storage' (docs/EXTENSION_SPEC.md, apps/extension/README.md:5, start.js:1-2), and 'the extension sends nothing anywhere' (the replies check runs on its own).
- A page with data-pipeup-doc (and a sharing address) that reviewers can use to try Share and Live, for the Notes.
- Check in Firefox 140 whether navigator.storage.persist() (mount.ts:175) shows a prompt on the site. If it does, skip the call in the extension or disclose it.
- Platform scope: desktop only. docs/EXTENSION_SPEC.md section 2 still lists Firefox on Android.
- The Node and npm versions the rebuild was checked with, a check that the rebuild is byte-identical on Linux, and a build that fails, not just warns, when the add-ons are missing.
- Confirm that libs/ts/addons/emoji/src/data.ts was generated from emojibase-data 17.0.0 (the lockfile version), and consider shipping its MIT notice.
- The screenshots at 1600x1200 (4:3), in light mode, with fictional pages and the names Sam, Ada and Lee.
- Uploading, answering reviewers and publishing are the maintainer's call. AMO signs the add-on after review.

### What the check found (fixed in the text above unless it needs code)
| Where | Problem | Fix |
|---|---|---|
| Manifest data_collection_permissions (privacy answer 2; gecko justification) | The build declares required ['none'] only. Share sends comments and the page address automatically once it is on. Live sends comments, your name and your pointer to peers. Save to GitHub puts the comment, your name and the full URL in a github.com link. Send to my agent passes the full URL and all comments to a native app, which section 6 covers. That makes the declaration inaccurate under 6.2.1, which is not a matter of choice. The draft's optional list also leaves out the display name (personallyIdentifyingInfo) and Live's pointer and presence (websiteActivity). | Before submitting: required ['none'] plus optional ['websiteContent','browsingActivity','personalCommunications','personallyIdentifyingInfo','websiteActivity']. Request them with permissions.request({data_collection}) when Share, Live or Save to GitHub is turned on, or when Send to my agent is first pressed. Set strict_min_version to 140.0. Change the spec first (docs/EXTENSION_SPEC.md section 6). |
| Source code question / Notes for Reviewers (tag v<version>) / release notes 'version 0.9.1' | The extension is not in tag v0.9.1. apps/extension exists only on feat/browser-extension, 36 commits ahead of main. A source archive of v0.9.1 cannot rebuild the uploaded zip, and reviewers must be able to reproduce the minified files exactly. | List the first stable release whose tag contains apps/extension (the one after 0.9.1). Use that version in the release notes and the Notes, and archive that tag. |
| Description and policy: Live 'after you choose Go live' | Live keeps {on, seen} (seen means the consent panel was shown) in the IndexedDB database pipeup-addon-live, in the visited site's origin. A page that carries data-pipeup-doc can write {on:true, seen:true}, and Live then connects to relays and peers without showing the consent panel. Found by reading the code, not tested. That breaks the 6.2 consent rules, whatever the listing says. | Fix the code before submitting: keep add-on state, at least Live's consent and Share's policy, in extension storage, or leave Live and Share out of the Firefox build. Until then, the corrected copy says this state is in the site's storage, where the site can change it. |
| Description and policy: Emoji in the site's localStorage; the site reads comments | Emoji, on by default, writes your recent emoji and skin tone to the localStorage of every site you comment on. Pipeup's UI is an open shadow root the page can read. Section 6.3 prohibits leaking user-specific information to websites, and disclosure does not cure it. A strict reviewer can reject on either point. | In code: keep Emoji's recent list in the extension's storage, and use a closed shadow root in the extension. Then cut the matching sentences. The corrected copy discloses both as they are today. |
| Permission justification: storage | 'Keeps everything in this browser ... Nothing is stored on a server.' Share, once on, stores comments on a sharing server. Emoji, Share, Live and Voice keep data in the site's own storage, not the extension's. | Say that the extension's own storage is in this browser and that the extension keeps nothing on a server itself. Name Share, which is off by default, as the exception. |
| Privacy answer: analytics | 'There is no fetch ... in the extension scripts.' background.js calls fetch() on the capture's own data: URL. | Say the only fetch reads the picture's own data: URL. |
| Description: 'The site cannot read the comments the extension has stored' | The comments stored for the page are exactly what Pipeup draws into the open shadow root, so the site can read them. | 'The site cannot read the extension's storage or the comments kept for other pages.' |
| Description: 'any web page you can open'; 'Nothing is added to a page until you press Pipeup on it' | Firefox keeps some pages closed to add-ons, and the popup has a blocked state for them. Pressing Pipeup only opens the menu. Pipeup is added by Comment on this page, by Comment with Pipeup, or automatically on Always-on sites. | Say 'web pages', name the closed ones, and list the three ways Pipeup is added. |
| Summary | 'any web page' overclaims, as above, and 'to who asked' is ungrammatical. | 'Comment on web pages, then hand the comments to whoever asked.' (62 characters; name + summary = 68) |
| Description: cross-site identity | The description doesn't say that one signing key, made in the browser, is stamped on every comment on every site, so exported or shared comments from different sites can be linked. Only the privacy policy says it. | Add a bullet under 'Where your comments are kept'. |
| Privacy policy: what is kept | It leaves out the per-site choices (prefs:<origin>), which amount to a list of every site where Pipeup was started, even with no comments. It also leaves out the Always-on sites and the ids of agent replies already added. | List them. |
| Privacy policy: 'Nothing leaves unless you do one of these'; the replies check | The replies check is automatic, and Share sends automatically. The 'comment id' sent to the helper is page-<fingerprint(origin+pathname)>, which is made from the page's address. | Write 'Nothing leaves your browser except in these cases', and say the id is made from the page's address, in the description too. |
| Privacy policy: Live and Share bullets | The Live bullet says 'the page's comments' without saying the record carries edited and deleted text. The Share bullet has the same gap. | Add '(including edited and deleted text)'. |
| Notes for Reviewers step 3 | 'Click a word ... A pin marks the comment.' In comment mode a click picks a block (pickBlock), and words have to be selected. There is no pin. | 'Click the paragraph, type ... and press Enter. The badge shows 1.' |
| Notes for Reviewers step 4 | The step implies Comments you've made is in the toolbar menu. It is on the options page (comments.html). | Point to the options page in about:addons. |
| Notes for Reviewers: testing | Section 3 asks for testing information. Share and Live can't work on example.com because they need data-pipeup-doc, and the notes say nothing about how to test them. | Say so, and give a test page (from the maintainer). |
| Permission justification: unlimitedStorage | It cites 'the default storage limit', which is Chrome's 10 MB quota for storage.local. Firefox's behaviour without the permission was not verified. | Neutral wording: it keeps a growing local record and its pictures from running into a storage quota. |
| Voice in the Firefox build; release notes | Voice is packed, offered on the settings page and listed in the release notes, but it turns itself off in Firefox ('this browser has no speech engine'). Saying so is honest, but a switch that does nothing invites a section 3 question. | Leave Voice out of the Firefox build (the maintainer's decision; spec first). The release notes now say Voice is not available in Firefox. |
| Save to GitHub add-on's own wording | The add-on's in-page text says 'nothing is sent until you submit it there', but GitHub receives the text in the URL when the tab opens. The listing is right; the product contradicts it (section 1, no surprises). The listing also didn't say the add-on is reached by mentioning someone on GitHub. | Fix the add-on's text in code. The corrected description says how it is reached and that the repository may be the one the page names. |
| Permission justifications: clipboardWrite and options_ui | The clipboardWrite justification leaves out Copy in Pipeup's own menu on the page and My identity's Copy. The options_ui justification leaves out the Send to my agent setup section. | Name them. |
| Reviewer notes and needs: web-ext lint, emojibase | The draft says lint was not run and leaves the emojibase version open. web-ext lint on dist/firefox gives 0 errors and 2 warnings: UNSUPPORTED_API for sidePanel.open, in a feature-checked Chrome branch, and OPENDIALOG_NONLIT_URI in identity.esm.js, which is Pipeup's own host.openDialog. The installed emojibase-data is 17.0.0, and data.ts is committed. | Put both in the Notes. Confirm data.ts was generated from 17.0.0. |
| Notes for Reviewers length | With the fixes, the Notes are 2,993 characters. The placeholders (Node version, test page) leave almost no room. | Once the placeholders are filled, keep the Notes at 3,000 or fewer; shorten the lint line first. |
| navigator.storage.persist() (not in the listing) | The core calls persist() in the site's origin on every start. In Firefox that may show a persistent-storage prompt in the site's name, which would be a surprise (not verified). | Check it in Firefox 140. If it prompts, skip the call when a custom store is passed, or disclose it. |

## Safari (Mac App Store)
**Checker's verdict:** Not ready to submit as drafted. It would be rejected for four reasons. First, Share and Live make the app user-generated content under guideline 1.2, and Pipeup has no way to hide, block or report a commenter. Second, the containing app is still the converter's stock window (4.2 / 4.4). Third, the privacy policy and support pages return 404. Fourth, the build is Debug with a macOS 27.0 deployment target (2.1). Several sentences are also untrue against the code: Live's "after you agree" (a page can pre-set the consent flag in its own IndexedDB); "a Pipeup file you can open again later" (nothing in the extension opens one); how Save to GitHub is triggered; the claim that the file matches npm byte for byte; and "Safari asks" on every press, which hasn't been checked. The corrected draft assumes a Safari build without Share and Live. That keeps the age rating at 4+ with no user-generated content, keeps the App Privacy answer at No data collected, and removes the false consent claim. Pictures are still taken in Safari, but nothing in Safari ever shows them, so the draft now says that plainly. Turning them off for Safari is the better fix. Every field is inside its limit: description 3,443 characters, review notes 3,760 bytes, keywords 87 bytes, promotional text 159 characters.
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
_Pipeup works on web pages that the user opens, and it bundles emoji data from emojibase-data (MIT, from Unicode data). The shipped build strips that notice, so add the emojibase MIT notice to the app's About or licences screen before submitting._
```text
Yes, it contains, shows or accesses third-party content, and I have the necessary rights.
```
#### Age Rating questionnaire
_If Share or Live is added later, User-Generated Content becomes Yes and guideline 1.2 applies: a way to hide or block a commenter, a way to report content, and published contact details._
```text
All content descriptors: None. Parental Controls: No. Age Assurance: No. Unrestricted Web Access: No (Safari does the browsing; Pipeup doesn't open or browse sites itself). User-Generated Content: No (the Safari release leaves out Share and Live, so the user sees only their own comments). Social Media: No. Messaging and Chat: No. Advertising: No. Expected rating: 4+.
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
_Returns 404 today and must be published first. It must cover: what the extension keeps (comments with their history, the list of pages, display name and signing key, per-site choices, pictures, settings); that Emoji and Voice keep small settings in the site's own storage; that Save to GitHub puts the comment, names, page title and address in a github.com address, which GitHub receives when the page opens; that Voice uses Apple's speech recognition; that edited and deleted words stay in the history and in saved Pipeup files; that pictures stay on the Mac; how to delete everything (remove the app, and clear the site's data for site-stored items); that no data reaches the developer; and a contact. It must also be linked from inside the app._
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
_3,443 characters. It names no other browser or platform, and leaves out Send to my agent, the panel beside the page, Share and Live. If pictures are turned off for Safari, delete the pictures line under PRIVACY._
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
- Your comments are kept by the extension, in Safari on this Mac. Pipeup has no account, no server of its own and no analytics, and loads no code from the web.
- Comments leave this Mac only when you copy or save them, or open a GitHub page with Save to GitHub, as described above. With Voice, your voice may go to Apple's speech recognition.
- By default the extension also keeps a small picture of where each comment was made, in Safari on this Mac. This version doesn't show, copy, save or share it. You can turn pictures off on the Comments you've made page, which deletes the ones kept.
- Your comments are drawn on the page while you write and read them, so the page's own scripts can see them there. Emoji remembers your recent emoji and skin tone, and Voice its settings, in the site's own storage.
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
_It must match MARKETING_VERSION / CFBundleShortVersionString in the archived build. The project file says 1.0; only the command line sets 0.9.1._
```text
0.9.1
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
See reviewerNotes (3,760 bytes, under the limit).
```
#### App Review Information: Attachment
_Whether this field exists wasn't confirmed today._
```text
Optional: a 30-second screen recording of steps 1 to 5 of the notes, in Safari on example.com.
```
#### Version Release
_Lets the maintainer line the release up with the website and the other stores._
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
_The app uses only OS-provided HTTPS. Comments are signed with Ed25519 in web JavaScript, for authentication only; with Share and Live out, no sealing ships. The maintainer should confirm the exemption. If unsure, answer the per-build questionnaire instead of setting the key._
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
When the user presses Pipeup in the toolbar, presses Option-Shift-P or chooses Comment with Pipeup from the right-click menu, Pipeup gets access to that one tab only. That press lets it show the page's address in the menu, use the title to name a saved file, add Pipeup to the page, and take a picture of where a comment was made. The access ends when the tab goes to another page. This is why the extension needs no access to any site when it is installed.
```
#### scripting
```text
Adds Pipeup's bundled script to the tab when the user chooses Comment on this page or Comment with Pipeup. Each time the menu opens on a page where Pipeup isn't running, it checks whether the page already has Pipeup built in, and if so the extension steps aside. Only after the user turns on Always on for this site (or Always on for local pages) does it register the script for that site, so Pipeup starts there without a press. Turning the switch off unregisters it.
```
#### storage
```text
Keeps the user's comments for each page (with each comment's history), the list of pages commented on, the display name and signing key, per-site choices (look, Hide comments), settings and add-on switches, and pictures of where comments were made. All of it stays in the extension's storage in Safari on this Mac. None of it is sent to the developer.
```
#### unlimitedStorage
```text
Comments and their history build up over every page reviewed and are never trimmed automatically. Pictures of where comments were made add one small JPEG per comment. Without this, Safari's quota for extension storage could make saving a comment fail.
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
Pipeup's own script and its add-ons (Emoji, Voice, Save to GitHub, My identity) are bundled in the app and loaded as modules into the tab the user chose to comment on. That tab can be any site, so the match is any site. Nothing is fetched from the web. Pipeup's UI lives in its own shadow root and doesn't change the page's layout.
```
#### commands: _execute_action (Option-Shift-P)
```text
A keyboard shortcut that opens Pipeup's toolbar menu for the current page. It grants the same one-tab access as pressing the toolbar button.
```
#### tabs.captureVisibleTab (no separate permission)
```text
After the user makes a comment, the extension takes a picture of the visible tab, crops it to the comment's place plus a small margin (at most 480 px wide) and keeps it in extension storage. It is never copied, saved, shared or sent, and this version doesn't show it. The user can turn it off on the Comments you've made page, which deletes the pictures kept.
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
_Why:_ There is no developer server, analytics or SDK. Comments, the list of pages, names, keys and pictures stay in Safari's extension storage on the Mac, and data handled only on the device isn't "collected". Share and Live are not in the Safari build. Save to GitHub opens a github.com page in Safari, at the user's press, for a repository the user or page names; GitHub is not the developer's partner. Voice uses Apple's own speech recognition through Safari.
#### If Yes: data types collected
```text
Not applicable: the answer is No.
```
_Why:_ If Share or Live is added later, revisit: Other User Content, Name, User ID, and for Live, presence (Product Interaction).
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
- storage, unlimitedStorage: comments with their history, the list of pages, the user's display name and signing key, settings and pictures are kept in the extension's storage. They grow with every page reviewed and are never sent to us.
- clipboardWrite: Copy comments writes to the clipboard after asking the page for its comments, which can outlast the click.
- contextMenus: the Comment with Pipeup item.
- optional host access (<all_urls>): nothing is granted at install. Only when the user turns on Always on for this site (or Always on for local pages) does Pipeup ask Safari for that one site (or localhost, 127.0.0.1 and [::1]). Turning it off removes it.
- web_accessible_resources: Pipeup's own script and add-ons, bundled in the app, loaded as modules into the tab the user chose. Nothing is fetched from the web.
- Pictures: when the user makes a comment, the extension takes a picture of the visible tab, crops it to the comment's place (at most 480 px wide) and keeps it in extension storage. It is never sent anywhere. Users can turn this off in Comments you've made, which deletes the pictures.

NOT IN THIS APP
Send to my agent, the panel beside the page, and the Share and Live add-ons are not in the Safari build. The app does not run or install any other program. Comments reach agents by Copy comments or Save comments.

ADD-ONS (bundled, none downloaded)
Emoji is on; the others are off until the user turns them on in Comments you've made.
- Voice: uses Safari's speech recognition; Safari asks for the microphone; a consent panel comes first.
- Save to GitHub: only on a comment that mentions a GitHub name, and only for a repository the user or page names; opens a prefilled github.com new-issue page in Safari; no token is kept.
- My identity: shows a recovery code; sends nothing.

DATA
No analytics, no developer server, no remote code. Nothing reaches the developer.

SOURCE
MIT, https://github.com/pipeup-ai/pipeup. The bundled files are minified. To rebuild them from the repo root on a Mac with Xcode:
cd libs/ts/pipeup && npm ci && npm run build
cd ../addons && npm ci && npm run build
cd ../../.. && node tools/build-extension.mjs --safari
The build prints the SRI hash of pipeup/pipeup.esm.js, to compare with the one for pipeup@0.9.1 on npm.

Contact: [support contact: maintainer to supply]
```
### Screenshots
| # | Shows | Size | Caption |
|---|---|---|---|
| 1 | 1. Safari window on a fictional article page ("Lumen Field Notes", light look). Pipeup's toolbar menu is open under its button, showing the page's address and the Comment on this page button. Real Safari window chrome, no other apps. | 2880×1800 PNG, no alpha (or 1440×900) | Press Pipeup and choose Comment on this page |
| 2 | 2. The same page in comment mode. A sentence is selected and the comment box sits beside it with the cursor in it. Sam is typing "Can this be one line shorter?" | 2880×1800 PNG, no alpha | Select words, a picture or a block, then write |
| 3 | 3. The page with three comment marks. One thread is open as a popover: Sam's comment, a reply Sam added, and Reply and Resolve. (Only the user's own comments appear in the Safari release.) | 2880×1800 PNG, no alpha | Read, reply and resolve on the page |
| 4 | 4. Pipeup's toolbar menu with Pipeup on, and Copy comments opened to As Markdown (for an AI) and As text. Save comments is visible below. | 2880×1800 PNG, no alpha | Copy or save the comments for whoever asked |
| 5 | 5. Right-click on a picture of a lamp on the fictional page, with Comment with Pipeup highlighted in Safari's menu. | 2880×1800 PNG, no alpha | Right-click anything to comment on it |
| 6 | 6. The Comments you've made page: three fictional pages (Lumen Field Notes, Lee's pricing draft, Ada's onboarding page) and below them the settings and add-on switches (Emoji on; Voice, Save to GitHub and My identity off; no Share or Live). | 2880×1800 PNG, no alpha | Every page you've commented on, and your add-ons |
| 7 | 7. The Pipeup Mac app window: how to turn the extension on in Safari Settings > Extensions, with its button, plus links to Help and Privacy. | 2880×1800 PNG, no alpha | Turn Pipeup on in Safari Settings |

### Only the maintainer can supply
- Apple Developer Program membership (Individual, 99 USD a year) in the maintainer's legal name, with two-factor authentication. That name becomes the seller name shown on the App Store. Accept the agreements in App Store Connect.
- DSA trader status: declare non-trader or trader. This is a legal call. A trader's address, phone and email are published in the EU.
- Support contact: an email address (plus a postal address and phone where local law requires them), published on a support page at https://pipeup-ai.github.io/pipeup/support/ with a link to GitHub Issues.
- Privacy policy published at https://pipeup-ai.github.io/pipeup/privacy/ (404 today). It must cover every point in the Privacy Policy URL note, and be linked from inside the app.
- App Review contact: name, email, and phone in +country-code format.
- Agree to a Safari build without Share and Live (this listing assumes it): per-target add-on lists in tools/build-extension.mjs, and hide their switches in comments.js on Safari. Shipping them instead needs guideline 1.2 features (hide or block a commenter, report content), User-Generated Content = Yes, and new privacy answers. Live's consent flag must also move out of the site's IndexedDB first.
- Decide on pictures in Safari: they are taken and stored, but nothing in Safari shows them, and deleting a comment doesn't delete its picture. Turning them off for Safari is the recommended fix; then remove the pictures lines from the description, notes and justifications. Either way, fix the Comments page label that says a picture still shows what a lost comment was about.
- Reword the popup's Save comments hint "to open again": nothing in the extension opens a saved Pipeup file.
- Signing: DEVELOPMENT_TEAM set, App Store distribution signing, and the bundle IDs ai.pipeup.Pipeup and ai.pipeup.Pipeup.Extension registered. Archive a Release build (the script builds Debug, ad-hoc signed).
- Xcode project fixes: MARKETING_VERSION 0.9.1, a build number that goes up with every upload, a lower app deployment target (it inherits macOS 27.0; Safari 17 needs about macOS 13 or 14, unverified), LSApplicationCategoryType productivity, ITSAppUsesNonExemptEncryption NO, NSHumanReadableCopyright, and removing the unused network and user-selected-file entitlements. Keep these settings in source control, because build-extension.mjs regenerates the project with --force.
- A containing app with real content (guideline 4.2 / 4.4): how to turn it on, a short guide, links to privacy and support, the version, the MIT licence and the emojibase MIT notice. Also app icons drawn at full size rather than scaled up from 128 px.
- Guard the stray native-messaging call: popup.js done() calls agentReplies() after menu actions even in the Safari build, which has no nativeMessaging permission. Check canReachAgents first.
- Confirm export-compliance exemption for the comment signing code, and confirm on a clean Mac (through TestFlight) whether Safari prompts on a toolbar press, its prompt wording, and that Option-Shift-P is applied.
- Take the 7 screenshots at 2880×1800 in Safari, light look, on fictional pages, after the containing app and the Safari add-on list are done.

### What the check found (fixed in the text above unless it needs code)
| Where | Problem | Fix |
|---|---|---|
| Age Rating questionnaire; Description ADD-ONS (Share, Live); privacy answers | Shipping Share and Live means User-Generated Content = Yes. Guideline 1.2 then requires a way to filter and report content and to block users. Pipeup has none of these, so the app would be rejected. | Leave Share and Live out of the Safari build: per-target ADDONS in build-extension.mjs, and hide their rows in comments.js on Safari. Then answer User-Generated Content = No and remove them from the description, notes, privacy policy and App Privacy answers (done in the corrected draft). |
| Description, Live line ("after you agree"); review notes ("Live asks consent") | Untrue as a guarantee. Live keeps its consent flag (seen) and on in the visited site's IndexedDB. A page can pre-set them and Live then connects without showing the consent panel. data-pipeup-live="auto" also sets want. | Removed with Live from the Safari release. If Live ships later, keep its consent flag in extension storage first. |
| Description, Share line | It leaves out that Share sends new comments automatically (about every 10 s and at page hide) once it is on, and that the page itself can choose the sharing server when the user's own setting is empty. | Removed with Share from the Safari release. If Share ships later, say both things in the description and the privacy policy. |
| Description, GETTING COMMENTS ("a Pipeup file you can open again later") | Nothing in the Safari extension opens a saved Pipeup file. The library only exports readFeedbackFile for code, and the popup label "to open again" promises the same thing. | Say "a Pipeup file that holds every comment with its history". Reword the popup's "to open again" hint. |
| Description, Save to GitHub line; review notes | It describes Save to GitHub as opening an issue for a comment. In fact it acts only when a comment mentions a gh: GitHub name, for a repository that the user's setting or the page names (otherwise the add-on switches itself off), and the issue carries the mentioned @names. | Corrected: "when a comment mentions someone by their GitHub name, Pipeup's menu offers to open GitHub's new-issue page ...". |
| Description step 2; review notes step 3 ("Safari asks whether Pipeup may use this site") | It is stated as certain on every press, but the extension asks for only activeTab, and Safari's prompt on a toolbar press hasn't been checked. If Safari doesn't ask, the reviewer's first step contradicts the notes. | "Safari may ask..." and "If Safari asks..., choose Allow for One Day". Confirm on a clean Mac through TestFlight. |
| Review notes, SOURCE ("matches the file published on npm byte for byte") | The build checks the packed file only against the local build of libs/ts/pipeup, not against npm. A rebuild matches npm only if it is from the same commit with the same tools. | "The build prints the SRI hash of pipeup/pipeup.esm.js, to compare with the one for pipeup@0.9.1 on npm." |
| Description PRIVACY (pictures); captureVisibleTab and unlimitedStorage justifications; the Comments page's own wording | In Safari, pictures of the visible tab are taken and stored by default, but nothing shows them (only the side panel does, which Safari lacks). Keeping screen captures with no use weakens 5.1.1(iii) data minimisation and the unlimitedStorage case. The settings label "so a comment whose place has gone still shows what it was about" is untrue in Safari. | Better: turn pictures off in the Safari build and delete the pictures lines. Until then the corrected text says this version doesn't show, copy, save or share them. |
| Containing app (screenshot 7, review notes step 1, 4.2 / 4.4) | The app is the converter's stock page: an icon, an on/off sentence and a button. There is no help, privacy link, support link or licence notice, and screenshot 7 shows content that doesn't exist yet. | Build the app content listed for the maintainer before taking screenshot 7 or submitting. |
| Build (2.1, 2.5.1) | The script builds Debug, ad-hoc signed, and the app target inherits macOS 27.0, so the app installs only on macOS 27. | Kept in the maintainer list: Release archive, team signing, a lower deployment target, kept in source control. |
| Privacy Policy URL; Support URL | Both pages return 404 or are not published. A required privacy policy URL that doesn't load is a certain rejection (5.1.1(i)), and the support URL needs real contact details (1.5). | Publish both before submitting. The policy contents were updated to drop Share and Live and to add Voice's site storage. |
| Description PRIVACY (site storage) | It says Emoji writes to the site's storage but leaves out that Voice keeps its dictation choice (engine, device or service, language) in the site's IndexedDB. | Added: "Emoji remembers your recent emoji and skin tone, and Voice its settings, in the site's own storage." |
| Description PRIVACY ("Voice audio goes to Safari's speech recognition") | The sentence is imprecise: the audio may go to Apple's servers, depending on language and device. The add-on itself says so. | "With Voice, your voice may go to Apple's speech recognition." |
| Screenshot 7 caption ("Turn Pipeup on in Safari in one step") | It takes two steps: press the app's button, then tick Pipeup in Safari Settings > Extensions. The caption is misleading (2.3.1). | "Turn Pipeup on in Safari Settings". |
| Review notes vs code: stray native messaging | In Safari, the popup still calls chrome.runtime.sendNativeMessage after menu actions while Pipeup is on, and first has the page build the full export. The notes say Send to my agent is not in this app. | Guard agentReplies with canReachAgents before submitting (kept in the maintainer list). |
| permission justification: unlimitedStorage | "the 5 MB storage.local limit" is stated as fact for Safari, but the research also says Safari 16+ grants unlimited storage. Neither was confirmed. | "Without it, Safari's quota for extension storage could make saving a comment fail." |
| permission justification: web_accessible_resources ("its six add-ons") | With Share and Live left out, four add-ons ship. | Name the four add-ons. |
| Keywords | "comment" repeats a word from the name (Page Comments), which wastes bytes. It isn't a rejection. | Replaced with "website" (87 bytes). |
| Description note ("3,668 characters") | The measured length is 3,667. | The note now gives the corrected description's measured length (3,443). |
| Description and notes: Option-Shift-P | Whether Safari applies the manifest's suggested Alt+Shift+P shortcut hasn't been checked. | Confirm through TestFlight. If it isn't applied, remove it from the description and notes. |

## Where the drafts disagreed, and how to settle it

| Between | What | Settle by |
|---|---|---|
| Edge vs Firefox vs Safari (version to list) | Edge and Firefox list '[release version]' / 'the first stable release whose tag contains apps/extension'. Safari lists 0.9.1 as Version Number, says the SRI hash should match pipeup@0.9.1 on npm, and its packaging builds 0.9.1. Tag v0.9.1 has no apps/extension and npm 0.9.1 has no `pipeup browser` command. | All three listings name the same next stable release (for example 0.10.0). Bump libs/ts/pipeup/package.json, publish the library, CLI and add-ons to npm, tag it, and rebuild every package from that tag. Replace every 0.9.1 in the Safari draft. |
| All three drafts vs the setup command in code (apps/extension/src/browser.js:41-45) | Every draft, and the extension itself, use `npx --yes pipeup@0 browser install`. If the next stable release is 1.0.0, `pipeup@0` keeps resolving to 0.x and never gets the browser command. Edge also needs `--browser edge`, which the code never adds. | Make the major in agentSetup() match the release being listed (or pin the exact version), add Edge detection, and use the same command string in every listing and in the reviewer notes. |
| Edge privacy answers vs Safari App Privacy answers vs Firefox data_collection_permissions vs the audit | Edge answers Yes to website content, personal information, personal communications, user activity and web history. Safari answers 'No, we do not collect data'. Firefox ships required ['none'] in the build, but its draft says to add optional websiteContent, browsingActivity, personalCommunications, personallyIdentifyingInfo and websiteActivity. The audit says the extension's own code sends nothing, and Share, Live, Save to GitHub and Send to my agent do send data. | The facts are the same everywhere; each store defines 'collect' differently. Apple counts only data that leaves the device for the developer or its partners, so 'No' is true only if Safari ships without Share and Live. Chrome and Edge count data the extension handles, so 'Yes' with a reason is right. Mozilla needs the optional list in the manifest. Keep the answers as they are, with Firefox's optional list added in the build, and make sure the one privacy policy states the same facts all of them rely on. |
| Safari vs Edge and Firefox (which add-ons ship) | Safari's listing, notes, age rating and App Privacy assume Share and Live are not in the Safari build. tools/build-extension.mjs:17 packs all six add-ons for every target, and comments.js:56-78 always lists their switches. Firefox lists Voice although it turns itself off there. | Add per-target add-on lists to the build (Safari: emoji, voice, github, identity; Firefox: everything except voice, if the maintainer agrees) and hide the missing switches in comments.js. Until then the Safari listing is untrue. |
| Edge description vs Safari description (Pipeup file) | Edge says 'Save comments... as a Pipeup file to open again'. Safari's checker found nothing in the extension opens a saved Pipeup file (popup.html:44 says 'to open again'). | Use Safari's wording everywhere ('a Pipeup file that holds every comment with its history') and change the popup hint. |
| Edge 'The comments the extension keeps can't be read by the site' vs Firefox wording vs the audit | The audit marks 'the site cannot read the comments' false: Pipeup's UI is an open shadow root (ui/host.ts:22), so the page's scripts can read the comments for that page. Edge's sentence implies the site can't read stored comments at all. Firefox says 'cannot read the extension's storage or the comments kept for other pages', which is accurate. | Use Firefox's sentence in the Edge listing and the policy, or use a closed shadow root in the extension and then cut it from all three. |
| Safari description vs Edge and Firefox (cross-site identity) | Edge and Firefox say one signing key is stamped on every comment on every site, so comments passed on from different sites can be linked. Safari says nothing about it, but the same code ships there (start.js:92-119). | Add the sentence to the Safari description. It is in the policy. |
| Edge and Firefox vs Safari (pictures) | Edge and Firefox say a picture shows what a comment was about when its place has gone (true: the side panel or sidebar shows it). Safari has no panel, so the pictures are taken and kept but never shown, and the settings label in comments.html says otherwise. | Turn pictures off in the Safari build (recommended), or keep Safari's 'this version doesn't show them' wording and fix the label for Safari. |
| Safari subtitle and description vs the Edge and Firefox checkers | Edge and Firefox removed 'any web page' as an overclaim, because browser pages and the stores are closed to extensions. Safari's subtitle is 'Comment on any web page', and its description says 'any web page you open in Safari'. The shared manifest description also says 'any web page' and 'stay in this browser until you send them'. With Share on, that is untrue. | Use 'web pages' everywhere: Safari subtitle 'Comment on web pages' and a new manifest description such as Edge's proposal. It is one string for all stores, so changing it needs a rebuild. |
| Edge vs Firefox (where Comments you've made is) | Firefox's checker says it is only on the options page. Edge says it is at the bottom of the toolbar menu. Both are true: the popup has a 'Comments you've made' link that opens the options page. | In all the notes: 'Comments you've made (a link at the bottom of the toolbar menu, or the extension's options page)'. |
| Edge vs Firefox (Windows for Send to my agent) | Edge says Send to my agent can't be set up on Windows yet. Firefox desktop also runs on Windows, but its listing doesn't say so. The CLI has paths only for darwin and linux, and no code hides the row on Windows (no platform check in apps/extension/src). | Add 'macOS and Linux only for now' to the Firefox description, and hide or explain the row on Windows in code for both stores. |
| Edge reviewer notes vs Safari checker vs build-extension.mjs:105-109 | Edge says pipeup.esm.js 'is byte for byte the release file of pipeup@[release version] on npm'. The build compares only against the local libs/ts/pipeup build, not npm. Safari softened this to 'compare with'. | Use Safari's wording everywhere, or add a check of npm's SRI to the build. |
| Live 'after you agree' (Edge) vs Firefox disclosure vs audit | Edge promises consent before Live connects. The audit and Firefox found the consent flag is in the site's IndexedDB, so a page could pre-set it. Firefox discloses that the site can change it. | Move Live's consent and Share's policy into extension storage before any listing with Live ships. Then 'after you agree' is true everywhere. |
| Edge Voice description vs voice/src/addon.ts:57-95 | Edge describes Voice in Edge, but if Edge exposes only webkitSpeechRecognition, the add-on shows Safari and Apple texts, naming another browser (Edge policy 1.1.2) and saying something untrue. | Choose the texts by detecting Safari, and test in Edge. If Voice can't be made right in Edge, leave it out of the Edge description. |
| Safari reviewer notes vs popup.js:107-112, 189-196 | The Safari notes say Send to my agent is not in the app, but done() still calls agentReplies() → chrome.runtime.sendNativeMessage, with no canReachAgents check, in a build without the nativeMessaging permission. | Guard agentReplies() with canReachAgents. |
| Firefox platform choice vs docs/EXTENSION_SPEC.md section 2 | The Firefox listing is desktop only; the spec lists Firefox on Android as a target. | Update the spec to say Android comes later. |
| Privacy policy URL across stores | Edge proposes /privacy/edge (Edge-only wording, no other browsers named). Safari proposes /privacy/. Firefox pastes the text into AMO. None exists. | Publish one browser-neutral policy at https://pipeup-ai.github.io/pipeup/privacy/ (the one below names no browser), use that URL for Edge, Safari and Chrome, and paste the same text into AMO. Add a per-browser copy only if Edge review objects. |

## Code and build changes

| Change | Why | Stores | Severity |
|---|---|---|---|
| Bump the version off 0.9.1, release the library, CLI and add-ons to npm, tag it, and build the store packages from that tag (tools/build-extension.mjs takes the version from libs/ts/pipeup/package.json). | Tag v0.9.1 has no apps/extension, and npm 0.9.1 has no `browser` command, so Send to my agent and nativeMessaging can't be tested (Edge 1.3) and AMO can't rebuild the minified files from the source. | All (blocks Chrome, Edge and Firefox outright; Safari for the version number and SRI claim) | blocker |
| In browser.js agentSetup(), add Edge detection (navigator.userAgentData brands or the 'Edg/' token) and `--browser edge`, and make `pipeup@<major>` match the release being listed. | Today Edge is treated as 'chrome', so the host file goes into Chrome's folder and Send to my agent never works in Edge. If the release is 1.x, `pipeup@0` never gets the command in any browser. | Edge (blocker); Chrome and Firefox if the major changes | blocker |
| Add accurate Firefox data_collection_permissions: required ['none'] plus optional websiteContent, browsingActivity, personalCommunications, personallyIdentifyingInfo and websiteActivity. Call permissions.request({data_collection}) when Share, Live or Save to GitHub is turned on or Send to my agent is first pressed, and raise strict_min_version from 128.0 to 140.0. Spec section 6 first. | build-extension.mjs:60-63 declares only 'none', but those features transmit data. AMO policy 6.2.1 requires an accurate declaration, and Firefox 128–139 would need a custom consent screen. | Firefox | blocker |
| Move Live's consent flag {on, seen} and Share's policy (and ideally Voice's choice) from the site's IndexedDB (kit/src/settings.ts:25) into chrome.storage.local, or leave Live and Share out of that store's build. | A page could pre-set consent and go live without the consent panel (live/src/addon.ts:65-70,186-191). That breaks every store's consent rules and makes 'after you agree' untrue. | Firefox (would-be-rejected), Chrome and Edge (should-fix); Safari only if Live ships | blocker |
| Per-target add-on lists in tools/build-extension.mjs:17 (Safari without Share and Live; Firefox without Voice if agreed), and hide the missing add-ons' switches in comments.js. | The Safari listing, age rating (no user-generated content) and 'No data collected' answer depend on Share and Live being absent. Guideline 1.2 needs report and block features Pipeup lacks. Voice is a dead switch in Firefox. | Safari (blocker), Firefox (recommended) | blocker |
| Safari app: a real containing app (guide, privacy and support links, licence and emojibase notice), Release archive with team signing, a lower deployment target than the inherited 27.0, version and build numbers, category and encryption keys, and unused entitlements removed, kept in source control because the converter runs with --force. | Guidelines 4.2/4.4 (minimum functionality) and 2.1/2.5.1 (installs only on macOS 27; Debug ad-hoc build). | Safari | blocker |
| Guard agentReplies() in popup.js done() with canReachAgents. | In Safari, done() calls chrome.runtime.sendNativeMessage with no nativeMessaging permission, which contradicts the reviewer notes. Confirmed in code: there is no check before the call. | Safari | recommended |
| Hide or explain the Send to my agent row on Windows (no platform check exists in apps/extension/src), or teach the CLI the Windows registry keys (HKCU\Software\Microsoft\Edge\|Google\Chrome\|Mozilla\NativeMessagingHosts). | Edge policy 1.4.1, and reviewers usually test on Windows. There the extension shows a command that fails with 'isn't supported yet'. | Edge (likely rejection), Chrome, Firefox | recommended |
| Choose the Voice add-on's Safari and Apple texts by detecting Safari, not by the absence of an unprefixed SpeechRecognition (voice/src/addon.ts:57-95). | In a browser that exposes only webkitSpeechRecognition, Voice names Safari and Apple. That is untrue there, and in Edge it breaks 1.1.2. | Edge, Chrome | recommended |
| Change Save to GitHub's own text ('nothing is sent until you submit it there', github/src/addon.ts:58,77) to say nothing is filed until you submit it, and that GitHub receives the text when the page opens. | The text, name, title and full URL are in the github.com URL. The in-product claim contradicts every listing and policy. | All | recommended |
| Keep the Emoji add-on's recent emoji and skin tone (emoji/src/picker.ts:10,17, the site's localStorage) in extension storage, and use a closed shadow root for the extension (ui/host.ts:22). | Emoji is on by default and writes to every site's storage, where the site can read it and it survives removal. The open shadow root lets the page read comments. AMO 6.3 forbids leaking user-specific data to sites, and disclosure doesn't cure it. Each fix lets a sentence be cut from every listing and the policy. | Firefox (should-fix under 6.3), Chrome, Edge, Safari | recommended |
| Replace the manifest description ('Comment on any web page with Pipeup. Your comments stay in this browser until you send them.') with one that is true, for example 'Comment on the web pages you visit and pass the comments to the person or AI agent who asked for feedback.' | 'Any' overclaims, and with Share on comments are sent automatically. Chrome and Edge show this string as the short description, and it can only change with a new package. | Chrome, Edge (also seen in Firefox and Safari) | recommended |
| Narrow optional_host_permissions from <all_urls> to ["http://*/*","https://*/*"]. | Audit verdict could-be-narrower: only http and https origins are ever requested (popup.js:11,13,69). Least privilege is reviewed by all stores. | All | recommended |
| Make build-extension.mjs fail, not warn, when an add-on isn't built (lines 116-118), and check the packed pipeup.esm.js SRI against npm's file for the release. | A store zip silently missing add-ons wouldn't match the listing or the reviewer's rebuild. The 'byte for byte as on npm' claim is checked nowhere today. | Firefox (reproducible source), all | recommended |
| Delete a comment's picture (shot:<thread>) when its comment is deleted, and turn pictures off in the Safari build. | Pictures are never deleted with their comment, and Safari never shows them (only the side panel does). That weakens data minimisation (Apple 5.1.1(iii)) and the unlimitedStorage case. | Safari (recommended), all | recommended |
| Reword popup.html:44 'to open again' for the Pipeup file. | Nothing in the extension opens a saved Pipeup file. | All (Apple 2.3.1 most strictly) | recommended |
| Add a third-party notice for emojibase-data (MIT) to the package (for example a LICENSE and NOTICE copied by the build) and to the Safari app's About. | The build strips legal comments (legalComments:'none'), so the bundled emoji table ships with no licence notice. | All (AMO third-party rules; Safari content rights) | recommended |
| Skip navigator.storage.persist() (mount.ts:176) when the extension passes its own store. | It asks for persistent storage in the site's origin on every start, and may show a prompt in the site's name in Firefox (unverified). | Firefox | recommended |
| Correct the false claims in docs/EXTENSION_SPEC.md (sections 5 and 6), apps/extension/README.md:5, start.js:1-2 and docs/design/browser-extension.md:10 (permissions list): nothing in the site's storage, the site can't read comments, the extension sends nothing anywhere. Add the libs/ts/addons build step to the README. | Reviewers read the linked source, and the listings must not repeat these claims. The spec-first rule applies to the code changes above. | All | recommended |
| A 'Delete all comments' (and per-page delete) control on the Comments you've made page. | Today removing everything needs uninstalling. Stores favour user-controlled deletion, and it would cut a caveat from every listing. | All | optional |
| Try use_dynamic_url: true on web_accessible_resources in the Chromium build (test the dynamic import). | With a fixed ID, any site can detect the extension by fetching pipeup/pipeup.esm.js, even where it was never used. | Chrome, Edge | optional |
| Ship unminified (or not property-mangled) pipeup.esm.js and add-ons in the Edge package, or rely on the tag, SRI and rebuild steps. | Edge policy 1.1.7 on obfuscation has no source-upload field. The 203 KB single-line terser output may draw a refactor request. | Edge | optional |

## Still missing

- Chrome store art: a 440x280 small promo tile (required) and screenshots at 1280x800; the Chrome draft is above.
- A released version: the next stable library, CLI (with `pipeup browser`) and add-ons on npm, a git tag that contains apps/extension, and the packages rebuilt from that tag. Every [release version] and [release tag] placeholder depends on it.
- Privacy policy page on the website (https://pipeup-ai.github.io/pipeup/privacy/ returns 404) and its URL in every listing; the text is below. Also the date in it once published.
- Support contact: a monitored, publishable email address ([support contact: maintainer to supply]) for AMO, Apple and Chrome, plus a support page (https://pipeup-ai.github.io/pipeup/support/) for Apple.
- Accounts: Chrome Web Store developer account (one-time registration fee, and 2-step verification); Microsoft Partner Center in the Edge program (Individual, publisher display name); a Mozilla account with 2FA; Apple Developer Program membership (99 USD a year, Individual, legal name shown as seller) plus the DSA trader declaration.
- Apple App Review contact: name, email and phone in +country-code format.
- Store art: Edge 300x300 logo; Chrome 128 icon and 440x280 tile; Safari full-size app icons (1024) drawn rather than scaled from 128; screenshots per store (Chrome and Edge 1280x800, AMO 4:3, at least 1000x750, Mac 2880x1800 or 1440x900), all light look, fictional pages and the names Sam, Ada and Lee. The build makes icons only up to 128 px.
- A test page carrying data-pipeup-doc, and a working sharing address, so reviewers can try Share and Live (Chrome, Edge and AMO notes all have placeholders).
- A Firefox source archive of the release tag with lockfiles and a reviewer README (OS, Node and npm versions, the three build commands, the zip CLI), and a check that the rebuild is byte-identical on Linux.
- The Node version for the AMO notes, and confirmation that libs/ts/addons/emoji/src/data.ts was generated from emojibase-data 17.0.0.
- A Safari containing app with real content (how to turn it on, a guide, privacy and support links, version, MIT licence, emojibase notice). It is the converter's stock page today, and screenshot 7 depends on it.
- Safari Xcode project settings: team, Release archive, MARKETING_VERSION, build number, deployment target, LSApplicationCategoryType, ITSAppUsesNonExemptEncryption, NSHumanReadableCopyright, unused entitlements removed, and the bundle IDs ai.pipeup.Pipeup and ai.pipeup.Pipeup.Extension registered.
- Fields no draft settled: the Edge Category list and data-usage labels (from memory), whether AMO offers en-GB, whether Apple's review attachment field exists, the Safari export-compliance confirmation, and the Safari prompt and shortcut behaviour (TestFlight on a clean Mac).
- A third-party notice for the emojibase-data (MIT) table in the packages: there is no LICENSE file or notice in the package today.

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

- 2026-11-10: First drafts for Chrome, Edge, Firefox and Safari, with the checks' findings, the code changes they call for and the privacy policy.
