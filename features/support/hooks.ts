/**
 * Suite lifecycle.
 *
 *  - BeforeAll: wait for Drift to be reachable, then start the fixture site.
 *  - AfterAll: tear the fixture down.
 *
 * Drift itself is started by the caller (the CI workflow, or `npm run
 * dev:server` locally) — the suite is black-box and never reaches inside it.
 */

import { AfterAll, BeforeAll } from "@cucumber/cucumber";
import { startFixtureSite } from "./fixtureSite.js";
import { DRIFT_URL, setFixture, fixture } from "./world.js";

BeforeAll({ timeout: 60_000 }, async function () {
  await waitForDrift();
  setFixture(await startFixtureSite());
});

AfterAll(async function () {
  await fixture?.close();
});

/** Poll a cheap endpoint until Drift answers, so scenarios don't race startup. */
async function waitForDrift(timeoutMs = 45_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      // A missing `url` is a fast, deterministic 400 — proof the API is up
      // without touching Redis, Playwright or the network.
      const res = await fetch(`${DRIFT_URL}/discover`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (res.status === 400) return;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Drift not reachable at ${DRIFT_URL} within ${timeoutMs}ms: ${String(lastErr)}`);
}
