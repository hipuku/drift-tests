Feature: Crawl enqueue
  Enqueuing a crawl validates the URL at the edge, so a doomed job is never put
  on the queue. A good URL returns 202 with a job id to poll.

  Scenario: A valid URL is accepted and returns a job id
    When I enqueue a crawl of the fixture site
    Then the response status is 202
    And the response carries a job id

  Scenario: Enqueue requires a URL
    When I POST "/crawl" with an empty body
    Then the response status is 400

  Scenario: A malformed URL is rejected at the edge with no job queued
    When I enqueue a crawl of "not a url"
    Then the response status is 422
    And the response carries an error message
