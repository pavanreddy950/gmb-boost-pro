import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, Users, Eye, PieChart, Activity, Clock, Sparkles } from "lucide-react";

interface InsightsTabProps {
  profileId: string;
}

const InsightsTab = ({ profileId }: InsightsTabProps) => {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-green-600" />
              Business Insights
            </div>
            <Badge variant="secondary" className="animate-pulse">
              Coming Soon
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            {/* Animated Icons */}
            <div className="relative">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <PieChart className="h-12 w-12 text-green-500 animate-bounce" />
                  <div className="absolute -top-1 -right-1">
                    <Sparkles className="h-4 w-4 text-yellow-500 animate-spin" />
                  </div>
                </div>
                <div className="relative">
                  <Activity className="h-12 w-12 text-blue-500 animate-pulse" />
                  <div className="absolute -top-1 -right-1">
                    <Sparkles className="h-4 w-4 text-yellow-500 animate-ping" />
                  </div>
                </div>
                <div className="relative">
                  <BarChart3 className="h-12 w-12 text-purple-500" style={{
                    animation: 'spin 4s linear infinite'
                  }} />
                  <div className="absolute -top-1 -right-1">
                    <Sparkles className="h-4 w-4 text-yellow-500 animate-bounce" />
                  </div>
                </div>
              </div>
              
              {/* Floating particles effect */}
              <div className="absolute inset-0 pointer-events-none">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-2 h-2 bg-green-400 rounded-full opacity-60"
                    style={{
                      left: `${20 + i * 15}%`,
                      top: `${10 + (i % 2) * 20}%`,
                      animation: `float ${2 + i * 0.5}s ease-in-out infinite alternate`
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Coming Soon Text */}
            <div className="text-center space-y-3">
              <h3 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                Advanced Insights Coming Soon!
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
                Get detailed analytics about your profile performance, customer behavior, 
                search trends, and comprehensive business intelligence insights.
              </p>
            </div>

            {/* Feature Preview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-2xl mt-8">
              {[
                { icon: Eye, label: "Profile Analytics", color: "green" },
                { icon: Users, label: "Customer Behavior", color: "blue" },
                { icon: TrendingUp, label: "Search Trends", color: "purple" },
                { icon: Activity, label: "Business Intelligence", color: "orange" }
              ].map((feature, index) => (
                <div
                  key={index}
                  className="p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 text-center space-y-2"
                  style={{
                    animation: `fadeInUp ${0.5 + index * 0.1}s ease-out`
                  }}
                >
                  <feature.icon className={`h-6 w-6 mx-auto text-${feature.color}-500 animate-pulse`} />
                  <p className="text-xs text-muted-foreground font-medium">{feature.label}</p>
                </div>
              ))}
            </div>

            {/* Progress indicator */}
            <div className="flex items-center space-x-2 text-sm text-muted-foreground mt-6">
              <Clock className="h-4 w-4 animate-spin" />
              <span>Feature in development...</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CSS for custom animations */}
      <style>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          100% { transform: translateY(-10px); }
        }
        
        @keyframes fadeInUp {
          0% { 
            opacity: 0; 
            transform: translateY(20px); 
          }
          100% { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }
      `}</style>
    </div>
  );
};

export default InsightsTab;