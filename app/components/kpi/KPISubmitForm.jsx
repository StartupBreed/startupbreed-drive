'use client';
import { useState, useEffect } from 'react';

// Returns the upcoming Friday (Mon–Fri → this Friday; Sat/Sun → last Friday)
function getWeekEnding(from = new Date()) {
  const d = new Date(from);
  const day = d.getDay(); // 0=Sun … 6=Sat
  const offset = day === 6 ? -1 : day === 0 ? -2 : (5 - day);
  d.setDate(d.getDate() + offset);
  return d;
}

function formatDate(d) {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
           .replace(/ /g, ' '); // e.g. "09 May 2025"
}

function dateToInput(d) {
  // yyyy-mm-dd for <input type="date">
  return d.toISOString().slice(0, 10);
}

function inputToDisplay(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return formatDate(d);
}

export default function KPISubmitForm({ session, recruiters, entries, onSaved }) {
  const userEmail = session?.user?.email || '';

  // Try to match logged-in user to a recruiter
  const matchedRecruiter = recruiters.find(
    r => r.email?.toLowerCase() === userEmail.toLowerCase()
  );

  const [recruiterName, setRecruiterName] = useState(matchedRecruiter?.name || '');
  const [weekInput, setWeekInput] = useState(dateToInput(getWeekEnding()));
  const [presented, setPresented] = useState('');
  const [interviewed, setInterviewed] = useState('');
  const [offers, setOffers] = useState('');
  const [impediment, setImpediment] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success'|'error', msg }
  const [isEditMode, setIsEditMode] = useState(false);

  const weekDisplay = inputToDisplay(weekInput);

  // Auto-fill when recruiter + week combo already has data
  useEffect(() => {
    if (!recruiterName || !weekDisplay) return;
    const existing = entries.find(
      e => e.recruiterName?.toLowerCase() === recruiterName.toLowerCase() &&
           e.weekEnding?.toLowerCase() === weekDisplay.toLowerCase()
    );
    if (existing) {
      setPresented(existing.presented ?? '');
      setInterviewed(existing.interviewed ?? '');
      setOffers(existing.offers ?? '');
      setImpediment(existing.impediment || '');
      setIsEditMode(true);
    } else {
      setPresented('');
      setInterviewed('');
      setOffers('');
      setImpediment('');
      setIsEditMode(false);
    }
  }, [recruiterName, weekDisplay, entries]);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!recruiterName) return showToast('error', 'Please select a recruiter.');
    setSaving(true);
    try {
      const body = {
        recruiterName,
        presented:   presented !== '' ? Number(presented) : null,
        interviewed: interviewed !== '' ? Number(interviewed) : null,
        offers:      offers !== '' ? Number(offers) : null,
        weekEnding:  weekDisplay,
        impediment,
      };
      const res = await fetch('/api/kpi/entries', {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast('success', isEditMode ? 'Entry updated!' : 'Entry saved!');
      onSaved();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Recruiter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Recruiter</label>
          <select
            value={recruiterName}
            onChange={e => setRecruiterName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Select recruiter…</option>
            {recruiters.map(r => (
              <option key={r.name} value={r.name}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* Week ending */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Week Ending (Friday)
          </label>
          <input
            type="date"
            value={weekInput}
            onChange={e => setWeekInput(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <p className="text-xs text-gray-400 mt-1">{weekDisplay}</p>
        </div>

        {isEditMode && (
          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit mode — updating existing entry for this week
          </div>
        )}

        {/* KPI numbers */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Presented</label>
            <input
              type="number" min="0"
              value={presented}
              onChange={e => setPresented(e.target.value)}
              placeholder="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Interviewed</label>
            <input
              type="number" min="0"
              value={interviewed}
              onChange={e => setInterviewed(e.target.value)}
              placeholder="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Offers</label>
            <input
              type="number" min="0"
              value={offers}
              onChange={e => setOffers(e.target.value)}
              placeholder="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Impediment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Impediment <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={impediment}
            onChange={e => setImpediment(e.target.value)}
            rows={2}
            placeholder="Any blockers this week?"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-brand-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : isEditMode ? 'Update Entry' : 'Save Entry'}
        </button>
      </form>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white transition-all ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
