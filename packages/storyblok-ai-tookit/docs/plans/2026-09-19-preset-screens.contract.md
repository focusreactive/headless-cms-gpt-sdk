# What the preset screens show and do

Taken from the artboards, which are the contract: every quoted string below is the string
the design carries, and every accessible name is the one it gives. A screen that renames a
control has broken this document, not improved it.

Three screens, built and tested in that order: the list, the form, the picker on the
translation screen.

Throughout: the panel is one column. There is no router — a screen is shown or it is not.

---

## Screen A — the preset list

Reached by the gear on the translation screen. Leaves by the back button.

### Its frame, always

- a back button, accessible name **"Back to Localization"**
- a heading **"Style presets"**
- at the bottom, a button **"New preset"**

### While the settings are loading, and when they failed

Neither is drawn — the artboards have no such state for this screen, though its first load
is in flight the moment it opens. So it borrows the two wordings the translation screen
already carries for the same two situations, rather than inventing a third for them:

- loading: the frame plus **"Loading style settings…"**, and no list;
- failed: the frame plus a live region reading **"Couldn’t load style settings. Localize
  will run without a preset."** with a **"Retry"** button that asks for another load.

Decided here rather than drawn. Flagged as such.

### With no presets

Only the frame, plus the line **"Save a translation style and reuse it."** No list, no
empty row, no placeholder.

### With presets, collapsed

One row per preset, in the order the settings hold them. Each row carries, in this order:

1. a chevron button whose accessible name is **"Expand <name> — <n> of <m> languages
   configured"**, and **"Collapse …"** once open, where `m` is how many languages the space
   has and `n` how many of them this preset has settings for;
2. a star button. For the preset the settings name as default its accessible name is
   **"<name> is the default preset"**; for any other, **"Make <name> the default"**.
   Pressing the second kind makes that preset the default. Pressing the first kind is not
   drawn as doing anything;
3. the preset's name;
4. the count, rendered **"<n> / <m>"**, quiet and secondary;
5. a delete button, accessible name **"Delete <name>"**.

The row itself opens and closes; it does not navigate.

### A row, expanded

Below the row, one line per language **the space has** — every one, whether the preset
covers it or not, in the order `languages` gives them. Each line is a button whose
accessible name is **"<preset name> — <language name>, configured"** or
**"… , not set"**, and whose visible text is the language's name and then the word
**"configured"** or **"not set"**.

A language counts as configured when the preset holds an entry for it that says something.
A preset with no settings for a language, and one whose entry for it contributes nothing,
are the same thing here.

Pressing a language line opens the form for **that preset and that language**, handing on
**the space's own code** for it — `pt-br`, not the `pt_br` that keys `byLocale`. The screens
speak the space's vocabulary and normalise only where they touch storage, because that
direction is the reversible one: a raw code yields the key, while a key cannot say which raw
code it came from.

Several rows may be open at once. Opening one does not close another.

### Deleting from the list

Two presses. The first arms it: the button's accessible name becomes **"Delete <name> —
tap again, removes <n> language"** and a note appears reading **"Tap again to delete ·
<n> language"**, with **"languages"** for any `<n>` other than one. The artboard draws the
singular case; the plural is not drawn, and writing `language(s)` — as an earlier draft of
this document did — would be a wording no designer chose.

`<n>` here is the same count the chevron names: languages the preset is **configured** for,
not keys its `byLocale` happens to hold. A confirmation showing a different number from the
row it sits on would be a lie, and an entry that says nothing is not a language covered.

The second press removes the preset. Arming one row's delete disarms any other. Nothing is
removed by the first press alone.

### Not built

The artboards draw a duplicate button on each row. It is deliberately absent from the code.

---

## Screen B — the preset form

Reached from a language line on the list (editing) or from "New preset" (creating). Leaves
by the back button, by Cancel, or by a save that lands.

### Its frame

- a back button, accessible name **"Back to style presets"**
- a heading: the preset's name when editing, **"New preset"** when creating
- a footer: **"Delete"**, **"Cancel"**, **"Save"** when editing; **"Cancel"** and
  **"Save"** when creating — there is no Delete for a preset that does not exist

### Its fields, in order

| Field | Label | Notes |
|---|---|---|
| name | **"Name"** | placeholder **"e.g. Product pages"** when creating |
| language | **"Language"** | **creating only.** Lists every language of the space and opens on the one being translated into |
| — | **"Settings for <language name>"** | a heading, not a control. When editing a language the preset has nothing for, the line **"Nothing set yet. Saving adds <language> to this preset."** follows it |
| formality | **"Formality"** | three options, **"Neutral"**, **"Formal"**, **"Informal"**; opens on Neutral for a language with nothing set |
| voice | **"Voice"** | chips, free text. Placeholder **"Type a word, press Enter"** when empty. Helper **"Aim for 3–5 · <n> of 20"** |
| instructions | **"Instructions"** | multi-line. Placeholder **"House rules, e.g. terms to leave untranslated"** |
| — | **"Preview"** | a disclosure, closed by default |

