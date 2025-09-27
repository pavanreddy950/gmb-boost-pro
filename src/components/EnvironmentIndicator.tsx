/**
 * Environment Indicator Component
 *
 * Shows the current environment (dev/prod) and backend URL
 * Only visible in development mode
 */

import { useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Eye, EyeOff, Info } from "lucide-react";

interface EnvironmentConfig {
  environment: string;
  displayName: string;
  backendUrl: string;
  isProduction: boolean;
}

const EnvironmentIndicator = () => {
  const [isVisible, setIsVisible] = useState(true);

  // Get environment variables
  const environment = import.meta.env.VITE_ENVIRONMENT || 'unknown';
  const displayName = import.meta.env.VITE_ENV_DISPLAY_NAME || environment;
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'Not configured';
  const isDev = import.meta.env.DEV;
  const isProduction = environment === 'production';

  const config: EnvironmentConfig = {
    environment,
    displayName,
    backendUrl,
    isProduction
  };

  // Only show in development mode
  if (!isDev) {
    return null;
  }

  // If hidden, show minimal toggle
  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsVisible(true)}
          className="bg-slate-800 text-white p-2 rounded-full shadow-lg hover:bg-slate-700 transition-colors"
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border border-slate-200 rounded-lg shadow-lg p-3 max-w-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-slate-700">Environment</span>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <EyeOff className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge
            variant={isProduction ? "destructive" : "secondary"}
            className={isProduction ? "bg-red-500" : "bg-green-500"}
          >
            {config.displayName}
          </Badge>
          <span className="text-xs text-slate-500">
            {isDev ? "DEV MODE" : "PRODUCTION"}
          </span>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="text-xs text-slate-600 cursor-help">
              <div className="font-medium">Backend:</div>
              <div className="text-slate-500 truncate" title={backendUrl}>
                {backendUrl.length > 30 ? `${backendUrl.substring(0, 30)}...` : backendUrl}
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="max-w-xs">
              <div className="font-medium">Full Backend URL:</div>
              <div className="text-xs break-all">{backendUrl}</div>
            </div>
          </TooltipContent>
        </Tooltip>

        <div className="text-xs text-slate-400 pt-1 border-t border-slate-100">
          💡 Use <code className="bg-slate-100 px-1 rounded">npm run env:status</code> to check configuration
        </div>
      </div>
    </div>
  );
};

export default EnvironmentIndicator;