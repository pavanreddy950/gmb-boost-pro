import { useState, useCallback } from 'react';
import { simpleGoogleAuth } from '../lib/simpleGoogleAuth';
import { useToast } from '@/hooks/use-toast';

export const useSimpleGoogleAuth = () => {
  const [isConnected, setIsConnected] = useState(() => simpleGoogleAuth.isConnected());
  const [isLoading, setIsLoading] = useState(false);
  const [profiles, setProfiles] = useState<any[]>([]);
  const { toast } = useToast();

  const connect = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('Connecting to Google Business Profile...');
      
      await simpleGoogleAuth.signIn();
      setIsConnected(true);
      
      // Load business profiles
      const businessProfiles = await simpleGoogleAuth.getBusinessProfiles();
      setProfiles(businessProfiles);
      
      toast({
        title: "Connected successfully!",
        description: "Your Google Business Profile has been connected.",
      });
      
      console.log('Connected successfully, profiles loaded:', businessProfiles);
    } catch (error) {
      console.error('Connection failed:', error);
      toast({
        title: "Connection failed",
        description: error instanceof Error ? error.message : "Failed to connect",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const disconnect = useCallback(() => {
    simpleGoogleAuth.disconnect();
    setIsConnected(false);
    setProfiles([]);
    
    toast({
      title: "Disconnected",
      description: "Your Google Business Profile has been disconnected.",
    });
  }, [toast]);

  return {
    isConnected,
    isLoading,
    profiles,
    connect,
    disconnect
  };
};
