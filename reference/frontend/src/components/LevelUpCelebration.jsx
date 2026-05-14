import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

const EMOJIS = ['🌟', '⭐', '✨', '🎉', '🎊', '💫'];

const LevelUpCelebration = ({ show, starName, starLevel, subject, onClose }) => {
  useEffect(() => {
    if (!show) return;

    // Confetti bursts
    const burst1 = setTimeout(() => confetti({ particleCount: 200, spread: 120, origin: { y: 0.6 } }), 100);
    const burst2 = setTimeout(() => confetti({ particleCount: 150, spread: 160, origin: { y: 0.5, x: 0.3 } }), 500);
    const burst3 = setTimeout(() => confetti({ particleCount: 150, spread: 160, origin: { y: 0.5, x: 0.7 } }), 800);

    return () => { clearTimeout(burst1); clearTimeout(burst2); clearTimeout(burst3); };
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: 'spring', damping: 12 }}
            className="bg-white rounded-3xl p-10 max-w-md w-full mx-4 text-center shadow-2xl border-4 border-amber-300"
            onClick={e => e.stopPropagation()}
          >
            {/* Emoji rain */}
            <div className="relative h-20 mb-4">
              {EMOJIS.map((emoji, i) => (
                <motion.span
                  key={i}
                  className="absolute text-3xl"
                  initial={{ y: 60, x: -40 + i * 20, opacity: 0 }}
                  animate={{ y: -20, opacity: [0, 1, 1, 0], rotate: [0, 360] }}
                  transition={{ duration: 2, delay: i * 0.15, ease: 'easeOut' }}
                >
                  {emoji}
                </motion.span>
              ))}
            </div>

            <motion.span
              className="text-7xl block mb-4"
              animate={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 0.8 }}
            >
              🌟
            </motion.span>

            <h2 className="text-3xl font-black uppercase tracking-tight mb-2">Level Up!</h2>
            <p className="text-xl font-bold text-gray-600 mb-2">
              You reached <span className="text-amber-600">{starName}</span> in {subject}!
            </p>

            <div className="w-full h-4 bg-gray-100 rounded-full mt-6 mb-4 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
              />
            </div>

            <p className="text-sm font-bold text-gray-500 mb-6">
              New chapters unlocked! Keep learning to reach the next level! 🚀
            </p>

            <button
              onClick={onClose}
              className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold px-8 py-4 rounded-full text-lg shadow-lg hover:shadow-xl transition-all active:scale-95"
            >
              Continue Learning! 🚀
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LevelUpCelebration;
