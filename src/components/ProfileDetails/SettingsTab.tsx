import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, Bell, Shield, Database } from 'lucide-react';

interface SettingsTabProps {
  profileId: string;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ profileId }) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Profile Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="font-medium">Notifications</h3>
                  <p className="text-sm text-muted-foreground">Configure notification preferences</p>
                </div>
              </div>
              <Button variant="outline" className="mt-3 w-full">
                Configure
              </Button>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-green-600" />
                <div>
                  <h3 className="font-medium">Privacy & Security</h3>
                  <p className="text-sm text-muted-foreground">Manage privacy settings</p>
                </div>
              </div>
              <Button variant="outline" className="mt-3 w-full">
                Manage
              </Button>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-purple-600" />
                <div>
                  <h3 className="font-medium">Data & Analytics</h3>
                  <p className="text-sm text-muted-foreground">Data collection preferences</p>
                </div>
              </div>
              <Button variant="outline" className="mt-3 w-full">
                Settings
              </Button>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsTab;