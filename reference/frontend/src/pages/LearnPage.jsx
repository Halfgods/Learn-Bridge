import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authFetch, getUser } from '../utils/auth';
import { backendUrl, linksUrl } from '../config/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { motion, AnimatePresence } from 'framer-motion';
import ConceptDiagram from '../components/ConceptDiagram';
import ResourceDrawer from '../components/ResourceDrawer';

const splitThoughtAndReply = (rawText = '') => {
  const source = String(rawText || '')
    .replace(/&lt;\s*think\s*&gt;/gi, '<think>')
    .replace(/&lt;\s*\/\s*think\s*&gt;/gi, '</think>');
  const openTag = '<think>';
  const closeTag = '</think>';
  const hasThinkTags = source.includes(openTag) || source.includes(closeTag);

  const thoughts = [];
  let reply = '';
  let cursor = 0;

  while (cursor < source.length) {
    const openIndex = source.indexOf(openTag, cursor);
    if (openIndex === -1) {
      reply += source.slice(cursor);
      break;
    }

    reply += source.slice(cursor, openIndex);
    const thoughtStart = openIndex + openTag.length;
    const closeIndex = source.indexOf(closeTag, thoughtStart);

    if (closeIndex === -1) {
      thoughts.push(source.slice(thoughtStart).trim());
      cursor = source.length;
      break;
    }

    thoughts.push(source.slice(thoughtStart, closeIndex).trim());
    cursor = closeIndex + closeTag.length;
  }

  const finalReply = reply.trim();
  const finalThoughts = thoughts.filter(Boolean).join('\n\n').trim();

  if (!hasThinkTags) {
    return {
      reply: source.trim(),
      thoughts: undefined
    };
  }

  return {
    reply: finalReply,
    thoughts: finalThoughts || undefined
  };
};

