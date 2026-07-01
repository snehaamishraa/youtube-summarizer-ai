import { Sparkles, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full border-t border-slate-800/50 bg-slate-950/60 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Branding */}
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-500/20 to-purple-600/20 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-indigo-400" />
            </div>
            <span className="font-medium">Notiora AI</span>
            <span className="text-slate-700">·</span>
            <span>YouTube Video Summarizer</span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              Made with <Heart className="w-3 h-3 text-rose-400 fill-rose-400" /> by Sneha
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
