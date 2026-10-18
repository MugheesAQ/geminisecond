import React, { useState, useEffect } from 'react';
import {
  Users,
  Target,
  Clock,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Calendar,
  DollarSign,
  ArrowUpRight,
  Eye,
  EyeOff,
  Filter,
  TrendingUp,
} from 'lucide-react';
import { apiFetch, UserSession } from '../../lib/api.ts';
import { NavTab } from '../layout/Sidebar.tsx';

interface DashboardMetricsData {
  newLeadsToday: { count: number; drillDownFilter: any };
  openPipelineValue: {
    totalValueCents: number;
    projectedValueCents: number;
    byStage: { stageId: string; stageName: string; count: number; valueCents: number }[];
  };
  avgTimeToFirstResponseMinutes: number;
  recoveryQueueCount: { count: number };
  escalationsLast24h: { count: number };
  employeeAvailability: { available: number; busy: number; onLeave: number; offline: number };
  upcomingAppointments: {
    count: number;
    nextAppointment?: { id: string; title: string; startTime: string };
  };
  collectedRevenueThisMonth: {
    collectedCents: number;
    refundedCents: number;
    netCents: number;
    unpaidPendingCents: number;
  };
}

interface OperationalDashboardProps {
  session: UserSession | null;
  onNavigateTab: (tab: NavTab) => void;
}

