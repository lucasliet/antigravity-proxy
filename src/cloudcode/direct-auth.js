/**
 * Direct Authentication Module
 * 
 * Handles authentication when a refresh token is provided directly via header
 * (bypasses AccountManager pool)
 */

import { refreshAccessToken } from '../auth/oauth.js';
import { discoverProject } from '../account-manager/credentials.js';
import { TOKEN_REFRESH_INTERVAL_MS } from '../constants.js';
import { logger } from '../utils/logger.js';

const TOKEN_CACHE_TTL_MS = TOKEN_REFRESH_INTERVAL_MS;

const directAuthCache = new Map();

/**
 * Check if a token string looks like a refresh token (vs proxy API key)
 * @param {string} token - Token to check
 * @returns {boolean} True if token looks like a refresh token
 */
export function isRefreshToken(token) {
    if (!token || typeof token !== 'string') {
        return false;
    }
    
    // Refresh tokens are long (200+ chars) and alphanumeric with special chars
    // Proxy API keys are shorter (sk-xxx or similar)
    // Heuristic: length > 100 chars AND matches OAuth format
    return token.length > 100 && /^[A-Za-z0-9\-_\.]+$/.test(token);
}

/**
 * Build authentication data from a direct refresh token
 * @param {string} refreshToken - Google OAuth refresh token
 * @returns {Promise<{accessToken: string, projectId: string, subscription: Object|null}>}
 * @throws {Error} If authentication fails
 */
export async function buildDirectAuth(refreshToken) {
    if (!refreshToken || typeof refreshToken !== 'string') {
        throw new Error('Invalid refresh token: must be a non-empty string');
    }

    // Check cache first (keyed by refresh token hash for security)
    const cacheKey = hashToken(refreshToken);
    const cached = directAuthCache.get(cacheKey);
    if (cached && (Date.now() - cached.cachedAt) < TOKEN_CACHE_TTL_MS) {
        logger.debug('[DirectAuth] Using cached access token');
        return {
            accessToken: cached.accessToken,
            projectId: cached.projectId,
            subscription: cached.subscription
        };
    }

    try {
        // Step 1: Exchange refresh token for access token
        logger.info('[DirectAuth] Refreshing access token from direct refresh token');
        const tokens = await refreshAccessToken(refreshToken);
        const accessToken = tokens.accessToken;

        // Step 2: Discover project ID and subscription
        logger.info('[DirectAuth] Discovering project ID and subscription');
        const { project, subscription } = await discoverProject(accessToken);

        if (!project) {
            throw new Error('Failed to discover project ID');
        }

        // Cache the result
        directAuthCache.set(cacheKey, {
            accessToken,
            projectId: project,
            subscription,
            cachedAt: Date.now()
        });

        logger.success(`[DirectAuth] Authentication successful, project: ${project}, tier: ${subscription?.tier || 'unknown'}`);

        return {
            accessToken,
            projectId: project,
            subscription
        };
    } catch (error) {
        // Clear cache on error
        directAuthCache.delete(cacheKey);
        
        logger.error('[DirectAuth] Authentication failed:', error.message);
        throw new Error(`Direct authentication failed: ${error.message}`);
    }
}

/**
 * Hash a token for cache key (for security - don't store raw refresh tokens in cache keys)
 * @param {string} token - Token to hash
 * @returns {string} Hashed token
 */
function hashToken(token) {
    // Simple hash for cache key (not cryptographic - just for cache isolation)
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
        const char = token.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
}

/**
 * Clear the direct auth cache (useful for testing or forced refresh)
 * @returns {void}
 */
export function clearDirectAuthCache() {
    directAuthCache.clear();
    logger.debug('[DirectAuth] Cache cleared');
}
