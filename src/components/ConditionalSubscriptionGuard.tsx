import React from 'react';
import { useLocation } from 'react-router-dom';
import { SubscriptionGuard } from './SubscriptionGuard';

interface ConditionalSubscriptionGuardProps {
  children: React.ReactNode;
}

export const ConditionalSubscriptionGuard: React.FC<ConditionalSubscriptionGuardProps> = ({ children }) => {
  const location = useLocation();
  
  // List of pages that should NOT have subscription guard
  const exemptPaths = [
    '/dashboard/billing',
    '/dashboard/upgrade',
    '/billing',
    '/upgrade'
  ];
  
  // Check if current path is exempt
  const isExempt = exemptPaths.some(path => location.pathname.includes(path));
  
  // If exempt, render children directly without guard
  if (isExempt) {
    return <>{children}</>;
  }
  
  // Otherwise, apply subscription guard
  return <SubscriptionGuard>{children}</SubscriptionGuard>;
};