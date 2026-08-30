# Design notes

Why this suite is shaped the way it is. Decisions, and the trade-offs behind
them — not a tutorial.

## Black-box, over the wire

The suite talks to Drift only through its HTTP API, exactly as any other client
would. It imports nothing from Drift and knows nothing about its internals. That
is the point: it proves the *running service* honours its contract, which unit
tests cannot. It is the same outside-in acceptance shape used
to validate a live platform before release, on code I own.

## Hermetic fixture instead of the live web

Early drafts pointed Drift at `example.com`. That made the suite depend on a
third party's uptime, markup and DNS — and a stable *audit* was impossible,
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
than relying on BFS discovery. Discovery *is* tested — separately, in
`discover.feature` — but the crawl-dependent scenarios shouldn't also depend on
discovery's page ordering. One behaviour per scenario.

## The "zero pages" failure path

The most valuable lifecycle assertion is the negative one: a crawl that reaches
zero usable pages must end `failed` with a reason, and its `/audit` must be a
`409` — never a `200` all-zeros audit that looks like a real, clean result. The
suite forces this by crawling `http://127.0.0.1:9/`: syntactically valid, so it
passes edge validation and is queued, but nothing listens there, so the crawl
fails for real.

## The aggregation invariant

`audit.feature` locks one invariant that no single-page test can catch: **a
token is never attributed to more pages than were crawled.** It is asserted over
the contrast findings' `pages[]` against `summary.pages`. This is the kind of
cross-page bookkeeping bug that hides until aggregation runs at scale.

## Webhooks: guard rails and delivery

Two feature files. `webhooks.feature` asserts the **enqueue-time** guard rails —
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
The suite therefore pins the raw material the export is built from — the audit
`summary` counts and the `contrast` findings — rather than an artefact the API
doesn't serve. If a JSON-export endpoint is added to the backend later, a
`export.feature` becomes the natural home for that contract.

## No assertion library, no HTTP client dependency

Steps use Node's built-in `fetch` and `node:assert/strict`. The suite's only
runtime dependencies are Cucumber and the TypeScript loader. Fewer moving parts,
nothing to keep in sync with a Drift version.

## Deferred / nice-to-have

A small **load scenario** over `/discover` + `/crawl` enqueue — to show queue
behaviour under concurrency — maps directly to the K6 canary story and would be
a natural addition. The BDD suite alone closes the "runnable testing" gap; the
load pass is optional colour.
