import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { ThumbnailAsset } from '@/lib/types';
import Link from 'next/link';

interface ThumbnailPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (url: string) => void;
}

export default function ThumbnailPicker({ isOpen, onClose, onSelect }: ThumbnailPickerProps) {
    const [assets, setAssets] = useState<ThumbnailAsset[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchAssets();
        }
    }, [isOpen]);

    const fetchAssets = async () => {
        try {
            setLoading(true);
            const q = query(collection(db, 'thumbnailAssets'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ThumbnailAsset[];
            setAssets(data);
        } catch (error) {
            console.error('Error fetching assets:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredAssets = assets.filter(a => 
        a.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.tags?.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleSelect = (asset: ThumbnailAsset) => {
        onSelect(asset.url);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="📂 Nanobanana Scenario Library"
            className="modal-wide"
            footer={
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
                            {filteredAssets.length} scenarios available
                        </p>
                        <Link href="/resources/admin/assets" className="btn btn-ghost btn-xs" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                            🖼️ Manage Library
                        </Link>
                    </div>
                    <button className="btn btn-secondary" onClick={onClose}>Close</button>
                </div>
            }
        >
            <div style={{ padding: '2px 0' }}>
                <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
                    <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Search assets by tag or title (e.g. 'tutorial', 'gemini')..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {loading && assets.length === 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
                        <div className="spinner" />
                    </div>
                ) : (
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
                        gap: 'var(--space-4)',
                        maxHeight: '60vh',
                        overflowY: 'auto',
                        padding: '2px'
                    }}>
                        {filteredAssets.map((asset) => (
                            <div 
                                key={asset.id} 
                                className="glass-card hover-lift" 
                                style={{ 
                                    padding: 'var(--space-2)', 
                                    cursor: 'pointer',
                                    border: selectedId === asset.id ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                }}
                                onClick={() => handleSelect(asset)}
                            >
                                <div style={{ 
                                    position: 'relative', 
                                    height: '110px', 
                                    width: '100%', 
                                    borderRadius: 'var(--radius-sm)',
                                    overflow: 'hidden',
                                    marginBottom: 'var(--space-2)'
                                }}>
                                    <Image 
                                        src={asset.url} 
                                        alt={asset.title} 
                                        fill 
                                        style={{ objectFit: 'cover' }}
                                    />
                                </div>
                                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {asset.title}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                                    {asset.tags?.slice(0, 3).map(tag => (
                                        <span key={tag} style={{ fontSize: '9px', background: 'rgba(255,255,255,0.05)', padding: '1px 4px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {!loading && filteredAssets.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
                        <p style={{ color: 'var(--text-secondary)' }}>No matching scenarios found.</p>
                        <button className="btn btn-link" onClick={() => setSearchTerm('')}>Clear Search</button>
                    </div>
                )}
            </div>
        </Modal>
    );
}
