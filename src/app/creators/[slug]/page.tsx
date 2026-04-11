import { Metadata } from 'next';
export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';
import { getUserBySlug, getCreatorResources, getCreatorStats } from '@/lib/creators-server';
import CreatorProfileClient from './CreatorProfileClient';

interface PageProps {
    params: { slug: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const creator = await getUserBySlug(params.slug);
    if (!creator) return { title: 'Creator Not Found | PromptResources' };

    return {
        title: `${creator.displayName} — Creator Profile | PromptResources`,
        description: creator.bio || `Explore AI resources created and curated by ${creator.displayName} on PromptResources.`,
        openGraph: {
            title: `${creator.displayName} | PromptResources`,
            description: creator.bio || `Explore AI resources created and curated by ${creator.displayName}.`,
            images: creator.photoURL ? [{ url: creator.photoURL }] : [],
            type: 'profile',
        },
        twitter: {
            card: 'summary_large_image',
            title: `${creator.displayName} | PromptResources`,
            description: creator.bio || `Explore AI resources by ${creator.displayName}.`,
        }
    };
}

export default async function CreatorProfilePage({ params }: PageProps) {
    const creator = await getUserBySlug(params.slug);
    if (!creator) notFound();

    const [stats, resources] = await Promise.all([
        getCreatorStats(creator.uid),
        getCreatorResources(creator.uid, { pageSize: 120 }) // Higher limit for profile page
    ]);

    return (
        <CreatorProfileClient
            creator={creator}
            initialResources={resources.data || []}
            stats={stats}
        />
    );
}
