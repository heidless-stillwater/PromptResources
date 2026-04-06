// TypeScript types for the application

export type UserRole = 'su' | 'admin' | 'member';
export type SubscriptionType = 'free' | 'standard' | 'pro';
export type ResourcePricing = 'free' | 'paid' | 'freemium';
export type ResourceType = 'video' | 'article' | 'tool' | 'course' | 'book' | 'tutorial' | 'other';
export type MediaFormat = 'youtube' | 'webpage' | 'pdf' | 'image' | 'audio' | 'other';
export type Platform = 'gemini' | 'nanobanana' | 'chatgpt' | 'claude' | 'midjourney' | 'general' | 'other';
export type ResourceStatus = 'published' | 'draft' | 'pending' | 'suggested';
export type ProgressStatus = 'new' | 'in-progress' | 'completed';

export interface Credit {
    name: string;
    url: string;
}

export interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;
    role: UserRole;
    subscriptionType: SubscriptionType;
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
    credits: Credit[];
    platform: Platform;
    tags: string[];
    addedBy: string;
    creator?: {
        displayName: string;
        photoURL?: string;
    };
    createdAt: Date;
    updatedAt: Date;
    status: ResourceStatus;
    isFavorite?: boolean;
    rank?: number;
    prompts?: string[];
    notes?: string;        // Publicly visible notes/instructions
    adminNotes?: string;   // Internal administrative-only notes
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
    description: string;
    icon: string;
    parentCategory?: string;
    createdAt: Date;
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
