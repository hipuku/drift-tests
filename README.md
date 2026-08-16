# drift-tests

Black-box **BDD acceptance tests** for [Drift](https://github.com/hipuku/drift)'s
HTTP API. Cucumber feature files describe the API's promised behaviour in plain
language; step definitions drive the real endpoints over HTTP and assert on the
responses. These are not unit tests — Drift already has ~100 of those. This is
the outside-in view: does the running service honour its contract?

## Why it exists

It makes a testing discipline **demonstrable on code I own**. The behaviour it
locks down — job lifecycle, edge validation, an aggregation invariant, SSRF
guard rails on webhooks — is exactly the acceptance-testing shape used to
validate a real-time platform before release, here applied to my own product.

## What it covers

| Feature | The contract it pins down |
|---|---|
| `discover.feature` | Sitemap-less sites fall back to homepage links; missing / non-HTTP / unresolvable URLs return a friendly `400`/`422`. |
| `crawl.feature` | A good URL returns `202 { jobId }`; a malformed one is rejected at the edge with no job queued. |
| `lifecycle.feature` | `queued → completed` for a reachable site; an unreachable target ends `failed` with a reason and its audit is a `409` — never a `200` all-zeros audit. |
| `audit.feature` | The audit reports its summary, colour families and contrast findings; it surfaces the fixture's seeded inconsistencies; **no token is attributed to more pages than were crawled**. |
| `webhooks.feature` | A loopback / private / non-HTTP `callbackUrl` is refused with `422` at enqueue time (SSRF guard). |

Every assertion was verified by hand against a running Drift before it was
written, so the expected behaviour is known, not guessed.

## Hermetic by design

The suite never touches the public internet. It serves a small,
deliberately-inconsistent [fixture site](features/support/fixtureSite.ts) on
`127.0.0.1` — three same-origin pages with near-duplicate blues, off-grid
spacing, off-scale type and a failing-contrast pair — and points Drift at that.
Same input, same audit, every run.

## Running it locally

Drift must be running first (it owns Redis, the queue and Playwright):

```bash
# in the drift checkout
npm install
npm run dev:server          # backend on :3001 — needs Redis reachable
```

Then, here:

```bash
npm install
npm test                    # runs every feature against http://127.0.0.1:3001
```

Point at a different instance with `DRIFT_URL` (see [`.env.example`](.env.example)).

## In CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) stands the whole thing up
on each push: a Redis service container, a Drift checkout with Playwright
Chromium, the backend started in the background, then the suite. Because Drift is
currently a private repo, cloning it needs a **`GH_PAT`** secret (classic token,
`repo` scope) on this repository; drop it once Drift is public.

## What's intentionally not here

Actual webhook **delivery** (HMAC signing, retries, the `crawl.completed`
payload) is covered by Drift's own unit tests, not here — Drift's SSRF guard
refuses the loopback address a hermetic in-CI receiver would have to listen on,
so delivery can't be exercised black-box without a public endpoint. The
diagnosis **export** (`health`/`findings`/`verdicts`/`rules`) is assembled in
Drift's client, not exposed by the API, so it isn't a black-box target either;
this suite pins the `/audit` summary and contrast findings the export is built
from. See [DESIGN.md](DESIGN.md) for the reasoning.

## Licence

MIT.
