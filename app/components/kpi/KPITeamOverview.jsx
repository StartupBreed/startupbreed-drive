'use client';
import { useState, useMemo } from 'react';

// Returns the upcoming Friday for a given Date
function getFriday(from = new Date()) {
  const d = new Date(from);
  const day = d.getDay();
  const offset = day === 6 ? -1 : day === 0 ? -2 : (5 - day);
  d.setDate(d.getDate() + offset);
  return d;
}

function formatDate(d) {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Get the last N fridays (including current week)
function getRecentFridays(n = 8) {
  const fridays = [];
  const base = getFriday();
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() - i * 7);
    fridays.push(formatDate(d));
  }
  return fridays;
}

function getMonthLabel(weekEnding) {
  // weekEnding like "09 May 2025"
  const parts = weekEnding.split(' ');
  if (parts.length === 3) return `${parts[1]} ${parts[2]}`;
  return weekEnding;
}

function kpiCell(value, target) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-gray-400">—</span>;
  }
  const n = Number(value);
  return (
    <span className={`font-semibold ${n >= target ? 'text-green-600' : 'text-red-500'}`}>
      {n}
    </span>
  );
}

export default function KPITeamOverview({ recruiters, entries, targets }) {
  const recentFridays = useMemo(() => getRecentFridays(8), []);
  const [selectedWeek, setSelectedWeek] = useState(recentFridays[0]);
  const [filterMode, setFilterMode] = useState('week'); // 'week' | 'month'

  // Unique months from entries
  const months = useMemo(() => {
    const set = new Set(entries.map(e => getMonthLabel(e.weekEnding)));
    return [...set].sort((a, b) => new Date(b) - new Date(a)).slice(0, 6);
  }, [entries]);

  const [selectedMonth, setSelectedMonth] = useState(months[0] || '');

  // Filtered entries based on mode
  const filteredEntries = useMemo(() => {
    if (filterMode === 'week') {
      return entries.filter(e => e.weekEnding?.toLowerCase() === selectedWeek?.toLowerCase());
    }
    // month mode
    return entries.filter(e => getMonthLabel(e.weekEnding) === selectedMonth);
  }, [entries, filterMode, selectedWeek, selectedMonth]);

  // For month mode: aggregate per recruiter
  const monthAggregated = useMemo(() => {
    if (filterMode !== 'month') return {};
    const agg = {};
    filteredEntries.forEach(e => {
      if (!agg[e.recruiterName]) {
        agg[e.recruiterName] = { presented: 0, interviewed: 0, offers: 0, weeks: 0, impediments: [] };
      }
      agg[e.recruiterName].presented   += Number(e.presented || 0);
      agg[e.recruiterName].interviewed += Number(e.interviewed || 0);
      agg[e.recruiterName].offers      += Number(e.offers || 0);
      agg[e.recruiterName].weeks       += 1;
      if (e.impediment) agg[e.recruiterName].impediments.push(e.impediment);
    });
    return agg;
  }, [filteredEntries, filterMode]);

  const entryMap = useMemo(() => {
    const m = {};
    filteredEntries.forEach(e => { m[e.recruiterName?.toLowerCase()] = e; });
    return m;
  }, [filteredEntries]);

  const monthTargets = useMemo(() => {
    if (filterMode !== 'month') return targets;
    // How many weeks in the selected month
    const weeksInMonth = entries
      .filter(e => getMonthLabel(e.weekEnding) === selectedMonth)
      .reduce((acc, e) => {
        acc.add(e.weekEnding);
        return acc;
      }, new Set()).size || 4;
    return {
      presented:  targets.presented  * weeksInMonth,
      interviewed: targets.interviewed * weeksInMonth,
      offers:      targets.offers      * weeksInMonth,
    };
  }, [filterMode, selectedMonth, entries, targets]);

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setFilterMode('week')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${filterMode === 'week' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Week
          </button>
          <button
            onClick={() => setFilterMode('month')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${filterMode === 'month' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Month
          </button>
        </div>

        {filterMode === 'week' ? (
          <select
            value={selectedWeek}
            onChange={e => setSelectedWeek(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {recentFridays.map(f => (
              <option key={f} value={f}>Week ending {f}</option>
            ))}
          </select>
        ) : (
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {months.length ? months.map(m => (
              <option key={m} value={m}>{m}</option>
            )) : <option value="">No data yet</option>}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Recruiter</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">
                Presented <span className="text-gray-400 font-normal">(≥{filterMode === 'month' ? monthTargets.presented : targets.presented})</span>
              </th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">
                Interviewed <span className="text-gray-400 font-normal">(≥{filterMode === 'month' ? monthTargets.interviewed : targets.interviewed})</span>
              </th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">
                Offers <span className="text-gray-400 font-normal">(≥{filterMode === 'month' ? monthTargets.offers : targets.offers})</span>
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Impediment</th>
            </tr>
          </thead>
          <tbody>
            {recruiters.map(r => {
              const key = r.name?.toLowerCase();
              if (filterMode === 'week') {
                const e = entryMap[key];
                if (!e) {
                  return (
                    <tr key={r.name} className="border-b border-gray-50">
                      <td className="px-4 py-3 text-gray-700">{r.name}</td>
                      <td className="px-4 py-3 text-center text-gray-400">—</td>
                      <td className="px-4 py-3 text-center text-gray-400">—</td>
                      <td className="px-4 py-3 text-center text-gray-400">—</td>
                      <td className="px-4 py-3 text-xs text-gray-400 italic">Not submitted</td>
                    </tr>
                  );
                }
                return (
                  <tr key={r.name} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-700">{r.name}</td>
                    <td className="px-4 py-3 text-center">{kpiCell(e.presented, targets.presented)}</td>
                    <td className="px-4 py-3 text-center">{kpiCell(e.interviewed, targets.interviewed)}</td>
                    <td className="px-4 py-3 text-center">{kpiCell(e.offers, targets.offers)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{e.impediment || '—'}</td>
                  </tr>
                );
              } else {
                // Month mode
                const agg = monthAggregated[r.name];
                if (!agg) {
                  return (
                    <tr key={r.name} className="border-b border-gray-50">
                      <td className="px-4 py-3 text-gray-700">{r.name}</td>
                      <td className="px-4 py-3 text-center text-gray-400">—</td>
                      <td className="px-4 py-3 text-center text-gray-400">—</td>
                      <td className="px-4 py-3 text-center text-gray-400">—</td>
                      <td className="px-4 py-3 text-xs text-gray-400 italic">Not submitted</td>
                    </tr>
                  );
                }
                return (
                  <tr key={r.name} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-700">{r.name}</td>
                    <td className="px-4 py-3 text-center">{kpiCell(agg.presented, monthTargets.presented)}</td>
                    <td className="px-4 py-3 text-center">{kpiCell(agg.interviewed, monthTargets.interviewed)}</td>
                    <td className="px-4 py-3 text-center">{kpiCell(agg.offers, monthTargets.offers)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {agg.impediments.length ? agg.impediments.join('; ') : '—'}
                    </td>
                  </tr>
                );
              }
            })}
          </tbody>
        </table>

        {recruiters.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">
            No recruiters found. Add recruiters in the Manage tab.
          </div>
        )}
      </div>
    </div>
  );
}
