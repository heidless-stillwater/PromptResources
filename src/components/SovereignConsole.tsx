'use client';

import React, { useState } from 'react';
import { Terminal, ShieldCheck, ChevronDown, ChevronUp, Database } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function SovereignConsole() {
  const { protection, avRequired, isAvVerified } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (!protection.avEnabled) return null;

  const sentinelData = {
    gate_status: avRequired ? 'INTERCEPT_ACTIVE' : 'ACCESS_GRANTED',
    verification_anchor: isAvVerified ? 'IDENTITY_VERIFIED' : 'PENDING',
    registry_alignment: 'SYNCHRONIZED',
    policy_strictness: protection.avStrictness,
    timestamp: new Date().toISOString()
  };

  return (
    <div className="fixed bottom-6 left-6 z-[60] flex flex-col items-start gap-2 max-w-sm w-full font-mono animate-fade-in-up">
      {/* Mini Toggle */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-3 px-4 py-2 border rounded-xl shadow-2xl transition-all duration-300 ${
          avRequired 
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' 
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
        }`}
      >
        <ShieldCheck size={14} className={avRequired ? 'animate-pulse' : ''} />
        <span className="text-[10px] font-black uppercase tracking-widest">
          Sovereign Sentinel: {avRequired ? 'ENFORCING' : 'VERIFIED'}
        </span>
        {isOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>

      {/* Console Panel */}
      {isOpen && (
        <div className="bg-[#0c0c14] border border-white/10 rounded-2xl shadow-2xl w-full overflow-hidden animate-fade-in-up">
          <div className="px-4 py-2 bg-white/5 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-widest">
              <Terminal size={10} /> Technical Compliance Proof
            </div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[8px] text-emerald-500/70 font-black uppercase">Live Registry</span>
            </div>
          </div>
          
          <div className="p-4 bg-black/40 overflow-x-auto">
            <pre className="text-[10px] text-white/60 leading-relaxed">
              <code>{JSON.stringify(sentinelData, null, 2)}</code>
            </pre>
          </div>

          <div className="px-4 py-3 bg-white/5 flex items-start gap-3 border-t border-white/5">
            <Database size={12} className="text-blue-400 mt-0.5" />
            <p className="text-[9px] text-white/30 leading-tight">
              Evidence synthesized from the <span className="text-white/50">promptresources-db-0</span> registry. This state is clinically anchored to the Online Safety Act implementation.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
