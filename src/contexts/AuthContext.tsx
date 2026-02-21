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
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
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

    const fetchOrCreateProfile = useCallback(async (firebaseUser: User) => {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const data = userSnap.data();
            const userProfile: UserProfile = {
                uid: firebaseUser.uid,
                email: data.email,
                displayName: data.displayName,
                photoURL: data.photoURL,
                role: data.role || 'member',
                subscriptionType: data.subscriptionType || 'free',
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date(),
            };
            setProfile(userProfile);
            setActiveRole(userProfile.role);
        } else {
            // Create new user profile
            const isAdmin = firebaseUser.email === ADMIN_EMAIL;
            const newProfile: Omit<UserProfile, 'createdAt' | 'updatedAt'> & { createdAt: ReturnType<typeof serverTimestamp>; updatedAt: ReturnType<typeof serverTimestamp> } = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
                photoURL: firebaseUser.photoURL || undefined,
                role: isAdmin ? 'admin' : 'member',
                subscriptionType: 'free',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };
            await setDoc(userRef, newProfile);
            const profile: UserProfile = {
                ...newProfile,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            setProfile(profile);
            setActiveRole(profile.role);
        }
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);
            if (firebaseUser) {
                try {
                    await fetchOrCreateProfile(firebaseUser);
                } catch (error) {
                    console.error('Error fetching profile:', error);
                }
            } else {
                setProfile(null);
                setActiveRole('member');
            }
            setLoading(false);
        });
        return unsubscribe;
    }, [fetchOrCreateProfile]);

    const signIn = async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
    };

    const signUp = async (email: string, password: string, displayName: string) => {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName });
    };

    const signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
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
