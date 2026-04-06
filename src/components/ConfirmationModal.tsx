'use client';

import React from 'react';
import Modal from './Modal';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    loading?: boolean;
}

export default function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDanger = false,
    loading = false
}: ConfirmationModalProps) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            maxWidth="400px"
            footer={
                <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', width: '100%' }}>
                    <button 
                        className="btn btn-secondary" 
                        onClick={onClose}
                        disabled={loading}
                    >
                        {cancelText}
                    </button>
                    <button 
                        className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`}
                        onClick={onConfirm}
                        disabled={loading}
                    >
                        {loading ? '...' : confirmText}
                    </button>
                </div>
            }
        >
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                {message}
            </p>
        </Modal>
    );
}
