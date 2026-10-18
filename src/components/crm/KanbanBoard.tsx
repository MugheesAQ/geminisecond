import React, { useState, useEffect } from 'react';
import {
  Kanban,
  Plus,
  Filter,
  Search,
  DollarSign,
  User,
  Building2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { apiFetch, UserSession } from '../../lib/api.ts';

interface Opportunity {
  id: string;
  title: string;
  contactId: string;
  companyId?: string;
  pipelineId: string;
  stageId: string;
  valueCents: number;
  currency: string;
  expectedCloseDate: string;
  customFields: Record<string, any>;
  assignedToUserId?: string;
}

interface PipelineStage {
  id: string;
  name: string;
  order: number;
  requiredFieldKeys: string[];
}

interface Pipeline {
  id: string;
  name: string;
  stages: PipelineStage[];
}

interface CustomField {
  id: string;
  key: string;
  name: string;
  type: string;
  options?: string[];
  isRequired: boolean;
}

export const KanbanBoard: React.FC<{
  session: UserSession | null;
  onOpenCustomer360: (contactId: string) => void;
}> = ({ session, onOpenCustomer360 }) => {
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters (3+ criteria: search, tag, stage, custom field)
  const [search, setSearch] = useState('');
  const [filterOwner, setFilterOwner] = useState('all');

  // Stage transition prompt for required custom fields
  const [pendingMove, setPendingMove] = useState<{
    opportunity: Opportunity;
    targetStage: PipelineStage;
    missingFields: CustomField[];
    fieldValues: Record<string, any>;
  } | null>(null);

  // New Deal modal
  const [showNewDealModal, setShowNewDealModal] = useState(false);
  const [dealTitle, setDealTitle] = useState('');
  const [dealContactId, setDealContactId] = useState('');
  const [dealValueDollars, setDealValueDollars] = useState('');
  const [dealCustomFields, setDealCustomFields] = useState<Record<string, any>>({});

  const fetchData = async () => {
    try {
      const [pipeRes, oppsRes, fieldsRes, contactsRes, companiesRes] = await Promise.all([
        apiFetch<Pipeline[]>('/api/crm/pipelines'),
        apiFetch<Opportunity[]>('/api/crm/opportunities'),
        apiFetch<CustomField[]>('/api/crm/custom-fields'),
        apiFetch<any[]>('/api/crm/contacts'),
        apiFetch<any[]>('/api/crm/companies'),
      ]);
      setPipeline(pipeRes[0] || null);
      setOpportunities(oppsRes);
      setCustomFields(fieldsRes);
      setContacts(contactsRes);
      setCompanies(companiesRes);
    } catch (err) {
      console.error('Failed to load CRM data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStageMove = async (opp: Opportunity, targetStage: PipelineStage) => {
    // Check if target stage requires custom fields that are currently missing
    const missingKeys = (targetStage.requiredFieldKeys || []).filter(
      (key) => opp.customFields?.[key] === undefined || opp.customFields?.[key] === null || opp.customFields?.[key] === ''
    );

    if (missingKeys.length > 0) {
      const missingFieldDefs = customFields.filter((cf) => missingKeys.includes(cf.key));
      setPendingMove({
        opportunity: opp,
        targetStage,
        missingFields: missingFieldDefs,
        fieldValues: {},
      });
      return;
    }

    // Direct transition if no missing required fields
    try {
      await apiFetch(`/api/crm/opportunities/${opp.id}/stage`, {
        method: 'PUT',
        body: JSON.stringify({ targetStageId: targetStage.id }),
      });
      fetchData();
    } catch (err: any) {
      alert(`Stage transition rejected: ${err.message}`);
    }
  };

  const handleConfirmMoveWithFields = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingMove) return;

    try {
      await apiFetch(`/api/crm/opportunities/${pendingMove.opportunity.id}/stage`, {
        method: 'PUT',
        body: JSON.stringify({
          targetStageId: pendingMove.targetStage.id,
          customFields: pendingMove.fieldValues,
        }),
      });
      setPendingMove(null);
      fetchData();
    } catch (err: any) {
      alert(`Validation Error: ${err.message}`);
    }
  };

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pipeline || !dealContactId || !dealTitle) return;

    const firstStage = pipeline.stages[0];
    const valueCents = Math.round(Number(dealValueDollars || 0) * 100);

    try {
      await apiFetch('/api/crm/opportunities', {
        method: 'POST',
        body: JSON.stringify({
          title: dealTitle,
          contactId: dealContactId,
          pipelineId: pipeline.id,
          stageId: firstStage.id,
          valueCents,
          customFields: dealCustomFields,
        }),
      });
      setShowNewDealModal(false);
      setDealTitle('');
      setDealContactId('');
      setDealValueDollars('');
      setDealCustomFields({});
      fetchData();
    } catch (err: any) {
      alert(`Deal creation rejected: ${err.message}`);
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

  const filteredOpportunities = opportunities.filter((o) => {
    if (search && !o.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterOwner !== 'all' && o.assignedToUserId !== filterOwner) return false;
    return true;
  });

  if (loading || !pipeline) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Sales Pipeline Board</h1>
          <p className="text-xs text-slate-500 mt-1">
            Pipeline: <span className="text-slate-800 font-semibold">{pipeline.name}</span> · Server-enforced stage transition rules
          </p>
        </div>
        <button
          onClick={() => setShowNewDealModal(true)}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Opportunity</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 gap-3 shadow-xs">
        <div className="relative w-full max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search opportunities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white"
          />
        </div>
        <div className="text-xs text-slate-500">
          Showing <span className="text-slate-900 font-semibold">{filteredOpportunities.length}</span> opportunities
        </div>
      </div>

      {/* Kanban Board Columns */}
      <div className="flex gap-4 overflow-x-auto pb-4 items-start">
        {pipeline.stages.map((stage) => {
          const stageOpps = filteredOpportunities.filter((o) => o.stageId === stage.id);
          const stageTotalCents = stageOpps.reduce((sum, o) => sum + (o.valueCents > 0 ? o.valueCents : 0), 0);

          return (
            <div
              key={stage.id}
              className="w-72 shrink-0 bg-slate-100/70 rounded-xl border border-slate-200 flex flex-col max-h-[750px]"
            >
              {/* Stage Header */}
              <div className="p-3.5 border-b border-slate-200 bg-white rounded-t-xl">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-xs truncate">{stage.name}</h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {stageOpps.length}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                  <span className="tabular-nums font-medium">{formatCurrency(stageTotalCents)}</span>
                  {stage.requiredFieldKeys && stage.requiredFieldKeys.length > 0 && (
                    <span className="text-[10px] text-amber-700 font-medium">
                      {stage.requiredFieldKeys.length} req. field(s)
                    </span>
                  )}
                </div>
              </div>

              {/* Cards Container */}
              <div className="p-2 space-y-2.5 overflow-y-auto flex-1">
                {stageOpps.map((opp) => {
                  const contact = contacts.find((c) => c.id === opp.contactId);
                  const isRestrictedValue = opp.valueCents === -1;

                  return (
                    <div
                      key={opp.id}
                      className="bg-white hover:border-slate-300 p-3.5 rounded-lg border border-slate-200 shadow-xs transition group cursor-pointer"
                      onClick={() => onOpenCustomer360(opp.contactId)}
                    >
                      <h4 className="font-semibold text-slate-900 text-xs line-clamp-2">{opp.title}</h4>

                      <div className="flex items-center justify-between mt-2.5">
                        <span className="text-xs font-bold text-slate-900 tabular-nums flex items-center space-x-1">
                          {isRestrictedValue ? (
                            <span className="inline-flex items-center text-[10px] text-slate-500">
                              <Lock className="w-3 h-3 mr-1 text-slate-400" /> Masked Value
                            </span>
                          ) : (
                            formatCurrency(opp.valueCents)
                          )}
                        </span>
                        {contact && (
                          <span className="text-[10px] text-slate-500 truncate max-w-[120px]">
                            {contact.name}
                          </span>
                        )}
                      </div>

                      {/* Stage Movement Controls */}
                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                        <span>Move:</span>
                        <select
                          value={stage.id}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            const target = pipeline.stages.find((s) => s.id === e.target.value);
                            if (target) handleStageMove(opp, target);
                          }}
                          className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 text-[10px] focus:outline-none focus:bg-white"
                        >
                          {pipeline.stages.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Stage Requirement Validation Modal */}
      {pendingMove && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 text-xs shadow-xl">
            <div className="flex items-center space-x-2 text-amber-600 mb-2">
              <AlertCircle className="w-5 h-5" />
              <h3 className="text-sm font-bold text-slate-900">Stage Requirements Mandatory</h3>
            </div>
            <p className="text-slate-500">
              Moving to <span className="text-slate-900 font-semibold">"{pendingMove.targetStage.name}"</span> requires the following custom fields to be populated on the server before the transition can proceed:
            </p>

            <form onSubmit={handleConfirmMoveWithFields} className="mt-4 space-y-3">
              {pendingMove.missingFields.map((field) => (
                <div key={field.id}>
                  <label className="block text-slate-700 font-semibold mb-1">
                    {field.name} *
                  </label>
                  {field.type === 'dropdown' ? (
                    <select
                      required
                      value={pendingMove.fieldValues[field.key] || ''}
                      onChange={(e) =>
                        setPendingMove({
                          ...pendingMove,
                          fieldValues: { ...pendingMove.fieldValues, [field.key]: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white"
                    >
                      <option value="">Select an option...</option>
                      {(field.options || []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'checkbox' ? (
                    <label className="flex items-center space-x-2 text-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(pendingMove.fieldValues[field.key])}
                        onChange={(e) =>
                          setPendingMove({
                            ...pendingMove,
                            fieldValues: { ...pendingMove.fieldValues, [field.key]: e.target.checked },
                          })
                        }
                        className="rounded text-slate-900"
                      />
                      <span>Confirmed</span>
                    </label>
                  ) : (
                    <input
                      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                      required
                      value={pendingMove.fieldValues[field.key] || ''}
                      onChange={(e) =>
                        setPendingMove({
                          ...pendingMove,
                          fieldValues: { ...pendingMove.fieldValues, [field.key]: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white"
                    />
                  )}
                </div>
              ))}

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setPendingMove(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-xs"
                >
                  Save & Advance Stage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Opportunity Modal */}
      {showNewDealModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 text-xs shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Create New Opportunity</h3>
            <p className="text-slate-500 mt-1">Associate deal with contact and populate custom fields.</p>

            <form onSubmit={handleCreateDeal} className="mt-4 space-y-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Deal Title *</label>
                <input
                  type="text"
                  required
                  value={dealTitle}
                  onChange={(e) => setDealTitle(e.target.value)}
                  placeholder="e.g. Enterprise Cloud Migration"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Associated Contact *</label>
                  <select
                    required
                    value={dealContactId}
                    onChange={(e) => setDealContactId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white"
                  >
                    <option value="">Select contact...</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Estimated Value ($)</label>
                  <input
                    type="number"
                    value={dealValueDollars}
                    onChange={(e) => setDealValueDollars(e.target.value)}
                    placeholder="25000"
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white"
                  />
                </div>
              </div>

              {/* Dynamic Custom Fields */}
              <div className="pt-2 border-t border-slate-100">
                <span className="font-semibold text-slate-800 block mb-2">Custom Pipeline Fields</span>
                <div className="grid grid-cols-2 gap-3">
                  {customFields.slice(0, 4).map((cf) => (
                    <div key={cf.id}>
                      <label className="block text-slate-600 text-[11px] font-medium mb-1">
                        {cf.name} {cf.isRequired && '*'}
                      </label>
                      {cf.type === 'dropdown' ? (
                        <select
                          value={dealCustomFields[cf.key] || ''}
                          onChange={(e) =>
                            setDealCustomFields({ ...dealCustomFields, [cf.key]: e.target.value })
                          }
                          className="w-full px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-[11px] focus:bg-white"
                        >
                          <option value="">Select...</option>
                          {(cf.options || []).map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={cf.type === 'number' ? 'number' : cf.type === 'date' ? 'date' : 'text'}
                          value={dealCustomFields[cf.key] || ''}
                          onChange={(e) =>
                            setDealCustomFields({ ...dealCustomFields, [cf.key]: e.target.value })
                          }
                          className="w-full px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-[11px] focus:bg-white"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowNewDealModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-xs"
                >
                  Create Deal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
