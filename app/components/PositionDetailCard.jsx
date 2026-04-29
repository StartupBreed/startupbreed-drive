'use client';
import { useState } from 'react';
import StatusBadge from './StatusBadge';
import PositionModal from './PositionModal';

export default function PositionDetailCard({ folder, onUpdated }) {
  const [modalOpen, setModalOpen] = useState(false);
  const p = folder.properties || {};

  const handleSaved = (updated) => {
    onUpdated(updated);
    setModalOpen(false);
  };

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Position</p>
            <h2 className="text-lg font-bold text-gray-900">{folder.name}</h2>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <StatusBadge status={p.status || 'active'} />
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 transition-colors"
            >
              <PencilIcon />
              Edit details
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
          <DetailField label="Manager" value={p.manager} />
          <DetailField label="Support" value={p.support} />
          <DetailField label="Seniority" value={p.seniority} />
          <DetailField label="Location" value={p.location} />
          <DetailField label="Salary Range (THB)" value={p.salaryRange} />
          <DetailField label="Commission" value={p.commissionFormatted || (p.commission ? `${p.commission}%` : null)} />
        </div>
      </div>

      {modalOpen && (
        <PositionModal
          file={folder}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}

function DetailField({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-gray-800 font-medium">{value || <span className="text-gray-300">—</span>}</p>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  );
}
