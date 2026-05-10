'use client';

function kpiIcon(value, target) {
  if (value === null || value === undefined || value === '') return <span className="text-gray-400">—</span>;
  return value >= target
    ? <span className="text-green-600 font-semibold">{value} ✅</span>
    : <span className="text-red-500 font-semibold">{value} ❌</span>;
}

function avg(arr) {
  const nums = arr.filter(v => v !== null && v !== undefined && v !== '');
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + Number(b), 0) / nums.length) * 10) / 10;
}

export default function KPIMyPerformance({ session, recruiters, entries, targets }) {
  const userEmail = session?.user?.email || '';

  // Find current user's recruiter record
  const myRecruiter = recruiters.find(
    r => r.email?.toLowerCase() === userEmail.toLowerCase()
  );

  const myEntries = myRecruiter
    ? entries
        .filter(e => e.recruiterName?.toLowerCase() === myRecruiter.name.toLowerCase())
        .sort((a, b) => {
          // Sort by weekEnding descending (most recent first)
          return new Date(b.weekEnding) - new Date(a.weekEnding);
        })
    : [];

  if (!myRecruiter) {
    return (
      <div className="text-center py-16 text-gray-400 text-sm">
        Your email ({userEmail}) is not linked to any recruiter.<br />
        Ask an admin to add you in the Manage tab.
      </div>
    );
  }

  if (!myEntries.length) {
    return (
      <div className="text-center py-16 text-gray-400 text-sm">
        No entries yet — submit your first week above.
      </div>
    );
  }

  const avgPresented  = avg(myEntries.map(e => e.presented));
  const avgInterviewed = avg(myEntries.map(e => e.interviewed));
  const avgOffers     = avg(myEntries.map(e => e.offers));

  // KPI hit rate: % of weeks where ALL 3 targets were met
  const hitRate = Math.round(
    (myEntries.filter(e =>
      Number(e.presented) >= targets.presented &&
      Number(e.interviewed) >= targets.interviewed &&
      Number(e.offers) >= targets.offers
    ).length / myEntries.length) * 100
  );

  return (
    <div>
      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Avg Presented',   value: avgPresented,   target: targets.presented },
          { label: 'Avg Interviewed', value: avgInterviewed, target: targets.interviewed },
          { label: 'Avg Offers',      value: avgOffers,      target: targets.offers },
          { label: 'KPI Hit Rate',    value: hitRate !== null ? `${hitRate}%` : '—', target: null },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${
              s.target !== null
                ? (s.value >= s.target ? 'text-green-600' : 'text-red-500')
                : 'text-brand-700'
            }`}>
              {s.value ?? '—'}
            </div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* History table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Week Ending</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Presented <span className="text-gray-400 font-normal">(≥{targets.presented})</span></th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Interviewed <span className="text-gray-400 font-normal">(≥{targets.interviewed})</span></th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Offers <span className="text-gray-400 font-normal">(≥{targets.offers})</span></th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Impediment</th>
            </tr>
          </thead>
          <tbody>
            {myEntries.map((e, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-gray-700">{e.weekEnding}</td>
                <td className="px-4 py-3 text-center">{kpiIcon(e.presented, targets.presented)}</td>
                <td className="px-4 py-3 text-center">{kpiIcon(e.interviewed, targets.interviewed)}</td>
                <td className="px-4 py-3 text-center">{kpiIcon(e.offers, targets.offers)}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{e.impediment || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
