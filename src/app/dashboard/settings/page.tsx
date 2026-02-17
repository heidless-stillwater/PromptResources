'use client';

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export default function SettingsPage() {
    const { user, profile, loading: authLoading } = useAuth();
    const [displayName, setDisplayName] = useState(profile?.displayName || '');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    if (authLoading || !user) {
        return (
            <div className="page-wrapper">
                <Navbar />
                <div className="loading-page">
                    <div className="spinner" />
                </div>
            </div>
        );
    }

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage({ type: '', text: '' });

        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                displayName,
                updatedAt: new Date(),
            });
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
        } catch (error) {
            console.error('Error updating profile:', error);
            setMessage({ type: 'error', text: 'Failed to update profile.' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="page-wrapper">
            <Navbar />
            <div className="main-content">
                <div className="container" style={{ maxWidth: '800px' }}>
                    <div style={{ marginBottom: 'var(--space-8)' }}>
                        <h1 style={{ marginBottom: 'var(--space-2)' }}>⚙️ Settings</h1>
                        <p style={{ color: 'var(--text-muted)' }}>Manage your account and preferences</p>
                    </div>

                    {message.text && (
                        <div style={{
                            padding: 'var(--space-4)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: 'var(--space-6)',
                            background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                            border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)'}`,
                            color: message.type === 'success' ? 'var(--success-400)' : 'var(--danger-400)',
                        }}>
                            {message.text}
                        </div>
                    )}

                    <div className="glass-card" style={{ marginBottom: 'var(--space-6)' }}>
                        <h3 style={{
                            fontSize: 'var(--text-lg)',
                            marginBottom: 'var(--space-6)',
                            paddingBottom: 'var(--space-3)',
                            borderBottom: '1px solid var(--border-subtle)',
                        }}>
                            👤 Profile Information
                        </h3>

                        <form onSubmit={handleUpdateProfile}>
                            <div className="form-group">
                                <label className="form-label">Email Address</label>
                                <input
                                    type="email"
                                    className="form-input"
                                    value={user.email || ''}
                                    disabled
                                    style={{ opacity: 0.6, cursor: 'not-allowed' }}
                                />
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
                                    Email cannot be changed
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Display Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="Your Name"
                                />
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={saving}
                            >
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </form>
                    </div>

                    <div className="glass-card" style={{ marginBottom: 'var(--space-6)' }}>
                        <h3 style={{
                            fontSize: 'var(--text-lg)',
                            marginBottom: 'var(--space-6)',
                            paddingBottom: 'var(--space-3)',
                            borderBottom: '1px solid var(--border-subtle)',
                        }}>
                            💎 Subscription
                        </h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                                    Current Plan: <span className="badge badge-primary" style={{ textTransform: 'uppercase' }}>{profile?.subscriptionType || 'FREE'}</span>
                                </div>
                                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                                    Your plan determines your access to premium resources and features.
                                </div>
                            </div>
                            <button className="btn btn-secondary btn-sm" onClick={() => alert('Pricing coming soon!')}>
                                Change Plan
                            </button>
                        </div>
                    </div>

                    <div className="glass-card" style={{ opacity: 0.7 }}>
                        <h3 style={{
                            fontSize: 'var(--text-lg)',
                            marginBottom: 'var(--space-6)',
                            paddingBottom: 'var(--space-3)',
                            borderBottom: '1px solid var(--border-subtle)',
                        }}>
                            🔒 Security & Privacy
                        </h3>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                            More security settings like Two-Factor Authentication and Password Reset are coming soon.
                        </p>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}
