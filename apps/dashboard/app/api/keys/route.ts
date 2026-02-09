/**
 * AgentGuard API Key Management
 * Secure API key generation and validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateApiKey, hashApiKey, validateApiKey } from '@/middleware/security';
import crypto from 'crypto';

// Mock database - replace with real database in production
const apiKeys = new Map<string, {
  id: string;
  name: string;
  hashedKey: string;
  createdAt: Date;
  lastUsed: Date | null;
  permissions: string[];
  isActive: boolean;
}>();

/**
 * Generate a new API key
 * POST /api/keys
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, permissions = ['read'] } = body;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400, headers: getSecurityHeaders() }
      );
    }
    
    // Validate permissions
    const validPermissions = ['read', 'write', 'admin'];
    if (!permissions.every((p: string) => validPermissions.includes(p))) {
      return NextResponse.json(
        { error: 'Invalid permissions' },
        { status: 400, headers: getSecurityHeaders() }
      );
    }
    
    // Generate secure API key
    const apiKey = generateApiKey();
    const hashedKey = hashApiKey(apiKey);
    const keyId = crypto.randomUUID();
    
    // Store in database (mock)
    apiKeys.set(keyId, {
      id: keyId,
      name: name.trim(),
      hashedKey,
      createdAt: new Date(),
      lastUsed: null,
      permissions,
      isActive: true
    });
    
    // Return API key (only shown once)
    return NextResponse.json({
      id: keyId,
      name: name.trim(),
      key: apiKey, // Only shown once!
      permissions,
      createdAt: new Date().toISOString()
    }, {
      headers: getSecurityHeaders()
    });
    
  } catch (error) {
    console.error('Error generating API key:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: getSecurityHeaders() }
    );
  }
}

/**
 * List all API keys (without the actual keys)
 * GET /api/keys
 */
export async function GET(request: NextRequest) {
  try {
    const keys = Array.from(apiKeys.values()).map(key => ({
      id: key.id,
      name: key.name,
      createdAt: key.createdAt.toISOString(),
      lastUsed: key.lastUsed?.toISOString() || null,
      permissions: key.permissions,
      isActive: key.isActive
    }));
    
    return NextResponse.json({ keys }, {
      headers: getSecurityHeaders()
    });
    
  } catch (error) {
    console.error('Error listing API keys:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: getSecurityHeaders() }
    );
  }
}

/**
 * Revoke an API key
 * DELETE /api/keys/:id
 */
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const keyId = url.pathname.split('/').pop();
    
    if (!keyId) {
      return NextResponse.json(
        { error: 'Key ID is required' },
        { status: 400, headers: getSecurityHeaders() }
      );
    }
    
    if (!apiKeys.has(keyId)) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404, headers: getSecurityHeaders() }
      );
    }
    
    // Soft delete (deactivate)
    const key = apiKeys.get(keyId)!;
    key.isActive = false;
    
    return NextResponse.json({ 
      message: 'API key revoked successfully' 
    }, {
      headers: getSecurityHeaders()
    });
    
  } catch (error) {
    console.error('Error revoking API key:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: getSecurityHeaders() }
    );
  }
}

/**
 * Validate API key (used by other endpoints)
 */
export function validateApiKeyEndpoint(providedKey: string): boolean {
  // Find API key by hash
  const providedHash = hashApiKey(providedKey);
  
  for (const [, keyData] of apiKeys) {
    if (keyData.isActive && keyData.hashedKey === providedHash) {
      // Update last used timestamp
      keyData.lastUsed = new Date();
      return true;
    }
  }
  
  return false;
}

/**
 * Check API key permissions
 */
export function checkApiKeyPermissions(apiKey: string, requiredPermission: string): boolean {
  const providedHash = hashApiKey(apiKey);
  
  for (const [, keyData] of apiKeys) {
    if (keyData.isActive && keyData.hashedKey === providedHash) {
      return keyData.permissions.includes(requiredPermission) || 
             keyData.permissions.includes('admin');
    }
  }
  
  return false;
}

function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self';",
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'X-Robots-Tag': 'noindex, nofollow'
  };
}