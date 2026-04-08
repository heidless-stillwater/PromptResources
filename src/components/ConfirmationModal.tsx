'use client';

import React from 'react';
import Modal from './Modal';
import { Button } from './ui/Button';

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
            maxWidth="450px"
            footer={
                <div className="flex gap-4 justify-end w-full">
                    <Button 
                        variant="secondary" 
                        onClick={onClose}
                        disabled={loading}
                        className="font-bold"
                    >
                        {cancelText}
                    </Button>
                    <Button 
                        variant={isDanger ? 'danger' : 'primary'}
                        onClick={onConfirm}
                        disabled={loading}
                        className="font-bold min-w-[100px]"
                    >
                        {loading ? 'Processing...' : confirmText}
                    </Button>
                </div>
            }
        >
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                {message}
            </p>
        </Modal>
    );
}
