import type { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service.ts';
import type { User, Workspace, Membership } from '../db/types.ts';

export interface AuthenticatedRequest extends Request {
  user?: User;
  workspace?: Workspace;
  membership?: Membership;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized: Authentication token required' });
  }

  const session = AuthService.authenticateSession(authHeader);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
  }

  req.user = session.user;
  req.workspace = session.workspace;
  req.membership = session.membership;

  next();
}

/**
 * Optional authentication middleware for endpoints like public web forms
 * that can accept anonymous requests or attach auth context if provided.
 */
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const session = AuthService.authenticateSession(authHeader);
    if (session) {
      req.user = session.user;
      req.workspace = session.workspace;
      req.membership = session.membership;
    }
  }
  next();
}
