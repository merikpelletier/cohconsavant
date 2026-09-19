import React, { createContext, useState, useContext, useEffect } from 'react';
import { appClient } from '@/api/appClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings] = useState({ public_settings: {} });

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setAuthError(null);
      try {
        await checkUserAuth();
      } catch (appError) {
        setAuthError({ type: 'unknown', message: appError.message || 'Impossible de charger l’application' });
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      // Now check if the user is authenticated
      setIsLoadingAuth(true);
      const currentUser = await appClient.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
    } catch (error) {
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  const login = async (email, password) => {
    const currentUser = await appClient.auth.signIn(email, password);
    setUser(currentUser);
    setIsAuthenticated(true);
    return currentUser;
  };

  const signup = async (email, password, displayName) => {
    const result = await appClient.auth.signUp(email, password, displayName);
    if (result.user && !result.requiresConfirmation) {
      setUser(result.user);
      setIsAuthenticated(true);
    }
    return result;
  };

  const logout = async (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    
    if (shouldRedirect) {
      await appClient.auth.logout('/');
    } else {
      await appClient.auth.logout();
    }
  };

  const navigateToLogin = () => {
    appClient.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      login,
      signup,
      logout,
      navigateToLogin,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
