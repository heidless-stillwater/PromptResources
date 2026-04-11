'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Icons } from './ui/Icons';

interface ManageSubscriptionButtonProps {
    className?: string;
    style?: React.CSSProperties;
    label?: string;
}

export default function ManageSubscriptionButton({ 
    className = 'btn btn-ghost btn-sm', 
    style, 
    label = 'Manage Plan' 
}: ManageSubscriptionButtonProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    const handleManage = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (!user) return;

        setLoading(true);
        try {
            const response = await fetch('/api/stripe/portal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    uid: user.uid,
                    returnUrl: window.location.href 
                }),
            });

            const data = await response.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                alert(data.error || 'Failed to open billing portal');
            }
        } catch (error) {
            console.error('Portal Error:', error);
            alert('An error occurred. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <button 
            onClick={handleManage}
            disabled={loading}
            className={className}
            style={style}
        >
            {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="spinner-loading" style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    Syncing...
                </span>
            ) : (
                <>
                    {label} {label.includes('→') ? '' : '→'}
                </>
            )}
        </button>
    );
}

// Add simple spin animation if not exists
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
}
