import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Plus,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { apiFetch, UserSession } from '../../lib/api.ts';

interface Payment {
  id: string;
  opportunityId?: string;
  contactId: string;
  createdByUserId: string;
  amountCents: number;
  currency: string;
  description: string;
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';
  stripePaymentLinkId?: string;
  stripeSessionId?: string;
  stripeEventId?: string;
  paidAt?: string;
  refundedAmountCents?: number;
  createdAt: string;
}

export const PaymentsHub: React.FC<{ session: UserSession | null }> = ({ session }) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form
  const [targetContactId, setTargetContactId] = useState('');
  const [targetOppId, setTargetOppId] = useState('');
  const [dollarAmount, setDollarAmount] = useState('');
  const [description, setDescription] = useState('');

  const fetchPayments = async () => {
    try {
      const [contRes, oppsRes] = await Promise.all([
        apiFetch<any[]>('/api/crm/contacts'),
        apiFetch<any[]>('/api/crm/opportunities'),
      ]);
      setContacts(contRes);
      setOpportunities(oppsRes);

      // Collect payments from all contacts
      const paymentsList = await Promise.all(
        contRes.map(async (c) => {
          try {
            const data = await apiFetch(`/api/crm/contacts/${c.id}/360`);
            return data.payments || [];
          } catch {
            return [];
          }
        })
      );

      const flat = Array.from(new Map(paymentsList.flat().map((p) => [p.id, p])).values()) as Payment[];
      setPayments(flat);
    } catch (err) {
      console.error('Failed to load payments:', err);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleCreatePaymentRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = Math.round(Number(dollarAmount) * 100);
    if (!amountCents || amountCents <= 0) {
      alert('Please enter a valid positive dollar amount.');
      return;
    }

    try {
      await apiFetch('/api/integrations/stripe/payment-request', {
        method: 'POST',
        body: JSON.stringify({
          contactId: targetContactId,
          opportunityId: targetOppId || undefined,
          amountCents,
          description,
        }),
      });

      setShowCreateModal(false);
      setTargetContactId('');
      setTargetOppId('');
      setDollarAmount('');
      setDescription('');
      fetchPayments();
    } catch (err: any) {
      alert(`Payment request failed: ${err.message}`);
    }
  };

  // Simulate Stripe Webhook: checkout.session.completed
  const handleSimulatePaymentSuccess = async (payment: Payment) => {
    try {
      await fetch('/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `evt_test_checkout_${Date.now()}`,
          type: 'checkout.session.completed',
          data: {
            object: {
              id: `cs_test_${Date.now()}`,
              client_reference_id: payment.id,
              payment_link: payment.stripePaymentLinkId,
              amount_total: payment.amountCents,
              currency: payment.currency.toLowerCase(),
              payment_status: 'paid',
            },
          },
        }),
      });
      alert('Stripe webhook checkout.session.completed received! Payment reconciled as PAID.');
      fetchPayments();
    } catch (err: any) {
      alert(`Webhook simulation failed: ${err.message}`);
    }
  };

  // Simulate Stripe Webhook: charge.refunded
  const handleSimulateRefund = async (payment: Payment) => {
    try {
      await fetch('/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `evt_test_refund_${Date.now()}`,
          type: 'charge.refunded',
          data: {
            object: {
              id: `ch_test_${Date.now()}`,
              metadata: { paymentId: payment.id },
              amount_refunded: payment.amountCents,
            },
          },
        }),
      });
      alert('Stripe webhook charge.refunded received! Payment reconciled as REFUNDED and deducted from collected revenue.');
      fetchPayments();
    } catch (err: any) {
      alert(`Refund simulation failed: ${err.message}`);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  const totalCollectedCents = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + (p.amountCents - (p.refundedAmountCents || 0)), 0);

  const totalPendingCents = payments
    .filter((p) => p.status === 'pending')
    .reduce((sum, p) => sum + p.amountCents, 0);

  const totalRefundedCents = payments.reduce((sum, p) => sum + (p.refundedAmountCents || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Payments & Revenue Reconciliation</h1>
          <p className="text-xs text-slate-500 mt-1">
            Stripe test-mode checkout sessions, integer-cent currency accounting, and authoritative webhook reconciliation.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Payment Request</span>
        </button>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Net Collected Revenue</span>
          <p className="text-2xl font-extrabold text-slate-900 tabular-nums mt-1">{formatCurrency(totalCollectedCents)}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Authoritative settled charges minus refunds</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Unpaid Payment Requests</span>
          <p className="text-2xl font-extrabold text-amber-700 tabular-nums mt-1">{formatCurrency(totalPendingCents)}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Pending payment links (NOT in collected revenue)</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Confirmed Refunds</span>
          <p className="text-2xl font-extrabold text-rose-700 tabular-nums mt-1">{formatCurrency(totalRefundedCents)}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Subtracted from collected revenue</span>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Invoice / Description</th>
                <th className="px-5 py-3.5">Amount</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Created</th>
                <th className="px-5 py-3.5 text-right">Stripe Sandbox Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => {
                const contact = contacts.find((c) => c.id === p.contactId);
                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900 text-sm">{p.description}</div>
                      <div className="text-[11px] text-slate-500">
                        Client: <span className="text-slate-800 font-medium">{contact?.name || 'Customer'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-900 text-sm tabular-nums">
                      {formatCurrency(p.amountCents)} {p.currency}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase ${
                          p.status === 'paid'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : p.status === 'refunded'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500 text-[11px]">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right space-x-2">
                      {p.status === 'pending' && (
                        <button
                          onClick={() => handleSimulatePaymentSuccess(p)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] transition shadow-xs"
                          title="Simulate Stripe checkout.session.completed webhook"
                        >
                          Simulate Stripe Payment
                        </button>
                      )}
                      {p.status === 'paid' && (
                        <button
                          onClick={() => handleSimulateRefund(p)}
                          className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-semibold text-[11px] transition"
                          title="Simulate Stripe charge.refunded webhook"
                        >
                          Simulate Refund
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Payment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 text-xs shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Create Stripe Payment Request</h3>
            <p className="text-slate-500 mt-1">Generates a Stripe test-mode payment link with server validation.</p>

            <form onSubmit={handleCreatePaymentRequest} className="mt-4 space-y-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Customer / Contact *</label>
                <select
                  required
                  value={targetContactId}
                  onChange={(e) => setTargetContactId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white"
                >
                  <option value="">Select customer...</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Associated Opportunity (Optional)</label>
                <select
                  value={targetOppId}
                  onChange={(e) => setTargetOppId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white"
                >
                  <option value="">None / Standalone Invoice</option>
                  {opportunities.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Amount ($ USD) *</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={dollarAmount}
                  onChange={(e) => setDollarAmount(e.target.value)}
                  placeholder="2500.00"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white"
                />
                <span className="text-[10px] text-slate-500">Stored accurately as positive integer minor units (cents)</span>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Invoice Description *</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Phase 1 Implementation Deposit"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white"
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
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-xs"
                >
                  Create Payment Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
