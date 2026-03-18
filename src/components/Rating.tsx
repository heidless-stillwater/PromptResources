'use client';

import React from 'react';

interface RatingProps {
    value: number;
    count?: number;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
}

export default function Rating({ value, count, size = 'md', showLabel = true }: RatingProps) {
    const fullStars = Math.floor(value);
    const hasHalfStar = value % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    const sizeClass = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-lg' : 'text-base';

    return (
        <div className={`flex items-center gap-1.5 ${sizeClass}`}>
            <div className="flex text-yellow-500">
                {[...Array(fullStars)].map((_, i) => (
                    <span key={`full-${i}`}>★</span>
                ))}
                {hasHalfStar && <span>½</span>}
                {[...Array(emptyStars)].map((_, i) => (
                    <span key={`empty-${i}`} className="opacity-30">★</span>
                ))}
            </div>
            {showLabel && (
                <span className="font-semibold text-text-primary">
                    {value.toFixed(1)}
                </span>
            )}
            {count !== undefined && (
                <span className="text-text-muted text-xs">
                    ({count})
                </span>
            )}
        </div>
    );
}

// Interative version for submitting reviews
interface InteractiveRatingProps {
    value: number;
    onChange: (value: number) => void;
    size?: 'sm' | 'md' | 'lg';
}

export function InteractiveRating({ value, onChange, size = 'md' }: InteractiveRatingProps) {
    const [hover, setHover] = React.useState(0);

    return (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    onClick={() => onChange(star)}
                    onMouseEnter={() => setHover(star)}
                    onMouseLeave={() => setHover(0)}
                    className={`
                        transition-all duration-200 
                        ${size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-3xl' : 'text-xl'}
                        ${(hover || value) >= star ? 'text-yellow-400 scale-110' : 'text-gray-600 scale-100'}
                    `}
                >
                    ★
                </button>
            ))}
        </div>
    );
}
