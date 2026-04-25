'use client';

import React from 'react';
import { useSovereignStatus } from '@/hooks/useSovereignStatus';
import { Icons } from './ui/Icons';
import { useAuth } from '@/contexts/AuthContext';

export function ComplianceCenter() {
    const { status, breachedPolicies, loading } = useSovereignStatus();
    const { user } = useAuth();

    const simulateDrift = async () => {
        if (!user) return;
        try {
            const token = await user.getIdToken();
            await fetch('/api/compliance/sovereign/test-drift', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            window.location.reload();
        } catch (err) {
            console.error('Simulation failed:', err);
        }
    };

    const remediateDrifts = async () => {
        if (!user) return;
        try {
            const token = await user.getIdToken();
            await fetch('/api/compliance/sovereign/test-drift', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            window.location.reload();
        } catch (err) {
            console.error('Remediation failed:', err);
        }
    };

    const [isCollapsed, setIsCollapsed] = React.useState(true);

    const hasIssues = status !== 'green' || breachedPolicies.length > 0;

    return (
        <div className={`glass-card relative overflow-hidden group transition-all duration-500 ${
            hasIssues && isCollapsed ? 'border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.1)]' : ''
        }`}>
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -mr-32 -mt-32" />
            
            <div className="p-8 relative z-10">
                <div className="flex justify-between items-start">
                    <div 
                        className="flex-1 cursor-pointer flex items-center gap-3 group/header"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                    >
                        <div className={`transition-transform duration-300 ${isCollapsed ? 'rotate-0' : 'rotate-180'}`}>
                            <Icons.chevronDown size={14} className="text-white/20 group-hover/header:text-white/60" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h3 className="text-xl font-black tracking-tight uppercase mb-1">Accreditation <span className="text-white/40">Center</span></h3>
                                {hasIssues && isCollapsed && (
                                    <div className="flex items-center gap-2 px-3 py-1 bg-rose-500/10 border border-rose-500/20 rounded-full animate-pulse">
                                        <div className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
                                        <span className="text-[8px] font-black uppercase tracking-widest text-rose-400">Policy Breach Detected</span>
                                    </div>
                                )}
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Live Regulatory Heartbeat</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {!isCollapsed && (
                            <>
                                <button 
                                    onClick={simulateDrift}
                                    className="p-2 bg-white/5 border border-white/10 rounded-lg text-[8px] font-black uppercase tracking-widest text-white/40 hover:bg-white/10 hover:text-white transition-all"
                                >
                                    ⚡ Simulate Drift
                                </button>
                                <button 
                                    onClick={remediateDrifts}
                                    className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[8px] font-black uppercase tracking-widest text-emerald-400 hover:bg-emerald-500/20 transition-all"
                                >
                                    🛡️ Remediate All
                                </button>
                            </>
                        )}
                        <div className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                            status === 'green' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                            status === 'amber' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                            'bg-rose-500/10 border-rose-500/20 text-rose-400'
                        }`}>
                            Status: {status}
                        </div>
                    </div>
                </div>

                {!isCollapsed && (
                    <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="space-y-4">
                            {breachedPolicies.length > 0 ? (
                                breachedPolicies.map((policy: any) => (
                                    <div key={policy.slug} className="p-5 bg-white/5 border border-white/10 rounded-2xl flex items-start gap-4 group/item hover:border-white/20 transition-all">
                                        <div className={`p-2 rounded-lg ${
                                            policy.status === 'red' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
                                        }`}>
                                            <Icons.shield size={16} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center mb-1">
                                                <h4 className="text-xs font-black uppercase tracking-widest text-white">{policy.name}</h4>
                                                <span className="text-[8px] font-black uppercase text-white/20">{policy.slug}</span>
                                            </div>
                                            <p className="text-[10px] text-white/40 leading-relaxed">
                                                {policy.status === 'red' ? policy.lockMessage : policy.driftMessage}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-10 border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center text-center">
                                    <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-4">
                                        <Icons.check size={24} />
                                    </div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40">All clinical safety measures verified</p>
                                </div>
                            )}
                        </div>

                        <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Icons.database size={12} className="text-white/20" />
                                <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Source: PromptAccreditation Sovereign Registry</span>
                            </div>
                            <button className="text-[8px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors">
                                View Audit Trail →
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
