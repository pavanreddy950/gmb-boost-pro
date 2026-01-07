import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Calendar, Sparkles, RefreshCw, Timer, Building } from 'lucide-react';

interface ScheduledPost {
    locationId: string;
    businessName: string;
    category: string;
    content: string;
    callToAction?: {
        actionType: string;
        url?: string;
    };
    scheduledTime: string;
    previewTime: string;
    status: 'scheduled' | 'publishing' | 'published' | 'failed';
    minutesUntilPublish: number;
    keywords: string;
}

interface ScheduledPostsResponse {
    success: boolean;
    count: number;
    posts: ScheduledPost[];
    message: string;
}

export function ScheduledPostsSection() {
    const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchScheduledPosts = async () => {
        try {
            setLoading(true);
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
            console.log('[ScheduledPostsSection] Fetching from:', `${backendUrl}/api/automation/scheduled-posts`);

            const response = await fetch(`${backendUrl}/api/automation/scheduled-posts`);

            if (!response.ok) {
                console.error('[ScheduledPostsSection] Response not OK:', response.status, response.statusText);
                throw new Error('Failed to fetch scheduled posts');
            }

            const data: ScheduledPostsResponse = await response.json();
            console.log('[ScheduledPostsSection] Received data:', data);
            setScheduledPosts(data.posts || []);
            setLastUpdated(new Date());
        } catch (error) {
            console.error('[ScheduledPostsSection] Error fetching scheduled posts:', error);
            setScheduledPosts([]);
            setError(error instanceof Error ? error.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchScheduledPosts();

        // Refresh every 30 seconds
        const interval = setInterval(fetchScheduledPosts, 30000);
        return () => clearInterval(interval);
    }, []);

    const formatTimeRemaining = (minutes: number) => {
        if (minutes <= 0) return 'Publishing now...';
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}m`;
    };

    const formatScheduledTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    return (
        <Card className="shadow-card border border-border bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                            <Timer className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                                Upcoming Auto-Posts
                                <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                    {scheduledPosts.length} Ready
                                </Badge>
                            </CardTitle>
                            <CardDescription className="text-xs">
                                AI-generated posts ready to publish • Updates every 30s
                            </CardDescription>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={fetchScheduledPosts}
                        disabled={loading}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="pt-0">
                {error && (
                    <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                        <strong>Error:</strong> {error}
                    </div>
                )}

                {!loading && scheduledPosts.length === 0 && !error && (
                    <div className="text-center py-6 text-muted-foreground">
                        <Timer className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No scheduled posts in preview window</p>
                        <p className="text-xs mt-1">Posts appear here 2 hours before publishing</p>
                    </div>
                )}

                {loading && scheduledPosts.length === 0 ? (
                    <div className="space-y-3">
                        {[1, 2].map(i => (
                            <div key={i} className="animate-pulse p-4 rounded-lg border bg-background/50">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="h-4 bg-muted rounded w-1/3"></div>
                                    <div className="h-6 bg-muted rounded w-20"></div>
                                </div>
                                <div className="h-3 bg-muted rounded w-full mb-1"></div>
                                <div className="h-3 bg-muted rounded w-2/3"></div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                        {scheduledPosts.map((post, index) => (
                            <div
                                key={`${post.locationId}-${index}`}
                                className="p-4 rounded-lg border bg-background/80 hover:bg-background transition-colors"
                            >
                                {/* Header with business name and countdown */}
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Building className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium text-sm truncate max-w-[200px]">
                                            {post.businessName}
                                        </span>
                                        <Badge variant="outline" className="text-xs">
                                            {post.category}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge
                                            variant="secondary"
                                            className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 flex items-center gap-1"
                                        >
                                            <Clock className="h-3 w-3" />
                                            {formatTimeRemaining(post.minutesUntilPublish)}
                                        </Badge>
                                    </div>
                                </div>

                                {/* Post content preview */}
                                <div className="mb-3">
                                    <p className="text-sm text-muted-foreground line-clamp-3">
                                        {post.content}
                                    </p>
                                </div>

                                {/* Footer with scheduled time and AI indicator */}
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        <span>Publishes at {formatScheduledTime(post.scheduledTime)}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Sparkles className="h-3 w-3 text-purple-500" />
                                        <span className="text-purple-600 dark:text-purple-400">AI Generated</span>
                                    </div>
                                </div>

                                {/* Call to action indicator */}
                                {post.callToAction && (
                                    <div className="mt-2 pt-2 border-t border-border/50">
                                        <Badge variant="outline" className="text-xs">
                                            Button: {post.callToAction.actionType}
                                        </Badge>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Last updated indicator */}
                {lastUpdated && (
                    <div className="mt-3 text-xs text-center text-muted-foreground">
                        Last updated: {lastUpdated.toLocaleTimeString()}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default ScheduledPostsSection;
