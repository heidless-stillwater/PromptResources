'use client';

import React, { useEffect, useRef } from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    maxWidth?: string;
    className?: string;
}

export default function Modal({ isOpen, onClose, title, children, footer, maxWidth, className }: ModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-backdrop fixed inset-0 z-[1000] flex items-center justify-center p-4" onClick={handleBackdropClick}>
            <div
                ref={modalRef}
                className={`modal relative overflow-hidden ${className || ''}`}
                style={{ maxWidth: maxWidth || '640px', width: '100%' }}
            >
                {/* Premium Neural Indicator */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
                
                <div className="modal-header flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(99,102,241,0.8)] animate-pulse"></div>
                        <h2 className="modal-title m-0">{title}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-foreground-muted hover:text-white transition-colors text-2xl bg-transparent border-none cursor-pointer"
                    >
                        &times;
                    </button>
                </div>
                <div className="modal-body">
                    {children}
                </div>
                {footer && (
                    <div className="modal-footer">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
