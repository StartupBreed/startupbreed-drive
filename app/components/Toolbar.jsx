'use client';
import { useRef, useState } from 'react';

export default function Toolbar({ onCreateFolder, onUpload, onRefresh, depth = 0 }) {
  const folderLabel = depth === 0 ? 'New client' : depth === 1 ? 'New position' : 'New folder';
  const [folderName, setFolderName] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);
  const importInputRef = useRef(null);

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/drive/import', { method: 'POST', body: formData });
    const data = await res.json();
    setImporting(false);
    setImportResult(data);
    if (!data.error) onRefresh();
    e.target.value = '';
  };

  const handleCreateFolder = () => {
    const name = folderName.trim();
    if (!name) return;
    onCreateFolder(name);
    setFolderName('');
    setShowInput(false);
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      await onUpload(file);
    }
    setUploading(false);
    e.target.value = '';
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* New Folder */}
      {showInput ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateFolder();
              if (e.key === 'Escape') setShowInput(false);
            }}
            placeholder="Folder name"
            autoFocus
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button onClick={handleCreateFolder} className="btn-primary">Create</button>
          <button onClick={() => setShowInput(false)} className="btn-secondary">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setShowInput(true)} className="btn-secondary">
          <FolderPlusIcon />
          {folderLabel}
        </button>
      )}

      {/* Upload */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="btn-primary"
      >
        <UploadIcon />
        {uploading ? 'Uploading…' : 'Upload file'}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Refresh */}
      <button onClick={onRefresh} className="btn-secondary ml-auto">
        <RefreshIcon />
        Refresh
      </button>

      {/* Import tools — only shown at root client level */}
      {depth === 0 && (
        <div className="flex items-center gap-2">
          {/* Download template */}
          <a href="/api/drive/template" download className="btn-secondary">
            <DownloadTemplateIcon />
            Template
          </a>

          {/* Import Excel */}
          <button onClick={() => importInputRef.current?.click()} disabled={importing} className="btn-secondary">
            <ImportIcon />
            {importing ? 'Importing…' : 'Import Excel'}
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImportFile}
          />

          {/* Help tooltip */}
          <div className="relative group">
            <button className="w-5 h-5 rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 text-xs font-bold flex items-center justify-center transition-colors">
              ?
            </button>
            <div className="absolute right-0 top-7 z-50 hidden group-hover:block w-72 bg-gray-900 text-white text-xs rounded-xl p-4 shadow-xl">
              <p className="font-semibold text-white mb-2">How to import pipeline data</p>
              <ol className="space-y-1.5 text-gray-300 list-decimal list-inside">
                <li>Click <span className="text-white font-medium">Template</span> to download the Excel template</li>
                <li>Fill in your clients &amp; positions (see the Instructions sheet)</li>
                <li>Click <span className="text-white font-medium">Import Excel</span> and select your file</li>
                <li>Done — existing entries are automatically skipped</li>
              </ol>
              <p className="mt-3 text-gray-400 border-t border-gray-700 pt-2">
                Safe to run multiple times. No duplicates will be created.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Import result toast */}
      {importResult && (
        <div className={`text-xs px-3 py-1.5 rounded-lg border ${importResult.error ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
          {importResult.error
            ? importResult.error
            : `✓ ${importResult.clientsCreated} clients, ${importResult.positionsCreated} positions created — ${importResult.clientsSkipped + importResult.positionsSkipped} skipped`
          }
          <button onClick={() => setImportResult(null)} className="ml-2 opacity-60 hover:opacity-100">×</button>
        </div>
      )}
    </div>
  );
}

function FolderPlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 10v6m3-3H9m4.06-7H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3.06a2 2 0 01-1.72-1l-.5-1A2 2 0 0011.06 4H12" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

function DownloadTemplateIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function ImportIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}
