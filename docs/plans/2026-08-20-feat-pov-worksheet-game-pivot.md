# POV Worksheet Game Pivot

## Current Direction

The `/game` experience is pivoting away from the Super Smash-inspired shell. The target interaction is now a first-person, teacher-at-a-desk view: the camera looks down at a worksheet, a stylized hand holds a pen, and the user moves the pen with the pointer.

The page should feel like a controllable scene from an educational game, not a standard dashboard. For this branch, `/game` intentionally hides the shared app header and uses the worksheet itself as the menu surface.

## Sprint Scope

- Replace the character-select/arena surface with a full-screen Three.js desk scene.
- Generate the paper/menu texture deterministically in the browser.
- Let pointer movement raycast against the paper plane and move the pen/hand.
- Let the first checkbox open the existing PDF-backed lesson.
- Keep the second checkbox locked for the future generated worksheet pipeline.
- Avoid paid provider calls, storage mutations, Motion Canvas renders, and backend pipeline changes.

## Future Direction

The same scene can later drive worksheet videos: deterministic worksheet regions become the placement source of truth, narration timestamps decide when writing appears, and the hand/pen follows the writing path. LLMs may help generate or map worksheet content after deterministic layout facts exist, but the front-end scene should remain reusable and data-driven.
