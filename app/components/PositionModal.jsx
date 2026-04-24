'use client';
import { useState, useEffect } from 'react';

const SENIORITY_LEVELS = ['Entry', 'Mid', 'Senior', 'Management', 'Executive'];
const STATUSES = ['active', 'paused', 'inactive', 'closed'];

function formatSalaryRange(min, max) {
  if (!min && !max) return '';
  const minK = min ? Math.round(Number(min) / 1000) : '';
  const maxK = max ? Math.round(Number(max) / 1000) : '';
  if (minK && maxK) return `${minK}K - ${maxK}K`;
  if (minK) return `${minK}K+`;
  return `Up to ${maxK}K`;
}

export default function PositionModal({ file, onClose, onSaved }) {
  const p = file.properties || {};
  const [nicknames, setNicknames] = useState([]);

  useEffect(() => {
    fetch('/api/drive/employees')
      .then((r) => r.json())
      .then((d) => setNicknames((d.employees || []).map((e) => e.nickname).filter(Boolean)));
  }, []);

  const [form, setForm] = useState({
    status: p.status || 'inactive',
    manager: p.manager || '',
    support: p.support || '',
    seniority: p.seniority || '',
    location: p.location || '',
    salaryMin: p.salaryMin || '',
    salaryMax: p.salaryMax || '',
    commission: p.commission || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const salaryDisplay = formatSalaryRange(form.salaryMin, form.salaryMax);
  const commissionDisplay = form.commission ? `${form.commission}%` : '';

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch(`/api/drive/properties/${file.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        salaryRange: salaryDisplay,
        commissionFormatted: commissionDisplay,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      onSaved({ ...file, properties: { ...p, ...form, salaryRange: salaryDisplay, commissionFormatted: commissionDisplay } });
      setTimeout(() => setSaved(false), 2000);
    } else {
      const d = await res.json();
      alert('Save error: ' + d.error);
    }
  };

  // Close on backdrop click or Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Modal header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900 text-lg">{file.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Position details</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <XIcon />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="px-6 py-5 overflow-y-auto space-y-5 flex-1">
          {/* Status */}
          <Field label="Status">
            <select value={form.status} onChange={set('status')} className={inputCls}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
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
            {salaryDisplay && (
              <p className="mt-2 text-sm text-brand-600 font-medium">{salaryDisplay}</p>
            )}
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
            {commissionDisplay && (
              <p className="mt-1 text-sm text-brand-600 font-medium">{commissionDisplay}</p>
            )}
          </Field>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary min-w-[80px]">
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}
      </label>
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
