'use client';

import React, { useEffect, useRef } from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    maxWidth?: string;
}

export default function Modal({ isOpen, onClose, title, children, footer, maxWidth }: ModalProps) {
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
        <div className="modal-backdrop" onClick={handleBackdropClick} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1000 }}>
            <div
                ref={modalRef}
                className="modal animate-slide-up"
                style={{ maxWidth: maxWidth || '640px' }}
            >
                <div className="modal-header">
                    <h2 className="modal-title">{title}</h2>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.5rem' }}
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
