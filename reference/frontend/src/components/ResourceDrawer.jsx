import { motion, AnimatePresence } from 'framer-motion';

const ResourceDrawer = ({ open, onClose, children }) => {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/30"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-4 border-black rounded-t-3xl max-h-[70vh] flex flex-col safe-area-bottom"
          >
            <div className="flex items-center justify-between p-4 border-b-2 border-gray-200 shrink-0">
              <h2 className="font-black uppercase text-lg">📎 Resources</h2>
              <button
                onClick={onClose}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center font-black text-xl hover:bg-gray-100"
                aria-label="Close resources"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 pb-8 space-y-3">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ResourceDrawer;
