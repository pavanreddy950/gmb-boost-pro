import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Images, Sparkles } from 'lucide-react';

const PhotosDump = () => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Card className="w-full border-2 border-green-200 shadow-xl">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 p-6 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl shadow-lg w-fit">
              <Images className="h-12 w-12 text-white" />
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              Photos Dump
            </CardTitle>
            <CardDescription className="text-lg mt-2">
              Bulk upload and manage photos for your business profiles
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-100 to-emerald-100 rounded-full mb-4">
              <Sparkles className="h-5 w-5 text-green-600" />
              <span className="text-lg font-semibold text-green-700">Coming Soon</span>
            </div>
            <p className="text-muted-foreground max-w-md mx-auto">
              Easily upload, organize, and manage large collections of photos for all your business locations in one place.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4 max-w-sm mx-auto text-sm text-left">
              <div className="flex items-start gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 mt-1.5"></div>
                <span>Bulk photo upload</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 mt-1.5"></div>
                <span>Smart categorization</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 mt-1.5"></div>
                <span>Image optimization</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 mt-1.5"></div>
                <span>Multi-location support</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PhotosDump;
