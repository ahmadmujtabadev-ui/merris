import { Client } from '@microsoft/microsoft-graph-client';
import { logger } from './logger.js';

const AZURE_TENANT_ID = process.env['AZURE_TENANT_ID'];
const AZURE_CLIENT_ID = process.env['AZURE_CLIENT_ID'];
const AZURE_CLIENT_SECRET = process.env['AZURE_CLIENT_SECRET'];

let graphClient: Client | null = null;

/**
 * Placeholder auth token provider.
 * In production, this will use MSAL to obtain tokens via client credentials flow.
 */
async function getAccessToken(): Promise<string> {
  // TODO: Implement MSAL client credentials flow
  throw new Error('Graph auth not yet implemented');
}

export function getGraphClient(): Client | null {
  if (graphClient) return graphClient;

  if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET) {
    logger.warn('Azure AD credentials not set — Graph client unavailable');
    return null;
  }

  graphClient = Client.init({
    authProvider: async (done) => {
      try {
        const token = await getAccessToken();
        done(null, token);
      } catch (error) {
        done(error as Error, null);
      }
    },
  });

  return graphClient;
}

export { getAccessToken };
