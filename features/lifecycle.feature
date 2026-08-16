Feature: Crawl job lifecycle
  A crawl runs as a queued job and ends in a terminal state. The audit is only
  available once the crawl has finished — never a 200 all-zeros audit for a run
  that produced nothing.

  Scenario: A reachable site crawls to completion
    When I enqueue a crawl of the fixture site
    And I wait for the crawl to finish
    Then the crawl finishes with status "completed"
    And its audit is available

  Scenario: An unreachable target fails with a reason, and its audit is a conflict
    When I enqueue a crawl of the unreachable target
    And I wait for the crawl to finish
    Then the crawl finishes with status "failed"
    And the failure carries a reason
    And requesting its audit returns status 409

  Scenario: An unknown job id is not found
    When I request the result of job "does-not-exist"
    Then the response status is 404
