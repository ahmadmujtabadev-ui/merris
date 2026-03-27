/**
 * Status Adaptive Card
 * Shows engagement completeness, framework progress bars, and deadline.
 */

interface StatusData {
  engagementName: string;
  completeness: number;
  frameworks: Array<{
    name: string;
    progress: number;
    total: number;
    completed: number;
  }>;
  deadline: string;
}

export function createStatusCard(data: StatusData): Record<string, unknown> {
  const ragColor =
    data.completeness >= 75 ? "good" : data.completeness >= 50 ? "warning" : "attention";

  const frameworkBlocks = data.frameworks.map((fw) => ({
    type: "ColumnSet",
    columns: [
      {
        type: "Column",
        width: "80px",
        items: [
          {
            type: "TextBlock",
            text: fw.name,
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
            text: `${"█".repeat(Math.round(fw.progress / 5))}${"░".repeat(20 - Math.round(fw.progress / 5))} ${fw.progress}%`,
            fontType: "Monospace",
            size: "Small",
          },
        ],
      },
      {
        type: "Column",
        width: "80px",
        items: [
          {
            type: "TextBlock",
            text: `${fw.completed}/${fw.total}`,
            size: "Small",
            horizontalAlignment: "Right",
          },
        ],
      },
    ],
  }));

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
                text: "Engagement Status",
                weight: "Bolder",
                size: "Large",
                color: "Good",
              },
              {
                type: "TextBlock",
                text: data.engagementName,
                size: "Medium",
                spacing: "None",
              },
            ],
          },
          {
            type: "Column",
            width: "auto",
            items: [
              {
                type: "TextBlock",
                text: `${data.completeness}%`,
                weight: "Bolder",
                size: "ExtraLarge",
                color: ragColor,
              },
            ],
          },
        ],
      },
      {
        type: "TextBlock",
        text: "Framework Progress",
        weight: "Bolder",
        size: "Small",
        spacing: "Large",
        separator: true,
      },
      ...frameworkBlocks,
      {
        type: "FactSet",
        spacing: "Large",
        separator: true,
        facts: [
          { title: "Deadline", value: data.deadline },
          { title: "Overall", value: `${data.completeness}% complete` },
        ],
      },
    ],
    actions: [
      {
        type: "Action.Submit",
        title: "View Details",
        data: { action: "view_engagement_details" },
      },
      {
        type: "Action.Submit",
        title: "View Gaps",
        data: { action: "view_gaps" },
      },
    ],
  };
}
