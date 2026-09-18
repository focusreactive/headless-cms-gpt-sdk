# Designer prompt — style presets, nested model

This replaces everything I told you about screens 2 and 3 in my two previous
messages, including the language switcher inside the form. Screen 1, the
translation screen, does not change at all.

## What changed, and why

The stored shape in my earlier brief was wrong. A style preset is not "one
preset, one language". One preset carries settings for several languages:

```json
{
  "id": "p1",
  "name": "Product pages",
  "byLocale": {
    "fr": {
      "formality": "formal",
      "voice": [{ "word": "strict" }],
      "instructions": "Audience: developers."
    },
    "de": { "formality": "neutral", "voice": [], "instructions": "" }
  }
}
```

So "Product pages" is one thing an editor picks by name, and it holds a
different tone for each language. Both screens below have to make that visible,
and — this is the part my earlier brief got wrong — they have to make it
impossible to be unsure which language is being edited.

## Screen 2 — the preset list

Today a row is one preset with one language code beside it. Replace it with an
expandable row.

Collapsed, one line per preset:

```
▸  ★ Product pages                        2 / 5
▸    Legal                                1 / 5
▸    Blog                                 1 / 5
```

- the chevron rotates when the row opens
- the star marks the space default. Exactly one star in the whole list — the
  default is a preset, never a preset-plus-language. Setting it works the way
  you already drew it
- "2 / 5" is how many of the space's languages this preset is configured for.
  Keep it quiet: secondary text, not a badge, not a pill

Expanded, one line per language of the space — every language, configured or
not:

```
▾    Legal                                1 / 5
        French             configured       ›
        German             not set          ›
        Spanish            not set          ›
        Italian            not set          ›
        Portuguese         not set          ›
```

- the whole line is the control. Tapping it opens screen 3 for that preset in
  that language
- "configured" / "not set" is secondary text. "not set" is an invitation, not a
  problem: no red, no warning icon, no bold
- the chevron on the right says the line opens something
- several presets may be open at once; opening one does not close another

The panel is about 360px wide and language names get long ("Portuguese
(Brazil)"). Let the name have the room — the state text shrinks or drops before
the name truncates.

The "New preset" button stays at the bottom, unchanged in placement and weight.

## Screen 3 — the form

The layout you drew is right. Keep the fields, their order, the character
counter, the error states, the Cancel/Save bar, and the two-step Delete. Two
changes.

**1. The line under the title names the language, and differs by mode.**

Editing an existing language — static text, not a control, because the language
was already chosen by the row that was tapped:

```
← Legal
──────────────────────────────────
Language: French
──────────────────────────────────
Formality      [ Formal ▾ ]
Voice          [strict ×] [technical ×]
Instructions
               Do not translate "Checkout"
──────────────────────────────────
  Delete            Cancel     Save
```

Creating a new preset — a select, because the language is one of the two things
being decided here, the other being the name:

```
← New preset
──────────────────────────────────
Name           [                     ]
Language       [ French           ▾ ]
──────────────────────────────────
Formality      [ Neutral ▾ ]
Voice          [                     ]
Instructions
               [                     ]
──────────────────────────────────
                  Cancel     Save
```

The select defaults to the language currently being translated into on screen 1
and lists every language of the space. There is no Delete on a preset that does
not exist yet.

**2. The delete confirmation has to say what it really does.** Delete removes
the preset for every language at once, and the editor pressing it is looking at
one language. So the second state reads "Delete for all languages?" rather than
"Confirm". Keep the fill/colour change between the two states we agreed on — the
difference must not be carried by the text alone.

Also, for your understanding rather than as something to draw: a language whose
three fields are all left empty is not stored. It simply stays "not set". The UI
says nothing about it.

## Values and limits — unchanged

- Formality: Neutral / Formal / Informal. Three values, a select, not a toggle
- Voice: chips, free text, up to 20
- Instructions: multi-line, up to 500 characters, counter appears from 400

## Please leave alone

- screen 1
- the field layout, spacing and states inside the form
- the two-step delete pattern
- the empty state of the list
