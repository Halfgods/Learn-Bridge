import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import HomeHub from './HomeHub';
import TopicPage from './TopicPage';
import LearnPage from './LearnPage';
import QuizPage from './QuizPage';
import ProgressPage from './ProgressPage';
import SavedLinksPage from './SavedLinksPage';
import LeaderboardPage from './LeaderboardPage';
import KnowledgeGraphPage from './KnowledgeGraphPage';
import SpacedRepetitionPage from './SpacedRepetitionPage';
import TeacherDashboard from './TeacherDashboard';
import ProfilePage from './ProfilePage';
import AchievementsPage from './AchievementsPage';
import QuickQuizPage from './QuickQuizPage';
import MobileNavigation from '../components/MobileNavigation';
import ToastContainer from '../components/ToastContainer';
import { authFetch, getUser } from '../utils/auth';
import { backendUrl } from '../config/api';

// ── Dashboard Extended ─────────────────────────────────────────
const DashboardExtended = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getUser();
  const [sideStreak, setSideStreak] = useState(null);

  // Redirect new users to onboarding
  useEffect(() => {
    try {
      if (!localStorage.getItem('onboardingDone')) {
        navigate('/onboarding', { replace: true });
      }
    } catch {}
  }, []);

  useEffect(() => {
    authFetch(backendUrl('/api/gamification/dashboard'))
      .then(r => r.ok ? r.json() : {})
      .then(d => { if (d.streak) setSideStreak(d.streak); })
      .catch(() => {});
  }, []);

  const getLinkClass = (path, colorGrad) => {
    const currentPath = location.pathname;
    let isActive = currentPath.includes(path);
    if (path === '/home' && (currentPath === '/dashboard' || currentPath === '/dashboard/')) isActive = true;
    if (path === '/topic' && currentPath.startsWith('/dashboard/topic')) isActive = true;
    const colors = isActive ? `bg-gradient-to-r ${colorGrad} text-white shadow-md` : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200';
    return `block px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${colors}`;
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="h-screen flex font-sans bg-amber-50 overflow-hidden">
      {/* Mobile Navigation (visible < lg) */}
      <MobileNavigation />

      {/* Sidebar (hidden on mobile) */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-white z-20 relative shadow-lg">
        <div className="p-6 bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white">
          <Link to="/" className="font-black text-2xl tracking-tight block hover:opacity-80 transition-opacity">AI TUTOR</Link>
        </div>
        <nav className="flex-1 p-5 space-y-2 flex flex-col overflow-y-auto">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-2 mb-1">Learn</p>
          <Link to="/dashboard"              className={getLinkClass('/home', 'from-violet-500 to-fuchsia-600')}>🏠 Home</Link>
          <Link to="/dashboard/topic"        className={getLinkClass('/topic', 'from-blue-400 to-cyan-400')}>📚 Curriculum</Link>
          <Link to="/dashboard/review"       className={getLinkClass('/review', 'from-purple-400 to-violet-500 text-white')}>🧠 Daily Practice</Link>
          <Link to="/dashboard/quick-quiz"   className={getLinkClass('/quick-quiz', 'from-green-400 to-emerald-500 text-white')}>⚡ Quick Quiz</Link>

          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-4 mb-1">Track</p>
          <Link to="/dashboard/progress"     className={getLinkClass('/progress', 'from-pink-500 to-rose-500 text-white')}>📈 Progress</Link>
          <Link to="/dashboard/achievements" className={getLinkClass('/achievements','from-yellow-400 to-amber-500')}>🏆 Achievements</Link>
          <Link to="/dashboard/leaderboard"  className={getLinkClass('/leaderboard', 'from-gray-700 to-gray-900 text-white')}>🏆 Leaderboard</Link>

          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-4 mb-1">Explore</p>
          <Link to="/dashboard/concept-map"  className={getLinkClass('/concept-map', 'from-green-400 to-teal-500')}>🧠 Concept Map</Link>
          <Link to="/dashboard/saved-links"  className={getLinkClass('/saved-links', 'from-amber-400 to-yellow-500')}>🔗 Saved Links</Link>
          {(user?.role === 'teacher' || user?.role === 'admin') && (
            <Link to="/dashboard/teacher"    className={getLinkClass('/teacher', 'from-red-400 to-rose-500 text-white')}>🏫 Teacher</Link>
          )}
        </nav>

        {/* Profile Button at bottom */}
        <div className="p-4 border-t border-gray-100">
          <Link to="/dashboard/profile"
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-violet-50 transition-all hover:shadow-sm">
            <div className="w-9 h-9 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold flex items-center justify-center text-sm flex-shrink-0">
              {user?.fullName?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 text-left overflow-hidden">
              <p className="font-bold text-sm leading-none truncate">{user?.fullName || 'Scholar'}</p>
              <p className="text-xs text-gray-500 mt-0.5">Std {user?.std} · {user?.board}</p>
            </div>
            {sideStreak > 0 && (
              <div className="text-right">
                <span className="text-sm">🔥</span>
                <span className="font-bold text-xs">{sideStreak}</span>
              </div>
            )}
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
        <AnimatePresence mode="wait">
          <motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.12 }}>
            <Routes location={location}>
              <Route path="/"                           element={<HomeHub />} />
              <Route path="/home"                       element={<HomeHub />} />
              <Route path="/topic"                      element={<TopicPage />} />
              <Route path="/learn/:subject/:chapter"    element={<LearnPage />} />
              <Route path="/quiz/:subject/:chapter"     element={<QuizPage />} />
              <Route path="/progress"                   element={<ProgressPage />} />
              <Route path="/saved-links"                element={<SavedLinksPage />} />
              <Route path="/leaderboard"                element={<LeaderboardPage />} />
              <Route path="/concept-map"                element={<KnowledgeGraphPage />} />
              <Route path="/review"                     element={<SpacedRepetitionPage />} />
              <Route path="/teacher"                    element={<TeacherDashboard />} />
              <Route path="/profile"                    element={<ProfilePage />} />
              <Route path="/achievements"              element={<AchievementsPage />} />
              <Route path="/quick-quiz"                element={<QuickQuizPage />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
        <ToastContainer />
      </main>

    </div>
  );
};

export default DashboardExtended;
