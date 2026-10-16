import { onAuthStateChanged, type User } from '@react-native-firebase/auth';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { auth } from '@/lib/firebase';

interface AuthState {
  user: User | null;
  initializing: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, initializing: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: auth.currentUser, initializing: true });

  useEffect(() => onAuthStateChanged(auth, (user) => setState({ user, initializing: false })), []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
