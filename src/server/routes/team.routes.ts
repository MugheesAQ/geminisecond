import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.ts';
import { db } from '../db/store.ts';
import { RbacService } from '../services/rbac.service.ts';
import { AuthService } from '../services/auth.service.ts';
import type { Membership, User } from '../db/types.ts';

export const teamRouter = Router();

// GET /api/team/members
teamRouter.get('/members', requireAuth, (req: AuthenticatedRequest, res) => {
  const wsId = req.workspace!.id;
  const list = db.listMemberships(wsId).map((m) => ({
    id: m.id,
    userId: m.userId,
    role: m.role,
    customPermissions: m.customPermissions,
    effectivePermissions: RbacService.getEffectivePermissions(m),
    fullName: m.user.fullName,
    email: m.user.email,
    availability: m.availability?.status || 'available',
    createdAt: m.createdAt,
  }));
  res.json(list);
});

// POST /api/team/invite
teamRouter.post('/invite', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const wsId = req.workspace!.id;
    const canManage = RbacService.hasPermission(req.membership!, 'workspace:members:manage');
    if (!canManage) {
      return res.status(403).json({ error: 'Permission denied: workspace:members:manage required' });
    }

    const { email, fullName, role, customPermissions } = req.body;
    if (!email || !fullName) {
      return res.status(400).json({ error: 'Email and fullName are required' });
    }

    if (role === 'owner') {
      return res.status(400).json({ error: 'Cannot invite a second Owner. Transfer ownership instead.' });
    }

    let user = db.findUserByEmail(email);
    if (!user) {
      // Provision user account
      const salt = AuthService.generateSalt();
      const passwordHash = AuthService.hashPassword('Welcome2026!', salt);
      user = {
        id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        salt,
        passwordHash,
        createdAt: new Date().toISOString(),
      };
      db.createUser(user);
    }

    const existingMem = db.findMembership(wsId, user.id);
    if (existingMem) {
      return res.status(400).json({ error: 'User is already a member of this workspace' });
    }

    const membership: Membership = {
      id: `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      workspaceId: wsId,
      userId: user.id,
      role: role || 'user',
      customPermissions: customPermissions || [],
      createdAt: new Date().toISOString(),
    };

    db.createMembership(membership);
    db.setAvailability(wsId, user.id, 'available');

    db.appendAudit({
      workspaceId: wsId,
      actorUserId: req.user!.id,
      actorType: 'user',
      actorName: req.user!.fullName,
      eventType: 'TEAM_MEMBER_INVITED',
      targetEntity: 'Membership',
      targetId: membership.id,
      details: { email: user.email, role: membership.role },
    });

    res.status(201).json({
      id: membership.id,
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: membership.role,
      customPermissions: membership.customPermissions,
      effectivePermissions: RbacService.getEffectivePermissions(membership),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/team/members/:id/permissions
teamRouter.put('/members/:id/permissions', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const wsId = req.workspace!.id;
    const membershipId = req.params.id;
    const { role, customPermissions } = req.body;

    const targetMembership = db.getData().memberships.find((m) => m.id === membershipId && m.workspaceId === wsId);
    if (!targetMembership) {
      return res.status(404).json({ error: 'Membership not found' });
    }

    // Owner protection rule: Admins CANNOT modify Owner account or bypass Owner protections!
    const authCheck = RbacService.canModifyMember(req.membership!, targetMembership);
    if (!authCheck.allowed) {
      return res.status(403).json({ error: authCheck.reason });
    }

    if (role && role !== targetMembership.role) {
      if (targetMembership.role === 'owner') {
        return res.status(403).json({ error: 'Cannot demote the workspace Owner.' });
      }
      targetMembership.role = role;
    }

    if (customPermissions !== undefined) {
      targetMembership.customPermissions = Array.isArray(customPermissions) ? customPermissions : [];
    }

    db.updateMembership(targetMembership);

    db.appendAudit({
      workspaceId: wsId,
      actorUserId: req.user!.id,
      actorType: 'user',
      actorName: req.user!.fullName,
      eventType: 'PERMISSIONS_UPDATED',
      targetEntity: 'Membership',
      targetId: targetMembership.id,
      details: { role: targetMembership.role, customPermissions: targetMembership.customPermissions },
    });

    res.json({
      id: targetMembership.id,
      userId: targetMembership.userId,
      role: targetMembership.role,
      customPermissions: targetMembership.customPermissions,
      effectivePermissions: RbacService.getEffectivePermissions(targetMembership),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
