# Worksheet Page Templates

The root worksheet POV lab no longer treats the source PDF as the visual source of truth. PDFs can still be used as reference material during authoring, but the in-world paper should render from structured lesson data and reusable page templates.

## Shared Page Contract

Every lesson page keeps the same top structure:

- Lesson name at the top of the paper, such as `Lesson 1`.
- Lesson topic below the lesson name.
- Three persistent section tabs: `Do Now`, `Vocabulary`, and `Guided Example`.
- Selecting a tab changes only the content below the tabs.
- Explanation audio starts only from the on-page `Explanation` audio button for the active section.

Section tabs are navigation, not playback controls. A tab click must not start narration, mark a section complete, or write answers for the user.

## Data Ownership

Concrete lesson content and answer keys should belong in structured built-in lesson templates, not ad hoc canvas drawing code. For the current first lesson, the API template source is:

```text
apps/api/app/services/game_lessons/templates/volume_cubes_lesson_1.py
```

The template owns stable IDs for:

- sections
- questions
- fill targets
- expected answers
- narration and handwriting action metadata

The browser renderer currently hard-codes visual placement for Lesson 1 while the page system is being shaped. That placement must key by stable fill target ID. Keep answer checking, progress persistence, and future evals tied to semantic lesson data rather than canvas coordinates.

## Layout Architecture

Worksheet rendering should be componentized across every section and lesson. Do not add new pages as loose `fillText` calls plus separate hit-box maps. Each view should be built from grouped layout primitives whose visible drawing, clickable regions, answer constraints, and pen targets share the same source coordinates.

Reusable primitives should cover:

- section shell: content card, section title, and explanation button slot
- section tabs: `Do Now`, `Vocabulary`, and `Guided Example`
- numbered problem groups
- prompt text blocks
- grid/array/cube diagrams
- labeled writing lines
- short numeric answer lines
- validation metadata for each line

Future lessons should change content data, expected answers, and semantic target IDs, not the structural layout model. If a new lesson needs the same kind of problem, it should reuse the same grouped component with different prompt text, diagram dimensions, labels, and fill target IDs.

The layout source for a section should be organized like this conceptually:

```text
section layout
  problem group
    number badge
    prompt
    diagram
    labeled writing lines
      fill target id
      visual line rect
      input constraints
```

That structure prevents the common failure where a label moves but its clickable line, validation rule, or pen target stays behind.

## Do Now Template

The Do Now section should look like a real worksheet page, not like a web form. It has three numbered problems:

- Problem 1: array-count prompt, array drawing, `Equation:` writing line, and `There are ____ squares in all.`
- Problem 2: five multiplication facts, each with a short writing line after the equals sign.
- Problem 3: area prompt, rectangle drawing, and `Area = ____ square units.`

Clickable answer regions should be visually represented as blank worksheet lines. When a user clicks a line, the pen moves to the beginning of that line. Typed characters render on the line and the pen advances horizontally with the text.

Do Now input validation is per fill target. The equation line accepts only digits, spaces, `*`, `x`, `X`, and `=`, with a renderer-sized character cap so handwriting cannot overflow the line. The remaining Do Now lines accept digits only and cap at two characters.

Do not place decorative badges, audio controls, or labels on top of worksheet content. Number markers sit in the margin beside each problem, and controls live above the content area.

## Vocabulary Template

Vocabulary uses the same page shell and renders term cards for the active lesson. The base template is acceptable for now, but term illustrations should move to managed image assets later so authors can upload or swap images per vocabulary term without editing renderer code.

## Guided Example Template

Guided Example uses a table layout with four columns: `Shape`, `Cubes per layer`, `Number of layers`, and `Volume (cubic units)`. The shape column is visual only. Every non-shape cell should expose a centered worksheet line input keyed by stable fill target ID.

## Built-In Lesson Direction

The first production direction is three predefined lessons. New lessons should reuse these page templates and change only lesson title/topic, section content, diagrams, fill target IDs, answer keys, and explanation metadata. Generated or teacher-authored lessons can come later after the built-in templates are stable.
