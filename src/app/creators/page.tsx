import { Metadata } from 'next';
import { getAllCreators } from '@/lib/creators-server';
import { sanitize } from '@/lib/utils';
import CreatorsDirectoryClient from './CreatorsDirectoryClient';

export const metadata: Metadata = {
    title: 'Creator Directory | PromptResources',
    description: 'Discover the creators and curators behind the best AI learning resources. Explore profiles, browse their collections, and find your next favourite creator.',
};

export default async function CreatorsPage() {
    const [featured, all] = await Promise.all([
        getAllCreators({ featured: true, limit: 6 }),
        getAllCreators({ limit: 48 }),
    ]);

    return <CreatorsDirectoryClient featured={sanitize(featured)} creators={sanitize(all)} />;
}
