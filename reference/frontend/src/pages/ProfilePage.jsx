import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch, getUser } from '../utils/auth';
import { backendUrl } from '../config/api';

const ProfilePage = () => {
  const user = getUser();
  const [starLevels, setStarLevels] = useState([]);
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [exportData, setExportData] = useState(null);
  const [exportError, setExportError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  useEffect(() => {
    authFetch(backendUrl('/api/performance'))
      .then(r => r.ok ? r.json() : [])
      .then(data => setStarLevels(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);
  const [deleteError, setDeleteError] = useState('');

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await authFetch(backendUrl('/api/ethics/export'));
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();
      setExportData(data);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setTimeout(() => setExportData(null), 5000);
    } catch (err) {
      setExportError('Could not export data. Please try again.');
    }
    setExporting(false);
  };

  const handleDelete = async () => {
    if (!deletePassword) {
      setDeleteError('Please enter your password');
      return;
    }
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await authFetch(backendUrl('/api/ethics/delete-account'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Deletion failed');
      }
      localStorage.removeItem('token');
      navigate('/login');
    } catch (err) {
      setDeleteError(err.message);
    }
    setDeleting(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl md:text-4xl font-black uppercase mb-2 tracking-tight">👤 My Profile</h1>
      <p className="font-bold text-gray-600 mb-6 md:mb-8">Manage your account and data</p>

      <div className="card-bub-solid bg-white p-8 mb-8">
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b-4 border-black pb-3">
            <span className="font-bold text-gray-600">Name</span>
            <span className="font-black text-lg">{user?.fullName}</span>
          </div>
          <div className="flex justify-between items-center border-b-4 border-black pb-3">
            <span className="font-bold text-gray-600">Standard</span>
            <span className="font-black text-lg bg-gradient-to-r from-amber-400 to-orange-400 border border-gray-200 px-3 py-1">Grade {user?.std}</span>
          </div>
          <div className="flex justify-between items-center border-b-4 border-black pb-3">
            <span className="font-bold text-gray-600">Board</span>
            <span className="font-black text-lg bg-gradient-to-r from-blue-400 to-cyan-400 border border-gray-200 px-3 py-1">{user?.board}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-bold text-gray-600">Role</span>
            <span className="font-black uppercase text-sm">{user?.role || 'student'}</span>
          </div>
        </div>
      </div>

      {starLevels.length > 0 && (
        <div className="card-bub-solid bg-white p-8 mb-8">
          <h2 className="font-black text-xl uppercase mb-4">⭐ Star Levels</h2>
          <div className="space-y-4">
            {starLevels.map((s, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                <div>
                  <p className="font-black text-lg">{s.subjectName}</p>
                  <p className="text-sm text-gray-500">{s.totalQuizzes} quizzes completed</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-xl">{s.starName}</p>
                  <p className="text-xs text-gray-400">Avg: {s.averageScore}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card-bub-solid bg-green-50 p-8 mb-8">
        <h2 className="font-black text-xl uppercase mb-2">📥 Download My Data</h2>
        <p className="font-medium text-gray-600 mb-4">Get a JSON file of your profile, progress, feedback, saved links, and more.</p>
        <button onClick={handleExport} disabled={exporting} className="btn-bub-primary px-6 py-3 disabled:opacity-50">
          {exporting ? 'Exporting...' : 'Export My Data'}
        </button>
        {exportError && (
          <p className="text-xs font-bold text-red-500 mt-2">{exportError}</p>
        )}
        {exportData && (
          <p className="text-xs font-bold text-green-600 mt-2">✓ Download started! Check your downloads folder.</p>
        )}
      </div>

      <div className="card-bub-solid bg-red-50 p-8">
        <h2 className="font-black text-xl uppercase mb-2 text-red-700">🗑️ Delete Account</h2>
        <p className="font-medium text-gray-600 mb-4">Permanently delete your account and all associated data. This cannot be undone.</p>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} className="border-4 border-red-700 bg-red-400 text-white px-6 py-3 font-black uppercase hover:bg-red-500">
            Delete My Account
          </button>
        ) : (
          <div className="space-y-3">
            <p className="font-black text-red-700">Are you sure? All your progress will be lost forever!</p>
            <p className="font-medium text-sm text-gray-600">Confirm your password to proceed:</p>
            <input type="password" placeholder="Enter your password" value={deletePassword} onChange={e => { setDeletePassword(e.target.value); setDeleteError(''); }}
              className="input-bub w-full font-medium tracking-widest" />
            {deleteError && <p className="text-xs font-bold text-red-600">{deleteError}</p>}
            <div className="flex gap-3">
              <button onClick={handleDelete} disabled={deleting} className=" bg-black text-white px-6 py-3 font-black uppercase hover:bg-gray-800 disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Yes, Delete Everything'}
              </button>
              <button onClick={() => { setConfirmDelete(false); setDeletePassword(''); setDeleteError(''); }} className=" bg-white px-6 py-3 font-black uppercase hover:bg-gray-100">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
