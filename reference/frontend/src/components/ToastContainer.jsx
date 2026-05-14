import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

let toastId = 0;
let addToastGlobal = null;

export function addToast(message, type = 'success', duration = 3000) {
  if (addToastGlobal) {
    addToastGlobal({ id: ++toastId, message, type, duration });
  }
}

const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  const add = useCallback((toast) => {
    setToasts(prev => [...prev, toast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toast.id));
    }, toast.duration);
  }, []);

  useEffect(() => {
    addToastGlobal = add;
    return () => { addToastGlobal = null; };
  }, [add]);

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.9 }}
            className={`pointer-events-auto px-5 py-3 rounded-2xl shadow-xl border font-bold text-sm flex items-center gap-2 ${
              t.type === 'success' ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white border-green-600' :
              t.type === 'xp' ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white border-amber-600' :
              t.type === 'achievement' ? 'bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white border-violet-700' :
              'bg-white text-gray-800 border-gray-200'
            }`}
          >
            {t.type === 'xp' && '⭐'}
            {t.type === 'achievement' && '🏆'}
            {t.type === 'success' && '✅'}
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ToastContainer;
