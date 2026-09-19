import { motion } from 'framer-motion';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { ArrowLeft, Download, ExternalLink, FileText, Loader2 } from 'lucide-react';
import SummaryContent from '../components/SummaryContent';
import { GET_SUMMARY_BY_ID } from '../graphql/queries';
import { formatDuration } from '../lib/summary';

export default function SummaryDetail() {
  const { id } = useParams();
  const { data, loading, error } = useQuery(GET_SUMMARY_BY_ID, { variables: { id } });
  const item = data?.summary;

  // Save the summary as a .txt file on the user's computer
  const handleDownload = () => {
    const text = `${item.videoTitle}\n${item.channelTitle}\n${item.videoUrl}\n\n${item.summary}\n`;
    const blob = new Blob([text], { type: 'text/plain' });
    const fileUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = `${item.videoTitle.replace(/[^\w\s-]/g, '').trim() || 'summary'}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
  };

  return (
    <div className="flex-1 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_0%,rgba(99,102,241,0.08),transparent_50%)] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <Link
          to="/history"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to history
        </Link>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
            <p className="text-sm text-slate-400">Loading summary...</p>
          </div>
        )}

        {error && (
          <p className="py-20 text-center text-sm text-rose-400">Failed to load summary: {error.message}</p>
        )}

        {!loading && !error && !item && (
          <p className="py-20 text-center text-sm text-slate-400">Summary not found. It may have been deleted.</p>
        )}

        {item && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="glass-card overflow-hidden"
          >
            {/* Video Header */}
            <div className="flex flex-col sm:flex-row gap-4 p-6 border-b border-slate-800/50">
              <img
                src={item.thumbnailUrl}
                alt={item.videoTitle}
                className="w-full sm:w-48 h-28 object-cover rounded-xl border border-slate-800/50"
              />
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold text-white leading-snug mb-1">{item.videoTitle}</h1>
                <p className="text-sm text-slate-400 mb-3">{item.channelTitle}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {item.duration > 0 && (
                    <span className="px-2.5 py-1 bg-slate-800/60 border border-slate-700/50 rounded-lg text-slate-300 font-mono">
                      {formatDuration(item.duration)}
                    </span>
                  )}
                  <span className="text-slate-500">
                    {new Date(item.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  AI Summary
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={item.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-800/50 hover:border-slate-700 transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    YouTube
                  </a>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-800/50 hover:border-slate-700 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </button>
                </div>
              </div>

              <SummaryContent summary={item.summary} />

              {/* Transcript the summary was made from */}
              {item.transcript && (
                <details className="pt-4 border-t border-slate-800/50">
                  <summary className="cursor-pointer text-xs font-medium text-slate-400 hover:text-white transition-colors">
                    Show video transcript
                  </summary>
                  <p className="mt-3 max-h-80 overflow-y-auto text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">
                    {item.transcript}
                  </p>
                </details>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
