/**
 * Webhook delivery steps: crawl with a callback pointing at a local receiver,
 * then assert the finished audit was POSTed to it, signed.
 *
 * Requires the backend to run with DRIFT_WEBHOOK_ALLOWED_HOSTS including
 * 127.0.0.1 (so the loopback receiver is permitted) and DRIFT_WEBHOOK_SECRET
 * set (so the delivery is signed). The CI workflow sets both.
 */

import assert from "node:assert/strict";
import { After, Then, When } from "@cucumber/cucumber";
import { DriftWorld } from "../support/world.js";
import { startWebhookReceiver } from "../support/webhookReceiver.js";

When(
  "I enqueue a crawl of the fixture site with a delivery callback",
  async function (this: DriftWorld) {
    this.receiver = await startWebhookReceiver();
    const res = await this.post("/crawl", {
      url: `${this.fixture.baseUrl}/`,
      pages: this.fixture.pageUrls,
      callbackUrl: this.receiver.url,
    });
    assert.equal(res.status, 202, `enqueue failed: ${JSON.stringify(res.body)}`);
    this.jobId = res.body?.jobId;
  },
);

When("I wait for the webhook to arrive", async function (this: DriftWorld) {
  assert.ok(this.receiver, "no receiver — enqueue with a delivery callback first");
  this.deliveredWebhook = await this.receiver.waitForOne();
});

Then("the webhook event is {string}", function (this: DriftWorld, event: string) {
  const body = this.deliveredWebhook?.body;
  assert.equal(body?.event, event, `expected event ${event}, got ${JSON.stringify(body?.event)}`);
  // The header mirrors the body event.
  assert.equal(this.deliveredWebhook?.headers["x-drift-event"], event, "x-drift-event header mismatch");
});

Then("the webhook carries the audit", function (this: DriftWorld) {
  const audit = this.deliveredWebhook?.body?.audit;
  assert.ok(audit, "no audit in the webhook payload");
  assert.ok(audit.summary && typeof audit.summary.pages === "number", "audit.summary missing");
  assert.ok(Array.isArray(audit.contrast), "audit.contrast missing");
});

Then("the webhook is signed", function (this: DriftWorld) {
  const sig = this.deliveredWebhook?.headers["x-drift-signature"];
  assert.ok(
    typeof sig === "string" && sig.startsWith("sha256="),
    `expected an x-drift-signature (sha256=…) — is DRIFT_WEBHOOK_SECRET set on the backend? got ${sig}`,
  );
});

After(async function (this: DriftWorld) {
  await this.receiver?.close();
});
