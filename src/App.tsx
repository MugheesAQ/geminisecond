import React, { useState, useEffect } from 'react';
import { Navbar } from './components/layout/Navbar.tsx';
import { Sidebar, NavTab } from './components/layout/Sidebar.tsx';
import { OperationalDashboard } from './components/dashboard/OperationalDashboard.tsx';
import { LeadsView } from './components/leads/LeadsView.tsx';
import { RecoveryQueue } from './components/leads/RecoveryQueue.tsx';
import { KanbanBoard } from './components/crm/KanbanBoard.tsx';
import { ContactsView } from './components/crm/ContactsView.tsx';
import { PipelineManager } from './components/crm/PipelineManager.tsx';
import { WhatsAppInbox } from './components/inbox/WhatsAppInbox.tsx';
import { PaymentsHub } from './components/payments/PaymentsHub.tsx';
import { CalendarManager } from './components/calendar/CalendarManager.tsx';
import { TeamRbacManager } from './components/team/TeamRbacManager.tsx';
import { IntegrationsHub } from './components/integrations/IntegrationsHub.tsx';
import { AuditLogViewer } from './components/audit/AuditLogViewer.tsx';
import { Customer360Modal } from './components/crm/Customer360Modal.tsx';
import { PublicLeadPortal } from './components/leads/PublicLeadPortal.tsx';
import { UserSession, getStoredSession, saveSession, apiFetch } from './lib/api.ts';

export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [customer360ContactId, setCustomer360ContactId] = useState<string | null>(null);
  const [showPublicPortal, setShowPublicPortal] = useState(false);

  // Stats for badge counters
  const [recoveryCount, setRecoveryCount] = useState(0);
  const [openLeadsCount, setOpenLeadsCount] = useState(0);
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Initialize session
  useEffect(() => {
    const stored = getStoredSession();
    setSession(stored);
    fetchBadges();
  }, []);

  const fetchBadges = async () => {
    setIsRefreshing(true);
    try {
      const [leads, queue] = await Promise.all([
        apiFetch<any[]>('/api/leads'),
        apiFetch<any[]>('/api/leads/recovery-queue'),
      ]);
      const open = leads.filter((l) => l.status === 'open');
      const unacked = open.filter((l) => !l.acknowledged);
      setOpenLeadsCount(open.length);
      setUnacknowledgedCount(unacked.length);
      setRecoveryCount(queue.length);
    } catch (err) {
      // Quiet fail on background poll
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    fetchBadges();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased selection:bg-slate-900 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        session={session}
        onSessionChange={(s) => {
          setSession(s);
          fetchBadges();
        }}
        onRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
        onOpenPublicPortal={() => setShowPublicPortal(true)}
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          recoveryCount={recoveryCount}
          openLeadsCount={openLeadsCount}
          unacknowledgedCount={unacknowledgedCount}
          isOpenMobile={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        {/* Workspace Canvas Area */}
        <main className="flex-1 p-6 sm:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {currentTab === 'dashboard' && (
            <OperationalDashboard
              session={session}
              onNavigateTab={(tab) => setCurrentTab(tab)}
            />
          )}

          {currentTab === 'leads' && <LeadsView session={session} />}

          {currentTab === 'recovery' && <RecoveryQueue session={session} />}

          {currentTab === 'kanban' && (
            <KanbanBoard
              session={session}
              onOpenCustomer360={(contactId) => setCustomer360ContactId(contactId)}
            />
          )}

          {currentTab === 'contacts' && (
            <ContactsView
              onOpenCustomer360={(contactId) => setCustomer360ContactId(contactId)}
            />
          )}

          {currentTab === 'companies' && (
            <ContactsView
              onOpenCustomer360={(contactId) => setCustomer360ContactId(contactId)}
            />
          )}

          {currentTab === 'pipelines' && <PipelineManager />}

          {currentTab === 'inbox' && <WhatsAppInbox session={session} />}

          {currentTab === 'payments' && <PaymentsHub session={session} />}

          {currentTab === 'calendar' && <CalendarManager session={session} />}

          {currentTab === 'team' && <TeamRbacManager session={session} />}

          {currentTab === 'integrations' && <IntegrationsHub session={session} />}

          {currentTab === 'audit' && <AuditLogViewer session={session} />}
        </main>
      </div>

      {/* Customer 360 View Modal */}
      {customer360ContactId && (
        <Customer360Modal
          contactId={customer360ContactId}
          onClose={() => setCustomer360ContactId(null)}
        />
      )}

      {/* Public Lead Intake Portal Modal */}
      {showPublicPortal && (
        <PublicLeadPortal onClose={() => setShowPublicPortal(false)} />
      )}
    </div>
  );
}
