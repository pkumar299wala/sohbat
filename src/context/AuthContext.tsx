import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { syncUserProfile } from '../lib/darbarService';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isVerified: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  isVerified: false,
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      if (firebaseUser && (firebaseUser.emailVerified || Boolean(firebaseUser.phoneNumber))) {
        try {
          await syncUserProfile(firebaseUser);
        } catch (err) {
          console.warn('Profile sync deferred:', err);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const isVerified = Boolean(user && (user.emailVerified || user.phoneNumber));

  const logout = async () => {
    await signOut(auth);
  };

  const refreshUser = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      setUser({ ...auth.currentUser } as User);
      if (auth.currentUser.emailVerified || auth.currentUser.phoneNumber) {
        await syncUserProfile(auth.currentUser);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isVerified, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
