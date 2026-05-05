'use client';
import { useRef, useState } from 'react';

const ALL_SLOTS = [
  { key: 'intake',  label: 'Client Intake',          color: 'blue'   },
  { key: 'prehunt', label: 'Pre-Hunt',                color: 'purple' },
  { key: 'jd',      label: 'Job Description',         color: 'green'  },
  { key: 'icp',     label: 'Ideal Candidate Persona', color: 'orange' },
];

const COLOR = {
  blue:   { icon: 'text-blue-500 bg-blue-50',     border: 'border-blue-200',   badge: 'bg-blue-50 text-blue-700'   },
  purple: { icon: 'text-purple-500 bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-50 text-purple-700' },
  green:  { icon: 'text-green-500 bg-green-50',   border: 'border-green-200',  badge: 'bg-green-50 text-green-700'  },
  orange: { icon: 'text-orange-500 bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-50 text-orange-700' },
};

export default function DocumentSlots({ files, slotKeys, onUploadToSlot, onAssign, onUnassign, onDelete, onDownload }) {
  const SLOTS = slotKeys
    ? ALL_SLOTS.filter(s => slotKeys.includes(s.key))
    : ALL_SLOTS;

  const cols = SLOTS.length === 1 ? '' : SLOTS.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3';

  return (
    <div className={`grid grid-cols-1 ${cols} gap-3 mb-5`}>
      {SLOTS.map((slot) => {
        const file = files.find(f => f.properties?.documentType === slot.key);
        return file
          ? <FilledSlot key={slot.key} slot={slot} file={file} onAssign={onAssign} onUnassign={onUnassign} onDelete={onDelete} onDownload={onDownload} />
          : <EmptySlot key={slot.key} slot={slot} onUpload={onUploadToSlot} />;
      })}
    </div>
  );
}

function EmptySlot({ slot, onUpload }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const c = COLOR[slot.color];

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await onUpload(file, slot.key);
    setUploading(false);
    e.target.value = '';
  };

  return (
    <div className={`border-2 border-dashed ${c.border} rounded-xl p-4 flex flex-col items-center justify-center gap-2 min-h-[110px] bg-white`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.icon}`}>
        <DocIcon />
      </div>
      <p className="text-sm font-medium text-gray-500">{slot.label}</p>
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="text-xs px-3 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors"
      >
        {uploading ? 'Uploading…' : 'Upload'}
      </button>
      <input ref={inputRef} type="file" className="hidden" onChange={handleChange} />
    </div>
  );
}

function FilledSlot({ slot, file, onAssign, onUnassign, onDelete, onDownload }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const c = COLOR[slot.color];

  const isGoogleDoc = file.mimeType === 'application/vnd.google-apps.document';
  const openUrl = isGoogleDoc
    ? `https://docs.google.com/document/d/${file.id}/edit`
    : `https://drive.google.com/open?id=${file.id}`;

  const otherSlots = ALL_SLOTS.filter(s => s.key !== slot.key);

  return (
    <div className={`border ${c.border} rounded-xl p-4 flex flex-col gap-2 min-h-[110px] bg-white relative`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.badge}`}>{slot.label}</span>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <DotsIcon />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-7 z-20 w-44 bg-white border border-gray-200 rounded-xl shadow-lg py-1 text-sm" onMouseLeave={() => setMenuOpen(false)}>
              {otherSlots.map(s => (
                <button key={s.key} onClick={() => { onAssign(file.id, s.key); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700">
                  Move to {s.label}
                </button>
              ))}
              <button onClick={() => { onDownload(file); setMenuOpen(false); }}
                className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700">
                Download
              </button>
              <button onClick={() => { onUnassign(file.id); setMenuOpen(false); }}
                className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-600">
                Unassign
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button onClick={() => { onDelete(file.id); setMenuOpen(false); }}
                className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-500">
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* File name */}
      <p className="text-sm font-medium text-gray-800 line-clamp-2 leading-snug flex-1">{file.name}</p>

      {/* Open button */}
      <a href={openUrl} target="_blank" rel="noreferrer"
        className={`self-start text-xs px-3 py-1 rounded-lg ${c.badge} font-medium hover:opacity-80 transition-opacity`}>
        Open →
      </a>
    </div>
  );
}

function DocIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
    </svg>
  );
}
