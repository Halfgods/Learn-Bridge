import { useState, useEffect } from 'react';
import { authFetch, getUser } from '../utils/auth';
import { backendUrl } from '../config/api';
import confetti from 'canvas-confetti';

const AchievementsPage = () => {
  const [achievements, setAchievements] = useState([]);
  const [stats, setStats] = useState({ streak: 0, unlockedCount: 0, totalCount: 10 });
  const [loading, setLoading] = useState(true);
  const user = getUser();

  useEffect(() => {
    Promise.all([
      authFetch(backendUrl('/api/gamification/achievements')).then(r => r.ok ? r.json() : []),
      authFetch(backendUrl('/api/gamification/dashboard')).then(r => r.ok ? r.json() : {})
    ]).then(([achs, dash]) => {
      setAchievements(Array.isArray(achs) ? achs : []);
      setStats(prev => ({ ...prev, ...dash }));
      setLoading(false);
      // Small celebration if user has achievements
      const unlocked = Array.isArray(achs) ? achs.filter(a => a.unlocked).length : 0;
      if (unlocked > 0) {
        setTimeout(() => confetti({ particleCount: 50, spread: 100, origin: { y: 0.7 } }), 300);
      }
    }).catch(() => setLoading(false));
  }, []);

  const unlocked = achievements.filter(a => a.unlocked);
  const locked = achievements.filter(a => !a.unlocked);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-200 border-t-violet-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="font-bold text-gray-500">Loading achievements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight">🏆 Achievements</h1>
          <p className="text-gray-500 font-medium mt-1">{stats.unlockedCount} of {stats.totalCount} unlocked</p>
        </div>
        <div className="text-right">
          <p className="font-black text-2xl">🔥 {stats.streak}</p>
          <p className="text-xs font-bold text-gray-400">day streak</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-3 bg-gray-100 rounded-full mb-8 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-violet-400 to-fuchsia-400 rounded-full transition-all duration-500" style={{ width: `${(stats.unlockedCount / stats.totalCount) * 100}%` }} />
      </div>

      {/* Unlocked */}
      {unlocked.length > 0 && (
        <div className="mb-8">
          <h2 className="font-black text-lg mb-4">✨ Unlocked</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {unlocked.map(ach => (
              <div key={ach.achievementId} className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 text-center border border-amber-200 shadow-sm hover:shadow-lg transition-all">
                <span className="text-4xl block mb-2">{ach.icon}</span>
                <h3 className="font-bold text-sm">{ach.name}</h3>
                <p className="text-xs text-gray-500 mt-1">{ach.desc}</p>
                <p className="text-xs font-bold text-green-600 mt-2">✅ +{ach.xpReward} XP</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Locked */}
      {locked.length > 0 && (
        <div>
          <h2 className="font-black text-lg mb-4">🔒 Locked</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {locked.map(ach => (
              <div key={ach.achievementId} className="bg-gray-50 rounded-2xl p-5 text-center border border-gray-200 opacity-70">
                <span className="text-4xl block mb-2 grayscale">{ach.icon}</span>
                <h3 className="font-bold text-sm text-gray-500">{ach.name}</h3>
                <p className="text-xs text-gray-400 mt-1">{ach.desc}</p>
                {ach.maxProgress > 1 && (
                  <div className="w-full h-1.5 bg-gray-200 rounded-full mt-3 overflow-hidden">
                    <div className="h-full bg-gray-400 rounded-full" style={{ width: `${(ach.progress / ach.maxProgress) * 100}%` }} />
                  </div>
                )}
                <p className="text-xs font-bold text-gray-400 mt-2">+{ach.xpReward} XP</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AchievementsPage;
