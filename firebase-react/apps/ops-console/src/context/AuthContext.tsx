import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { auth } from '@rp/firebase';
import { onAuthStateChanged } from 'firebase/auth';

interface AuthContextType {
  token: string;
  isReady: boolean;
  accessDenied: boolean;
}

const AuthContext = createContext<AuthContextType>({ token: '', isReady: false, accessDenied: false });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const idToken = await u.getIdToken(true);
          setToken(idToken);
          const tokenResult = await u.getIdTokenResult();
          const opsRole = tokenResult.claims?.opsRole ? String(tokenResult.claims.opsRole) : "";
          const isSuperAdmin = tokenResult.claims?.isSuperAdmin === true;
          setAccessDenied(!isSuperAdmin && !["ops_admin", "ops_operator", "ops_viewer"].includes(opsRole));
        } catch (e) {
          console.error(e);
          // Retry with cached token (no force refresh)
          try {
            const cachedToken = await u.getIdToken(false);
            setToken(cachedToken);
            setAccessDenied(false);
          } catch {
            // Both attempts failed — leave token empty, user will see login
          }
        }
      } else {
        setToken('');
        setAccessDenied(false);
      }
      setIsReady(true);
    });
    return unsub;
  }, []);

  return <AuthContext.Provider value={{ token, isReady, accessDenied }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
