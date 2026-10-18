import React, { useState, useEffect } from 'react';
import { History, ShieldCheck, Filter, Search, User, Calendar, Lock } from 'lucide-react';
import { apiFetch, UserSession } from '../../lib/api.ts';

interface AuditEvent {
  id: string;
  actorUserId?: string;
  actorType: string;
  actorName: string;
  eventType: string;
  targetEntity: string;
  targetId: string;
  details?: Record<string, any>;
  timestamp: string;
}

export const AuditLogViewer: React.FC<{ session: UserSession | null }> = ({ session }) => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const fetchAudit = async () => {
    try {
      const res = await apiFetch<AuditEvent[]>('/api/audit');
      setEvents(res);
      setAccessDenied(false);
    } catch (err: any) {
      if (err.message?.includes('Permission denied') || err.message?.includes('audit:view')) {
        setAccessDenied(true);
      } else {
        console.error('Failed to load audit events:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudit();
  }, [session?.user.id]);

  if (accessDenied) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-lg mx-auto text-xs space-y-3 shadow-xs">
        <Lock className="w-10 h-10 text-amber-600 mx-auto" />
        <h2 className="text-base font-bold text-slate-900">Access Restricted: Audit Permission Required</h2>
        <p className="text-slate-500">
          Your current role ({session?.membership.role}) or custom permission set lacks the{' '}
          <code className="text-slate-900 font-mono font-semibold">audit:view</code> privilege. Switch to Sarah Chen (Owner) or Marcus Vance (Admin) in the top bar to inspect audit logs.
        </p>
      </div>
    );
  }

  const allEventTypes = Array.from(new Set(events.map((e) => e.eventType)));

  const filtered = events.filter((e) => {
    if (filterType !== 'all' && e.eventType !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchType = e.eventType.toLowerCase().includes(q);
      const matchActor = e.actorName.toLowerCase().includes(q);
      const matchTarget = e.targetEntity.toLowerCase().includes(q);
      return matchType || matchActor || matchTarget;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Immutable Audit Ledger</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              Append-Only Store
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tamper-resistant audit stream recording all assignment transitions, permission mutations, and webhook activities.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 gap-3 shadow-xs">
        <div className="relative w-full max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search events, actors, or records..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white"
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:bg-white"
        >
          <option value="all">All Event Types ({allEventTypes.length})</option>
          {allEventTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Timestamp (UTC)</th>
                <th className="px-5 py-3.5">Event Type</th>
                <th className="px-5 py-3.5">Actor</th>
                <th className="px-5 py-3.5">Target Record</th>
                <th className="px-5 py-3.5">Event Details & Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50/80 transition">
                  <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                    {new Date(e.timestamp).toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className="font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {e.eventType}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-700 font-sans whitespace-nowrap">
                    <span className="font-medium text-slate-900">{e.actorName}</span>{' '}
                    <span className="text-[10px] text-slate-400">({e.actorType})</span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-700 font-sans whitespace-nowrap">
                    {e.targetEntity} <span className="text-slate-400 font-mono text-[10px]">#{e.targetId.slice(-6)}</span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600 font-mono text-[10px]">
                    {e.details ? JSON.stringify(e.details) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-12 text-center text-slate-500 text-xs font-sans">
              No matching audit events recorded.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
