'use client';
import FileItem from './FileItem';

export default function FileList({ files, loading, onOpenFolder, onDelete, onDownload }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!files.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <svg className="w-14 h-14 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
        </svg>
        <p className="text-gray-500 font-medium">This folder is empty</p>
        <p className="text-gray-400 text-sm mt-1">Upload files or create a folder to get started.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {files.map((file) => (
        <FileItem
          key={file.id}
          file={file}
          onOpenFolder={onOpenFolder}
          onDelete={onDelete}
          onDownload={onDownload}
        />
      ))}
    </div>
  );
}
