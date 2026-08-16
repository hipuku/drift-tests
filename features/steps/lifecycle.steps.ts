/** Job-lifecycle steps: waiting for terminal state, failure, audit gating. */

import assert from "node:assert/strict";
import { Then, When } from "@cucumber/cucumber";
import { DriftWorld } from "../support/world.js";

When("I enqueue a crawl of the unreachable target", async function (this: DriftWorld) {
  // Syntactically valid (has a dot, http scheme) so it passes edge validation
  // and is queued — but nothing listens on port 9, so the crawl fails. That is
  // the "zero pages" path: a failed job, not a 200 all-zeros audit.
  const res = await this.post("/crawl", { url: "http://127.0.0.1:9/" });
  this.jobId = res.body?.jobId;
});

When("I wait for the crawl to finish", async function (this: DriftWorld) {
  assert.ok(this.jobId, "no jobId — enqueue a crawl first");
  this.terminal = await this.runCrawlToCompletion(this.jobId);
});

Then("the crawl finishes with status {string}", function (this: DriftWorld, status: string) {
  assert.ok(this.terminal, "no terminal state recorded");
  assert.equal(this.terminal.status, status, `expected ${status}, got ${this.terminal.status}`);
});

Then("its audit is available", async function (this: DriftWorld) {
  const res = await this.get(`/crawl/${this.jobId}/audit`);
  assert.equal(res.status, 200, `expected 200 audit, got ${res.status}`);
});

Then("the failure carries a reason", function (this: DriftWorld) {
  const reason = this.terminal?.error;
  assert.ok(typeof reason === "string" && reason.length > 0, "expected a failure reason");
});

Then("requesting its audit returns status {int}", async function (this: DriftWorld, status: number) {
  const res = await this.get(`/crawl/${this.jobId}/audit`);
  assert.equal(res.status, status, `expected ${status}, got ${res.status}`);
});
