/**
 * AppExtended — Extended App entry point with Knowledge Graph + Spaced Repetition features.
 * 
 * To use this instead of the original App.jsx, update main.jsx to import from:
 *   import App from './AppExtended'
 * instead of:
 *   import App from './App'
 */
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import Dashboard from './pages/Dashboard';

function AppExtended() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/dashboard/*" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}

export default AppExtended;
