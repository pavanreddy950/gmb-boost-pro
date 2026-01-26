import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Share2, Sparkles } from 'lucide-react';

const SocialMedia = () => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Card className="w-full border-2 border-purple-200 shadow-xl">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 p-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-lg w-fit">
              <Share2 className="h-12 w-12 text-white" />
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Social Media Autoposting
            </CardTitle>
            <CardDescription className="text-lg mt-2">
              Schedule and autopost to your social media platforms
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full mb-4">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <span className="text-lg font-semibold text-purple-700">Coming Soon</span>
            </div>
            <p className="text-muted-foreground max-w-md mx-auto">
              We're working on an amazing social media autoposting feature that will help you manage your social presence alongside your Google Business Profile.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4 max-w-sm mx-auto text-sm text-left">
              <div className="flex items-start gap-2">
                <div className="h-2 w-2 rounded-full bg-purple-500 mt-1.5"></div>
                <span>Schedule posts across platforms</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="h-2 w-2 rounded-full bg-purple-500 mt-1.5"></div>
                <span>Bulk content upload</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="h-2 w-2 rounded-full bg-purple-500 mt-1.5"></div>
                <span>Multi-platform support</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="h-2 w-2 rounded-full bg-purple-500 mt-1.5"></div>
                <span>Analytics & insights</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SocialMedia;
