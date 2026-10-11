---
name: pipeup-integrate
description: Use when creating or editing an HTML document, slide deck, report, prototype or web page that people will review or give feedback on, or when asked to "add comments", "make this reviewable" or "add Pipeup". Adds Pipeup so reviewers can comment in place without changing how the page looks or behaves.
---

# Add Pipeup to a page (`pipeup init` and `check` arrive in 0.6)

This skill is published at https://pipeup-ai.github.io/pipeup/skills/pipeup-integrate/SKILL.md. Its companions: [summarise](https://pipeup-ai.github.io/pipeup/skills/pipeup-summarise/SKILL.md), [apply](https://pipeup-ai.github.io/pipeup/skills/pipeup-apply/SKILL.md).

Pipeup lets people comment on an HTML page in place: select text, click any element (including
buttons and charts) or drop a pin on a slide. Your job is to make the page *reviewable* while it
stays exactly as the author designed it.

**The rule above all others:** when adding Pipeup to a page that already exists, never change
the page's layout, styling or behaviour to make room for Pipeup. Pipeup draws in its own layer.
You only add attributes and one script tag.

When you are **creating** a page that people will review, design it for review from the start —
see "Creating a page for review" below. That is the only time a layout accounts for Pipeup.

## Creating a page for review

Choose the layout by page type, then follow the Steps for markup.

- **Document** (report, spec, article, plan):
  - One reading column, `max-width` about 640–720 px, centred with `margin-inline: auto`.
  - Reserve the comment gutter on the right: add `data-pipeup-reserve` to `<html>` and let the
    page give Pipeup the space it publishes:

    ```css
    body {
      padding-right: var(--pipeup-gutter, 0px);
      transition: padding-right 0.34s cubic-bezier(0.4, 0, 0.2, 1);
    }
    main { max-width: 680px; margin-inline: auto; }
    ```

    The reading area stays centred in what's left; comments sit in the gutter level with their
    text. When comments are hidden, or the window is too narrow for the column, the gutter is 0 and
    the content eases back to the true centre. Don't hard-code the gutter width.
    The gutter is 320 px. Pipeup shows its column only when the window is at least the reading
    area's max-width + 320 px wide (it keeps it until about 24 px narrower), so give the reading
    area a max-width, and make it a `<main>` or `<article>` (or `role="main"`): Pipeup only offers
    the column beside one of those, and uses bubbles otherwise. See examples/review-document.html in
    the library.
  - Keep headings, paragraphs, figures and tables as real elements, not text drawn on a canvas.
