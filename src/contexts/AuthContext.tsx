import React, { createContext, useContext, useEffect, useState } from 'react';

/** Shape aligned with common OAuth profiles — map from Supabase `user` when you wire auth. */
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
    // TODO: Supabase — onAuthStateChange / getSession, load profile + role for isAdmin
  }, []);

  const signInWithGoogle = async () => {
    // TODO: Supabase — signInWithOAuth({ provider: 'google', ... })
    console.info('[auth] signInWithGoogle placeholder — connect Supabase');
  };

  const logout = async () => {
    // TODO: Supabase — supabase.auth.signOut()
    console.info('[auth] logout placeholder — connect Supabase');
  };

  const isAdmin = false;

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
