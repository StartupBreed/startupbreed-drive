'use client';
import { useEffect, useState } from 'react';
import InlineName from './InlineName';

const FOLDER_MIME = 'application/vnd.google-apps.folder';

export default function ClientTable({ files, loading, onOpenFolder, onDelete }) {
  const [positionData, setPositionData] = useState({});

  const folders = files.filter((f) => f.mimeType === FOLDER_MIME);
  const docs = files.filter((f) => f.mimeType !== FOLDER_MIME);

  useEffect(() => {
    folders.forEach(async (folder) => {
      const res = await fetch(`/api/drive/files?folderId=${folder.id}`);
      const data = await res.json();
      if (res.ok) {
        const positions = (data.files || []).filter((f) => f.mimeType === FOLDER_MIME);
        setPositionData((prev) => ({ ...prev, [folder.id]: positions }));
      }
    });
  }, [files]);

  if (loading) return <TableSkeleton />;

  return (
    <div className="space-y-6">
      {/* Client folders table */}
      {folders.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Client</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Positions</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {folders.map((folder) => {
                const positions = positionData[folder.id];
                return (
                  <tr key={folder.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <FolderIcon />
                        <InlineName
                          fileId={folder.id}
                          name={folder.name}
                          onClick={() => onOpenFolder(folder)}
                          className="text-gray-900 hover:text-brand-600"
                        />
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {positions ? `${positions.length} position${positions.length !== 1 ? 's' : ''}` : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => {
                          if (confirm(`Move "${folder.name}" to trash?`)) onDelete(folder.id);
                        }}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                        title="Delete"
                      >
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Loose docs (e.g. Company Intake at root level) */}
      {docs.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Documents</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {docs.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
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
                      onClick={() => {
                        if (confirm(`Move "${doc.name}" to trash?`)) onDelete(doc.id);
                      }}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
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

      {folders.length === 0 && docs.length === 0 && !loading && <EmptyState />}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="px-5 py-4 border-b border-gray-100 flex gap-4">
          <div className="h-4 bg-gray-100 rounded animate-pulse w-48" />
          <div className="h-4 bg-gray-100 rounded animate-pulse w-24" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <svg className="w-14 h-14 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
      </svg>
      <p className="text-gray-500 font-medium">No clients yet</p>
      <p className="text-gray-400 text-sm mt-1">Create a folder to add your first client.</p>
    </div>
  );
}

function FolderIcon() {
  return (
    <svg className="w-5 h-5 text-yellow-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
      <path d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z" />
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
