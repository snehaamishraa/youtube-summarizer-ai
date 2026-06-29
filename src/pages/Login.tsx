import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { 
  useSignInEmailPassword, 
  useSignUpEmailPassword, 
  useAuthenticationStatus, 
  useNhostClient 
} from '@nhost/react';
import { Mail, Lock, User, LogIn, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react';
import Loading from '../components/Loading';

export default function Login() {
  const nhost = useNhostClient();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthenticationStatus();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const { 
    signInEmailPassword, 
    isLoading: isSignInLoading, 
    error: signInError 
  } = useSignInEmailPassword();

  const { 
    signUpEmailPassword, 
    isLoading: isSignUpLoading, 
    isSuccess: isSignUpSuccess, 
    error: signUpError,
    needsEmailVerification
  } = useSignUpEmailPassword();

  // If already authenticated, redirect to home page
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Show full screen loader during auth session check
  if (isAuthLoading) {
    return <Loading message="Checking session..." />;
  }

  const validateForm = () => {
    setValidationError(null);
    if (!email || !email.includes('@')) {
      setValidationError('Please enter a valid email address.');
      return false;
    }
    if (!password || password.length < 6) {
      setValidationError('Password must be at least 6 characters long.');
      return false;
    }
    if (isSignUp && !displayName.trim()) {
      setValidationError('Please enter your display name.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (isSignUp) {
      await signUpEmailPassword(email, password, {
        displayName: displayName.trim()
      });
    } else {
      await signInEmailPassword(email, password);
    }
  };
  const handleGoogleLogin = async () => {
    setValidationError(null);
    try {
      const result = await nhost.auth.signIn({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      
      if (result?.providerUrl) {
        window.location.href = result.providerUrl;
      } else {
        throw new Error('Failed to generate Google sign-in URL.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to initialize Google login.';
      setValidationError(message);
    }
  };

  const isFormLoading = isSignInLoading || isSignUpLoading;
  const currentError = validationError || (isSignUp ? signUpError?.message : signInError?.message);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.12),transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_75%,rgba(168,85,247,0.08),transparent_50%)] pointer-events-none" />

      <main className="relative z-10 max-w-md w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl">
        {/* App Branding */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-1">
            Notiora AI
          </h1>
          <p className="text-slate-400 text-xs tracking-wider uppercase font-semibold">YouTube Video Summarizer</p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 bg-slate-950/80 border border-slate-800/60 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(false);
              setValidationError(null);
            }}
            disabled={isFormLoading}
            className={`py-2 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 ${
              !isSignUp 
                ? 'bg-indigo-600/90 text-white shadow-md shadow-indigo-600/10' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(true);
              setValidationError(null);
            }}
            disabled={isFormLoading}
            className={`py-2 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 ${
              isSignUp 
                ? 'bg-indigo-600/90 text-white shadow-md shadow-indigo-600/10' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Sign Up
          </button>
        </div>

        {/* Sign up Success State */}
        {isSignUpSuccess && isSignUp && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-xs mb-6 flex gap-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
            <div className="space-y-1">
              <p className="font-semibold">Account created successfully!</p>
              {needsEmailVerification ? (
                <p className="text-slate-400 leading-normal">
                  We've sent a verification link to <span className="font-semibold text-emerald-300">{email}</span>. Please verify your email to log in.
                </p>
              ) : (
                <p className="text-slate-400 leading-normal">
                  You are now signed up. Directing you to the home dashboard...
                </p>
              )}
            </div>
          </div>
        )}

        {/* Error State */}
        {currentError && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3.5 rounded-xl text-xs mb-5 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span className="leading-relaxed">{currentError}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 block px-1">Display Name</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 pointer-events-none">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  disabled={isFormLoading}
                  placeholder="John Doe"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800/80 hover:border-slate-700/80 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-sm rounded-xl transition duration-150 outline-none text-slate-200 placeholder:text-slate-600"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 block px-1">Email Address</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 pointer-events-none">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                required
                disabled={isFormLoading}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800/80 hover:border-slate-700/80 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-sm rounded-xl transition duration-150 outline-none text-slate-200 placeholder:text-slate-600"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 block px-1">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 pointer-events-none">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                disabled={isFormLoading}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800/80 hover:border-slate-700/80 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-sm rounded-xl transition duration-150 outline-none text-slate-200 placeholder:text-slate-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isFormLoading || (isSignUpSuccess && isSignUp && needsEmailVerification)}
            className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-55 disabled:hover:bg-indigo-600 disabled:scale-100 active:scale-[0.98] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition duration-200 shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-2"
          >
            {isFormLoading ? (
              <span className="w-4 h-4 border-2 border-slate-100 border-t-transparent rounded-full animate-spin" />
            ) : isSignUp ? (
              'Create Account'
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
            <span className="px-3 bg-slate-900 text-slate-500">Or continue with</span>
          </div>
        </div>

        {/* Social Sign-In */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isFormLoading}
          className="w-full py-2.5 px-4 bg-slate-950 hover:bg-slate-900/90 disabled:opacity-50 text-slate-200 border border-slate-800 hover:border-slate-700 active:scale-[0.98] text-xs font-bold rounded-xl transition duration-150 flex items-center justify-center gap-2.5 shadow-sm"
        >
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </button>

        <p className="text-[10px] text-slate-500 text-center mt-6 leading-relaxed">
          By signing in, you agree to our Terms of Service <br /> and Privacy Policy.
        </p>
      </main>
    </div>
  );
}
