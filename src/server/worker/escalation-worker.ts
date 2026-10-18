import { db } from '../db/store.ts';
import { LeadEngineService } from '../services/lead-engine.service.ts';

let workerInterval: NodeJS.Timeout | null = null;
const activelyProcessing = new Set<string>();

/**
 * Executes a single pass of the escalation evaluation engine
 */
export async function runEscalationPass(): Promise<{ checked: number; escalated: number }> {
  const workspaces = db.getData().workspaces;
  const now = new Date();
  let escalatedCount = 0;
  let checkedCount = 0;

  for (const ws of workspaces) {
    const leads = db.getLeads(ws.id);
    for (const lead of leads) {
      if (lead.status !== 'open' || lead.acknowledged) {
        continue;
      }

      checkedCount++;
      const deadline = new Date(lead.ackDeadline);
      if (deadline <= now) {
        // Concurrency lock: prevent simultaneous workers from processing the same lead
        if (activelyProcessing.has(lead.id)) {
          continue;
        }
        activelyProcessing.add(lead.id);

        try {
          const result = LeadEngineService.processEscalation(ws.id, lead.id);
          if (result) {
            escalatedCount++;
          }
        } catch (err) {
          console.error(`Escalation processing failed for lead ${lead.id}:`, err);
        } finally {
          activelyProcessing.delete(lead.id);
        }
      }
    }
  }

  return { checked: checkedCount, escalated: escalatedCount };
}

/**
 * Starts the durable background worker loop (runs every 5 seconds)
 */
export function startEscalationWorker(intervalMs = 5000): void {
  if (workerInterval) return;
  console.log(`[EscalationWorker] Starting background worker loop (interval: ${intervalMs}ms)`);
  workerInterval = setInterval(async () => {
    try {
      await runEscalationPass();
    } catch (err) {
      console.error('[EscalationWorker] Unexpected error in worker loop:', err);
    }
  }, intervalMs);
}

export function stopEscalationWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('[EscalationWorker] Stopped background worker loop');
  }
}
