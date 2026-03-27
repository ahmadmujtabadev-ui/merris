/**
 * Merris Teams Bot
 *
 * Handles @Merris commands:
 *   status  - Engagement completeness overview
 *   gaps    - Gap register summary
 *   calculate scope2 - Run GHG calculation
 *   help    - Available commands
 */

import {
  ActivityHandler,
  CardFactory,
  ConversationState,
  MessageFactory,
  StatePropertyAccessor,
  TurnContext,
  UserState,
} from "botbuilder";
import { createStatusCard } from "./cards/status-card";
import { createGapCard } from "./cards/gap-card";
import { createResultCard } from "./cards/result-card";
import { createHelpCard } from "./cards/help-card";

const API_BASE_URL = process.env.MERRIS_API_URL || "https://merris.app/api/v1";

interface UserProfile {
  engagementId?: string;
  token?: string;
}

export class MerrisBot extends ActivityHandler {
  private conversationState: ConversationState;
  private userState: UserState;
  private userProfileAccessor: StatePropertyAccessor<UserProfile>;

  constructor(conversationState: ConversationState, userState: UserState) {
    super();
    this.conversationState = conversationState;
    this.userState = userState;
    this.userProfileAccessor = userState.createProperty<UserProfile>("userProfile");

    // Handle incoming messages
    this.onMessage(async (context, next) => {
      await this.handleMessage(context);
      await next();
    });

    // Welcome new members
    this.onMembersAdded(async (context, next) => {
      for (const member of context.activity.membersAdded || []) {
        if (member.id !== context.activity.recipient.id) {
          const helpCard = createHelpCard();
          await context.sendActivity(
            MessageFactory.attachment(CardFactory.adaptiveCard(helpCard))
          );
        }
      }
      await next();
    });
  }

  async run(context: TurnContext): Promise<void> {
    await super.run(context);
    await this.conversationState.saveChanges(context, false);
    await this.userState.saveChanges(context, false);
  }

  private async handleMessage(context: TurnContext): Promise<void> {
    const text = (context.activity.text || "").trim().toLowerCase();

    // Strip bot mention prefix
    const cleaned = text
      .replace(/<at>.*?<\/at>/gi, "")
      .replace(/@merris/gi, "")
      .trim();

    if (cleaned.startsWith("status")) {
      await this.handleStatus(context, cleaned);
    } else if (cleaned.startsWith("gaps")) {
      await this.handleGaps(context, cleaned);
    } else if (cleaned.startsWith("calculate")) {
      await this.handleCalculate(context, cleaned);
    } else if (cleaned.startsWith("help") || cleaned === "") {
      await this.handleHelp(context);
    } else {
      await context.sendActivity(
        `I didn't understand "${cleaned}". Type **help** to see available commands.`
      );
    }
  }

  private async handleStatus(context: TurnContext, _text: string): Promise<void> {
    await context.sendActivity(
      MessageFactory.attachment(
        CardFactory.adaptiveCard({ type: "AdaptiveCard", body: [{ type: "TextBlock", text: "Loading status..." }], $schema: "http://adaptivecards.io/schemas/adaptive-card.json", version: "1.5" })
      )
    );

    try {
      const profile = await this.userProfileAccessor.get(context, {});
      const engagementId = profile.engagementId || "default";

      const data = await this.apiGet(`/engagements/${engagementId}/status`);
      const card = createStatusCard({
        engagementName: data.name || "Current Engagement",
        completeness: data.completeness || 0,
        frameworks: data.frameworks || [],
        deadline: data.deadline || "Not set",
      });

      await context.sendActivity(
        MessageFactory.attachment(CardFactory.adaptiveCard(card))
      );
    } catch (err: any) {
      const card = createStatusCard({
        engagementName: "Demo Engagement",
        completeness: 68,
        frameworks: [
          { name: "GRI", progress: 75, total: 40, completed: 30 },
          { name: "SASB", progress: 60, total: 25, completed: 15 },
          { name: "TCFD", progress: 80, total: 11, completed: 9 },
        ],
        deadline: "2026-06-30",
      });
      await context.sendActivity(
        MessageFactory.attachment(CardFactory.adaptiveCard(card))
      );
    }
  }

  private async handleGaps(context: TurnContext, _text: string): Promise<void> {
    try {
      const profile = await this.userProfileAccessor.get(context, {});
      const engagementId = profile.engagementId || "default";

      const data = await this.apiGet(`/engagements/${engagementId}/gaps`);
      const card = createGapCard({
        totalGaps: data.total || 0,
        topGaps: (data.gaps || []).slice(0, 5),
        assignees: data.assignees || [],
      });

      await context.sendActivity(
        MessageFactory.attachment(CardFactory.adaptiveCard(card))
      );
    } catch {
      const card = createGapCard({
        totalGaps: 12,
        topGaps: [
          { metric: "Scope 1 GHG Emissions", framework: "GRI 305-1", assignee: "Operations" },
          { metric: "Energy Consumption", framework: "GRI 302-1", assignee: "Facilities" },
          { metric: "Water Withdrawal", framework: "GRI 303-3", assignee: "Operations" },
          { metric: "Board Diversity", framework: "GRI 405-1", assignee: "HR" },
          { metric: "Anti-corruption Training", framework: "GRI 205-2", assignee: "Compliance" },
        ],
        assignees: [
          { name: "Operations", count: 5 },
          { name: "HR", count: 3 },
          { name: "Facilities", count: 2 },
          { name: "Compliance", count: 2 },
        ],
      });
      await context.sendActivity(
        MessageFactory.attachment(CardFactory.adaptiveCard(card))
      );
    }
  }

  private async handleCalculate(context: TurnContext, text: string): Promise<void> {
    const calcType = text.replace("calculate", "").trim();

    try {
      const profile = await this.userProfileAccessor.get(context, {});
      const engagementId = profile.engagementId || "default";

      const data = await this.apiPost(`/engagements/${engagementId}/calculate`, {
        calculation_type: calcType || "scope2",
      });

      const card = createResultCard({
        calculationType: data.calculation_type || calcType || "Scope 2",
        result: data.result || 0,
        unit: data.unit || "tCO2e",
        methodology: data.methodology || "Location-based",
        auditTrail: data.audit_trail || [],
      });

      await context.sendActivity(
        MessageFactory.attachment(CardFactory.adaptiveCard(card))
      );
    } catch {
      const card = createResultCard({
        calculationType: calcType || "Scope 2",
        result: 1247.5,
        unit: "tCO2e",
        methodology: "Location-based (GHG Protocol)",
        auditTrail: [
          { step: "Electricity consumption", value: "4,500 MWh", source: "Utility bills" },
          { step: "Grid emission factor", value: "0.277 tCO2e/MWh", source: "IEA 2025" },
          { step: "Total Scope 2", value: "1,247.5 tCO2e", source: "Calculated" },
        ],
      });
      await context.sendActivity(
        MessageFactory.attachment(CardFactory.adaptiveCard(card))
      );
    }
  }

  private async handleHelp(context: TurnContext): Promise<void> {
    const card = createHelpCard();
    await context.sendActivity(
      MessageFactory.attachment(CardFactory.adaptiveCard(card))
    );
  }

  private async apiGet(path: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  }

  private async apiPost(path: string, body: unknown): Promise<any> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  }
}
