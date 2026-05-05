'use client';
import { useState } from 'react';

export default function GenerateICPModal({ folder, clientFolder, files, onClose, onDone }) {
  const [additionalNote, setAdditionalNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check which source docs are present in the current files list
  // CI lives in the client folder — we can't directly check it from `files` (position folder files),
  // so we accept it as always present and let the API handle missing gracefully.
  const hasIntake = true; // checked server-side from client folder
  const hasPrehunt = files.some((f) => f.properties?.documentType === 'prehunt');
  const hasJD = files.some((f) => f.properties?.documentType === 'jd');

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/generate/icp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positionFolderId: folder.id,
          clientFolderId: clientFolder.id,
          positionName: folder.name,
          companyName: clientFolder.name,
          additionalNote,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Generation failed');
      onDone(data);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={!loading ? onClose : undefined} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
              <SparkleIcon /> Generate ICP
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{clientFolder.name} → {folder.name}</p>
          </div>
          {!loading && (
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
              <XIcon />
            </button>
          )}
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Source doc readiness */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Source Documents</p>
            <div className="space-y-1.5">
              <DocStatus label="Client Intake" present={hasIntake} note="from client folder" />
              <DocStatus label="Pre-Hunt" present={hasPrehunt} />
              <DocStatus label="Job Description" present={hasJD} />
            </div>
            {(!hasPrehunt || !hasJD) && (
              <p className="text-xs text-amber-600 mt-2">
                Missing documents will be noted in the prompt — generation will still proceed.
              </p>
            )}
          </div>

          {/* Optional note */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Additional Context <span className="font-normal normal-case text-gray-400">(optional)</span>
            </label>
            <textarea
              value={additionalNote}
              onChange={(e) => setAdditionalNote(e.target.value)}
              rows={3}
              placeholder="Any specific sourcing instructions, must-have criteria, or context for the AI…"
              disabled={loading}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white resize-none disabled:opacity-50"
            />
          </div>

          {/* Info banner */}
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
            <InfoIcon />
            <span>The ICP will be generated from your finalized documents and saved as a Google Doc in this position folder.</span>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          {loading && (
            <div className="flex items-center gap-3 bg-brand-50 border border-brand-100 rounded-xl px-4 py-3">
              <Spinner />
              <div>
                <p className="text-sm font-medium text-brand-700">Generating ICP…</p>
                <p className="text-xs text-brand-500">This takes about 30–60 seconds</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <SparkleIcon />
            {loading ? 'Generating…' : 'Generate ICP'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DocStatus({ label, present, note }) {
  return (
    <div className="flex items-center gap-2">
      {present ? (
        <span className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-2.5 h-2.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </span>
      ) : (
        <span className="w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-2.5 h-2.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v4m0 4h.01" />
          </svg>
        </span>
      )}
      <span className={`text-sm ${present ? 'text-gray-700' : 'text-amber-700'}`}>
        {label}
        {note && <span className="text-gray-400 text-xs ml-1">({note})</span>}
        {!present && <span className="text-amber-500 text-xs ml-1">(missing)</span>}
      </span>
    </div>
  );
}

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

function InfoIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
