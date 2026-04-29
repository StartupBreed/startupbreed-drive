'use client';
import { useState, useEffect } from 'react';

const SENIORITY_LEVELS = ['Entry', 'Mid', 'Senior', 'Management', 'Executive'];

function formatSalaryRange(min, max) {
  if (!min && !max) return '';
  const minK = min ? Math.round(Number(min) / 1000) : '';
  const maxK = max ? Math.round(Number(max) / 1000) : '';
  if (minK && maxK) return `${minK}K - ${maxK}K`;
  if (minK) return `${minK}K+`;
  return `Up to ${maxK}K`;
}

export default function NewPositionModal({ parentFolderId, onClose, onCreated }) {
  const [nicknames, setNicknames] = useState([]);
  const [form, setForm] = useState({
    name: '',
    status: 'active',
    manager: '',
    support: '',
    seniority: '',
    location: '',
    salaryMin: '',
    salaryMax: '',
    commission: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/drive/employees')
      .then((r) => r.json())
      .then((d) => setNicknames((d.employees || []).map((e) => e.nickname).filter(Boolean)));
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  const salaryDisplay = formatSalaryRange(form.salaryMin, form.salaryMax);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      // 1. Create the folder
      const folderRes = await fetch('/api/drive/folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), parentId: parentFolderId }),
      });
      const folderData = await folderRes.json();
      if (!folderRes.ok || folderData.error) throw new Error(folderData.error || 'Failed to create position');

      // 2. Save properties immediately
      const { name, salaryMin, salaryMax, ...props } = form;
      await fetch(`/api/drive/properties/${folderData.file.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...props,
          salaryMin,
          salaryMax,
          salaryRange: salaryDisplay,
          commissionFormatted: form.commission ? `${form.commission}%` : '',
        }),
      });

      onCreated();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={!saving ? onClose : undefined} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900 text-lg">New Position</h2>
            <p className="text-xs text-gray-400 mt-0.5">Fill in the details to get started</p>
          </div>
          {!saving && (
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <XIcon />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-5 flex-1">
          {/* Position name */}
          <Field label="Position Name *">
            <input
              type="text"
              value={form.name}
              onChange={set('name')}
              placeholder="e.g. Senior Software Engineer"
              autoFocus
              className={inputCls}
            />
          </Field>

          {/* Status */}
          <Field label="Status">
            <select value={form.status} onChange={set('status')} className={inputCls}>
              <option value="active">Active</option>
              <option value="on-hold">On Hold</option>
              <option value="closed">Closed</option>
            </select>
          </Field>

          {/* Recruiters */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Manager (Recruiter)">
              <select value={form.manager} onChange={set('manager')} className={inputCls}>
                <option value="">Select…</option>
                {nicknames.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="Support (Recruiter)">
              <select value={form.support} onChange={set('support')} className={inputCls}>
                <option value="">Select…</option>
                {nicknames.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
          </div>

          {/* Seniority + Location */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Seniority Level">
              <select value={form.seniority} onChange={set('seniority')} className={inputCls}>
                <option value="">Select…</option>
                {SENIORITY_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
            <Field label="Location">
              <input type="text" value={form.location} onChange={set('location')} placeholder="City or Remote" className={inputCls} />
            </Field>
          </div>

          {/* Salary */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Salary Range</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Min (THB)">
                <input type="number" value={form.salaryMin} onChange={set('salaryMin')} placeholder="e.g. 50000" className={inputCls} />
              </Field>
              <Field label="Max (THB)">
                <input type="number" value={form.salaryMax} onChange={set('salaryMax')} placeholder="e.g. 80000" className={inputCls} />
              </Field>
            </div>
            {salaryDisplay && <p className="mt-2 text-sm text-brand-600 font-medium">{salaryDisplay}</p>}
          </div>

          {/* Commission */}
          <Field label="Commission">
            <div className="relative">
              <input
                type="number"
                value={form.commission}
                onChange={set('commission')}
                placeholder="e.g. 15"
                className={inputCls + ' pr-8'}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
            </div>
          </Field>

          {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} disabled={saving} className="btn-secondary">Cancel</button>
          <button onClick={handleCreate} disabled={saving || !form.name.trim()} className="btn-primary min-w-[100px]">
            {saving ? 'Creating…' : 'Create Position'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white';

function XIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
