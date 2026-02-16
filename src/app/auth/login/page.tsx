'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn, signInWithGoogle } = useAuth();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await signIn(email, password);
            router.push('/dashboard');
        } catch (err: unknown) {
            const error = err as { code?: string; message?: string };
            if (error.code === 'auth/invalid-credential') {
                setError('Invalid email or password.');
            } else if (error.code === 'auth/user-not-found') {
                setError('No account found with this email.');
            } else {
                setError(error.message || 'Failed to sign in.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogle = async () => {
        setError('');
        setLoading(true);
        try {
            await signInWithGoogle();
            router.push('/dashboard');
        } catch (err: unknown) {
            const error = err as { message?: string };
            setError(error.message || 'Failed to sign in with Google.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-wrapper">
            <Navbar />
            <div className="main-content" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--space-8)',
            }}>
                <div className="glass-card animate-slide-up" style={{
                    width: '100%',
                    maxWidth: '440px',
                    padding: 'var(--space-10)',
                }}>
                    <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
                        <div style={{
                            fontSize: '2.5rem',
                            marginBottom: 'var(--space-3)',
                        }}>
                            🔑
                        </div>
                        <h1 style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-2)' }}>
                            Welcome Back
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                            Sign in to access your resources and dashboard
                        </p>
                    </div>

                    {error && (
                        <div style={{
                            padding: 'var(--space-3) var(--space-4)',
                            background: 'rgba(244, 63, 94, 0.1)',
                            border: '1px solid rgba(244, 63, 94, 0.3)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--danger-400)',
                            fontSize: 'var(--text-sm)',
                            marginBottom: 'var(--space-5)',
                        }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label" htmlFor="email">Email</label>
                            <input
                                id="email"
                                type="email"
                                className="form-input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="password">Password</label>
                            <input
                                id="password"
                                type="password"
                                className="form-input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary btn-lg"
                            style={{ width: '100%', marginBottom: 'var(--space-4)' }}
                            disabled={loading}
                            id="login-submit"
                        >
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        margin: 'var(--space-5) 0',
                    }}>
                        <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>OR</span>
                        <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
                    </div>

                    <button
                        className="btn btn-secondary btn-lg"
                        style={{ width: '100%' }}
                        onClick={handleGoogle}
                        disabled={loading}
                        id="google-signin"
                    >
                        <svg width="18" height="18" viewBox="0 0 18 18">
                            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
                            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
                            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
                            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
                        </svg>
                        Continue with Google
                    </button>

                    <p style={{
                        textAlign: 'center',
                        marginTop: 'var(--space-6)',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-muted)',
                    }}>
                        Don&apos;t have an account?{' '}
                        <Link href="/auth/register" style={{ color: 'var(--primary-400)', fontWeight: 600 }}>
                            Sign Up
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
