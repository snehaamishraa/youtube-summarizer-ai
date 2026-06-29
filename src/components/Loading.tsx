import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface LoadingProps {
  message?: string;
  fullScreen?: boolean;
}

export default function Loading({ message = 'Verifying session...', fullScreen = true }: LoadingProps) {
  const containerClasses = fullScreen
    ? 'fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-4'
    : 'w-full h-full min-h-[300px] flex flex-col items-center justify-center p-6 glass-card';

  return (
    <div className={containerClasses}>
      {/* Background gradients */}
      {fullScreen && (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.12),transparent_50%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_75%,rgba(168,85,247,0.08),transparent_50%)] pointer-events-none" />
        </>
      )}

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center gap-6 relative z-10"
      >
        {/* Animated logo */}
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, ease: 'linear', repeat: Infinity }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/30 flex items-center justify-center"
          >
            <Sparkles className="w-7 h-7 text-indigo-400" />
          </motion.div>
          <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 opacity-10 blur-2xl animate-pulse" />
        </div>

        {/* Loading text */}
        <div className="text-center space-y-2">
          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-sm font-semibold gradient-text"
          >
            {message}
          </motion.p>
          {fullScreen && (
            <p className="text-xs text-slate-500">Please wait a moment</p>
          )}
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ scale: [1, 1.3, 1], opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              className="w-1.5 h-1.5 rounded-full bg-indigo-400"
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
