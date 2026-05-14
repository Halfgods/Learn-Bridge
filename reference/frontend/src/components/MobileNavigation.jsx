import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getUser } from '../utils/auth';

const TABS = [
  { path: '/dashboard', icon: '🏠', label: 'Home' },
  { path: '/dashboard/topic', icon: '📚', label: 'Learn' },
  { path: '/dashboard/progress', icon: '⭐', label: 'Progress' },
  { path: '/dashboard/review', icon: '🔔', label: 'Review' },
  { path: '/dashboard/profile', icon: '👤', label: 'Profile' },
];

const DRAWER_ITEMS = [
  { path: '/dashboard/quick-quiz', icon: '⚡', label: 'Quick Quiz' },
  { path: '/dashboard/concept-map', icon: '🧠', label: 'Concept Map' },
  { path: '/dashboard/achievements', icon: '🏆', label: 'Achievements' },
  { path: '/dashboard/saved-links', icon: '🔗', label: 'Saved Links' },
  { path: '/dashboard/leaderboard', icon: '🏆', label: 'Leaderboard' },
];

const MobileNavigation = () => {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const user = getUser();
  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';

  const isActive = (path) => {
    const cur = location.pathname;
    if (path === '/dashboard/topic') {
      return cur === '/dashboard/topic' || cur.startsWith('/dashboard/learn') || cur.startsWith('/dashboard/quiz');
    }
    return cur.startsWith(path);
  };

  return (
    <>
      <button
        onClick={() => setDrawerOpen(true)}
        className="fixed top-3 left-3 z-40 min-w-[44px] min-h-[44px] flex items-center justify-center bg-white border border-gray-200 shadow-lg lg:hidden"
        aria-label="Open menu"
      >
        <span className="text-xl">☰</span>
      </button>

      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed top-0 left-0 bottom-0 w-72 z-50 bg-white border-r-4 border-black flex flex-col"
            >
              <div className="p-6 border-b-4 border-black bg-gradient-to-r from-pink-500 to-rose-500 text-white">
                <div className="flex items-center justify-between">
                  <Link to="/dashboard/topic" onClick={() => setDrawerOpen(false)} className="font-black text-2xl tracking-tighter">AI TUTOR</Link>
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white font-black text-xl"
                    aria-label="Close menu"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                {DRAWER_ITEMS.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setDrawerOpen(false)}
                    className={`flex items-center gap-4 min-h-[44px] px-4 font-black uppercase text-base transition-all active:translate-y-0.5 active:translate-x-0.5 ${
                      isActive(item.path)
                        ? 'bg-gradient-to-r from-blue-400 to-cyan-400 border border-gray-200 shadow-md'
                        : 'hover:bg-gray-100 border-2 border-transparent'
                    }`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
                {isTeacher && (
                  <Link
                    to="/dashboard/teacher"
                    onClick={() => setDrawerOpen(false)}
                    className={`flex items-center gap-4 min-h-[44px] px-4 font-black uppercase text-base transition-all active:translate-y-0.5 active:translate-x-0.5 ${
                      isActive('/dashboard/teacher')
                        ? 'bg-gradient-to-r from-red-400 to-red-500 text-white border border-gray-200 shadow-md'
                        : 'hover:bg-gray-100 border-2 border-transparent'
                    }`}
                  >
                    <span className="text-lg">🏫</span>
                    <span>Teacher Dashboard</span>
                  </Link>
                )}
              </nav>
              <div className="p-4 border-t-4 border-black">
                <Link
                  to="/dashboard/profile"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 min-h-[44px] px-4 font-bold text-sm hover:bg-amber-50"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-black flex items-center justify-center flex-shrink-0">
                    {user?.fullName?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-black uppercase text-sm leading-none truncate">{user?.fullName || 'Scholar'}</p>
                    <p className="text-xs font-bold text-gray-500 mt-0.5">Std {user?.std} · {user?.board}</p>
                  </div>
                </Link>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t-4 border-black lg:hidden safe-area-bottom">
        <div className="flex">
          {TABS.map((tab) => (
            <Link
              key={tab.label}
              to={tab.path}
              className={`flex-1 flex flex-col items-center justify-center min-h-[56px] py-1.5 transition-all ${
                isActive(tab.path)
                  ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-black -translate-y-0.5'
                  : 'text-gray-500 hover:text-black hover:bg-gray-50'
              }`}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              <span className="text-[10px] font-black uppercase leading-tight mt-0.5">{tab.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
};

export default MobileNavigation;
