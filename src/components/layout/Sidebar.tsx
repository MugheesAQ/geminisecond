import React from 'react';
import {
  LayoutDashboard,
  Target,
  AlertTriangle,
  Kanban,
  Users,
  Briefcase,
  SlidersHorizontal,
  MessageSquare,
  CreditCard,
  Calendar,
  ShieldAlert,
  Plug,
  History,
  Send,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'leads'
  | 'recovery'
  | 'kanban'
  | 'contacts'
  | 'companies'
  | 'pipelines'
  | 'inbox'
  | 'payments'
  | 'calendar'
  | 'team'
  | 'integrations'
  | 'audit';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  recoveryCount: number;
  openLeadsCount: number;
  unacknowledgedCount: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  recoveryCount,
  openLeadsCount,
  unacknowledgedCount,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const navSections = [
    {
      title: 'Core Operations',
      items: [
        {
          id: 'dashboard' as NavTab,
          label: 'Dashboard',
          icon: LayoutDashboard,
        },
        {
          id: 'leads' as NavTab,
          label: 'Leads & Routing',
          icon: Target,
          badge: unacknowledgedCount > 0 ? `${unacknowledgedCount} unacked` : `${openLeadsCount} open`,
          badgeColor: unacknowledgedCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700',
        },
        {
          id: 'recovery' as NavTab,
          label: 'Recovery Queue',
          icon: AlertTriangle,
          badge: recoveryCount > 0 ? `${recoveryCount} urgent` : undefined,
          badgeColor: 'bg-rose-100 text-rose-800',
        },
      ],
    },
    {
      title: 'CRM & Pipeline',
      items: [
        {
          id: 'kanban' as NavTab,
          label: 'Sales Pipeline',
          icon: Kanban,
        },
        {
          id: 'contacts' as NavTab,
          label: 'Contacts',
          icon: Users,
        },
        {
          id: 'companies' as NavTab,
          label: 'Companies',
          icon: Briefcase,
        },
        {
          id: 'pipelines' as NavTab,
          label: 'Custom Fields & Stages',
          icon: SlidersHorizontal,
        },
      ],
    },
    {
      title: 'Engagement & Finance',
      items: [
        {
          id: 'inbox' as NavTab,
          label: 'WhatsApp Inbox',
          icon: MessageSquare,
        },
        {
          id: 'payments' as NavTab,
          label: 'Payments & Revenue',
          icon: CreditCard,
        },
        {
          id: 'calendar' as NavTab,
          label: 'Appointments',
          icon: Calendar,
        },
      ],
    },
    {
      title: 'Governance',
      items: [
        {
          id: 'team' as NavTab,
          label: 'Team & RBAC',
          icon: ShieldAlert,
        },
        {
          id: 'integrations' as NavTab,
          label: 'Integrations Hub',
          icon: Plug,
        },
        {
          id: 'audit' as NavTab,
          label: 'Audit History',
          icon: History,
        },
      ],
    },
  ];

  const content = (
    <div className="flex-1 py-5 px-3 space-y-6 overflow-y-auto">
      {navSections.map((sec) => (
        <div key={sec.title}>
          <p className="px-3 text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">
            {sec.title}
          </p>
          <div className="space-y-1">
            {sec.items.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    onCloseMobile?.();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-slate-900 text-white font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col shrink-0 min-h-[calc(100vh-4rem)]">
        {content}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <aside className="relative w-64 max-w-[80vw] bg-white border-r border-slate-200 flex flex-col z-10 shadow-xl h-full">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-900 text-xs">Navigation Menu</span>
              <button
                onClick={onCloseMobile}
                className="p-1 rounded text-slate-500 hover:text-slate-900"
              >
                ✕
              </button>
            </div>
            {content}
          </aside>
        </div>
      )}
    </>
  );
};
