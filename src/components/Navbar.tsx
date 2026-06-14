'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/lib/types';
import { SuiteSwitcher } from './SuiteSwitcher';
import { useTheme } from '@/components/providers/ThemeProvider';

export default function Navbar() {
    const { user, profile, activeRole, signOut, switchRole, canSwitchRoles, isAdmin } = useAuth();
    const { isDarkMode, toggleTheme } = useTheme();
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
        <nav className={`fixed top-0 left-0 right-0 z-50 px-6 h-[72px] flex items-center border-b backdrop-blur-xl shadow-lg transition-all duration-300 ${isDarkMode ? 'border-white/5 bg-background-secondary/40 shadow-black/20' : 'border-slate-200/80 bg-white/70 shadow-slate-100/10'}`} id="main-navbar">
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
                        <div className="flex items-center gap-2">
                            <h1 className={`text-lg font-black tracking-tighter transition-colors uppercase leading-none ${isDarkMode ? 'text-white group-hover:text-primary' : 'text-slate-800 group-hover:text-primary'}`}>Sovereign Resources</h1>
                            <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 uppercase tracking-wider">
                                v0.1.0
                            </span>
                        </div>
                        <p className={`text-[10px] font-black uppercase tracking-[0.2em] mt-1.5 ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>Live Sync Active</p>
                    </div>
                </Link>

                <div className={`hidden lg:flex items-center gap-1.5 p-1 rounded-2xl ${isDarkMode ? 'bg-white/[0.03] border border-white/5' : 'bg-black/[0.03] border border-black/5'}`}>
                    <SuiteSwitcher />
                    <div className={`w-px h-4 mx-1 ${isDarkMode ? 'bg-white/5' : 'bg-black/10'}`} />
                    <Link href="/dashboard" className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl ${pathname === '/dashboard' ? 'bg-primary text-white shadow-lg shadow-primary/20' : isDarkMode ? 'text-white/60 hover:text-white hover:bg-white/5' : 'text-slate-600 hover:text-slate-900 hover:bg-black/5'}`} id="nav-dashboard">Dashboard</Link>
                    <Link href="/resources" className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl ${pathname === '/resources' ? 'bg-primary text-white shadow-lg shadow-primary/20' : isDarkMode ? 'text-white/60 hover:text-white hover:bg-white/5' : 'text-slate-600 hover:text-slate-900 hover:bg-black/5'}`} id="nav-resources">Resources</Link>
                    <Link href="/playlists" className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl ${pathname === '/playlists' ? 'bg-primary text-white shadow-lg shadow-primary/20' : isDarkMode ? 'text-white/60 hover:text-white hover:bg-white/5' : 'text-slate-600 hover:text-slate-900 hover:bg-black/5'}`} id="nav-playlists">Playlists</Link>
                    <Link href="/creators" className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl ${pathname === '/creators' ? 'bg-primary text-white shadow-lg shadow-primary/20' : isDarkMode ? 'text-white/60 hover:text-white hover:bg-white/5' : 'text-slate-600 hover:text-slate-900 hover:bg-black/5'}`} id="nav-creators">Sources</Link>
                </div>

                <div className="flex items-center gap-4">
                    {user && (
                         <div className="hidden md:flex flex-col items-end mr-2">
                              <div className={`text-[10px] font-black leading-none uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{profile?.displayName || 'User'}</div>
                              <div className="text-[8px] font-bold text-primary/70 uppercase tracking-[0.2em] mt-1">
                                 {profile?.subscription?.status === 'active' 
                                     ? (profile.subscription.bundleId || 'PRO Suite') 
                                     : (profile?.subscriptionType === 'pro' ? 'PRO Plan' : 'Basic Access')}
                              </div>
                         </div>
                    )}



                    {/* Elegant Sun/Moon Theme Switcher */}
                    <button
                        onClick={toggleTheme}
                        className={`p-2 rounded-xl border transition-all duration-300 flex items-center justify-center ${
                            isDarkMode
                                ? 'bg-white/5 border-white/10 text-yellow-400 hover:bg-white/10 hover:text-yellow-300'
                                : 'bg-black/5 border-black/10 text-indigo-600 hover:bg-black/10 hover:text-indigo-700'
                        }`}
                        title={isDarkMode ? 'Switch to Creamy Alabaster (Light)' : 'Switch to Sapphire Dusk (Dark)'}
                    >
                        {isDarkMode ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="4" />
                                <path d="M12 2v2" />
                                <path d="M12 20v2" />
                                <path d="m4.93 4.93 1.41 1.41" />
                                <path d="m17.66 17.66 1.41 1.41" />
                                <path d="M2 12h2" />
                                <path d="M20 12h2" />
                                <path d="m6.34 17.66-1.41 1.41" />
                                <path d="m19.07 4.93-1.41 1.41" />
                            </svg>
                        ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                            </svg>
                        )}
                    </button>

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
                                <div className={`absolute right-0 mt-4 w-72 border p-5 shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-2xl animate-fade-in-up ${isDarkMode ? 'bg-[#0f172a] border-white/10' : 'bg-white border-slate-200'}`} id="user-menu-dropdown">
                                    <div className={`flex items-center gap-4 pb-4 border-b mb-4 relative z-10 ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black shadow-inner ${isDarkMode ? 'bg-primary/10 border border-primary/20 text-white' : 'bg-primary/5 border border-primary/10 text-slate-800'}`}>
                                            {profile?.displayName?.[0]?.toUpperCase() || '👤'}
                                        </div>
                                        <div>
                                            <div className={`text-sm font-black leading-none tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{profile?.displayName || 'User'}</div>
                                            <div className={`text-[10px] font-bold mt-1.5 truncate max-w-[160px] uppercase tracking-wide ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>{user.email}</div>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <Link href="/dashboard" className={`flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${isDarkMode ? 'text-white/60 hover:text-white hover:bg-white/5' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`} onClick={() => setMenuOpen(false)}>
                                            📊 My Dashboard
                                        </Link>
                                        <Link href="/dashboard/saved" className={`flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${isDarkMode ? 'text-white/60 hover:text-white hover:bg-white/5' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`} onClick={() => setMenuOpen(false)}>
                                            ⭐ Saved Resources
                                        </Link>
                                        <Link href="/dashboard/settings" className={`flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${isDarkMode ? 'text-white/60 hover:text-white hover:bg-white/5' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`} onClick={() => setMenuOpen(false)}>
                                            ⚙️ Profile Settings
                                        </Link>
                                        <Link href="/pricing" className={`flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${isDarkMode ? 'text-indigo-450 hover:text-indigo-350 hover:bg-indigo-500/5' : 'text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50/5'}`} onClick={() => setMenuOpen(false)}>
                                            💎 Access Plans
                                        </Link>
                                        {isAdmin && (
                                            <Link href="/admin" className={`flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${isDarkMode ? 'text-red-400/80 hover:text-red-400 hover:bg-red-400/5' : 'text-red-600 hover:text-red-800 hover:bg-red-50/5'}`} onClick={() => setMenuOpen(false)}>
                                                🛡️ Workspace Management
                                            </Link>
                                        )}
                                    </div>

                                    <div className={`mt-4 pt-4 border-t space-y-4 ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                                        {canSwitchRoles && (
                                            <div className={`p-3 rounded-2xl border ${isDarkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                                                <div className={`text-[8px] font-black uppercase tracking-[0.2em] mb-2 px-1 ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>Workspace Perspective</div>
                                                <div className="flex gap-1">
                                                    {roles.map((role) => (
                                                        <button
                                                            key={role}
                                                            className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${activeRole === role ? 'bg-primary text-white shadow-sm' : isDarkMode ? 'text-white/40 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-200/50'}`}
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
                                            className={`w-full flex items-center justify-center gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl ${isDarkMode ? 'text-white/40 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
                                            onClick={() => { signOut(); setMenuOpen(false); }}
                                        >
                                            🚪 Sign Out
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
