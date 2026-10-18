import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Plus,
  UserCheck,
  Check,
  Lock,
  AlertTriangle,
  Sliders,
  Mail,
  User,
} from 'lucide-react';
import { apiFetch, UserSession } from '../../lib/api.ts';

interface TeamMember {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  role: 'owner' | 'admin' | 'user';
  customPermissions?: string[];
  effectivePermissions: string[];
  availability: string;
  createdAt: string;
}

const ALL_AVAILABLE_PERMISSIONS = [
  { key: 'crm:contacts:view', label: 'View Contacts', category: 'CRM Records' },
  { key: 'crm:contacts:create', label: 'Create Contacts', category: 'CRM Records' },
  { key: 'crm:contacts:edit', label: 'Edit Contacts', category: 'CRM Records' },
  { key: 'crm:contacts:delete', label: 'Delete Contacts', category: 'CRM Records' },
  { key: 'crm:contacts:export', label: 'Export Contacts', category: 'CRM Records' },
  { key: 'crm:opportunities:view', label: 'View Opportunities', category: 'CRM Records' },
  { key: 'crm:opportunities:create', label: 'Create Opportunities', category: 'CRM Records' },
  { key: 'crm:opportunities:edit', label: 'Edit Opportunities', category: 'CRM Records' },
  { key: 'crm:opportunities:delete', label: 'Delete Opportunities', category: 'CRM Records' },
  { key: 'crm:opportunities:export', label: 'Export Opportunities', category: 'CRM Records' },
  { key: 'crm:sensitive_values:view', label: 'View Sensitive Financial Deal Values', category: 'Financial Security' },
  { key: 'crm:pipelines:configure', label: 'Configure Pipelines & Custom Fields', category: 'Administration' },
  { key: 'leads:manage', label: 'Manage & Ingest Leads', category: 'Lead Operations' },
  { key: 'leads:assign', label: 'Manual Lead Reassignment', category: 'Lead Operations' },
  { key: 'leads:rules:configure', label: 'Configure Round-Robin & SLAs', category: 'Lead Operations' },
  { key: 'integrations:view', label: 'View Integrations', category: 'Integrations' },
  { key: 'integrations:configure', label: 'Configure API Keys & Webhooks', category: 'Integrations' },
  { key: 'audit:view', label: 'View Immutable Audit Ledger', category: 'Governance' },
  { key: 'workspace:members:manage', label: 'Invite & Manage Team Roles', category: 'Governance' },
];

