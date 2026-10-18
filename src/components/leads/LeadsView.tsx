import React, { useState, useEffect } from 'react';
import {
  Target,
  Clock,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Plus,
  RefreshCw,
  Search,
  MessageSquare,
  Globe,
  SlidersHorizontal,
} from 'lucide-react';
import { apiFetch, UserSession } from '../../lib/api.ts';

interface LeadItem {
  id: string;
  title: string;
  source: 'web_form' | 'twilio_whatsapp' | 'manual';
  contactId: string;
  assignedToUserId?: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
  ackDeadline: string;
  escalationLevel: number;
  status: 'open' | 'converted' | 'lost';
  customFields: Record<string, any>;
  notes: string[];
  createdAt: string;
  contact?: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
}

interface TeamMember {
  userId: string;
  fullName: string;
  email: string;
  role: string;
  availability: string;
}

export const LeadsView: React.FC<{ session: UserSession | null }> = ({ session }) => {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('open');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [reassignLead, setReassignLead] = useState<LeadItem | null>(null);
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [reassignReason, setReassignReason] = useState('');

  // Create form
  const [newTitle, setNewTitle] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newAssigneeChoice, setNewAssigneeChoice] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const fetchLeadsAndTeam = async () => {
    try {
      const [leadsRes, teamRes] = await Promise.all([
        apiFetch<LeadItem[]>('/api/leads'),
        apiFetch<TeamMember[]>('/api/leads/availability'),
      ]);
      setLeads(leadsRes);
      setTeamMembers(teamRes);
    } catch (err) {
      console.error('Failed to load leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeadsAndTeam();
    const timer = setInterval(fetchLeadsAndTeam, 8000);
    return () => clearInterval(timer);
  }, []);

  const handleAcknowledge = async (leadId: string) => {
    try {
      await apiFetch(`/api/leads/${leadId}/acknowledge`, {
        method: 'POST',
        body: JSON.stringify({ qualifyingAction: 'manual_button' }),
      });
      fetchLeadsAndTeam();
    } catch (err: any) {
      alert(`Acknowledgement error: ${err.message}`);
    }
  };

  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignLead || !newAssigneeId || !reassignReason) return;
    try {
      await apiFetch(`/api/leads/${reassignLead.id}/reassign`, {
        method: 'POST',
        body: JSON.stringify({
          newAssigneeId,
          reason: reassignReason,
        }),
      });
      setReassignLead(null);
      setNewAssigneeId('');
      setReassignReason('');
      fetchLeadsAndTeam();
    } catch (err: any) {
      alert(`Reassignment failed: ${err.message}`);
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Create contact first if new
      let contactId = '';
      if (newContactEmail && newContactName) {
        const contactRes = await apiFetch('/api/crm/contacts', {
          method: 'POST',
          body: JSON.stringify({
            name: newContactName,
            email: newContactEmail,
            phone: newContactPhone,
            tags: ['Manual Lead'],
          }),
        });
        contactId = contactRes.id;
      }

      await apiFetch('/api/leads', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle,
          contactId,
          manualAssigneeId: newAssigneeChoice || undefined,
          notes: newNotes ? [newNotes] : [],
        }),
      });

      setShowCreateModal(false);
      setNewTitle('');
      setNewContactName('');
      setNewContactEmail('');
      setNewContactPhone('');
      setNewAssigneeChoice('');
      setNewNotes('');
      fetchLeadsAndTeam();
    } catch (err: any) {
      alert(`Create lead failed: ${err.message}`);
    }
  };

  // Helper to render remaining acknowledgement countdown
  const renderRemainingTime = (deadlineIso: string, acknowledged: boolean) => {
    if (acknowledged) {
      return (
        <span className="inline-flex items-center space-x-1 text-emerald-400 font-semibold text-xs">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Acknowledged</span>
        </span>
      );
    }

    const now = Date.now();
    const deadline = new Date(deadlineIso).getTime();
    const diffSec = Math.floor((deadline - now) / 1000);

    if (diffSec <= 0) {
      const overdueMin = Math.abs(Math.floor(diffSec / 60));
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold animate-pulse">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Overdue by {overdueMin}m</span>
        </span>
      );
    }

    const min = Math.floor(diffSec / 60);
    const sec = diffSec % 60;
    const isUrgent = min < 15;

    return (
      <span
        className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
          isUrgent
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
            : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30'
        }`}
      >
        <Clock className="w-3.5 h-3.5" />
        <span>
          {min}m {sec}s remaining
        </span>
      </span>
    );
  };

  const filteredLeads = leads.filter((l) => {
    if (filterStatus !== 'all' && l.status !== filterStatus) return false;
    if (filterSource !== 'all' && l.source !== filterSource) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchTitle = l.title.toLowerCase().includes(q);
      const matchContact = l.contact?.name.toLowerCase().includes(q) || l.contact?.email.toLowerCase().includes(q);
      return matchTitle || matchContact;
    }
    return true;
  });

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'twilio_whatsapp':
        return <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />;
      case 'web_form':
        return <Globe className="w-3.5 h-3.5 text-blue-400" />;
      default:
        return <Target className="w-3.5 h-3.5 text-purple-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Lead Capture & Round-Robin Routing</h1>
          <p className="text-xs text-slate-500 mt-1">
            Every lead has an accountable owner, durable SLA deadline, and automated escalation.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Lead</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-3 flex-1 min-w-[240px]">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search leads, contacts, or emails..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:bg-white"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open Only</option>
            <option value="converted">Converted</option>
            <option value="lost">Lost</option>
          </select>

          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:bg-white"
          >
            <option value="all">All Sources</option>
            <option value="web_form">Public Web Form</option>
            <option value="twilio_whatsapp">Twilio WhatsApp</option>
            <option value="manual">Manual Entry</option>
          </select>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Lead Details</th>
                <th className="px-5 py-3.5">Contact</th>
                <th className="px-5 py-3.5">Source</th>
                <th className="px-5 py-3.5">Assigned Owner</th>
                <th className="px-5 py-3.5">SLA Countdown</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLeads.map((lead) => {
                const assignee = teamMembers.find((m) => m.userId === lead.assignedToUserId);
                return (
                  <tr key={lead.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900 text-sm">{lead.title}</div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-[10px] text-slate-400">
                          Created {new Date(lead.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {lead.escalationLevel > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            Tier {lead.escalationLevel} Escalated
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {lead.contact ? (
                        <div>
                          <p className="font-medium text-slate-800">{lead.contact.name}</p>
                          <p className="text-[11px] text-slate-500">{lead.contact.email || lead.contact.phone}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No contact linked</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">
                        {getSourceIcon(lead.source)}
                        <span className="capitalize">{lead.source.replace('_', ' ')}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-[10px] text-slate-700">
                          {assignee ? assignee.fullName.charAt(0) : '?'}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{assignee?.fullName || 'Unassigned'}</p>
                          <p className="text-[10px] text-slate-400 capitalize">{assignee?.availability || 'offline'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">{renderRemainingTime(lead.ackDeadline, lead.acknowledged)}</td>
                    <td className="px-5 py-4 text-right space-x-2">
                      {!lead.acknowledged && (
                        <button
                          onClick={() => handleAcknowledge(lead.id)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] transition shadow-xs"
                        >
                          Acknowledge
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setReassignLead(lead);
                          setNewAssigneeId(lead.assignedToUserId || '');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium text-[11px] transition"
                      >
                        Reassign
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredLeads.length === 0 && (
            <div className="p-12 text-center text-slate-500 text-xs">
              No matching leads found for the selected criteria.
            </div>
          )}
        </div>
      </div>

      {/* Manual Reassignment Modal */}
      {reassignLead && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 text-xs shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Manual Lead Reassignment</h3>
            <p className="text-slate-500 mt-1">Reassigning resets the SLA acknowledgement timer and logs an audit trail.</p>

            <form onSubmit={handleReassignSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Lead</label>
                <input
                  type="text"
                  disabled
                  value={reassignLead.title}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">New Assignee (Employee)</label>
                <select
                  required
                  value={newAssigneeId}
                  onChange={(e) => setNewAssigneeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:bg-white"
                >
                  <option value="">Select an employee...</option>
                  {teamMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.fullName} ({m.availability})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Reason for Reassignment</label>
                <textarea
                  required
                  rows={2}
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="e.g. Specialized technical inquiry requiring enterprise solutions lead"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReassignLead(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-xs"
                >
                  Confirm Reassignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Lead Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 text-xs shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Create New Lead</h3>
            <p className="text-slate-500 mt-1">Manual intake will assign via Round-Robin unless specified.</p>

            <form onSubmit={handleCreateLead} className="mt-4 space-y-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Lead Title / Inquiry Summary *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Warehouse Automation Pilot Consultation"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Contact Name *</label>
                  <input
                    type="text"
                    required
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Contact Email *</label>
                  <input
                    type="email"
                    required
                    value={newContactEmail}
                    onChange={(e) => setNewContactEmail(e.target.value)}
                    placeholder="jane@company.example.com"
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    placeholder="+1 (555) 234-5678"
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Assignee</label>
                  <select
                    value={newAssigneeChoice}
                    onChange={(e) => setNewAssigneeChoice(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:bg-white"
                  >
                    <option value="">Auto: Round-Robin Eligible Agent</option>
                    {teamMembers.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.fullName} ({m.availability})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Initial Notes / Requirements</label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Notes from initial customer call..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-xs"
                >
                  Create & Route Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
