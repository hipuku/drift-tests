Feature: The audit
  A completed crawl yields a deterministic audit of every design token actually
  shipped: colours, type and spacing, with WCAG contrast findings and a summary.
  The fixture site seeds known inconsistencies, so the audit's verdicts are
  predictable run to run.

  Background:
    Given a completed crawl of the fixture site

  Scenario: The audit reports its structure and summary
    Then the audit summary counts pages, colours and spacings
    And the audit lists colour families
    And the audit includes contrast findings

  Scenario: The audit surfaces the fixture's seeded inconsistencies
    Then the summary reports at least one near-duplicate colour
    And the summary reports at least one off-grid spacing
    And the summary reports at least one type size off the scale
    And the summary reports at least one contrast pair failing AA

  Scenario: No token is attributed to more pages than were crawled
    Then every contrast finding cites no more pages than were crawled
