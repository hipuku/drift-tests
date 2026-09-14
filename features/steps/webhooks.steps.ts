/**
 * Webhook enqueue steps. The callback URL is validated when the crawl is
 * enqueued, so each refusal is a 422 on the enqueue request. Delivery is
 * covered by webhook-delivery.feature.
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
