'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/lib/types';

export default function Navbar() {
    const { user, profile, activeRole, signOut, switchRole, canSwitchRoles, isAdmin } = useAuth();
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
        <nav className="navbar" id="main-navbar">
            <div className="container navbar-inner">
                <Link href="/" className="navbar-logo" id="nav-logo">
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                        <rect width="28" height="28" rx="8" fill="url(#logo-gradient)" />
                        <path d="M8 10h12M8 14h8M8 18h10" stroke="white" strokeWidth="2" strokeLinecap="round" />
                        <defs>
                            <linearGradient id="logo-gradient" x1="0" y1="0" x2="28" y2="28">
                                <stop stopColor="#6366f1" />
                                <stop offset="1" stopColor="#a855f7" />
                            </linearGradient>
                        </defs>
                    </svg>
                    PromptResources
                </Link>

                <ul className="navbar-nav">
                    <li><Link href="/resources" className="navbar-link" id="nav-resources">📚 Resources</Link></li>
                    <li><Link href="/categories" className="navbar-link" id="nav-categories">🏷️ Categories</Link></li>
                    <li><Link href="/creators" className="navbar-link" id="nav-creators">👥 Creators</Link></li>
                    {user && <li><Link href="/dashboard" className="navbar-link" id="nav-dashboard">📊 Dashboard</Link></li>}
                    {isAdmin && <li><Link href="/admin" className="navbar-link" id="nav-admin">⚙️ Admin</Link></li>}
                </ul>

                <div className="navbar-actions">


                    {user ? (
                        <div className="user-menu" ref={menuRef}>
                            <button
                                className="user-menu-trigger"
                                onClick={() => setMenuOpen(!menuOpen)}
                                id="user-menu-trigger"
                            >
                                <div className="avatar">
                                    {profile?.photoURL ? (
                                        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                                            <Image
                                                src={profile.photoURL}
                                                alt={profile.displayName}
                                                fill
                                                sizes="32px"
                                                style={{ objectFit: 'cover', borderRadius: '50%' }}
                                            />
                                        </div>
                                    ) : (
                                        (profile?.displayName?.[0] || user.email?.[0] || 'U').toUpperCase()
                                    )}
                                </div>
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                                    <path d="M6 8L2 4h8L6 8z" />
                                </svg>
                            </button>

                            {menuOpen && (
                                <div className="user-menu-dropdown" id="user-menu-dropdown">
                                    <div className="user-menu-info">
                                        <div className="user-menu-name">{profile?.displayName || 'User'}</div>
                                        <div className="user-menu-email">{user.email}</div>
                                        <span className={`badge badge-primary user-menu-role`}>
                                            {activeRole?.toUpperCase() || 'MEMBER'}
                                        </span>
                                    </div>
                                    <Link href="/dashboard" className="user-menu-item" onClick={() => setMenuOpen(false)} id="menu-dashboard">
                                        📊 Dashboard
                                    </Link>
                                    <Link href="/dashboard/saved" className="user-menu-item" onClick={() => setMenuOpen(false)} id="menu-saved">
                                        ⭐ Saved Resources
                                    </Link>
                                    <Link href="/dashboard/settings" className="user-menu-item" onClick={() => setMenuOpen(false)} id="menu-settings">
                                        ⚙️ Settings
                                    </Link>
                                    <div className="user-menu-divider" />
                                    
                                    {canSwitchRoles && (
                                        <div className="menu-role-section">
                                            <div className="menu-section-title">👤 Change Role View</div>
                                            <div className="role-options">
                                                {roles.map((role) => (
                                                    <button
                                                        key={role}
                                                        className={`role-option-btn ${activeRole === role ? 'active' : ''}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            switchRole(role);
                                                        }}
                                                        id={`role-switch-${role}`}
                                                    >
                                                        {role === 'su' ? '⭐ SU' : role === 'admin' ? '🛡️ Admin' : '👤 User'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="user-menu-divider" />
                                    <button
                                        className="user-menu-item"
                                        onClick={() => { signOut(); setMenuOpen(false); }}
                                        id="menu-signout"
                                    >
                                        🚪 Sign Out
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            <Link href="/auth/login" className="btn btn-ghost" id="nav-login">Sign In</Link>
                            <Link href="/auth/register" className="btn btn-primary" id="nav-register">Get Started</Link>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}
