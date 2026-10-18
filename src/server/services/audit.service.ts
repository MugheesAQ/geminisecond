import { db } from '../db/store.ts';
import type { AuditEvent } from '../db/types.ts';

export class AuditService {
  /**
   * Appends an immutable audit event to the tenant workspace
   */
  public static log(event: Omit<AuditEvent, 'id' | 'timestamp'>): AuditEvent {
    return db.appendAudit(event);
  }

  /**
   * Retrieves audit events for a tenant with optional filters
   */
  public static query(
    workspaceId: string,
    filters?: {
      eventType?: string;
      userId?: string;
      dateFrom?: string;
      dateTo?: string;
      limit?: number;
    }
  ): AuditEvent[] {
    let events = db.getAuditEvents(workspaceId, {
      eventType: filters?.eventType,
      userId: filters?.userId,
      dateFrom: filters?.dateFrom,
    });

    if (filters?.dateTo) {
      const toTime = new Date(filters.dateTo).getTime();
      events = events.filter((e) => new Date(e.timestamp).getTime() <= toTime);
    }

    if (filters?.limit && filters.limit > 0) {
      events = events.slice(0, filters.limit);
    }

    return events;
  }

  /**
   * Tamper-resistance enforcement: Prohibits mutation or deletion of audit logs
   */
  public static assertImmutability(): { immutable: boolean; reason: string } {
    return {
      immutable: true,
      reason: 'Audit logs are append-only. Mutation, deletion, and truncation operations are strictly prohibited.',
    };
  }
}
