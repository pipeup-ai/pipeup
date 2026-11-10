# Submitting Pipeup for Safari

Safari's Pipeup is a Mac app with the extension inside, sent to Apple through App Store Connect. The listing's words
are in [extension-listings.md](extension-listings.md), under **Safari (Mac App Store)**. Steps marked **(you)** need
your Apple account, your password or a legal answer.

## A. Check it in Safari (about 25 minutes, before anything else)

Nothing can drive Safari with an extension in it, so this is the only test of the extension in Safari itself.

1. Build and open the app: `node tools/build-extension.mjs --safari`, then open
   `apps/extension/dist/safari-app/build/Build/Products/Debug/Pipeup.app`. Its window says whether Pipeup is on.
2. **(you)** Safari → Settings → Advanced → turn on **Show features for web developers**. Then Develop → **Allow
   Unsigned Extensions** (asks for your password; Safari forgets it when it quits).
3. Safari → Settings → Extensions → turn on **Pipeup**.
4. Serve the sample page: `python3 -m http.server 8792 --directory apps/site/_site` (after `apps/site/build.sh`), and
   open `http://localhost:8792/extension-test.html`.
5. Run the Safari column of [the hand checklist](../testing/extension-checklist.md). Watch these first, which only
   Chrome and Firefox have tested so far:
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
   that Option-Shift-P starts Pipeup.
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