export const TeamRbacManager: React.FC<{ session: UserSession | null }> = ({ session }) => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editRole, setEditRole] = useState<'owner' | 'admin' | 'user'>('user');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [actionError, setActionError] = useState('');

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'user'>('user');

  const fetchMembers = async () => {
    try {
      const res = await apiFetch<TeamMember[]>('/api/team/members');
      setMembers(res);
    } catch (err) {
      console.error('Failed to load team members:', err);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleOpenEdit = (m: TeamMember) => {
    setActionError('');
    setEditingMember(m);
    setEditRole(m.role);
    setSelectedPermissions(m.effectivePermissions || []);
  };

  const handleApplyPreset = (preset: 'owner' | 'admin' | 'manager' | 'user') => {
    if (preset === 'manager') {
      setEditRole('user');
      setSelectedPermissions([
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
        'audit:view',
      ]);
    } else if (preset === 'admin') {
      setEditRole('admin');
      setSelectedPermissions(ALL_AVAILABLE_PERMISSIONS.map((p) => p.key));
    } else if (preset === 'user') {
      setEditRole('user');
      setSelectedPermissions([
        'crm:contacts:view',
        'crm:contacts:create',
        'crm:contacts:edit',
        'crm:opportunities:view',
        'crm:opportunities:create',
        'crm:opportunities:edit',
        'leads:manage',
      ]);
    }
  };

  const handleSavePermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    setActionError('');

    try {
      await apiFetch(`/api/team/members/${editingMember.id}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({
          role: editRole,
          customPermissions: selectedPermissions,
        }),
      });
      setEditingMember(null);
      fetchMembers();
    } catch (err: any) {
      setActionError(err.message || 'Permission update rejected');
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/team/invite', {
        method: 'POST',
        body: JSON.stringify({
          email: inviteEmail,
          fullName: inviteName,
          role: inviteRole,
        }),
      });
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteName('');
      fetchMembers();
    } catch (err: any) {
      alert(`Invitation failed: ${err.message}`);
    }
  };

  const togglePermission = (permKey: string) => {
    if (selectedPermissions.includes(permKey)) {
      setSelectedPermissions(selectedPermissions.filter((k) => k !== permKey));
    } else {
      setSelectedPermissions([...selectedPermissions, permKey]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Team Members & Granular RBAC</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
              Server-Enforced Access
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Owner, Admin, and User roles. Managers are configurable permission combinations. Admins cannot alter Owner protections.
          </p>
        </div>

        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>Invite Member</span>
        </button>
      </div>

      {/* Team Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Employee Name & Email</th>
                <th className="px-5 py-3.5">Assigned Role</th>
                <th className="px-5 py-3.5">Permissions Architecture</th>
                <th className="px-5 py-3.5">Availability</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m) => {
                const isOwner = m.role === 'owner';
                const isManager = m.customPermissions && m.customPermissions.includes('leads:rules:configure') && m.role === 'user';

                return (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900 text-sm">{m.fullName}</div>
                      <div className="text-[11px] text-slate-500">{m.email}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isOwner
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : m.role === 'admin'
                            ? 'bg-slate-100 text-slate-800 border border-slate-200'
                            : isManager
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-50 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {isOwner ? 'Workspace Owner' : isManager ? 'Sales Manager (Custom RBAC)' : m.role}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      <div className="text-xs">
                        {isOwner ? (
                          <span className="text-amber-800 font-semibold flex items-center space-x-1">
                            <Lock className="w-3 h-3 text-amber-600" />
                            <span>Full Unrestricted Owner Permissions</span>
                          </span>
                        ) : (
                          <span>{m.effectivePermissions?.length || 0} granular privileges enabled</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Sensitive Deal Values:{' '}
                        {m.effectivePermissions?.includes('crm:sensitive_values:view') ? (
                          <strong className="text-emerald-700">Granted</strong>
                        ) : (
                          <strong className="text-slate-400">Redacted</strong>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="capitalize text-slate-800 font-medium">{m.availability}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => handleOpenEdit(m)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium text-[11px] transition"
                      >
                        Configure RBAC
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Permissions Modal */}
      {editingMember && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 text-xs shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Configure Permissions: {editingMember.fullName}
                </h3>
                <p className="text-slate-500">Granular field and module access control.</p>
              </div>
              <button
                onClick={() => setEditingMember(null)}
                className="text-slate-400 hover:text-slate-800"
              >
                ✕
              </button>
            </div>

            {actionError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleSavePermissions} className="mt-4 space-y-4 flex-1 overflow-y-auto pr-1">
              {/* Presets Bar */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-700 block mb-2">
                  Apply Role Template / Preset:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('manager')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold text-[11px]"
                  >
                    Preset: Sales Manager
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('admin')}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-semibold text-[11px]"
                  >
                    Preset: Administrator
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('user')}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-[11px]"
                  >
                    Preset: Account Executive (User)
                  </button>
                </div>
              </div>

              {/* Granular Checkboxes by Category */}
              <div className="space-y-4 pt-2">
                {['CRM Records', 'Financial Security', 'Lead Operations', 'Integrations', 'Governance'].map(
                  (cat) => (
                    <div key={cat} className="space-y-1.5">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                        {cat}
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {ALL_AVAILABLE_PERMISSIONS.filter((p) => p.category === cat).map((p) => {
                          const isChecked = selectedPermissions.includes(p.key);
                          return (
                            <label
                              key={p.key}
                              className={`flex items-center space-x-2.5 p-2 rounded-lg border cursor-pointer transition ${
                                isChecked
                                  ? 'bg-slate-100 border-slate-400 text-slate-900 font-medium'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => togglePermission(p.key)}
                                className="rounded text-slate-900 focus:ring-0"
                              />
                              <span className="text-xs">{p.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-xs"
                >
                  Save Permissions
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 text-xs shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Invite Team Member</h3>
            <p className="text-slate-500 mt-1">Invited employee will receive account credentials.</p>

            <form onSubmit={handleInvite} className="mt-4 space-y-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Taylor Swift"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Corporate Email *</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="taylor@company.example.com"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Initial Base Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white"
                >
                  <option value="user">User (Standard Account Exec)</option>
                  <option value="admin">Administrator (Workspace Admin)</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-xs"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
