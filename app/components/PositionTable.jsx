'use client';
import { useState, useEffect } from 'react';
import PositionModal from './PositionModal';
import InlineName from './InlineName';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const STATUSES = ['active', 'paused', 'inactive', 'closed'];

const statusStyle = {
  active:   'text-green-700 bg-green-50 border-green-200',
  paused:   'text-amber-700 bg-amber-50 border-amber-200',
  inactive: 'text-gray-500 bg-gray-50 border-gray-200',
  closed:   'text-indigo-700 bg-indigo-50 border-indigo-200',
};

export default function PositionTable({ files, loading, onOpenFolder, onDelete }) {
  const [localFiles, setLocalFiles] = useState(files);
  const [updating, setUpdating] = useState({});
  const [editingFile, setEditingFile] = useState(null);

  useEffect(() => { setLocalFiles(files); }, [files]);

  const folders = localFiles.filter((f) => f.mimeType === FOLDER_MIME);
  const docs = localFiles.filter((f) => f.mimeType !== FOLDER_MIME);

  const handleStatusChange = async (fileId, newStatus) => {
    setUpdating((prev) => ({ ...prev, [fileId]: true }));
    setLocalFiles((prev) =>
      prev.map((f) => f.id === fileId
        ? { ...f, properties: { ...(f.properties || {}), status: newStatus } }
        : f
      )
    );
    await fetch(`/api/drive/properties/${fileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    setUpdating((prev) => ({ ...prev, [fileId]: false }));
  };

  const handleSaved = (updatedFile) => {
    setLocalFiles((prev) => prev.map((f) => f.id === updatedFile.id ? updatedFile : f));
  };

  if (loading) return <TableSkeleton />;

  return (
    <>
      {editingFile && (
        <PositionModal
          file={editingFile}
          onClose={() => setEditingFile(null)}
          onSaved={(updated) => { handleSaved(updated); setEditingFile(null); }}
        />
      )}

      <div className="space-y-6">
        {/* Positions table — all fields visible */}
        {folders.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-5 py-3">Position</th>
                    <th className="text-left px-5 py-3">Status</th>
                    <th className="text-left px-5 py-3">Manager</th>
                    <th className="text-left px-5 py-3">Support</th>
                    <th className="text-left px-5 py-3">Seniority</th>
                    <th className="text-left px-5 py-3">Location</th>
                    <th className="text-left px-5 py-3">Salary Range (THB)</th>
                    <th className="text-left px-5 py-3">Commission</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {folders.map((folder) => {
                    const p = folder.properties || {};
                    const status = p.status || 'inactive';
                    return (
                      <tr key={folder.id} className="hover:bg-gray-50 transition-colors group">
                        {/* Position name → navigates into folder */}
                        <td className="px-5 py-3.5">
                          <InlineName
                            fileId={folder.id}
                            name={folder.name}
                            onClick={() => onOpenFolder(folder)}
                            className="text-brand-600 hover:text-brand-700"
                          />
                        </td>

                        {/* Status dropdown */}
                        <td className="px-5 py-3.5">
                          <select
                            value={status}
                            disabled={updating[folder.id]}
                            onChange={(e) => handleStatusChange(folder.id, e.target.value)}
                            className={`text-xs border rounded-lg px-2.5 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 cursor-pointer ${statusStyle[status]}`}
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                            ))}
                          </select>
                        </td>

                        <td className="px-5 py-3.5 text-gray-700">{p.manager || <Dash />}</td>
                        <td className="px-5 py-3.5 text-gray-700">{p.support || <Dash />}</td>

                        {/* Seniority pill */}
                        <td className="px-5 py-3.5">
                          {p.seniority
                            ? <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-full">{p.seniority}</span>
                            : <Dash />}
                        </td>

                        <td className="px-5 py-3.5 text-gray-700">{p.location || <Dash />}</td>
                        <td className="px-5 py-3.5 text-gray-700 font-medium">{p.salaryRange || <Dash />}</td>

                        {/* Commission */}
                        <td className="px-5 py-3.5 text-gray-700">
                          {p.commission ? `${p.commission}%` : <Dash />}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setEditingFile(folder)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                              title="Edit details"
                            >
                              <EditIcon />
                            </button>
                            <button
                              onClick={() => { if (confirm(`Move "${folder.name}" to trash?`)) onDelete(folder.id); }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Documents inside the client folder (e.g. Company Intake) */}
        {docs.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Documents</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {docs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-5 py-3.5">
                      <a
                        href={`https://docs.google.com/open?id=${doc.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2.5 font-medium text-gray-900 hover:text-brand-600"
                      >
                        <DocIcon />
                        {doc.name}
                      </a>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => { if (confirm(`Move "${doc.name}" to trash?`)) onDelete(doc.id); }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {folders.length === 0 && docs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-gray-500 font-medium">No positions yet</p>
            <p className="text-gray-400 text-sm mt-1">Click "New position" to get started.</p>
          </div>
        )}
      </div>
    </>
  );
}

const Dash = () => <span className="text-gray-300">—</span>;

function TableSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="px-5 py-4 border-b border-gray-100 flex gap-6">
          {[40, 20, 24, 20, 16, 20, 28, 16].map((w, j) => (
            <div key={j} className={`h-4 bg-gray-100 rounded animate-pulse w-${w}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

function EditIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}
