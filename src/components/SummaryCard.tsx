import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Trash2, Clock, ExternalLink } from 'lucide-react';
import { formatDuration, parseSummary } from '../lib/summary';

interface SummaryCardProps {
  id: string;
  videoUrl: string;
  videoTitle: string;
  channelTitle: string;
  thumbnailUrl: string;
  duration: number;
  summary: string;
  createdAt: string;
  onDelete?: (id: string) => void;
  isDeleting?: boolean;
}

export default function SummaryCard({
  id,
  videoUrl,
  videoTitle,
  channelTitle,
  thumbnailUrl,
  duration,
  summary,
  createdAt,
  onDelete,
  isDeleting = false,
}: SummaryCardProps) {
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const detailPath = `/summary/${id}`;
  const preview = parseSummary(summary).overview.join(' ') || summary;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="glass-card overflow-hidden group hover:border-slate-700/60 transition-colors duration-300"
    >
      <div className="flex flex-col sm:flex-row gap-4 p-5">
        {/* Thumbnail */}
        <Link to={detailPath} className="relative flex-shrink-0">
          <img
            src={thumbnailUrl}
            alt={videoTitle}
            className="w-full sm:w-40 h-24 object-cover rounded-xl border border-slate-800/50"
          />
          {duration > 0 && (
            <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 rounded text-[10px] font-mono text-white font-medium">
              {formatDuration(duration)}
            </span>
          )}
        </Link>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col">
          <Link to={detailPath} className="flex-1">
            <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2 mb-1 group-hover:text-indigo-200 transition-colors">
              {videoTitle}
            </h3>
            <p className="text-xs text-slate-400 mb-2">{channelTitle}</p>
            <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{preview}</p>
          </Link>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/40">
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                {formatDate(createdAt)}
              </span>
              <Link to={detailPath} className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
                Read summary →
              </Link>
            </div>

            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <a
                href={videoUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-all"
                title="Open on YouTube"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              {onDelete && (
                <button
                  onClick={() => onDelete(id)}
                  disabled={isDeleting}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all disabled:opacity-50"
                  title="Delete summary"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
