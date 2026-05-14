import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { backendUrl } from '../config/api';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(backendUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      let data;
      if (response.ok) {
        data = await response.json();
      } else {
        try {
          data = await response.json();
        } catch {
          data = { error: await response.text() };
        }
      }
      if (!response.ok) {
        setError(data.error || 'Failed to login');
      } else {
        setError('');
        localStorage.setItem('token', data.token);
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Something went wrong in the learning lab! Try again in a moment. ⚡');
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => { if (error) setError(''); };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-amber-50">
      <nav className="flex justify-between items-center p-6 border-b-4 border-black bg-white">
        <div className="font-black text-2xl tracking-tighter">AI TUTOR</div>
        <div className="space-x-6 font-bold text-sm text-black">
          <Link to="/login" className="hover:underline">LOGIN</Link>
          <Link to="/signup" className="hover:underline">SIGNUP</Link>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center p-8 relative">
        {/* Floating background elements */}
        <div className="absolute top-20 left-20 hidden md:block w-48 h-48 card-bub-solid bg-gradient-to-r from-pink-500 to-rose-500 p-4 transform -rotate-6 z-0 flex flex-col justify-between">
          <p className="font-black text-sm uppercase">"Mistakes are proof that you are trying!"</p>
          <div className="flex gap-1 text-2xl">⭐⭐⭐</div>
        </div>
        
        <div className="card-bub-solid w-full max-w-md bg-white p-10 z-10 mx-auto transform hover:-translate-y-1 hover:scale-105 transition-transform duration-200">
          <div className="text-center mb-10 relative">
            <span className="absolute -top-12 -right-8 text-6xl transform rotate-12 ">⭐</span>
            <h1 className="text-4xl font-black mb-2 uppercase tracking-tight">Welcome Back,<br/>Scholar!</h1>
            <p className="font-medium text-gray-600 font-sans">Ready to dive into another session?</p>
          </div>

          <form className="space-y-6" onSubmit={handleLogin}>
            
            {error && (
              <div className="card-bub-solid bg-red-400 p-4 font-bold text-white mb-4">
                {error}
              </div>
            )}

            <div>
              <label className="block font-black text-sm uppercase mb-2">@ Email Address</label>
              <input 
                type="email" 
                placeholder="student@academy.edu" 
                className="input-bub w-full font-medium"
                value={email}
                onChange={e => { setEmail(e.target.value); clearError(); }}
                required
                autoFocus
              />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block font-black text-sm uppercase">🔒 Password</label>
                
              </div>
              <input 
                type="password" 
                placeholder="••••••••" 
                className="input-bub w-full font-medium tracking-widest"
                value={password}
                onChange={e => { setPassword(e.target.value); clearError(); }}
                required
              />
            </div>

            <div className="flex items-center gap-3 opacity-50">
              <input type="checkbox" id="stay-signed" className="w-5 h-5 border border-gray-200 accent-violet-500 rounded-2xl" disabled />
              <label htmlFor="stay-signed" className="font-bold text-xs uppercase text-gray-400">Stay Signed In (coming soon)</label>
            </div>
            
            <button type="submit" disabled={loading} className="btn-bub-primary w-full py-4 text-xl mt-4 disabled:opacity-50">
              {loading ? '⏳ Signing in...' : "Let's Go! →"}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t-2 border-black text-center">
            <p className="font-bold border-2 border-transparent text-xs uppercase mb-4">Don't have an account yet?</p>
            <Link to="/signup">
              <button className="card-bub-solid w-full py-3 bg-gradient-to-r from-blue-400 to-cyan-400 font-bold tracking-wider hover:bg-blue-300">
                JOIN THE ACADEMY
              </button>
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-xs font-bold uppercase tracking-wider">
        © {new Date().getFullYear()} AI TUTOR ACADEMY • MADE FOR CREATORS
      </footer>
    </div>
  );
};

export default LoginPage;
