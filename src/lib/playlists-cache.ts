let sharedPlaylistsPromise: Promise<any[]> | null = null;
let sharedPlaylistsCache: any[] | null = null;

export async function getSharedPlaylists(getIdToken: () => Promise<string>): Promise<any[]> {
    if (sharedPlaylistsCache) {
        return sharedPlaylistsCache;
    }
    if (!sharedPlaylistsPromise) {
        sharedPlaylistsPromise = (async (): Promise<any[]> => {
            try {
                const token = await getIdToken();
                const res = await fetch('/api/playlists?userOnly=true', {
                    headers: { 'Authorization': `Bearer ${token}` },
                    cache: 'no-store'
                });
                const result = await res.json();
                if (result.success) {
                    sharedPlaylistsCache = result.data || [];
                    return sharedPlaylistsCache as any[];
                }
            } catch (e) {
                console.error('Error fetching shared playlists:', e);
            }
            sharedPlaylistsPromise = null;
            return [];
        })();
    }
    return sharedPlaylistsPromise;
}

export function clearPlaylistsCache() {
    sharedPlaylistsCache = null;
    sharedPlaylistsPromise = null;
}
