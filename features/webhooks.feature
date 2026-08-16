Feature: Webhook callbacks
  A crawl can POST its finished audit to a callback URL. The target is validated
  at enqueue time — while the caller is still on the line — and any loopback,
  private or non-HTTP address is refused to prevent SSRF.

  Scenario: A loopback callback URL is refused
    When I enqueue a crawl of the fixture site with callback "http://127.0.0.1:9/hook"
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
