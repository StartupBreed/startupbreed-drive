'use client';
import { useState, useRef, useEffect } from 'react';

export default function InlineName({ fileId, name, onClick, className = '' }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const save = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === name) { setValue(name); setEditing(false); return; }
    setSaving(true);
    const res = await fetch(`/api/drive/rename/${fileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
    setSaving(false);
    if (res.ok) { setValue(trimmed); }
    else { setValue(name); }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setValue(name); setEditing(false); } }}
        disabled={saving}
        className="border border-brand-400 rounded px-2 py-0.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 w-48 disabled:opacity-50"
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 group/name">
      <button onClick={onClick} className={`font-medium text-left hover:underline ${className}`}>
        {value}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        className="opacity-0 group-hover/name:opacity-100 transition-opacity p-0.5 rounded text-gray-300 hover:text-gray-500"
        title="Rename"
      >
        <PencilIcon />
      </button>
    </span>
  );
}

function PencilIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  );
}
