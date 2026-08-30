/**
 * Webhook steps.
 *
 * These assert the enqueue-time guard rails only: SSRF and validation
 * refusals, where the caller is still on the line to be told 422. Actual
 * delivery of `crawl.completed` / `crawl.failed` (HMAC signing, retries) is
 * covered by Drift's own unit tests, because the SSRF guard refuses the
 * loopback address a hermetic in-CI receiver would have to use.
 */

import { When } from "@cucumber/cucumber";
import { DriftWorld } from "../support/world.js";

When(
  "I enqueue a crawl of the fixture site with callback {string}",
  async function (this: DriftWorld, callbackUrl: string) {
    await this.post("/crawl", { url: `${this.fixture.baseUrl}/`, callbackUrl });
  },
);

When(
  "I enqueue a crawl of the fixture site with a numeric callback",
  async function (this: DriftWorld) {
    await this.post("/crawl", { url: `${this.fixture.baseUrl}/`, callbackUrl: 12345 });
  },
);
