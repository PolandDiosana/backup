"use client";

import { useState, useRef, useEffect } from 'react';
import {
  Cloud, FolderArchive, Upload, Download, Trash2,
  LayoutDashboard, HardDrive, LogOut, AlertCircle,
  CheckCircle, Loader2, FileStack, Clock, RefreshCw, Lock, ShieldCheck
} from 'lucide-react';
import JSZip from 'jszip';

function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [backups, setBackups] = useState([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState(0); // 0 idle, 1 compressing, 2 uploading, 3 done
  const [uploadMsg, setUploadMsg] = useState('');
  const [error, setError] = useState('');
  const [loginError, setLoginError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const fileInputRef = useRef(null);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'admin') {
      setIsAuthenticated(true);
      fetchBackups();
    } else {
      setLoginError("Incorrect password. Please try again.");
    }
  };

  const fetchBackups = async () => {
    setIsLoadingBackups(true);
    setError('');
    try {
      const res = await fetch('/api/backup/list');
      const data = await res.json();
      if (data.backups) setBackups(data.backups);
    } catch {
      setError("Could not connect to the server. Please refresh.");
    } finally {
      setIsLoadingBackups(false);
    }
  };

  const deleteBackup = async (id, name) => {
    if (!confirm(`Delete the backup "${name}"? This cannot be undone.`)) return;
    try {
      await fetch('/api/backup/list', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setSuccessMsg(`"${name}" was deleted.`);
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchBackups();
    } catch {
      setError("Could not delete the backup. Please try again.");
    }
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    setError("For best results, please use the 'Select Folder' button to pick a folder.");
  };

  const handleFileSelect = (e) => {
    if (e.target.files?.length > 0) {
      processAndUpload(e.target.files);
    }
  };

  const processAndUpload = async (fileList) => {
    const fileArray = Array.from(fileList);
    if (fileArray.length === 0) { setError("The selected folder appears to be empty."); return; }

    setError('');
    setSuccessMsg('');
    setIsUploading(true);
    setUploadStep(1);
    setUploadMsg(`Compressing ${fileArray.length} files...`);

    try {
      const zip = new JSZip();
      let topFolderName = "Backup";

      fileArray.forEach((file, i) => {
        const relativePath = file.webkitRelativePath || file.name;
        if (i === 0 && file.webkitRelativePath) {
          topFolderName = file.webkitRelativePath.split('/')[0];
        }
        zip.file(relativePath, file);
      });

      const zipBlob = await zip.generateAsync({ type: "blob" });

      setUploadStep(2);
      setUploadMsg("Uploading to secure cloud storage...");

      const formData = new FormData();
      formData.append('file', zipBlob, `${topFolderName}.zip`);
      formData.append('folderName', topFolderName);

      const res = await fetch('/api/backup/upload', { method: 'POST', body: formData });

      // Safely parse response — server may return plain text on errors (e.g. 413)
      let data;
      try {
        data = await res.json();
      } catch {
        if (res.status === 413) {
          throw new Error('The folder is too large to upload in one go. Try a smaller folder or split it up.');
        }
        throw new Error(`Server error (${res.status}). Please try again.`);
      }
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setUploadStep(3);
      setUploadMsg("Backup saved successfully!");
      setTimeout(() => {
        setIsUploading(false);
        setUploadStep(0);
        setUploadMsg('');
        setActiveTab('dashboard');
        setSuccessMsg(`✓ "${topFolderName}" has been backed up successfully!`);
        fetchBackups();
      }, 1500);

    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setIsUploading(false);
      setUploadStep(0);
    }
  };

  const totalSize = backups.reduce((acc, b) => acc + (b.size || 0), 0);

  // ─── LOGIN SCREEN ────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="login-wrapper">
        <div className="login-card fade-in">
          <div className="login-logo">
            <Cloud size={32} />
          </div>
          <h1 className="login-title">CloudBackup</h1>
          <p className="login-subtitle">Your personal file backup &amp; restore tool</p>

          {loginError && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <label className="form-label" htmlFor="password">Master Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="Enter your password..."
              value={password}
              autoFocus
              onChange={(e) => { setPassword(e.target.value); setLoginError(''); }}
            />
            <button type="submit" className="btn btn-primary">
              <ShieldCheck size={18} /> Sign In to Your Vault
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1.25rem' }}>
            Demo password: <strong>admin</strong>
          </p>
        </div>
      </div>
    );
  }

  // ─── MAIN APP ────────────────────────────────────────────────────────────────
  return (
    <div className="app-layout">

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <Cloud size={22} />
          </div>
          <div className="sidebar-brand-name">CloudBackup</div>
          <div className="sidebar-brand-tagline">Personal File Vault</div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`sidebar-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={18} /> My Backups
          </button>
          <button
            className={`sidebar-nav-item ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => { setActiveTab('upload'); setUploadStep(0); setIsUploading(false); }}
          >
            <Upload size={18} /> Create Backup
          </button>
        </nav>

        <div className="sidebar-footer">
          <button
            className="sidebar-nav-item"
            onClick={() => { setIsAuthenticated(false); setPassword(''); setBackups([]); }}
          >
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-content">

        {/* Global alerts */}
        {error && (
          <div className="alert alert-error fade-in">
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="alert alert-success fade-in">
            <CheckCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ── DASHBOARD ─────────────────────────────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <div className="fade-in">
            <div className="page-header">
              <h1 className="page-title">My Backups</h1>
              <p className="page-subtitle">All your backed-up folders are stored here and ready to restore.</p>
            </div>

            {/* Stats */}
            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-icon stat-icon-blue">
                  <FolderArchive size={20} />
                </div>
                <div className="stat-value">{backups.length}</div>
                <div className="stat-label">Total Backups</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon stat-icon-green">
                  <HardDrive size={20} />
                </div>
                <div className="stat-value">{formatBytes(totalSize)}</div>
                <div className="stat-label">Storage Used</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon stat-icon-orange">
                  <Clock size={20} />
                </div>
                <div className="stat-value">
                  {backups.length > 0
                    ? new Date(backups[0].createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                    : '—'}
                </div>
                <div className="stat-label">Last Backup</div>
              </div>
            </div>

            {/* Backups List */}
            <div className="section-header">
              <span className="section-title">📁 Saved Folders</span>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                onClick={fetchBackups}
              >
                <RefreshCw size={14} className={isLoadingBackups ? 'spin' : ''} />
                Refresh
              </button>
            </div>

            {isLoadingBackups ? (
              <div className="empty-state">
                <Loader2 size={32} className="spin" style={{ color: 'var(--accent)', margin: '0 auto 0.75rem' }} />
                <p style={{ color: 'var(--text-secondary)' }}>Loading your backups...</p>
              </div>
            ) : backups.length === 0 ? (
              <div className="card">
                <div className="empty-state">
                  <div className="empty-icon">
                    <FileStack size={36} />
                  </div>
                  <h2 className="empty-title">No backups yet</h2>
                  <p className="empty-desc">
                    Upload your first folder to start protecting your files. 
                    If your computer crashes or gets wiped, you can restore everything from here.
                  </p>
                  <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setActiveTab('upload')}>
                    <Upload size={16} /> Create Your First Backup
                  </button>
                </div>
              </div>
            ) : (
              <div className="backup-list">
                {backups.map((backup) => (
                  <div key={backup.id} className="backup-card fade-in">
                    <div className="backup-icon">
                      <FolderArchive size={24} />
                    </div>
                    <div className="backup-info">
                      <div className="backup-name">{backup.name}</div>
                      <div className="backup-meta">
                        <span className="meta-badge">
                          <Clock size={12} /> {formatDate(backup.createdAt)}
                        </span>
                        <span className="meta-badge">
                          <HardDrive size={12} /> {formatBytes(backup.size)}
                        </span>
                      </div>
                    </div>
                    <div className="backup-actions">
                      <a
                        href={`/api/backup/download?id=${backup.id}`}
                        download
                        className="btn btn-success"
                        style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem' }}
                      >
                        <Download size={15} /> Restore
                      </a>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                        onClick={() => deleteBackup(backup.id, backup.name)}
                        title="Delete this backup"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── UPLOAD ──────────────────────────────────────────────────────────── */}
        {activeTab === 'upload' && (
          <div className="fade-in">
            <div className="page-header">
              <h1 className="page-title">Create a New Backup</h1>
              <p className="page-subtitle">Select a folder from your computer to back it up securely.</p>
            </div>

            {/* Step Indicator */}
            <div className="step-flow" style={{ marginBottom: '2rem' }}>
              {['Select Folder', 'Compress', 'Upload', 'Done'].map((label, i) => {
                const step = i + 1;
                const isDone = uploadStep > i;
                const isActive = uploadStep === i && isUploading || (!isUploading && i === 0 && uploadStep === 0);
                return (
                  <div
                    key={label}
                    className={`step ${isDone ? 'done' : ''} ${isActive && !isDone ? 'active' : ''}`}
                  >
                    <div className="step-dot">
                      {isDone ? <CheckCircle size={16} /> : step}
                    </div>
                    <span className="step-label">{label}</span>
                  </div>
                );
              })}
            </div>

            {isUploading ? (
              <div className="progress-card fade-in">
                <Loader2 size={40} className="spin" style={{ color: 'var(--accent)', marginBottom: '1rem' }} />
                <h2 style={{ fontWeight: 700, fontSize: '1.25rem', marginBottom: '0.375rem' }}>
                  {uploadStep === 3 ? '🎉 Backup Complete!' : 'Processing your folder...'}
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{uploadMsg}</p>
                <div className="progress-bar-track">
                  <div className="progress-bar-fill" />
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Please don't close this tab. This may take a moment for large folders.
                </p>
              </div>
            ) : (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  webkitdirectory=""
                  directory=""
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <div
                  className={`drop-zone ${isDragging ? 'dragging' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="drop-zone-icon">
                    <Upload size={36} />
                  </div>
                  <h2 className="drop-zone-title">Click to Select a Folder</h2>
                  <p className="drop-zone-hint">
                    Your entire folder — including all subfolders and files — will be saved as a backup.
                  </p>
                  <button
                    className="btn btn-primary"
                    style={{ width: 'auto' }}
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  >
                    <FolderArchive size={17} /> Choose Folder
                  </button>
                </div>

                <div className="card" style={{ marginTop: '1.25rem' }}>
                  <div className="card-body">
                    <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.75rem' }}>
                      ℹ️ How it works
                    </h3>
                    <ol style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                      <li><strong>Select</strong> any folder on your computer.</li>
                      <li>We <strong>compress</strong> the folder in your browser so it uploads quickly.</li>
                      <li>The compressed folder is saved <strong>securely</strong> to the server.</li>
                      <li>Later, you can <strong>restore</strong> it by downloading from My Backups.</li>
                    </ol>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
