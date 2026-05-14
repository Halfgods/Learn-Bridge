import { Link } from 'react-router-dom';

const NotFoundPage = () => (
  <div className="min-h-screen bg-gradient-to-br from-violet-50 via-fuchsia-50 to-amber-50 flex items-center justify-center p-6">
    <div className="text-center max-w-md">
      <span className="text-8xl block mb-6">🔍</span>
      <h1 className="text-5xl font-black mb-4">Oops!</h1>
      <p className="text-xl text-gray-600 font-medium mb-2">This page wandered off!</p>
      <p className="text-gray-500 mb-8">Don't worry — even the best explorers get lost sometimes.</p>
      <div className="flex gap-4 justify-center">
        <Link to="/" className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold px-8 py-4 rounded-full text-lg shadow-lg hover:shadow-xl transition-all">🏠 Go Home</Link>
        <Link to="/dashboard" className="bg-white font-bold px-8 py-4 rounded-full text-lg shadow-lg border border-gray-200 hover:shadow-xl transition-all">📚 Dashboard</Link>
      </div>
    </div>
  </div>
);

export default NotFoundPage;
