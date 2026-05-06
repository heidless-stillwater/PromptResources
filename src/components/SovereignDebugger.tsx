'use client';

import React, { useEffect } from 'react';

/**
 * SovereignDebugger: Trace-intercept for .toDate crashes
 * This is a client-side utility that wraps console.error and window errors
 * to provide better debugging for Firestore date serialization issues.
 */
export function SovereignDebugger() {
    useEffect(() => {
        const originalError = console.error;
        console.error = (...args: any[]) => {
            const msg = args.join(' ');
            if (msg.includes('toDate') || msg.includes('is not a function')) {
                console.warn('⚠️ [SovereignTrace] Intercepted potential date serialization crash:', args);
                console.trace();
            }
            originalError.apply(console, args);
        };

        const handleError = (event: ErrorEvent) => {
            if (event.message?.includes('toDate')) {
                console.error('🔥 [SovereignSentinel] CRITICAL TRACE:', {
                    message: event.message,
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                    error: event.error
                });
            }
        };

        window.addEventListener('error', handleError);
        return () => window.removeEventListener('error', handleError);
    }, []);

    return null; // This component doesn't render anything
}
