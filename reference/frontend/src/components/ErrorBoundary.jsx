import { Component } from 'react';
import { Link } from 'react-router-dom';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <span className="text-7xl block mb-6">🛠️</span>
            <h1 className="text-3xl font-black mb-4">Something went wrong!</h1>
            <p className="text-gray-600 font-medium mb-2">Don't worry — our AI tutor is on it!</p>
            <p className="text-gray-500 text-sm mb-8">Just head back home and try again.</p>
            <Link to="/dashboard" className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold px-8 py-4 rounded-full text-lg shadow-lg hover:shadow-xl transition-all inline-block">
              🏠 Go Home
            </Link>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
