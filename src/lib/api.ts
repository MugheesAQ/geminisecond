/**
 * Frontend API client with session management and authenticated headers
 */

export interface UserSession {
  token: string;
  user: {
    id: string;
    email: string;
    fullName: string;
  };
  workspace: {
    id: string;
    name: string;
    slug: string;
    ownerId: string;
  };
  membership: {
    id: string;
    role: 'owner' | 'admin' | 'user';
    customPermissions?: string[];
  };
  permissions: string[];
}

const STORAGE_KEY = 'ubmp_session';

const DEFAULT_OWNER_SESSION: UserSession = {
  token: 'mock-session-owner',
  user: {
    id: 'usr-sarah-owner',
    email: 'owner@apexservices.com',
    fullName: 'Sarah Chen (Owner)',
  },
  workspace: {
    id: 'ws-apex-01',
    name: 'Apex Business Services',
    slug: 'apex-services',
    ownerId: 'usr-sarah-owner',
  },
  membership: {
    id: 'mem-01',
    role: 'owner',
  },
  permissions: [
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
};

export function getStoredSession(): UserSession {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_OWNER_SESSION));
      return DEFAULT_OWNER_SESSION;
    }
    return JSON.parse(raw);
  } catch (err) {
    return DEFAULT_OWNER_SESSION;
  }
}

export function saveSession(session: UserSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const session = getStoredSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (session?.token) {
    headers['Authorization'] = `Bearer ${session.token}`;
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type') || '';
  let data: any = null;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    const errMsg = data?.error || (typeof data === 'string' ? data : 'API Request failed');
    throw new Error(errMsg);
  }

  return data;
}
