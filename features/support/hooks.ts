/**
 * Suite lifecycle.
 *
 *  - BeforeAll: wait for Drift to be reachable, then start the fixture site.
 *  - Before: record which Drift the run proved the contract against, once.
 *  - AfterAll: tear the fixture down.
 *
 * Drift itself is started by the caller (the CI workflow, or `npm run
 * dev:server` locally). The suite is black-box and never reaches inside it.
 */

import { AfterAll, Before, BeforeAll, setDefaultTimeout } from "@cucumber/cucumber";
import { startFixtureSite } from "./fixtureSite.js";
import { DRIFT_URL, DRIFT_VERSION, closeFixture, setFixture, type DriftWorld } from "./world.js";

// A step may drive a full Playwright crawl through the queue (and then wait for
// a webhook), so the default 5s step timeout is far too short. The `timeout`
// key in cucumber.mjs is not a real option; this is the way to set it.
setDefaultTimeout(90_000);

BeforeAll({ timeout: 60_000 }, async function () {
  console.log(`Drift under test: ${DRIFT_VERSION} at ${DRIFT_URL}`);
  await waitForDrift();
  setFixture(await startFixtureSite());
});

/**
 * The HTML report is what a reader is handed, so it has to say what was tested.
 * Attachments belong to a scenario, so this records the version on the first one
 * and then stands down; a green run that cannot name its target is the gap this
 * closes.
 */
let versionAttached = false;

Before(function (this: DriftWorld) {
  if (versionAttached) return;
  versionAttached = true;
  this.attach(`Drift under test: ${DRIFT_VERSION} at ${DRIFT_URL}`, "text/plain");
});

AfterAll(async function () {
  await closeFixture();
});

/** Poll a cheap endpoint until Drift answers, so scenarios don't race startup. */
async function waitForDrift(timeoutMs = 45_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      // A missing `url` is a fast, deterministic 400: proof the API is up
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
