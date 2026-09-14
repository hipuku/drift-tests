Feature: Webhook callbacks
  A crawl can POST its finished audit to a callback URL. The URL is validated
  when the crawl is enqueued. A loopback, private or non-HTTP callback is a 422,
  unless its host is in DRIFT_WEBHOOK_ALLOWED_HOSTS.

  # The test backend allowlists the host 127.0.0.1 for webhook-delivery.feature.
  # The allowlist matches the host as written, so localhost, which resolves to
  # loopback, is still refused.
  Scenario: A loopback callback URL that is not allowlisted is refused
    When I enqueue a crawl of the fixture site with callback "http://localhost/hook"
    Then the response status is 422
    And the response carries an error message

  Scenario: A non-allowlisted private callback URL is refused
    When I enqueue a crawl of the fixture site with callback "http://10.0.0.1/hook"
    Then the response status is 422
    And the response carries an error message

  Scenario: A non-HTTP callback scheme is refused
    When I enqueue a crawl of the fixture site with callback "ftp://example.com/hook"
    Then the response status is 422
    And the response carries an error message

  Scenario: A non-string callback URL is rejected
    When I enqueue a crawl of the fixture site with a numeric callback
    Then the response status is 422
    And the response carries an error message
