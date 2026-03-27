/**
 * Gap Register Adaptive Card
 * Shows missing items count, top 5 gaps, and assignee breakdown.
 */

interface GapData {
  totalGaps: number;
  topGaps: Array<{
    metric: string;
    framework: string;
    assignee: string;
  }>;
  assignees: Array<{
    name: string;
    count: number;
  }>;
}

export function createGapCard(data: GapData): Record<string, unknown> {
  const gapRows = data.topGaps.map((gap) => ({
    type: "ColumnSet",
    columns: [
      {
        type: "Column",
        width: "stretch",
        items: [
          {
            type: "TextBlock",
            text: gap.metric,
            size: "Small",
            weight: "Bolder",
          },
          {
            type: "TextBlock",
            text: gap.framework,
            size: "Small",
            color: "Accent",
            spacing: "None",
          },
        ],
      },
      {
        type: "Column",
        width: "100px",
        items: [
          {
            type: "TextBlock",
            text: gap.assignee,
            size: "Small",
            horizontalAlignment: "Right",
            color: "Dark",
          },
        ],
        verticalContentAlignment: "Center",
      },
    ],
  }));

  const assigneeText = data.assignees
    .map((a) => `**${a.name}**: ${a.count} items`)
    .join(" | ");

  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body: [
      {
        type: "ColumnSet",
        columns: [
          {
            type: "Column",
            width: "stretch",
            items: [
              {
                type: "TextBlock",
                text: "Gap Register",
                weight: "Bolder",
                size: "Large",
                color: "Good",
              },
            ],
          },
          {
            type: "Column",
            width: "auto",
            items: [
              {
                type: "TextBlock",
                text: `${data.totalGaps} gaps`,
                weight: "Bolder",
                size: "Large",
                color: data.totalGaps > 10 ? "Attention" : "Warning",
              },
            ],
          },
        ],
      },
      {
        type: "TextBlock",
        text: "Top 5 Outstanding Gaps",
        weight: "Bolder",
        size: "Small",
        spacing: "Large",
        separator: true,
      },
      ...gapRows,
      {
        type: "TextBlock",
        text: "Assignee Breakdown",
        weight: "Bolder",
        size: "Small",
        spacing: "Large",
        separator: true,
      },
      {
        type: "TextBlock",
        text: assigneeText,
        size: "Small",
        wrap: true,
      },
    ],
    actions: [
      {
        type: "Action.Submit",
        title: "Send Data Requests",
        data: { action: "send_data_requests" },
      },
      {
        type: "Action.Submit",
        title: "Export to Excel",
        data: { action: "export_gaps_excel" },
      },
    ],
  };
}
