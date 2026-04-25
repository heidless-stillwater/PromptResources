'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/lib/types';
import { SuiteSwitcher } from './SuiteSwitcher';

export default function Navbar() {
    const { user, profile, activeRole, signOut, switchRole, canSwitchRoles, isAdmin } = useAuth();
    const pathname = usePathname();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const roles: UserRole[] = ['su', 'admin', 'member'];

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 px-6 h-[72px] flex items-center border-b border-white/5 bg-background-secondary/40 backdrop-blur-xl shadow-lg shadow-black/20" id="main-navbar">
            <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
                <Link href="/" className="flex items-center gap-4 group cursor-pointer" id="nav-logo">
                    <div className="relative">
                        <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-xl blur opacity-25 group-hover:opacity-100 transition duration-500"></div>
                        <div className="relative bg-black/40 backdrop-blur-xl rounded-lg p-2 border border-white/10 group-hover:border-primary/50 transition-colors">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary group-hover:animate-pulse">
                                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-0.5-5" />
                                <path d="M12 11h4" />
                                <path d="M12 15h4" />
                                <path d="M8 7v10" />
                            </svg>
                        </div>
                    </div>
                    <div>
                        <h1 className="text-lg font-black tracking-tighter text-white group-hover:text-primary transition-colors uppercase leading-none">Stillwater Resources</h1>
                        <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mt-1.5">Ecosystem Node</p>
                    </div>
                </Link>

                <div className="hidden lg:flex items-center gap-1.5 p-1 bg-white/[0.03] border border-white/5 rounded-2xl">
                    <SuiteSwitcher />
                    <div className="w-px h-4 bg-white/5 mx-1" />
                    <Link href="/dashboard" className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl ${pathname === '/dashboard' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-white/60 hover:text-white hover:bg-white/5'}`} id="nav-dashboard">Dashboard</Link>
                    <Link href="/resources" className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl ${pathname === '/resources' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-white/60 hover:text-white hover:bg-white/5'}`} id="nav-resources">Resources</Link>
                    <Link href="/creators" className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl ${pathname === '/creators' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-white/60 hover:text-white hover:bg-white/5'}`} id="nav-creators">Creators</Link>
                    <Link href="/pricing" className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl ${pathname === '/pricing' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-white/60 hover:bg-white/5 border border-transparent hover:bg-primary/10'}`} id="nav-pricing">💎 Pricing</Link>
                </div>

                <div className="flex items-center gap-4">
                    {user && (
                        <div className="hidden md:flex flex-col items-end mr-2">
                             <div className="text-[10px] font-black text-white leading-none uppercase tracking-tighter">{profile?.displayName || 'User'}</div>
                             <div className="text-[8px] font-bold text-primary/70 uppercase tracking-[0.2em] mt-1">
                                {profile?.subscription?.status === 'active' 
                                    ? (profile.subscription.bundleId || 'PRO Suite') 
                                    : (profile?.subscriptionType === 'pro' ? 'PRO Plan' : 'Basic Access')}
                             </div>
                        </div>
                    )}

                    {user && (
                        <Link 
                            href="/resources/new" 
                            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-primary transition-all mr-2"
                            id="header-suggest-btn"
                        >
                            ➕ Suggest
                        </Link>
                    )}

                    {user ? (
                        <div className="relative" ref={menuRef}>
                            <button
                                className="flex items-center gap-3 p-1 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all group"
                                onClick={() => setMenuOpen(!menuOpen)}
                                id="user-menu-trigger"
                            >
                                <div className="w-9 h-9 rounded-full border border-white/10 overflow-hidden bg-white/5 flex items-center justify-center">
                                    {profile?.photoURL ? (
                                        <div className="relative w-full h-full">
                                            <Image
                                                src={profile.photoURL}
                                                alt={profile.displayName || ''}
                                                fill
                                                sizes="36px"
                                                className="object-cover"
                                            />
                                        </div>
                                    ) : (
                                        <span className="text-xs font-black text-primary">{(profile?.displayName?.[0] || user.email?.[0] || 'U').toUpperCase()}</span>
                                    )}
                                </div>
                            </button>

                            {menuOpen && (
                                <div className="absolute right-0 mt-4 w-72 bg-[#1e293b] border border-white/20 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl animate-fade-in-up" id="user-menu-dropdown">
                                    <div className="flex items-center gap-4 pb-4 border-b border-white/5 mb-4 relative z-10">
                                        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-xl text-white font-black shadow-inner">
                                            {profile?.displayName?.[0]?.toUpperCase() || '👤'}
                                        </div>
                                        <div>
                                            <div className="text-sm font-black text-white leading-none tracking-tight">{profile?.displayName || 'User'}</div>
                                            <div className="text-[10px] text-white/50 font-bold mt-1.5 truncate max-w-[160px] uppercase tracking-wide">{user.email}</div>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/5 rounded-xl transition-all" onClick={() => setMenuOpen(false)}>
                                            📊 My Dashboard
                                        </Link>
                                        <Link href="/dashboard/saved" className="flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/5 rounded-xl transition-all" onClick={() => setMenuOpen(false)}>
                                            ⭐ Saved Resources
                                        </Link>
                                        <Link href="/dashboard/settings" className="flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/5 rounded-xl transition-all" onClick={() => setMenuOpen(false)}>
                                            ⚙️ Profile Settings
                                        </Link>
                                        {isAdmin && (
                                            <Link href="/admin" className="flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-red-400/80 hover:text-red-400 hover:bg-red-400/5 rounded-xl transition-all" onClick={() => setMenuOpen(false)}>
                                                🛡️ Administrative Console
                                            </Link>
                                        )}
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                                        {canSwitchRoles && (
                                            <div className="bg-black/20 p-3 rounded-2xl border border-white/5">
                                                <div className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em] mb-2 px-1">View Authority</div>
                                                <div className="flex gap-1">
                                                    {roles.map((role) => (
                                                        <button
                                                            key={role}
                                                            className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${activeRole === role ? 'bg-primary text-white' : 'text-white/40 hover:bg-white/5'}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                switchRole(role);
                                                            }}
                                                        >
                                                            {role}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <button
                                            className="w-full flex items-center justify-center gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-all"
                                            onClick={() => { signOut(); setMenuOpen(false); }}
                                        >
                                            🚪 Sign Out Platform
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <Link href="/auth/login" className="px-5 py-2 text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-all" id="nav-login">Sign In</Link>
                            <Link href="/auth/register" className="bg-brand-gradient px-6 py-2.5 rounded-full text-[10px] font-black text-white uppercase tracking-[0.2em] shadow-[0_10px_20px_rgba(99,102,241,0.2)] hover:scale-105 transition-all" id="nav-register">Get Started</Link>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}
