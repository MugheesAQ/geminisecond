import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Flame,
  ShieldCheck,
  RotateCcw,
  Sliders,
  CheckCircle2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { apiFetch, UserSession } from '../../lib/api.ts';

interface RecoveryItem {
  lead: {
    id: string;
    title: string;
    source: string;
    contactId: string;
    assignedToUserId?: string;
    ackDeadline: string;
    escalationLevel: number;
    notes: string[];
    createdAt: string;
  };
  qualificationReason: string;
  overdueMinutes: number;
  contact?: {
    name: string;
    email: string;
    phone: string;
  };
}

interface AssignmentRules {
  roundRobinEnabled: boolean;
  maxOpenLeadsPerUser: number;
  ackDeadlineMinutes: number;
  backupUserId?: string;
  escalationManagerUserId?: string;
  reassignOnUnavailable: boolean;
}

export const RecoveryQueue: React.FC<{ session: UserSession | null }> = ({ session }) => {
  const [items, setItems] = useState<RecoveryItem[]>([]);
  const [rules, setRules] = useState<AssignmentRules | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRulesConfig, setShowRulesConfig] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Quick reassign modal
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [reassignUserId, setReassignUserId] = useState('');
  const [reassignReason, setReassignReason] = useState('Executive managerial intervention via Recovery Queue');

  const fetchData = async () => {
    try {
      const [queueRes, rulesRes, teamRes] = await Promise.all([
        apiFetch<RecoveryItem[]>('/api/leads/recovery-queue'),
        apiFetch<AssignmentRules>('/api/leads/assignment-rules'),
        apiFetch<any[]>('/api/team/members'),
      ]);
      setItems(queueRes);
      setRules(rulesRes);
      setTeamMembers(teamRes);
    } catch (err) {
      console.error('Failed to load recovery queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rules) return;
    try {
      await apiFetch('/api/leads/assignment-rules', {
        method: 'PUT',
        body: JSON.stringify(rules),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      fetchData();
    } catch (err: any) {
      alert(`Failed to save rules: ${err.message}`);
    }
  };

  const handleResolveLead = async (leadId: string) => {
    try {
      await apiFetch(`/api/leads/${leadId}/acknowledge`, {
        method: 'POST',
        body: JSON.stringify({ qualifyingAction: 'recovery_queue_manager_override' }),
      });
      fetchData();
    } catch (err: any) {
      alert(`Resolution failed: ${err.message}`);
    }
  };

  const handleReassignLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId || !reassignUserId) return;
    try {
      await apiFetch(`/api/leads/${selectedLeadId}/reassign`, {
        method: 'POST',
        body: JSON.stringify({
          newAssigneeId: reassignUserId,
          reason: reassignReason,
        }),
      });
      setSelectedLeadId(null);
      setReassignUserId('');
      fetchData();
    } catch (err: any) {
      alert(`Reassign failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Lead Recovery & Escalation Queue</h1>
            {items.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                {items.length} Action Required
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Overdue SLAs, repeatedly escalated deals, or inactive leads requiring managerial reassignment.
          </p>
        </div>

        <button
          onClick={() => setShowRulesConfig(!showRulesConfig)}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium transition"
        >
          <Sliders className="w-3.5 h-3.5 text-slate-500" />
          <span>Assignment & SLA Rules</span>
        </button>
      </div>

      {/* Assignment Rules Config Drawer */}
      {showRulesConfig && rules && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 text-xs shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h3 className="font-bold text-slate-900 text-sm">Assignment Rules & Escalation Policies</h3>
            {saveSuccess && <span className="text-emerald-700 font-semibold">✓ Rules Saved Successfully</span>}
          </div>

          <form onSubmit={handleSaveRules} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Max Open Leads per Employee</label>
              <input
                type="number"
                min={1}
                max={50}
                value={rules.maxOpenLeadsPerUser}
                onChange={(e) => setRules({ ...rules, maxOpenLeadsPerUser: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white"
              />
              <span className="text-[10px] text-slate-400">Excludes employees at capacity from round-robin</span>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">SLA Deadline (Minutes)</label>
              <input
                type="number"
                min={5}
                max={1440}
                value={rules.ackDeadlineMinutes}
                onChange={(e) => setRules({ ...rules, ackDeadlineMinutes: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white"
              />
              <span className="text-[10px] text-slate-400">Time before unacknowledged lead auto-escalates</span>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Designated Backup Owner</label>
              <select
                value={rules.backupUserId || ''}
                onChange={(e) => setRules({ ...rules, backupUserId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white"
              >
                <option value="">Default (Workspace Owner)</option>
                {teamMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.fullName} ({m.role})
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400">Tier 1 escalation recipient</span>
            </div>

            <div className="md:col-span-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rules.reassignOnUnavailable}
                  onChange={(e) => setRules({ ...rules, reassignOnUnavailable: e.target.checked })}
                  className="rounded text-slate-900 focus:ring-0"
                />
                <span>Immediately re-route unacknowledged leads when an employee transitions to Busy/Leave/Offline</span>
              </label>

              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs shadow-xs"
              >
                Update Assignment Rules
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Recovery Queue Records */}
      <div className="space-y-3">
        {items.map((item) => {
          const assignee = teamMembers.find((m) => m.userId === item.lead.assignedToUserId);
          return (
            <div
              key={item.lead.id}
              className="bg-white border border-rose-200 rounded-xl p-5 hover:border-rose-300 transition flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-rose-50 text-rose-800 border border-rose-200">
                    {item.qualificationReason}
                  </span>
                  {item.lead.escalationLevel > 0 && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                      Tier {item.lead.escalationLevel} Escalation
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-bold text-slate-900">{item.lead.title}</h3>

                <p className="text-xs text-slate-500">
                  Contact: <span className="text-slate-800 font-medium">{item.contact?.name || 'Inbound User'}</span> · Current Owner: <span className="text-slate-800 font-medium">{assignee?.fullName || 'Unassigned'}</span>
                </p>

                {item.lead.notes && item.lead.notes.length > 0 && (
                  <p className="text-[11px] text-slate-600 italic bg-slate-50 border border-slate-100 p-2 rounded-lg mt-2">
                    Latest Log: "{item.lead.notes[item.lead.notes.length - 1]}"
                  </p>
                )}
              </div>

              {/* Recovery Actions */}
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={() => setSelectedLeadId(item.lead.id)}
                  className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium text-xs transition"
                >
                  Emergency Reassign
                </button>

                <button
                  onClick={() => handleResolveLead(item.lead.id)}
                  className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs transition"
                >
                  Mark Resolved
                </button>
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-xs shadow-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-900">Recovery Queue is Empty</h3>
            <p className="text-slate-500 mt-1">All leads are currently acknowledged and within their designated SLAs.</p>
          </div>
        )}
      </div>

      {/* Emergency Reassign Modal */}
      {selectedLeadId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 text-xs shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Reallocate Overdue Lead</h3>
            <p className="text-slate-500 mt-1">Select an active available agent or manager to take immediate ownership.</p>

            <form onSubmit={handleReassignLead} className="mt-4 space-y-4">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">New Assignee *</label>
                <select
                  required
                  value={reassignUserId}
                  onChange={(e) => setReassignUserId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white"
                >
                  <option value="">Select available agent...</option>
                  {teamMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.fullName} ({m.availability})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Reason for Reassignment</label>
                <input
                  type="text"
                  required
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedLeadId(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-xs"
                >
                  Confirm Reallocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
