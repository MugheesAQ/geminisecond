import React, { useState } from 'react';
import {
  Building2,
  UserCheck,
  ShieldCheck,
  Clock,
  Sparkles,
  ChevronDown,
  RefreshCw,
  LogOut,
  Sliders,
  ExternalLink,
  Menu,
} from 'lucide-react';
import { UserSession, saveSession, apiFetch } from '../../lib/api.ts';

interface NavbarProps {
  session: UserSession | null;
  onSessionChange: (session: UserSession | null) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenPublicPortal: () => void;
  onToggleMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  session,
  onSessionChange,
  onRefresh,
  isRefreshing,
  onOpenPublicPortal,
  onToggleMobileMenu,
}) => {
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>('available');
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Switch demo profiles for immediate reviewer evaluation of RBAC & permissions
  const handleSwitchProfile = async (email: string) => {
    try {
      setShowRoleMenu(false);
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: 'Password123!' }),
      });
      saveSession(res);
      onSessionChange(res);
      onRefresh();
    } catch (err: any) {
      alert(`Profile switch error: ${err.message}`);
    }
  };

  const handleUpdateAvailability = async (newStatus: 'available' | 'busy' | 'on_leave' | 'offline') => {
    try {
      setShowStatusMenu(false);
      setCurrentStatus(newStatus);
      const res = await apiFetch('/api/leads/availability', {
        method: 'POST',
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.reallocatedLeads > 0) {
        setStatusMessage(`Status set to ${newStatus}. Reallocated ${res.reallocatedLeads} open leads.`);
        setTimeout(() => setStatusMessage(''), 6000);
      } else {
        setStatusMessage(`Status updated to ${newStatus}.`);
        setTimeout(() => setStatusMessage(''), 4000);
      }
      onRefresh();
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-emerald-500 text-white';
      case 'busy':
        return 'bg-amber-500 text-white';
      case 'on_leave':
        return 'bg-purple-500 text-white';
      default:
        return 'bg-slate-500 text-white';
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 text-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Workspace Identity */}
        <div className="flex items-center space-x-3">
          {onToggleMobileMenu && (
            <button
              onClick={onToggleMobileMenu}
              className="md:hidden p-2 rounded-lg bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition"
              aria-label="Toggle Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-xs">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-base tracking-tight text-slate-900">Apex Business Platform</span>
              <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                · Unified Suite
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Workspace: <span className="text-slate-800 font-medium">{session?.workspace.name || 'Apex Business Services'}</span>
            </p>
          </div>
        </div>

        {/* Center Banner / Feedback */}
        {statusMessage && (
          <div className="hidden md:flex items-center space-x-2 px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-700">
            <Sparkles className="w-3.5 h-3.5 text-slate-600" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Right Controls: Availability, Role Switcher, Public Portal */}
        <div className="flex items-center space-x-2.5">
          {/* Public Portal Link */}
          <button
            onClick={onOpenPublicPortal}
            className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition"
            title="Open Public Lead Submission Form"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
            <span>Public Intake Form</span>
          </button>

          {/* Refresh Action */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 transition"
            title="Refresh Dashboard & Data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-slate-900' : ''}`} />
          </button>

          {/* Availability Status Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 transition text-xs font-medium text-slate-700 shadow-xs"
            >
              <span className={`w-2 h-2 rounded-full ${getStatusColor(currentStatus)}`} />
              <span className="capitalize text-slate-800">{currentStatus.replace('_', ' ')}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showStatusMenu && (
              <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 text-xs">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 border-b border-slate-100 uppercase tracking-wider">
                  Set Availability
                </div>
                {(['available', 'busy', 'on_leave', 'offline'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => handleUpdateAvailability(st)}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between text-slate-700 capitalize transition"
                  >
                    <div className="flex items-center space-x-2">
                      <span className={`w-2 h-2 rounded-full ${getStatusColor(st)}`} />
                      <span>{st.replace('_', ' ')}</span>
                    </div>
                    {currentStatus === st && <span className="text-slate-900 font-bold">✓</span>}
                  </button>
                ))}
                <div className="px-3 py-2 text-[11px] text-slate-500 bg-slate-50 border-t border-slate-100">
                  Changing from Available automatically reallocates open leads.
                </div>
              </div>
            )}
          </div>

          {/* Active User & Fast RBAC Role Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center space-x-2.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-xs text-slate-800 transition"
            >
              <div className="w-6 h-6 rounded-full bg-slate-900 flex items-center justify-center text-[11px] font-bold text-white">
                {session?.user.fullName.charAt(0) || 'U'}
              </div>
              <div className="text-left hidden sm:block">
                <p className="font-semibold text-slate-900 leading-tight">{session?.user.fullName || 'Sarah Chen'}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                  {session?.membership.role === 'owner'
                    ? 'Owner'
                    : session?.user.email.includes('manager')
                    ? 'Sales Manager'
                    : session?.membership.role}
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {showRoleMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg py-2 z-50 text-xs">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 border-b border-slate-100 uppercase tracking-wider">
                  Test Role / RBAC Switcher
                </div>
                <button
                  onClick={() => handleSwitchProfile('owner@apexservices.com')}
                  className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center justify-between text-slate-800 transition"
                >
                  <div>
                    <p className="font-semibold text-slate-900">Sarah Chen</p>
                    <p className="text-[11px] text-slate-500">Owner (Full Permissions & Sensitives)</p>
                  </div>
                  {session?.user.email === 'owner@apexservices.com' && <span className="text-slate-900 font-bold">✓</span>}
                </button>
                <button
                  onClick={() => handleSwitchProfile('admin@apexservices.com')}
                  className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center justify-between text-slate-800 transition"
                >
                  <div>
                    <p className="font-semibold text-slate-900">Marcus Vance</p>
                    <p className="text-[11px] text-slate-500">Admin (No Owner modification)</p>
                  </div>
                  {session?.user.email === 'admin@apexservices.com' && <span className="text-slate-900 font-bold">✓</span>}
                </button>
                <button
                  onClick={() => handleSwitchProfile('manager@apexservices.com')}
                  className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center justify-between text-slate-800 transition"
                >
                  <div>
                    <p className="font-semibold text-slate-900">David Ross</p>
                    <p className="text-[11px] text-slate-500">Sales Manager (Custom RBAC Combo)</p>
                  </div>
                  {session?.user.email === 'manager@apexservices.com' && <span className="text-slate-900 font-bold">✓</span>}
                </button>
                <button
                  onClick={() => handleSwitchProfile('agent@apexservices.com')}
                  className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center justify-between text-slate-800 transition"
                >
                  <div>
                    <p className="font-semibold text-slate-900">Elena Gomez</p>
                    <p className="text-[11px] text-slate-500">Account Exec (Personal Figures Only)</p>
                  </div>
                  {session?.user.email === 'agent@apexservices.com' && <span className="text-slate-900 font-bold">✓</span>}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
