# What a failing run looks like

This suite's whole claim is that it catches a regression in Drift before a
person does. Nothing in the repository showed it doing that: every recorded run
was green, and a green run proves the suite ran, not that it would have noticed.

So here is one against a deliberately broken build, recorded on 2026-09-05.

## The regression

`lifecycle.feature` pins a specific promise: a crawl that reaches zero usable
pages ends `failed`, and asking for its audit is a `409`, **never a `200` with
an all-zeros audit**. That second half is the interesting one, because an
all-zeros audit is not obviously wrong on a screen. It looks like a site with
no colours.

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

A plausible mistake rather than a strawman: it is what you would write if you
decided the endpoint should always return an audit shape, and it is the exact
failure the feature file was written to prevent.

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

**16 of 17 still pass.** That is the part worth reading. A suite that went
entirely red would tell you something broke and not what; this names the
scenario, the step, the file and line, and the difference between what was
promised and what arrived. The other sixteen scenarios saying nothing is
information too.

The same build, restored, runs 17 of 17 in 6.19s.

## Reproducing it

`npm run mutation` does the whole thing: stands the stack up, runs the suite
green, applies the patch, runs it again, asserts that it failed for the right
reason, and restores Drift. It needs a Drift checkout beside this one, Redis,
and Chromium for Playwright.

It restores Drift in a trap rather than at the end of the happy path, because
a mutation script that leaves the repository broken when it is interrupted is
worse than no script.

## Why this is a document and not a CI job

CI runs this suite against Drift's `main` on every push, and it should stay
green there. A job that deliberately breaks Drift would either need its own
workflow that is expected to fail, which is a red tick nobody can distinguish
from a real one, or an inverted assertion inside the normal run, which makes
the normal run harder to read.

The value here is evidential rather than continuous: the question *does this
suite actually detect anything* needs answering once, in a form a reader can
check, and re-answering whenever the feature files change shape. `npm run
mutation` is how it gets re-answered.
