---
title: Instructor Default Ordering
date: 2026-08-19
category: ui-bugs
module: Instructor selector
problem_type: ui_bug
component: frontend
symptoms:
  - "The instructor selector briefly showed the male fallback, then switched to Female Instructor after loading persisted instructors."
root_cause: data_integrity
resolution_type: code_fix
severity: low
tags: [instructors, default-state, supabase, uuid]
---

# Instructor Default Ordering

## Problem

The instructor selector was meant to default to the male instructor, but signed-in users saw it switch to Female Instructor after the persisted instructor list loaded.

## Symptoms

- The first render used the bundled male fallback.
- After `listInstructors` returned Supabase-backed records, the selected instructor changed to Female Instructor.

## What Didn't Work

- Checking for `id === "male"` only worked for bundled config instructors.
- Supabase seed records use UUIDs, so no persisted instructor matched the config ID.

## Solution

Keep the frontend fallback name-aware and make the instructor repository return the intended default first.

```ts
setSelectedInstructorId((current) =>
  nextProfiles.some((profile) => profile.id === current)
    ? current
    : preferredDefaultInstructor(nextProfiles).id
);
```

```py
def _instructor_sort_key(instructor: Instructor) -> tuple[int, str]:
    name = instructor.display_name.lower()
    if instructor.id == "male" or name == "male instructor":
        priority = 0
    elif instructor.id == "female" or name == "female instructor":
        priority = 1
    else:
        priority = 2
    return (priority, name)
```

## Why This Works

The API now gives all consumers a stable, product-intended order. The frontend still preserves a user-selected instructor when that ID exists, but when it needs a fallback it can recover from either config IDs or UUID-backed Supabase rows.

## Prevention

- Do not assume seed row IDs match local config IDs after moving records into Supabase.
- Add a regression assertion when UI defaults depend on API ordering.

## Related Issues

- [Manual Artifact Pipeline Controls](../developer-experience/manual-provider-pipeline-controls.md)