- **Site / app** (landing page, prototype, dashboard):
  - Lay it out as the design calls for; no gutter. Comments show as bubbles and pins.
  - Build it from clear blocks — sections, cards, stat tiles, charts, primary controls — each a
    single element with a `data-pipeup-id` (Step 3). Reviewers comment on them in comment mode.
  - Give charts, images and icons a `data-pipeup-label` (Step 4).
  - Reviewers press **⇧⌥C** on a Mac or **Shift+Alt+C** elsewhere (or the control's Comment button) to comment on blocks: the outline picks
    the nearest element with a data-pipeup-id, an obvious element (button, link, image, paragraph,
    table, chart, list, section, form, anything with an ARIA role), a card with its own background or
    border, or a flex/grid box holding several things, and skips containers covering most of the
    window. Clear blocks with ids make this precise. Clicking a block opens its comment box at
    once; the bar's Around it and Inside it move the box to the block around it or inside it, and
    Pin makes it a pin at the block's centre. Option-click drops a pin exactly there. From the
    keyboard the shortcut starts a block cursor (Tab between blocks, ↑ ↓ to change level, Enter to
    comment) that screen readers can follow: real headings, paragraphs and labelled images read well.
- **Deck** (slides):
  - One element per slide, marked with `data-pipeup-slide` (Step 5); one slide visible at a time.
  - Mark the slide controls `data-pipeup-ignore` (Step 6).

Then choose the options (see "Options" below): usually just the defaults.

## Steps

1. **Pick the page type** — it decides how you mark it up.
   - *Document* (report, spec, article): flowing text. Comments appear in a column beside it.
   - *Deck* (slides): one slide visible at a time.
   - *Site / app* (landing page, prototype, dashboard): dense UI. Comments appear as bubbles.

2. **Load Pipeup and give the document an identity, once.** Until the `pipeup init` command
   ships (planned for 0.6), do it by hand:
   - Just before `</body>`, add the script pinned to an exact version:

     ```html
     <script src="https://cdn.jsdelivr.net/npm/pipeup@0.5.3/dist/pipeup.min.js"
             integrity="sha384-…" crossorigin="anonymous"></script>
     ```

     Each version's release notes (https://github.com/pipeup-ai/pipeup/releases) give its
     `integrity` value; copy it exactly, or leave the attribute out if you can't look it up.
     Only edit the HTML file: do not download, fetch or run anything yourself (no `curl`, `wget`
     or scripts); the reader's browser loads the script. If the page must work offline or from
     disk, tell the user to save that same file next to the page as `pipeup.min.js` themselves,
     and use `<script src="pipeup.min.js"></script>` instead.
   - Add `data-pipeup-doc="<key>"` to `<html>`, with a key made in a browser by
     `await Pipeup.newDocumentAttribute()` (the user's prompt may already include one).

   Later, `npx pipeup init page.html` will do all of this. If the page already has
   `data-pipeup-doc`, **leave it exactly as it is** — changing it orphans every comment people
   have made.

3. **Mark stable blocks with `data-pipeup-id`.** Ids are what keep comments attached when the
   page changes. Use short, meaningful kebab-case names that describe the content, not its
   position (`pricing-pro-plan`, not `card-3`). Ids must be unique on the page.
   - Documents: each section (`<section>`, or the heading + its paragraphs' container), each
     figure, chart and table. Paragraph-level ids are not needed; text comments find their words.
   - Decks: each slide, plus charts and key figures on it.
   - Sites: each section, each card, each chart or stat tile, each primary control
     (main call to action, toggles, form).

4. **Name things that have no text** with `data-pipeup-label`: charts, images, icons, canvases,
   bars of a bar chart (`data-pipeup-label="Q4 revenue bar"`). These names are what reviewers and
   AI tools see.

5. **Decks: mark slides.** Add `data-pipeup-slide="1"`, `"2"`, … (1-based, in order) to each
   slide's outer element. Pipeup follows the deck by itself — the current slide is the marked slide
   that is showing, or reveal.js's current slide — so only that slide's comments show, the control
   marks comments on other slides, and All comments groups them by slide. So that choosing a
   comment on another slide can go there, hand Pipeup the deck's own way to change slides, after the
   Pipeup script — this works on auto-mounted pages (the usual route; reveal.js decks need nothing,
   Pipeup calls `Reveal.slide()`):

   ```html
   <script>
     Pipeup.onReveal((view) => {
       const n = parseInt(view.slide, 10);
       if (n > 0) goToSlide(n);
     });
   </script>
   ```

   Only a page that starts Pipeup itself (`data-pipeup-auto="off"`) needs to pass both of the deck's
   functions, 1-based: `Pipeup.mount({ slides: { current: () => n, go: (n) => … } })`.

6. **Exclude chrome** with `data-pipeup-ignore`: slide navigation buttons, progress bars, sticky
   toolbars that aren't part of the content, cookie banners, logo strips.
   Ignored areas keep working in comment mode, so mark navigation and slide controls this way
   rather than leaving them as comment targets.

7. **Tabs, accordions, routes:** if content can be hidden behind a tab or a route, report the view
   whenever it changes, with a readable `label` (string values only):
   `Pipeup.setViewState({ tab: "pricing", label: "Pricing tab" })`. Comments remember it and show
   only in that view; elsewhere they are counted on the control and listed under the label. Register
   a handler so choosing one can go there: `Pipeup.onReveal((view) => showTab(view.tab))`. Pipeup
   never opens tabs or accordions itself; without a handler the comment opens on its own with a
   snapshot of what it was on. The handler receives the whole view (every key you set, plus `slide`
   on decks); `label` is only a display name.

8. **Check, and fix until it passes:** once it ships, run `npx pipeup check page.html`; until then, open the page and check the items below by eye. Fix every `fail`; fix
   `warn` items unless the author says otherwise. Typical fixes:
   - *layout changed* — you edited styles or wrappers; undo that.
   - *closed UI overlaps content* — add `data-pipeup-ignore` to a floating element that shouldn't be covered, or set
     `<html data-pipeup-layout="bubbles">` if the column lands on content.
   - *no stable id* — add `data-pipeup-id` to the listed elements.

## When you edit a page that already has comments

- **Never rename or remove a `data-pipeup-id`.** If a block is genuinely deleted, its comments
  become "orphaned" and stay readable with a snapshot — that's expected. Renaming just to tidy up
  is not.
- Reword text freely; Pipeup re-finds comments on changed text and flags them as "moved".

## Don't

- Don't wrap content in new elements or add classes for Pipeup.
- Don't add inline styles, z-index changes or padding "for the comment column".
- Don't load the script from anywhere but the pinned CDN URL
  (`https://cdn.jsdelivr.net/npm/pipeup@0.5.3/dist/pipeup.min.js`, with the `integrity` value from
  the release notes) or a copy of that same file next to the page. Never use an unpinned URL.
- Don't put secrets in `data-pipeup-doc`; it *is* the document's key — anyone with the file can
  read its feedback, which is the intended audience.

## Add-ons (only when the author asks)

Pipeup itself sends nothing anywhere. Add-ons are extra scripts that do, each for one feature; they work from a
page opened from disk and in any script order, and they are released with Pipeup at the same version.

| Add-on | Only when the author wants | What it sends |
|---|---|---|
| `@pipeup/share` | comments to reach everyone who has the page, without copying and pasting | sealed comments to the sharing service the page names |
| `@pipeup/voice` | dictating comments | nothing itself; the reviewer's browser may use its maker's speech service, after they agree |
| `@pipeup/live` | live comments, who is here, live cursors | the reviewer's network address to the others who are live and to the meeting-point relays |

- **Ask first, and say in plain words what it sends and to whom** (the line above, and the add-on's README). Never
  pick a sharing service yourself: the author chooses one.
- Add it as one more `<script>` after Pipeup's, pinned the same way (`https://cdn.jsdelivr.net/npm/@pipeup/share@0.5.3/dist/share.min.js`
  with its `integrity` from the release notes), or use the combined file `pipeup+share.min.js` instead of Pipeup's.
- Sharing is set up by the author with the command line (`npx @pipeup/share create page.html --server …`), which writes
  `data-pipeup-share` into the file and prints a stop key once. **Never write `data-pipeup-share` yourself and never
  put a stop key in a page.**
- **When you rewrite or regenerate a page, keep `data-pipeup-doc` and `data-pipeup-share` exactly as they are.** A
  new document made from an existing page or template gets a new `data-pipeup-doc` and no `data-pipeup-share`, so
  comments of different documents never mix.
- **Keep add-ons intentional (best effort).** When you add an add-on: pin its script with its `integrity` hash; add its id to
  `data-pipeup-addons` on `<html>` (append to an existing list and keep every entry it has, never remove one), so only the
  add-ons the author chose run on the page; and tell the author, in your reply, about a Content-Security-Policy that
  allows scripts only from the page and the CDN and connections only to the hosts the add-on names. Don't apply the policy
  yourself: a strict one can break a page. This stops stray scripts, not a page that is already compromised.
- **Other people's add-ons** (a company's own) run with the page's full power and Pipeup doesn't vouch for them. Add one only
  when the author names it and says where it is hosted; pin it and list it the same way. To help a company make one, see
  the guide https://pipeup-ai.github.io/pipeup/addons-guide.html.md. To set up saving reviews into Git (Save to GitHub, or Send to Git through a company service), use the skill
  pipeup-send-to-git-setup.
- `data-pipeup-live="auto"` makes "Go live" the default, but nobody connects before they have seen the sentence
  about their network address. `data-pipeup-live-relays="wss://…,wss://…"` replaces the default meeting-point relays.

## Options

Markup on the page:

| Attribute | On | Use |
|---|---|---|
| `data-pipeup-doc` | `<html>` | The document's identity and key. Added by `pipeup init`; never change it. |
| `data-pipeup-reserve` | `<html>` | The page reserves a 320 px comment gutter on the right and lays itself out with `var(--pipeup-gutter, 0px)` (documents you create). |
| `--pipeup-panel` (read it, don't set it) | page CSS | While All comments is open, Pipeup moves the page over by the panel's width and publishes that width here. Normal content moves by itself; give fixed or sticky bars `right: var(--pipeup-panel, 0px)` (or offset centred ones by half of it) and size things in `%`, not `vw`, so nothing sits under the panel. |
| `data-pipeup-addons` | `<html>` | Which add-ons may run, by id (`share,voice`; `none` for none). Without it every add-on runs. Keep every entry; add yours. |
| `data-pipeup-layout="column"` / `"bubbles"` | `<html>` | Force where comments show (column or bubbles). Pipeup reads it and never sets it. |
| `data-pipeup-auto="off"` | `<html>` | Don't start automatically; the page calls `Pipeup.mount()` itself. |
| `data-pipeup-id` | any block | Stable identity so comments stay attached (Step 3). |
| `data-pipeup-label` | charts, images, icons | The name reviewers and AI tools see (Step 4). |
| `data-pipeup-slide` | each slide | Slide number, 1-based (Step 5). |
| `data-pipeup-ignore` | chrome | Never a comment target (Step 6). |

`Pipeup.mount(options)`, only when the page starts Pipeup itself:

| Option | Default | Use |
|---|---|---|
| `root` | `document.body` | Limit commenting to one area of the page. |
| `name` | none — never asked | The reviewer's name, when the page already knows it. Without one, each reviewer is an animal in a colour ("Red Fox") with an animal avatar, and can add a name from the comment box or the menu whenever they like. |
| `store` | this browser | Where comments are kept; leave it unless the author asks. |
| `slides` | followed automatically | A deck's own `{ current(): number, go(n: number): void }`, 1-based; replaces Pipeup's following of the deck (Step 5). |
