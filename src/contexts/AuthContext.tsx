'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut as firebaseSignOut,
    User,
    updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { UserProfile, UserRole } from '@/lib/types';

interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    loading: boolean;
    activeRole: UserRole;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, displayName: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    switchRole: (role: UserRole) => void;
    canSwitchRoles: boolean;
    isAdmin: boolean;
    isSu: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_EMAIL = 'heidlessemail18@gmail.com';

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeRole, setActiveRole] = useState<UserRole>('member');

    const createNewProfile = useCallback(async (firebaseUser: User) => {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const isAdminUser = firebaseUser.email === ADMIN_EMAIL;
        const newProfileData: any = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            role: isAdminUser ? 'admin' : 'member',
            subscriptionType: 'free',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        if (firebaseUser.photoURL) {
            newProfileData.photoURL = firebaseUser.photoURL;
        }
        await setDoc(userRef, newProfileData);
    }, []);

    useEffect(() => {
        let unsubscribeSnapshot: (() => void) | null = null;

        const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
            // Clean up previous snapshot listener when user changes
            if (unsubscribeSnapshot) {
                unsubscribeSnapshot();
                unsubscribeSnapshot = null;
            }

            setUser(firebaseUser);

            if (firebaseUser) {
                try {
                    // Ensure the user document exists before subscribing
                    const userRef = doc(db, 'users', firebaseUser.uid);
                    const snap = await getDoc(userRef);
                    if (!snap.exists()) {
                        await createNewProfile(firebaseUser);
                    }

                    // Subscribe to real-time updates on the user document
                    unsubscribeSnapshot = onSnapshot(userRef, (docSnap) => {
                        if (docSnap.exists()) {
                            const data = docSnap.data();
                            const userProfile: UserProfile = {
                                uid: firebaseUser.uid,
                                email: data.email,
                                displayName: data.displayName,
                                photoURL: data.photoURL,
                                role: data.role || 'member',
                                subscriptionType: data.subscriptionType || 'free',
                                subscription: data.subscription || undefined,
                                slug: data.slug,
                                profileType: data.profileType,
                                bio: data.bio,
                                bannerUrl: data.bannerUrl,
                                isPublicProfile: data.isPublicProfile,
                                isVerified: data.isVerified,
                                isFeatured: data.isFeatured,
                                resourceCount: data.resourceCount,
                                authoredCount: data.authoredCount,
                                curatedCount: data.curatedCount,
                                createdAt: data.createdAt?.toDate() || new Date(),
                                updatedAt: data.updatedAt?.toDate() || new Date(),
                            };
                            setProfile(userProfile);
                            setActiveRole(userProfile.role);
                        }
                        setLoading(false);
                    }, (error) => {
                        console.error('Error in profile snapshot:', error);
                        setLoading(false);
                    });
                } catch (error) {
                    console.error('Error setting up profile listener:', error);
                    setLoading(false);
                }
            } else {
                setProfile(null);
                setActiveRole('member');
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeSnapshot) unsubscribeSnapshot();
        };
    }, [createNewProfile]);

    const signIn = async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
    };

    const signUp = async (email: string, password: string, displayName: string) => {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName });
    };

    const signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (err: any) {
            // User closed the popup — not an error, ignore silently
            if (err?.code === 'auth/popup-closed-by-user' ||
                err?.code === 'auth/cancelled-popup-request') {
                return;
            }
            throw err; // Re-throw genuine errors
        }
    };

    const signOut = async () => {
        await firebaseSignOut(auth);
        setProfile(null);
        setActiveRole('member');
    };

    const switchRole = (role: UserRole) => {
        if (profile && (profile.role === 'su' || profile.role === 'admin')) {
            setActiveRole(role);
        }
    };

    const canSwitchRoles = profile?.role === 'su' || profile?.role === 'admin';
    const isAdmin = activeRole === 'admin' || activeRole === 'su';
    const isSu = activeRole === 'su';

    return (
        <AuthContext.Provider
            value={{
                user,
                profile,
                loading,
                activeRole,
                signIn,
                signUp,
                signInWithGoogle,
                signOut,
                switchRole,
                canSwitchRoles,
                isAdmin,
                isSu,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
