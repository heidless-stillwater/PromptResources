// TypeScript types for the application

export type UserRole = 'su' | 'admin' | 'member';
export type SubscriptionType = 'free' | 'standard' | 'pro';
export type ResourcePricing = 'free' | 'paid' | 'freemium';
export type ResourceType = 'video' | 'article' | 'tool' | 'course' | 'book' | 'tutorial' | 'other';
export type MediaFormat = 'youtube' | 'webpage' | 'pdf' | 'image' | 'audio' | 'other';
export type Platform = 'gemini' | 'nanobanana' | 'chatgpt' | 'claude' | 'midjourney' | 'general' | 'other';
export type ResourceStatus = 'published' | 'draft' | 'pending' | 'suggested' | 'flagged' | 'hidden' | 'tainted';
export type ProgressStatus = 'new' | 'in-progress' | 'completed';
export type FlagStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';
export type FlagReason = 'illegal' | 'harmful_children' | 'harassment' | 'hate_speech' | 'misinformation' | 'spam' | 'other';

export type AttributionRole = 'creator' | 'author' | 'presenter' | 'curator' | 'contributor' | 'source';
export type CreatorType = 'individual' | 'channel' | 'organization';

export interface CreatorSocial {
    platform: 'youtube' | 'twitter' | 'github' | 'linkedin' | 'website' | 'other';
    url: string;
    label?: string;
}

export interface Attribution {
    name: string;
    url: string;
    userId?: string;
    role?: AttributionRole;
}

export interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;
    role: UserRole;
    subscriptionType: SubscriptionType;
    
    // --- Public Profile Fields ---
    slug?: string;
    profileType?: CreatorType;
    bio?: string;
    bannerUrl?: string;
    socials?: CreatorSocial[];
    tags?: string[];
    isStub?: boolean;
    isPublicProfile?: boolean;
    isVerified?: boolean;
    isFeatured?: boolean;
    resourceCount?: number;
    authoredCount?: number;
    curatedCount?: number;
    rank?: number;
    
    // Suite Entitlements
    subscription?: {
        bundleId: string;
        activeSuites: string[]; // e.g. ['resources', 'studio', 'registry']
        status: 'active' | 'past_due' | 'canceled' | 'incomplete';
        expiresAt?: any;
    };
    
    strikes?: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface Resource {
    id: string;
    title: string;
    description: string;
    type: ResourceType;
    mediaFormat: MediaFormat;
    url: string;
    thumbnailUrl?: string;
    youtubeVideoId?: string;
    pricing: ResourcePricing;
    pricingDetails?: string;
    categories: string[];
    attributions: Attribution[];
    platform: Platform;
    tags: string[];
    addedBy: string;
    creator?: {
        displayName: string;
        photoURL?: string;
    };
    attributedUserIds?: string[];
    createdAt: Date;
    updatedAt: Date;
    status: ResourceStatus;
    reportType?: FlagReason;
    isFavorite?: boolean | null;
    rank?: number | null;
    prompts?: string[];
    searchKeywords?: string[]; // Lowercase tokens for indexed search
    notes?: string | null;        // Publicly visible notes/instructions
    adminNotes?: string | null;   // Internal administrative-only notes
    averageRating?: number;
    reviewCount?: number;
}

export interface Comment {
    id: string;
    resourceId: string;
    userId: string;
    userName: string;
    userPhoto?: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Review extends Comment {
    rating: number; // 1-5
}

export interface Category {
    id: string;
    name: string;
    slug: string;
    description?: string;
    icon?: string;
    count?: number;
    freeCount?: number;
    parentCategory?: string;
    createdAt: Date | string;
    updatedAt?: Date | string;
}

export interface UserResourceData {
    savedResources: string[];
    notes: Record<string, string>;
    progress: Record<string, ProgressStatus>;
}

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}

export interface ThumbnailAsset {
    id: string;
    url: string;
    title: string;
    tags: string[];
    category?: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
    addedBy: string;
    isDefault?: boolean;
}

export interface Flag {
    id: string;
    resourceId: string;
    userId: string;
    userName?: string;
    reason: FlagReason;
    details?: string;
    status: FlagStatus;
    createdAt: Date;
    updatedAt: Date;
}

export interface ModerationConfig {
    flaggingEnabled: boolean;
    aiScreening: boolean;
    autoLockThreshold?: number;
}

export interface ProtectionConfig {
    avEnabled: boolean;
    avStrictness: 'soft' | 'hard' | 'maximum';
    geoGating?: string[];
}

export interface SecurityConfig {
    securityHeadersEnabled: boolean;
    hstsEnabled: boolean;
}

export interface SystemConfig {
    moderation: ModerationConfig;
    protection: ProtectionConfig;
    security: SecurityConfig;
}

