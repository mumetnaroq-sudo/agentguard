/**
 * AgentGuard Database Security Configuration
 * Secure database connection and Row Level Security (RLS)
 */

import { sql } from '@vercel/postgres';
import { db } from '@/lib/db';

/**
 * Database security configuration
 */
export const databaseSecurity = {
  // Connection security
  connection: {
    ssl: {
      rejectUnauthorized: true,
      // Use TLS 1.3 minimum
      minVersion: 'TLSv1.3'
    },
    // Connection pooling configuration
    pool: {
      max: 20,
      min: 5,
      acquire: 30000,
      idle: 10000,
      // Enable connection validation
      validateConnection: true
    },
    // Query timeout to prevent DoS
    queryTimeout: 30000, // 30 seconds
    statementTimeout: 30000,
    idleInTransactionSessionTimeout: 60000
  },
  
  // Row Level Security policies
  rls: {
    // Users can only access their own data
    userIsolation: async (userId: string) => {
      await sql`
        CREATE POLICY user_isolation ON api_keys
        FOR ALL
        USING (user_id = ${userId})
        WITH CHECK (user_id = ${userId})
      `;
    },
    
    // API keys are only visible to their owners
    apiKeyIsolation: async (userId: string) => {
      await sql`
        CREATE POLICY api_key_isolation ON api_keys
        FOR ALL
        USING (user_id = ${userId})
        WITH CHECK (user_id = ${userId})
      `;
    },
    
    // Scan results are only accessible to their owners
    scanResultIsolation: async (userId: string) => {
      await sql`
        CREATE POLICY scan_result_isolation ON scan_results
        FOR ALL
        USING (user_id = ${userId})
        WITH CHECK (user_id = ${userId})
      `;
    },
    
    // Audit logs are read-only and isolated by user
    auditLogIsolation: async (userId: string) => {
      await sql`
        CREATE POLICY audit_log_isolation ON audit_logs
        FOR SELECT
        USING (user_id = ${userId})
      `;
    }
  },
  
  // SQL injection prevention
  sqlInjection: {
    // Parameterized queries only
    enforceParameterizedQueries: true,
    
    // Input validation patterns
    validationPatterns: {
      email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      apiKey: /^[a-f0-9]{64}$/i,
      path: /^[a-zA-Z0-9_\-./]+$/,
      filename: /^[a-zA-Z0-9_\-.]+$/
    },
    
    // Sanitization functions
    sanitizeInput: (input: string, type: string): string => {
      switch (type) {
        case 'email':
          return input.toLowerCase().trim();
        case 'uuid':
          return input.toLowerCase().trim();
        case 'apiKey':
          return input.toLowerCase().trim();
        case 'path':
          // Remove any potentially dangerous characters
          return input.replace(/[<>'"&]/g, '');
        case 'filename':
          // Remove path traversal attempts
          return input.replace(/\.\./g, '').replace(/[<>'"&]/g, '');
        default:
          // Generic sanitization
          return input.replace(/[<>'"&]/g, '');
      }
    }
  },
  
  // Database encryption
  encryption: {
    // Encrypt sensitive data at rest
    encryptSensitiveData: async (data: string): Promise<string> => {
      // Use environment variable for encryption key
      const encryptionKey = process.env.ENCRYPTION_KEY;
      if (!encryptionKey) {
        throw new Error('ENCRYPTION_KEY not configured');
      }
      
      // Implement encryption using crypto module
      const crypto = require('crypto');
      const algorithm = 'aes-256-gcm';
      const key = crypto.scryptSync(encryptionKey, 'salt', 32);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(algorithm, key);
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    },
    
    decryptSensitiveData: async (encryptedData: string): Promise<string> => {
      const encryptionKey = process.env.ENCRYPTION_KEY;
      if (!encryptionKey) {
        throw new Error('ENCRYPTION_KEY not configured');
      }
      
      const crypto = require('crypto');
      const algorithm = 'aes-256-gcm';
      const key = crypto.scryptSync(encryptionKey, 'salt', 32);
      
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      
      const decipher = crypto.createDecipher(algorithm, key);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    }
  },
  
  // Audit logging for database operations
  audit: {
    logQuery: async (query: string, params: any[], userId: string) => {
      const timestamp = new Date().toISOString();
      const queryHash = require('crypto').createHash('sha256').update(query).digest('hex');
      
      await sql`
        INSERT INTO audit_logs (user_id, action, query_hash, timestamp, ip_address)
        VALUES (${userId}, 'database_query', ${queryHash}, ${timestamp}, ${getClientIP()})
      `;
    },
    
    logDataAccess: async (table: string, operation: string, userId: string) => {
      const timestamp = new Date().toISOString();
      
      await sql`
        INSERT INTO audit_logs (user_id, action, resource, timestamp, ip_address)
        VALUES (${userId}, ${operation}, ${table}, ${timestamp}, ${getClientIP()})
      `;
    }
  }
};

/**
 * Database initialization with security policies
 */
export async function initializeDatabaseSecurity() {
  try {
    // Enable RLS on all sensitive tables
    await sql`ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY`;
    await sql`ALTER TABLE scan_results ENABLE ROW LEVEL SECURITY`;
    await sql`ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY`;
    
    // Create indexes for performance
    await sql`CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_scan_results_user_id ON scan_results(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp)`;
    
    // Create security policies
    await createSecurityPolicies();
    
    console.log('Database security initialized successfully');
  } catch (error) {
    console.error('Error initializing database security:', error);
    throw error;
  }
}

/**
 * Create security policies
 */
async function createSecurityPolicies() {
  // Drop existing policies to avoid conflicts
  await sql`DROP POLICY IF EXISTS user_isolation ON api_keys`;
  await sql`DROP POLICY IF EXISTS api_key_isolation ON api_keys`;
  await sql`DROP POLICY IF EXISTS scan_result_isolation ON scan_results`;
  await sql`DROP POLICY IF EXISTS audit_log_isolation ON audit_logs`;
  
  // Create new policies
  await sql`
    CREATE POLICY user_isolation ON api_keys
    FOR ALL
    USING (user_id = current_user_id())
    WITH CHECK (user_id = current_user_id())
  `;
  
  await sql`
    CREATE POLICY scan_result_isolation ON scan_results
    FOR ALL
    USING (user_id = current_user_id())
    WITH CHECK (user_id = current_user_id())
  `;
  
  await sql`
    CREATE POLICY audit_log_isolation ON audit_logs
    FOR SELECT
    USING (user_id = current_user_id())
  `;
}

/**
 * Get current user ID (mock function - replace with actual auth)
 */
function current_user_id(): string {
  // This should be replaced with actual authentication
  // For now, return a mock user ID
  return 'user_123';
}

/**
 * Get client IP address
 */
function getClientIP(): string {
  // This should be implemented to get the actual client IP
  // For now, return a mock IP
  return '127.0.0.1';
}

/**
 * Secure query execution with RLS
 */
export async function secureQuery(query: string, params: any[], userId: string) {
  // Log the query for audit purposes
  await databaseSecurity.audit.logQuery(query, params, userId);
  
  // Execute the query with RLS context
  try {
    // Set RLS context
    await sql`SET app.current_user_id = ${userId}`;
    
    // Execute the query
    const result = await sql.query(query, params);
    
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

/**
 * Validate and sanitize input
 */
export function validateInput(input: string, type: string): string {
  const patterns = databaseSecurity.sqlInjection.validationPatterns;
  
  if (!patterns[type]) {
    throw new Error(`Unknown validation type: ${type}`);
  }
  
  const sanitized = databaseSecurity.sqlInjection.sanitizeInput(input, type);
  
  if (!patterns[type].test(sanitized)) {
    throw new Error(`Invalid input format for type: ${type}`);
  }
  
  return sanitized;
}