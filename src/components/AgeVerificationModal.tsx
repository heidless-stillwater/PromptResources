'use client';

import React, { useState } from 'react';
import { ShieldCheck, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';

interface AgeVerificationModalProps {
  onVerified: () => void;
}

export function AgeVerificationModal({ onVerified }: AgeVerificationModalProps) {
  const [dob, setDob] = useState('');
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const calculateAge = (birthday: string) => {
    const ageDifMs = Date.now() - new Date(birthday).getTime();
    const ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dob) {
      setError('Please provide your date of birth.');
      return;
    }

    const age = calculateAge(dob);
    if (age < 18) {
      setError('Regulatory Error: You must be at least 18 years old to access this suite.');
    } else {
      setError('');
      setIsSuccess(true);
      
      // Set the Sovereign Verified Cookie
      // In a real app, this would be a secure, HTTP-only cookie set via a server action
      // For this SaaS demo, we'll use document.cookie for immediate reactivity
      document.cookie = "stillwater_av_verified=true; path=/; max-age=2592000; samesite=lax";
      
      setTimeout(() => {
        onVerified();
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden">
      {/* Dynamic Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-2xl animate-fade-in" />
      
      {/* Modal Container */}
      <div 
        className="relative w-full max-w-md glass-card p-8 animate-slide-up border-t-2 border-t-blue-500/50"
        style={{ background: 'rgba(15, 23, 42, 0.8)' }}
      >
        {!isSuccess ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                <ShieldCheck className="w-8 h-8 text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Age Verification Required</h2>
              <p className="text-sm text-slate-400">
                To comply with the **Online Safety Act 2023**, we must verify your age before granting access to generative AI resources.
              </p>
            </div>

            <div className="space-y-4">
              <div className="group relative">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 ml-1">
                  Date of Birth
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                  <input
                    type="date"
                    required
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              </div>

              {error && (
                <div className="flex gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p>{error}</p>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98]"
            >
              Verify & Enter Suite
            </button>

            <p className="text-[10px] text-center text-slate-500 px-4">
              By proceeding, you certify that the information provided is accurate. 
              Misrepresentation may result in permanent access revocation.
            </p>
          </form>
        ) : (
          <div className="text-center py-8 animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6 border border-green-500/20 animate-bounce-subtle">
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Access Granted</h2>
            <p className="text-sm text-slate-400">
              Identity verified. Establishing clinical secure session...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
