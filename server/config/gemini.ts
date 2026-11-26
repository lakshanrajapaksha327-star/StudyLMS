import { aiManagerService } from '../ai/ai-manager.service';

/**
 * Legacy export retained only so callers route through the centralized AiManagerService.
 * Direct unguarded SDK initialization is disallowed outside server/ai/providers/*.
 */
export function getAiManager() {
  return aiManagerService;
}
