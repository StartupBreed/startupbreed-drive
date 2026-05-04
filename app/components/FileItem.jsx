'use client';
import { useState } from 'react';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const GOOGLE_DOC_MIMES = {
  'application/vnd.google-apps.document': 'Doc',
  'application/vnd.google-apps.spreadsheet': 'Sheet',
  'application/vnd.google-apps.presentation': 'Slide',
  'application/vnd.google-apps.form': 'Form',
};

const SLOT_OPTIONS = [
  { key: 'intake',  label: 'Client Intake'  },
  { key: 'prehunt', label: 'Pre-Hunt'        },
  { key: 'jd',      label: 'Job Description' },
];

export default function FileItem({ file, onOpenFolder, onDelete, onDownload, onAssign }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const isFolder = file.mimeType === FOLDER_MIME;

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(file.id);
    setDeleting(false);
    setConfirmDelete(false);
  };

  const isDocx = file.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || file.name?.endsWith('.docx');
  const driveUrl = isDocx
    ? `https://docs.google.com/document/d/${file.id}/edit`
    : `https://drive.google.com/open?id=${file.id}`;

  return (
    <div className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-brand-300 hover:shadow-sm transition-all flex flex-col gap-2">
      {/* Icon + Name row */}
      {isFolder ? (
        <button
          onClick={() => onOpenFolder(file)}
          className="flex items-start gap-3 text-left w-full"
        >
          <div className="flex-shrink-0 mt-0.5"><FileIcon mimeType={file.mimeType} /></div>
          <span className="text-sm font-medium text-gray-800 break-words leading-snug line-clamp-2">{file.name}</span>
        </button>
      ) : (
        <a
          href={driveUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-start gap-3 text-left w-full"
        >
          <div className="flex-shrink-0 mt-0.5"><FileIcon mimeType={file.mimeType} /></div>
          <span className="text-sm font-medium text-gray-800 break-words leading-snug line-clamp-2 group-hover:text-brand-600 transition-colors">{file.name}</span>
        </a>
      )}

      {/* Meta + Actions row */}
      <div className="flex items-center justify-between mt-auto pt-1">
        <span className="text-xs text-gray-400">
          {isFolder ? 'Folder' : (GOOGLE_DOC_MIMES[file.mimeType] || formatSize(file.size))}
        </span>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isFolder && onAssign && (
            <div className="relative">
              <button
                onClick={() => setShowAssign(v => !v)}
                title="Assign to slot"
                className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
              >
                <AssignIcon />
              </button>
              {showAssign && (
                <div className="absolute right-0 bottom-8 z-20 w-40 bg-white border border-gray-200 rounded-xl shadow-lg py-1 text-sm" onMouseLeave={() => setShowAssign(false)}>
                  <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Assign as</p>
                  {SLOT_OPTIONS.map(s => (
                    <button key={s.key} onClick={() => { onAssign(file.id, s.key); setShowAssign(false); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700">
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {!isFolder && (
            <button
              onClick={() => onDownload(file)}
              title="Download"
              className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
            >
              <DownloadIcon />
            </button>
          )}
          {confirmDelete ? (
            <>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs px-2 py-1 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
              >
                {deleting ? '…' : 'Yes'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                No
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              title="Delete"
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatSize(bytes) {
  if (!bytes) return '';
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function FileIcon({ mimeType }) {
  if (mimeType === FOLDER_MIME) {
    return (
      <svg className="w-8 h-8 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
        <path d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z" />
      </svg>
    );
  }
  const label = GOOGLE_DOC_MIMES[mimeType];
  if (label) {
    const colors = { Doc: 'text-blue-500', Sheet: 'text-green-500', Slide: 'text-orange-400', Form: 'text-purple-500' };
    return (
      <span className={`text-xs font-bold ${colors[label] || 'text-gray-400'} bg-gray-100 rounded px-1 py-0.5`}>
        {label}
      </span>
    );
  }
  if (mimeType?.startsWith('image/')) {
    return <svg className="w-8 h-8 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
  }
  if (mimeType === 'application/pdf') {
    return <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
  }
  return <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
}

function DownloadIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>;
}

function TrashIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
}

function AssignIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>;
}
