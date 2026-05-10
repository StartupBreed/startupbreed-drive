'use client';
import { useState } from 'react';

export default function KPIRecruiterManager({ recruiters, onChanged }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [deletingName, setDeletingName] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) return showToast('error', 'Name is required.');
    setAdding(true);
    try {
      const res = await fetch('/api/kpi/recruiters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast('success', `${name.trim()} added.`);
      setName('');
      setEmail('');
      onChanged();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (recruiterName) => {
    if (!confirm(`Remove "${recruiterName}" from the recruiter list?\n\nExisting KPI data will be preserved.`)) return;
    setDeletingName(recruiterName);
    try {
      const res = await fetch('/api/kpi/recruiters', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: recruiterName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast('success', `${recruiterName} removed.`);
      onChanged();
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setDeletingName(null);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      {/* Current recruiters */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">Active Recruiters</h3>
        </div>
        {recruiters.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">No recruiters yet.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {recruiters.map(r => (
              <li key={r.name} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-800">{r.name}</p>
                  {r.email && <p className="text-xs text-gray-400">{r.email}</p>}
                </div>
                <button
                  onClick={() => handleDelete(r.name)}
                  disabled={deletingName === r.name}
                  className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors disabled:opacity-50"
                >
                  {deletingName === r.name ? 'Removing…' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add recruiter form */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Add Recruiter</h3>
        <form onSubmit={handleAdd} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Jane Smith"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gmail <span className="text-gray-400 font-normal">(for auto-match on login)</span></label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="jane@gmail.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="w-full bg-brand-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            {adding ? 'Adding…' : 'Add Recruiter'}
          </button>
        </form>
      </div>

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
