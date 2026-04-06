module.exports = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'lh3.googleusercontent.com',
            },
            {
                protocol: 'https',
                hostname: '**.ytimg.com',
            },
            {
                protocol: 'https',
                hostname: 'img.youtube.com',
            },
            {
                protocol: 'https',
                hostname: 'firebasestorage.googleapis.com',
            },
            {
                protocol: 'https',
                hostname: 'storage.googleapis.com',
            },
        ],
    },
    transpilePackages: ['@tanstack/react-query'],
};
