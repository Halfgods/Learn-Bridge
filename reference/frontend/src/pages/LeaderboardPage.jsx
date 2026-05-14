import { useEffect, useState } from 'react';
import { getUser } from '../utils/auth';
import { backendUrl } from '../config/api';

const LeaderboardPage = () => {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const user = getUser();
  const std = user?.std;
  const board = user?.board;

  useEffect(() => {
    setLoading(true);
    setError(null);
    const url = (std && board)
      ? backendUrl(`/api/leaderboard?std=${encodeURIComponent(std)}&board=${encodeURIComponent(board)}`)
      : backendUrl('/api/leaderboard');

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setLeaders(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Leaderboard fetch error:', err);
        setError(err.message);
        setLeaders([]);
        setLoading(false);
      });
  }, [std, board]);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="text-center mb-12 relative">
        <span className="absolute -top-10 left-10 text-6xl transform -rotate-12 ">👑</span>
        <span className="absolute top-0 right-10 text-4xl transform rotate-12">✨</span>
        <h1 className="text-3xl md:text-5xl font-black uppercase inline-block p-3 md:p-4 bg-gradient-to-r from-amber-400 to-orange-400 transform -rotate-1">
          {std ? `Grade ${std} Leaderboard` : 'Global Leaderboard'}
        </h1>
        <p className="font-bold text-gray-700 mt-6 text-xl">Top Scholars — {board || 'Global'}</p>
      </div>

      <div className="space-y-4">
        {loading && (
          <div className="card-bub-solid border-dashed p-10 text-center font-bold uppercase">
            Loading leaderboard...
          </div>
        )}
        {error && (
          <div className="card-bub-solid bg-red-400 text-white p-10 text-center font-bold uppercase">
            Error: {error}
          </div>
        )}
        {!loading && !error && leaders.length === 0 && (
          <div className="card-bub-solid border-dashed p-10 text-center text-gray-400 font-bold uppercase">
            No leaderboard data yet.
          </div>
        )}
        {leaders.map((entry, idx) => {
          const rank = idx + 1;
          let rankLabel = `#${rank}`;
          let cardBg = 'bg-white';
          let badgeBg = 'bg-white';
          let shadowClass = 'shadow-lg';

          if (rank === 1) {
            rankLabel = '🥇 1st';
            cardBg = 'bg-gradient-to-r from-pink-500 to-rose-500 text-white scale-[1.02] border-b-8 mb-6';
            badgeBg = 'bg-gradient-to-r from-amber-400 to-orange-400 text-black';
            shadowClass = '';
          } else if (rank === 2) {
            rankLabel = '🥈 2nd';
            cardBg = 'bg-gradient-to-r from-amber-400 to-orange-400 border-b-8 mb-4';
            badgeBg = 'bg-white text-black';
          } else if (rank === 3) {
            rankLabel = '🥉 3rd';
            cardBg = 'bg-gradient-to-r from-blue-400 to-cyan-400 border-b-8 mb-4';
            badgeBg = 'bg-white text-black';
          }

          return (
            <div key={entry._id || idx} className={`card-bub-solid p-6 flex items-center justify-between transition-transform hover:-translate-y-1 ${cardBg} ${shadowClass}`}>
              <div className="flex items-center gap-6">
                <div className={`px-4 py-2  font-black text-xl flex items-center justify-center ${badgeBg} `}>
                  {rankLabel}
                </div>
                <div>
                  <h2 className={`text-2xl font-black uppercase tracking-tight ${rank === 1 ? '' : ''}`}>
                    {entry.userName}
                  </h2>
                  <p className="font-bold opacity-80 text-sm italic">
                    {entry.totalChaptersCompleted} Chapters Mastered
                  </p>
                </div>
              </div>
              <div className="text-right bg-white text-black py-1 px-3 sm:px-6 sm:border-l-2 sm:border-gray-200">
                <span className="text-xs font-black uppercase text-gray-500 hidden sm:block">Overall Avg</span>
                <span className="sm:text-4xl font-black">{entry.averageScore}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LeaderboardPage;
