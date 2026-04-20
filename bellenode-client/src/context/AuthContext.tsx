import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { AuthUser, Restaurant } from '../types';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  restaurant: Restaurant | null;
  login: (token: string, user: AuthUser) => void;
  selectRestaurant: (r: Restaurant) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('bn_token'));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem('bn_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [restaurant, setRestaurant] = useState<Restaurant | null>(() => {
    const raw = localStorage.getItem('bn_restaurant');
    return raw ? JSON.parse(raw) : null;
  });

  const login = (newToken: string, newUser: AuthUser) => {
    localStorage.setItem('bn_token', newToken);
    localStorage.setItem('bn_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setRestaurant(null);
    localStorage.removeItem('bn_restaurant');
  };

  const selectRestaurant = (r: Restaurant) => {
    localStorage.setItem('bn_restaurant', JSON.stringify(r));
    setRestaurant(r);
  };

  const logout = () => {
    localStorage.removeItem('bn_token');
    localStorage.removeItem('bn_user');
    localStorage.removeItem('bn_restaurant');
    setToken(null);
    setUser(null);
    setRestaurant(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, restaurant, login, selectRestaurant, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
