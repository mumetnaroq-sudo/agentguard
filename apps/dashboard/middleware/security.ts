/**
 * AgentGuard Security Middleware
 * Rate limiting, authentication, and security headers
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // limit each IP to 100 requests per windowMs
  maxLoginAttempts: 5, // limit login attempts
  maxApiKeyRequests: 1000 // limit per API key
};

// In-memory rate limit store (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const loginAttempts = new Map<string, { count: number; resetTime: number }>();
const apiKeyRequests = new Map<string, { count: number; resetTime: number }>();

/**
 * Rate limiting middleware
 */
export function rateLimitMiddleware(request: NextRequest) {
  const ip = getClientIP(request);
  const now = Date.now();
  
  // Clean up expired entries
  cleanupExpiredEntries(rateLimitStore, now);
  cleanupExpiredEntries(loginAttempts, now);
  cleanupExpiredEntries(apiKeyRequests, now);
  
  // Check IP-based rate limit
  const key = `ip:${ip}`;
  const current = rateLimitStore.get(key);
  
  if (!current) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + RATE_LIMIT_CONFIG.windowMs
    });
  } else {
    if (now > current.resetTime) {
      // Reset counter
      current.count = 1;
      current.resetTime = now + RATE_LIMIT_CONFIG.windowMs;
    } else {
      current.count++;
      
      if (current.count > RATE_LIMIT_CONFIG.maxRequests) {
        return createRateLimitResponse();
      }
    }
  }
  
  return null; // Allow request to proceed
}

/**
 * API Key authentication middleware
 */
export function apiKeyAuthMiddleware(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  
  if (!apiKey) {
    return NextResponse.json(
      { error: 'API key required' },
      { status: 401, headers: getSecurityHeaders() }
    );
  }
  
  // Validate API key format
  if (!isValidApiKeyFormat(apiKey)) {
    return NextResponse.json(
      { error: 'Invalid API key format' },
      { status: 401, headers: getSecurityHeaders() }
    );
  }
  
  // Check API key rate limit
  const key = `api:${apiKey}`;
  const now = Date.now();
  const current = apiKeyRequests.get(key);
  
  if (!current) {
    apiKeyRequests.set(key, {
      count: 1,
      resetTime: now + RATE_LIMIT_CONFIG.windowMs
    });
  } else {
    if (now > current.resetTime) {
      current.count = 1;
      current.resetTime = now + RATE_LIMIT_CONFIG.windowMs;
    } else {
      current.count++;
      
      if (current.count > RATE_LIMIT_CONFIG.maxApiKeyRequests) {
        return NextResponse.json(
          { error: 'API key rate limit exceeded' },
          { status: 429, headers: getSecurityHeaders() }
        );
      }
    }
  }
  
  // TODO: Validate API key against database
  // For now, we'll use a simple validation
  if (!isValidApiKey(apiKey)) {
    return NextResponse.json(
      { error: 'Invalid API key' },
      { status: 401, headers: getSecurityHeaders() }
    );
  }
  
  return null; // Allow request to proceed
}

/**
 * Security headers middleware
 */
export function securityHeadersMiddleware(response: NextResponse) {
  const headers = getSecurityHeaders();
  
  // Apply security headers
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}

/**
 * CORS configuration middleware
 */
export function corsMiddleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    'https://agentguard.vercel.app',
    'https://localhost:3000',
    'http://localhost:3000'
  ];
  
  // Check if origin is allowed
  if (origin && !allowedOrigins.includes(origin)) {
    return NextResponse.json(
      { error: 'Origin not allowed' },
      { status: 403, headers: getSecurityHeaders() }
    );
  }
  
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 200 });
    
    if (origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
      response.headers.set('Access-Control-Max-Age', '86400');
    }
    
    return response;
  }
  
  return null; // Continue processing
}

/**
 * Input validation middleware
 */
export function inputValidationMiddleware(request: NextRequest) {
  const contentType = request.headers.get('content-type');
  
  // Validate content type
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 400, headers: getSecurityHeaders() }
      );
    }
  }
  
  // Validate request size (max 10MB)
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: 'Request too large (max 10MB)' },
      { status: 413, headers: getSecurityHeaders() }
    );
  }
  
  return null; // Continue processing
}

/**
 * File upload validation middleware
 */
export function fileUploadValidationMiddleware(request: NextRequest) {
  const contentType = request.headers.get('content-type');
  
  if (contentType && contentType.includes('multipart/form-data')) {
    // Validate file uploads
    // This is a simplified version - in production, use proper file validation
    
    const maxFileSize = 5 * 1024 * 1024; // 5MB
    const allowedMimeTypes = [
      'application/json',
      'text/plain',
      'application/xml',
      'text/xml',
      'application/yaml',
      'text/yaml'
    ];
    
    // TODO: Implement proper file validation
    // For now, we'll just check the content type header
    if (!allowedMimeTypes.some(type => contentType.includes(type))) {
      return NextResponse.json(
        { error: 'Invalid file type' },
        { status: 400, headers: getSecurityHeaders() }
      );
    }
  }
  
  return null; // Continue processing
}

/**
 * Audit logging middleware
 */
export function auditLoggingMiddleware(request: NextRequest, response: NextResponse) {
  const ip = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const timestamp = new Date().toISOString();
  const method = request.method;
  const url = request.url;
  const status = response.status;
  
  // Log security events
  const logEntry = {
    timestamp,
    ip,
    userAgent,
    method,
    url,
    status,
    headers: sanitizeHeaders(request.headers)
  };
  
  // In production, send to logging service (CloudWatch, Splunk, etc.)
  console.log('[AUDIT]', JSON.stringify(logEntry));
  
  return response;
}

/**
 * Helper functions
 */

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  // Fallback to a default IP for development
  return '127.0.0.1';
}

function cleanupExpiredEntries(store: Map<string, any>, now: number) {
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetTime) {
      store.delete(key);
    }
  }
}

function createRateLimitResponse() {
  return NextResponse.json(
    { 
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.'
    },
    { 
      status: 429, 
      headers: {
        ...getSecurityHeaders(),
        'Retry-After': '900' // 15 minutes
      }
    }
  );
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

function isValidApiKeyFormat(apiKey: string): boolean {
  // API key should be 64 characters of hex
  return /^[a-fA-F0-9]{64}$/.test(apiKey);
}

function isValidApiKey(apiKey: string): boolean {
  // TODO: Implement proper API key validation against database
  // For demo purposes, we'll use a simple validation
  // In production, this should check against a secure database
  return apiKey.length === 64 && /^[a-fA-F0-9]+$/.test(apiKey);
}

function sanitizeHeaders(headers: Headers): Record<string, string> {
  const sanitized: Record<string, string> = {};
  const allowedHeaders = ['user-agent', 'accept', 'accept-encoding', 'accept-language', 'content-type'];
  
  for (const [key, value] of headers.entries()) {
    if (allowedHeaders.includes(key.toLowerCase())) {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Generate secure API key
 */
export function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash API key for storage
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Validate API key securely
 */
export function validateApiKey(storedHash: string, providedKey: string): boolean {
  const providedHash = hashApiKey(providedKey);
  return crypto.timingSafeEqual(Buffer.from(storedHash), Buffer.from(providedHash));
}