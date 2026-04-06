import React, { useState, useEffect } from 'react';
import { supabase } from './services/supabaseClient';
import type { Session } from '@supabase/supabase-js';
import { DataProvider } from './contexts/DataContext';
import { NotificationProvider } from './contexts/NotificationContext';
import App from './App';
import LandingPage from './LandingPage';
import PublicConsumePage from './PublicConsumePage';
import Spinner from './components/ui/Spinner';

const AuthManager: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onAuthStateChange fires immediately with the current session state,
    // making it the single source of truth for authentication.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const params = new URLSearchParams(window.location.search);
  const isConsumeAction = params.get('action') === 'consume';

  if (loading) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-slate-100">
            <Spinner />
        </div>
    );
  }

  // If it's a QR code scan, show the public consume page regardless of login status
  // This allows operators to quickly scan and consume without logging in with email/password
  if (isConsumeAction) {
    return (
      <NotificationProvider>
        <DataProvider>
          <PublicConsumePage />
        </DataProvider>
      </NotificationProvider>
    );
  }

  if (!session) {
    return <LandingPage />;
  }

  return (
    <NotificationProvider>
      <DataProvider>
        <App key={session.user.id} />
      </DataProvider>
    </NotificationProvider>
  );
};

export default AuthManager;
