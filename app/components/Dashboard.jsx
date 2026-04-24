'use client';
import { useEffect, useState } from 'react';

const ROOT_ID = '1dOAe4OwsWtgm0x3l2mZzKsZcK1iR3RuA';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const STATUSES = ['active', 'paused', 'inactive', 'closed'];

const statusStyle = {
  active:   'text-green-700 bg-green-50 border-green-200',
  paused:   'text-amber-700 bg-amber-50 border-amber-200',
  inactive: 'text-gray-500 bg-gray-50 border-gray-200',
  closed:   'text-indigo-700 bg-indigo-50 border-indigo-200',
};

export default function Dashboard({ onNavigateTo }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      const clientRes = await fetch(`/api/drive/files?folderId=${ROOT_ID}`);
      const clientData = await clientRes.json();
      const clients = (clientData.files || []).filter((f) => f.mimeType === FOLDER_MIME);

      const results = await Promise.all(
        clients.map(async (client) => {
          const res = await fetch(`/api/drive/files?folderId=${client.id}`);
          const data = await res.json();
          const positions = (data.files || []).filter((f) => f.mimeType === FOLDER_MIME);
          return positions.map((p) => ({ ...p, clientId: client.id, clientName: client.name }));
        })
      );
      setRows(results.flat());
      setLoading(false);
    }
    load();
  }, []);

  const handleStatusChange = async (rowId, newStatus) => {
    setUpdating((prev) => ({ ...prev, [rowId]: true }));
    setRows((prev) =>
      prev.map((r) => r.id === rowId
        ? { ...r, properties: { ...(r.properties || {}), status: newStatus } }
        : r
      )
    );
    await fetch(`/api/drive/properties/${rowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    setUpdating((prev) => ({ ...prev, [rowId]: false }));
  };

  const pipeline = rows.filter((r) => ['active', 'paused'].includes(r.properties?.status || 'inactive'));
  const closed   = rows.filter((r) => (r.properties?.status || 'inactive') === 'closed');
  const active   = rows.filter((r) => (r.properties?.status || 'inactive') === 'active');
  const paused   = rows.filter((r) => (r.properties?.status || 'inactive') === 'paused');

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Active"  value={loading ? '—' : active.length}  dot="bg-green-500" />
        <StatCard label="Paused"  value={loading ? '—' : paused.length}  dot="bg-amber-500" />
        <StatCard label="Closed"  value={loading ? '—' : closed.length}  dot="bg-indigo-500" />
        <StatCard label="Avg Commission" value={loading ? '—' : avgCommission(active)} dot="bg-purple-400" />
      </div>

      {/* Active + Paused pipeline */}
      <PositionSection
        title="Pipeline"
        dot="bg-green-500"
        badgeClass="bg-blue-100 text-blue-700"
        rows={pipeline}
        loading={loading}
        emptyMsg="No active or paused positions."
        updating={updating}
        onStatusChange={handleStatusChange}
        onNavigateTo={onNavigateTo}
      />

      {/* Closed */}
      <PositionSection
        title="Closed"
        dot="bg-indigo-500"
        badgeClass="bg-indigo-100 text-indigo-700"
        rows={closed}
        loading={loading}
        emptyMsg="No closed positions yet."
        updating={updating}
        onStatusChange={handleStatusChange}
        onNavigateTo={onNavigateTo}
        defaultCollapsed
        pageSize={10}
      />
    </div>
  );
}

function PositionSection({ title, dot, badgeClass, rows, loading, emptyMsg, updating, onStatusChange, onNavigateTo, defaultCollapsed = false, pageSize = null }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [limit, setLimit] = useState(pageSize || Infinity);
  const visibleRows = pageSize ? rows.slice(0, limit) : rows;
  const hasMore = pageSize && rows.length > limit;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Section header — clickable to collapse */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full px-5 py-4 border-b border-gray-100 flex items-center gap-2 hover:bg-gray-50 transition-colors"
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
        <h2 className="font-semibold text-gray-900">{title} Positions</h2>
        {!loading && (
          <span className={`ml-1 text-xs px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>
            {rows.length}
          </span>
        )}
        <svg
          className={`w-4 h-4 text-gray-400 ml-auto transition-transform ${collapsed ? '' : 'rotate-180'}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {!collapsed && (
        loading ? <TableSkeleton /> :
        rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">{emptyMsg}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-5 py-3">Client</th>
                  <th className="text-left px-5 py-3">Position</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">Manager</th>
                  <th className="text-left px-5 py-3">Support</th>
                  <th className="text-left px-5 py-3">Seniority</th>
                  <th className="text-left px-5 py-3">Location</th>
                  <th className="text-left px-5 py-3">Salary Range (THB)</th>
                  <th className="text-left px-5 py-3">Commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleRows.map((row) => {
                  const p = row.properties || {};
                  const status = p.status || 'inactive';
                  return (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => onNavigateTo([
                            { id: ROOT_ID, name: 'Clients' },
                            { id: row.clientId, name: row.clientName },
                          ])}
                          className="font-medium text-brand-600 hover:underline"
                        >
                          {row.clientName}
                        </button>
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => onNavigateTo([
                            { id: ROOT_ID, name: 'Clients' },
                            { id: row.clientId, name: row.clientName },
                            { id: row.id, name: row.name },
                          ])}
                          className="font-medium text-brand-600 hover:underline"
                        >
                          {row.name}
                        </button>
                      </td>
                      <td className="px-5 py-3.5">
                        <select
                          value={status}
                          disabled={updating[row.id]}
                          onChange={(e) => onStatusChange(row.id, e.target.value)}
                          className={`text-xs border rounded-lg px-2.5 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 cursor-pointer ${statusStyle[status]}`}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">{p.manager || <Dash />}</td>
                      <td className="px-5 py-3.5 text-gray-700">{p.support || <Dash />}</td>
                      <td className="px-5 py-3.5">
                        {p.seniority
                          ? <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-full">{p.seniority}</span>
                          : <Dash />}
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">{p.location || <Dash />}</td>
                      <td className="px-5 py-3.5 text-gray-700 font-medium">{p.salaryRange || <Dash />}</td>
                      <td className="px-5 py-3.5 text-gray-700">{p.commission ? `${p.commission}%` : <Dash />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Load more */}
      {!collapsed && hasMore && (
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-400">Showing {limit} of {rows.length}</span>
          <button
            onClick={() => setLimit((v) => v + pageSize)}
            className="text-xs text-brand-600 hover:text-brand-700 font-medium hover:underline"
          >
            Load {Math.min(pageSize, rows.length - limit)} more
          </button>
        </div>
      )}
    </div>
  );
}

function avgCommission(rows) {
  const vals = rows.map((r) => Number(r.properties?.commission)).filter(Boolean);
  if (!vals.length) return '—';
  return `${Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)}%`;
}

function StatCard({ label, value, dot }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-4 flex items-center gap-3">
      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`} />
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="px-5 py-4 border-b border-gray-100 flex gap-6">
          {[28, 36, 24, 24, 20, 20, 28, 16].map((w, j) => (
            <div key={j} className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${w * 4}px` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

const Dash = () => <span className="text-gray-300">—</span>;
