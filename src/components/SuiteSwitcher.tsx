'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Icons } from './ui/Icons';

const apps = [
    { name: 'PlanTune', url: 'http://localhost:3004', icon: Icons.trendingUp, color: 'text-teal-400', desc: 'Credit Strategy Engine' },
    { name: 'PromptMaster', url: 'http://localhost:5173', icon: Icons.zap, color: 'text-amber-400', desc: 'Central Registry' },
    { name: 'PromptTool', url: 'http://localhost:3001', icon: Icons.layoutGrid, color: 'text-indigo-400', desc: 'AI Image Studio' },
    { name: 'Resources', url: 'http://localhost:3002', icon: Icons.feed, color: 'text-emerald-400', desc: 'Sovereign Library', current: true },
    { name: 'VideoSystem', url: 'http://localhost:3000', icon: Icons.video, color: 'text-rose-400', desc: 'AI Documentary Engine' },
    { name: 'Accreditation', url: 'http://localhost:3003', icon: Icons.shield, color: 'text-blue-400', desc: 'Compliance Hub' },
];

export function SuiteSwitcher() {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div className="relative" ref={ref}>
            <button onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-all group">
                <Icons.layoutGrid size={16} className="text-white/40 group-hover:text-white" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 group-hover:text-white hidden sm:block">Suite</span>
                <Icons.chevronDown size={14} className={`text-white/40 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute top-full mt-3 left-0 w-80 bg-[#0c0c14]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-4 z-[100]">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 mb-4 px-2">Stillwater Ecosystem</h3>
                    <div className="grid grid-cols-1 gap-1">
                        {apps.map((app) => (
                            <a key={app.name} href={app.url}
                               className={`flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-all group ${app.current ? 'bg-white/5 border border-white/10' : ''}`}>
                                <div className={`w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center border border-white/5 ${app.color}`}>
                                    <app.icon size={20} />
                                </div>
                                <div>
                                    <div className="text-[11px] font-black text-white uppercase tracking-wider">{app.name}</div>
                                    <div className="text-[9px] text-white/40 font-medium uppercase mt-0.5">{app.desc}</div>
                                </div>
                            </a>
                        ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/5 text-center">
                        <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.4em]">Sovereign Node v1.2</p>
                    </div>
                </div>
            )}
        </div>
    );
}
