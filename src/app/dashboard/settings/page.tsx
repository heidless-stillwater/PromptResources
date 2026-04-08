'use client';

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import Image from 'next/image';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export default function SettingsPage() {
    const { user, profile, loading: authLoading } = useAuth();
    const queryClient = useQueryClient();
    const [displayName, setDisplayName] = useState(profile?.displayName || '');
    const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
    
    // Creator Profile fields
    const [isPublicProfile, setIsPublicProfile] = useState(profile?.isPublicProfile || false);
    const [profileType, setProfileType] = useState(profile?.profileType || 'individual');
    const [slug, setSlug] = useState(profile?.slug || '');
    const [bio, setBio] = useState(profile?.bio || '');
    const [bannerUrl, setBannerUrl] = useState(profile?.bannerUrl || '');
    
    const [message, setMessage] = useState({ type: '', text: '' });
    const [imgError, setImgError] = useState(false);

    // Update state when profile loads
    React.useEffect(() => {
        if (profile) {
            setDisplayName(profile.displayName || '');
            setPhotoURL(profile.photoURL || '');
            setIsPublicProfile(profile.isPublicProfile || false);
            setProfileType(profile.profileType || 'individual');
            setSlug(profile.slug || '');
            setBio(profile.bio || '');
            setBannerUrl(profile.bannerUrl || '');
            setImgError(false);
        }
    }, [profile]);

    const updateProfileMutation = useMutation({
        mutationFn: async (data: any) => {
            if (!user) throw new Error('Not authenticated');
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                ...data,
                updatedAt: new Date(),
            });
        },
        onSuccess: () => {
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            queryClient.invalidateQueries({ queryKey: ['profile', user?.uid] });
        },
        onError: (error) => {
            console.error('Error updating profile:', error);
            setMessage({ type: 'error', text: 'Failed to update profile.' });
        }
    });

    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            if (!user) throw new Error('Not authenticated');
            const storageRef = ref(storage, `avatars/${user.uid}/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            return await getDownloadURL(snapshot.ref);
        },
        onSuccess: (downloadURL) => {
            setPhotoURL(downloadURL);
            setImgError(false);
            setMessage({ type: 'success', text: 'Image uploaded! Remember to save changes.' });
        },
        onError: (error) => {
            console.error('Error uploading file:', error);
            setMessage({ type: 'error', text: 'Failed to upload image.' });
        }
    });

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
        setMessage({ type: '', text: '' });
        
        let finalSlug = slug.trim();
        if (isPublicProfile && !finalSlug) {
            finalSlug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
            setSlug(finalSlug);
        }
        
        updateProfileMutation.mutate({ 
            displayName, 
            photoURL,
            isPublicProfile,
            profileType: profileType as any,
            slug: finalSlug,
            bio,
            bannerUrl
        });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        // Basic validation
        if (!file.type.startsWith('image/')) {
            setMessage({ type: 'error', text: 'Please upload an image file.' });
            return;
        }

        if (file.size > 2 * 1024 * 1024) { // 2MB limit
            setMessage({ type: 'error', text: 'Image size should be less than 2MB.' });
            return;
        }

        setMessage({ type: '', text: '' });
        uploadMutation.mutate(file);
    };

    const saving = updateProfileMutation.isPending;
    const uploading = uploadMutation.isPending;

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

                            <div className="form-group">
                                <label className="form-label">Avatar URL</label>
                                <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
                                    <div className="avatar" style={{
                                        width: '64px',
                                        height: '64px',
                                        fontSize: '1.5rem',
                                        flexShrink: 0
                                    }}>
                                        {photoURL && !imgError ? (
                                            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                                                <Image
                                                    src={photoURL}
                                                    alt="Avatar Preview"
                                                    fill
                                                    sizes="64px"
                                                    style={{ objectFit: 'cover', borderRadius: '50%' }}
                                                    onError={() => setImgError(true)}
                                                />
                                            </div>
                                        ) : (
                                            (displayName?.[0] || 'U').toUpperCase()
                                        )}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={photoURL}
                                            onChange={(e) => {
                                                setPhotoURL(e.target.value);
                                                setImgError(false);
                                            }}
                                            placeholder="https://example.com/avatar.jpg"
                                        />
                                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
                                            Link to an image (URL) or upload a file
                                        </div>
                                        <div style={{ marginTop: 'var(--space-3)' }}>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleFileUpload}
                                                style={{ display: 'none' }}
                                                id="avatar-upload"
                                            />
                                            <label
                                                htmlFor="avatar-upload"
                                                className={`btn btn-secondary btn-sm ${uploading ? 'disabled' : ''}`}
                                                style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}
                                            >
                                                {uploading ? '⬆️ Uploading...' : '📁 Upload New Image'}
                                            </label>
                                        </div>
                                    </div>
                                </div>
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
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <span>🎨 Creator Profile Directory</span>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
                                <input 
                                    type="checkbox" 
                                    checked={isPublicProfile} 
                                    onChange={(e) => setIsPublicProfile(e.target.checked)} 
                                />
                                Enable Public Profile
                            </label>
                        </h3>
                        
                        {isPublicProfile ? (
                            <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-4)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) minmax(200px, 1fr)', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Profile Slug (URL)</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={slug}
                                            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                            placeholder="e.g. john-doe"
                                        />
                                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                            promptresources.com/creators/<b>{slug || 'john-doe'}</b>
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Creator Type</label>
                                        <select
                                            className="form-select"
                                            value={profileType}
                                            onChange={(e) => setProfileType(e.target.value as "individual" | "channel" | "organization")}
                                        >
                                            <option value="individual">Individual</option>
                                            <option value="channel">Channel</option>
                                            <option value="organization">Organization</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div className="form-group">
                                    <label className="form-label">Bio</label>
                                    <textarea
                                        className="form-textarea"
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                        placeholder="Tell the community about yourself..."
                                        rows={3}
                                    />
                                </div>
                                
                                <div className="form-group">
                                    <label className="form-label">Banner Image URL</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={bannerUrl}
                                        onChange={(e) => setBannerUrl(e.target.value)}
                                        placeholder="https://example.com/banner.jpg"
                                    />
                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                        Displayed at the top of your public gallery
                                    </div>
                                </div>

                                <button
                                    onClick={handleUpdateProfile}
                                    className="btn btn-primary"
                                    disabled={saving}
                                >
                                    {saving ? 'Saving...' : 'Save Creator Profile'}
                                </button>
                            </div>
                        ) : (
                            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>
                                Enable your public profile to appear in the Creator Directory and showcase your contributed resources. Don't forget to click 'Save Changes' above.
                            </p>
                        )}
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
                        {profile?.subscription?.status === 'active' ? (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', marginBottom: 'var(--space-2)' }}>
                                            {profile.subscription.bundleId}
                                        </div>
                                        <span className="badge badge-success" style={{ marginBottom: 'var(--space-3)', display: 'inline-block' }}>
                                            ✅ ACTIVE
                                        </span>
                                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
                                            Active suite access:
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                                            {profile.subscription.activeSuites.map((suite) => (
                                                <span key={suite} className="badge badge-primary" style={{ textTransform: 'capitalize' }}>
                                                    {suite === 'resources' ? '📚' : suite === 'studio' ? '🎨' : suite === 'registry' ? '📋' : '✨'} {suite}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <a href="/pricing" className="btn btn-ghost btn-sm" style={{ whiteSpace: 'nowrap' }}>
                                        Manage Plan
                                    </a>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                                        Current Plan: <span className="badge badge-secondary" style={{ textTransform: 'uppercase' }}>FREE</span>
                                    </div>
                                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                                        Upgrade to unlock the full Stillwater ecosystem — Studio, Registry &amp; more.
                                    </div>
                                </div>
                                <a href="/pricing" className="btn btn-primary btn-sm">
                                    Upgrade Plan
                                </a>
                            </div>
                        )}
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