const markdownComponents = {
  a: ({ href, children, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline font-semibold break-all"
      {...props}
    >
      {children}
    </a>
  ),
  img: ({ src, alt, ...props }) => (
    <a href={src} target="_blank" rel="noreferrer" className="inline-block my-2">
      <img
        src={src}
        alt={alt || 'visual'}
        className="card-bub-solid max-h-64 object-contain"
        {...props}
      />
    </a>
  )
};

const LearnPage = () => {
  const { subject, chapter } = useParams();
  const navigate = useNavigate();
  const user = getUser();
  const std = user?.std || 10;
  const board = user?.board || 'CBSE';
  const [messages, setMessages] = useState([
    { role: 'ai', text: `Hi! Let's learn about ${chapter} in ${subject}. What do you want to know?` }
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
  const [images, setImages] = useState([]);
  const [extraLinks, setExtraLinks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [feedbacks, setFeedbacks] = useState({});
  const [diagrams, setDiagrams] = useState([]);
  const [loadingDiagrams, setLoadingDiagrams] = useState(false);
  const [isTeaching, setIsTeaching] = useState(false);
  const [showResourceDrawer, setShowResourceDrawer] = useState(false);
  const [viewMode, setViewMode] = useState('chat'); // 'chat' | 'split' | 'resources'
  const [loadingMessage] = useState(() => {
    const msgs = [
      'Warming up the AI brain... 🧠',
      'Consulting the knowledge database... 📚',
      'Summoning learning vibes... ✨',
      'Sharpening the virtual pencil... ✏️',
      'Brewing fresh knowledge... ☕',
      'Polishing the explanation... 💎',
      'Connecting brain cells... 🔗',
      'Almost there, superstar! ⭐',
      'Making learning magical... 🪄',
      'Preparing mind-blowing facts... 🤯'
    ];
    return msgs[Math.floor(Math.random() * msgs.length)];
  });
  const bottomRef = useRef(null);
  const knownConceptsRef = useRef(new Set());

  const CONCEPT_KEYWORDS = [
    'photosynthesis', 'water cycle', 'digestive system', 'pythagoras',
    'electric circuit', 'solar system', 'food chain', 'triangles',
    'respiration', 'gravity', 'magnetism', 'fractions', 'angles',
    'butterfly', 'heart', 'moon phases'
  ];

  const fetchDiagramsForConcept = useCallback(async (concept) => {
    if (!subject || knownConceptsRef.current.has(concept.toLowerCase())) return;
    knownConceptsRef.current.add(concept.toLowerCase());
    setLoadingDiagrams(true);
    try {
      const res = await fetch(
        backendUrl(`/api/knowledge-graph/diagrams?std=${std}&board=${board}&subject=${encodeURIComponent(subject)}&concept=${encodeURIComponent(concept)}`)
      );
      const data = await res.json();
      if (data.diagrams && data.diagrams.length > 0) {
        setDiagrams(prev => {
          const existing = new Set(prev.map(d => d.conceptName));
          const newOnes = data.diagrams.filter(d => !existing.has(d.conceptName));
          return [...prev, ...newOnes];
        });
      }
    } catch (err) {
      console.error('Diagram fetch error:', err);
    }
    setLoadingDiagrams(false);
  }, [std, board, subject]);

  // Auto-fetch all diagrams for the chapter on load
  useEffect(() => {
    if (!subject) return;
    const controller = new AbortController();
    fetch(
      backendUrl(`/api/knowledge-graph?std=${std}&board=${board}&subject=${encodeURIComponent(subject)}`),
      { signal: controller.signal }
    )
      .then(r => r.ok ? r.json() : null)
      .then(graph => {
        if (graph?.conceptDiagrams?.length > 0) {
          const chapterLower = (chapter || '').toLowerCase();
          const subjectDiagrams = graph.conceptDiagrams.filter(d => {
            const name = d.conceptName.toLowerCase();
            return chapterLower.includes(name) || name.includes(chapterLower);
          });
          const matchedDiagrams = subjectDiagrams.length > 0 ? subjectDiagrams : graph.conceptDiagrams.slice(0, 3);
          if (matchedDiagrams.length > 0) {
            setDiagrams(matchedDiagrams);
          }
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [std, board, subject, chapter]);

  const detectConcepts = useCallback((text) => {
    if (!text) return;
    const lower = text.toLowerCase();
    CONCEPT_KEYWORDS.forEach(keyword => {
      if (lower.includes(keyword)) {
        fetchDiagramsForConcept(keyword);
      }
    });
  }, [fetchDiagramsForConcept]);

  const persistLinks = async (linksArray, source) => {
    const seen = new Set();
    const uniqueLinks = linksArray.filter((l) => {
      if (!l.url || !l.url.startsWith('http') || seen.has(l.url)) return false;
      seen.add(l.url);
      return true;
    });

    await Promise.allSettled(
      uniqueLinks.map((link) =>
        authFetch(backendUrl('/api/links'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: link.url,
            title: link.title || (source === 'youtube' ? 'YouTube Resource' : 'Shaalaa Resource'),
            source: source
          })
        })
      )
    );
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, images, extraLinks]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    setIsLoading(true);
    const userMessage = { role: 'user', text: input };
    detectConcepts(input);
    setMessages(prev => [...prev, userMessage, { role: 'ai', text: loadingMessage, isPlaceholder: true }]);
    const currentInput = input;
    setInput('');
    
    // Background query for images from python backend
    fetch(linksUrl(`/imglinks?query=${encodeURIComponent(`${subject} ${chapter} ${currentInput}`)}`))
      .then(res => res.json())
      .then(data => { if(data.images) setImages(data.images); })
      .catch(console.error);

    // If external links toggle is ON
    if (showLinks) {
       fetch(linksUrl(`/ytlinks?std=${std}&query=${encodeURIComponent(currentInput)}`))
        .then(res => res.json())
        .then(async (data) => {
          if (!data.videos) return;

          const videos = data.videos
            .map((v) => {
              if (typeof v === 'string') {
                return { url: v, title: 'YouTube Resource' };
              }
              return {
                url: v?.url || v?.content || '',
                title: v?.title || 'YouTube Resource'
              };
            })
            .filter((v) => v.url);

          setExtraLinks(prev => [
            ...prev,
            ...videos.map((v) => ({ type: 'yt', url: v.url, title: v.title }))
          ]);
          await persistLinks(videos, 'youtube');
        })
        .catch(console.error);

       fetch(linksUrl(`/shaalaalinks?std=${std}&query=${encodeURIComponent(currentInput)}`))
        .then(res => res.json())
        .then(async data => { 
          if(data.links) {
            const sLinks = data.links.map(l => ({ type: 'shaalaa', url: l, title: 'Shaalaa Resource' }));
            setExtraLinks(prev => [...prev, ...sLinks]); 
            await persistLinks(sLinks, 'shaalaa');
          }
        })
        .catch(console.error);
    }

    const updateLatestAiMessage = (text, thoughts) => {
      detectConcepts(text);
      setMessages(prev => {
        const next = [...prev];
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].role === 'ai') {
            next[i] = {
              ...next[i],
              text,
              thoughts: thoughts ?? next[i].thoughts,
              isPlaceholder: false
            };
            break;
          }
        }
        return next;
      });
    };

    try {
      const endpoint = isTeaching ? '/api/feynman/chat' : '/api/chat';
      const body = isTeaching
        ? JSON.stringify({ concept: chapter, subject, chapter: chapter, std, board, messages: [...messages, userMessage] })
        : JSON.stringify({ prompt: currentInput, isThinking, subject, chapter, std, board });

      const response = await authFetch(backendUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });

      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        if (contentType.includes('application/json')) {
          const data = await response.json();
          updateLatestAiMessage(data.error || 'Whoops! My AI brain is taking a nap. ☕ Try asking again!');
        } else {
          const text = await response.text();
          updateLatestAiMessage(text || 'Whoops! My AI brain is taking a nap. ☕ Try asking again!');
        }
        return;
      }

      if (contentType.includes('application/json')) {
        const data = await response.json();
        if (data.error) {
          updateLatestAiMessage(data.error);
          return;
        }

        const parsed = splitThoughtAndReply(data.reply || '');
        const mergedThoughts = data.thoughts ?? parsed.thoughts;
        const finalReply = parsed.reply || (mergedThoughts ? 'Here is how I think about it! 🧠' : '');
        updateLatestAiMessage(finalReply, mergedThoughts, data.confidence);
        return;
      }

      if (!response.body) {
        const text = await response.text();
        const parsed = splitThoughtAndReply(text || '');
        const finalReply = parsed.reply || (parsed.thoughts ? 'Here is how I think about it! 🧠' : "Hmm, I did not catch that. Can you rephrase your question? 🧠");
        updateLatestAiMessage(finalReply, parsed.thoughts);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamedText = '';
      let streamedThoughts = '';
      let sseBuffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const decoded = decoder.decode(value, { stream: true });

        if (contentType.includes('text/event-stream')) {
          sseBuffer += decoded;

          let boundaryIndex = sseBuffer.indexOf('\n\n');
          while (boundaryIndex !== -1) {
            const rawEvent = sseBuffer.slice(0, boundaryIndex);
            sseBuffer = sseBuffer.slice(boundaryIndex + 2);

            let eventType = 'message';
            const dataLines = [];
            for (const line of rawEvent.split('\n')) {
              if (line.startsWith('event:')) {
                eventType = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                dataLines.push(line.slice(5).trimStart());
              }
            }

            const rawData = dataLines.join('\n');
            let payload = {};
            if (rawData) {
              try {
                payload = JSON.parse(rawData);
              } catch {
                payload = { text: rawData };
              }
            }

            if (eventType === 'token' && payload.text) {
              streamedText += payload.text;
              const parsed = splitThoughtAndReply(streamedText);
              const thoughtText = [streamedThoughts, parsed.thoughts].filter(Boolean).join('\n\n').trim() || undefined;
              updateLatestAiMessage(parsed.reply || 'Thinking…', thoughtText);
            } else if (eventType === 'thought' && payload.text) {
              streamedThoughts += payload.text;
              const parsed = splitThoughtAndReply(streamedText);
              updateLatestAiMessage(parsed.reply || 'Thinking…', streamedThoughts.trim());
            } else if (eventType === 'error') {
              updateLatestAiMessage(payload.message || 'Whoops! My AI brain is taking a nap. ☕ Try asking again!');
              return;
            }

            boundaryIndex = sseBuffer.indexOf('\n\n');
          }
        } else {
          streamedText += decoded;
          const parsed = splitThoughtAndReply(streamedText);
          updateLatestAiMessage(parsed.reply || 'Thinking…', parsed.thoughts);
        }
      }

      streamedText += decoder.decode();
      const parsed = splitThoughtAndReply(streamedText);
      const finalThoughts = [streamedThoughts, parsed.thoughts].filter(Boolean).join('\n\n').trim() || undefined;
      if (!parsed.reply && !finalThoughts) {
        updateLatestAiMessage("Hmm, I did not catch that. Can you rephrase your question? 🧠");
      } else {
        updateLatestAiMessage(parsed.reply || 'Here is how I think about it! 🧠', finalThoughts);
      }
    } catch (err) {
      console.error('Chat API error:', err);
      updateLatestAiMessage('Whoops! My AI brain is taking a nap. ☕ Try asking again!');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedback = async (messageId, rating, confidence) => {
    if (feedbacks[messageId]) return;
    setFeedbacks(prev => ({ ...prev, [messageId]: rating }));
    try {
      await authFetch(backendUrl('/api/feedback'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, rating, confidence })
      });
    } catch (err) {
      console.error('Feedback error:', err);
    }
  };

  const renderResources = () => (
    <>
      <AnimatePresence>
        {diagrams.map((d, i) => (
          <motion.div
            key={d.conceptName}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
          >
            <ConceptDiagram
              definition={d.mermaidDefinition}
              caption={d.caption}
            />
          </motion.div>
        ))}
      </AnimatePresence>
      {loadingDiagrams && (
        <div className="card-bub-solid bg-white p-4 animate-pulse">
          <div className="h-24 bg-gray-200 border border-gray-200" />
        </div>
      )}
          {images.filter(img => img && img.startsWith('http')).map((img, i) => (
             <a key={i} href={img} target="_blank" rel="noreferrer" className="block">
               <img src={img} alt={`Visual for ${chapter}`} className="bg-white border border-gray-200 rounded-xl w-full object-cover max-h-48 hover:opacity-80 transition-opacity" onError={(e) => { e.target.style.display='none'; }} />
             </a>
          ))}
          {extraLinks.filter(l => l.url && l.url.startsWith('http')).map((link, i) => (
            <a key={i} href={link.url} target="_blank" rel="noreferrer" className="block bg-white border border-gray-200 rounded-xl p-4 font-bold text-sm hover:shadow-md transition-all break-words">
              <span className="mr-2">{link.type === 'yt' ? '🎬' : '📚'}</span>
              {link.title || (link.type === 'yt' ? 'Watch Video' : 'Read Material')}
            </a>
          ))}
      {images.length === 0 && extraLinks.length === 0 && diagrams.length === 0 && !loadingDiagrams && (
         <div className="card-bub-solid bg-gray-100 p-6 text-center font-bold text-gray-500">Ask a question to load resources!</div>
      )}
    </>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] p-4 md:p-8 gap-4">
      <div className="flex items-center justify-between bg-gradient-to-r from-violet-600 to-fuchsia-700 rounded-xl p-3 md:p-4 shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard/topic')} className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full text-white text-lg font-bold transition-all" aria-label="Back to topics">←</button>
          <div>
            <h1 className="text-lg md:text-xl font-black tracking-tight text-white">{chapter}</h1>
            <p className="font-bold text-xs text-white/70">{subject} • Session Active</p>
          </div>
        </div>
        {/* Layout toggle */}
        <div className="hidden lg:flex items-center gap-1 bg-white/10 rounded-full p-0.5">
          <button onClick={() => setViewMode('chat')} className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${viewMode === 'chat' ? 'bg-white text-violet-700' : 'text-white/70 hover:text-white'}`}>
            💬 Chat
          </button>
          <button onClick={() => setViewMode('split')} className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${viewMode === 'split' ? 'bg-white text-violet-700' : 'text-white/70 hover:text-white'}`}>
            ↔ Split
          </button>
          <button onClick={() => setViewMode('resources')} className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${viewMode === 'resources' ? 'bg-white text-violet-700' : 'text-white/70 hover:text-white'}`}>
            📊 Resources
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 gap-4 md:gap-8">
      {/* Visual / Links Sidebar (desktop — only in split or resources mode) */}
      {(viewMode === 'split' || viewMode === 'resources') && (
        <div className={`${viewMode === 'resources' ? 'flex-1' : 'w-1/3'} hidden lg:flex flex-col gap-4 overflow-y-auto pr-2`}>
          <h2 className="text-lg font-bold bg-gray-100 text-gray-700 px-4 py-2 rounded-xl">Visuals & Links</h2>
          <div className="space-y-4">{renderResources()}</div>
        </div>
      )}

      {/* Main Chat Area (only in chat or split mode) */}
      {(viewMode === 'chat' || viewMode === 'split') && (
      <div className={`${viewMode === 'chat' ? 'flex-1' : 'flex-1'} card-bub-solid bg-white flex flex-col p-4 md:p-6 relative`}>
        {/* Floating resource button (mobile) */}
        <button
          onClick={() => setShowResourceDrawer(true)}
          className="lg:hidden fixed bottom-24 right-4 z-30 min-w-[48px] min-h-[48px] bg-gradient-to-r from-amber-400 to-orange-400 border border-gray-200 shadow-lg flex items-center justify-center text-xl font-black"
          aria-label="Show resources"
        >
          📎
        </button>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 md:space-y-6 pr-2 md:pr-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] md:max-w-[80%] p-3 md:p-4 font-medium leading-relaxed ${msg.role === 'user' ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white' : 'bg-white border border-gray-200 text-gray-900 shadow-sm rounded-tl-none flex flex-col gap-3'}`}>
                {msg.thoughts && (
                  <blockquote className="bg-gray-200 border-l-4 border-gray-500 p-3 text-xs font-mono text-gray-700 rounded-sm">
                    <p className="font-black uppercase mb-1 flex items-center gap-1"><span>🧠</span> Thought Process</p>
                    <div className="opacity-80">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={markdownComponents}
                      >
                        {msg.thoughts}
                      </ReactMarkdown>
                    </div>
                  </blockquote>
                )}
                <div className="prose prose-p:my-1 prose-p:text-gray-900 prose-li:my-0 prose-li:text-gray-900 prose-strong:text-gray-900 prose-em:text-gray-900 prose-headings:text-gray-900 prose-h1:text-xl prose-h2:text-lg prose-ul:my-1 prose-pre:bg-gray-800 prose-pre:text-white max-w-none text-sm md:text-base">
                  {msg.role === 'ai' ? (
                    msg.isPlaceholder ? (
                      <span className="italic text-gray-700">{msg.text}</span>
                    ) : (
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={markdownComponents}
                      >
                        {msg.text}
                      </ReactMarkdown>
                    )
                  ) : (
                    msg.text
                  )}
                </div>
                {msg.role === 'ai' && !msg.isPlaceholder && (
                  <div className="flex items-center gap-1.5 pt-2 mt-1 border-t border-gray-100">
                    <span className="text-xs text-gray-400 mr-1">Was this helpful?</span>
                    <button
                      onClick={() => handleFeedback(`msg-${i}`, 1)}
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center text-sm rounded-full hover:bg-green-100 transition-colors"
                      title="Helpful"
                    >
                      👍
                    </button>
                    <button
                      onClick={() => handleFeedback(`msg-${i}`, -1)}
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center text-sm rounded-full hover:bg-red-100 transition-colors"
                      title="Not helpful"
                    >
                      👎
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="p-4  bg-gray-100  rounded-tl-none font-bold text-sm flex items-center gap-2">
                <div className="w-2 h-2 bg-black rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-black rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                <div className="w-2 h-2 bg-black rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Custom Input Box */}
        <div className="mt-4 md:mt-6 p-3 md:p-4 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col gap-3 md:gap-4">
           {/* Toggles */}
           <div className="flex flex-wrap gap-2 md:gap-4 pb-2 border-b border-gray-100">
               <label className="flex items-center gap-2 cursor-pointer font-bold text-xs md:text-sm min-h-[44px] select-none">
                  <input type="checkbox" className="appearance-none w-5 h-5 border-2 border-gray-300 rounded bg-white checked:border-violet-500 checked:bg-violet-500 transition-all" checked={isThinking} onChange={e => setIsThinking(e.target.checked)} disabled={isLoading || isTeaching} />
                  🧠 Deep Thinking
               </label>
               <label className="flex items-center gap-2 cursor-pointer font-bold text-xs md:text-sm min-h-[44px] select-none">
                  <input type="checkbox" className="appearance-none w-5 h-5 border-2 border-gray-300 rounded bg-white checked:border-sky-500 checked:bg-sky-500 transition-all" checked={showLinks} onChange={e => setShowLinks(e.target.checked)} disabled={isLoading} />
                  🔗 Fetch Links
               </label>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-xs md:text-sm min-h-[44px] select-none">
                   <input type="checkbox" className="appearance-none w-5 h-5 border-2 border-gray-300 rounded bg-white checked:border-green-500 checked:bg-green-500 transition-all" checked={isTeaching} onChange={e => { setIsTeaching(e.target.checked); setMessages([{ role: 'ai', text: `👋 Teach Mode on! I will guide you through "${chapter}" step by step. Ask me anything.` }]); }} disabled={isLoading} />
                   🧑‍🏫 Teach Mode
                </label>
            </div>
           
           <div className="flex gap-2">
             <button className="bg-red-200 border border-gray-200 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-red-300 font-bold disabled:opacity-50 text-lg" title="Speech to text" disabled={isLoading}>🎤</button>
             <input 
               type="text" 
               className="flex-1 input-bub disabled:opacity-50 disabled:bg-gray-100 min-h-[44px]" 
               placeholder={isLoading ? "Waiting for AI..." : "Type your question..."}
               value={input}
               onChange={e => setInput(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && handleSend()}
               disabled={isLoading}
             />
              <button className="bg-gradient-to-r from-violet-600 to-fuchsia-700 text-white font-bold px-6 md:px-8 min-h-[44px] rounded-full shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base" onClick={handleSend} disabled={isLoading || !input.trim()}>
                 SEND 🚀
              </button>
           </div>
        </div>
      </div>
      )}

      </div>

      {/* Mobile Resource Drawer */}
      <ResourceDrawer open={showResourceDrawer} onClose={() => setShowResourceDrawer(false)}>
        {renderResources()}
      </ResourceDrawer>
    </div>
  );
};

export default LearnPage;
