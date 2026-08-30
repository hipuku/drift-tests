# Design notes

Why this suite is shaped the way it is. Decisions, and the trade-offs behind
them. It is not a tutorial.

## Black-box, over the wire

The suite talks to Drift only through its HTTP API, exactly as any other client
would. It imports nothing from Drift and knows nothing about its internals. That
is the point: it proves the *running service* honours its contract, which unit
tests cannot. It is the same outside-in acceptance shape used
to validate a live platform before release, on code I own.

## Hermetic fixture instead of the live web

Early drafts pointed Drift at `example.com`. That made the suite depend on a
third party's uptime, markup and DNS, and a stable *audit* was impossible,
since the site's tokens can change under you. So the suite serves its own
[fixture site](features/support/fixtureSite.ts): three same-origin pages on an
ephemeral `127.0.0.1` port, started once in `BeforeAll`.

The fixture is **deliberately inconsistent**, with values chosen to trip
specific audit signals so scenarios can assert exact outcomes:

- `#3366cc` beside `#3467cc` → a perceptually near-duplicate colour (ΔE ≈ 0.3).
- `padding: 13px` / `7px` → off a 4px grid.
- `font-size: 15/23/31px` → off the closest modular scale.
- `#999` text on `#fff` → 2.85:1, fails WCAG AA for normal text.

Same input, same audit, every run.

## Deterministic crawls via an explicit page list

Crawls pass an explicit absolute `pages` array (all three fixture URLs) rather
than relying on BFS discovery. Discovery *is* tested separately, in
`discover.feature`, but the crawl-dependent scenarios shouldn't also depend on
discovery's page ordering. One behaviour per scenario.

## The "zero pages" failure path

The most valuable lifecycle assertion is the negative one: a crawl that reaches
zero usable pages must end `failed` with a reason, and its `/audit` must be a
`409`, never a `200` all-zeros audit that looks like a real, clean result. The
suite forces this by crawling `http://127.0.0.1:9/`: syntactically valid, so it
passes edge validation and is queued, but nothing listens there, so the crawl
fails for real.

## The aggregation invariant

`audit.feature` locks one invariant that no single-page test can catch: **a
token is never attributed to more pages than were crawled.** It is asserted over
the contrast findings' `pages[]` against `summary.pages`. This is the kind of
cross-page bookkeeping bug that hides until aggregation runs at scale.

## Webhooks: guard rails and delivery

Two feature files. `webhooks.feature` asserts the **enqueue-time** guard rails:
loopback, private and non-HTTP `callbackUrl`s refused with `422` while the caller
is still on the line. `webhook-delivery.feature` then exercises a **successful
delivery** end to end: the suite stands up a loopback receiver, enqueues a crawl
with that receiver as the callback, and asserts the finished audit arrives as a
signed `crawl.completed`.

Delivery to a loopback receiver only works because Drift's SSRF guard now takes
an opt-in `DRIFT_WEBHOOK_ALLOWED_HOSTS` allowlist. The backend under test is
started with `127.0.0.1` allowlisted and a `DRIFT_WEBHOOK_SECRET` set. That is
the same mechanism a real deployment uses to allow a trusted internal callback
host, so the test rides a genuine feature rather than a test-only backdoor. It
keeps the suite hermetic: no public endpoint, still deterministic.

## The export is client-side, so it isn't a black-box target

The diagnosis export (`health`/`findings`/`verdicts`/`rules`) is assembled in
Drift's React client from the `/audit` response, not returned by any endpoint.
The suite therefore pins the raw material the export is built from, the audit
`summary` counts and the `contrast` findings, in place of an artefact the API
does not serve. If a JSON-export endpoint is added to the backend later, a
`export.feature` becomes the natural home for that contract.

## What black-box costs, and where it is paid

The decision above has a price. It is written down here so a reader meets it in
the design notes and not in a diff.

Importing nothing from Drift means importing Drift's **types** is also off the
table, so response bodies arrive as `any` and are narrowed by hand at each
assertion. Six warnings remain, over five declarations in `world.ts`,
`webhookReceiver.ts` and `audit.steps.ts` plus one return type. That is the cost
of the boundary. A suite
that imported `SiteAudit` would typecheck against the implementation it is
supposed to be testing from the outside, and would go green against a contract
that had silently changed shape.

The honest middle path exists: Drift publishes `openapi.yaml`, so the response
types can be **generated from the published contract** rather than imported from
the source. That keeps the suite black-box against the implementation while typed
against the promise. It waited on Drift tagging releases, so the generated types
would have a version to pin to; v0.1.0 is that tag.

Until then `@typescript-eslint/no-explicit-any` is set to warn. The count stays
visible and CI does not fail on a decision that has a date on it. Make it an
error when the generated types land.

## No assertion library, no HTTP client dependency

Steps use Node's built-in `fetch` and `node:assert/strict`. The suite's only
runtime dependencies are Cucumber and the TypeScript loader. Fewer moving parts,
nothing to keep in sync with a Drift version.

## Which Drift a run proved the contract against

Drift shipped on `0.0.0` with no tags until v0.1.0, so a green report here said
the contract held without saying held for what, and a deliberate breaking change
in Drift would have arrived as a failing test with no way to tell it from a
regression.

The provenance comes from the checkout rather than from the API, because nothing
Drift serves reports a version. CI runs `git describe --tags` over the Drift it
cloned, which yields the released tag, or a SHA when the run is not on one, and
passes it in as `DRIFT_VERSION`. The suite prints it at startup and attaches it
to the first scenario, so it is in the HTML report a reader is handed; the job
summary and the artefact name carry it too. A run with `DRIFT_VERSION` unset
reports `unrecorded` and does not guess.

Testing a specific release is `workflow_dispatch` with `drift_ref`. The default
stays Drift's main branch: pinning every run to the last tag would mean the
suite stopped seeing changes until someone remembered to move the pin, which is
the failure mode the pin was meant to prevent.

## Known trade-offs / next

**Six `any` warnings, waiting on generated types.** See above. Drift v0.1.0
removes what blocked this: `openapi.yaml` now carries a version the generated
types can be pinned to, so the remaining work is adding the generator and a check
that fails when the committed types stop matching the spec.

**The export cannot be tested at all.** The most valuable thing Drift produces is
the diagnosis, and it is assembled in the client, so the suite pins the raw
material and the artefact goes untested. The section above records why: this
follows from Drift's architecture, and it is tracked as drift issue #3. If that endpoint lands, `export.feature` is the natural home and
this suite gains its most valuable target.

**No load scenario.** A small pass over `/discover` and `/crawl` enqueue would
show queue behaviour under concurrency and maps directly to the K6 canary story.
The BDD suite alone closes the "runnable testing" gap; the load pass is optional
colour.

**No formatter.** Lint and typecheck both run in CI as of 2026-08-30; formatting
is still by hand.
