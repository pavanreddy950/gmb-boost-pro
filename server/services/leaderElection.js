import connectionPool from '../database/connectionPool.js';

/**
 * Leader Election Service
 * 
 * Ensures only ONE server runs automation cron jobs when multiple
 * servers are deployed (horizontal scaling).
 * 
 * How it works:
 * - Servers compete to become "leader"
 * - Leader runs automations and sends heartbeat every 30s
 * - If leader dies (no heartbeat for 90s), another server becomes leader
 * - Uses Supabase `leader_election` table for coordination
 */
class LeaderElection {
    constructor() {
        this.isLeader = false;
        this.serverId = `server-${process.pid}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.heartbeatInterval = null;
        this.checkInterval = null;
        this.role = 'automation_scheduler';
        this.HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
        this.LEADER_TIMEOUT_MS = 90000; // 90 seconds (3x heartbeat)
    }

    /**
     * Start the leader election process
     */
    async start() {
        console.log(`[LeaderElection] 🎯 Server ID: ${this.serverId}`);
        console.log(`[LeaderElection] 🔄 Starting leader election for role: ${this.role}`);

        // Try to become leader immediately
        await this.tryBecomeLeader();

        // Check leadership every 30 seconds
        this.checkInterval = setInterval(async () => {
            if (this.isLeader) {
                await this.sendHeartbeat();
            } else {
                // Try to become leader if current leader is dead
                await this.tryBecomeLeader();
            }
        }, this.HEARTBEAT_INTERVAL_MS);

        console.log(`[LeaderElection] ✅ Leader election started (checking every 30s)`);
    }

    /**
     * Attempt to become the leader
     */
    async tryBecomeLeader() {
        try {
            const client = await connectionPool.getClient();

            // Get current leader
            const { data: currentLeader, error: selectError } = await client
                .from('leader_election')
                .select('*')
                .eq('role', this.role)
                .maybeSingle();

            if (selectError && selectError.code !== 'PGRST116') {
                throw selectError;
            }

            const now = new Date();

            // Check if current leader is alive
            const leaderExpired = !currentLeader ||
                (new Date(currentLeader.last_heartbeat).getTime() + this.LEADER_TIMEOUT_MS < now.getTime());

            if (leaderExpired) {
                if (currentLeader) {
                    console.log(`[LeaderElection] 💀 Previous leader expired (${currentLeader.server_id})`);
                }

                console.log(`[LeaderElection] 🏆 Attempting to claim leadership...`);

                // Claim leadership
                const { error: upsertError } = await client
                    .from('leader_election')
                    .upsert({
                        role: this.role,
                        server_id: this.serverId,
                        last_heartbeat: now.toISOString(),
                        metadata: {
                            pid: process.pid,
                            hostname: process.env.WEBSITE_HOSTNAME || process.env.HOSTNAME || 'unknown',
                            startedAt: new Date().toISOString(),
                            nodeVersion: process.version
                        }
                    }, {
                        onConflict: 'role'
                    });

                if (upsertError) {
                    throw upsertError;
                }

                // Verify we actually became leader (handle race conditions)
                const { data: verification, error: verifyError } = await client
                    .from('leader_election')
                    .select('server_id')
                    .eq('role', this.role)
                    .single();

                if (verifyError) {
                    throw verifyError;
                }

                if (verification?.server_id === this.serverId) {
                    if (!this.isLeader) {
                        // We just became leader
                        this.isLeader = true;
                        console.log(`[LeaderElection] ✅ 👑 This server is now LEADER`);
                        console.log(`[LeaderElection] 🚀 Starting automation services...`);
                        this.onBecomeLeader();
                    }
                    return true;
                } else {
                    console.log(`[LeaderElection] ⚠️ Another server won leadership (${verification.server_id})`);
                    if (this.isLeader) {
                        this.onLoseLeadership();
                    }
                    this.isLeader = false;
                }
            } else {
                // Leader is alive
                if (currentLeader.server_id === this.serverId) {
                    // We are the leader
                    if (!this.isLeader) {
                        console.log(`[LeaderElection] ✅ Confirmed as leader`);
                        this.isLeader = true;
                    }
                } else {
                    // Another server is leader
                    if (this.isLeader) {
                        console.log(`[LeaderElection] 👑 Leadership transferred to ${currentLeader.server_id}`);
                        this.onLoseLeadership();
                    }
                    this.isLeader = false;

                    const timeSinceHeartbeat = now.getTime() - new Date(currentLeader.last_heartbeat).getTime();
                    const minutesRemaining = Math.ceil((this.LEADER_TIMEOUT_MS - timeSinceHeartbeat) / 1000 / 60);

                    if (timeSinceHeartbeat % 60000 < this.HEARTBEAT_INTERVAL_MS) {
                        // Log every ~minute
                        console.log(`[LeaderElection] 📌 Server ${currentLeader.server_id} is leader (healthy for ${minutesRemaining}min)`);
                    }
                }
            }

            return false;

        } catch (error) {
            console.error(`[LeaderElection] ❌ Error during leader election:`, error.message);
            if (this.isLeader) {
                this.onLoseLeadership();
            }
            this.isLeader = false;
            return false;
        }
    }

    /**
     * Send heartbeat to maintain leadership
     */
    async sendHeartbeat() {
        try {
            const client = await connectionPool.getClient();

            const { error } = await client
                .from('leader_election')
                .update({
                    last_heartbeat: new Date().toISOString(),
                    metadata: {
                        pid: process.pid,
                        hostname: process.env.WEBSITE_HOSTNAME || process.env.HOSTNAME || 'unknown',
                        uptime: process.uptime(),
                        memory: process.memoryUsage().heapUsed / 1024 / 1024, // MB
                        nodeVersion: process.version
                    }
                })
                .eq('server_id', this.serverId)
                .eq('role', this.role);

            if (error) {
                console.error(`[LeaderElection] ❌ Heartbeat failed:`, error.message);
                console.log(`[LeaderElection] 💔 Lost leadership due to heartbeat failure`);
                this.isLeader = false;
                this.onLoseLeadership();
            } else {
                console.log(`[LeaderElection] 💓 Heartbeat sent (leader confirmed)`);
            }

        } catch (error) {
            console.error(`[LeaderElection] ❌ Heartbeat error:`, error.message);
            this.isLeader = false;
            this.onLoseLeadership();
        }
    }

    /**
     * Called when this server becomes leader
     */
    onBecomeLeader() {
        console.log(`[LeaderElection] 🎉 BECAME LEADER - Starting automations...`);

        // Dynamically import and start automation scheduler
        import('./automationScheduler.js')
            .then(module => {
                const scheduler = module.default;

                // Initialize automations
                scheduler.initializeAutomations()
                    .then(() => {
                        console.log(`[LeaderElection] ✅ Automations initialized and running`);
                    })
                    .catch(error => {
                        console.error(`[LeaderElection] ❌ Failed to initialize automations:`, error);
                    });
            })
            .catch(error => {
                console.error(`[LeaderElection] ❌ Failed to import automation scheduler:`, error);
            });
    }

    /**
     * Called when this server loses leadership
     */
    onLoseLeadership() {
        console.log(`[LeaderElection] 💤 LOST LEADERSHIP - Stopping automations...`);

        // Dynamically import and stop automation scheduler
        import('./automationScheduler.js')
            .then(module => {
                const scheduler = module.default;

                // Stop all automations
                if (scheduler.stopAllAutomations) {
                    scheduler.stopAllAutomations();
                    console.log(`[LeaderElection] ✅ Automations stopped`);
                }
            })
            .catch(error => {
                console.error(`[LeaderElection] ⚠️ Could not stop automations:`, error);
            });
    }

    /**
     * Stop the leader election process
     */
    stop() {
        console.log(`[LeaderElection] 🛑 Stopping leader election...`);

        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }

        if (this.isLeader) {
            this.onLoseLeadership();
        }

        this.isLeader = false;
        console.log(`[LeaderElection] ✅ Leader election stopped`);
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            serverId: this.serverId,
            isLeader: this.isLeader,
            role: this.role,
            heartbeatInterval: this.HEARTBEAT_INTERVAL_MS,
            leaderTimeout: this.LEADER_TIMEOUT_MS
        };
    }

    /**
     * Health check
     */
    async healthCheck() {
        try {
            const client = await connectionPool.getClient();

            const { data, error } = await client
                .from('leader_election')
                .select('*')
                .eq('role', this.role)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            return {
                status: 'healthy',
                currentServer: {
                    serverId: this.serverId,
                    isLeader: this.isLeader
                },
                leader: data ? {
                    serverId: data.server_id,
                    lastHeartbeat: data.last_heartbeat,
                    metadata: data.metadata
                } : null,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'error',
                message: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

// Singleton instance
const leaderElection = new LeaderElection();

export default leaderElection;
