import type { Metadata } from 'next';
import './globals.css';
import { Inter, Outfit } from 'next/font/google';

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
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/components/Toast';
import ReactQueryProvider from '@/components/providers/ReactQueryProvider';
import CommandPalette from '@/components/CommandPalette';
import { SovereignSentinel } from '@/components/SovereignSentinel';
import { SovereignConsole } from '@/components/SovereignConsole';

export const metadata: Metadata = {
    title: 'Stillwater Resources | AI Education Hub',
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
