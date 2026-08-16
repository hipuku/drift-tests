/** Enqueue steps. */

import assert from "node:assert/strict";
import { Then, When } from "@cucumber/cucumber";
import { DriftWorld } from "../support/world.js";

When("I enqueue a crawl of the fixture site", async function (this: DriftWorld) {
  // An explicit absolute page list keeps the crawl deterministic (all three
  // fixture pages, every run) instead of relying on BFS discovery.
  const res = await this.post("/crawl", {
    url: `${this.fixture.baseUrl}/`,
    pages: this.fixture.pageUrls,
  });
  this.jobId = res.body?.jobId;
});

When("I enqueue a crawl of {string}", async function (this: DriftWorld, url: string) {
  const res = await this.post("/crawl", { url });
  this.jobId = res.body?.jobId;
});

Then("the response carries a job id", function (this: DriftWorld) {
  const jobId = this.lastResponse?.body?.jobId;
  assert.ok(jobId !== undefined && String(jobId).length > 0, "expected a jobId in the response");
});
