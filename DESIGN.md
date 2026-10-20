---
name: AutoType
description: A compact writing slip for a local plain-text draft and keyboard-controlled typing.
colors:
  paper: "#f7f5ee"
  ink: "#26372e"
  muted: "#596256"
  rule: "#d2d7ca"
  green: "#324c41"
  danger: "#9c3827"
  field: "#fffefa"
  field-border: "#aab4a5"
  placeholder: "#72776b"
  inactive: "#eeefe7"
  selection: "#d2e3cf"
  danger-hover: "#f4e3dc"
  progress-track: "#e0e4d9"
typography:
  title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "22px"
    fontWeight: 650
    letterSpacing: "-0.025em"
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "13px"
  passage:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "13px"
    lineHeight: 1.65
  label:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "13px"
    fontWeight: 600
  section-title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "13px"
    fontWeight: 650
  pace:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "16px"
    fontWeight: 650
  metadata:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "11px"
  status:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "12px"
    lineHeight: 1.4
rounded:
  keycap: "4px"
  button: "5px"
  field: "8px"
spacing:
  close: "5px"
  small: "8px"
  field-gap: "9px"
  row-gap: "10px"
  section-end: "12px"
  field-inset: "13px"
  section: "16px"
  gutter: "24px"
components:
  passage-field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    typography: "{typography.passage}"
    rounded: "{rounded.field}"
    padding: "{spacing.field-inset}"
    width: "100%"
  passage-field-disabled:
    backgroundColor: "{colors.inactive}"
  stop-button:
    backgroundColor: "transparent"
    textColor: "{colors.danger}"
    rounded: "{rounded.button}"
    padding: "5px 11px"
  stop-button-hover:
    backgroundColor: "{colors.danger-hover}"
  stop-button-disabled:
    textColor: "{colors.muted}"
  text-button:
    backgroundColor: "transparent"
    textColor: "{colors.green}"
    typography: "{typography.metadata}"
    padding: "0"
  text-button-disabled:
    textColor: "{colors.muted}"
  shortcut-keycap:
    backgroundColor: "{colors.inactive}"
    typography: "{typography.metadata}"
    rounded: "{rounded.keycap}"
    padding: "3px 7px"
  session-strip:
    padding: "13px 0 12px"
  progress-rule:
    backgroundColor: "{colors.green}"
    height: "4px"
    width: "100%"
---

# Design System: AutoType

## Overview

**Creative North Star: "The Quiet Writing Slip"**

The quiet writing slip gives a compact Chrome utility the clarity of paper and green ink. A pale ground, restrained rules, native system text, and a large passage field keep the prepared text central. The interface uses a single column and small, legible controls rather than a decorative application shell.

The built popup expresses that world through local save feedback, tabular counts, a thin progress rule, and visible keyboard controls. Color identifies focus, action, and errors; it does not carry session meaning alone. The approved direction lives in the surface brief; this document records the implemented visual vocabulary.

**Key Characteristics:**

- Pale paper, green ink, and restrained red feedback.
- Native system typography with tabular numeric readouts.
- Flat surfaces separated by thin rules.
- A spacious passage field inside a compact utility.

## Colors

The palette combines warm paper neutrals, dark green text and controls, and restrained red feedback. Frontmatter contains the normative color values extracted from [popup.css](extension/popup.css).

### Primary

- **Green ink** (`green`): the letterform mark, caret, focus outlines, progress fill, and text actions.
- **Reading ink** (`ink`): the main text and passage content; dark enough to make the pale ground feel quiet rather than faded.

### Secondary

- **Warning red** (`danger`): Stop text, session error messages, and save/request errors.
- **Warning wash** (`danger-hover`): the enabled Stop button’s hover surface.

### Neutral

- **Paper** (`paper`): the popup ground.
- **Field paper** (`field`): the slightly lighter passage surface.
- **Muted ink** (`muted`): supporting instructions, save feedback, counts, time estimates, and disclosure copy.
- **Rule** (`rule`): section dividers, button boundaries, and keycap strokes.
- **Field boundary** (`field-border`): the passage border and thin scrollbar thumb.
- **Placeholder ink** (`placeholder`): guidance inside an empty passage.
- **Inactive paper** (`inactive`): disabled passage surface and keyboard keycaps.
- **Selection wash** (`selection`): selected text, paired with reading ink.
- **Progress track** (`progress-track`): the unfilled part of the progress rule.

**The Green Ink Rule.** Green marks focus, progress, and utility actions. Red is reserved for Stop and error feedback.

## Typography

**Body Font:** -apple-system, BlinkMacSystemFont, "Segoe UI" (with sans-serif)

**Character:** All text uses the native system stack recorded in frontmatter. There is no separate display or monospace family; keycaps also use system sans. Body text inherits the browser’s normal line height and weight unless the component specifies otherwise.

### Hierarchy

- **Title** (22px, weight 650, tracking -0.025em): the product name uses the title role with slightly tight tracking.
- **Body** (13px, normal weight and line height): labels, instruction-row descriptions, and the base utility text use the body size.
- **Passage** (13px, line height 1.65): the body size with a generous line height; text stays readable inside the scrollable field.
- **Label / section title** (13px, weights 600 / 650): the passage label uses the label weight; the session heading uses the slightly stronger section-title weight.
- **Pace** (16px, weight 650): the numeric pace is larger than body text; its unit is smaller (10px), semibold (600), muted, and lightly tracked (0.04em).
- **Metadata** (11px): save status, draft and progress details, shortcuts, text actions, and guidance use the metadata size. Guidance has a line height of 1.6; disclosure copy uses 1.55.
- **Status** (12px, line height 1.4): the session message uses the status role. Save/request error copy uses the same size with a line height of 1.5.
- **Locality note** (10px): the footer’s device-local draft note is smaller (10px).

