'use client';
import { useState, useEffect, useCallback } from 'react';
import { can, getUserRole } from '../../lib/kpiPermissions';
import KPISubmitForm from './KPISubmitForm';
import KPIMyPerformance from './KPIMyPerformance';
import KPITeamOverview from './KPITeamOverview';
import KPIRecruiterManager from './KPIRecruiterManager';

export default function KPIView({ session }) {
  const [tab, setTab] = useState('submit');
  const [entries, setEntries] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [targets, setTargets] = useState({ presented: 10, interviewed: 5, offers: 2 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const role = getUserRole(session);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [eRes, rRes, sRes] = await Promise.all([
        fetch('/api/kpi/entries'),
        fetch('/api/kpi/recruiters'),
        fetch('/api/kpi/settings'),
      ]);
      const [eData, rData, sData] = await Promise.all([
        eRes.json(), rRes.json(), sRes.json(),
      ]);
      if (!eRes.ok) throw new Error(eData.error);
      if (!rRes.ok) throw new Error(rData.error);
      if (!sRes.ok) throw new Error(sData.error);
      setEntries(eData.entries || []);
      setRecruiters(rData.recruiters || []);
      setTargets(sData.targets || { presented: 10, interviewed: 5, offers: 2 });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const tabs = [
    { id: 'submit',      label: 'Submit',        show: can(role, 'kpi:submit') },
    { id: 'my',          label: 'My Performance', show: can(role, 'kpi:submit') },
    { id: 'team',        label: 'Team Overview',  show: can(role, 'kpi:view_team') },
    { id: 'manage',      label: 'Manage',         show: can(role, 'kpi:manage_recruiters') },
  ].filter(t => t.show);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">KPI Tracker</h1>
        <p className="text-sm text-gray-500 mt-0.5">Weekly recruiter performance</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {tab === 'submit' && can(role, 'kpi:submit') && (
            <KPISubmitForm
              session={session}
              recruiters={recruiters}
              entries={entries}
              onSaved={fetchAll}
            />
          )}
          {tab === 'my' && can(role, 'kpi:submit') && (
            <KPIMyPerformance
              session={session}
              recruiters={recruiters}
              entries={entries}
              targets={targets}
            />
          )}
          {tab === 'team' && can(role, 'kpi:view_team') && (
            <KPITeamOverview
              recruiters={recruiters}
              entries={entries}
              targets={targets}
            />
          )}
          {tab === 'manage' && can(role, 'kpi:manage_recruiters') && (
            <KPIRecruiterManager
              recruiters={recruiters}
              onChanged={fetchAll}
            />
          )}
        </>
      )}
    </div>
  );
}
