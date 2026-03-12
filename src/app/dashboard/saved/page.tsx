'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDoc, doc } from 'firebase/firestore';
import { Resource, UserResourceData } from '@/lib/types';

export default function SavedResourcesPage() {
    const { user, loading: authLoading } = useAuth();
    const [savedResources, setSavedResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchSavedResources() {
            if (!user) return;
            try {
                const userResResponse = await fetch(`/api/user-resources?uid=${user.uid}`);
                const userResResult = await userResResponse.json();

                if (userResResult.success) {
                    const data = userResResult.data as UserResourceData;
                    const savedIds = data.savedResources || [];
                    if (savedIds.length > 0) {
                        try {
                            const res = await fetch('/api/resources/bulk', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ ids: savedIds })
                            });
                            const result = await res.json();
                            if (result.success) {
                                setSavedResources(result.data);
                            }
                        } catch (err) {
                            console.error('Error fetching bulk resources:', err);
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching saved resources:', error);
            } finally {
                setLoading(false);
            }
        }
        if (user) fetchSavedResources();
    }, [user]);

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

    return (
        <div className="page-wrapper">
            <Navbar />
            <div className="main-content">
                <div className="container">
                    <div style={{ marginBottom: 'var(--space-8)' }}>
                        <h1 style={{ marginBottom: 'var(--space-2)' }}>⭐ Saved Resources</h1>
                        <p style={{ color: 'var(--text-muted)' }}>All the resources you&apos;ve bookmarked for later</p>
                    </div>

                    {loading ? (
                        <div className="loading-page" style={{ minHeight: '300px' }}>
                            <div className="spinner" />
                        </div>
                    ) : savedResources.length === 0 ? (
                        <div className="glass-card" style={{
                            textAlign: 'center',
                            padding: 'var(--space-12) var(--space-6)',
                        }}>
                            <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>📭</div>
                            <h2 style={{ marginBottom: 'var(--space-2)' }}>No saved resources</h2>
                            <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-6)', maxWidth: '400px', marginInline: 'auto' }}>
                                You haven&apos;t saved any resources yet. Start exploring our collection to find something interesting!
                            </p>
                            <Link href="/resources" className="btn btn-primary">
                                Browse Resources
                            </Link>
                        </div>
                    ) : (
                        <div className="resources-grid">
                            {savedResources.map((resource) => (
                                <Link
                                    href={`/resources/${resource.id}`}
                                    key={resource.id}
                                    style={{ textDecoration: 'none' }}
                                >
                                    <div className="resource-card glass-card h-full">
                                        <div className="resource-thumbnail">
                                            {resource.youtubeVideoId ? (
                                                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                                                    <Image
                                                        src={`https://img.youtube.com/vi/${resource.youtubeVideoId}/mqdefault.jpg`}
                                                        alt={resource.title || 'Video thumbnail'}
                                                        fill
                                                        style={{ objectFit: 'cover' }}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="resource-placeholder">
                                                    {resource.type === 'article' ? '📝' : '🔧'}
                                                </div>
                                            )}
                                            <div className="resource-type-badge">
                                                {resource.type?.toUpperCase() || 'RESOURCE'}
                                            </div>
                                        </div>
                                        <div className="resource-content">
                                            <h3 className="resource-title">{resource.title}</h3>
                                            <p className="resource-desc text-clamp-2">{resource.description}</p>
                                            <div className="resource-meta">
                                                <span className={`badge badge-${resource.pricing}`}>{resource.pricing}</span>
                                                <span className="resource-platform">{resource.platform}</span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <Footer />
        </div>
    );
}
