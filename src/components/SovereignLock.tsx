'use client';

import React from 'react';

interface SovereignLockProps {
    message?: string;
    breachedPolicySlug?: string;
}

/**
 * SovereignLock - A high-fidelity, physically restrictive UI overlay.
 * Triggered when the Stillwater Sovereign Hub detects a compliance breach.
 */
export function SovereignLock({ message, breachedPolicySlug }: SovereignLockProps) {
    const defaultMessage = 'Access Restricted: The Stillwater Sovereign Hub has detected a critical legislative drift. Remediate at the Accreditation Hub to restore access.';
    
    // Deep link directly to the implementation wizard for restoration
    const remediationUrl = breachedPolicySlug 
      ? `http://localhost:3003/policies/${breachedPolicySlug}/wizard?remediate=true`
      : 'http://localhost:3003/admin/dashboard';

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 sm:p-12 animate-in fade-in duration-700">
            {/* Backdrop: Deep obsidian with cinematic blur */}
            <div className="absolute inset-0 bg-black/90 backdrop-blur-2xl" />
            
            {/* Animated Grid / Scanning Effect Backdrop */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0)_50%,rgba(0,0,0,0.5)_50%),linear-gradient(90deg,rgba(255,0,0,0.05)_1px,transparent_1px),linear-gradient(rgba(255,0,0,0.05)_1px,transparent_1px)] bg-[size:100%_2px,20px_20px,20px_20px] pointer-events-none" />

            {/* Lock Card: Premium Glassmorphism with 'Alert' theme */}
            <div className="relative max-w-2xl w-full bg-white/[0.03] border border-rose-500/30 rounded-[2.5rem] p-8 sm:p-12 shadow-[0_0_100px_rgba(244,63,94,0.15)] overflow-hidden group">
                
                {/* Glow effects */}
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-rose-500/10 blur-[80px] rounded-full animate-pulse" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-rose-500/10 blur-[80px] rounded-full animate-pulse delay-700" />

                <div className="relative flex flex-col items-center text-center gap-8">
                    {/* Shield Icon: Sovereign Sentinel Branding */}
                    <div className="relative mb-4">
                        <div className="absolute inset-0 bg-rose-500 blur-2xl opacity-20 animate-pulse" />
                        <div className="relative bg-black/40 border border-rose-500/40 p-6 rounded-3xl group-hover:scale-110 transition-transform duration-700">
                            <svg className="w-16 h-16 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tighter leading-tight italic">
                            Sovereign <span className="text-rose-500">Lock</span> Active
                        </h2>
                        <div className="flex items-center justify-center gap-3">
                            <span className="h-px w-8 bg-rose-500/50" />
                            <p className="text-[10px] font-black text-rose-500 uppercase tracking-[0.4em] animate-pulse">
                                Gated Access & Technical Telemetry
                            </p>
                            <span className="h-px w-8 bg-rose-500/50" />
                        </div>
                    </div>

                    <div className="glass-card bg-rose-500/5 border-rose-500/10 p-6 rounded-2xl max-w-lg">
                        <p className="text-sm font-bold text-white/70 leading-relaxed uppercase tracking-wide">
                            {message || defaultMessage}
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                        <a 
                            href={remediationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-[0.3em] text-[10px] px-8 py-5 rounded-2xl transition-all shadow-xl shadow-rose-600/20 active:scale-95 flex items-center justify-center gap-3"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                            </svg>
                            Remediate Breach
                        </a>
                        <button 
                            onClick={() => window.location.reload()}
                            className="bg-white/5 hover:bg-white/10 text-white/40 hover:text-white font-black uppercase tracking-[0.3em] text-[10px] px-8 py-5 rounded-2xl border border-white/5 hover:border-white/20 transition-all flex items-center justify-center gap-3"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Re-Scan Registry
                        </button>
                    </div>

                    {/* Footer Telemetry ID */}
                    <p className="text-[8px] font-black text-rose-500/30 uppercase tracking-[0.5em] mt-8">
                        Stillwater Sentinel | NODE_ID: {Math.random().toString(36).substring(7).toUpperCase()}
                    </p>
                </div>
            </div>
        </div>
    );
}
