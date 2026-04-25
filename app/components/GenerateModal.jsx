'use client';
import { useState } from 'react';

const SENIORITY_LEVELS = ['Entry', 'Associate', 'Mid', 'Senior', 'Manager', 'Director', 'Executive'];

export default function GenerateModal({ folder, onClose, onDone }) {
  const [form, setForm] = useState({
    positionName: '',
    seniority: '',
    salaryRange: '',
    website: '',
    linkedin: '',
    additionalNote: '',
  });
  const [status, setStatus] = useState('idle'); // idle | generating | done | error
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleGenerate = async () => {
    if (!form.positionName.trim()) return;
    setStatus('generating');
    setErrorMsg('');

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: folder.name,
          folderId: folder.id,
          ...form,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Unknown error');
      setResult(data.files);
      setStatus('done');
      onDone();
    } catch (err) {
      setErrorMsg(err.message);
      setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={status === 'generating' ? undefined : onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <SparkleIcon />
              <h2 className="font-semibold text-gray-900 text-lg">Generate Documents</h2>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Client: <span className="font-medium text-gray-600">{folder.name}</span></p>
          </div>
          {status !== 'generating' && (
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <XIcon />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
          {status === 'done' ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-700 font-medium">
                <CheckIcon />
                3 documents generated and saved to Drive
              </div>
              {result?.map((f) => (
                <div key={f.id} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  <DocIcon />
                  {f.name}
                </div>
              ))}
            </div>
          ) : status === 'generating' ? (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <div className="w-10 h-10 rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin" />
              <div className="text-center">
                <p className="font-medium text-gray-700">Generating documents…</p>
                <p className="text-sm text-gray-400 mt-1">This takes about 30–60 seconds</p>
              </div>
            </div>
          ) : (
            <>
              {status === 'error' && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {errorMsg}
                </div>
              )}

              <Field label="Position Name *">
                <input
                  type="text"
                  value={form.positionName}
                  onChange={set('positionName')}
                  placeholder="e.g. Data Engineer"
                  className={inputCls}
                  autoFocus
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Seniority Level">
                  <select value={form.seniority} onChange={set('seniority')} className={inputCls}>
                    <option value="">Select…</option>
                    {SENIORITY_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </Field>
                <Field label="Salary Range">
                  <input
                    type="text"
                    value={form.salaryRange}
                    onChange={set('salaryRange')}
                    placeholder="e.g. 80K - 120K"
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Website">
                <input
                  type="text"
                  value={form.website}
                  onChange={set('website')}
                  placeholder="https://company.com"
                  className={inputCls}
                />
              </Field>

              <Field label="LinkedIn">
                <input
                  type="text"
                  value={form.linkedin}
                  onChange={set('linkedin')}
                  placeholder="https://linkedin.com/company/..."
                  className={inputCls}
                />
              </Field>

              <Field label="Additional Note">
                <textarea
                  value={form.additionalNote}
                  onChange={set('additionalNote')}
                  placeholder="Any extra context for Claude…"
                  rows={3}
                  className={inputCls + ' resize-none'}
                />
              </Field>

              <p className="text-xs text-gray-400">
                Will generate: Client Intake, Pre-hunt, and Job Description — saved as .txt files in this client&apos;s folder.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 flex-shrink-0">
          {status === 'done' ? (
            <button onClick={onClose} className="btn-primary">Close</button>
          ) : status === 'generating' ? null : (
            <>
              <button onClick={onClose} className="btn-secondary">Cancel</button>
              <button
                onClick={handleGenerate}
                disabled={!form.positionName.trim()}
                className="btn-primary flex items-center gap-2"
              >
                <SparkleIcon />
                Generate
              </button>
            </>
          )}
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

function SparkleIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l1.5 3.5L10 8l-3.5 1.5L5 13l-1.5-3.5L0 8l3.5-1.5L5 3zm12 9l1 2.5L20.5 15l-2.5 1L17 18.5l-1-2.5L13.5 15l2.5-1L17 12z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
