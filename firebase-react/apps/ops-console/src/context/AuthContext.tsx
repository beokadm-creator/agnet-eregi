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
          const isSuperAdmin = u.uid === "sOhR3HDAitbyX2izUyge61W3gQr2" || String(u.email || "").toLowerCase() === "aaron@beosolution.com";
          setAccessDenied(!isSuperAdmin && !["ops_admin", "ops_operator", "ops_viewer"].includes(opsRole));
        } catch (e) {
          console.error(e);
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
