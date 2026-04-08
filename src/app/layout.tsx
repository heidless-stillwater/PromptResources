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
import ReactQueryProvider from '@/components/providers/ReactQueryProvider';
import CommandPalette from '@/components/CommandPalette';

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
                    <ReactQueryProvider>
                        <CommandPalette />
                        {children}
                    </ReactQueryProvider>
                </AuthProvider>
                {process.env.NODE_ENV === 'development' && <Agentation />}
            </body>
        </html>
    );
}
