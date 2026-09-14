# drift-tests

Acceptance tests for [Drift](https://github.com/hipuku/drift)'s HTTP API, written in Cucumber.
Feature files state the API's behaviour in plain language, and step definitions call a running
Drift over HTTP and assert on the responses. Drift's unit tests live in Drift. These tests import
nothing from it.

## Why it exists

To test the running service from outside: job lifecycle, validation before queueing, page
attribution in the audit, the SSRF check on webhook callbacks, and signed webhook delivery. It is
the same kind of acceptance suite used to test a real-time platform before release, applied to a
project whose code is public.

## What it covers

Six feature files, 18 scenarios.

| Feature | Scenarios |
|---|---|
| `discover.feature` | A site with no sitemap is discovered through its homepage links. A missing URL is `400`. A non-HTTP scheme and an unresolvable host are `422` with a message. |
| `crawl.feature` | A usable URL is `202 { jobId }`. A missing URL is `400`. A malformed URL is `422` with a message. |
| `lifecycle.feature` | A reachable site ends `completed` and its audit is `200`. An unreachable target ends `failed` with a reason, and its audit is `409`. An unknown job id is `404`. |
| `audit.feature` | The audit has a summary, colour families and contrast findings. It reports the fixture's near-duplicate colour, off-grid spacing, off-scale type size and failing contrast pair. `summary.pages` is the number of pages crawled, and every colour swatch and contrast pair cites only crawled pages. |
| `webhooks.feature` | A `callbackUrl` that is loopback and not allowlisted (`localhost`), private (`10.0.0.1`), non-HTTP, or not a string is `422`. |
| `webhook-delivery.feature` | A completed crawl is POSTed to a local receiver as `crawl.completed` with the audit, an `x-drift-event` header, and an `x-drift-signature` that matches the HMAC-SHA256 of the body. |

Not covered: the `queued` and `active` statuses (no scenario reads a job before it finishes),
`crawl.failed` delivery, delivery retries, and WebSocket progress.

## A run against a broken build

[docs/a-failing-run.md](./docs/a-failing-run.md) records a run against a Drift with one line
changed: the `409` for the audit of an unfinished crawl became a `200` with an all-zeros audit.
One scenario failed, on the step that expects the `409`, and the output named the feature file
line, the step file line, and the expected and actual statuses.

`npm run mutation` repeats it: run the suite, apply the change, run it again, check that exactly
one scenario failed on the `409` step, and restore Drift.

## Fixture site

The suite does not reach the internet. It serves a fixture site on an ephemeral `127.0.0.1` port
([`fixtureSite.ts`](features/support/fixtureSite.ts)): three pages sharing a stylesheet with two
near-identical blues, off-grid padding, off-scale font sizes and a text colour that fails AA.
Every run crawls the same input.

## Running it locally

Drift must be running first. It needs Redis and Chromium for Playwright.

```bash
npm install
```

```bash
DRIFT_WEBHOOK_ALLOWED_HOSTS=127.0.0.1 DRIFT_WEBHOOK_SECRET=drift-tests-secret npm run dev:server
```

Both commands run in the Drift checkout. The two variables are needed by
`webhook-delivery.feature`: the first lets the SSRF check accept the loopback receiver, and the
second makes Drift sign the delivery with the secret the suite checks against.

Then, in this repository:

```bash
npm install
```

```bash
npm test
```

`DRIFT_URL` points the suite at another instance, and `DRIFT_WEBHOOK_SECRET` must then match that
instance's secret. See [`.env.example`](.env.example). Node 22.12 or later.

## In CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push and pull request to this
repository, and manually:

1. A Redis service container.
2. A checkout of Drift with its tags. Node comes from Drift's `.nvmrc`.
3. `npm ci` and Chromium in the Drift checkout, then the backend in the background with the two
   `DRIFT_WEBHOOK_*` variables. The job waits for `POST /discover` to return `400`.
4. `npm run generate` against the cloned `openapi.yaml`. The job fails if
   `features/support/contract.d.ts` changed.
5. `lint`, `lint:prose`, `typecheck`, then the suite with an HTML report.

A push to Drift does not trigger this workflow. It tests Drift's `main` as of the run, or the tag,
branch or SHA given as `drift_ref` in a manual run.

`git describe --tags --always` of the Drift checkout is written to the job summary, the report
artifact's name and the first scenario of the report. Drift is public, so `GITHUB_TOKEN` can clone
it; a `GH_PAT` secret is used instead if set.

## Scripts

| Command | Does |
| --- | --- |
| `npm test` | Every feature against `DRIFT_URL` (default `http://127.0.0.1:3001`) |
| `npm run test:ci` | The same, with progress output and an HTML report in `reports/` |
| `npm run mutation` | The broken-build run described above. Needs a Drift checkout at `../drift` (or `DRIFT`), Redis, and a free port |
| `npm run generate` | Regenerate `features/support/contract.d.ts` from Drift's `openapi.yaml`, read from `DRIFT_SPEC` or `../drift` |
| `npm run lint` | ESLint, with the same rules as Drift |
| `npm run lint:fix` | ESLint with `--fix` |
| `npm run lint:prose` | Fails on a new em dash in any tracked file |
| `npm run typecheck` | `tsc --noEmit` |

## The export

Drift's JSON export (`health`, `findings`, `verdicts`, `rules`) is built in Drift's client from
the `/audit` response, and no endpoint returns it. The suite checks the `/audit` summary and
contrast findings it is built from. [DESIGN.md](DESIGN.md) has the reasoning.

## Stack

Cucumber.js · TypeScript · tsx · Node's `fetch` and `node:assert/strict`

There is no assertion library and no HTTP client dependency. [`DESIGN.md`](DESIGN.md) covers why,
and what testing from outside costs in types.
