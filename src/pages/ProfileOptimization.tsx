import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sparkles, Zap } from 'lucide-react';

const ProfileOptimization = () => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Card className="w-full border-2 border-blue-200 shadow-xl">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 p-6 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl shadow-lg w-fit">
              <Sparkles className="h-12 w-12 text-white" />
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Profile Optimization
            </CardTitle>
            <CardDescription className="text-lg mt-2">
              AI-powered optimization for your Google Business Profiles
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-full mb-4">
              <Zap className="h-5 w-5 text-blue-600" />
              <span className="text-lg font-semibold text-blue-700">Coming Soon</span>
            </div>
            <p className="text-muted-foreground max-w-md mx-auto">
              Get intelligent recommendations and automated optimizations to boost your profile's visibility and performance.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4 max-w-sm mx-auto text-sm text-left">
              <div className="flex items-start gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5"></div>
                <span>AI-powered suggestions</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5"></div>
                <span>SEO optimization</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5"></div>
                <span>Competitor analysis</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5"></div>
                <span>Performance tracking</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfileOptimization;