Each chip carries a remove button named **"Remove <word>"**.

### What it says when something is wrong

Each message replaces that field's helper text. **A field shows nothing wrong until it has
been left once**; after that it shows what is wrong as it is typed. That is one flag per
field, not a rule about the current focus — read the other way, the duplicate-word message
below could never appear, since leaving the field is what clears the duplicate. The counter
is not an error and follows none of this.

| Situation | The text |
|---|---|
| the name is empty or only spaces | **"Name is required."** |
| another preset already carries the name | **"A preset called “<that name>” already exists."** |
| twenty voice words in the list | **"Remove one to add another"**, beside the counter rather than instead of it |
| the word typed is already in the list | **"“<word>” is already in the list. It clears when you move on."** |
| instructions at 400 characters or more | **"<n> / 500"** — a counter, not an error |
| instructions over 500 characters | **"<n> / 500 — remove <n − 500> characters to save."**, with **"character"** when one |

On the cap: the note appears at **exactly twenty**, which is what the artboard draws, and
the field refuses a twenty-first word. `validatePreset`'s `tooMany` fires only past twenty
and therefore never from this screen — it guards a preset that arrived from storage holding
more, which the screen cannot produce.

While typing a voice word and before committing it: **"Enter adds it — so does leaving the
field."** A word is committed by Enter and by leaving the field.

**Save is disabled** whenever anything is wrong, and while a save is in flight.

### Before the settings have loaded

Reachable only by a reload, since the list shows no rows until they are ready. The frame
plus **"Loading style settings…"**, and no fields. Decided here rather than drawn.

### Saving

While the save is in flight every control is disabled and Save reads **"Saving…"**.

A save that fails shows, in a live region, **"Couldn’t save. Your changes are still here —
try again."** The fields keep what was typed, and Save becomes pressable again.

A save that lands returns to the list.

### Leaving with unsaved edits

Back or Cancel with changes pending asks **"Discard unsaved changes?"** with
**"Keep editing"** and **"Discard"**. Nothing is asked when nothing was changed.

### Deleting from the form

Two presses, like the list. The second state reads **"Delete for all languages?"**. It
removes the preset — every language of it — and returns to the list.

**Known and carried:** the armed state replaces the whole footer, Cancel included, so
someone who armed it by accident has no visible way out until it disarms itself. Drawn that
way, and shipped that way on purpose.

### The preview

Closed by default. Open, it shows the sentence the model will be told, composed from the
fields as they stand:

- filled: **"Translate into French using formal address. Voice: concise, plain, confident.
  Keep product names in English. Never translate the word Checkout."**
- empty: **"Translate into French."** then **"Formality is Neutral. Voice and Instructions
  are empty."**

The composition is a pure function of a language name and a `LocaleStyle`. **It is not
wired to the model** — prompt composition is a later step, by the owner's decision — and
when that step comes it should call this function rather than grow a second one.

---

## Screen C — the picker on the translation screen

Sits on the existing translation screen, between the target language and the buttons.

`locale` is the space's own code for the target language — the raw one, as everywhere in
these screens; the picker normalises it itself where it looks a preset's entry up.

`chosen` says what the editor has said, and it has **three** states, not two: nothing said
yet (so the space's default applies), said "no preset at all", and said one by name. A
nullable id cannot tell the first two apart, and conflating them makes choosing
**"No preset"** unobservable — the screen would remember nothing and go on showing the
default. So the prop carries a small union, and `onChoose` always reports something
definite.

- a select labelled **"Style preset"**, listing every preset by name, plus an option
  **"No preset"**. It opens on the preset the settings name as default, and on
  **"No preset"** when there is none
- beside it a button, accessible name **"Manage style presets"**, which opens screen A

### What it says under itself

| State | The text | And |
|---|---|---|
| the settings are loading | **"Loading style settings…"** | the **Localize** button is disabled |
| the settings failed to load | a live region: **"Couldn’t load style settings. Localize will run without a preset."** with a **"Retry"** button | the Localize button reads **"Localize without style"** |
| a preset is chosen that has nothing for the target language | a live region: **"No <language> settings in this preset. Localize will use its default style."** | Localize is pressable and unchanged |
| otherwise | nothing | |

The chosen preset is remembered next to the target language, and it reaches nothing else
yet: prompt composition is a later step.

**Readiness stays where it was.** The reducer's `isReadyToPerformLocalization` is not told
about preset loading; the Localize button carries that condition itself. A recorded
baseline pins the reducer's behaviour, and this keeps it pinned.