export const OperationalDashboard: React.FC<OperationalDashboardProps> = ({ session, onNavigateTab }) => {
  const [metrics, setMetrics] = useState<DashboardMetricsData | null>(null);
  const [hiddenCards, setHiddenCards] = useState<string[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const [metricsRes, prefRes] = await Promise.all([
        apiFetch<DashboardMetricsData>('/api/dashboard/metrics'),
        apiFetch<{ hiddenCardKeys: string[] }>('/api/dashboard/preferences'),
      ]);
      setMetrics(metricsRes);
      setHiddenCards(prefRes.hiddenCardKeys || []);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Controlled polling every 10 seconds for real-time visibility without manual refresh
    const timer = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(timer);
  }, [session?.user.id]);

  const toggleCardVisibility = async (key: string) => {
    const updated = hiddenCards.includes(key)
      ? hiddenCards.filter((k) => k !== key)
      : [...hiddenCards, key];
    setHiddenCards(updated);
    try {
      await apiFetch('/api/dashboard/preferences', {
        method: 'POST',
        body: JSON.stringify({ hiddenCardKeys: updated }),
      });
    } catch (err) {
      console.error('Failed to save dashboard preferences:', err);
    }
  };

  const formatCurrency = (cents: number) => {
    if (cents < 0) return 'Restricted';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  const isRoleUser = session?.membership.role === 'user' && !session?.user.email.includes('manager');

  if (loading || !metrics) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  const cardDefinitions = [
    {
      id: 'new_leads_today',
      title: 'New Leads Today',
      value: metrics.newLeadsToday.count,
      description: 'Ingested via Web, WhatsApp & Manual',
      icon: Target,
      iconColor: 'bg-slate-100 text-slate-800',
      drillDownAction: () => onNavigateTab('leads'),
      drillDownLabel: 'Inspect Leads',
    },
    {
      id: 'pipeline_value',
      title: 'Open Pipeline Value',
      value: formatCurrency(metrics.openPipelineValue.totalValueCents),
      description: `${metrics.openPipelineValue.byStage.reduce((acc, s) => acc + s.count, 0)} Active Deals`,
      icon: TrendingUp,
      iconColor: 'bg-slate-100 text-slate-800',
      drillDownAction: () => onNavigateTab('kanban'),
      drillDownLabel: 'View Kanban Board',
    },
    {
      id: 'avg_response_time',
      title: 'Avg. First Response',
      value: `${metrics.avgTimeToFirstResponseMinutes}m`,
      description: 'SLA target: < 30 minutes',
      icon: Clock,
      iconColor: metrics.avgTimeToFirstResponseMinutes > 30 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700',
      drillDownAction: () => onNavigateTab('leads'),
      drillDownLabel: 'Review SLAs',
    },
    {
      id: 'recovery_queue',
      title: 'Recovery Queue',
      value: metrics.recoveryQueueCount.count,
      description: 'Overdue SLA or Escalated',
      icon: AlertTriangle,
      iconColor: metrics.recoveryQueueCount.count > 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600',
      badge: metrics.recoveryQueueCount.count > 0 ? 'Urgent' : undefined,
      drillDownAction: () => onNavigateTab('recovery'),
      drillDownLabel: 'Open Recovery Queue',
    },
    {
      id: 'escalations_24h',
      title: 'Escalations (24h)',
      value: metrics.escalationsLast24h.count,
      description: 'Auto-escalated by SLA worker',
      icon: Flame,
      iconColor: 'bg-amber-50 text-amber-700',
      drillDownAction: () => onNavigateTab('audit'),
      drillDownLabel: 'Audit Logs',
    },
    {
      id: 'employee_availability',
      title: 'Team Availability',
      value: `${metrics.employeeAvailability.available} Available`,
      description: `${metrics.employeeAvailability.busy} Busy · ${metrics.employeeAvailability.onLeave} On Leave · ${metrics.employeeAvailability.offline} Offline`,
      icon: CheckCircle2,
      iconColor: 'bg-emerald-50 text-emerald-700',
      drillDownAction: () => onNavigateTab('team'),
      drillDownLabel: 'Manage Team',
    },
    {
      id: 'upcoming_appointments',
      title: 'Upcoming Appointments',
      value: metrics.upcomingAppointments.count,
      description: metrics.upcomingAppointments.nextAppointment
        ? `Next: ${new Date(metrics.upcomingAppointments.nextAppointment.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : 'No pending meetings',
      icon: Calendar,
      iconColor: 'bg-blue-50 text-blue-700',
      drillDownAction: () => onNavigateTab('calendar'),
      drillDownLabel: 'Open Calendar',
    },
    {
      id: 'collected_revenue',
      title: 'Collected Revenue (Month)',
      value: formatCurrency(metrics.collectedRevenueThisMonth.netCents),
      description: `Settled: ${formatCurrency(metrics.collectedRevenueThisMonth.collectedCents)} (Pending: ${formatCurrency(metrics.collectedRevenueThisMonth.unpaidPendingCents)})`,
      icon: DollarSign,
      iconColor: 'bg-emerald-50 text-emerald-700',
      drillDownAction: () => onNavigateTab('payments'),
      drillDownLabel: 'View Payments Hub',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Operational Overview</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time telemetry, lead assignment velocity, and verified metrics.
            {isRoleUser ? (
              <span className="text-slate-700 font-medium ml-1">
                (Scoped to your personal records as Account Executive)
              </span>
            ) : (
              <span className="text-slate-700 font-medium ml-1">
                (Company-wide perspective for {session?.membership.role === 'owner' ? 'Owner' : 'Executive/Manager'})
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700 transition"
          >
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span>Customize Cards ({8 - hiddenCards.length}/8)</span>
          </button>
        </div>
      </div>

      {/* Card Preferences Modal / Drawer */}
      {showConfig && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-xs shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-slate-900">Toggle Metric Card Visibility (Saved Per User)</span>
            <button
              onClick={() => setShowConfig(false)}
              className="text-slate-400 hover:text-slate-700"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {cardDefinitions.map((c) => {
              const isHidden = hiddenCards.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggleCardVisibility(c.id)}
                  className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition ${
                    isHidden
                      ? 'bg-slate-50 border-slate-200 text-slate-400'
                      : 'bg-white border-slate-300 text-slate-800 shadow-xs'
                  }`}
                >
                  <span className="truncate pr-2">{c.title}</span>
                  {isHidden ? <EyeOff className="w-3.5 h-3.5 shrink-0 text-slate-400" /> : <Eye className="w-3.5 h-3.5 shrink-0 text-slate-700" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 8 Operational Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cardDefinitions
          .filter((c) => !hiddenCards.includes(c.id))
          .map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 p-5 shadow-xs transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-8 h-8 rounded-lg ${card.iconColor} flex items-center justify-center`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    {card.badge && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800">
                        {card.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="text-xs font-medium text-slate-500">{card.title}</h3>
                  <p className="text-2xl font-bold text-slate-900 mt-1 tracking-tight tabular-nums">{card.value}</p>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-1">{card.description}</p>
                </div>

                {/* Drill-down action opening filtered record list */}
                <button
                  onClick={card.drillDownAction}
                  className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 hover:text-slate-900 font-medium group transition"
                >
                  <span>{card.drillDownLabel}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
                </button>
              </div>
            );
          })}
      </div>

      {/* Pipeline Stage Breakdown Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Open Pipeline Value Grouped by Stage</h2>
            <p className="text-xs text-slate-500">Enforces custom stage required fields on movement</p>
          </div>
          <button
            onClick={() => onNavigateTab('kanban')}
            className="text-xs font-medium text-slate-700 hover:text-slate-900 flex items-center space-x-1"
          >
            <span>Open Kanban</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {metrics.openPipelineValue.byStage.map((stg) => (
            <div
              key={stg.stageId}
              onClick={() => onNavigateTab('kanban')}
              className="bg-slate-50 hover:bg-slate-100/80 rounded-lg p-3.5 border border-slate-200 cursor-pointer transition text-left"
            >
              <span className="text-[11px] font-medium text-slate-600 line-clamp-1">{stg.stageName}</span>
              <p className="text-lg font-bold text-slate-900 mt-1 tabular-nums">{formatCurrency(stg.valueCents)}</p>
              <span className="text-[10px] text-slate-500">{stg.count} deal(s)</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
