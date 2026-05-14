const PdfViewer = ({ directUrl, title, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
    <div className="card-bub-solid bg-white max-w-lg w-full p-8 text-center" onClick={e => e.stopPropagation()}>
      <span className="text-6xl block mb-4">📖</span>
      <h3 className="font-black text-2xl uppercase mb-2">{title || 'NCERT Textbook'}</h3>
      <p className="font-bold text-gray-600 mb-6">
        NCERT doesn't allow embedded viewing. Open in a new tab or download to read!
      </p>
      <div className="flex gap-3 justify-center">
        <a href={directUrl} target="_blank" rel="noreferrer" className="btn-bub-primary px-8 py-4 text-base">
          📥 Open in New Tab
        </a>
        <a href={directUrl} target="_blank" rel="noreferrer" download className="btn-bub-secondary px-8 py-4 text-base">
          💾 Download PDF
        </a>
      </div>
      <button onClick={onClose} className="mt-4 text-sm font-bold text-gray-400 hover:text-gray-600 underline">
        Close
      </button>
    </div>
  </div>
);

export default PdfViewer;
