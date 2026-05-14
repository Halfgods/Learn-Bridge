import { Routes, Route, Navigate } from 'react-router-dom';
import TopicPage from '../../pages/TopicPage';
import LearnPage from '../../pages/LearnPage';
import QuizPage from '../../pages/QuizPage';
import ProgressPage from '../../pages/ProgressPage';
import SavedLinksPage from '../../pages/SavedLinksPage';
import LeaderboardPage from '../../pages/LeaderboardPage';
import KnowledgeGraphPage from '../../pages/KnowledgeGraphPage';
import SpacedRepetitionPage from '../../pages/SpacedRepetitionPage';
import FeynmanPage from '../../pages/FeynmanPage';

const DashboardRoutes = () => (
  <Routes>
    <Route path="/" element={<Navigate to="/dashboard/topic" replace />} />
    <Route path="/topic" element={<TopicPage />} />
    <Route path="/learn/:subject/:chapter" element={<LearnPage />} />
    <Route path="/quiz/:subject/:chapter" element={<QuizPage />} />
    <Route path="/progress" element={<ProgressPage />} />
    <Route path="/saved-links" element={<SavedLinksPage />} />
    <Route path="/leaderboard" element={<LeaderboardPage />} />
    <Route path="/concept-map" element={<KnowledgeGraphPage />} />
    <Route path="/review" element={<SpacedRepetitionPage />} />
    <Route path="/feynman" element={<FeynmanPage />} />
  </Routes>
);

export default DashboardRoutes;
