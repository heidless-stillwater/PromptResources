'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

interface SearchResult {
    id: string;
    title: string;
    description: string;
    platform: string;
}

export default function CommandPalette() {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    // Toggle palette on Cmd+K or Ctrl+K
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen((prev) => !prev);
            }
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
            setSearch('');
            setActiveIndex(0);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
    }, [isOpen]);

    // Fetch matching resources
    const { data: results = [], isLoading } = useQuery<SearchResult[]>({
        queryKey: ['quick-search', search],
        queryFn: async () => {
            if (!search.trim()) return [];
            const res = await fetch(`/api/resources?search=${encodeURIComponent(search)}&pageSize=5`);
            const json = await res.json();
            return json.success ? json.data : [];
        },
        enabled: search.length > 1,
    });

    const staticCommands = [
        { id: 'nav-home', title: 'Go to Home', desc: 'Return to landing page', icon: '🏠', path: '/' },
        { id: 'nav-explore', title: 'Explore Resources', desc: 'Browse all prompt collections', icon: '🧭', path: '/resources' },
        { id: 'nav-dashboard', title: 'My Dashboard', desc: 'View your saved prompts', icon: '📊', path: '/dashboard' },
        { id: 'nav-settings', title: 'Account Settings', desc: 'Manage your profile', icon: '⚙️', path: '/dashboard/settings' },
    ].filter(cmd => 
        !search || 
        cmd.title.toLowerCase().includes(search.toLowerCase()) || 
        cmd.desc.toLowerCase().includes(search.toLowerCase())
    );

    const allResults = [...staticCommands, ...results];

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((prev) => (prev + 1) % allResults.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((prev) => (prev - 1 + allResults.length) % allResults.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const selected = allResults[activeIndex];
            if (selected) {
                if ('path' in selected) {
                    router.push(selected.path);
                } else {
                    router.push(`/resources/${selected.id}`);
                }
                setIsOpen(false);
            }
        }
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === overlayRef.current) {
            setIsOpen(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="command-palette-overlay" ref={overlayRef} onClick={handleBackdropClick}>
            <div className="command-palette-content animate-fade-in">
                <div className="command-palette-header">
                    <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>🔍</span>
                    <input
                        ref={inputRef}
                        type="text"
                        className="command-palette-input"
                        placeholder="Search resources or navigate..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setActiveIndex(0);
                        }}
                        onKeyDown={handleKeyDown}
                    />
                </div>

                <div className="command-palette-results">
                    {staticCommands.length > 0 && (
                        <>
                            <div className="command-palette-group-title">Navigation</div>
                            {staticCommands.map((cmd, i) => (
                                <button
                                    key={cmd.id}
                                    className={`command-palette-item ${activeIndex === i ? 'active' : ''}`}
                                    onClick={() => {
                                        router.push(cmd.path);
                                        setIsOpen(false);
                                    }}
                                    onMouseEnter={() => setActiveIndex(i)}
                                >
                                    <div className="command-palette-item-icon">{cmd.icon}</div>
                                    <div className="command-palette-item-info">
                                        <div className="command-palette-item-title">{cmd.title}</div>
                                        <div className="command-palette-item-desc">{cmd.desc}</div>
                                    </div>
                                </button>
                            ))}
                        </>
                    )}

                    {results.length > 0 && (
                        <>
                            <div className="command-palette-group-title">Resources</div>
                            {results.map((res, i) => {
                                const index = i + staticCommands.length;
                                return (
                                    <button
                                        key={res.id}
                                        className={`command-palette-item ${activeIndex === index ? 'active' : ''}`}
                                        onClick={() => {
                                            router.push(`/resources/${res.id}`);
                                            setIsOpen(false);
                                        }}
                                        onMouseEnter={() => setActiveIndex(index)}
                                    >
                                        <div className="command-palette-item-icon">📄</div>
                                        <div className="command-palette-item-info">
                                            <div className="command-palette-item-title">{res.title}</div>
                                            <div className="command-palette-item-desc">{res.platform} • {res.description}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </>
                    )}

                    {!isLoading && allResults.length === 0 && search && (
                        <div className="command-palette-empty">
                            No results found for &quot;{search}&quot;
                        </div>
                    )}
                    
                    {isLoading && (
                        <div className="command-palette-empty">
                            Searching...
                        </div>
                    )}
                </div>

                <div className="command-palette-footer">
                    <div className="command-palette-shortcut">
                        <span className="command-palette-key">↵</span> to select
                    </div>
                    <div className="command-palette-shortcut">
                        <span className="command-palette-key">↑↓</span> to navigate
                    </div>
                    <div className="command-palette-shortcut">
                        <span className="command-palette-key">ESC</span> to close
                    </div>
                </div>
            </div>
        </div>
    );
}
