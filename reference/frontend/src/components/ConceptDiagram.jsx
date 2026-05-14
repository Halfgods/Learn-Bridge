import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  theme: 'default',
  securityLevel: 'strict',
  themeVariables: {
    primaryColor: '#FFD500',
    primaryBorderColor: '#000',
    primaryTextColor: '#000',
    lineColor: '#000',
    secondaryColor: '#A2D2FF',
    tertiaryColor: '#FF66A1'
  }
});

const ConceptDiagram = ({ definition, caption, onError }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !definition) return;

    const el = containerRef.current;
    el.textContent = definition;

    mermaid.run({
      nodes: [el],
      suppressErrors: true
    }).catch(err => {
      console.error('Mermaid render error:', err);
      if (onError) onError(err);
      el.textContent = 'Diagram failed to render';
    });
  }, [definition, onError]);

  return (
    <div className="card-bub-solid bg-white p-4 mb-4">
      <div ref={containerRef} className="flex justify-center overflow-x-auto" />
      {caption && (
        <p className="text-xs font-bold text-gray-500 text-center mt-2 border-t-2 border-black pt-2">{caption}</p>
      )}
    </div>
  );
};

export default ConceptDiagram;
