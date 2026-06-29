import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthenticationStatus } from '@nhost/react';
import Loading from './Loading';

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuthenticationStatus();

  if (isLoading) {
    return <Loading message="Checking authentication status..." fullScreen={true} />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
