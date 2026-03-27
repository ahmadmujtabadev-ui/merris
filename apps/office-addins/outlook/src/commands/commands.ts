/**
 * Merris Outlook Add-in Commands
 *
 * Ribbon button handlers for Outlook compose and read modes.
 */

Office.onReady(() => {
  // Register command handlers
});

/**
 * Generate Data Request command
 */
function generateDataRequest(event: Office.AddinCommands.Event): void {
  event.completed();
}

/**
 * Smart Reply command
 */
function smartReply(event: Office.AddinCommands.Event): void {
  event.completed();
}

// Register with Office
(globalThis as any).generateDataRequest = generateDataRequest;
(globalThis as any).smartReply = smartReply;
