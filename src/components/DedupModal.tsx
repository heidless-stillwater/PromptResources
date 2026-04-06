'use client';

import React, { useState, useEffect } from 'react';
import Modal from '@/components/Modal';
import { Resource } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import ConfirmationModal from '@/components/ConfirmationModal';

interface DedupModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function DedupModal({ isOpen, onClose }: DedupModalProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [resolving, setResolving] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
    const [duplicates, setDuplicates] = useState<{
        type: 'url' | 'title' | 'youtube';
        key: string;
        items: Resource[];
    }[]>([]);

    const scanForDuplicates = async () => {
        if (!user) return;
        setLoading(true);
        setSelectedIds(new Set()); // Reset on scan
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/resources/scan-duplicates', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (data.duplicates) {
                setDuplicates(data.duplicates);
            } else if (data.error) {
                console.error("Scan error:", data.error);
            }
        } catch (error) {
            console.error("Error scanning duplicates", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            scanForDuplicates();
        }
    }, [isOpen]);

    const handleUpdate = async (id: string, field: 'title' | 'url', val: string) => {
        if (!user) return;
        setResolving(`${id}-${field}`);
        try {
            const token = await user.getIdToken();
            const response = await fetch(`/api/resources/${id}`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ [field]: val }),
            });
            
            if (!response.ok) throw new Error('Update failed');
            
            await scanForDuplicates(); // Rescan to organically remove from group
        } catch (error) {
            console.error("Error updating", error);
            alert("Failed to update.");
        } finally {
            setResolving(null);
        }
    };

    const handleDelete = (id: string) => {
        setConfirmDeleteId(id);
    };

    const confirmDelete = async () => {
        if (!user || !confirmDeleteId) return;
        setResolving(confirmDeleteId);
        try {
            const token = await user.getIdToken();
            const response = await fetch(`/api/resources/${confirmDeleteId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) throw new Error('Delete failed');
            
            await scanForDuplicates();
        } catch (error) {
            console.error("Error deleting", error);
            alert("Failed to delete.");
        } finally {
            setResolving(null);
            setConfirmDeleteId(null);
        }
    };

    const handleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handleSelectGroup = (items: Resource[]) => {
        const next = new Set(selectedIds);
        const allIn = items.every(i => next.has(i.id));
        items.forEach(i => {
            if (allIn) next.delete(i.id);
            else next.add(i.id);
        });
        setSelectedIds(next);
    };

    const handleSelectAllExceptOne = (items: Resource[]) => {
        const next = new Set(selectedIds);
        // Keep the first, select the rest
        next.delete(items[0].id);
        for (let i = 1; i < items.length; i++) {
            next.add(items[i].id);
        }
        setSelectedIds(next);
    };

    const runBulkDelete = async () => {
        if (!user || selectedIds.size === 0) return;
        
        setIsBulkDeleting(true);
        try {
            const token = await user.getIdToken();
            const deletePromises = Array.from(selectedIds).map(id => 
                fetch(`/api/resources/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            );
            
            await Promise.all(deletePromises);
            await scanForDuplicates();
        } catch (error) {
            console.error("Error bulk deleting", error);
            alert("Failed to delete some items.");
        } finally {
            setIsBulkDeleting(false);
            setConfirmBulkDelete(false);
            setSelectedIds(new Set());
        }
    };


    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Deduplication Center"
            className="modal-wide"
            footer={
                <button className="btn btn-primary" onClick={onClose}>Close Tool</button>
            }
        >
            <div className="dedup-container" style={{ padding: 'var(--space-2) 0', maxHeight: '70vh', overflowY: 'auto' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
                    This tool scans your entire database for items sharing the exact same URL or Title. You can alter the fields inline to clarify differences, or instantly trash redundancies.
                </p>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)' }}>
                        <div className="spinner"></div>
                    </div>
                ) : duplicates.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 'var(--space-8)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ fontSize: '2rem', marginBottom: 'var(--space-3)' }}>🎉</div>
                        <h3 style={{ color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>No Duplicates Found</h3>
                        <p style={{ color: 'var(--text-secondary)' }}>Your registry is currently clean and deduped!</p>
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
                                {loading ? 'Scanning...' : `Found ${duplicates.length} duplicate clusters.`}
                            </p>
                            {selectedIds.size > 0 && (
                                <button 
                                    className="btn btn-danger btn-sm"
                                    onClick={() => setConfirmBulkDelete(true)}
                                    disabled={loading || isBulkDeleting}
                                >
                                    🗑️ Delete {selectedIds.size} Selected
                                </button>
                            )}
                        </div>

                        {duplicates.map((group, idx) => (
                            <div key={idx} style={{ 
                                background: 'var(--bg-secondary)', 
                                border: '1px solid var(--border-subtle)', 
                                borderRadius: 'var(--radius-md)',
                                overflow: 'hidden'
                            }}>
                                <div style={{ 
                                    padding: 'var(--space-3) var(--space-4)', 
                                    background: 'rgba(255,255,255,0.02)',
                                    borderBottom: '1px solid var(--border-subtle)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={group.items.every(i => selectedIds.has(i.id))}
                                            onChange={() => handleSelectGroup(group.items)}
                                            style={{ cursor: 'pointer' }}
                                        />
                                        <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ 
                                                background: group.type === 'url' ? 'rgba(99,102,241,0.2)' : 
                                                           group.type === 'youtube' ? 'rgba(239,68,68,0.2)' : 
                                                           'rgba(245,158,11,0.2)',
                                                color: group.type === 'url' ? 'var(--accent-primary)' : 
                                                       group.type === 'youtube' ? 'var(--danger)' : 
                                                       'var(--warning)',
                                                padding: '2px 8px',
                                                borderRadius: '12px',
                                                fontSize: '11px',
                                                textTransform: 'uppercase',
                                                fontWeight: 600
                                            }}>
                                                Match by {group.type}
                                            </span>
                                            {group.key}
                                        </h4>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{group.items.length} items</span>
                                        <button 
                                            className="btn btn-link btn-sm" 
                                            style={{ color: 'var(--accent-primary)', fontSize: '12px', padding: 0 }}
                                            onClick={() => handleSelectAllExceptOne(group.items)}
                                        >
                                            Select all but one
                                        </button>
                                    </div>
                                </div>
                                <div style={{ padding: 'var(--space-4)' }}>
                                    {group.items.map(item => (
                                        <div key={item.id} style={{ 
                                            display: 'grid', 
                                            gridTemplateColumns: 'auto minmax(0, 1fr) minmax(0, 1fr) auto', 
                                            gap: 'var(--space-4)',
                                            alignItems: 'center',
                                            padding: 'var(--space-3) 0',
                                            borderBottom: '1px solid rgba(255,255,255,0.05)'
                                        }}>
                                            <input 
                                                type="checkbox" 
                                                checked={selectedIds.has(item.id)}
                                                onChange={() => handleSelect(item.id)}
                                                style={{ cursor: 'pointer' }}
                                            />
                                            <div>
                                                <label style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Title</label>
                                                <input 
                                                    type="text" 
                                                    className="form-input" 
                                                    defaultValue={item.title} 
                                                    onBlur={(e) => {
                                                        if (e.target.value !== item.title) handleUpdate(item.id, 'title', e.target.value);
                                                    }}
                                                    disabled={resolving === `${item.id}-title` || resolving === item.id}
                                                    style={{ padding: '4px 8px', fontSize: '13px' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>URL</label>
                                                <input 
                                                    type="text" 
                                                    className="form-input" 
                                                    defaultValue={item.url} 
                                                    onBlur={(e) => {
                                                        if (e.target.value !== item.url) handleUpdate(item.id, 'url', e.target.value);
                                                    }}
                                                    disabled={resolving === `${item.id}-url` || resolving === item.id}
                                                    style={{ padding: '4px 8px', fontSize: '13px' }}
                                                />
                                            </div>
                                            <div style={{ paddingTop: '20px' }}>
                                                <button 
                                                    className="btn btn-danger btn-sm"
                                                    onClick={() => handleDelete(item.id)}
                                                    disabled={resolving === item.id}
                                                    style={{ background: 'rgba(239, 68, 68, 0.8)', padding: '6px 12px' }}
                                                >
                                                    {resolving === item.id ? '...' : '🗑️'}
                                                </button>
                                            </div>

                                            {item.adminNotes && (
                                                <div style={{ 
                                                    gridColumn: '2 / 5', 
                                                    fontSize: '11px', 
                                                    color: 'var(--accent-orange)', 
                                                    background: 'rgba(249, 115, 22, 0.05)',
                                                    padding: '4px 8px',
                                                    borderRadius: '4px',
                                                    marginTop: '-8px',
                                                    marginBottom: '8px',
                                                    borderLeft: '2px solid var(--accent-orange)',
                                                    fontStyle: 'italic'
                                                }}>
                                                    🔒 Admin Note: {item.adminNotes}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </div>

            <ConfirmationModal
                isOpen={!!confirmDeleteId}
                onClose={() => setConfirmDeleteId(null)}
                onConfirm={confirmDelete}
                title="🗑️ Delete Duplicate?"
                message="Are you sure you want to completely delete this duplicate resource? This action cannot be undone."
                confirmText="Delete Redundancy"
                isDanger={true}
                loading={resolving === confirmDeleteId}
            />
            <ConfirmationModal
                isOpen={confirmBulkDelete}
                onClose={() => setConfirmBulkDelete(false)}
                onConfirm={runBulkDelete}
                title="🗑️ Delete Selected Rows?"
                message={`You are about to delete ${selectedIds.size} resources permanently. This action is irreversible. Please ensure you are not deleting all versions of a resource.`}
                confirmText={`Delete ${selectedIds.size} Items`}
                isDanger={true}
                loading={isBulkDeleting}
            />
        </Modal>
    );
}
