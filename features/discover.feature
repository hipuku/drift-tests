Feature: Page discovery
  Drift resolves a URL to a same-origin page list before any crawl. With no
  sitemap it falls back to reading the homepage's links, and unusable URLs come
  back as a friendly 422 rather than a queued job that can only fail.

  Scenario: A site with no sitemap falls back to homepage links
    When I discover the fixture site
    Then the response status is 200
    And the discovered pages include the "/about" path
    And the discovered pages include the "/pricing" path

  Scenario: Discovery requires a URL
    When I POST "/discover" with an empty body
    Then the response status is 400

  Scenario: A non-HTTP scheme is rejected with a friendly message
    When I discover "ftp://example.com"
    Then the response status is 422
    And the response carries an error message

  Scenario: An unresolvable host is rejected with a friendly message
    When I discover "http://nonexistent.invalid"
    Then the response status is 422
    And the response carries an error message
