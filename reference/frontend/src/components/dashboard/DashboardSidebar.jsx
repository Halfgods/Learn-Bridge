import { Link } from 'react-router-dom';
import { dashboardNavItems } from '../../config/navigation';

const DashboardSidebar = ({ user, currentPath, onProfileClick }) => {
  const getLinkClass = (match, bgColorClass) => {
    let isActive = currentPath.includes(match);
    if (match === '/topic' && currentPath.endsWith('/dashboard')) isActive = true;
    return `block p-4 border-4 transition-transform active:translate-y-1 active:translate-x-1 font-black uppercase text-lg ${isActive ? `border-black ${bgColorClass} shadow-neo` : 'border-transparent hover:border-black bg-white hover:bg-gray-100'}`;
  };

  return (
    <aside className="w-72 border-r-4 border-black bg-white flex flex-col z-20">
      <div className="p-8 border-b-4 border-black bg-neo-pink text-white">
        <Link to="/" className="font-black text-3xl tracking-tighter block hover:underline drop-shadow-[2px_2px_0px_#000]">AI TUTOR</Link>
      </div>
      <nav className="flex-1 p-6 space-y-4 flex flex-col overflow-y-auto">
        {dashboardNavItems.map(item => (
          <Link key={item.to} to={item.to} className={getLinkClass(item.match, item.activeClass)}>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-6 border-t-4 border-black">
        <button
          onClick={onProfileClick}
          className="w-full flex items-center gap-4 border-4 border-black p-4 bg-neo-bg hover:bg-neo-yellow hover:shadow-neo transition-all active:translate-y-1 active:translate-x-1"
        >
          <div className="w-10 h-10 rounded-full border-4 border-black bg-neo-pink text-white font-black flex items-center justify-center text-lg flex-shrink-0">
            {user?.fullName?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="text-left overflow-hidden">
            <p className="font-black uppercase text-sm leading-none truncate">{user?.fullName || 'Scholar'}</p>
            <p className="text-xs font-bold text-gray-500 mt-1">Std {user?.std} · {user?.board}</p>
          </div>
        </button>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
