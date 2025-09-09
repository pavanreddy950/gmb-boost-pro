import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Upgrade = () => {
  const navigate = useNavigate();

  // Redirect to billing page immediately
  useEffect(() => {
    navigate('/dashboard/billing');
  }, [navigate]);

  // Return loading state while redirecting
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <p className="text-muted-foreground">Redirecting to billing page...</p>
      </div>
    </div>
  );
};

export default Upgrade;