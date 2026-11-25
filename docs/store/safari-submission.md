# Submitting Pipeup for Safari

Safari's Pipeup is a Mac app with the extension inside, sent to Apple through App Store Connect. The listing's words
are in [extension-listings.md](extension-listings.md), under **Safari (Mac App Store)**. Steps marked **(you)** need
your Apple account, your password or a legal answer.

## A. Check it in Safari (about 25 minutes, before anything else)

Nothing can drive Safari with an extension in it but the project's own UI test, so this is the test of the extension
in Safari itself.

1. Once: put `APPLE_TEAM_ID=<your team id>` in `.env.local` at the repository's root (git ignores it; Xcode → Settings
   → Accounts shows the id). The Mac needs an Apple Development certificate, which Xcode makes under that account.
2. `npm run safari-install` in apps/extension. It builds the app signed by your development certificate, with a fresh
   build number, forgets any other copy of the app the Mac knows, installs the one copy at
   `apps/extension/dist/Pipeup.app` and opens it. Its window says whether Pipeup is on in Safari.
3. **(you)** The first time only: Safari → Settings → Extensions → tick **Pipeup**. Signed, it stays on across Safari's
   restarts; nothing in the Develop menu is needed. (An unsigned build, `--unsigned`, is turned off at every start until
   Develop → Allow Unsigned Extensions is on again, which asks for your password and is forgotten when Safari quits.)
4. `npm run safari-test` runs the first run in Safari and keeps a screenshot of every step in
   `apps/extension/dist/safari-ui-test/`. It checks first that the installed app is the current build and the only one
   Safari sees, and says plainly when the button is missing from the toolbar.
5. Then the Safari column of [the hand checklist](../testing/extension-checklist.md), on
   `http://localhost:8792/extension-test.html` (the test's server, or `python3 -m http.server 8792 --directory
   apps/site/_site` after `apps/site/build.sh`). Watch these first:
   - **13a**: type quickly the moment a comment box opens: every letter arrives. The box is the extension's own frame.
   - Esc, Shift+Return and a reply in a thread, typed in that frame.
   - **38**: the settings list Emoji, Voice, Save to GitHub and My identity, and no pictures switch.
6. Anything that fails: tell me the step and what you saw.

## B. Once: your Apple account and the app's record

1. **(you)** Join the [Apple Developer Program](https://developer.apple.com/programs/enroll/) as an individual
   (99 USD a year). Your legal name is shown as the seller. Approval can take a day or two.
2. **(you)** Note your **Team ID** (developer.apple.com → Account → Membership details). In Xcode → Settings →
   Accounts, add your Apple ID.
3. **(you)** In Certificates, Identifiers & Profiles → Identifiers, register two App IDs: `ai.pipeup.Pipeup` (the app)
   and `ai.pipeup.Pipeup.Extension` (the extension). Xcode can also do this when it first signs.
4. **(you)** In [App Store Connect](https://appstoreconnect.apple.com) → Apps → **+** → New App: platform **macOS**,
   name **Pipeup: Commenting for HTML** (plain "Pipeup" is taken on the App Store), bundle ID `ai.pipeup.Pipeup`
   (the app's, not `ai.pipeup.Pipeup.Extension`: an app made with the extension's ID can't take an upload), SKU
   `pipeup-mac`. Done 2026-11-10 (Apple ID 6833108976).
5. **(you)** Business: accept the Free Apps agreement, and answer the EU trader question (a legal call: as an
   individual not trading, usually non-trader).

## C. Each release

1. The release first: the version on npm (with `pipeup browser`) and its tag. Check out the tag.
2. Build from it:

   ```bash
   (cd libs/ts/pipeup && npm ci && npm run build)
   (cd libs/ts/addons && npm ci && npm run build)
   APPLE_TEAM_ID=<your team id> PIPEUP_BUILD_NUMBER=1 node tools/build-extension.mjs --safari-release
   ```

   This writes `apps/extension/dist/Pipeup.xcarchive`, signed by your team. Raise `PIPEUP_BUILD_NUMBER` for every
   upload of the same version.
3. Open the archive (double-click) → Xcode's Organizer → **Validate App**, then **Distribute App** → App Store
   Connect → Upload.
4. **TestFlight:** in App Store Connect → TestFlight, add yourself as an internal tester and install the build on a
   Mac (or a new macOS user) that never had Pipeup. Turn it on in Safari and check what Safari asks the first time, and
   that Option-Shift-C starts Pipeup with commenting on.
5. **The version's page** (App Store Connect → the app → macOS App), from the Safari section of the listings doc:
   - Promotional text, Description, Keywords, Support URL (`https://pipeup-ai.github.io/pipeup/support.html`),
     Marketing URL (`https://pipeup-ai.github.io/pipeup/`), Copyright (`2026 Pipeup contributors`).
   - Screenshots: `npm run store-art` in apps/extension, then `dist/store/safari/` (2880 × 1800), plus the two taken
     by hand in Safari: its toolbar menu under Pipeup's button, and the right-click menu.
   - Build: choose the one you uploaded.
6. **App Privacy:** Privacy Policy URL `https://pipeup-ai.github.io/pipeup/privacy.html`; data: **Data Not
   Collected** (the listing's privacy answers say why).
7. **Age rating:** answer None to every question (4+). **Category:** Productivity. **Price:** free, all countries.
8. **(you) Export compliance:** Pipeup uses only the encryption built into Safari (Web Crypto). Confirm the answer
   in the listing's notes; it's your declaration.
9. **(you) App Review information:** your name, email and phone (+country code); no sign-in needed; paste the
   listing's **Notes for the reviewer**.
10. **Version release:** Manually release this version, so it goes out alongside the other stores.
11. **Submit for Review.** Reviews usually take a day or two. A rejection arrives in the Resolution Center: bring
    the message to me, and I'll change what it asks and say what to reply.

## Change log

- 2026-11-10: First version.
- 2026-11-10: The app is created in App Store Connect as Pipeup: Commenting for HTML; build 0.9.1 (1) uploaded for
  TestFlight from Xcode's Organizer.
- 2026-11-23: Section A points at the Safari UI test for the first run.
- 2026-11-25: A development build signed by the team (APPLE_TEAM_ID) needs no Allow Unsigned Extensions; one copy in one place, since Safari turns the extension off when the app under it changes.
- 2026-11-25: Step A is one command, npm run safari-install: a signed build, one copy, a fresh build number; the test checks the install before it runs.
