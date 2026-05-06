import React from 'react';
import type { Metadata } from 'next';
import pkg from "../../package.json";
import './globals.css';
// import { Inter, Outfit } from 'next/font/google';

// Temporary system font fallbacks to bypass build-time network failures
const inter = { variable: 'font-inter', className: 'font-inter' };
const outfit = { variable: 'font-outfit', className: 'font-outfit' };

/*
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const outfit = Outfit({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-outfit',
});
*/
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/components/Toast';
import ReactQueryProvider from '@/components/providers/ReactQueryProvider';
import CommandPalette from '@/components/CommandPalette';
import { SovereignSentinel } from '@/components/SovereignSentinel';
import { SovereignConsole } from '@/components/SovereignConsole';
import { SovereignDebugger } from '@/components/SovereignDebugger';

export const metadata: Metadata = {
    title: `Stillwater Resources v${pkg.version} | AI Education Hub`,
    description: 'Discover, organize, and master architectural AI prompts. Part of the Stillwater Ecosystem.',
    icons: {
        icon: '/favicon.svg',
    },
};

import { Agentation } from 'agentation';

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {

    return (
        <html lang="en">
            <body className={`${inter.variable} ${outfit.variable}`}>
                <AuthProvider>
                    <ToastProvider>
                        <ReactQueryProvider>
                            <SovereignSentinel />
                            <SovereignConsole />
                            <SovereignDebugger />
                            <CommandPalette />
                            {children}
                        </ReactQueryProvider>
                    </ToastProvider>
                </AuthProvider>
                {process.env.NODE_ENV === 'development' && <Agentation />}
            </body>
        </html>
    );
}
