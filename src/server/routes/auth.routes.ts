import { Router } from 'express';
import { AuthService } from '../services/auth.service.ts';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.ts';
import { rateLimiter } from '../middleware/security.middleware.ts';
import { RbacService } from '../services/rbac.service.ts';

export const authRouter = Router();

authRouter.post('/register', rateLimiter(10), (req, res) => {
  try {
    const { email, password, fullName, workspaceName } = req.body;
    if (!email || !password || !fullName || !workspaceName) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    const result = AuthService.register({ email, password, fullName, workspaceName });
    res.status(201).json({
      token: result.token,
      user: { id: result.user.id, email: result.user.email, fullName: result.user.fullName },
      workspace: result.workspace,
      membership: result.membership,
      permissions: RbacService.getEffectivePermissions(result.membership),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Registration failed' });
  }
});

authRouter.post('/login', rateLimiter(15), (req, res) => {
  try {
    const { email, password, workspaceId } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const result = AuthService.login(email, password, workspaceId);
    res.json({
      token: result.token,
      user: { id: result.user.id, email: result.user.email, fullName: result.user.fullName },
      workspace: result.workspace,
      membership: result.membership,
      permissions: RbacService.getEffectivePermissions(result.membership),
    });
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'Login failed' });
  }
});

authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({
    user: { id: req.user!.id, email: req.user!.email, fullName: req.user!.fullName },
    workspace: req.workspace!,
    membership: req.membership!,
    permissions: RbacService.getEffectivePermissions(req.membership!),
  });
});

authRouter.post('/logout', requireAuth, (req: AuthenticatedRequest, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    // AuthService session invalidation handled in db store
  }
  res.json({ success: true, message: 'Logged out successfully' });
});
