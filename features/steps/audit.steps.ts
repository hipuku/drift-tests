/** Audit-contract steps: structure, seeded findings, aggregation invariant. */

import assert from "node:assert/strict";
import { Given, Then } from "@cucumber/cucumber";
import { DriftWorld } from "../support/world.js";

Given("a completed crawl of the fixture site", async function (this: DriftWorld) {
  const enqueue = await this.post("/crawl", {
    url: `${this.fixture.baseUrl}/`,
    pages: this.fixture.pageUrls,
  });
  this.jobId = enqueue.body?.jobId;
  assert.ok(this.jobId, `enqueue failed: ${JSON.stringify(enqueue.body)}`);

  this.terminal = await this.runCrawlToCompletion(this.jobId);
  assert.equal(this.terminal.status, "completed", `crawl did not complete: ${this.terminal.error ?? ""}`);

  const res = await this.get(`/crawl/${this.jobId}/audit`);
  assert.equal(res.status, 200, `audit not available: ${res.status}`);
  this.audit = res.body;
});

Then("the audit summary counts pages, colours and spacings", function (this: DriftWorld) {
  const s = this.audit?.summary;
  assert.ok(s, "no summary in the audit");
  assert.ok(s.pages >= 1, `expected pages >= 1, got ${s.pages}`);
  assert.ok(typeof s.distinctColours === "number", "distinctColours missing");
  assert.ok(typeof s.spacings === "number", "spacings missing");
});

Then("the audit lists colour families", function (this: DriftWorld) {
  assert.ok(Array.isArray(this.audit?.colourFamilies), "colourFamilies is not an array");
  assert.ok(this.audit.colourFamilies.length > 0, "expected at least one colour family");
});

Then("the audit includes contrast findings", function (this: DriftWorld) {
  assert.ok(Array.isArray(this.audit?.contrast), "expected a contrast array");
  assert.ok(this.audit.contrast.length > 0, "expected at least one contrast finding");
});

Then("the summary reports at least one near-duplicate colour", function (this: DriftWorld) {
  assert.ok(this.audit?.summary?.colourNearDuplicates >= 1, "expected a near-duplicate colour");
});

Then("the summary reports at least one off-grid spacing", function (this: DriftWorld) {
  assert.ok(this.audit?.summary?.spacingOffGrid >= 1, "expected an off-grid spacing");
});

Then("the summary reports at least one type size off the scale", function (this: DriftWorld) {
  assert.ok(this.audit?.summary?.typeOffScale >= 1, "expected a type size off the scale");
});

Then("the summary reports at least one contrast pair failing AA", function (this: DriftWorld) {
  assert.ok(this.audit?.summary?.contrastFailingAA >= 1, "expected a failing-AA contrast pair");
});

Then("every colour and contrast finding cites only pages that were crawled", function (this: DriftWorld) {
  const crawled: number = this.audit?.summary?.pages ?? 0;
  assert.equal(crawled, this.fixture.pageUrls.length, "summary.pages is not the number of pages crawled");
  const allowed = new Set(this.fixture.pageUrls);

  const cited: { label: string; pages: unknown }[] = [
    ...(this.audit?.contrast ?? []).map((f: { foreground: string; background: string; pages: unknown }) => ({
      label: `contrast pair ${f.foreground}/${f.background}`,
      pages: f.pages,
    })),
    ...(this.audit?.colourFamilies ?? []).flatMap((family: { swatches: { hex: string; pages: unknown }[] }) =>
      family.swatches.map((s) => ({ label: `colour ${s.hex}`, pages: s.pages })),
    ),
  ];
  assert.ok(cited.length > 0, "no colour or contrast findings to check");

  for (const { label, pages } of cited) {
    assert.ok(Array.isArray(pages), `${label} has no pages array`);
    assert.ok(pages.length <= crawled, `${label} cites ${pages.length} pages but ${crawled} were crawled`);
    for (const page of pages) {
      assert.ok(allowed.has(page), `${label} cites ${String(page)}, which was not crawled`);
    }
  }
});
