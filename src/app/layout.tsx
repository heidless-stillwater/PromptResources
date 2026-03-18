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
    title: 'PromptResources - AI Prompt Education & Reference Hub',
    description: 'Discover, organize, and master AI prompts. Curated educational resources for Gemini, NanoBanana, ChatGPT, Claude, and more. Free and premium content for all skill levels.',
    keywords: 'AI prompts, prompt engineering, Gemini, NanoBanana, ChatGPT, Claude, Midjourney, AI education',
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
