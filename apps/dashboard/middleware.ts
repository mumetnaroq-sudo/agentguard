/**
 * AgentGuard Next.js Middleware
 * Applies security controls to all requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  rateLimitMiddleware,
  apiKeyAuthMiddleware,
  securityHeadersMiddleware,
  corsMiddleware,
  inputValidationMiddleware,
  fileUploadValidationMiddleware,
  auditLoggingMiddleware
} from './middleware/security';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next();
  
  // Apply CORS middleware first
  const corsError = corsMiddleware(request);
  if (corsError) return corsError;
  
  // Apply input validation
  const validationError = inputValidationMiddleware(request);
  if (validationError) return validationError;
  
  // Apply file upload validation
  const uploadError = fileUploadValidationMiddleware(request);
  if (uploadError) return uploadError;
  
  // Apply rate limiting
  const rateLimitError = rateLimitMiddleware(request);
  if (rateLimitError) return rateLimitError;
  
  // Apply API key authentication for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const authError = apiKeyAuthMiddleware(request);
    if (authError) return authError;
  }
  
  // Apply security headers
  response = securityHeadersMiddleware(response);
  
  // Apply audit logging
  response = auditLoggingMiddleware(request, response);
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}