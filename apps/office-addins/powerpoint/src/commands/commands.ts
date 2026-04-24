// @ts-nocheck
/**
 * Merris PowerPoint Add-in Commands
 *
 * Ribbon button handlers that open the taskpane with specific panels active.
 */

// Commands are triggered by the manifest Action elements.
// Since all buttons use ShowTaskpane action, commands.ts provides
// programmatic command registration for function-based commands.

Office.onReady(() => {
  // Register command handlers if needed for ExecuteFunction actions
});

/**
 * Insert Chart command — opens taskpane to chart panel.
 */
function insertChart(event: Office.AddinCommands.Event): void {
  // Taskpane opens automatically via ShowTaskpane action
  // This handler is for ExecuteFunction fallback
  event.completed();
}

/**
 * Generate Slide command — opens taskpane to slide panel.
 */
function generateSlide(event: Office.AddinCommands.Event): void {
  event.completed();
}

/**
 * Apply Branding command — opens taskpane to branding panel.
 */
function applyBranding(event: Office.AddinCommands.Event): void {
  event.completed();
}

/**
 * ESG Agent command — opens taskpane to agent panel.
 */
function openAgent(event: Office.AddinCommands.Event): void {
  event.completed();
}

// Register with Office
(globalThis as any).insertChart = insertChart;
(globalThis as any).generateSlide = generateSlide;
(globalThis as any).applyBranding = applyBranding;
(globalThis as any).openAgent = openAgent;
