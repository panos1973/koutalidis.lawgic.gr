/**
 * Per-tool configuration for token limits and model selection.
 *
 * Tools that produce long outputs (bond programmes, DD reviews, translations)
 * need higher token limits than short-form tools (engagement letters, court orders).
 */

interface ToolConfig {
  maxTokens: number
  /** Optional model override — some tools may benefit from a stronger model */
  model?: string
}

const DEFAULT_MAX_TOKENS = 16384

export const TOOL_MAX_TOKENS: Record<string, ToolConfig> = {
  // --- Document Generation ---
  'cp-checklist': { maxTokens: 16384 },
  'security-perfection': { maxTokens: 16384 },
  'signing-agenda': { maxTokens: 16384 },
  'bond-certificates': { maxTokens: 32768 }, // Multiple certificates in one go
  'bond-programme': { maxTokens: 65536 }, // Full programme draft — 50+ pages
  'engagement-letter': { maxTokens: 8192 }, // Short document
  'court-orders': { maxTokens: 32768 }, // Multiple short documents

  // --- Document Review ---
  'programme-review': { maxTokens: 32768 }, // Detailed clause-by-clause review
  'query-review': { maxTokens: 16384 },
  'dd-review': { maxTokens: 65536 }, // Full DD report across multiple documents

  // --- Translation ---
  'en-gr-translation': { maxTokens: 65536 }, // Full document translations

  // --- M&A: Due Diligence ---
  'dd-report': { maxTokens: 65536 }, // Full DD report across multiple workstreams
  'red-flag-analysis': { maxTokens: 32768 }, // Concise red flag summary

  // --- M&A: Transaction Docs ---
  'spa-review': { maxTokens: 65536 }, // Detailed clause-by-clause SPA review
  'disclosure-letter': { maxTokens: 32768 }, // Disclosure letter with warranty mapping

  // --- M&A: Document Generation ---
  'corporate-minutes': { maxTokens: 32768 }, // Multiple sets of minutes/resolutions
}

export function getToolMaxTokens(toolId: string): number {
  return TOOL_MAX_TOKENS[toolId]?.maxTokens ?? DEFAULT_MAX_TOKENS
}

export function getToolModel(toolId: string): string | undefined {
  return TOOL_MAX_TOKENS[toolId]?.model
}
