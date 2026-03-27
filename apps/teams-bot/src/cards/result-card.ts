/**
 * Calculation Result Adaptive Card
 * Shows calculation result, methodology, and audit trail.
 */

interface ResultData {
  calculationType: string;
  result: number;
  unit: string;
  methodology: string;
  auditTrail: Array<{
    step: string;
    value: string;
    source: string;
  }>;
}

export function createResultCard(data: ResultData): Record<string, unknown> {
  const trailRows = data.auditTrail.map((item) => ({
    type: "ColumnSet",
    columns: [
      {
        type: "Column",
        width: "stretch",
        items: [
          {
            type: "TextBlock",
            text: item.step,
            size: "Small",
          },
        ],
      },
      {
        type: "Column",
        width: "100px",
        items: [
          {
            type: "TextBlock",
            text: item.value,
            size: "Small",
            weight: "Bolder",
            horizontalAlignment: "Right",
          },
        ],
      },
      {
        type: "Column",
        width: "100px",
        items: [
          {
            type: "TextBlock",
            text: item.source,
            size: "Small",
            color: "Accent",
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
        type: "TextBlock",
        text: "Calculation Result",
        weight: "Bolder",
        size: "Large",
        color: "Good",
      },
      {
        type: "ColumnSet",
        columns: [
          {
            type: "Column",
            width: "stretch",
            items: [
              {
                type: "TextBlock",
                text: data.calculationType,
                size: "Medium",
                weight: "Bolder",
              },
            ],
          },
          {
            type: "Column",
            width: "auto",
            items: [
              {
                type: "TextBlock",
                text: `${data.result.toLocaleString()} ${data.unit}`,
                size: "ExtraLarge",
                weight: "Bolder",
                color: "Accent",
              },
            ],
          },
        ],
      },
      {
        type: "FactSet",
        spacing: "Medium",
        facts: [{ title: "Methodology", value: data.methodology }],
      },
      {
        type: "TextBlock",
        text: "Audit Trail",
        weight: "Bolder",
        size: "Small",
        spacing: "Large",
        separator: true,
      },
      ...trailRows,
    ],
    actions: [
      {
        type: "Action.Submit",
        title: "Recalculate",
        data: { action: "recalculate", type: data.calculationType },
      },
      {
        type: "Action.Submit",
        title: "Export Report",
        data: { action: "export_calculation" },
      },
    ],
  };
}
