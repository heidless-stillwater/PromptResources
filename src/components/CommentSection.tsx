'use client';

import { useState, useEffect, useCallback } from 'react';
import NextImage from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { Comment, Review } from '@/lib/types';
import { InteractiveRating } from './Rating';
import Rating from './Rating';

interface CommentSectionProps {
    resourceId: string;
}

export default function CommentSection({ resourceId }: CommentSectionProps) {
    const { user } = useAuth();
    const [comments, setComments] = useState<(Comment | Review)[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    // Form state
    const [content, setContent] = useState('');
    const [rating, setRating] = useState(0);
    const [error, setError] = useState('');

    const fetchComments = useCallback(async () => {
        try {
            const response = await fetch(`/api/resources/${resourceId}/comments`);
            const result = await response.json();
            if (result.success) {
                setComments(result.data);
            }
        } catch (err) {
            console.error('Error fetching comments:', err);
        } finally {
            setLoading(false);
        }
    }, [resourceId]);

    useEffect(() => {
        fetchComments();
    }, [resourceId, fetchComments]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (!content.trim()) {
            setError('Please enter a comment');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            const response = await fetch(`/api/resources/${resourceId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.uid,
                    userName: user.displayName || 'Anonymous User',
                    userPhoto: user.photoURL,
                    content,
                    rating: rating > 0 ? rating : undefined
                })
            });

            const result = await response.json();
            if (result.success) {
                setContent('');
                setRating(0);
                fetchComments(); // Refresh list
            } else {
                setError(result.error || 'Failed to post comment');
            }
        } catch (err) {
            setError('Network error, please try again');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="comment-section">
            <h2 className="detail-section-title">Community Reviews</h2>

            {user ? (
                <form className="review-form" onSubmit={handleSubmit}>
                    <div style={{ marginBottom: 'var(--space-4)' }}>
                        <div className="form-label" style={{ marginBottom: 'var(--space-2)' }}>Your Rating</div>
                        <InteractiveRating value={rating} onChange={setRating} />
                    </div>
                    
                    <div className="form-group">
                        <label className="form-label">Your Comment</label>
                        <textarea
                            className="form-textarea"
                            placeholder="Share your thoughts on this resource..."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            disabled={submitting}
                        />
                    </div>

                    {error && <div style={{ color: 'var(--error-400)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-2)' }}>{error}</div>}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
                        <button 
                            type="submit" 
                            className="btn btn-primary"
                            disabled={submitting || !content.trim()}
                        >
                            {submitting ? 'Posting...' : 'Post Review'}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="glass-card" style={{ padding: 'var(--space-6)', textAlign: 'center', marginBottom: 'var(--space-8)' }}>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
                        Sign in to share your thoughts and rate this resource.
                    </p>
                    <button className="btn btn-secondary btn-sm" onClick={() => window.location.href = '/auth/login'}>
                        Sign In to Review
                    </button>
                </div>
            )}

            {loading ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
                    <div className="spinner-inline" style={{ margin: '0 auto' }} />
                </div>
            ) : (
                <div className="comment-list">
                    {comments.length > 0 ? (
                        comments.map((comment) => (
                            <div key={comment.id} className="comment-card animation-fade-in">
                                <div className="comment-header">
                                    <div className="comment-user">
                                        <div className="comment-avatar" style={{ 
                                            width: '32px', 
                                            height: '32px', 
                                            borderRadius: '50%', 
                                            background: 'var(--gradient-primary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.8rem',
                                            fontWeight: 700
                                        }}>
                                            {comment.userPhoto ? (
                                                <NextImage 
                                                    src={comment.userPhoto} 
                                                    alt={comment.userName} 
                                                    width={32} 
                                                    height={32} 
                                                    style={{ borderRadius: '50%' }} 
                                                />
                                            ) : (
                                                comment.userName.charAt(0)
                                            )}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{comment.userName}</div>
                                            <div className="comment-time">
                                                {comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() : 'Just now'}
                                            </div>
                                        </div>
                                    </div>
                                    {(comment as Review).rating && (
                                        <Rating value={(comment as Review).rating} showLabel={false} size="sm" />
                                    )}
                                </div>
                                <div className="comment-content">
                                    {comment.content}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div style={{ textAlign: 'center', padding: 'var(--space-10)', color: 'var(--text-muted)' }}>
                            No reviews yet. Be the first to share your thoughts!
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
