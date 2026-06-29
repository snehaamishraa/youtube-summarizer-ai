import { motion } from 'framer-motion';
import { History as HistoryIcon, Search, Inbox, Loader2 } from 'lucide-react';
import { useState } from 'react';
import SummaryCard from '../components/SummaryCard';
import { useQuery, useMutation } from '@apollo/client';
import { GET_SUMMARIES } from '../graphql/queries';
import { DELETE_SUMMARY } from '../graphql/mutations';



export default function HistoryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, loading, error } = useQuery(GET_SUMMARIES);
  const [deleteSummary] = useMutation(DELETE_SUMMARY, {
    refetchQueries: ['GetSummaries'],
  });

  const summaries = data?.summaries || [];

  const filteredSummaries = summaries.filter(
    (s: any) =>
      s.videoTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.channelTitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteSummary({
        variables: { id },
      });
    } catch (err) {
      console.error('Failed to delete summary:', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex-1 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_0%,rgba(99,102,241,0.08),transparent_50%)] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/20 flex items-center justify-center">
              <HistoryIcon className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Summary History</h1>
              <p className="text-xs text-slate-400">
                {summaries.length} {summaries.length === 1 ? 'summary' : 'summaries'} saved
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search summaries..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-slate-800/60 hover:border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm rounded-xl transition-all outline-none text-white placeholder:text-slate-600"
            />
          </div>
        </motion.div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
            <p className="text-sm text-slate-400">Loading your history...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-rose-400">Failed to load history: {error.message}</p>
          </div>
        )}

        {/* Summary List */}
        {!loading && !error && filteredSummaries.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            {filteredSummaries.map((summary: any, i: number) => (
              <motion.div
                key={summary.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
              >
                <SummaryCard
                  {...summary}
                  onDelete={handleDelete}
                  isDeleting={deletingId === summary.id}
                />
              </motion.div>
            ))}
          </motion.div>
        ) : !loading && !error && (
          /* Empty State */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-slate-900/60 border border-slate-800/50 flex items-center justify-center mb-5">
              {searchQuery ? (
                <Search className="w-7 h-7 text-slate-600" />
              ) : (
                <Inbox className="w-7 h-7 text-slate-600" />
              )}
            </div>
            <h3 className="text-base font-semibold text-slate-300 mb-2">
              {searchQuery ? 'No results found' : 'No summaries yet'}
            </h3>
            <p className="text-sm text-slate-500 max-w-sm">
              {searchQuery
                ? `No summaries match "${searchQuery}". Try a different search term.`
                : 'Summarize your first YouTube video to see it here.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-4 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Clear search
              </button>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