Pace, draft counts, and progress details use tabular numerals. The system does not impose a character-based measure or a separate typographic scale ratio.

## Layout

The body is a single column with a preferred width of 380px and a maximum width of 100vw. The main inset is 16px at the top, 24px at the sides, and 12px at the bottom. Header identity and pace, field heading and save status, counts and estimates, and shortcut descriptions and keycaps use flex rows with opposing alignment and a 10px gap. The identity has a 9px gap; the header ends with a 15px margin.

The passage field fills the available width, begins with six HTML rows, permits vertical resizing, and has a minimum height of 154px and maximum height of 250px. It scrolls when its content exceeds the available height. Its heading sits 9px above it and its numeric details sit 9px below it.

The session strip starts 16px after draft details and uses ruled edges with 13px top and 12px bottom padding. The progress rule sits 12px below the heading and its details sit 9px below it. Instructions use 12px top and 10px bottom padding, with 6px between shortcut rows. The footer starts with a top rule and 8px inset; the disclosure follows after 8px.

There are no viewport media queries or alternate layouts. At narrower widths the width cap reduces the content column; message text wraps naturally. The reviewed 380px paused and 320px stopped screenshots show this behavior. Those screenshots are evidence for this popup, not a claim of broader editor compatibility.

## Elevation & Depth

The interface is flat. It has no box shadows or floating cards. A lighter passage surface, one-pixel rules, and focus outlines provide separation without lift. Enabled Stop hover adds a pale warning wash and a red border.

**The Flat Paper Rule.** Use paper tones, one-pixel rules, and focus outlines for separation; the built popup has no shadows.

## Shapes

The passage field has softly curved corners using the field radius. Stop uses the smaller button radius; keycaps use the keycap radius. The progress rule is square and only 4px high. Borders are one pixel. The header’s letterform mark uses square stroke ends, while footer and external-link symbols remain simple outlined SVGs.

## Components

### Passage field

A quiet, light writing area with a green caret, a thin boundary, and the passage typography. Its native resize handle stays available within the recorded height limits. Focus uses a green 2px outline with a 2px offset. Disabled state changes the background to inactive paper; the field is disabled during initial loading and clearing. The textarea permits up to 200,000 UTF-16 code units through its HTML maximum length; the visible character count is computed from segmented text.

Save feedback appears alongside the label: Loading…, Saved, Empty, Saving…, Not saved, Cleared, or Unavailable. Errors appear below the draft details as an alert with red text. Draft details show the segmented character count and approximate duration.

### Stop button

A small outlined action with warning-red text, semibold (600) metadata-sized type, and compact padding. Enabled hover changes both background and border to the warning treatment. Disabled Stop uses muted text at 0.65 opacity and the default cursor. Stop is enabled for starting, typing, and paused sessions. Keyboard focus uses the shared green 2px outline with a 4px offset.

### Text actions

Change shortcuts and Clear passage are green text buttons with no border, background fill, or inset. Hover adds a one-pixel underline with a 3px offset. Disabled text actions use muted ink; keyboard focus uses the shared outline. Change shortcuts includes a 12px outlined external-link icon and opens Chrome’s shortcut settings. Clear passage is disabled when the draft is empty and while clearing.

### Session strip and progress rule

A ruled status area holds the session heading, Stop, a native progress element, exact character offset, remaining time, and an explanatory status message. Heading text distinguishes ready, finding the cursor, typing, paused, complete, stopped, and attention states. Error-state messages turn red; the other phases retain muted message ink. The progress bar fills green from the recorded session index; an empty session uses a maximum of one and shows “No active passage.”

Opening the popup pauses typing. Start, pause, and resume remain explicit keyboard commands in the destination, as defined in [the surface brief](.impeccable/surfaces/extension-popup-html.md). The popup supplies status and Stop rather than a Start control.

### Shortcut keycaps

Keyboard assignments appear as nonwrapping native `kbd` elements on inactive paper with a thin rule border. The typography is 11px system sans with a padding of 3px vertically and 7px horizontally. They show the actual Chrome command assignments; a missing assignment reads “Not assigned.”

### Footer and disclosure

The footer pairs an outlined lock and precise device-local draft note with Clear passage. It is separated by a rule. A native collapsed `details` element provides first-run information underneath, using muted metadata-sized text. Its summary retains native disclosure behavior, a pointer cursor, and the shared keyboard-focus outline. Its paragraphs have 8px vertical margins. The note describes local drafts; disclosure copy explains that the destination website receives typed text.

### Motion and focus

The popup has no CSS animations or transitions and no reduced-motion media query. All hover, focus, disabled, and session updates are immediate; this visual behavior already avoids animated motion. Progress reflects state changes without an added interpolation effect. Textarea focus and visible button/summary focus use the distinct offsets recorded above.

## Do's and Don'ts

### Do:

- **Do** keep the pale paper ground and green focus/action treatment.
- **Do** pair session color with explicit status text and acknowledged character counts.
- **Do** use the native system font stack and tabular numerals for counts and pace.
- **Do** retain visible keyboard focus and the textarea’s native vertical resize.
- **Do** preserve the popup width cap and allow explanatory text to wrap.
- **Do** describe draft locality precisely: the destination website receives typed text.

### Don't:

- **Don't** add shadows, decorative imagery, or display typography to this established utility.
- **Don't** use color alone to distinguish paused, stopped, complete, or error states.
- **Don't** add a popup Start button that replaces the explicit destination keyboard command.
- **Don't** claim a breakpoint, animation, reduced-motion override, or editor compatibility that the implementation does not provide.
