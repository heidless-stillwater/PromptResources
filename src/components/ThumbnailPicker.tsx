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
                <div className="flex justify-between w-full items-center">
                    <div className="flex gap-4 items-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/30">
                            {filteredAssets.length} scenarios available
                        </p>
                        <Link href="/resources/admin/assets" className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-all">
                            🖼️ Manage Library
                        </Link>
                    </div>
                    <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-all" onClick={onClose}>Close</button>
                </div>
            }
        >
            <div className="p-1">
                <div className="mb-6">
                    <input 
                        type="text" 
                        className="w-full bg-background/40 border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold focus:border-primary outline-none transition-all placeholder:text-white/10" 
                        placeholder="Search assets by tag or title (e.g. 'tutorial', 'gemini')..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {loading && assets.length === 0 ? (
                    <div className="flex justify-center py-12">
                        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 max-h-[60vh] overflow-y-auto p-1 custom-scrollbar">
                        {filteredAssets.map((asset) => (
                            <div 
                                key={asset.id} 
                                className={`glass-card group/asset p-2 cursor-pointer border transition-all duration-300 ${selectedId === asset.id ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20' : 'border-white/5 hover:border-primary/30'}`}
                                onClick={() => handleSelect(asset)}
                            >
                                <div className="relative aspect-video rounded-lg overflow-hidden mb-3">
                                    <Image 
                                        src={asset.url} 
                                        alt={asset.title} 
                                        fill 
                                        className="object-cover transition-transform duration-500 group-hover/asset:scale-110"
                                    />
                                </div>
                                <div className="text-[10px] font-black text-white/80 group-hover/asset:text-primary transition-colors mb-1 truncate px-1 uppercase tracking-tight">
                                    {asset.title}
                                </div>
                                <div className="flex flex-wrap gap-1 px-1">
                                    {asset.tags?.slice(0, 2).map(tag => (
                                        <span key={tag} className="text-[8px] font-black uppercase tracking-tighter text-white/20 group-hover/asset:text-white/40">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {!loading && filteredAssets.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-sm font-medium text-white/30 mb-4">No matching scenarios found.</p>
                        <button className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80" onClick={() => setSearchTerm('')}>Clear Filter</button>
                    </div>
                )}
            </div>
        </Modal>
    );
}
