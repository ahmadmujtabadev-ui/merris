/**
 * Merris Teams Bot - Entry Point
 *
 * Express server exposing POST /api/messages for Bot Framework.
 */

import express from "express";
import {
  BotFrameworkAdapter,
  ConversationState,
  MemoryStorage,
  UserState,
} from "botbuilder";
import { MerrisBot } from "./bot";

const PORT = process.env.PORT || 3978;

// Bot Framework adapter
const adapter = new BotFrameworkAdapter({
  appId: process.env.MICROSOFT_APP_ID || "",
  appPassword: process.env.MICROSOFT_APP_PASSWORD || "",
});

// Error handler
adapter.onTurnError = async (context, error) => {
  console.error(`[onTurnError] ${error.message}`, error);
  await context.sendActivity(
    "Sorry, an error occurred processing your request. Please try again."
  );
};

// State
const memoryStorage = new MemoryStorage();
const conversationState = new ConversationState(memoryStorage);
const userState = new UserState(memoryStorage);

// Bot instance
const bot = new MerrisBot(conversationState, userState);

// Express server
const app = express();
app.use(express.json());

app.post("/api/messages", async (req, res) => {
  await adapter.processActivity(req, res, async (context) => {
    await bot.run(context);
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "merris-teams-bot" });
});

app.listen(PORT, () => {
  console.log(`Merris Teams Bot listening on port ${PORT}`);
  console.log(`POST /api/messages for bot messages`);
});
