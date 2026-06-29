import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Zap, Shield, Clock } from 'lucide-react';
import Summarizer from '../components/Summarizer';
import { useMutation } from '@apollo/client';
import { useNhostClient } from '@nhost/react';
import { INSERT_SUMMARY } from '../graphql/mutations';

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelName, setModelName] = useState('Meta Llama 3.1');
  const [result, setResult] = useState<{
    videoTitle: string;
    channelTitle: string;
    thumbnailUrl: string;
    duration: number;
    summary: string;
  } | null>(null);

  const nhost = useNhostClient();
  const [insertSummary] = useMutation(INSERT_SUMMARY, {
    refetchQueries: ['GetSummaries'],
  });

  const handleSummarize = async (url: string) => {
    setError(null);
    setResult(null);
    setIsLoading(true);

    try {
      const { res, error: fnError } = await nhost.functions.call<{
        videoTitle: string;
        channelTitle: string;
        thumbnailUrl: string;
        duration: number;
        summary: string;
        transcript?: string;
        modelUsed?: string;
      }>('summarize', { url });

      if (fnError) {
        const errMsg = fnError.message?.error || fnError.message || 'Failed to generate summary.';
        setError(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
        return;
      }

      if (res?.data) {
        const data = res.data;
        
        if (data.modelUsed) {
          setModelName(data.modelUsed);
        }

        // Helper to extract YouTube video ID from URL
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|^shorts\/)([^#\&\?]*).*/;
        const match = url.match(regExp);
        const videoId = match && match[2].length === 11 ? match[2] : 'unknown';

        // Save to PostgreSQL via GraphQL Mutation
        await insertSummary({
          variables: {
            videoId,
            videoUrl: url,
            videoTitle: data.videoTitle,
            channelTitle: data.channelTitle,
            thumbnailUrl: data.thumbnailUrl,
            duration: data.duration,
            summary: data.summary,
            transcript: data.transcript || '',
          },
        });

        setResult({
          videoTitle: data.videoTitle,
          channelTitle: data.channelTitle,
          thumbnailUrl: data.thumbnailUrl,
          duration: data.duration,
          summary: data.summary,
        });
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    {
      icon: Zap,
      title: 'AI-Powered',
      description: `${modelName} generates intelligent summaries with key takeaways`,
      color: 'text-amber-400',
      bg: 'from-amber-500/10 to-orange-500/10',
      border: 'border-amber-500/15',
    },
    {
      icon: Shield,
      title: 'Secure',
      description: 'Your data is protected with Google OAuth and row-level security',
      color: 'text-emerald-400',
      bg: 'from-emerald-500/10 to-teal-500/10',
      border: 'border-emerald-500/15',
    },
    {
      icon: Clock,
      title: 'History',
      description: 'All summaries are saved and accessible from your dashboard',
      color: 'text-blue-400',
      bg: 'from-blue-500/10 to-cyan-500/10',
      border: 'border-blue-500/15',
    },
  ];

  return (
    <div className="flex-1 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(99,102,241,0.10),transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_100%,rgba(168,85,247,0.06),transparent_50%)] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', bounce: 0.5, duration: 0.8 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-xs font-medium text-indigo-300 mb-6"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Powered by {modelName}
          </motion.div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight mb-4">
            <span className="text-white">Summarize any </span>
            <span className="gradient-text">YouTube video</span>
            <br />
            <span className="text-white">in seconds</span>
          </h1>

          <p className="text-slate-400 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
            Paste a YouTube link and get an AI-generated summary with key points and takeaways. 
            Save your summaries and access them anytime.
          </p>
        </motion.div>

        {/* Summarizer */}
        <Summarizer
          onSummarize={handleSummarize}
          isLoading={isLoading}
          error={error}
          result={result}
        />

        {/* Feature Cards */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12"
        >
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + i * 0.1, duration: 0.4 }}
                className={`p-5 rounded-2xl bg-gradient-to-br ${feature.bg} border ${feature.border} backdrop-blur-sm`}
              >
                <Icon className={`w-5 h-5 ${feature.color} mb-3`} />
                <h3 className="text-sm font-bold text-white mb-1">{feature.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{feature.description}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
