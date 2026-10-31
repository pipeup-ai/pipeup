# Dictation in Safari and Firefox

Spec: [FUNCTIONAL_SPEC.md](../FUNCTIONAL_SPEC.md) §11a (*Dictation*) and §14 (the speech-service exception). Reported
on 0.8.2: "the microphone add-on doesn't seem to work well in Safari, or at all" and "I have not gotten the microphone
to work in Firefox". Visual spec for the review: [Dictation in Safari and Firefox](https://claude.ai/artifact/6q8nsaVyk9QwU6uuPEpD3G) (29 October 2026).

## What was found

Checked against WebKit's and Gecko's sources (29 October 2026) and two reproductions in Playwright's WebKit.

| Browser | What happens | Why | Fix |
|---|---|---|---|
| Safari | One refused prompt leaves the microphone pressed and dead for the rest of the page. | WebKit fires only `error`, never `end`, when a start is refused (a declined sheet, the macOS Speech Recognition alert declined, Siri and Dictation off, the service unavailable, the page not visible). The add-on cleaned up only in `onend`, so its one-at-a-time guard never cleared. | Every error ends the run, the same as `end`; the two can't run twice. |
| Safari | "The microphone is blocked" when the microphone is fine. | `service-not-allowed` means Safari isn't allowed to use Apple's speech recognition (System Settings › Privacy & Security › Speech Recognition, a one-time alert that is permanent once declined), or Siri and Dictation are both off, or Apple has no recogniser for the language. | A Safari sentence naming those; a neutral one for other engines. |
| Safari | "Allow it for this page, then press the microphone again" can't be followed. | WebKit remembers a refusal for the life of the page; only a reload gives a fresh sheet. | The sentence says to reload. |
| Safari | Every Apple-side failure reads "Dictation stopped." | Silence, a service error and lost network all arrive as `aborted`, with Apple's reason in `message`, which the add-on never read. | The reason is passed on when there is one. |
| Safari | Words repeat after a pause (likely; not confirmed on Safari 27). | In continuous mode Apple's recogniser can send everything said so far again as a new final (WebKit bug 252936, fixed only for non-continuous mode). Every final was written in full. | A final, or the words in progress, that repeats everything written so far (whole words) has that part taken off. The price: a phrase said twice in a row that exactly repeats everything so far is written once in Safari. |
| Safari | The consent sentence says the voice always goes to Apple. | WebKit works English out on the device when it can, and has no `available()` to say so. | The sentence says Pipeup can't tell which. |
| Firefox 157–159 | No microphone at all. | Firefox ships `SpeechRecognition` switched off: no engine, so nothing is drawn, by design. The reason reached only `Pipeup.addons()` and `pipeup check`. | One console line when an add-on ends up off. |
| Firefox 161 (planned, 24 November 2026) | Would get "from Google" in the download sentence, and a stuck microphone for a language with no model. | Mozilla's engine is on-device (a one-time model download from Mozilla) and reports a missing model as `service-not-allowed` before `start`, with no `end`. | The download sentence names no maker; a language the engine can't do is said before starting, with the language left open to change. |

Not a problem: `start()` after awaits (WebKit has no user-gesture check there); a bare `lang="en"` (Apple resolves it
to en-US); `resultIndex` handling (spec-correct, and the cumulative shape is already a unit test); the
one-at-a-time guard; the composer's `dictate()` neither drops nor duplicates text on its own.

## Not in this change

- Restarting quietly when Apple ends a server-based session after about a minute. Add it if a minute proves too short.
- A greyed microphone in Firefox saying there is no engine. Firefox 161 makes the question go away.
- A WebKit project in the e2e suite. Playwright's WebKit answers the speech-recognition sheet only from a primed
  `getUserMedia`, and without a microphone no words arrive; the Safari-shaped fake engine covers the behaviour.

## Checking in Safari

Open the demo over `http://localhost` (a file:// page is asked again on every load), show the Web Inspector console,
and before pressing the microphone paste a wrapper that logs every engine event (`start`, `audiostart`, `speechstart`,
`result`, `error`, `end`). A notice with no sheet and `not-allowed … User permission check has failed` is a
remembered refusal; `service-not-allowed … permission check has failed` is Safari denied under Speech Recognition;
`… service is not available` is Siri and Dictation off, or the language.

## Checked

- 2026-10-29 — Safari 27 on macOS 27.2, the demo page over `http://localhost`: the microphone lights, Safari shows
  its red microphone, and words arrive. The first press took a moment (the consent panel and Safari's sheets).

## Change log

- 2026-10-29 — Written, with the fix: errors end the run, Safari's sentences, Apple's reason passed on, repeated
  finals written once, the maker-free download sentence, a language with no model refused before starting, and the
  core's console line for an add-on that ends up off.
- 2026-10-29 — Checked by the maintainer in Safari 27: works.
