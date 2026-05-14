const ProfileModal = ({ user, onClose, onLogout }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
    <div className="absolute inset-0 bg-black/40" />
    <div
      className="relative card-neo bg-white max-w-sm w-full p-0 overflow-hidden z-10"
      onClick={e => e.stopPropagation()}
    >
      <div className="bg-neo-pink p-8 text-white relative">
        <button onClick={onClose} className="absolute top-4 right-4 font-black text-xl border-2 border-white w-8 h-8 flex items-center justify-center hover:bg-white hover:text-black transition-colors">✕</button>
        <div className="w-20 h-20 rounded-full border-4 border-white bg-neo-yellow flex items-center justify-center text-4xl font-black text-black shadow-[4px_4px_0_0_rgba(0,0,0,0.3)] mb-4">
          {user?.fullName?.[0]?.toUpperCase() || '?'}
        </div>
        <h2 className="text-2xl font-black uppercase">{user?.fullName}</h2>
        <p className="font-bold opacity-80 text-sm">Active Scholar</p>
      </div>

      <div className="divide-y-4 divide-black border-t-4 border-black">
        <div className="flex justify-between items-center p-5">
          <span className="font-black uppercase text-xs text-gray-500">Standard</span>
          <span className="font-black text-xl bg-neo-yellow border-2 border-black px-3 py-1">Grade {user?.std}</span>
        </div>
        <div className="flex justify-between items-center p-5">
          <span className="font-black uppercase text-xs text-gray-500">Board</span>
          <span className="font-black text-xl bg-neo-blue border-2 border-black px-3 py-1">{user?.board}</span>
        </div>
      </div>

      <div className="p-6 border-t-4 border-black">
        <button
          onClick={onLogout}
          className="w-full btn-neo py-4 text-lg bg-red-400 hover:bg-red-500 text-black"
        >
          🚪 Logout
        </button>
      </div>
    </div>
  </div>
);

export default ProfileModal;
