# Pipeup privacy policy

Last updated: 10 November 2026

Pipeup is a free, open-source (MIT) extension for commenting on web pages and passing those comments to the person or AI agent who asked for your feedback. It has no account, no sign-in, no server of its own, no advertising, no analytics and no telemetry. All of its code is in the extension; it loads no code from the web. The developer receives none of your data.

Some features are not offered in every browser. If a feature below doesn't appear in your browser's version of Pipeup, it isn't there and does nothing.

## What Pipeup keeps in your browser

The extension keeps the following in its own storage, in this browser on this device. It is not synced and not sent to the developer.

- **Your comments**, page by page: what you wrote, your display name, the time, and where on the page each comment is. That place is described by the words you chose and the text around them, what the element is and is called (which can be a link address or a picture's file name), the headings above it and its position in the page. Editing or deleting a comment adds to this record; the earlier text stays in it.
- **A list of pages you have commented on**: each page's address (without the part after ? or #), its title and when its comments last changed. This is the "Comments you've made" list.
- **Your choices for each site where you started Pipeup** (its look, Hide comments). These also amount to a list of those sites. The extension also keeps the sites you set to Always on.
- **Your Pipeup identity**: the display name you choose and a signing key made in your browser, stored unencrypted in the extension's storage. The same key signs your comments on every site, so comments you pass on from different sites can be linked to you.
- **Pictures of where comments were made**: when you make a comment, Pipeup takes a picture of the visible tab and keeps a small part of it (at most 480 pixels wide) around the comment, including whatever else was on screen there. It is used only to show you what a comment was about if its place on the page has gone. Pictures are on by default. They are never copied, saved, sent or shared. Deleting a comment does not delete its picture. Turning off "Keep a picture of where each comment was made" in the settings stops them and deletes every picture kept.
- **Your settings**: which add-ons are on, a sharing address and a GitHub repository if you set them, whether comments open beside the page, the toolbar icon's light or dark look, and which agent replies have already been added.

## What the website you are on can see

Pipeup draws its comments inside the page you are commenting on. While Pipeup is on a page, that page's own scripts can read the comments shown or typed there. They cannot read the extension's storage or the comments kept for other pages.

Some add-ons keep small settings in the visited site's own storage, not the extension's. The site can read and change them, and they stay after you remove the extension until you clear that site's data:

- **Emoji** (on by default): your recent emoji and skin tone.
- **Voice, Share and Live** (if you turn them on): their own choices for that page, including whether you agreed to go live.

If you leave the sharing address or the GitHub repository empty, the page you are on can name its own, and it can name Live's relays.

## What leaves your browser, and when

Nothing leaves your browser except in these cases.

- **Copy comments**: when you press it, the comments go to your clipboard, as Markdown or text, with the page's address.
- **Save comments**: when you press it, a file is saved where your browser saves downloads. A Pipeup file includes edited and deleted text.
- **Send to my agent** (optional, needs a free helper program you install yourself): when you press it, the page's comments (including edited and deleted text), its full address and its title go to that program on your own computer through the browser's native messaging. The program writes them to a folder on your computer (~/.pipeup/browser) for your AI agents, and passes their replies back into the threads. While Pipeup is on in a tab, the toolbar menu also asks that program for new replies, sending only the page's comment id, which is made from the page's address. If the program isn't installed, nothing happens. This route sends nothing over the internet.

Add-ons are optional parts of Pipeup that you turn on or off in its settings. Apart from Emoji, they are all off until you turn them on.

- **Emoji** (on by default): an emoji picker. It sends nothing.
- **Voice** (off): lets you dictate a comment using the browser's own speech recognition. Your browser asks for the microphone first. Depending on the browser, language and device, your voice may be sent to the browser maker's online speech service. Pipeup itself receives and keeps no audio.
- **Share** (off; works only on pages built for it): sends your comments, including edited and deleted text, encrypted, to the sharing server you set (or that the page names), and fetches other people's. Once it is on, your new comments are sent automatically. Earlier ones wait until you choose. The server sees your network (IP) address, and when and how much you send.
- **Live** (off; works only on pages built for it, after you agree): connects you with others on the same page through public relays (relay.damus.io, nos.lol, relay.primal.net, or relays the page names) and connection (STUN) servers run by Google and Cloudflare, then directly to the other people. They receive the page's comments (including edited and deleted text), your name and where your pointer is. The relays, servers and other people see your IP address.
- **Save to GitHub** (off): for a comment that mentions someone on GitHub, it opens github.com's new-issue page with the people mentioned, your name, the comment, the page title and its full address filled in. GitHub receives these when that page opens; nothing is filed until you submit it there. GitHub's own privacy policy applies on github.com. Pipeup keeps no GitHub sign-in.
- **My identity** (off): shows a recovery code for your identity so you can copy, save or restore it. It sends nothing. Anyone with the code can write comments as you.

## How your data is used

Pipeup uses your data only to let you comment on web pages and pass those comments to the people or agents you choose. It is never sold or transferred to anyone else. It is never used for advertising, for credit or lending decisions, or for any purpose unrelated to commenting. Nobody at Pipeup reads it, because none of it reaches Pipeup. Data goes elsewhere only when you send it with one of the features above.

## How to remove your data

- **Pictures**: turn off "Keep a picture of where each comment was made" in Pipeup's settings.
- **Always on**: turn the switch off in the toolbar menu; the site access is removed too.
- **Everything the extension keeps** (comments, the list of pages, your identity, settings, pictures): remove the extension. There is no button to delete everything yet.
- **What add-ons kept in a site's storage**: clear that site's data in your browser's settings.
- **Send to my agent**: delete the ~/.pipeup/browser folder, ~/.pipeup/browser-host.sh and the browser's ai.pipeup.browser.json host file. Removing the extension does not remove them.
- **Files you saved, and anything you copied, shared or sent**: these are yours or the recipients'; Pipeup can't reach them.

## Children

Pipeup isn't directed at children and collects nothing from anyone.

## Changes

If this policy changes, the new version will be posted here with a new date, and the change will be noted in the project's changelog.

## Contact

[support contact: maintainer to supply], or https://github.com/pipeup-ai/pipeup/issues

Source code: https://github.com/pipeup-ai/pipeup

## Change log

- 2026-11-10: First draft, not yet published.
