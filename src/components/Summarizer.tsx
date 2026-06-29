import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link2, Sparkles, Loader2, AlertCircle, FileText, List, Lightbulb, Copy, Check } from 'lucide-react';

interface SummarizerProps {
  onSummarize?: (url: string) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  result?: {
    videoTitle: string;
    channelTitle: string;
    thumbnailUrl: string;
    duration: number;
    summary: string;
  } | null;
}

export default function Summarizer({ onSummarize, isLoading = false, error = null, result = null }: SummarizerProps) {
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || isLoading) return;
    if (onSummarize) {
      await onSummarize(url.trim());
    }
  };

  const handleCopy = () => {
    if (!result?.summary) return;
    navigator.clipboard.writeText(result.summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="glass-card p-6 sm:p-8"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Summarize a Video</h2>
            <p className="text-xs text-slate-400">Paste a YouTube URL to generate an AI-powered summary</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Link2 className="w-4 h-4 text-slate-500" />
            </span>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              disabled={isLoading}
              className="w-full pl-11 pr-4 py-3.5 bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm rounded-xl transition-all duration-200 outline-none text-white placeholder:text-slate-600"
            />
          </div>
          <motion.button
            type="submit"
            disabled={isLoading || !url.trim()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-primary flex items-center justify-center gap-2 text-sm min-w-[160px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Summarizing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Summarize
              </>
            )}
          </motion.button>
        </form>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex items-start gap-2.5 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </motion.div>

      {/* Loading Shimmer */}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card p-6 sm:p-8 space-y-4"
        >
          <div className="flex gap-4">
            <div className="w-40 h-24 rounded-xl shimmer" />
            <div className="flex-1 space-y-3">
              <div className="h-5 w-3/4 rounded-lg shimmer" />
              <div className="h-4 w-1/2 rounded-lg shimmer" />
              <div className="h-3 w-1/4 rounded-lg shimmer" />
            </div>
          </div>
          <div className="space-y-2 pt-4 border-t border-slate-800/50">
            <div className="h-4 w-full rounded-lg shimmer" />
            <div className="h-4 w-5/6 rounded-lg shimmer" />
            <div className="h-4 w-4/6 rounded-lg shimmer" />
          </div>
        </motion.div>
      )}

      {/* Result */}
      {result && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass-card overflow-hidden"
        >
          {/* Video Header */}
          <div className="flex flex-col sm:flex-row gap-4 p-6 border-b border-slate-800/50">
            <img
              src={result.thumbnailUrl}
              alt={result.videoTitle}
              className="w-full sm:w-48 h-28 object-cover rounded-xl border border-slate-800/50"
            />
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-white leading-snug line-clamp-2 mb-1">
                {result.videoTitle}
              </h3>
              <p className="text-sm text-slate-400 mb-3">{result.channelTitle}</p>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800/60 border border-slate-700/50 rounded-lg text-xs text-slate-300 font-mono">
                {formatDuration(result.duration)}
              </span>
            </div>
          </div>

          {/* Summary Content */}
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <FileText className="w-4 h-4 text-indigo-400" />
                AI Summary
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-800/50 hover:border-slate-700 transition-all"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>

            {/* Parse summary sections */}
            <div className="text-sm text-slate-300 leading-relaxed space-y-4">
              {result.summary.split('\n\n').map((block, i) => {
                if (block.startsWith('•') || block.startsWith('-') || block.startsWith('*')) {
                  return (
                    <div key={i} className="flex items-start gap-2.5 pl-2">
                      <List className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                      <span>{block.replace(/^[•\-*]\s*/, '')}</span>
                    </div>
                  );
                }
                if (block.toLowerCase().includes('takeaway') || block.toLowerCase().includes('key')) {
                  return (
                    <div key={i} className="flex items-start gap-2.5 p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                      <Lightbulb className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span className="text-amber-200/90">{block}</span>
                    </div>
                  );
                }
                return <p key={i}>{block}</p>;
              })}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
