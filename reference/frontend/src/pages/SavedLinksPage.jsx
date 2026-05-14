import { useEffect, useState } from 'react';
import { authFetch } from '../utils/auth';
import { backendUrl } from '../config/api';

const SavedLinksPage = () => {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    authFetch(backendUrl('/api/links'))
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setLinks(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load links:', err);
        setError(err.message);
        setLinks([]);
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl md:text-4xl font-black uppercase mb-6 md:mb-8 border-b-2 border-gray-200 pb-4 inline-block bg-gradient-to-r from-pink-500 to-rose-500 text-white px-4">Saved Links</h1>
      <p className="font-bold text-gray-700 mb-8 max-w-xl">
        All the external links and materials that our AI fetched for you are stored here for your quick revision!
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        {loading && (
          <div className="card-bub-solid border-dashed p-10 col-span-2 text-center font-bold uppercase">
            Loading saved links...
          </div>
        )}
        {error && (
          <div className="card-bub-solid bg-red-400 text-white p-10 col-span-2 text-center font-bold uppercase">
            Error: {error}
          </div>
        )}
        {!loading && !error && links.length === 0 && (
          <div className="card-bub-solid border-dashed p-10 col-span-2 text-center text-gray-400 font-bold uppercase">
            No Links Saved Yet. Talk to the AI to fetch and save some!
          </div>
        )}
        {links.map((link, i) => (
          <div key={link._id || i} className="card-bub-solid bg-white flex flex-col justify-between group hover:-translate-y-2 hover: p-0 overflow-hidden">
            <div className="p-6">
              <span className={`inline-block border border-gray-200 font-black text-xs uppercase px-2 py-1 mb-4 text-white ${link.source === 'youtube' ? 'bg-red-500' : 'bg-blue-500'}`}>
                {link.source === 'youtube' ? 'YouTube' : 'Shaalaa'}
              </span>
              <h3 className="font-black text-xl mb-2">{link.title}</h3>
            </div>
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className={`border-t-4 border-black p-4 font-black uppercase flex justify-between items-center transition-colors ${link.source === 'youtube' ? 'bg-gradient-to-r from-amber-400 to-orange-400 hover:bg-yellow-300' : 'bg-emerald-400 hover:bg-green-400'}`}
            >
              <span>{link.source === 'youtube' ? 'Watch Now' : 'Read Material'}</span>
              <span className="text-xl">{link.source === 'youtube' ? '▶️' : '📚'}</span>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SavedLinksPage;
