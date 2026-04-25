'use client';

import React, { useState } from 'react';
import { Icons } from './ui/Icons';
import { FlagReason, ApiResponse } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';

interface FlagModalProps {
    resourceId: string;
    resourceTitle: string;
    onClose: () => void;
    onSuccess: () => void;
}

const REASONS: { value: FlagReason; label: string; description: string; icon: keyof typeof Icons }[] = [
    { value: 'illegal', label: 'Safety Concern', description: 'Potentially problematic content that requires review.', icon: 'shield' },
    { value: 'harmful_children', label: 'Protecting Minors', description: 'Content that may not be suitable for younger users.', icon: 'eyeOff' },
    { value: 'harassment', label: 'Community Respect', description: 'Interactions that deviate from our respectful standards.', icon: 'user' },
    { value: 'hate_speech', label: 'Inclusivity Check', description: 'Ensuring our platform remains a safe space for everyone.', icon: 'alert' },
    { value: 'misinformation', label: 'Quality Verification', description: 'Helping us maintain the highest standard of accuracy.', icon: 'info' },
    { value: 'spam', label: 'Platform Integrity', description: 'Filtering out non-resource or promotional noise.', icon: 'zap' },
    { value: 'other', label: 'General Feedback', description: 'Any other safety or quality thoughts you wish to share.', icon: 'more' },
];

export function FlagModal({ resourceId, resourceTitle, onClose, onSuccess }: FlagModalProps) {
    const { user } = useAuth();
    const [reason, setReason] = useState<FlagReason | ''>('');
    const [details, setDetails] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reason) return;
        if (!user) return;

        setIsSubmitting(true);
        setError('');

        try {
            const token = await user.getIdToken();
            const response = await fetch('/api/moderation/flag', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    resourceId,
                    reason,
                    details,
                    userName: user.displayName
                }),
            });

            const result: ApiResponse = await response.json();
            if (result.success) {
                onSuccess();
            } else {
                setError(result.error || 'We couldn\'t process your feedback right now.');
            }
        } catch (err) {
            setError('An unexpected connection issue occurred.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-6 bg-black/60 backdrop-blur-xl animate-in fade-in duration-500">
            <div className="bg-[#0f0f15] border border-white/20 rounded-[3rem] w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] relative animate-in zoom-in-95 duration-300 flex flex-col">
                
                {/* Visual Atmosphere */}
                <div className="absolute top-0 right-0 w-full h-32 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none" />
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-rose-500/10 rounded-full blur-[80px]" />

                {/* Header Section */}
                <div className="p-8 md:p-10 pb-4 relative z-10 flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
                                <Icons.shield size={18} />
                            </div>
                            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-indigo-300">Community Guardian</span>
                        </div>
                        <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white leading-tight">
                            Help Us Protect <br/>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-rose-400">Our Ecosystem</span>
                        </h2>
                        <p className="text-white/60 text-sm font-medium mt-4 max-w-md">
                            Thank you for being a guardian. Your feedback helps us maintain the quality and safety of the Stillwater community.
                        </p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-white/20 text-white transition-all active:scale-95 group"
                    >
                        <Icons.close size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto px-8 md:px-10 py-4 custom-scrollbar">
                    <form onSubmit={handleSubmit} className="space-y-10 pb-10">
                        <div className="space-y-6">
                            <div className="flex items-center justify-between px-1">
                                <label className="text-xs font-black uppercase text-white/80 tracking-widest">What should we look into?</label>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {REASONS.map((r) => {
                                    const Icon = Icons[r.icon];
                                    return (
                                        <button
                                            key={r.value}
                                            type="button"
                                            onClick={() => setReason(r.value)}
                                            className={`flex items-start gap-4 p-5 rounded-3xl border transition-all text-left relative group/card ${
                                                reason === r.value 
                                                ? 'bg-indigo-500/10 border-indigo-400/50 shadow-[0_0_20px_rgba(99,102,241,0.1)]' 
                                                : 'bg-white/5 border-white/10 hover:border-white/30 hover:bg-white/[0.08]'
                                            }`}
                                        >
                                            <div className={`p-3 rounded-2xl transition-all flex-shrink-0 ${
                                                reason === r.value ? 'bg-indigo-500/30 text-white' : 'bg-white/5 text-white/40'
                                            }`}>
                                                <Icon size={20} />
                                            </div>
                                            <div>
                                                <div className={`text-xs font-black uppercase tracking-widest mb-1 ${
                                                    reason === r.value ? 'text-white' : 'text-white/80'
                                                }`}>{r.label}</div>
                                                <div className={`text-[10px] font-medium leading-relaxed transition-opacity ${
                                                    reason === r.value ? 'text-white/70' : 'text-white/40'
                                                }`}>
                                                    {r.description}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-xs font-black uppercase text-white/80 tracking-widest px-1">Additional Context (Optional)</label>
                            <textarea
                                rows={3}
                                className="w-full bg-white/5 border border-white/10 rounded-3xl px-6 py-5 text-sm font-medium text-white focus:border-indigo-400/50 outline-none transition-all min-h-[100px] placeholder:text-white/20"
                                placeholder="Tell us more about your observation..."
                                value={details}
                                onChange={(e) => setDetails(e.target.value)}
                            />
                        </div>

                        {error && (
                            <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-3xl text-rose-300 text-[11px] font-bold flex items-center gap-4">
                                <Icons.info size={18} />
                                {error}
                            </div>
                        )}
                    </form>
                </div>

                {/* Sticky Footer Actions */}
                <div className="p-8 md:p-10 pt-6 border-t border-white/10 bg-[#0f0f15]/90 backdrop-blur-md relative z-10">
                    <div className="flex flex-col md:flex-row gap-4">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="flex-1 py-5 rounded-[1.8rem] font-black text-xs uppercase tracking-widest bg-white/5 hover:bg-white/10 transition-all border border-white/10 text-white/60 hover:text-white"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSubmit}
                            disabled={!reason || isSubmitting}
                            className="flex-[2] py-5 rounded-[1.8rem] font-black text-xs uppercase tracking-widest bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-4 disabled:opacity-30 disabled:grayscale"
                        >
                            {isSubmitting ? (
                                <Icons.spinner className="animate-spin" size={20} />
                            ) : (
                                <>
                                    <Icons.check size={20} />
                                    Submit Feedback
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
