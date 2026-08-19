# Concepts

Shared domain vocabulary for this project -- entities, named processes, and status concepts with project-specific meaning. Seeded with core domain vocabulary, then accretes as ce-compound and ce-compound-refresh process learnings; direct edits are fine. Glossary only, not a spec or catch-all.

## Math And Lesson Model

### Equation
A user-submitted math statement that Quadratics can parse, normalize, and evaluate against the supported lesson scope.

### Quadratic
An equation whose normalized form has a nonzero squared term and can be solved as a second-degree expression in `x`.

### Method
The instructional solving strategy attached to a lesson, such as factoring or another quadratic-solving approach.

### Lesson
The deterministic teaching structure produced after an equation is parsed, validated, solved, and matched to an instructional method.

### Teaching Step
A meaningful unit of instruction inside a lesson that coordinates narration, math lines, animation cues, and video timing.

### Math Line
A deterministic mathematical transformation or result displayed inside a teaching step.

Math lines are source material for narration and animation references; generated text may explain them but must not invent new ones.

## Generation Pipeline

### Generation Job
The user-owned record of a generation attempt, used to group the equation, selected instructor, artifacts, and reruns for one lesson build.

### Generation Artifact
A persisted output from one pipeline stage, including enough metadata to inspect, reuse, rerun, or mark that output stale.

Artifacts are the pipeline source of truth. A downstream stage should consume artifacts rather than reconstructing upstream work from transient UI state.

### Artifact Lifecycle
The status model for an artifact as it moves from requested work through success, failure, reuse, staleness, or an intentional skip.

Lifecycle status controls what the UI can present as current output. Stale or failed artifacts can remain inspectable without being treated as the active result.

### Stale Artifact
A previously valid artifact that no longer matches the current upstream inputs because an earlier stage was regenerated or replaced.

Stale artifacts are retained for debugging and comparison. They should not be promoted as the current final lesson output until the affected downstream stage is rerun.

### Golden Checkpoint
The reusable saved generation path for the canonical factoring example, intended to let developers iterate on pipeline and video behavior without repeating paid provider calls.

## Narration And Providers

### Script
The LLM-assisted narration plan generated from a completed deterministic lesson.

### Script Segment
The narration unit corresponding to a teaching step, with references back to the math lines it explains.

### Speech Markup
The provider-ready narration text produced from a script before voice generation.

Speech markup is distinct from the script because it captures exactly what will be sent to the narration provider, including spoken math phrasing and pauses.

### Narration Segment
The generated audio and timing unit corresponding to one script segment.

Narration segments are the bridge between instructional text and timed animation because they carry the speech and alignment data used by later stages.

### Provider Boundary
The adapter layer that keeps external services separate from core math, lesson, artifact, and rendering logic.

Provider boundaries let the pipeline swap or retry paid services without letting provider-specific transport details become part of the domain model.

### Instructor
A global teaching persona record that supplies the display identity and provider IDs used for narration or optional avatar generation.

## Animation And Video

### Animation Plan
The semantic visual plan for a lesson, naming what should appear or be emphasized and which narration phrase should trigger it.

An animation plan is not render code and does not own exact timestamps; it must reference existing lesson material.

### Resolved Animation Timeline
The deterministic timed version of an animation plan, derived by matching planned narration triggers against narration alignment.

### Base Video
The standard rendered blackboard lesson video produced from lesson data, narration, and the resolved animation timeline.

### HeyGen Avatar
An optional paid avatar video artifact generated from completed narration segments for later composition with the base video.

HeyGen avatar generation is separate from the standard base video path so it can be estimated, run, retried, and staled independently.

## Usage And Access

### Provider Usage Event
A recorded cost-bearing provider action used to show spend, explain cost breakdowns, and estimate average generation cost.

Provider usage events are observability for an internal tool, not a user-facing credit or billing system.

### Provider Key
A user-owned credential for an external provider, stored so the API can call that provider without exposing the secret to browser code.

### Credit Transaction
A legacy scaffold ledger entry from the initial app shape.
*Avoid:* treating credit transactions as the current billing or quota model.

## Relationships

A Generation Job owns the artifacts for one lesson build. A Lesson contains Teaching Steps, and Teaching Steps contain Math Lines. Scripts and Narration Segments follow the Teaching Step structure, while Animation Plans and Resolved Animation Timelines reference the same lesson material to keep visuals aligned with deterministic math. Provider Usage Events describe paid calls made while producing artifacts, but they do not replace artifacts as the pipeline source of truth.
