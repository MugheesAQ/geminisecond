import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  User,
  ShieldCheck,
  CheckCheck,
  Phone,
  Sparkles,
  Bot,
  AlertCircle,
} from 'lucide-react';
import { apiFetch, UserSession } from '../../lib/api.ts';

export const WhatsAppInbox: React.FC<{ session: UserSession | null }> = ({ session }) => {
  const [conversations, setConversations] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  // Simulation form
  const [simPhone, setSimPhone] = useState('+15554921099');
  const [simBody, setSimBody] = useState('Hi! We need enterprise support for 25 service trucks.');
  const [simulating, setSimulating] = useState(false);

  const fetchConversations = async () => {
    try {
      const [contRes, oppsRes] = await Promise.all([
        apiFetch<any[]>('/api/crm/contacts'),
        apiFetch<any[]>('/api/crm/opportunities'),
      ]);
      setContacts(contRes);

      // Fetch conversations from store
      const allConvs = await Promise.all(
        contRes.map(async (c) => {
          try {
            const data = await apiFetch(`/api/crm/contacts/${c.id}/360`);
            return data.conversations?.[0] || null;
          } catch {
            return null;
          }
        })
      );

      const validConvs = allConvs.filter(Boolean);
      setConversations(validConvs);

      if (!selectedContactId && contRes.length > 0) {
        setSelectedContactId(contRes[0].id);
      }
    } catch (err) {
      console.error('Failed to load inbox:', err);
    }
  };

  useEffect(() => {
    fetchConversations();
    const timer = setInterval(fetchConversations, 6000);
    return () => clearInterval(timer);
  }, []);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedContactId) return;
    setSending(true);
    try {
      await apiFetch('/api/integrations/twilio/reply', {
        method: 'POST',
        body: JSON.stringify({
          contactId: selectedContactId,
          body: replyText,
        }),
      });
      setReplyText('');
      fetchConversations();
    } catch (err: any) {
      alert(`Message sending failed: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleSimulateInbound = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimulating(true);
    try {
      await fetch('/api/webhooks/twilio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          From: `whatsapp:${simPhone}`,
          To: 'whatsapp:+14155238886',
          Body: simBody,
          MessageSid: `SM_sim_${Date.now()}`,
        }).toString(),
      });
      setSimBody('');
      alert('Inbound Twilio WhatsApp webhook simulated! Checked contact matching, lead creation, and round-robin assignment.');
      fetchConversations();
    } catch (err: any) {
      alert(`Webhook error: ${err.message}`);
    } finally {
      setSimulating(false);
    }
  };

  const selectedContact = contacts.find((c) => c.id === selectedContactId);
  const activeConversation = conversations.find((c) => c.contactId === selectedContactId);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Twilio WhatsApp Sandbox Hub</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              Live Sandbox
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Two-way client messaging with automatic lead provisioning, assigned agent routing, and carrier opt-out compliance.
          </p>
        </div>
      </div>

      {/* Main Inbox Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Conversations List */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-xs">
          <span className="text-xs font-bold text-slate-900 block pb-2 border-b border-slate-100">
            Active Client Threads ({contacts.length})
          </span>

          <div className="space-y-1.5 max-h-[480px] overflow-y-auto">
            {contacts.map((c) => {
              const isSelected = c.id === selectedContactId;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedContactId(c.id)}
                  className={`w-full text-left p-3 rounded-lg border transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-slate-100 border-slate-300 text-slate-900'
                      : 'bg-white border-slate-100 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700">
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-slate-900">{c.name}</p>
                      <p className="text-[10px] text-slate-500">{c.phone || c.email}</p>
                    </div>
                  </div>
                  {c.isOptedOut && (
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                      STOP
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Inbound Simulator Widget */}
          <div className="pt-4 border-t border-slate-100 text-xs space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="font-bold text-slate-900 block">Twilio Webhook Simulator</span>
            <p className="text-[11px] text-slate-500">Simulate incoming customer message via Twilio Sandbox:</p>
            <form onSubmit={handleSimulateInbound} className="space-y-2">
              <input
                type="text"
                value={simPhone}
                onChange={(e) => setSimPhone(e.target.value)}
                placeholder="+1555..."
                className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-900 text-[11px] focus:outline-none focus:border-slate-400"
              />
              <textarea
                rows={2}
                value={simBody}
                onChange={(e) => setSimBody(e.target.value)}
                placeholder="Customer message body..."
                className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-900 text-[11px] focus:outline-none focus:border-slate-400"
              />
              <button
                type="submit"
                disabled={simulating}
                className="w-full py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-[11px] transition shadow-xs"
              >
                {simulating ? 'Processing Webhook...' : 'Simulate Inbound WhatsApp'}
              </button>
            </form>
          </div>
        </div>

        {/* Right: Active Message Thread */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 flex flex-col h-[650px] overflow-hidden shadow-xs">
          {/* Thread Header */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            {selectedContact ? (
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center font-bold text-white text-sm">
                  {selectedContact.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{selectedContact.name}</h3>
                  <span className="text-[11px] text-slate-500 flex items-center space-x-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{selectedContact.phone || 'No phone'}</span>
                  </span>
                </div>
              </div>
            ) : (
              <span className="text-slate-400 text-xs">Select a contact</span>
            )}

            {selectedContact?.isOptedOut && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                Opted Out (Replies Blocked)
              </span>
            )}
          </div>

          {/* Messages Bubble View */}
          <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50/50">
            {activeConversation?.messages && activeConversation.messages.length > 0 ? (
              activeConversation.messages.map((m: any) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.direction === 'outbound' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[70%] p-3.5 rounded-xl text-xs leading-relaxed ${
                      m.direction === 'outbound'
                        ? 'bg-slate-900 text-white rounded-br-none shadow-xs'
                        : 'bg-white text-slate-800 rounded-bl-none border border-slate-200 shadow-xs'
                    }`}
                  >
                    <p>{m.body}</p>
                  </div>
                  <div className="flex items-center space-x-1 text-[10px] text-slate-400 mt-1">
                    <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span>·</span>
                    <span className="capitalize">{m.status}</span>
                    {m.direction === 'outbound' && <CheckCheck className="w-3 h-3 text-slate-500" />}
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs space-y-1">
                <MessageSquare className="w-8 h-8 text-slate-300" />
                <p>No messages in this conversation thread.</p>
                <p className="text-[11px] text-slate-400">Send an outbound message or simulate an inbound message.</p>
              </div>
            )}
          </div>

          {/* Reply Form */}
          <div className="p-4 bg-white border-t border-slate-200">
            {selectedContact?.isOptedOut ? (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>
                  Carrier regulations prohibit outbound messaging to this contact. Customer must message "START" or "UNSTOP" to resume.
                </span>
              </div>
            ) : (
              <form onSubmit={handleSendReply} className="flex gap-2">
                <input
                  type="text"
                  required
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type an official WhatsApp reply... (qualifies as lead acknowledgement)"
                  className="flex-1 px-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={sending}
                  className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs shadow-xs transition flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sending ? 'Sending...' : 'Send'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
