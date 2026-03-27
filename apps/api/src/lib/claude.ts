import Anthropic from '@anthropic-ai/sdk';
import { logger } from './logger.js';

const ANTHROPIC_API_KEY = process.env['ANTHROPIC_API_KEY'];

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (client) return client;

  if (!ANTHROPIC_API_KEY) {
    logger.warn('ANTHROPIC_API_KEY not set — Claude client unavailable');
    return null;
  }

  client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  return client;
}

export interface SendMessageOptions {
  model?: string;
  maxTokens?: number;
  system?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export async function sendMessage(options: SendMessageOptions): Promise<string | null> {
  const anthropic = getClient();
  if (!anthropic) {
    logger.error('Cannot send message — Claude client not initialized');
    return null;
  }

  try {
    const response = await anthropic.messages.create({
      model: options.model || 'claude-sonnet-4-20250514',
      max_tokens: options.maxTokens || 4096,
      system: options.system,
      messages: options.messages,
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    return textBlock && 'text' in textBlock ? textBlock.text : null;
  } catch (error) {
    logger.error('Claude API call failed', error);
    throw error;
  }
}

export { getClient };
