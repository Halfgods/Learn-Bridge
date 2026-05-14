import { Link } from 'react-router-dom';

const EthicsPage = () => {
  return (
    <div className="min-h-screen bg-amber-50 font-sans">
      <nav className="flex justify-between items-center p-6 border-b-4 border-black bg-white">
        <Link to="/" className="font-black text-2xl tracking-tighter">AI TUTOR</Link>
        <div className="space-x-6 font-bold text-sm">
          <Link to="/login" className="hover:underline">LOGIN</Link>
          <Link to="/signup" className="hover:underline">SIGNUP</Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto p-8 space-y-8">
        <h1 className="text-5xl font-black uppercase tracking-tight">Ethics & Transparency</h1>
        <p className="text-xl font-medium text-gray-700">How we use AI, handle your data, and keep learning responsible.</p>

        <div className="card-bub-solid bg-white p-8 space-y-6">
          <section>
            <h2 className="font-black text-2xl uppercase mb-3">🤖 How AI Works Here</h2>
            <p className="font-medium leading-relaxed">
              Our AI tutor uses large language models (Gemini and local Ollama models) to generate explanations, answer questions, and create quiz content. The AI does not replace teachers — it supplements learning by providing on-demand explanations.
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2 font-medium">
              <li>Responses are generated based on the current conversation only — no long-term chat history is stored.</li>
              <li>The AI may occasionally make mistakes. Always verify important information with your teacher or textbook.</li>
              <li>Confidence scores shown next to responses indicate the AI's self-assessed reliability.</li>
            </ul>
          </section>

          <div className="border-t-4 border-black pt-6">
            <h2 className="font-black text-2xl uppercase mb-3">🔒 Your Data</h2>
            <p className="font-medium leading-relaxed">
              We collect only what's needed for learning: your name, email, class, board, quiz scores, progress data, and optional feedback. Your password is hashed and never stored in plain text.
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2 font-medium">
              <li>No data is sold or shared with third parties.</li>
              <li>Anonymous usage data helps us improve the AI.</li>
              <li>You can download or delete all your data anytime from your profile.</li>
            </ul>
          </div>

          <div className="border-t-4 border-black pt-6">
            <h2 className="font-black text-2xl uppercase mb-3">⚖️ Responsible Use</h2>
            <p className="font-medium leading-relaxed">
              This platform is designed to encourage genuine learning, not shortcuts. We encourage:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2 font-medium">
              <li>Using the AI to understand concepts, not to copy answers.</li>
              <li>Thinking critically and asking follow-up questions.</li>
              <li>Using the Feynman Technique — teaching the AI to verify your understanding.</li>
            </ul>
          </div>

          <div className="border-t-4 border-black pt-6">
            <h2 className="font-black text-2xl uppercase mb-3">📬 Contact</h2>
            <p className="font-medium">
              Questions about ethics or your data? Contact your teacher or the platform admin.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EthicsPage;
