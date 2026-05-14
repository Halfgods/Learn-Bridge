import { useState, useEffect } from 'react';
import { authFetch, getUser } from '../utils/auth';
import { backendUrl } from '../config/api';

const TeacherDashboard = () => {
  const user = getUser();
  const [flagged, setFlagged] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [filter, setFilter] = useState('open');

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [flaggedRes, statsRes] = await Promise.all([
        authFetch(backendUrl(`/api/teacher/flagged?status=${filter}`)).then(r => r.ok ? r.json() : []),
        authFetch(backendUrl('/api/teacher/stats')).then(r => r.ok ? r.json() : null)
      ]);
      setFlagged(Array.isArray(flaggedRes) ? flaggedRes : []);
      setStats(statsRes);
    } catch (err) {
      console.error('Teacher dashboard error:', err);
      setLoadError('Failed to load data. The server may be unavailable.');
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [filter]);

  const handleReview = async (id, status) => {
    try {
      await authFetch(backendUrl(`/api/teacher/flagged/${id}/review`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      loadData();
    } catch (err) {
      console.error('Review error:', err);
    }
  };

  if (user?.role !== 'teacher' && user?.role !== 'admin') {
    return (
      <div className="p-8 text-center">
        <span className="text-6xl block mb-4">🔒</span>
        <h2 className="font-black text-2xl uppercase">Teacher Access Only</h2>
        <p className="font-bold text-gray-500 mt-2">You need a teacher account to view this page.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tight">🏫 Teacher Dashboard</h1>
          <p className="font-bold text-gray-500 text-xs md:text-sm">Review flagged content and monitor AI interactions</p>
        </div>
        {stats && (
          <div className="flex gap-3">
            <div className="card-bub-solid bg-red-200 p-3 text-center"><span className="font-black text-xl">{stats.open}</span><p className="text-xs font-bold">Open</p></div>
            <div className="card-bub-solid bg-green-200 p-3 text-center"><span className="font-black text-xl">{stats.reviewed}</span><p className="text-xs font-bold">Reviewed</p></div>
            <div className="card-bub-solid bg-gray-200 p-3 text-center"><span className="font-black text-xl">{stats.total}</span><p className="text-xs font-bold">Total</p></div>
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-6">
        {['open', 'reviewed', 'dismissed'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`border border-gray-200 px-4 py-2 font-bold uppercase text-sm transition-all ${filter === s ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'}`}
          >
            {s} ({stats?.[s] || 0})
          </button>
        ))}
        <button onClick={() => setFilter('')} className="border border-gray-200 px-4 py-2 font-bold uppercase text-sm bg-white hover:bg-gray-100">
          All
        </button>
      </div>

      {loadError ? (
        <div className="card-bub-solid bg-red-400 text-white p-8 text-center">
          <span className="text-4xl block mb-4">⚠️</span>
          <h3 className="font-black text-xl uppercase mb-2">Error Loading Data</h3>
          <p className="font-bold mb-4">{loadError}</p>
          <button onClick={loadData} className="border-4 border-white bg-white text-black px-6 py-3 font-black uppercase hover:bg-gray-100">
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="text-center py-12"><div className="w-12 h-12 border-4 border-gray-200 border-t-violet-400 rounded-full animate-spin mx-auto"></div></div>
      ) : flagged.length === 0 ? (
        <div className="card-bub-solid bg-white p-12 text-center">
          <span className="text-5xl block mb-4">✅</span>
          <h3 className="font-black text-xl uppercase">No Flagged Content</h3>
          <p className="font-bold text-gray-500 mt-2">All clear! No items match this filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {flagged.map((item) => (
            <div key={item._id} className="card-bub-solid bg-white p-6">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className={`text-xs font-black uppercase px-2 py-1 border border-gray-200 ${item.status === 'open' ? 'bg-red-200' : item.status === 'reviewed' ? 'bg-green-200' : 'bg-gray-200'}`}>
                    {item.status}
                  </span>
                  <span className="text-xs font-black uppercase px-2 py-1 border border-gray-200 ml-2 bg-gradient-to-r from-amber-400 to-orange-400">{item.reason}</span>
                </div>
                <span className="text-xs font-bold text-gray-400">{new Date(item.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="font-black uppercase text-xs text-gray-500 mb-1">Student Query</p>
                  <p className="font-medium text-sm bg-gray-100 p-3 border border-gray-200">{item.userQuery}</p>
                </div>
                <div>
                  <p className="font-black uppercase text-xs text-gray-500 mb-1">AI Response</p>
                  <p className="font-medium text-sm bg-gray-100 p-3 border border-gray-200">{item.aiResponse}</p>
                </div>
              </div>
              {item.status === 'open' && (
                <div className="flex gap-2">
                  <button onClick={() => handleReview(item._id, 'reviewed')} className="border border-gray-200 bg-green-200 px-4 py-2 font-bold text-sm uppercase hover:bg-green-300">
                    ✓ Reviewed
                  </button>
                  <button onClick={() => handleReview(item._id, 'dismissed')} className="border border-gray-200 bg-gray-200 px-4 py-2 font-bold text-sm uppercase hover:bg-gray-300">
                    ✕ Dismiss
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
