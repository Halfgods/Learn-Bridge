import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getUser } from '../utils/auth';
import confetti from 'canvas-confetti';

const STEPS = ['Welcome', 'Your Subjects', 'First Challenge'];

const SUBJECTS = [
  { name: 'Mathematics', icon: '🔢', color: 'from-blue-400 to-blue-600' },
  { name: 'Science', icon: '🔬', color: 'from-emerald-400 to-emerald-600' },
  { name: 'English', icon: '📝', color: 'from-red-400 to-red-600' },
  { name: 'Hindi', icon: '🇮🇳', color: 'from-orange-400 to-orange-600' },
  { name: 'Social Studies', icon: '🌍', color: 'from-purple-400 to-purple-600' },
];

const onboardingComplete = () => {
  try { localStorage.setItem('onboardingDone', 'true'); } catch {}
};

const OnboardingWizard = () => {
  const navigate = useNavigate();
  const user = getUser();
  const [step, setStep] = useState(0);
  const [selectedSubjects, setSelectedSubjects] = useState(SUBJECTS.map(s => s.name));

  const toggleSubject = (name) => {
    setSelectedSubjects(prev =>
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
  };

  const handleComplete = () => {
    confetti({ particleCount: 200, spread: 160, origin: { y: 0.5 } });
    setTimeout(() => confetti({ particleCount: 100, spread: 120, origin: { y: 0.6, x: 0.3 } }), 300);
    setTimeout(() => confetti({ particleCount: 100, spread: 120, origin: { y: 0.6, x: 0.7 } }), 500);
    onboardingComplete();
    setTimeout(() => navigate('/dashboard'), 1200);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-fuchsia-50 to-amber-50 flex items-center justify-center p-6">
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="welcome" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -40 }} className="max-w-md w-full text-center">
            <span className="text-8xl block mb-6">🚀</span>
            <h1 className="text-4xl font-black mb-4">Welcome, {user?.fullName?.split(' ')[0] || 'Scholar'}!</h1>
            <p className="text-lg text-gray-600 font-medium mb-8">Your personalized AI tutor is ready. Let's set up your learning adventure!</p>
            <div className="flex gap-3 items-center justify-center mb-8">
              <div className="w-3 h-3 bg-violet-500 rounded-full" />
              <div className="w-3 h-3 bg-gray-300 rounded-full" />
              <div className="w-3 h-3 bg-gray-300 rounded-full" />
            </div>
            <button onClick={() => setStep(1)} className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold px-10 py-4 rounded-full text-lg shadow-lg hover:shadow-xl transition-all active:scale-95">
              Let's Go! 🚀
            </button>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div key="subjects" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -40 }} className="max-w-md w-full">
            <h2 className="text-3xl font-black mb-2 text-center">Pick your subjects!</h2>
            <p className="text-gray-600 font-medium mb-6 text-center">Which ones excite you? (tap to deselect)</p>
            <div className="space-y-3 mb-8">
              {SUBJECTS.map(subj => {
                const selected = selectedSubjects.includes(subj.name);
                return (
                  <button key={subj.name} onClick={() => toggleSubject(subj.name)}
                    className={`w-full p-4 rounded-2xl flex items-center gap-4 font-bold text-lg transition-all ${
                      selected ? `bg-gradient-to-r ${subj.color} text-white shadow-lg scale-[1.02]` : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                    }`}>
                    <span className="text-2xl">{subj.icon}</span>
                    <span>{subj.name}</span>
                    {selected && <span className="ml-auto">✓</span>}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3 items-center justify-center mb-6">
              <div className="w-3 h-3 bg-gray-300 rounded-full" />
              <div className="w-3 h-3 bg-violet-500 rounded-full" />
              <div className="w-3 h-3 bg-gray-300 rounded-full" />
            </div>
            <button onClick={() => setStep(2)} disabled={selectedSubjects.length === 0}
              className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold py-4 rounded-full text-lg shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50">
              Continue →
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="complete" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="max-w-md w-full text-center">
            <motion.span className="text-8xl block mb-6" animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.2, 1] }} transition={{ duration: 1 }}>🌟</motion.span>
            <h2 className="text-3xl font-black mb-4">You're all set!</h2>
            <p className="text-lg text-gray-600 font-medium mb-6">
              Your star level is <strong>🌱 Sprout</strong>. Complete quizzes and chapters to grow!
            </p>
            <div className="bg-white rounded-2xl p-6 mb-8 shadow-lg border border-gray-100">
              <p className="font-bold text-sm text-gray-500 mb-3">Your Subjects</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {selectedSubjects.map(s => (
                  <span key={s} className="bg-violet-100 text-violet-700 font-bold px-4 py-2 rounded-full text-sm">{s}</span>
                ))}
              </div>
            </div>
            <button onClick={handleComplete} className="bg-gradient-to-r from-amber-400 to-orange-400 text-white font-bold px-10 py-4 rounded-full text-lg shadow-lg hover:shadow-xl transition-all active:scale-95 animate-pulse">
              🚀 Start My Adventure!
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OnboardingWizard;
