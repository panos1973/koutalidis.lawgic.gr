import { TOOL_API_ROUTES, GENERAL_TOOL_ROUTES } from './practice-areas'

/**
 * Get the API route for a practice tool
 */
export function getToolApiRoute(toolId: string): string | null {
  return TOOL_API_ROUTES[toolId] || null
}

/**
 * Get the page route for a general tool
 */
export function getGeneralToolRoute(toolId: string): string | null {
  return GENERAL_TOOL_ROUTES[toolId] || null
}

/**
 * Check if a tool ID belongs to a practice tool
 */
export function isPracticeTool(toolId: string): boolean {
  return toolId in TOOL_API_ROUTES
}

/**
 * Check if a tool ID belongs to a general tool
 */
export function isGeneralTool(toolId: string): boolean {
  return toolId in GENERAL_TOOL_ROUTES
}

/**
 * Build the full chat URL for a tool within a project context
 */
export function buildToolUrl(
  locale: string,
  projectId: string,
  toolId: string
): string {
  return `/${locale}/projects/${projectId}/${toolId}`
}

/**
 * Build the URL for a tool without project context
 */
export function buildDirectToolUrl(locale: string, toolId: string): string {
  const generalRoute = GENERAL_TOOL_ROUTES[toolId]
  if (generalRoute) {
    return `/${locale}${generalRoute}`
  }
  return `/${locale}/tools/${toolId}`
}
