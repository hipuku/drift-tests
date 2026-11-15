# drift-tests

Acceptance tests for [Drift](https://github.com/hipuku/drift)'s HTTP API, written in Cucumber.
Feature files state the API's behaviour in plain language, and step definitions call a running
Drift over HTTP and assert on the responses. Drift's unit tests live in Drift; this suite imports
nothing from it and tests the running service from outside, before a change ships.

## At a glance

- **Black-box.** Every scenario goes through Drift's HTTP API.
  [ARCHITECTURE § Over HTTP only](ARCHITECTURE.md#over-http-only)
- **18 scenarios in six features:** job lifecycle, validation before queueing, page attribution,
  the SSRF check on webhook callbacks and signed delivery.
  [ARCHITECTURE § What the suite covers](ARCHITECTURE.md#what-the-suite-covers)
- **No public site.** Drift crawls a fixture site the suite serves on `127.0.0.1`.
  [ARCHITECTURE § A local fixture site](ARCHITECTURE.md#a-local-fixture-site)
- **Contract types from Drift's `openapi.yaml`**, regenerated and compared in CI.
  [ARCHITECTURE § Generated contract types](ARCHITECTURE.md#generated-contract-types)
- **CI reports name the Drift they tested**, and a local run does with `DRIFT_VERSION` set.
  [ARCHITECTURE § Which Drift a run tested](ARCHITECTURE.md#which-drift-a-run-tested)
- **A recorded failing run** against a Drift with one line broken.
  [A failing run](docs/a-failing-run.md)

## Documentation

| File                                             | Covers                                                      |
| ------------------------------------------------ | ----------------------------------------------------------- |
| [`ARCHITECTURE.md`](ARCHITECTURE.md)             | How the suite reaches Drift, what it checks, CI, trade-offs |
| [`docs/a-failing-run.md`](docs/a-failing-run.md) | The suite against a Drift with one line changed             |

## Install

Node 22.12 or later.

```bash
npm install
```

## Develop

Drift must be running first, with Redis and Chromium for Playwright. In the Drift checkout:

```bash
DRIFT_CRAWL_ALLOWED_HOSTS=127.0.0.1 DRIFT_WEBHOOK_ALLOWED_HOSTS=127.0.0.1 DRIFT_WEBHOOK_SECRET=drift-tests-secret npm run dev:server
```

The first variable lets Drift crawl the fixture site, which listens on `127.0.0.1`. The other two
are needed by `webhook-delivery.feature`: one lets the SSRF check accept the loopback receiver, and
the other makes Drift sign the delivery with the secret the suite checks against.

Then, in this repository:

```bash
npm test
```

`DRIFT_URL` points the suite at another instance, and `DRIFT_WEBHOOK_SECRET` must then match that
instance's secret. See [`.env.example`](.env.example).

## In CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on pull requests and pushes to `main`,
and manually with a `drift_ref` to test a Drift tag, branch or SHA. Its five jobs are the checks the
`main` ruleset requires, by these names:

- **Lint:** `lint`, `lint:prose` and `lint:md`.
- **Links:** every relative link and heading anchor in the markdown resolves, checked offline with
  lychee.
- **Format:** `format:check`.
- **Typecheck:** `typecheck`.
- **Test:** the suite against Drift's `main`, stood up in the job.
  [ARCHITECTURE § Testing and CI](ARCHITECTURE.md#testing-and-ci)

## Scripts

| Command                | Does                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `npm test`             | Every feature against `DRIFT_URL` (default `http://127.0.0.1:3001`)                                                 |
| `npm run test:ci`      | The same, with progress output and an HTML report in `reports/`                                                     |
| `npm run mutation`     | The [failing run](docs/a-failing-run.md). Needs a Drift checkout at `../drift` (or `DRIFT`), Redis, and a free port |
| `npm run generate`     | Regenerate `features/support/contract.d.ts` from Drift's `openapi.yaml`, read from `DRIFT_SPEC` or `../drift`       |
| `npm run lint`         | ESLint, with the same rules as Drift                                                                                |
| `npm run lint:fix`     | ESLint with `--fix`                                                                                                 |
| `npm run lint:prose`   | Fails on a new em dash in any tracked file                                                                          |
| `npm run lint:md`      | markdownlint on every markdown file                                                                                 |
| `npm run format`       | Prettier, writing                                                                                                   |
| `npm run format:check` | Prettier, checking only                                                                                             |
| `npm run typecheck`    | `tsc --noEmit`                                                                                                      |

## Stack

Cucumber.js · TypeScript · tsx · Node's `fetch` and `node:assert/strict`
