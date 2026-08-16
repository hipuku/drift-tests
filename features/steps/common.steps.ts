/** Steps shared across features: response assertions and raw requests. */

import assert from "node:assert/strict";
import { Then, When } from "@cucumber/cucumber";
import { DriftWorld } from "../support/world.js";

When("I POST {string} with an empty body", async function (this: DriftWorld, path: string) {
  await this.post(path, {});
});

When("I request the result of job {string}", async function (this: DriftWorld, jobId: string) {
  await this.get(`/crawl/${jobId}/result`);
});

Then("the response status is {int}", function (this: DriftWorld, status: number) {
  assert.ok(this.lastResponse, "no response recorded");
  assert.equal(
    this.lastResponse.status,
    status,
    `expected ${status}, got ${this.lastResponse.status}: ${JSON.stringify(this.lastResponse.body)}`,
  );
});

Then("the response carries an error message", function (this: DriftWorld) {
  const body = this.lastResponse?.body;
  assert.ok(body && typeof body.error === "string" && body.error.length > 0, "expected an error message");
});
