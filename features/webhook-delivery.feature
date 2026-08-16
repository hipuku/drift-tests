Feature: Webhook delivery
  When a crawl finishes, Drift POSTs the audit to the callback URL. This is
  exercised end to end against a local receiver. Drift's SSRF guard refuses
  loopback callbacks by default, so the backend under test is started with
  DRIFT_WEBHOOK_ALLOWED_HOSTS=127.0.0.1 (and DRIFT_WEBHOOK_SECRET) to permit and
  sign delivery to that receiver.

  Scenario: A completed crawl is delivered, signed, to the callback URL
    When I enqueue a crawl of the fixture site with a delivery callback
    And I wait for the webhook to arrive
    Then the webhook event is "crawl.completed"
    And the webhook carries the audit
    And the webhook is signed
