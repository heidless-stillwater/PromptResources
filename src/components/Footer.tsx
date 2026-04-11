'use client';

import React from 'react';
import Link from 'next/link';

export default function Footer() {
    return (
        <footer className="py-16 border-t border-white/5 bg-[#0a0a0f]" id="main-footer">
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-brand-gradient p-[1px]">
                                <div className="w-full h-full bg-black rounded-xl flex items-center justify-center">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                                        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                                    </svg>
                                </div>
                            </div>
                            <span className="text-lg font-black tracking-tighter text-white uppercase">Stillwater</span>
                        </div>
                        <p className="text-xs font-bold text-white/40 leading-relaxed uppercase tracking-widest">
                            The definitive architectural hub for high-end prompt engineering & AI system design. Curating elite blueprints for the next era of intelligence.
                        </p>
                    </div>

                    <div className="space-y-6">
                        <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Architecture</h4>
                        <div className="flex flex-col gap-3">
                            <Link href="/resources" className="text-xs font-bold text-white/40 hover:text-primary transition-colors uppercase tracking-widest">All Resources</Link>
                            <Link href="/categories" className="text-xs font-bold text-white/40 hover:text-primary transition-colors uppercase tracking-widest">Categories</Link>
                            <Link href="/creators" className="text-xs font-bold text-white/40 hover:text-primary transition-colors uppercase tracking-widest">Creator Registry</Link>
                            <Link href="/resources?platform=gemini" className="text-xs font-bold text-white/40 hover:text-primary transition-colors uppercase tracking-widest">Gemini Nodes</Link>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Ecosystem</h4>
                        <div className="flex flex-col gap-3">
                            <Link href="/pricing" className="text-xs font-bold text-white/40 hover:text-primary transition-colors uppercase tracking-widest">Master Pricing</Link>
                            <Link href="http://localhost:3001/generate" className="text-xs font-bold text-white/40 hover:text-primary transition-colors uppercase tracking-widest">Stillwater Studio</Link>
                            <Link href="http://localhost:5173" className="text-xs font-bold text-white/40 hover:text-primary transition-colors uppercase tracking-widest">Stillwater Registry</Link>
                            <Link href="/dashboard" className="text-xs font-bold text-white/40 hover:text-primary transition-colors uppercase tracking-widest">Control Center</Link>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Support</h4>
                        <div className="flex flex-col gap-3">
                            <Link href="/api-docs" className="text-xs font-bold text-white/40 hover:text-primary transition-colors uppercase tracking-widest">API Framework</Link>
                            <div className="pt-2">
                                <span className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> Ecosystem Active
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                    <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">
                        © {new Date().getFullYear()} Stillwater Resources. Engineered in the AI Era.
                    </p>
                    <div className="flex items-center gap-6">
                        <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Next.js 14+</span>
                        <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Firebase Admin</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
