Feature: Webhook callbacks
  A crawl can POST its finished audit to a callback URL. The target is validated
  at enqueue time, while the caller is still on the line, and any loopback,
  private or non-HTTP address is refused to prevent SSRF.

  # The test backend allowlists 127.0.0.1 (for webhook-delivery.feature), so this
  # uses a private-range address to prove the guard still refuses everything the
  # operator did NOT explicitly allow. Allowlisting one host is not a blanket open.
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
