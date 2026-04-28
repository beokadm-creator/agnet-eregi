import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '@rp/firebase';
import { onAuthStateChanged } from 'firebase/auth';

interface AuthContextType {
  token: string;
  isReady: boolean;
}

const AuthContext = createContext<AuthContextType>({ token: '', isReady: false });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const idToken = await user.getIdToken(true);
          setToken(idToken);
        } catch (e) {
          console.error(e);
        }
      } else {
        setToken('');
      }
      setIsReady(true);
    });
    return unsub;
  }, []);

  return <AuthContext.Provider value={{ token, isReady }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
