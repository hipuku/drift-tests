# A run against a broken build

Every run recorded in this repository before 2026-09-05 was green. A green run shows the suite ran;
it does not show that the suite fails when Drift is wrong. This is a run against a Drift with one
line changed, recorded on 2026-09-05.

## The change

`lifecycle.feature` expects the audit of a crawl that read no page to be a `409`. The change makes
that request return a `200` with an all-zeros audit, which a screen would render as a site with no
colours.

One line in `drift/src/server/app.ts`:

```diff
   const { status, result } = await deps.jobs.getResult(String(req.params.jobId));
   if (status === "not_found") { … }
   if (!result) {
-    res.status(409).json({ error: "the crawl has not finished" });
+    res.json(collectAudit({ pages: [], startedAt: 0, finishedAt: 0 } as never));
     return;
   }
```

It is the change someone would make after deciding the endpoint should always return an audit.

## The run

```
> drift-tests@0.1.0 test
> NODE_OPTIONS="--import tsx" cucumber-js

Drift under test: local-mutated at http://127.0.0.1:3001

Failed scenarios:
  1) An unreachable target fails with a reason, and its audit is a conflict # features/lifecycle.feature:12
       And requesting its audit returns status 409 # features/steps/lifecycle.steps.ts:35
           AssertionError [ERR_ASSERTION]
               + expected - actual

               -200
               +409

               at DriftWorld.<anonymous> (features/steps/lifecycle.steps.ts:37:10)

2 hooks (2 passed)
17 scenarios (16 passed, 1 failed)
90 steps (89 passed, 1 failed)
0m 6.177s
```

16 of 17 scenarios passed. The failure names the scenario, the feature file line, the step, the
step file line, and the expected and actual status. The same build with the line restored passed
17 of 17 in 6.19s.

On 2026-09-14 the change was applied again by hand to Drift `main` at `d2c809a`, and the failure
output matched this transcript. The suite has 18 scenarios and 95 steps since that day, and
`npm run mutation` against the local Drift checkout failed one of them: 17 of 18 passed.

## Reproducing it

`npm run mutation` starts Drift, runs the suite, applies the change, restarts Drift, runs the suite
again, checks that exactly one scenario failed and that it failed on the `409` step, and restores
`app.ts`. It needs a Drift checkout at `../drift` (or `DRIFT`), Redis, Chromium for Playwright, and
nothing else answering on the port (3001, or `PORT`).

The restore runs from an `EXIT` trap, so it also runs when the script is interrupted or fails.

Before 2026-09-14 the script killed only the subshell around `npm run dev:server`. The first
server kept the port, the second failed with `EADDRINUSE`, and the second run tested the unmodified
build and passed, so the script reported the suite as unable to detect the change. The server now
runs under `exec`, the script waits for the port to stop answering before starting the next
server, and it refuses to start if the port is already in use.

## Why this is not a CI job

CI runs the suite against Drift's `main` and should be green. A job that breaks Drift on purpose
would either be a workflow expected to fail, whose red status looks like a real failure, or an
inverted assertion inside the normal run, which makes that run harder to read.

The question is whether the suite detects a regression. It needs answering when the feature files
change, not on every push, and `npm run mutation` answers it.
