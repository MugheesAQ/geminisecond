import React, { useState, useEffect } from 'react';
import { SlidersHorizontal, Plus, CheckCircle2, ShieldCheck, Tag } from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';

export const PipelineManager: React.FC = () => {
  const [pipeline, setPipeline] = useState<any>(null);
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [showAddField, setShowAddField] = useState(false);

  // Field form
  const [fieldName, setFieldName] = useState('');
  const [fieldKey, setFieldKey] = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [fieldOptions, setFieldOptions] = useState('');
  const [fieldRequired, setFieldRequired] = useState(false);

  const fetchPipelines = async () => {
    try {
      const [pipeRes, fieldsRes] = await Promise.all([
        apiFetch<any[]>('/api/crm/pipelines'),
        apiFetch<any[]>('/api/crm/custom-fields'),
      ]);
      setPipeline(pipeRes[0] || null);
      setCustomFields(fieldsRes);
    } catch (err) {
      console.error('Failed to load pipelines:', err);
    }
  };

  useEffect(() => {
    fetchPipelines();
  }, []);

  const handleCreateField = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const options = fieldOptions
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);

      await apiFetch('/api/crm/custom-fields', {
        method: 'POST',
        body: JSON.stringify({
          name: fieldName,
          key: fieldKey,
          type: fieldType,
          options,
          isRequired: fieldRequired,
          pipelineId: pipeline?.id,
        }),
      });

      setShowAddField(false);
      setFieldName('');
      setFieldKey('');
      setFieldType('text');
      setFieldOptions('');
      setFieldRequired(false);
      fetchPipelines();
    } catch (err: any) {
      alert(`Failed to add custom field: ${err.message}`);
    }
  };

  if (!pipeline) {
    return <div className="p-8 text-center text-slate-400">Loading pipeline configuration...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Sales Pipeline & Custom Fields</h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure sales stages, mandatory stage gates, and dynamic custom fields.
          </p>
        </div>
        <button
          onClick={() => setShowAddField(true)}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Custom Field</span>
        </button>
      </div>

      {/* Pipeline Stages Architecture */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Configured Stages for: {pipeline.name}</h2>
          <p className="text-xs text-slate-500">
            Stages marked with mandatory fields strictly reject movement on the server until validated.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {pipeline.stages.map((stage: any) => (
            <div key={stage.id} className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-xs">
                  {stage.order}. {stage.name}
                </span>
                <span className="text-[10px] text-slate-500">Order #{stage.order}</span>
              </div>

              <div className="pt-2 border-t border-slate-200/60">
                <span className="text-[10px] text-slate-500 font-semibold block mb-1">
                  Required Stage Gates:
                </span>
                {stage.requiredFieldKeys && stage.requiredFieldKeys.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {stage.requiredFieldKeys.map((k: string) => {
                      const fDef = customFields.find((cf) => cf.key === k);
                      return (
                        <span
                          key={k}
                          className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-medium"
                        >
                          {fDef ? fDef.name : k}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-400 italic">No required gates</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dynamic Custom Fields Grid */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900">Dynamic Custom Fields ({customFields.length})</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {customFields.map((cf) => (
            <div key={cf.id} className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">{cf.name}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-200 text-slate-700">
                  {cf.type}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono">key: {cf.key}</p>
              {cf.options && cf.options.length > 0 && (
                <div className="pt-1.5 flex flex-wrap gap-1">
                  {cf.options.map((opt: string) => (
                    <span key={opt} className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 text-[10px]">
                      {opt}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add Custom Field Modal */}
      {showAddField && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 text-xs shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Create Custom Field</h3>
            <p className="text-slate-500 mt-1">Configurable types: text, number, date, dropdown, checkbox.</p>

            <form onSubmit={handleCreateField} className="mt-4 space-y-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Field Display Name *</label>
                <input
                  type="text"
                  required
                  value={fieldName}
                  onChange={(e) => {
                    setFieldName(e.target.value);
                    if (!fieldKey) {
                      setFieldKey(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
                    }
                  }}
                  placeholder="e.g. Contract Signoff Date"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Field Machine Key *</label>
                <input
                  type="text"
                  required
                  value={fieldKey}
                  onChange={(e) => setFieldKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Data Type</label>
                <select
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white"
                >
                  <option value="text">Text String</option>
                  <option value="number">Numeric</option>
                  <option value="date">Date (YYYY-MM-DD)</option>
                  <option value="dropdown">Dropdown Select</option>
                  <option value="checkbox">Boolean Checkbox</option>
                </select>
              </div>

              {fieldType === 'dropdown' && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Options (Comma-separated)</label>
                  <input
                    type="text"
                    value={fieldOptions}
                    onChange={(e) => setFieldOptions(e.target.value)}
                    placeholder="Option A, Option B, Option C"
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white"
                  />
                </div>
              )}

              <label className="flex items-center space-x-2 text-slate-700 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fieldRequired}
                  onChange={(e) => setFieldRequired(e.target.checked)}
                  className="rounded text-slate-900"
                />
                <span>Mandatory for all new opportunity creations</span>
              </label>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddField(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-xs"
                >
                  Save Custom Field
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
