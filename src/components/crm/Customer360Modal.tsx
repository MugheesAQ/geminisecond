import React, { useState, useEffect } from 'react';
import {
  Building2,
  Mail,
  Phone,
  Tag,
  DollarSign,
  MessageSquare,
  Calendar,
  History,
  CheckCircle2,
  AlertTriangle,
  Send,
  Lock,
} from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';

interface Customer360Data {
  contact: {
    id: string;
    name: string;
    email: string;
    phone: string;
    isOptedOut?: boolean;
    tags: string[];
    createdAt: string;
  };
  company?: {
    id: string;
    name: string;
    industry?: string;
    website?: string;
  };
  opportunities: any[];
  conversations: any[];
  payments: any[];
  appointments: any[];
  leads: any[];
  activities: any[];
}

export const Customer360Modal: React.FC<{
  contactId: string;
  onClose: () => void;
}> = ({ contactId, onClose }) => {
  const [data, setData] = useState<Customer360Data | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'messages' | 'payments' | 'appointments' | 'audit'>('overview');
  const [loading, setLoading] = useState(true);

  // Quick message reply state
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const fetch360 = async () => {
    try {
      const res = await apiFetch<Customer360Data>(`/api/crm/contacts/${contactId}/360`);
      setData(res);
    } catch (err) {
      console.error('Failed to load Customer 360:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch360();
  }, [contactId]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !data) return;
    setSendingReply(true);
    try {
      await apiFetch('/api/integrations/twilio/reply', {
        method: 'POST',
        body: JSON.stringify({
          contactId: data.contact.id,
          body: replyText,
        }),
      });
      setReplyText('');
      fetch360();
    } catch (err: any) {
      alert(`Message error: ${err.message}`);
    } finally {
      setSendingReply(false);
    }
  };

  const formatCurrency = (cents: number) => {
    if (cents < 0) return '••••••';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  if (loading || !data) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  const { contact, company, opportunities, conversations, payments, appointments, activities } = data;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl text-xs overflow-hidden">
        {/* Top Header */}
        <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-start justify-between">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white text-lg font-bold shadow-xs">
              {contact.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-slate-900">{contact.name}</h2>
                {contact.isOptedOut && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                    Opted Out of Messaging
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-slate-600 mt-1 text-[11px]">
                {company && (
                  <span className="flex items-center space-x-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-medium text-slate-800">{company.name}</span>
                  </span>
                )}
                <span className="flex items-center space-x-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{contact.email}</span>
                </span>
                {contact.phone && (
                  <span className="flex items-center space-x-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{contact.phone}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-200/60 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white px-6 gap-6">
          {[
            { id: 'overview', label: `Deals & Profile (${opportunities.length})` },
            { id: 'messages', label: `WhatsApp (${conversations.length > 0 ? conversations[0].messages.length : 0})` },
            { id: 'payments', label: `Payments & Revenue (${payments.length})` },
            { id: 'appointments', label: `Appointments (${appointments.length})` },
            { id: 'audit', label: `Audit Log (${activities.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 font-semibold text-xs border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-slate-900 text-slate-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 text-sm">Opportunities & Deal Progression</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {opportunities.map((opp) => (
                  <div key={opp.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{opp.title}</span>
                      <span className="text-slate-900 font-bold tabular-nums">{formatCurrency(opp.valueCents)}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Stage: <span className="text-slate-800 font-medium">{opp.stageId}</span>
                    </div>
                    {opp.customFields && Object.keys(opp.customFields).length > 0 && (
                      <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-1.5">
                        {Object.entries(opp.customFields).map(([k, v]) => (
                          <span key={k} className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 text-[10px]">
                            {k}: <strong className="text-slate-900">{String(v)}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {opportunities.length === 0 && (
                  <p className="text-slate-500 italic">No opportunities associated with this contact yet.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 max-h-72 overflow-y-auto space-y-3">
                {conversations.flatMap((c) => c.messages).map((m: any) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.direction === 'outbound' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[75%] p-3 rounded-xl ${
                        m.direction === 'outbound'
                          ? 'bg-slate-900 text-white rounded-br-none'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-xs'
                      }`}
                    >
                      <p>{m.body}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1">
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {m.status}
                    </span>
                  </div>
                ))}
                {conversations.length === 0 && (
                  <p className="text-slate-500 text-center py-6">No WhatsApp history logged yet.</p>
                )}
              </div>

              {/* Reply Box */}
              {!contact.isOptedOut ? (
                <form onSubmit={handleSendReply} className="flex gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type a WhatsApp reply (qualifies as lead acknowledgement)..."
                    className="flex-1 px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={sendingReply}
                    className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium flex items-center space-x-1 shadow-xs transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </form>
              ) : (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800">
                  Outgoing messaging is blocked because the recipient has opted out under carrier compliance rules.
                </div>
              )}
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="space-y-3">
              {payments.map((p) => (
                <div key={p.id} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-900">{p.description}</h4>
                    <span className="text-[10px] text-slate-500">Created {new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900 text-sm tabular-nums">{formatCurrency(p.amountCents)}</p>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        p.status === 'paid'
                          ? 'bg-emerald-100 text-emerald-800'
                          : p.status === 'refunded'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
              {payments.length === 0 && <p className="text-slate-500 italic">No payment requests generated yet.</p>}
            </div>
          )}

          {activeTab === 'appointments' && (
            <div className="space-y-3">
              {appointments.map((a) => (
                <div key={a.id} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-900">{a.title}</h4>
                    <span className="text-[10px] text-slate-500">
                      {new Date(a.startTime).toLocaleString()} ({a.timezone})
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-800 uppercase">
                    {a.status}
                  </span>
                </div>
              ))}
              {appointments.length === 0 && <p className="text-slate-500 italic">No appointments scheduled.</p>}
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-2">
              {activities.map((act) => (
                <div key={act.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-[11px]">
                  <div>
                    <span className="font-bold text-slate-900">{act.eventType}</span>
                    <p className="text-slate-600 mt-0.5">By {act.actorName}</p>
                  </div>
                  <span className="text-slate-400 font-mono text-[10px]">{new Date(act.timestamp).toLocaleDateString()}</span>
                </div>
              ))}
              {activities.length === 0 && <p className="text-slate-500 italic">No audit records logged yet.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
