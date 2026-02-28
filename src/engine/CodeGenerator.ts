import { GraphQLModel, GraphQLEnum, ModelRelation } from './GraphQLParser';
import * as ts from 'typescript';

export interface GenerateOptions {
  models: GraphQLModel[];
  enums: GraphQLEnum[];
  relations: ModelRelation[];
  outputPath: string;
  clientName?: string;
}

export class CodeGenerator {
  private typeMap: Record<string, string> = {
    'String': 'string',
    'Int': 'number',
    'Float': 'number',
    'Boolean': 'boolean',
    'ID': 'string',
    'DateTime': 'Date',
    'Date': 'Date',
    'Json': 'any',
    'ObjectId': 'string'
  };

  private compileTypeScriptToJavaScript(content: string): string {
    try {
      // Use TypeScript compiler
      const result = ts.transpileModule(content, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.ESNext,
          removeComments: false,
          preserveConstEnums: true,
          sourceMap: false,
          declaration: false,
          strict: false,
          esModuleInterop: true,
          skipLibCheck: true
        }
      });

      return this.addJsExtensionsToImports(result.outputText);
    } catch (error) {
      console.error('TypeScript compilation failed:', error);
      // Fallback to enhanced conversion method
      return this.convertToJavaScript(content);
    }
  }

  private addJsExtensionsToImports(content: string): string {
    let result = content;

    // 1. Remove import type (already present)
    result = result.replace(/import type/g, 'import');

    // 2. Add .js extensions to relative imports (already present)
    // Handle both single and double quotes, with optional whitespace
    // Match from './path' or from '../path' or from '../../path' etc.
    result = result.replace(/from\s+['"](\.\.?\/[^'"]*)['"]/g, (match, p1) => {
      if (p1.endsWith('.js') || p1.endsWith('.ts')) return match;
      // Keep the original quote type
      const quoteChar = match.includes('"') ? '"' : "'";
      return `from ${quoteChar}${p1}.js${quoteChar}`;
    });
    // Also handle import './path' (without from)
    result = result.replace(/import\s+['"](\.\.?\/[^'"]*)['"]/g, (match, p1) => {
      if (p1.endsWith('.js') || p1.endsWith('.ts')) return match;
      const quoteChar = match.includes('"') ? '"' : "'";
      return `import ${quoteChar}${p1}.js${quoteChar}`;
    });

    return result;
  }

  private removeTypeScriptSyntax(content: string): string {
    let result = content;

    // 1. Remove variable type annotations
    result = result.replace(/(\w+)\s*:\s*[^=;,\n]+(?=\s*(=|;|,|\n))/g, '$1');

    // 2. Remove generic parameters from functions and classes
    result = result.replace(/(\w+)<[^>]+>(?=\s*[\s\(])/g, '$1');

    // 3. Remove return type annotations
    result = result.replace(/\s*:\s*[^{]+(?=\s*{)/g, '');

    // 4. Remove type assertions
    result = result.replace(/\s+as\s+[^,\n;]+/g, '');

    // 5. Remove export type/interface lines
    result = result.replace(/export\s+(type|interface)\s+\w+.*\n/g, '');

    // 6. Remove 'as const'
    result = result.replace(/ as const/g, '');

    // 7. Remove private/protected/public modifiers
    result = result.replace(/\b(private|protected|public)\s+/g, '');

    // 8. Clean up empty lines
    result = result.replace(/\n\s*\n\s*\n/g, '\n\n');

    return result;
  }

  private convertToJavaScript(content: string): string {
    let result = this.addJsExtensionsToImports(content);
    result = this.removeTypeScriptSyntax(result);
    return result;
  }


  private convertTypesToJavaScript(content: string): string {
    // For types.ts and enums.ts files: create JavaScript-compatible exports
    // For enums: keep the actual enum objects, remove 'as const' and type exports
    // For types: export undefined stubs

    // First, extract all constant exports (export const ... = ...)
    const constExports: Array<{name: string, value: string}> = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match export const Name = { ... } or export const Name = ...
      const constMatch = line.match(/export const (\w+)\s*=\s*(.+)/);
      if (constMatch) {
        const name = constMatch[1];
        let value = constMatch[2];

        // Check if value continues on next lines (for multi-line objects)
        let braceCount = (value.match(/{/g) || []).length - (value.match(/}/g) || []).length;
        let j = i;
        while (braceCount > 0 && j + 1 < lines.length) {
          j++;
          const nextLine = lines[j];
          value += '\n' + nextLine;
          braceCount += (nextLine.match(/{/g) || []).length - (nextLine.match(/}/g) || []).length;
        }

        // Remove 'as const' if present
        value = value.replace(/ as const/g, '');

        constExports.push({name, value});
      }
    }

    // Extract other export names (interfaces, types) for stub exports
    const stubExportNames = new Set<string>();

    // Find export interface Name (but skip if we already have a const export with same name)
    const interfaceMatches = content.match(/export interface (\w+)/g);
    if (interfaceMatches) {
      interfaceMatches.forEach(match => {
        const name = match.replace('export interface ', '').trim();
        if (!constExports.some(exp => exp.name === name)) {
          stubExportNames.add(name);
        }
      });
    }

    // Find export type Name
    const typeMatches = content.match(/export type (\w+)/g);
    if (typeMatches) {
      typeMatches.forEach(match => {
        const name = match.replace('export type ', '').split('<')[0].trim();
        if (!constExports.some(exp => exp.name === name)) {
          stubExportNames.add(name);
        }
      });
    }

    // Find named exports: export { Name1, Name2 }
    const namedExportMatches = content.match(/export \{([^}]+)\}/g);
    if (namedExportMatches) {
      namedExportMatches.forEach(match => {
        const namesStr = match.replace('export {', '').replace('}', '').trim();
        const names = namesStr.split(',').map(n => n.trim()).filter(n => n.length > 0);
        names.forEach(name => {
          if (!constExports.some(exp => exp.name === name)) {
            stubExportNames.add(name);
          }
        });
      });
    }

    // Generate JavaScript file
    let result = `// This file was auto-generated by Lenz. Do not edit manually.
// @generated
// This file provides JavaScript-compatible exports for TypeScript types.
// TypeScript projects should use the .d.ts files for full type information.

`;

    // Add imports (convert import type to import and add .js extensions)
    const importLines = lines.filter(line => line.includes('import '));
    const processedImports = new Set<string>();

    for (const line of importLines) {
      let processed = line.replace(/import type/g, 'import');
      processed = processed.replace(/from '\.\/([^']+)'/g, (match, p1) => {
        if (p1.endsWith('.js') || p1.endsWith('.ts')) {
          return match;
        }
        return `from './${p1}.js'`;
      });
      if (!processedImports.has(processed)) {
        processedImports.add(processed);
        result += processed + '\n';
      }
    }

    if (processedImports.size > 0) {
      result += '\n';
    }

    // Add constant exports first (enums)
    constExports.forEach(exp => {
      result += `export const ${exp.name} = ${exp.value};\n`;
    });

    if (constExports.length > 0) {
      result += '\n';
    }

    // Add stub exports for types and interfaces
    const stubExportArray = Array.from(stubExportNames);
    if (stubExportArray.length > 0) {
      stubExportArray.forEach(name => {
        result += `export const ${name} = undefined;\n`;
      });

      // Also export all as a default object for convenience
      result += `\nexport default {\n`;
      [...constExports.map(exp => exp.name), ...stubExportArray].forEach((name, index, arr) => {
        result += `  ${name}: ${name}${index < arr.length - 1 ? ',' : ''}\n`;
      });
      result += `};\n`;
    } else if (constExports.length > 0) {
      // Only constant exports, add default export
      result += `\nexport default {\n`;
      constExports.forEach((exp, index) => {
        result += `  ${exp.name}: ${exp.name}${index < constExports.length - 1 ? ',' : ''}\n`;
      });
      result += `};\n`;
    } else {
      // No exports found, export empty object
      result += `export {};\n`;
    }

    return result;
  }

  private convertToDeclaration(content: string): string {
    // For now, return the TypeScript content as-is for declarations
    // This will be refined later to remove implementations
    return content;
  }

  generate(options: GenerateOptions): GeneratedFiles {
    const { models, enums, clientName = 'LenzClient' } = options;

    const files: GeneratedFiles = {
      'index.ts': this.generateIndex(clientName),
      'client.ts': this.generateClient(clientName, models),
      'types.ts': this.generateTypes(models, enums),
      'enums.ts': this.generateEnums(enums),
      'runtime/index.ts': this.generateRuntimeIndex(),
      'runtime/query.ts': this.generateRuntimeQuery(),
      'runtime/pagination.ts': this.generateRuntimePagination(),
      'runtime/relations.ts': this.generateRuntimeRelations(),
      'models/index.ts': this.generateModelsIndex(models),
      ...this.generateModelFiles(models)
    };

    const result: GeneratedFiles = {};
    for (const [filePath, content] of Object.entries(files)) {
      // Generate JavaScript file (.js)
      const jsPath = filePath.replace(/\.ts$/, '.js');

      // Special handling for types and enums files
      if (filePath === 'types.ts' || filePath === 'enums.ts') {
        result[jsPath] = this.convertTypesToJavaScript(content);
      } else {
        result[jsPath] = this.compileTypeScriptToJavaScript(content);
      }

      // Generate TypeScript declaration file (.d.ts)
      const dtsPath = filePath.replace(/\.ts$/, '.d.ts');
      result[dtsPath] = this.convertToDeclaration(content);
    }
    return result;
  }

  private generateIndex(clientName: string): string {
    return `// This file was auto-generated by Lenz. Do not edit manually.
// @generated

export { ${clientName} } from './client'
export * from './types'
export * from './enums'

import { ${clientName} } from './client'

/**
 * Default export for the Lenz client
 */
const lenz = new ${clientName}()
export default lenz
`;
  }

  private generateClient(clientName: string, models: GraphQLModel[]): string {
    return `// This file was auto-generated by Lenz. Do not edit manually.
// @generated

import { MongoClient, Db, ObjectId } from 'mongodb'
import type { LenzConfig } from './types'
import { QueryBuilder } from './runtime/query'
import { RelationResolver } from './runtime/relations'

${models.map(model => `
import { ${model.name}Delegate } from './models/${model.name}'`).join('\n')}

export class ${clientName} {
  private mongoClient: MongoClient | null = null
  private db: Db | null = null
  private config: LenzConfig
  private supportsTransactions: boolean = false

  // Model delegates
${models.map(model => `  public ${this.toCamelCase(model.name)}: ${model.name}Delegate`).join('\n')}

  constructor(config: LenzConfig = {}) {
    this.config = {
      url: config.url || process.env.MONGODB_URI || 'mongodb://localhost:27017',
      database: config.database || 'myapp',
      autoCreateCollections: config.autoCreateCollections ?? true,
      log: config.log || [],
      ...config
    }

    // Initialize model delegates
${models.map(model => `    this.${this.toCamelCase(model.name)} = new ${model.name}Delegate(this)`).join('\n')}
  }

  async $connect(): Promise<void> {
    if (this.mongoClient) {
      return
    }

    this.mongoClient = new MongoClient(this.config.url, {
      maxPoolSize: this.config.maxPoolSize || 10,
      connectTimeoutMS: this.config.connectTimeoutMS || 10000,
      socketTimeoutMS: this.config.socketTimeoutMS || 45000
    })

    await this.mongoClient.connect()
    this.db = this.mongoClient.db(this.config.database)

    // Test connection
    await this.db.command({ ping: 1 })

    // Check if MongoDB supports transactions (requires replica set)
    try {
      const serverInfo = await this.db.admin().serverInfo()
      this.supportsTransactions = serverInfo.repl?.replSetName !== undefined

      if (!this.supportsTransactions) {
        console.warn('⚠️  MongoDB is running in standalone mode. Transactions will not work.')
        console.warn('   Consider setting up a replica set for transaction support.')
        console.warn('   Example: mongod --replSet rs0 --port 27017')
      }
    } catch (error) {
      console.warn('⚠️  Could not determine MongoDB deployment type:', error.message)
      this.supportsTransactions = false
    }

    // Initialize collections and indexes
    await this.initializeCollections()

    if (this.config.log?.includes('info')) {
      console.log('✅ Connected to MongoDB')
    }
  }

  async $disconnect(): Promise<void> {
    if (this.mongoClient) {
      await this.mongoClient.close()
      this.mongoClient = null
      this.db = null

      if (this.config.log?.includes('info')) {
        console.log('👋 Disconnected from MongoDB')
      }
    }
  }

  async $transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    if (!this.mongoClient) {
      throw new Error('Not connected to database')
    }

    // Check if transactions are supported
    if (!this.supportsTransactions) {
      throw new Error(
        'Transactions are not supported in standalone MongoDB. ' +
        'Set up a replica set or use alternative consistency patterns. ' +
        'During development: mongod --replSet rs0 --port 27017'
      )
    }

    const session = this.mongoClient.startSession()

    try {
      session.startTransaction()
      const result = await callback(session)
      await session.commitTransaction()
      return result
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }
  }

  /**
   * Check if the connected MongoDB deployment supports transactions
   * Returns false if not connected or if running in standalone mode
   */
  $supportsTransactions(): boolean {
    return this.supportsTransactions
  }

  private async initializeCollections(): Promise<void> {
    if (!this.db || !this.config.autoCreateCollections) return

    const models = ${JSON.stringify(this.getModelsForRuntime(models), null, 2)}

    for (const model of models) {
      // Skip embedded models with empty collection names
      if (!model.collectionName) {
        continue
      }

      const collections = await this.db.listCollections({ name: model.collectionName }).toArray()

      if (collections.length === 0) {
        await this.db.createCollection(model.collectionName)

        // Create indexes
        if (model.indexes.length > 0) {
          const indexes = model.indexes.map(index => ({
            key: index.fields.reduce((acc, field) => {
              acc[field] = 1
              return acc
            }, {}),
            unique: index.unique,
            sparse: index.sparse || false
          }))

          try {
            await this.db.collection(model.collectionName).createIndexes(indexes)
          } catch (error) {
            console.warn(\`Failed to create indexes for \${model.name}:\`, error)
          }
        }
      }
    }
  }

  $isConnected(): boolean {
    return this.mongoClient !== null
  }

  get $db(): Db {
    if (!this.db) {
      throw new Error('Database not connected. Call $connect() first.')
    }
    return this.db
  }

  get $mongo(): { client: MongoClient; ObjectId: any } {
    if (!this.mongoClient) {
      throw new Error('Database not connected. Call $connect() first.')
    }
    return {
      client: this.mongoClient,
      ObjectId: ObjectId
    }
  }
}
`;
  }

  private getModelsForRuntime(models: GraphQLModel[]): any[] {
    return models.map(model => ({
      name: model.name,
      collectionName: model.collectionName,
      indexes: model.indexes.map(index => ({
        fields: index.fields,
        unique: index.unique,
        sparse: index.sparse ?? false
      }))
    }));
  }

  private generateTypes(models: GraphQLModel[], enums: GraphQLEnum[]): string {
    return `// This file was auto-generated by Lenz. Do not edit manually.
// @generated

import { ObjectId } from 'mongodb'

// Base types
export type ScalarType = 'String' | 'Int' | 'Float' | 'Boolean' | 'ID' | 'DateTime' | 'Date' | 'Json' | 'ObjectId'
export type RelationType = 'oneToOne' | 'oneToMany' | 'manyToOne' | 'manyToMany'

// Enum types
${enums.map(e => `
export enum ${e.name} {
  ${e.values.map(v => `${v} = '${v}'`).join(',\n  ')}
}`).join('\n\n')}

// Model types
${models.map(model => this.generateModelType(model)).join('\n\n')}

// Pagination types
export interface PageInfo {
  hasNextPage: boolean
  hasPreviousPage: boolean
  startCursor?: string
  endCursor?: string
}

export interface Connection<T> {
  edges: Array<Edge<T>>
  pageInfo: PageInfo
  totalCount: number
}

export interface Edge<T> {
  node: T
  cursor: string
}

// Operation types
export interface WhereInput<T = any> {
  id?: string | ObjectId
  AND?: WhereInput<T>[]
  OR?: WhereInput<T>[]
  NOT?: WhereInput<T>[]
  [key: string]: any
}

export interface OrderByInput {
  [key: string]: 'asc' | 'desc' | 1 | -1
}

export interface SelectInput {
  [key: string]: boolean | SelectInput
}

export interface IncludeInput {
  [key: string]: boolean | IncludeInput
}

export interface QueryOptions<T = any> {
  where?: WhereInput<T>
  select?: SelectInput
  include?: IncludeInput
  skip?: number
  take?: number
  orderBy?: OrderByInput | OrderByInput[]
  distinct?: string | string[]
  /** Cursor for pagination */
  cursor?: string | ObjectId
}

export interface CreateInput<T = any> {
  data: Partial<T>
  select?: SelectInput
  include?: IncludeInput
}

export interface UpdateInput<T = any> {
  where: WhereInput<T>
  data: Partial<T>
  select?: SelectInput
  include?: IncludeInput
}

export interface DeleteInput<T = any> {
  where: WhereInput<T>
  select?: SelectInput
  include?: IncludeInput
}

export interface UpsertInput<T = any> {
  where: WhereInput<T>
  create: Partial<T>
  update: Partial<T>
  select?: SelectInput
  include?: IncludeInput
}

// Pagination specific interfaces
export interface OffsetPaginationArgs<T = any> extends QueryOptions<T> {
  page?: number
  perPage?: number
}

export interface CursorPaginationArgs<T = any> extends QueryOptions<T> {
  cursor?: string | ObjectId
  take?: number
}

export interface PaginatedResult<T> {
  data: T[]
  meta: {
    total: number
    page: number
    perPage: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
}

export interface CursorPaginatedResult<T> {
  edges: Array<{
    node: T
    cursor: string
  }>
  pageInfo: {
    hasNextPage: boolean
    hasPreviousPage: boolean
    startCursor?: string
    endCursor?: string
  }
  totalCount: number
}

// Config types
export interface LenzConfig {
  url?: string
  database?: string
  schemaPath?: string
  log?: ('query' | 'error' | 'warn' | 'info')[]
  autoCreateCollections?: boolean
  maxPoolSize?: number
  connectTimeoutMS?: number
  socketTimeoutMS?: number
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[P] extends ReadonlyArray<infer U>
    ? ReadonlyArray<DeepPartial<U>>
    : DeepPartial<T[P]> | T[P]
}

export type WithId<T> = T & { id: string }
export type OptionalId<T> = Omit<T, 'id'> & { id?: string }
`;
  }

  private generateModelType(model: GraphQLModel): string {
    return `export interface ${model.name} {
  id: string
${model.fields.filter(f => !f.isId).map(field => {
  const tsType = this.mapToTSType(field.type, field.isArray);
  return `  ${field.name}${field.isRequired ? '' : '?'}: ${tsType}`;
}).join('\n')}
}

export interface ${model.name}CreateInput {
${model.fields.filter(f => !f.isId && !f.directives.includes('@generated')).map(field => {
  const tsType = this.mapToTSType(field.type, field.isArray);
  return `  ${field.name}${field.isRequired ? '' : '?'}: ${tsType}`;
}).join('\n')}
}

export interface ${model.name}UpdateInput {
${model.fields.filter(f => !f.isId).map(field => {
  const tsType = this.mapToTSType(field.type, field.isArray);
  return `  ${field.name}?: ${tsType}`;
}).join('\n')}
}

export type ${model.name}WhereInput = WhereInput<${model.name}>
export type ${model.name}QueryOptions = QueryOptions<${model.name}>
export type ${model.name}CreateArgs = CreateInput<${model.name}>
export type ${model.name}UpdateArgs = UpdateInput<${model.name}>
export type ${model.name}DeleteArgs = DeleteInput<${model.name}>
export type ${model.name}UpsertArgs = UpsertInput<${model.name}>`;
  }

  private mapToTSType(type: string, isArray: boolean): string {
    let baseType = this.typeMap[type] || type;

    if (isArray) {
      return `${baseType}[]`;
    }

    return baseType;
  }

  private generateEnums(enums: GraphQLEnum[]): string {
    if (enums.length === 0) {
      return '// No enums defined in schema\n\nexport {}';
    }

    return `// This file was auto-generated by Lenz. Do not edit manually.
// @generated

${enums.map(e => `
export const ${e.name} = {
${e.values.map(v => `  ${v}: '${v}',`).join('\n')}
} as const

export type ${e.name} = typeof ${e.name}[keyof typeof ${e.name}]
`).join('\n')}`;
  }

  private generateRuntimePagination(): string {
    return `// This file was auto-generated by Lenz. Do not edit manually.
// @generated

import { ObjectId } from 'mongodb'

/**
 * Pagination helper for Lenz ORM
 * Implements both offset-based and cursor-based pagination
 * Similar to Prisma's pagination patterns
 */
export class PaginationHelper {
  /**
   * Create a cursor from a document
   * Uses the document's _id by default
   */
  static createCursor(doc: any): string {
    if (!doc) throw new Error('Cannot create cursor from null document')

    // Use _id if available, otherwise id
    const id = doc._id || doc.id
    if (!id) throw new Error('Document must have an id to create cursor')

    // Base64 encode for cursor
    return Buffer.from(id.toString()).toString('base64')
  }

  /**
   * Parse cursor to get the id
   */
  static parseCursor(cursor: string): string {
    try {
      return Buffer.from(cursor, 'base64').toString('utf8')
    } catch (error) {
      throw new Error('Invalid cursor format')
    }
  }

  /**
   * Build MongoDB filter for cursor-based pagination
   * Assumes ordering by _id unless specified otherwise
   */
  static buildCursorFilter(
    cursor: string,
    orderBy: any = { _id: 'asc' },
    direction: 'forward' | 'backward' = 'forward'
  ): any {
    const cursorId = this.parseCursor(cursor)

    // For simplicity, we'll handle single field ordering
    const orderField = Object.keys(orderBy)[0] || '_id'
    const orderDirection = orderBy[orderField] || 'asc'

    const isAscending = orderDirection === 'asc' || orderDirection === 1
    const isForward = direction === 'forward'

    // Build comparison operator based on direction and order
    let operator: string
    if (isForward) {
      operator = isAscending ? '$gt' : '$lt'
    } else {
      operator = isAscending ? '$lt' : '$gt'
    }

    return {
      [orderField]: { [operator]: new ObjectId(cursorId) }
    }
  }

  /**
   * Calculate skip for offset pagination
   */
  static calculateSkip(page: number, perPage: number): number {
    if (page < 1) throw new Error('Page must be greater than 0')
    return (page - 1) * perPage
  }

  /**
   * Calculate total pages
   */
  static calculateTotalPages(total: number, perPage: number): number {
    return Math.ceil(total / perPage)
  }

  /**
   * Get pagination metadata
   */
  static getPaginationMeta(
    total: number,
    page: number,
    perPage: number,
    dataLength: number
  ): {
    total: number
    page: number
    perPage: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  } {
    const totalPages = this.calculateTotalPages(total, perPage)

    return {
      total,
      page,
      perPage,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1
    }
  }

  /**
   * Format results for GraphQL-style connection
   */
  static toConnection<T>(
    data: T[],
    totalCount: number,
    hasNextPage: boolean,
    hasPreviousPage: boolean,
    createCursor: (item: T) => string = (item: any) => this.createCursor(item)
  ): {
    edges: Array<{ node: T; cursor: string }>
    pageInfo: {
      hasNextPage: boolean
      hasPreviousPage: boolean
      startCursor?: string
      endCursor?: string
    }
    totalCount: number
  } {
    const edges = data.map(item => ({
      node: item,
      cursor: createCursor(item)
    }))

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage,
        startCursor: edges[0]?.cursor,
        endCursor: edges[edges.length - 1]?.cursor
      },
      totalCount
    }
  }

  /**
   * Simple offset pagination
   */
  static paginate<T>(
    data: T[],
    page: number = 1,
    perPage: number = 10
  ): {
    data: T[]
    meta: {
      page: number
      perPage: number
      total: number
      totalPages: number
      hasNextPage: boolean
      hasPreviousPage: boolean
    }
  } {
    const startIndex = (page - 1) * perPage
    const endIndex = startIndex + perPage
    const paginatedData = data.slice(startIndex, endIndex)
    const total = data.length
    const totalPages = Math.ceil(total / perPage)

    return {
      data: paginatedData,
      meta: {
        page,
        perPage,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    }
  }
}
`;
  }

  private generateRuntimeIndex(): string {
    return `// This file was auto-generated by Lenz. Do not edit manually.
// @generated

export { QueryBuilder } from './query'
export { PaginationHelper } from './pagination'
export { RelationResolver } from './relations'
`;
  }

  private generateRuntimeQuery(): string {
    return `// This file was auto-generated by Lenz. Do not edit manually.
// @generated

import { ObjectId, Filter, UpdateFilter } from 'mongodb'
import type { WhereInput, QueryOptions, SelectInput } from '../types'
import { PaginationHelper } from './pagination'

export class QueryBuilder {
  static buildWhere<T>(where: WhereInput<T>): Filter<any> {
    const filter: Filter<any> = {}

    for (const [key, value] of Object.entries(where || {})) {
      if (key === 'id') {
        if (typeof value === 'object' && value !== null) {
          // Для операторов типа { in: [...] } используем _id
          this.applyOperators(filter, '_id', value)
        } else {
          filter._id = this.normalizeId(value)
        }
      } else if (typeof value === 'object' && value !== null) {
        this.applyOperators(filter, key, value)
      } else {
        // Оставляем значение как есть для внешних ключей
        // (внешние ключи хранятся как строки, не преобразуем в ObjectId)
        filter[key] = value
      }
    }

    return filter
  }

  /**
   * Build cursor condition for pagination
   */
  static buildCursorCondition(
    cursor: string | ObjectId,
    orderBy: any = { _id: 'asc' }
  ): Filter<any> {
    const cursorId = typeof cursor === 'string'
      ? PaginationHelper.parseCursor(cursor)
      : cursor.toString()

    // For simple _id ordering
    if (orderBy._id || (!Object.keys(orderBy).length)) {
      return {
        _id: { $gt: new ObjectId(cursorId) }
      }
    }

    // For other field ordering (simplified implementation)
    // In real implementation, you'd need to know the value at the cursor
    const orderField = Object.keys(orderBy)[0]
    const orderDirection = orderBy[orderField]

    // Note: This is a simplified version
    // Full implementation requires fetching the cursor document
    return {
      [orderField]: orderDirection === 'desc'
        ? { $lt: cursorId }
        : { $gt: cursorId }
    }
  }

  /**
   * Build MongoDB projection object from select input and hidden fields
   */
  static buildProjection<T>(
    select: SelectInput | undefined,
    hiddenFields: string[] = []
  ): any {
    if (!select) {
      // По умолчанию: исключаем скрытые поля
      if (hiddenFields.length === 0) return undefined;
      const projection: any = {};
      hiddenFields.forEach(field => {
        projection[field] = 0;
      });
      return projection;
    }

    const projection: any = {};
    const processSelect = (sel: SelectInput, prefix = '') => {
      for (const [key, value] of Object.entries(sel)) {
        const fullPath = prefix ? \`\${prefix}.\${key}\` : key;

        if (typeof value === 'boolean') {
          // Базовое поле: true - включать, false - исключать
          projection[fullPath] = value ? 1 : 0;
        } else {
          // Вложенный объект (отношение)
          processSelect(value, fullPath);
        }
      }
    };

    processSelect(select);

    // Убедимся, что скрытые поля исключены, если не указано явно
    hiddenFields.forEach(field => {
      if (projection[field] === undefined) {
        projection[field] = 0;
      }
    });

    return projection;
  }

  static buildOptions<T>(options: QueryOptions<T>, hiddenFields: string[] = []): any {
    const result: any = {}

    if (options.skip !== undefined) result.skip = options.skip
    if (options.take !== undefined) result.limit = options.take

    if (options.orderBy) {
      result.sort = this.buildSort(options.orderBy)
    }

    // Добавить проекцию, если есть select или скрытые поля
    const projection = this.buildProjection(options.select, hiddenFields)
    if (projection) {
      result.projection = projection
    }

    return result
  }

  private static buildSort(orderBy: any): any {
    if (Array.isArray(orderBy)) {
      return orderBy.reduce((acc, curr) => ({ ...acc, ...this.buildSort(curr) }), {})
    }

    const sort: any = {}
    for (const [field, direction] of Object.entries(orderBy)) {
      if (direction === 'asc' || direction === 1) {
        sort[field] = 1
      } else if (direction === 'desc' || direction === -1) {
        sort[field] = -1
      }
    }
    return sort
  }

  private static applyOperators(filter: any, field: string, operators: any): void {
    const mongoOperators: Record<string, string> = {
      equals: '$eq',
      not: '$ne',
      in: '$in',
      notIn: '$nin',
      lt: '$lt',
      lte: '$lte',
      gt: '$gt',
      gte: '$gte',
      contains: '$regex',
      startsWith: '$regex',
      endsWith: '$regex'
    }

    for (const [op, value] of Object.entries(operators)) {
      const mongoOp = mongoOperators[op]

      if (mongoOp) {
        if (op === 'contains') {
          filter[field] = { $regex: value, $options: 'i' }
        } else if (op === 'startsWith') {
          filter[field] = { $regex: \`^\${value}\`, $options: 'i' }
        } else if (op === 'endsWith') {
          filter[field] = { $regex: \`\${value}\$\`, $options: 'i' }
        } else {
          if (!filter[field]) filter[field] = {}
          // Нормализуем ID только для поля _id (внутренний идентификатор)
          // Внешние ключи хранятся как строки, не преобразуем в ObjectId
          const normalizedValue = field === '_id' ? this.normalizeId(value) : value
          filter[field][mongoOp] = normalizedValue
        }
      }
    }
  }

  static normalizeId(id: string | ObjectId | (string | ObjectId)[]): ObjectId | string | (ObjectId | string)[] {
    try {
      if (Array.isArray(id)) {
        return id.map(item => this.normalizeId(item) as ObjectId | string)
      }
      if (typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)) {
        return new ObjectId(id)
      }
      return id
    } catch {
      return id
    }
  }

  static buildUpdate(data: any): UpdateFilter<any> {
    const update: UpdateFilter<any> = {}

    const setOperations: any = {}
    const otherOperations: any = {}

    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith('$')) {
        otherOperations[key] = value
      } else {
        setOperations[key] = value
      }
    }

    if (Object.keys(setOperations).length > 0) {
      update.$set = setOperations
    }

    Object.assign(update, otherOperations)

    return update
  }
}
`;
  }

  private generateRuntimeRelations(): string {
    return `// This file was auto-generated by Lenz. Do not edit manually.
// @generated

import { Db, ObjectId } from 'mongodb'

export class RelationResolver {
  static async resolveOneToOne(
    db: Db,
    sourceCollection: string,
    targetCollection: string,
    sourceId: string,
    foreignKey: string
  ): Promise<any> {
    const collection = db.collection(targetCollection)
    return await collection.findOne({ [foreignKey]: sourceId })
  }

  static async resolveOneToMany(
    db: Db,
    sourceCollection: string,
    targetCollection: string,
    sourceId: string,
    foreignKey: string
  ): Promise<any[]> {
    const collection = db.collection(targetCollection)
    return await collection.find({ [foreignKey]: sourceId }).toArray()
  }

  static async resolveManyToMany(
    db: Db,
    sourceCollection: string,
    targetCollection: string,
    joinCollection: string,
    sourceId: string
  ): Promise<any[]> {
    const joinCol = db.collection(joinCollection)
    const targetCol = db.collection(targetCollection)

    const connections = await joinCol.find({
      [\`\${sourceCollection.toLowerCase()}Id\`]: sourceId
    }).toArray()

    const targetIds = connections.map(c => c[\`\${targetCollection.toLowerCase()}Id\`])

    return await targetCol.find({
      _id: { $in: targetIds.map(id => new ObjectId(id)) }
    }).toArray()
  }

  static formatDocument(doc: any): any {
    if (!doc) return doc

    const formatted = { ...doc }
    if (formatted._id) {
      formatted.id = formatted._id.toString()
      delete formatted._id
    }

    return formatted
  }
}
`;
  }

  private generateModelsIndex(models: GraphQLModel[]): string {
    return models.map(model => `export { ${model.name}Delegate } from './${model.name}'`).join('\n');
  }

  private generateModelFiles(models: GraphQLModel[]): Record<string, string> {
    const files: Record<string, string> = {};

    for (const model of models) {
      files[`models/${model.name}.ts`] = this.generateModelDelegate(model);
    }

    return files;
  }

  private generateModelDelegate(model: GraphQLModel): string {
    return `// This file was auto-generated by Lenz. Do not edit manually.
// @generated

import { Collection, ObjectId, Document } from 'mongodb'
import type {
  ${model.name},
  ${model.name}CreateInput,
  ${model.name}UpdateInput,
  ${model.name}WhereInput,
  ${model.name}QueryOptions,
  ${model.name}CreateArgs,
  ${model.name}UpdateArgs,
  ${model.name}DeleteArgs,
  ${model.name}UpsertArgs,
  PaginatedResult,
  CursorPaginatedResult,
  OffsetPaginationArgs,
  CursorPaginationArgs
} from '../types'
import { QueryBuilder } from '../runtime/query'
import { PaginationHelper } from '../runtime/pagination'
import { RelationResolver } from '../runtime/relations'
import type { LenzClient } from '../client'

export class ${model.name}Delegate {
  constructor(private client: LenzClient) {}

  private readonly hiddenFields: string[] = ${JSON.stringify(model.fields.filter(f => f.isHidden).map(f => f.name))};

  private get collection(): Collection<Document> {
    return this.client.$db.collection('${model.collectionName}')
  }

  async findUnique(args: { where: ${model.name}WhereInput } & ${model.name}QueryOptions): Promise<${model.name} | null> {
    const query = QueryBuilder.buildWhere(args.where)
    const options = QueryBuilder.buildOptions(args, this.hiddenFields)

    const doc = await this.collection.findOne(query, options)
    if (!doc) return null

    const formatted = RelationResolver.formatDocument(doc)

    if (args.include) {
      return await this.includeRelations(formatted, args.include)
    }

    return formatted
  }

  async findMany(args?: ${model.name}QueryOptions): Promise<${model.name}[]> {
    const { cursor, ...otherArgs } = args || {}
    let where = args?.where || {}

    // Handle cursor-based pagination
    if (cursor) {
      const cursorCondition = QueryBuilder.buildCursorCondition(cursor, args?.orderBy)
      where = {
        ...where,
        ...cursorCondition
      }
    }

    const query = QueryBuilder.buildWhere(where)
    const options = QueryBuilder.buildOptions(otherArgs || {}, this.hiddenFields)

    const mongoCursor = this.collection.find(query, options)
    const docs = await mongoCursor.toArray()
    const formatted = docs.map(RelationResolver.formatDocument)

    if (args?.include) {
      return await Promise.all(
        formatted.map(doc => this.includeRelations(doc, args.include!))
      )
    }

    return formatted
  }

  async findFirst(args?: ${model.name}QueryOptions): Promise<${model.name} | null> {
    const results = await this.findMany({ ...args, take: 1 })
    return results[0] || null
  }

  async create(args: ${model.name}CreateArgs): Promise<${model.name}> {
    const now = new Date()
    const document = {
      ...args.data,
      _id: new ObjectId(),
      createdAt: now,
      updatedAt: now
    }

    const result = await this.collection.insertOne(document)
    const createdDoc = await this.collection.findOne({ _id: result.insertedId })

    if (!createdDoc) {
      throw new Error('Failed to create document')
    }

    const formatted = RelationResolver.formatDocument(createdDoc)

    if (args.include) {
      return await this.includeRelations(formatted, args.include)
    }

    return formatted
  }

  async createMany(args: { data: ${model.name}CreateInput[] }): Promise<{ count: number }> {
    const now = new Date()
    const documents = args.data.map(data => ({
      ...data,
      _id: new ObjectId(),
      createdAt: now,
      updatedAt: now
    }))

    const result = await this.collection.insertMany(documents)
    return { count: result.insertedCount }
  }

  async update(args: ${model.name}UpdateArgs): Promise<${model.name}> {
    const query = QueryBuilder.buildWhere(args.where)
    const updateData = {
      ...args.data,
      updatedAt: new Date()
    }

    const update = QueryBuilder.buildUpdate(updateData)
    const result = await this.collection.findOneAndUpdate(
      query,
      update,
      { returnDocument: 'after' }
    )

    const updatedDoc = result.value || result
    if (!updatedDoc) {
      throw new Error('Document not found')
    }

    const formatted = RelationResolver.formatDocument(updatedDoc)

    if (args.include) {
      return await this.includeRelations(formatted, args.include)
    }

    return formatted
  }

  async updateMany(args: { where?: ${model.name}WhereInput; data: ${model.name}UpdateInput }): Promise<{ count: number }> {
    const query = args.where ? QueryBuilder.buildWhere(args.where) : {}
    const updateData = {
      ...args.data,
      updatedAt: new Date()
    }

    const update = QueryBuilder.buildUpdate(updateData)
    const result = await this.collection.updateMany(query, update)
    return { count: result.modifiedCount }
  }

  async upsert(args: ${model.name}UpsertArgs): Promise<${model.name}> {
    const query = QueryBuilder.buildWhere(args.where)
    const existing = await this.collection.findOne(query)

    if (existing) {
      return this.update({
        where: args.where,
        data: args.update,
        select: args.select,
        include: args.include
      })
    } else {
      return this.create({
        data: args.create,
        select: args.select,
        include: args.include
      })
    }
  }

  async delete(args: ${model.name}DeleteArgs): Promise<${model.name} | null> {
    const query = QueryBuilder.buildWhere(args.where)
    const doc = await this.collection.findOne(query)

    if (!doc) return null

    await this.collection.deleteOne(query)
    const formatted = RelationResolver.formatDocument(doc)

    if (args.include) {
      return await this.includeRelations(formatted, args.include)
    }

    return formatted
  }

  async deleteMany(args: { where?: ${model.name}WhereInput }): Promise<{ count: number }> {
    const query = args.where ? QueryBuilder.buildWhere(args.where) : {}
    const result = await this.collection.deleteMany(query)
    return { count: result.deletedCount }
  }

  async count(args?: { where?: ${model.name}WhereInput }): Promise<number> {
    const query = args?.where ? QueryBuilder.buildWhere(args.where) : {}
    return await this.collection.countDocuments(query)
  }

  async aggregate<T = any>(pipeline: any[]): Promise<T[]> {
    return await this.collection.aggregate(pipeline).toArray() as T[]
  }

  /**
   * Offset-based pagination (page-based)
   * Similar to Prisma's skip/take pagination
   */
  async findManyPaginated(args: OffsetPaginationArgs<${model.name}>): Promise<PaginatedResult<${model.name}>> {
    const page = args.page || 1
    const perPage = args.take || args.perPage || 10
    const skip = (page - 1) * perPage

    // Get total count
    const where = args.where ? QueryBuilder.buildWhere(args.where) : {}
    const total = await this.collection.countDocuments(where)

    // Get paginated data
    const query = QueryBuilder.buildWhere(args.where || {})
    const options = {
      skip,
      limit: perPage,
      ...QueryBuilder.buildOptions(args, this.hiddenFields)
    }

    const mongoCursor = this.collection.find(query, options)
    const docs = await mongoCursor.toArray()
    const data = docs.map(RelationResolver.formatDocument)

    // Handle includes
    let resultData = data
    if (args.include) {
      resultData = await Promise.all(
        data.map(doc => this.includeRelations(doc, args.include!))
      )
    }

    const totalPages = Math.ceil(total / perPage)

    return {
      data: resultData,
      meta: {
        total,
        page,
        perPage,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    }
  }

  /**
   * Cursor-based pagination
   * More efficient for large datasets, similar to Relay/GraphQL cursor pagination
   */
  async findManyWithCursor(args: CursorPaginationArgs<${model.name}>): Promise<CursorPaginatedResult<${model.name}>> {
    const take = args.take || 20
    let where = args.where || {}

    // Apply cursor if provided
    if (args.cursor) {
      const cursorCondition = QueryBuilder.buildCursorCondition(args.cursor, args.orderBy)
      where = {
        ...where,
        ...cursorCondition
      }
    }

    // Get total count (optional, for pageInfo)
    const query = QueryBuilder.buildWhere(args.where || {})
    const totalCount = await this.collection.countDocuments(query)

    // Get data with one extra to check if there's more
    const options = {
      limit: take + 1,
      ...QueryBuilder.buildOptions(args, this.hiddenFields)
    }

    const mongoCursor = this.collection.find(where, options)
    const docs = await mongoCursor.toArray()
    const hasNextPage = docs.length > take

    // Remove extra element if exists
    const resultDocs = hasNextPage ? docs.slice(0, take) : docs
    const data = resultDocs.map(RelationResolver.formatDocument)

    // Handle includes
    let resultData = data
    if (args.include) {
      resultData = await Promise.all(
        data.map(doc => this.includeRelations(doc, args.include!))
      )
    }

    // Create edges with cursors
    const edges = resultData.map(doc => ({
      node: doc,
      cursor: PaginationHelper.createCursor(doc)
    }))

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: !!args.cursor,
        startCursor: edges[0]?.cursor,
        endCursor: edges[edges.length - 1]?.cursor
      },
      totalCount
    }
  }

  /**
   * Find with advanced pagination options
   * Supports both offset and cursor pagination
   */
  async findWithPagination(
    args: ${model.name}QueryOptions & {
      paginationType?: 'offset' | 'cursor'
      page?: number
      perPage?: number
      cursor?: string | ObjectId
    }
  ): Promise<any> {
    const paginationType = args.paginationType || 'offset'

    if (paginationType === 'cursor') {
      return this.findManyWithCursor({
        where: args.where,
        select: args.select,
        include: args.include,
        orderBy: args.orderBy,
        cursor: args.cursor,
        take: args.take || args.perPage
      })
    } else {
      return this.findManyPaginated({
        where: args.where,
        select: args.select,
        include: args.include,
        orderBy: args.orderBy,
        skip: args.skip,
        take: args.take,
        page: args.page,
        perPage: args.perPage
      })
    }
  }

  /**
   * Count with pagination info
   */
  async countWithPagination(args?: { where?: ${model.name}WhereInput }): Promise<{
    total: number
    filtered?: number
  }> {
    const where = args?.where ? QueryBuilder.buildWhere(args.where) : {}
    const total = await this.collection.estimatedDocumentCount()
    const filtered = await this.collection.countDocuments(where)

    return {
      total,
      filtered: total !== filtered ? filtered : undefined
    }
  }

  private applySelect(document: any, select: any): any {
    if (!select) {
      // If no select, exclude hidden fields by default
      if (this.hiddenFields.length === 0) return document;
      const result = { ...document };
      this.hiddenFields.forEach(field => {
        delete result[field];
      });
      return result;
    }

    // Build projection using QueryBuilder
    const projection = QueryBuilder.buildProjection(select, this.hiddenFields);
    if (!projection) return document;

    const result = { ...document };
    // Apply projection (simplified - only top-level fields)
    for (const [field, value] of Object.entries(projection)) {
      if (value === 0 && field in result) {
        delete result[field];
      }
      // If value === 1, keep the field (already present)
    }
    return result;
  }

  private async includeRelations(document: any, include: any): Promise<any> {
    const result = { ...document }
    if (!include || typeof include !== 'object') {
      return result
    }

    ${this.generateRelationInclusionCode(model)}

    return result
  }

  // Raw access
  get $raw() {
    return {
      collection: this.collection,
      find: async (filter: any) => await this.collection.find(filter).toArray(),
      findOne: async (filter: any) => await this.collection.findOne(filter),
      insertOne: async (doc: any) => await this.collection.insertOne(doc),
      updateOne: async (filter: any, update: any) => await this.collection.updateOne(filter, update),
      deleteOne: async (filter: any) => await this.collection.deleteOne(filter),
      aggregate: async (pipeline: any[]) => await this.collection.aggregate(pipeline).toArray()
    }
  }
}
`;
  }

  private generateRelationInclusionCode(model: GraphQLModel): string {
    const lines: string[] = [];

    for (const relation of model.relations) {
      switch (relation.type) {
        case 'oneToMany':
          lines.push(`    // Relation: ${relation.field} (oneToMany)`)
          lines.push(`    if (include.${relation.field} !== undefined) {`)
          lines.push(`      const ${relation.field} = await this.client.${this.toCamelCase(relation.target)}.findMany({`)
          lines.push(`        where: { ${relation.foreignKey}: document.id },`)
          lines.push(`        include: typeof include.${relation.field} === 'object' ? include.${relation.field} : undefined`)
          lines.push(`      })`)
          lines.push(`      result.${relation.field} = ${relation.field}`)
          lines.push(`    }`)
          break;
        case 'manyToOne':
          lines.push(`    // Relation: ${relation.field} (manyToOne)`)
          lines.push(`    if (include.${relation.field} !== undefined && document.${relation.foreignKey}) {`)
          lines.push(`      const ${relation.field} = await this.client.${this.toCamelCase(relation.target)}.findUnique({`)
          lines.push(`        where: { id: document.${relation.foreignKey} },`)
          lines.push(`        include: typeof include.${relation.field} === 'object' ? include.${relation.field} : undefined`)
          lines.push(`      })`)
          lines.push(`      result.${relation.field} = ${relation.field}`)
          lines.push(`    }`)
          break;
        case 'oneToOne':
          lines.push(`    // Relation: ${relation.field} (oneToOne)`)
          lines.push(`    if (include.${relation.field} !== undefined) {`)
          lines.push(`      const ${relation.field} = await this.client.${this.toCamelCase(relation.target)}.findFirst({`)
          lines.push(`        where: { ${relation.foreignKey}: document.id },`)
          lines.push(`        include: typeof include.${relation.field} === 'object' ? include.${relation.field} : undefined`)
          lines.push(`      })`)
          lines.push(`      result.${relation.field} = ${relation.field}`)
          lines.push(`    }`)
          break;
        case 'manyToMany':
          lines.push(`    // Relation: ${relation.field} (manyToMany) - TODO: implement manyToMany relation loading`)
          lines.push(`    if (include.${relation.field} !== undefined) {`)
          lines.push(`      console.warn('manyToMany relation loading not yet implemented for ${relation.field}')`)
          lines.push(`      result.${relation.field} = []`)
          lines.push(`    }`)
          break;
      }
    }

    if (lines.length === 0) {
      return '';
    }

    return lines.join('\n');
  }

  private toCamelCase(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }
}

export interface GeneratedFiles {
  [filePath: string]: string;
}