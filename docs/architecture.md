# Architecture

```text
User
  -> Next.js
  -> Supabase Auth
  -> FastAPI
  -> Auth / Usage Validation
  -> Quadratic Parser
  -> Quadratic Validator
  -> SymPy Solver
  -> Instructional Strategy
  -> Lesson Model
  -> Narration Provider Boundary
  -> Motion Canvas
  -> Optional Avatar Provider Boundary
  -> Final Video
```

The LLM is not part of the mathematical truth path. SymPy validates equations, extracts coefficients, and computes exact roots.

FastAPI protects API routes with Supabase bearer-token verification. Next.js protects `/app` with Supabase session checks and never exposes service-role credentials.

Lesson data is the shared contract between API, web, and Motion Canvas. Teaching steps are the unit for future narration and animation timing. Math lines are deterministic transformations rendered inside a teaching step.
