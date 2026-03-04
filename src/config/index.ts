/**
 * Lenz configuration utilities
 */

export interface LenzConfig {
  /** Path to GraphQL schema file */
  schema?: string;
  /** Data source configuration */
  datasource?: {
    /** MongoDB connection URL (include database name in URL, e.g., mongodb://localhost:27017/mydb) */
    url?: string;
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
  const result: LenzConfig = {
    ...defaultConfig,
    ...config,
  };

  // Deep merge for datasource
  if (config.datasource) {
    result.datasource = {
      ...defaultConfig.datasource,
      ...config.datasource,
    };
  }

  // Deep merge for generate
  if (config.generate) {
    result.generate = {
      ...defaultConfig.generate,
      ...config.generate,
    };
    if (config.generate.client) {
      result.generate.client = {
        ...defaultConfig.generate?.client,
        ...config.generate.client,
      };
    }
  }

  return result;
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
    url: 'mongodb://localhost:27017/myapp',
  },
  generate: {
    client: {
      output: '../generated/lenz/client',
    }
  },
  log: ['query', 'error', 'warn'],
  autoCreateCollections: true,
  maxPoolSize: 10,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000
};