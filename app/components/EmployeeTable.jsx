'use client';
import { useEffect, useState } from 'react';

const ROOT_ID = '1dOAe4OwsWtgm0x3l2mZzKsZcK1iR3RuA';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

export default function EmployeeTable() {
  const [employees, setEmployees] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch('/api/drive/employees');
      const data = await res.json();
      setEmployees(data.employees || []);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!employees.length) { setCounts({}); return; }
    async function scan() {
      setScanning(true);
      const clientRes = await fetch(`/api/drive/files?folderId=${ROOT_ID}`);
      const clientData = await clientRes.json();
      const clients = (clientData.files || []).filter((f) => f.mimeType === FOLDER_MIME);

      const allPositions = (await Promise.all(
        clients.map(async (client) => {
          const res = await fetch(`/api/drive/files?folderId=${client.id}`);
          const data = await res.json();
          return (data.files || []).filter((f) => f.mimeType === FOLDER_MIME);
        })
      )).flat();

      const result = {};
      employees.forEach((emp) => {
        const mine = allPositions.filter(
          (p) => p.properties?.manager === emp.nickname || p.properties?.support === emp.nickname
        );
        result[emp.id] = {
          active: mine.filter((p) => p.properties?.status === 'active').length,
          onHold: mine.filter((p) => p.properties?.status === 'on-hold').length,
          closed: mine.filter((p) => p.properties?.status === 'closed').length,
        };
      });
      setCounts(result);
      setScanning(false);
    }
    scan();
  }, [employees]);

  const saveEmployees = async (updated) => {
    setSaving(true);
    await fetch('/api/drive/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employees: updated }),
    });
    setSaving(false);
  };

  const handleAdd = async () => {
    const name = newName.trim();
    const nickname = newNickname.trim();
    if (!name || !nickname) return;
    const updated = [...employees, { id: Date.now().toString(), name, nickname }];
    setEmployees(updated);
    setNewName('');
    setNewNickname('');
    setAdding(false);
    await saveEmployees(updated);
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this employee?')) return;
    const updated = employees.filter((e) => e.id !== id);
    setEmployees(updated);
    await saveEmployees(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {adding ? (
          <>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Full name"
              autoFocus
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-44"
            />
            <input
              type="text"
              value={newNickname}
              onChange={(e) => setNewNickname(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
              placeholder="Nickname"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-36"
            />
            <button onClick={handleAdd} disabled={saving || !newName.trim() || !newNickname.trim()} className="btn-primary">
              {saving ? 'Saving…' : 'Add'}
            </button>
            <button onClick={() => { setAdding(false); setNewName(''); setNewNickname(''); }} className="btn-secondary">Cancel</button>
          </>
        ) : (
          <button onClick={() => setAdding(true)} className="btn-secondary">
            <PlusIcon /> Add employee
          </button>
        )}
        {scanning && <span className="text-xs text-gray-400 ml-2">Scanning positions…</span>}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <TableSkeleton />
        ) : employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-gray-500 font-medium">No employees yet</p>
            <p className="text-gray-400 text-sm mt-1">Add a recruiter to start tracking.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3">Full Name</th>
                <th className="text-left px-5 py-3">Nickname</th>
                <th className="text-left px-5 py-3">Active</th>
                <th className="text-left px-5 py-3">On Hold</th>
                <th className="text-left px-5 py-3">Closed</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employees.map((emp) => {
                const c = counts[emp.id];
                return (
                  <tr key={emp.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                          {(emp.nickname || emp.name).charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900">{emp.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
                        {emp.nickname || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <CountBadge value={c?.active} scanning={scanning} color="bg-green-50 text-green-700" />
                    </td>
                    <td className="px-5 py-4">
                      <CountBadge value={c?.onHold} scanning={scanning} color="bg-amber-50 text-amber-700" />
                    </td>
                    <td className="px-5 py-4">
                      <CountBadge value={c?.closed} scanning={scanning} color="bg-indigo-50 text-indigo-700" />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => handleDelete(emp.id)}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CountBadge({ value, scanning, color }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold ${color}`}>
      {scanning ? '…' : (value ?? 0)}
    </span>
  );
}

function TableSkeleton() {
  return (
    <div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="px-5 py-4 border-b border-gray-100 flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
          <div className="h-4 bg-gray-100 rounded animate-pulse w-40" />
          <div className="h-4 bg-gray-100 rounded animate-pulse w-20 ml-4" />
          <div className="h-6 bg-gray-100 rounded-full animate-pulse w-12 ml-auto" />
        </div>
      ))}
    </div>
  );
}

function PlusIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
}
function TrashIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
}
