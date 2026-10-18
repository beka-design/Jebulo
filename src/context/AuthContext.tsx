import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  updateProfile as fbUpdateProfile,
  IdTokenResult,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isCreator: boolean;
  isBuyer: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, displayName: string, preferredLang?: 'en' | 'am') => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [customClaims, setCustomClaims] = useState<Record<string, unknown>>({});

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          // Check custom claims
          const tokenResult: IdTokenResult = await user.getIdTokenResult(true);
          setCustomClaims(tokenResult.claims || {});

          // Listen to user document in Firestore
          const userRef = doc(db, 'users', user.uid);
          unsubscribeDoc = onSnapshot(userRef, async (snapshot) => {
            if (snapshot.exists()) {
              setUserProfile(snapshot.data() as UserProfile);
            } else {
              // Create default profile if not present
              const initialProfile: UserProfile = {
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName || user.email?.split('@')[0] || 'User',
                photoURL: user.photoURL || undefined,
                role: (tokenResult.claims.admin ? 'admin' : (tokenResult.claims.creator ? 'creator' : 'buyer')) as UserRole,
                status: 'active',
                preferredLanguage: 'en',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };
              await setDoc(userRef, {
                ...initialProfile,
                serverCreatedAt: serverTimestamp(),
              });
              setUserProfile(initialProfile);
            }
            setLoading(false);
          }, (err) => {
            console.warn('Firestore user profile snapshot error:', err);
            // Fallback user profile in memory
            setUserProfile({
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || 'User',
              role: (tokenResult.claims.admin ? 'admin' : 'buyer') as UserRole,
              status: 'active',
              preferredLanguage: 'en',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
            setLoading(false);
          });
        } catch (err) {
          console.error('Error fetching token/profile:', err);
          setLoading(false);
        }
      } else {
        if (unsubscribeDoc) {
          unsubscribeDoc();
          unsubscribeDoc = null;
        }
        setUserProfile(null);
        setCustomClaims({});
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  const signIn = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signUp = async (
    email: string,
    pass: string,
    displayName: string,
    preferredLang: 'en' | 'am' = 'en'
  ) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await fbUpdateProfile(cred.user, { displayName });
    
    // Save to Firestore
    const userRef = doc(db, 'users', cred.user.uid);
    const newProfile: UserProfile = {
      uid: cred.user.uid,
      email,
      displayName,
      role: 'buyer', // default safe role
      status: 'active',
      preferredLanguage: preferredLang,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await setDoc(userRef, {
      ...newProfile,
      serverCreatedAt: serverTimestamp(),
    });
    setUserProfile(newProfile);
  };

  const signOut = async () => {
    await fbSignOut(auth);
    setUserProfile(null);
    setCurrentUser(null);
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const refreshProfile = async () => {
    if (!currentUser) return;
    const tokenResult = await currentUser.getIdTokenResult(true);
    setCustomClaims(tokenResult.claims || {});
    const userRef = doc(db, 'users', currentUser.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      setUserProfile(snap.data() as UserProfile);
    }
  };

  // Safe role checks: Custom claim takes strict precedence, fallback to verified profile
  const isAdmin = !!customClaims.admin || userProfile?.role === 'admin';
  const isCreator = !!customClaims.creator || userProfile?.role === 'creator' || isAdmin;
  const isBuyer = true; // Every signed-in user can buy

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        isAdmin,
        isCreator,
        isBuyer,
        signIn,
        signUp,
        signOut,
        sendPasswordReset,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
