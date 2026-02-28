/**
 * Lenz configuration utilities
 */

export interface LenzConfig {
  /** Path to GraphQL schema file */
  schema?: string;
  /** Data source configuration */
  datasource?: {
    /** MongoDB connection URL */
    url?: string;
    /** Database name */
    database?: string;
  };
  /** Generation configuration */
  generate?: {
    /** Client generation options */
    client?: {
      /** Output directory for generated client */
      output?: string;
      /** Generator name */
      generator?: string;
    };
  };
  /** Logging levels */
  log?: ('query' | 'info' | 'warn' | 'error')[];
  /** Auto-create collections */
  autoCreateCollections?: boolean;
  /** Connection pool size */
  maxPoolSize?: number;
  /** Connection timeout */
  connectTimeoutMS?: number;
  /** Socket timeout */
  socketTimeoutMS?: number;
}

/**
 * Define a Lenz configuration
 */
export function defineConfig(config: LenzConfig): LenzConfig {
  return config;
}

/**
 * Load environment variables
 */
export function env(key: string, defaultValue?: string): string {
  return process.env[key] || defaultValue || '';
}

/**
 * Default configuration
 */
export const defaultConfig: LenzConfig = {
  schema: 'schema.graphql',
  datasource: {
    url: 'mongodb://localhost:27017',
    database: 'myapp'
  },
  generate: {
    client: {
      output: '../generated/lenz/client',
      generator: 'lenz-client-js',
    }
  },
  log: ['query', 'error', 'warn'],
  autoCreateCollections: true,
  maxPoolSize: 10,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000
};