# One-tap commenting, selection outside comment mode, the page API, and settings off `<html>`

Spec: FUNCTIONAL_SPEC §4, §4a, §5, §7 (2026-10-21). Visual spec: [one-tap-page-api-mockups.html](one-tap-page-api-mockups.html).

## Why

A reviewer built a trip itinerary on 0.8.2 and had to work around Pipeup to make it usable for two non-technical
people. She faked ⇧⌥C key presses to drive comment mode, polled a class name in the shadow root to read it, built her
own selection button that clicked Pipeup's hidden one, remounted Pipeup to change the name, and set `<html>` attributes
from a script because claude.ai Artifacts replace `<html>`. Each workaround maps to one change below.

## The control (`ui/launcher.ts`)

- The round button (`.mode`) is a toggle: `aria-pressed` follows comment mode; it no longer has `aria-haspopup`.
  A click calls `ctx.setCommenting(!on, keys)`, where `keys` (detail 0, turning on) puts the block cursor on the page,
  as the menu's switch did.
- **⋯** (`.mm`) is a real button at the left end of the reach, after the shortcut. It folds with the reach (hover or
  focus within the control) and opens the menu, focusing Start commenting when opened from the keyboard. It carries
  `aria-haspopup="menu"` and `aria-expanded`.
- Touch: a press held 500 ms on `.mode` opens the menu and swallows the click that follows. The first time comment mode
  starts by touch, the hint adds "Press and hold for more" (remembered in `localStorage`, guarded).
- Keyboard: ↑ or the ContextMenu key (and Shift+F10) on `.mode` opens the menu and focuses its last row.
- All comments is reached from the menu row; the panel's footer is unchanged.

## Selection (`ui/select.ts`)

- `check()` no longer requires `ctx.state.commenting`. Outside comment mode it still skips ignored areas and fields,
  and it is off when the page sets `data-pipeup-select="comment-mode"` (or `select: "comment-mode"` at mount).
- Choosing the icon starts the draft on the range exactly as in comment mode; comment mode stays as it was.

## The page API (`ui/mount.ts`)

```ts
interface PipeupInstance {
  readonly commenting: boolean;
  setCommenting(on: boolean): Promise<void>; // resolves once the mode has changed (next render)
  readonly name: string;                     // "" until one is set
  setName(name: string): Promise<void>;      // saved like the menu's name row
  on(event: "change", fn: (s: { commenting: boolean; name: string }) => void): () => void;
}
```

- `change` fires after the state differs from the last one sent, whatever caused it: the control, the shortcut, Esc,
  the menu, a rename, or the page.
- `mount()` rejects with an `Error` carrying `code`: `"another-copy"` (another Pipeup owns the add-on queue),
  `"no-root"` (the root element isn't in the page) or `"failed"` (anything else, with the cause). It still logs.

## Settings (`ui/settings.ts`)

- `setting(name, given?)`: the mount option if given, else the first `<script>` carrying the attribute, else
  `<html>`. Exported as `Pipeup.setting` so add-ons can read their own attributes the same way.
- Core reads `data-pipeup-doc`, `-auto`, `-layout`, `-theme`, `-select`, `-agents`, `-addons` and `-updates` through
  it. Mount options: `doc`, `layout`, `theme`, `select`. `-auto` and `-addons` are read before any mount, so they work on
  a script line or `<html>` only.
- Add-ons that read `<html>` use `Pipeup.setting` when it exists, falling back to `<html>` on older cores.

## Change log

- 2026-10-21 — First version, from the approved visual spec, with its recommended answers: hold to open the menu by
  touch, selection on by default with an author switch, no "comment on this element" call yet, and All comments from
  the menu.
