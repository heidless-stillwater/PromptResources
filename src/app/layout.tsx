import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';

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
            <body>
                <AuthProvider>
                    {children}
                </AuthProvider>
                {process.env.NODE_ENV === 'development' && <Agentation />}
            </body>
        </html>
    );
}
