import type { BaseRole, Permission, Membership, Opportunity } from '../db/types.ts';

// Default permission mappings for base roles
const DEFAULT_ROLE_PERMISSIONS: Record<BaseRole, Permission[]> = {
  owner: [
    'crm:contacts:view',
    'crm:contacts:create',
    'crm:contacts:edit',
    'crm:contacts:delete',
    'crm:contacts:export',
    'crm:opportunities:view',
    'crm:opportunities:create',
    'crm:opportunities:edit',
    'crm:opportunities:delete',
    'crm:opportunities:export',
    'crm:sensitive_values:view',
    'crm:pipelines:configure',
    'leads:manage',
    'leads:assign',
    'leads:rules:configure',
    'integrations:view',
    'integrations:configure',
    'audit:view',
    'workspace:members:manage',
  ],
  admin: [
    'crm:contacts:view',
    'crm:contacts:create',
    'crm:contacts:edit',
    'crm:contacts:delete',
    'crm:contacts:export',
    'crm:opportunities:view',
    'crm:opportunities:create',
    'crm:opportunities:edit',
    'crm:opportunities:delete',
    'crm:opportunities:export',
    'crm:sensitive_values:view',
    'crm:pipelines:configure',
    'leads:manage',
    'leads:assign',
    'leads:rules:configure',
    'integrations:view',
    'integrations:configure',
    'audit:view',
    'workspace:members:manage',
  ],
  user: [
    'crm:contacts:view',
    'crm:contacts:create',
    'crm:contacts:edit',
    'crm:opportunities:view',
    'crm:opportunities:create',
    'crm:opportunities:edit',
    'leads:manage',
  ],
};

export class RbacService {
  /**
   * Resolves effective permissions for a membership.
   * If customPermissions are specified (e.g. for Manager combinations), they override/augment base role.
   */
  public static getEffectivePermissions(membership: Membership): Permission[] {
    if (membership.role === 'owner') {
      return [...DEFAULT_ROLE_PERMISSIONS.owner];
    }
    if (membership.customPermissions && membership.customPermissions.length > 0) {
      return Array.from(new Set([...membership.customPermissions]));
    }
    return [...DEFAULT_ROLE_PERMISSIONS[membership.role]];
  }

  /**
   * Evaluates if a membership grants a specific permission.
   */
  public static hasPermission(membership: Membership, permission: Permission): boolean {
    if (membership.role === 'owner') return true;
    const effective = this.getEffectivePermissions(membership);
    return effective.includes(permission);
  }

  /**
   * Validates if actor can modify target member.
   * Admins cannot modify or delete Owner accounts, nor alter Owner permissions.
   */
  public static canModifyMember(actorMembership: Membership, targetMembership: Membership): { allowed: boolean; reason?: string } {
    if (actorMembership.workspaceId !== targetMembership.workspaceId) {
      return { allowed: false, reason: 'Cross-workspace modification forbidden' };
    }
    if (actorMembership.id === targetMembership.id) {
      return { allowed: true };
    }
    // Target is Owner: ONLY the Owner can modify an Owner
    if (targetMembership.role === 'owner') {
      return {
        allowed: false,
        reason: 'Admins cannot modify or bypass protections on the Workspace Owner account',
      };
    }
    // Only Owner and Admin can modify other members
    if (actorMembership.role === 'owner' || actorMembership.role === 'admin') {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Insufficient privileges to manage workspace members' };
  }

  /**
   * Sanitizes opportunity data based on field-level authorization.
   * Masks sensitive monetary values if the user lacks 'crm:sensitive_values:view'.
   */
  public static maskOpportunitySensitiveFields(opportunity: Opportunity, membership: Membership): Opportunity {
    const canViewSensitive = this.hasPermission(membership, 'crm:sensitive_values:view');
    if (canViewSensitive) {
      return opportunity;
    }
    // Redact monetary value
    return {
      ...opportunity,
      valueCents: -1, // Redacted sentinel value
    };
  }

  public static maskOpportunities(opportunities: Opportunity[], membership: Membership): Opportunity[] {
    return opportunities.map((opp) => this.maskOpportunitySensitiveFields(opp, membership));
  }
}
