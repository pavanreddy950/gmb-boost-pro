// Scheduled Posts Service - Pre-generates and stores scheduled posts
// Posts appear 30 minutes before publishing

import { createClient } from '@supabase/supabase-js';

class ScheduledPostsService {
    constructor() {
        this.supabase = null;
        this.PREVIEW_MINUTES_BEFORE = 120; // Show posts 2 hours before publishing (increased from 30 min)
        this.scheduledPosts = new Map(); // In-memory cache: locationId -> post data
    }

    async ensureClient() {
        if (!this.supabase) {
            this.supabase = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_SERVICE_KEY
            );
        }
        return this.supabase;
    }

    // Pre-generate content for an upcoming post
    async preGeneratePost(locationId, config, scheduledTime) {
        console.log(`[ScheduledPosts] 📝 Pre-generating post for ${config.businessName || locationId}`);
        console.log(`[ScheduledPosts] Scheduled to publish at: ${scheduledTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);

        try {
            // Import the automation scheduler to use its content generation
            const automationScheduler = (await import('./automationScheduler.js')).default;

            // Generate the post content using AI
            const postContent = await automationScheduler.generatePostContent(config, locationId, config.userId);

            // Store the pre-generated post
            const scheduledPost = {
                locationId,
                businessName: config.businessName || 'Business',
                category: config.category || 'business',
                content: postContent.content,
                callToAction: postContent.callToAction,
                scheduledTime: scheduledTime.toISOString(),
                previewTime: new Date(scheduledTime.getTime() - (this.PREVIEW_MINUTES_BEFORE * 60 * 1000)).toISOString(),
                status: 'scheduled', // scheduled, publishing, published, failed
                createdAt: new Date().toISOString(),
                userId: config.userId,
                keywords: config.keywords,
                config: config
            };

            // Store in memory cache
            this.scheduledPosts.set(locationId, scheduledPost);

            console.log(`[ScheduledPosts] ✅ Post pre-generated and cached for ${config.businessName}`);
            console.log(`[ScheduledPosts] Will appear in Scheduled section at: ${scheduledPost.previewTime}`);

            return scheduledPost;
        } catch (error) {
            console.error(`[ScheduledPosts] ❌ Failed to pre-generate post for ${locationId}:`, error);
            return null;
        }
    }

    // Get all scheduled posts that should be visible (within preview window)
    getVisibleScheduledPosts() {
        const now = new Date();
        const visiblePosts = [];

        for (const [locationId, post] of this.scheduledPosts.entries()) {
            const previewTime = new Date(post.previewTime);
            const scheduledTime = new Date(post.scheduledTime);

            // Post is visible if:
            // 1. Current time >= preview time (30 min before)
            // 2. Current time < scheduled time (not yet published)
            // 3. Status is 'scheduled'
            if (now >= previewTime && now < scheduledTime && post.status === 'scheduled') {
                visiblePosts.push({
                    ...post,
                    minutesUntilPublish: Math.ceil((scheduledTime - now) / 60000)
                });
            }
        }

        console.log(`[ScheduledPosts] 📋 ${visiblePosts.length} posts visible in scheduled section`);
        return visiblePosts;
    }

    // Get scheduled posts for a specific location
    getScheduledPostForLocation(locationId) {
        return this.scheduledPosts.get(locationId) || null;
    }

    // Mark a post as published (called after successful posting)
    markAsPublished(locationId) {
        const post = this.scheduledPosts.get(locationId);
        if (post) {
            post.status = 'published';
            post.publishedAt = new Date().toISOString();
            console.log(`[ScheduledPosts] ✅ Marked ${locationId} as published`);
        }
    }

    // Mark a post as failed
    markAsFailed(locationId, error) {
        const post = this.scheduledPosts.get(locationId);
        if (post) {
            post.status = 'failed';
            post.error = error;
            console.log(`[ScheduledPosts] ❌ Marked ${locationId} as failed: ${error}`);
        }
    }

    // Clear old posts (published more than 1 hour ago)
    cleanupOldPosts() {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        for (const [locationId, post] of this.scheduledPosts.entries()) {
            if (post.status === 'published' && new Date(post.publishedAt) < oneHourAgo) {
                this.scheduledPosts.delete(locationId);
                console.log(`[ScheduledPosts] 🧹 Cleaned up old post for ${locationId}`);
            }
        }
    }

    // Pre-generate posts for all enabled automations based on their schedule
    async preGenerateAllUpcomingPosts() {
        console.log('[ScheduledPosts] ========================================');
        console.log('[ScheduledPosts] 🔄 Pre-generating all upcoming posts...');
        console.log('[ScheduledPosts] ========================================');

        try {
            const automationScheduler = (await import('./automationScheduler.js')).default;
            await automationScheduler.loadSettings();

            const automations = automationScheduler.settings.automations || {};
            const nowInIST = new Date(
                new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
            );

            let preGeneratedCount = 0;
            console.log(`[ScheduledPosts] Found ${Object.keys(automations).length} total automations`);

            for (const [locationId, config] of Object.entries(automations)) {
                if (!config.autoPosting?.enabled) {
                    continue;
                }

                // Use effective schedule time (user customized or previous post time)
                const effectiveSchedule = automationScheduler.getEffectiveScheduleTime(config.autoPosting, config.autoPosting?.lastRun);
                if (!effectiveSchedule) {
                    console.log(`[ScheduledPosts] ⚠️ No effective schedule for ${locationId}`);
                    continue;
                }

                const [hour, minute] = effectiveSchedule.split(':').map(Number);

                // Create today's scheduled time
                const scheduledTime = new Date(nowInIST);
                scheduledTime.setHours(hour, minute, 0, 0);

                // Preview time is 30 minutes before
                const previewTime = new Date(scheduledTime.getTime() - (this.PREVIEW_MINUTES_BEFORE * 60 * 1000));

                // Check if we should pre-generate:
                // 1. Current time >= preview time (30 min before scheduled)
                // 2. Current time < scheduled time (not yet time to publish)
                // 3. We haven't already pre-generated for this schedule
                const existingPost = this.scheduledPosts.get(locationId);
                const alreadyPreGenerated = existingPost &&
                    new Date(existingPost.scheduledTime).getTime() === scheduledTime.getTime();

                if (nowInIST >= previewTime && nowInIST < scheduledTime && !alreadyPreGenerated) {
                    console.log(`[ScheduledPosts] ⏰ Time to pre-generate for ${config.autoPosting.businessName || locationId}`);

                    await this.preGeneratePost(locationId, {
                        ...config.autoPosting,
                        userId: config.userId
                    }, scheduledTime);

                    preGeneratedCount++;
                }
            }

            console.log(`[ScheduledPosts] ✅ Pre-generated ${preGeneratedCount} posts`);
            console.log('[ScheduledPosts] ========================================');

            return preGeneratedCount;
        } catch (error) {
            console.error('[ScheduledPosts] ❌ Error pre-generating posts:', error);
            return 0;
        }
    }

    // Start the pre-generation checker (runs every minute)
    startPreGenerationChecker() {
        console.log('[ScheduledPosts] ⏰ Starting pre-generation checker (every 1 minute)');

        // Run immediately
        this.preGenerateAllUpcomingPosts();

        // Then run every minute
        this.checkerInterval = setInterval(() => {
            this.preGenerateAllUpcomingPosts();
            this.cleanupOldPosts();
        }, 60 * 1000); // 1 minute
    }

    // Stop the checker
    stopPreGenerationChecker() {
        if (this.checkerInterval) {
            clearInterval(this.checkerInterval);
            console.log('[ScheduledPosts] ⏹️ Pre-generation checker stopped');
        }
    }
}

// Singleton instance
const scheduledPostsService = new ScheduledPostsService();

export default scheduledPostsService;
