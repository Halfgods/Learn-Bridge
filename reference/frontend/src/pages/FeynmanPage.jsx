import { useState, useEffect, useRef } from 'react';
import { authFetch, getUser } from '../utils/auth';
import { backendUrl } from '../config/api';

const FeynmanPage = () => {
  const user = getUser();
  const [concept, setConcept] = useState('');
  const [isStarted, setIsStarted] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleStart = () => {
    if (!concept.trim()) return;
    setIsStarted(true);
    setMessages([{
      role: 'assistant',
      content: `Hi! I'm a student in Grade ${user?.std || '10'} too. I want to learn about "${concept}". Can you explain it to me simply?`
    }]);
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await authFetch(backendUrl('/api/feynman/chat'), {
        method: 'POST',
        body: JSON.stringify({
          concept,
          messages: newMessages
        })
      });

      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }

      const data = await res.json();

      if (!data || typeof data.reply !== 'string') {
        throw new Error('Invalid response format');
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, { role: 'assistant', content: "I'm a bit confused, my brain stopped working. Can you try explaining that again?" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto h-[calc(100vh-80px)] flex flex-col">
      <div className="mb-4 md:mb-6">
        <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tight mb-2">💡 Feynman Sandbox</h1>
        <p className="font-bold text-gray-500 text-xs md:text-sm">The ultimate test of mastery: Teach it to a peer.</p>
      </div>

      {!isStarted ? (
        <div className="card-bub-solid bg-white p-6 md:p-10 mt-6 md:mt-10 text-center max-w-2xl mx-auto">
          <span className="text-5xl md:text-7xl block mb-4 md:mb-6">🧑‍🏫</span>
          <h2 className="text-xl md:text-2xl font-black uppercase mb-3 md:mb-4">What do you want to teach?</h2>
          <p className="font-bold text-gray-600 mb-6 md:mb-8 text-sm md:text-base">
            Enter a concept. The AI will act as a curious classmate in Grade {user?.std || '10'} and ask you questions until you explain it perfectly.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
            <input
              type="text"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="e.g. Photosynthesis, Gravity..."
              className="flex-1 p-4 font-bold text-base md:text-lg outline-none focus:bg-yellow-50 min-h-[48px]"
              onKeyDown={(e) => e.key === 'Enter' && handleStart()}
            />
            <button
              onClick={handleStart}
              className="btn-bub-primary bg-gradient-to-r from-pink-500 to-rose-500 text-white px-6 md:px-8 py-4 min-h-[48px] font-black uppercase text-base md:text-lg hover:bg-pink-600"
            >
              Start
            </button>
          </div>
        </div>
      ) : (
        <div className="card-bub-solid bg-white flex-1 flex flex-col overflow-hidden ">
          {/* Chat Header */}
          <div className="bg-gradient-to-r from-amber-400 to-orange-400 border-b-4 border-black p-3 md:p-4 flex justify-between items-center shrink-0 gap-2">
            <div className="min-w-0">
              <p className="font-black uppercase text-[10px] md:text-xs">Teaching Topic:</p>
              <h3 className="font-black text-base md:text-xl truncate">{concept}</h3>
            </div>
            <button 
              onClick={() => {setIsStarted(false); setConcept(''); setMessages([]);}}
              className="border border-gray-200 bg-white px-3 md:px-4 py-2 min-h-[44px] font-black text-[10px] md:text-xs uppercase hover:bg-gray-100 shrink-0"
            >
              Change Topic
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 bg-amber-50">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-gray-200 bg-orange-300 flex items-center justify-center text-base md:text-xl mr-2 md:mr-3 shrink-0">
                    👦
                  </div>
                )}
                
                <div className={`max-w-[85%] md:max-w-[80%] p-3 md:p-4 font-bold text-sm md:text-lg ${
                  msg.role === 'user' ? 'bg-gradient-to-r from-blue-400 to-cyan-400 text-black' : 'bg-white text-black'
                } ${msg.role === 'user' ? 'rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl' : 'rounded-tl-2xl rounded-tr-2xl rounded-br-2xl'}`}>
                  {msg.content}
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-gray-200 bg-gradient-to-r from-pink-500 to-rose-500 flex items-center justify-center text-white font-black text-sm md:text-xl ml-2 md:ml-3 shrink-0">
                    You
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-gray-200 bg-orange-300 flex items-center justify-center text-base md:text-xl mr-2 md:mr-3 shrink-0">👦</div>
                <div className="p-3 md:p-4 bg-white rounded-tl-2xl rounded-tr-2xl rounded-br-2xl flex items-center gap-2">
                  <div className="w-2 h-2 bg-black rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-black rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  <div className="w-2 h-2 bg-black rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSend} className="p-3 md:p-4 border-t-4 border-black bg-white flex gap-2 md:gap-4 shrink-0">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Explain it simply..."
              className="flex-1 p-3 md:p-4 font-bold text-base md:text-lg outline-none focus:bg-blue-50 min-h-[44px]"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="btn-bub-primary bg-green-400 text-black px-4 md:px-8 min-h-[44px] font-black uppercase text-sm md:text-lg hover:bg-green-500 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default FeynmanPage;
