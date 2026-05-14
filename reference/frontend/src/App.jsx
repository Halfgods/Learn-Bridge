import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { getToken } from './utils/auth';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardExtended from './pages/DashboardExtended';
import EthicsPage from './pages/EthicsPage';
import OnboardingWizard from './pages/OnboardingWizard';
import NotFoundPage from './pages/NotFoundPage';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <Router>
      <ErrorBoundary>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/onboarding" element={<OnboardingWizard />} />
        <Route path="/ethics" element={<EthicsPage />} />
        <Route path="/dashboard/*" element={getToken() ? <DashboardExtended /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
