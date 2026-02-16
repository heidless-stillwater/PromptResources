'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { db } from '@/lib/firebase';
import { doc, getDoc, deleteDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Resource } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { getYouTubeEmbedUrl, extractYouTubeId } from '@/lib/youtube';

export default function ResourceDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user, isAdmin, activeRole } = useAuth();
    const [resource, setResource] = useState<Resource | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSaved, setIsSaved] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const resourceId = params.id as string;

    useEffect(() => {
        async function fetchResource() {
            try {
                const docRef = doc(db, 'resources', resourceId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setResource({
                        id: docSnap.id,
                        ...docSnap.data(),
                        createdAt: docSnap.data().createdAt?.toDate() || new Date(),
                        updatedAt: docSnap.data().updatedAt?.toDate() || new Date(),
                    } as Resource);
                }

                // Check if saved
                if (user) {
                    const userResRef = doc(db, 'userResources', user.uid);
                    const userResSnap = await getDoc(userResRef);
                    if (userResSnap.exists()) {
                        setIsSaved(userResSnap.data().savedResources?.includes(resourceId) || false);
                    }
                }
            } catch (error) {
                console.error('Error fetching resource:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchResource();
    }, [resourceId, user]);

    const handleSave = async () => {
        if (!user) return router.push('/auth/login');
        try {
            const userResRef = doc(db, 'userResources', user.uid);
            if (isSaved) {
                await updateDoc(userResRef, { savedResources: arrayRemove(resourceId) });
            } else {
                await updateDoc(userResRef, { savedResources: arrayUnion(resourceId) });
            }
            setIsSaved(!isSaved);
        } catch (error) {
            // If doc doesn't exist, create it
            const { setDoc } = await import('firebase/firestore');
            const userResRef = doc(db, 'userResources', user.uid);
            await setDoc(userResRef, { savedResources: [resourceId], notes: {}, progress: {} });
            setIsSaved(true);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this resource?')) return;
        setDeleting(true);
        try {
            await deleteDoc(doc(db, 'resources', resourceId));
            router.push('/resources');
        } catch (error) {
            console.error('Error deleting resource:', error);
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="page-wrapper">
                <Navbar />
                <div className="loading-page">
                    <div className="spinner" />
                    <div className="loading-text">Loading resource...</div>
                </div>
            </div>
        );
    }

    if (!resource) {
        return (
            <div className="page-wrapper">
                <Navbar />
                <div className="main-content">
                    <div className="container">
                        <div className="empty-state">
                            <div className="empty-state-icon">🔍</div>
                            <div className="empty-state-title">Resource not found</div>
                            <Link href="/resources" className="btn btn-primary">
                                ← Back to Resources
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const ytId = resource.youtubeVideoId || (resource.mediaFormat === 'youtube' ? extractYouTubeId(resource.url) : null);

    return (
        <div className="page-wrapper">
            <Navbar />
            <div className="main-content">
                <div className="container" style={{ maxWidth: '900px' }}>
                    {/* Breadcrumb */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        marginBottom: 'var(--space-6)',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-muted)',
                    }}>
                        <Link href="/resources" style={{ color: 'var(--text-muted)' }}>Resources</Link>
                        <span>→</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{resource.title}</span>
                    </div>

                    <div className="glass-card animate-slide-up" style={{ padding: 0, overflow: 'hidden' }}>
                        {/* Video / Media */}
                        {ytId && (
                            <div className="youtube-embed">
                                <iframe
                                    src={getYouTubeEmbedUrl(ytId)}
                                    title={resource.title}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />
                            </div>
                        )}

                        <div style={{ padding: 'var(--space-8)' }}>
                            {/* Header */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                gap: 'var(--space-4)',
                                marginBottom: 'var(--space-6)',
                            }}>
                                <div style={{ flex: 1 }}>
                                    <h1 style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-3)' }}>
                                        {resource.title}
                                    </h1>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                                        <span className={`badge badge-${resource.pricing}`}>{resource.pricing}</span>
                                        <span className="badge badge-accent">{resource.platform}</span>
                                        <span className="badge badge-primary">{resource.type}</span>
                                        <span className="badge badge-warning">{resource.mediaFormat}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                    {user && (
                                        <button
                                            className={`btn ${isSaved ? 'btn-primary' : 'btn-secondary'}`}
                                            onClick={handleSave}
                                            id="save-resource"
                                        >
                                            {isSaved ? '⭐ Saved' : '☆ Save'}
                                        </button>
                                    )}
                                    <a
                                        href={resource.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-primary"
                                        id="open-resource"
                                    >
                                        🔗 Open Resource
                                    </a>
                                </div>
                            </div>

                            {/* Description */}
                            <div style={{ marginBottom: 'var(--space-8)' }}>
                                <h3 style={{
                                    fontSize: 'var(--text-base)',
                                    color: 'var(--text-secondary)',
                                    marginBottom: 'var(--space-3)',
                                }}>
                                    Description
                                </h3>
                                <p style={{
                                    color: 'var(--text-primary)',
                                    lineHeight: 1.8,
                                    whiteSpace: 'pre-wrap',
                                }}>
                                    {resource.description}
                                </p>
                            </div>

                            {/* Categories */}
                            <div style={{ marginBottom: 'var(--space-6)' }}>
                                <h3 style={{
                                    fontSize: 'var(--text-base)',
                                    color: 'var(--text-secondary)',
                                    marginBottom: 'var(--space-3)',
                                }}>
                                    Categories
                                </h3>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                                    {resource.categories?.map((cat) => (
                                        <Link
                                            key={cat}
                                            href={`/resources?category=${encodeURIComponent(cat)}`}
                                            className="badge badge-primary"
                                            style={{ textDecoration: 'none', cursor: 'pointer' }}
                                        >
                                            {cat}
                                        </Link>
                                    ))}
                                </div>
                            </div>

                            {/* Credits */}
                            {resource.credits && resource.credits.length > 0 && (
                                <div style={{ marginBottom: 'var(--space-6)' }}>
                                    <h3 style={{
                                        fontSize: 'var(--text-base)',
                                        color: 'var(--text-secondary)',
                                        marginBottom: 'var(--space-3)',
                                    }}>
                                        Credits & Attribution
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                        {resource.credits.map((credit, idx) => (
                                            <a
                                                key={idx}
                                                href={credit.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="card"
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 'var(--space-3)',
                                                    padding: 'var(--space-3) var(--space-4)',
                                                    textDecoration: 'none',
                                                }}
                                            >
                                                <span style={{ fontSize: '1.2rem' }}>👤</span>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                                                        {credit.name}
                                                    </div>
                                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                                        {credit.url}
                                                    </div>
                                                </div>
                                                <span style={{
                                                    marginLeft: 'auto',
                                                    color: 'var(--text-muted)',
                                                    fontSize: 'var(--text-sm)',
                                                }}>
                                                    ↗
                                                </span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Tags */}
                            {resource.tags && resource.tags.length > 0 && (
                                <div style={{ marginBottom: 'var(--space-6)' }}>
                                    <h3 style={{
                                        fontSize: 'var(--text-base)',
                                        color: 'var(--text-secondary)',
                                        marginBottom: 'var(--space-3)',
                                    }}>
                                        Tags
                                    </h3>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                                        {resource.tags.map((tag) => (
                                            <span key={tag} className="badge badge-primary"
                                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Pricing Details */}
                            {resource.pricingDetails && (
                                <div style={{ marginBottom: 'var(--space-6)' }}>
                                    <h3 style={{
                                        fontSize: 'var(--text-base)',
                                        color: 'var(--text-secondary)',
                                        marginBottom: 'var(--space-3)',
                                    }}>
                                        Pricing Details
                                    </h3>
                                    <p style={{ color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
                                        {resource.pricingDetails}
                                    </p>
                                </div>
                            )}

                            {/* Admin Actions */}
                            {isAdmin && (
                                <div style={{
                                    borderTop: '1px solid var(--border-subtle)',
                                    paddingTop: 'var(--space-6)',
                                    display: 'flex',
                                    gap: 'var(--space-3)',
                                }}>
                                    <Link href={`/resources/${resource.id}/edit`} className="btn btn-secondary" id="edit-resource">
                                        ✏️ Edit
                                    </Link>
                                    <button
                                        className="btn btn-danger"
                                        onClick={handleDelete}
                                        disabled={deleting}
                                        id="delete-resource"
                                    >
                                        {deleting ? 'Deleting...' : '🗑 Delete'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}
