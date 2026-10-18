import React, { useState, useEffect } from 'react';
import {
  Plug,
  MessageSquare,
  CreditCard,
  Calendar,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { apiFetch, UserSession } from '../../lib/api.ts';

interface IntegrationsState {
  twilio: {
    accountSid: string;
    whatsappNumber: string;
    enabled: boolean;
    lastSyncAt?: string;
    lastError?: string;
  };
  stripe: {
    publishableKey: string;
    enabled: boolean;
    lastSyncAt?: string;
    lastError?: string;
  };
  googleCalendar: {
    clientId: string;
    connectedUsers: Record<string, any>;
    enabled: boolean;
    lastSyncAt?: string;
    lastError?: string;
  };
  telegram: {
    chatId: string;
    hasToken: boolean;
    enabled: boolean;
    lastSyncAt?: string;
    lastError?: string;
  };
}

export const IntegrationsHub: React.FC<{ session: UserSession | null }> = ({ session }) => {
  const [integrations, setIntegrations] = useState<IntegrationsState | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchIntegrations = async () => {
    try {
      const res = await apiFetch<IntegrationsState>('/api/integrations');
      setIntegrations(res);
    } catch (err) {
      console.error('Failed to load integrations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  if (loading || !integrations) {
    return <div className="p-8 text-center text-slate-400">Loading integrations telemetry...</div>;
  }

  const providers = [
    {
      id: 'twilio',
      name: 'Twilio WhatsApp Sandbox',
      icon: MessageSquare,
      color: 'from-emerald-500 to-teal-600',
      status: integrations.twilio.enabled ? 'Connected' : 'Not Connected',
      lastSync: integrations.twilio.lastSyncAt,
      error: integrations.twilio.lastError,
      details: `Number: ${integrations.twilio.whatsappNumber || 'whatsapp:+14155238886'}`,
      capabilities: 'Bi-directional client messaging, automated contact provisioning, carrier opt-out compliance (STOP/UNSUBSCRIBE), delivery receipt tracking.',
      sandboxCaveat: 'Twilio Sandbox restriction: Recipients must send "join <sandbox-keyword>" to the Twilio number once before receiving replies.',
    },
    {
      id: 'stripe',
      name: 'Stripe Payments (Test Mode)',
      icon: CreditCard,
      color: 'from-indigo-500 to-purple-600',
      status: integrations.stripe.enabled ? 'Connected' : 'Not Connected',
      lastSync: integrations.stripe.lastSyncAt,
      error: integrations.stripe.lastError,
      details: `Publishable Key: ${integrations.stripe.publishableKey || 'pk_test_...'}`,
      capabilities: 'Checkout sessions, server-validated minor currency units, raw webhook signature verification, dispute & refund reconciliation.',
      sandboxCaveat: 'Stripe Sandbox mode: Operates exclusively with test payment cards. Unpaid payment requests never count toward collected revenue.',
    },
    {
      id: 'googleCalendar',
      name: 'Google Calendar API',
      icon: Calendar,
      color: 'from-blue-500 to-cyan-600',
      status: integrations.googleCalendar.enabled ? 'Connected' : 'Not Connected',
      lastSync: integrations.googleCalendar.lastSyncAt,
      error: integrations.googleCalendar.lastError,
      details: `${Object.keys(integrations.googleCalendar.connectedUsers || {}).length} User(s) Synced`,
      capabilities: 'OAuth 2.0 authentication, busy-time collision prevention, UTC ISO normalization, automated rescheduling and cancellation.',
      sandboxCaveat: 'OAuth Consent: Requires users to grant calendar.events scope. Checks conflicting intervals prior to creating appointments.',
    },
    {
      id: 'telegram',
      name: 'Telegram SLA Escalation Bot',
      icon: Send,
      color: 'from-sky-500 to-blue-600',
      status: integrations.telegram.enabled ? 'Connected' : 'Not Connected',
      lastSync: integrations.telegram.lastSyncAt,
      error: integrations.telegram.lastError,
      details: `Channel / Chat ID: ${integrations.telegram.chatId || 'Not Configured'}`,
      capabilities: 'Instant operational alerting when unacknowledged leads expire SLA windows. Includes deep-links to authenticated lead views.',
      sandboxCaveat: 'Bot authorization: The bot must be added to the destination operations channel or group with message-sending privileges.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Integrations Management & Webhooks</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real external service connectors, sandbox configurations, synchronization logs, and error explanations.
          </p>
        </div>
      </div>

      {/* Providers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {providers.map((p) => {
          const Icon = p.icon;
          const isConnected = p.status === 'Connected';

          return (
            <div
              key={p.id}
              className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 hover:border-slate-300 transition shadow-xs"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xs">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{p.name}</h3>
                    <p className="text-xs text-slate-500">{p.details}</p>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                    isConnected
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {p.status}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Provider Capabilities</span>
                  <p className="text-slate-600 mt-0.5">{p.capabilities}</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                  <strong className="text-slate-900 font-semibold block">Sandbox Guidelines & Limits:</strong>
                  <p>{p.sandboxCaveat}</p>
                </div>

                <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100">
                  <span>Last Sync: {p.lastSync ? new Date(p.lastSync).toLocaleTimeString() : 'Never'}</span>
                  {p.error && <span className="text-rose-700 font-semibold">{p.error}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
