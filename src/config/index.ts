/**
 * Lenz configuration utilities
 */

import { ConfigurationError } from '../errors/index.js';

export interface LenzConfig {
  /** Path to GraphQL schema file */
  schema?: string;
  /** Data source configuration */
  datasource?: {
    /** MongoDB connection URL (include database name in URL, e.g., mongodb://localhost:27017/mydb) */
    url?: string;
    /** Database name (overrides database name from URL) */
    database?: string;
  };
  /** Generation configuration */
  generate?: {
    /** Client generation options */
    client?: {
      /** Output directory for generated client */
      output?: string;
    };
  };
  /** Logging levels */
  log?: ('query' | 'info' | 'warn' | 'error')[];
  /** Connection pool size */
  maxPoolSize?: number;
  /** Connection timeout */
  connectTimeoutMS?: number;
  /** Socket timeout */
  socketTimeoutMS?: number;
}

/**
 * Define a Lenz configuration with validation
 */
export function defineConfig(config: LenzConfig): LenzConfig {
  // Validate config
  if (config.schema !== undefined && typeof config.schema !== 'string') {
    throw new ConfigurationError('schema must be a string', { schema: config.schema });
  }
  if (config.datasource?.url !== undefined && typeof config.datasource.url !== 'string') {
    throw new ConfigurationError('datasource.url must be a string', { url: config.datasource.url });
  }
  if (config.log !== undefined) {
    const validLevels = ['query', 'info', 'warn', 'error'];
    for (const level of config.log) {
      if (!validLevels.includes(level)) {
        throw new ConfigurationError(`Invalid log level '${level}'. Must be one of: ${validLevels.join(', ')}`, { level });
      }
    }
  }
  if (config.maxPoolSize !== undefined && (typeof config.maxPoolSize !== 'number' || config.maxPoolSize < 1)) {
    throw new ConfigurationError('maxPoolSize must be a positive number', { maxPoolSize: config.maxPoolSize });
  }
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
  maxPoolSize: 10,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000
};