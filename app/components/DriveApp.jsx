'use client';
import { useState, useEffect, useCallback } from 'react';
import { signOut } from 'next-auth/react';
import Toolbar from './Toolbar';
import FileList from './FileList';
import ClientTable from './ClientTable';
import PositionTable from './PositionTable';
import Breadcrumb from './Breadcrumb';
import Dashboard from './Dashboard';
import EmployeeTable from './EmployeeTable';
import PositionDetailCard from './PositionDetailCard';
import NewPositionModal from './NewPositionModal';
import GenerateIntakeModal from './GenerateIntakeModal';

const ROOT_ID = '1dOAe4OwsWtgm0x3l2mZzKsZcK1iR3RuA';

export default function DriveApp({ session }) {
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'clients'
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [breadcrumb, setBreadcrumb] = useState([{ id: ROOT_ID, name: 'Clients' }]);
  const [showNewPositionModal, setShowNewPositionModal] = useState(false);
  const [showIntakeModal, setShowIntakeModal] = useState(false);

  const currentFolder = breadcrumb[breadcrumb.length - 1];
  // depth: 0 = root (client list), 1 = inside client (positions), 2+ = inside position
  const depth = breadcrumb.length - 1;

  const fetchFiles = useCallback(async (folderId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/drive/files?folderId=${folderId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFiles(data.files || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles(currentFolder.id);
  }, [currentFolder.id, fetchFiles]);

  const openFolder = (folder) => {
    setBreadcrumb((prev) => [...prev, { id: folder.id, name: folder.name, properties: folder.properties || {} }]);
  };

  const handlePositionUpdated = (updated) => {
    setBreadcrumb((prev) => prev.map((item) =>
      item.id === updated.id ? { ...item, name: updated.name, properties: updated.properties } : item
    ));
  };

  const navigateTo = (index) => {
    setBreadcrumb((prev) => prev.slice(0, index + 1));
  };

  const handleCreateFolder = async (name) => {
    const res = await fetch('/api/drive/folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId: currentFolder.id }),
    });
    if (res.ok) fetchFiles(currentFolder.id);
    else {
      const d = await res.json();
      alert('Error: ' + d.error);
    }
  };

  const handleUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('parentId', currentFolder.id);
    const res = await fetch('/api/drive/upload', { method: 'POST', body: formData });
    if (res.ok) fetchFiles(currentFolder.id);
    else {
      const d = await res.json();
      alert('Upload error: ' + d.error);
    }
  };

  const handleDelete = async (fileId) => {
    const res = await fetch(`/api/drive/delete/${fileId}`, { method: 'DELETE' });
    if (res.ok) setFiles((prev) => prev.filter((f) => f.id !== fileId));
    else {
      const d = await res.json();
      alert('Delete error: ' + d.error);
    }
  };

  const handleDownload = (file) => {
    window.open(`https://drive.google.com/uc?export=download&id=${file.id}`, '_blank');
  };

  const renderContent = () => {
    if (error) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      );
    }
    if (depth === 0) {
      return (
        <ClientTable
          files={files}
          loading={loading}
          onOpenFolder={openFolder}
          onDelete={handleDelete}
          onRefresh={() => fetchFiles(currentFolder.id)}
        />
      );
    }
    if (depth === 1) {
      return (
        <PositionTable
          files={files}
          loading={loading}
          onOpenFolder={openFolder}
          onDelete={handleDelete}
          clientFolder={breadcrumb[1]}
          onRefresh={() => fetchFiles(currentFolder.id)}
        />
      );
    }
    const positionFolder = breadcrumb[2];
    return (
      <>
        {positionFolder && (
          <PositionDetailCard
            folder={positionFolder}
            onUpdated={handlePositionUpdated}
          />
        )}
        <FileList
          files={files}
          loading={loading}
          onOpenFolder={openFolder}
          onDelete={handleDelete}
          onDownload={handleDownload}
        />
      </>
    );
  };

  const pageTitle = depth === 0 ? 'Clients' : depth === 1 ? currentFolder.name : currentFolder.name;
  const pageSubtitle = depth === 0 ? 'All client accounts' : depth === 1 ? 'Positions' : 'Position files';

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
            </svg>
          </div>
          <span className="font-semibold text-gray-900">StartupBreed</span>
        </div>

        {/* Nav tabs */}
        <nav className="flex items-center gap-1">
          <TabBtn active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<DashIcon />}>Dashboard</TabBtn>
          <TabBtn active={view === 'clients'} onClick={() => setView('clients')} icon={<FolderIcon />}>Clients</TabBtn>
          <TabBtn active={view === 'employees'} onClick={() => setView('employees')} icon={<PeopleIcon />}>Employees</TabBtn>
        </nav>
        <div className="flex items-center gap-3">
          <img src={session.user?.image} alt={session.user?.name} className="w-8 h-8 rounded-full" />
          <span className="hidden sm:block text-sm text-gray-600">{session.user?.name}</span>
          <button onClick={() => signOut()} className="btn-secondary text-xs px-3 py-1.5">
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8">
        {session.error === 'RefreshTokenError' && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            Your session has expired. Please{' '}
            <button onClick={() => signOut()} className="underline font-medium">sign in again</button>.
          </div>
        )}

        {view === 'dashboard' ? (
          <Dashboard onNavigateTo={(items) => { setBreadcrumb(items); setView('clients'); }} />
        ) : view === 'employees' ? (
          <div>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
              <p className="text-sm text-gray-500 mt-0.5">Recruiters and their closed positions</p>
            </div>
            <EmployeeTable />
          </div>
        ) : (
          <>
            <div className="mb-6">
              <Breadcrumb items={breadcrumb} onNavigate={navigateTo} />
              <div className="mt-3">
                <h1 className="text-2xl font-bold text-gray-900">{pageTitle}</h1>
                <p className="text-sm text-gray-500 mt-0.5">{pageSubtitle}</p>
              </div>
            </div>

            <Toolbar
              onCreateFolder={handleCreateFolder}
              onNewPosition={() => setShowNewPositionModal(true)}
              onGenerateIntake={depth === 1 ? () => setShowIntakeModal(true) : undefined}
              onUpload={handleUpload}
              onRefresh={() => fetchFiles(currentFolder.id)}
              depth={depth}
            />

            <div className="mt-5">{renderContent()}</div>
          </>
        )}
      </main>

      {showNewPositionModal && depth === 1 && (
        <NewPositionModal
          parentFolderId={currentFolder.id}
          onClose={() => setShowNewPositionModal(false)}
          onCreated={() => {
            setShowNewPositionModal(false);
            fetchFiles(currentFolder.id);
          }}
        />
      )}

      {showIntakeModal && depth === 1 && breadcrumb[1] && (
        <GenerateIntakeModal
          folder={breadcrumb[1]}
          onClose={() => setShowIntakeModal(false)}
          onDone={() => {
            setShowIntakeModal(false);
            fetchFiles(currentFolder.id);
          }}
        />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function DashIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
}

function FolderIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>;
}

function PeopleIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
}
