'use client';
import { useState } from 'react';

export default function GenerateIntakeModal({ folder, onClose, onDone }) {
  const [form, setForm] = useState({
    companyName: folder.name,
    website: '',
    linkedin: '',
    additionalNote: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/generate/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, folderId: folder.id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Generation failed');
      onDone(data.file);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={!loading ? onClose : undefined} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
              <SparkleIcon /> Generate Client Intake
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{folder.name}</p>
          </div>
          {!loading && (
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
              <XIcon />
            </button>
          )}
        </div>

        <div className="px-6 py-5 space-y-4">
          <Field label="Company Name">
            <input type="text" value={form.companyName} onChange={set('companyName')} className={inputCls} />
          </Field>
          <Field label="Website">
            <input type="text" value={form.website} onChange={set('website')} placeholder="https://example.com" className={inputCls} />
          </Field>
          <Field label="LinkedIn">
            <input type="text" value={form.linkedin} onChange={set('linkedin')} placeholder="https://linkedin.com/company/..." className={inputCls} />
          </Field>
          <Field label="Additional Note (optional)">
            <textarea value={form.additionalNote} onChange={set('additionalNote')} rows={3} placeholder="Any extra context for Claude..." className={inputCls + ' resize-none'} />
          </Field>

          {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          {loading && (
            <div className="flex items-center gap-3 bg-brand-50 border border-brand-100 rounded-xl px-4 py-3">
              <Spinner />
              <div>
                <p className="text-sm font-medium text-brand-700">Generating Client Intake…</p>
                <p className="text-xs text-brand-500">This takes about 30–60 seconds</p>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} disabled={loading} className="btn-secondary">Cancel</button>
          <button onClick={handleGenerate} disabled={loading || !form.companyName} className="btn-primary flex items-center gap-2">
            <SparkleIcon />
            {loading ? 'Generating…' : 'Generate'}
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

function SparkleIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
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

function Spinner() {
  return (
    <svg className="w-5 h-5 animate-spin text-brand-600" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}
