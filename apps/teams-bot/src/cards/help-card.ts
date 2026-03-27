/**
 * Help Adaptive Card
 * Shows available commands with descriptions.
 */

export function createHelpCard(): Record<string, unknown> {
  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body: [
      {
        type: "TextBlock",
        text: "Merris ESG Bot",
        weight: "Bolder",
        size: "Large",
        color: "Good",
      },
      {
        type: "TextBlock",
        text: "Your AI-powered ESG assistant for Microsoft Teams. Here are the available commands:",
        wrap: true,
        spacing: "Small",
      },
      {
        type: "Container",
        spacing: "Medium",
        separator: true,
        items: [
          {
            type: "ColumnSet",
            columns: [
              {
                type: "Column",
                width: "150px",
                items: [
                  {
                    type: "TextBlock",
                    text: "`@Merris status`",
                    weight: "Bolder",
                    size: "Small",
                  },
                ],
              },
              {
                type: "Column",
                width: "stretch",
                items: [
                  {
                    type: "TextBlock",
                    text: "View engagement completeness with framework progress bars and deadline info.",
                    size: "Small",
                    wrap: true,
                  },
                ],
              },
            ],
          },
          {
            type: "ColumnSet",
            columns: [
              {
                type: "Column",
                width: "150px",
                items: [
                  {
                    type: "TextBlock",
                    text: "`@Merris gaps`",
                    weight: "Bolder",
                    size: "Small",
                  },
                ],
              },
              {
                type: "Column",
                width: "stretch",
                items: [
                  {
                    type: "TextBlock",
                    text: "View gap register summary with top 5 outstanding items and assignee breakdown.",
                    size: "Small",
                    wrap: true,
                  },
                ],
              },
            ],
          },
          {
            type: "ColumnSet",
            columns: [
              {
                type: "Column",
                width: "150px",
                items: [
                  {
                    type: "TextBlock",
                    text: "`@Merris calculate scope2`",
                    weight: "Bolder",
                    size: "Small",
                  },
                ],
              },
              {
                type: "Column",
                width: "stretch",
                items: [
                  {
                    type: "TextBlock",
                    text: "Run a GHG calculation and view results with full audit trail and methodology.",
                    size: "Small",
                    wrap: true,
                  },
                ],
              },
            ],
          },
          {
            type: "ColumnSet",
            columns: [
              {
                type: "Column",
                width: "150px",
                items: [
                  {
                    type: "TextBlock",
                    text: "`@Merris help`",
                    weight: "Bolder",
                    size: "Small",
                  },
                ],
              },
              {
                type: "Column",
                width: "stretch",
                items: [
                  {
                    type: "TextBlock",
                    text: "Show this help card with all available commands.",
                    size: "Small",
                    wrap: true,
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "TextBlock",
        text: "Tip: Set your default engagement with `@Merris set engagement <name>`",
        size: "Small",
        isSubtle: true,
        spacing: "Large",
        wrap: true,
      },
    ],
  };
}
