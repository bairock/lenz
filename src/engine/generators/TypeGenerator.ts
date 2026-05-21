import { GraphQLModel, GraphQLEnum } from '../GraphQLParser.js';
import { mapToTSType, getScalarFilterType, getScalarArrayFilterType } from './helpers.js';

export class TypeGenerator {
  generateFilterTypes(): string {
    return `// Scalar filter types for type-safe queries
export interface StringFilter {
  equals?: string
  not?: string
  in?: string[]
  notIn?: string[]
  lt?: string
  lte?: string
  gt?: string
  gte?: string
  contains?: string
  startsWith?: string
  endsWith?: string
  mode?: 'default' | 'insensitive'
}

export interface IntFilter {
  equals?: number
  not?: number
  in?: number[]
  notIn?: number[]
  lt?: number
  lte?: number
  gt?: number
  gte?: number
}

export interface FloatFilter {
  equals?: number
  not?: number
  in?: number[]
  notIn?: number[]
  lt?: number
  lte?: number
  gt?: number
  gte?: number
}

export interface BooleanFilter {
  equals?: boolean
  not?: boolean
}

export interface DateTimeFilter {
  equals?: Date | string
  not?: Date | string
  in?: (Date | string)[]
  notIn?: (Date | string)[]
  lt?: Date | string
  lte?: Date | string
  gt?: Date | string
  gte?: Date | string
}

export interface IDFilter {
  equals?: string
  not?: string
  in?: string[]
  notIn?: string[]
}

export interface JsonFilter {
  equals?: any
  not?: any
  path?: string[]
  string_contains?: string
  string_starts_with?: string
  string_ends_with?: string
  array_contains?: any
  array_starts_with?: any
  array_ends_with?: any
}

export interface StringNullableFilter {
  equals?: string | null
  not?: string | null
  in?: (string | null)[]
  notIn?: (string | null)[]
  lt?: string
  lte?: string
  gt?: string
  gte?: string
  contains?: string
  startsWith?: string
  endsWith?: string
  mode?: 'default' | 'insensitive'
}

export interface IntNullableFilter {
  equals?: number | null
  not?: number | null
  in?: (number | null)[]
  notIn?: (number | null)[]
  lt?: number
  lte?: number
  gt?: number
  gte?: number
}

export interface FloatNullableFilter {
  equals?: number | null
  not?: number | null
  in?: (number | null)[]
  notIn?: (number | null)[]
  lt?: number
  lte?: number
  gt?: number
  gte?: number
}

export interface BooleanNullableFilter {
  equals?: boolean | null
  not?: boolean | null
}

export interface DateTimeNullableFilter {
  equals?: Date | string | null
  not?: Date | string | null
  in?: (Date | string | null)[]
  notIn?: (Date | string | null)[]
  lt?: Date | string
  lte?: Date | string
  gt?: Date | string
  gte?: Date | string
}

// Scalar array filter types (for fields like String[], Int[], etc.)
export interface StringArrayFilter {
  has?: string
  hasEvery?: string[]
  hasSome?: string[]
  isEmpty?: boolean
  equals?: string[]
}

export interface IntArrayFilter {
  has?: number
  hasEvery?: number[]
  hasSome?: number[]
  isEmpty?: boolean
  equals?: number[]
}

export interface FloatArrayFilter {
  has?: number
  hasEvery?: number[]
  hasSome?: number[]
  isEmpty?: boolean
  equals?: number[]
}

export interface DateTimeArrayFilter {
  has?: Date | string
  hasEvery?: (Date | string)[]
  hasSome?: (Date | string)[]
  isEmpty?: boolean
  equals?: (Date | string)[]
}

export interface EnumFilter {
  equals?: string
  not?: string
  in?: string[]
  notIn?: string[]
}`;
  }

  generateModelWhereInput(model: GraphQLModel, allModels: GraphQLModel[]): string {
    const fields: string[] = [];
    fields.push(`  id?: string | IDFilter`);

    for (const field of model.fields) {
      if (field.isId) continue;
      if (field.isIgnored) continue;
      const isCrossCollectionRelation = field.isRelation && !allModels.find(m => m.name === field.type && m.isEmbedded);
      if (isCrossCollectionRelation) continue;

      const embeddedModel = allModels.find(m => m.name === field.type && m.isEmbedded);
      if (embeddedModel) {
        if (field.isArray) {
          fields.push(`  ${field.name}?: { some?: ${embeddedModel.name}WhereInput; every?: ${embeddedModel.name}WhereInput; none?: ${embeddedModel.name}WhereInput }`);
        } else {
          fields.push(`  ${field.name}?: ${embeddedModel.name}WhereInput | any`);
        }
        continue;
      }

      if (field.isArray && !field.isRelation) {
        const filterType = getScalarArrayFilterType(field.type);
        const req = field.isRequired ? '' : '?';
        fields.push(`  ${field.name}${req}: ${filterType}`);
        continue;
      }

      const filterType = getScalarFilterType(field.type, field.isRequired);
      const req = field.isRequired ? '' : '?';
      fields.push(`  ${field.name}${req}: ${filterType}`);
    }

    fields.push(`  AND?: ${model.name}WhereInput[]`);
    fields.push(`  OR?: ${model.name}WhereInput[]`);
    fields.push(`  NOT?: ${model.name}WhereInput[]`);

    for (const rel of model.relations) {
      const targetModel = allModels.find(m => m.name === rel.target);
      if (targetModel && !targetModel.isEmbedded) {
        if (rel.type === 'oneToMany' || rel.type === 'manyToMany') {
          fields.push(`  ${rel.field}?: { some?: ${rel.target}WhereInput; every?: ${rel.target}WhereInput; none?: ${rel.target}WhereInput }`);
        } else {
          fields.push(`  ${rel.field}?: { is?: ${rel.target}WhereInput; isNot?: ${rel.target}WhereInput }`);
        }
      }
    }

    if (model.fulltextFields && model.fulltextFields.length > 0) {
      fields.push(`  search?: string`);
    }

    return `export interface ${model.name}WhereInput {
${fields.join('\n')}
}`;
  }

  generateModelWhereUniqueInput(model: GraphQLModel): string {
    const uniqueFields = model.fields.filter(f => !f.isIgnored && (f.isId || f.isUnique));
    if (uniqueFields.length === 0) {
      return `export type ${model.name}WhereUniqueInput = Pick<${model.name}WhereInput, 'id'>`;
    }
    const fields = uniqueFields.map(f => {
      const tsType = mapToTSType(f.type, f.isArray);
      return `  ${f.name}?: ${tsType}`;
    });
    return `export interface ${model.name}WhereUniqueInput {
${fields.join('\n')}
}`;
  }

  generateModelSelectInput(model: GraphQLModel, allModels: GraphQLModel[]): string {
    const fields: string[] = [];
    fields.push(`  id?: boolean`);

    for (const field of model.fields) {
      if (field.isId && field.name === 'id') continue;
      if (field.isIgnored) continue;
      const embeddedModel = allModels.find(m => m.name === field.type && m.isEmbedded);
      if (embeddedModel) {
        fields.push(`  ${field.name}?: boolean | ${field.type}Select`);
      } else if (field.isRelation) {
        const relatedModel = allModels.find(m => m.name === field.type && !m.isEmbedded);
        if (relatedModel) {
          fields.push(`  ${field.name}?: boolean | ${field.type}Select`);
        } else {
          fields.push(`  ${field.name}?: boolean`);
        }
      } else {
        fields.push(`  ${field.name}?: boolean`);
      }
    }

    const relationFields = model.relations.filter(r => r.strategy === 'populate');
    if (relationFields.length > 0) {
      fields.push(`  _count?: {`);
      fields.push(`    select: {`);
      for (const rel of relationFields) {
        fields.push(`      ${rel.field}?: boolean`);
      }
      fields.push(`    }`);
      fields.push(`  }`);
    }

    return `export interface ${model.name}Select {
${fields.join('\n')}
}`;
  }

  generateModelIncludeInput(model: GraphQLModel, allModels: GraphQLModel[]): string {
    if (model.relations.length === 0) {
      return `export type ${model.name}Include = Record<string, never>`;
    }

    const fields: string[] = [];
    for (const rel of model.relations) {
      const relatedModel = allModels.find(m => m.name === rel.target);
      if (relatedModel) {
        const hasRelations = relatedModel.relations.length > 0;
        if (hasRelations) {
          fields.push(`  ${rel.field}?: boolean | ${rel.target}Include`);
        } else {
          fields.push(`  ${rel.field}?: boolean`);
        }
      } else {
        fields.push(`  ${rel.field}?: boolean`);
      }
    }

    const countableRelations = model.relations.filter(r => !r.joinCollection);
    if (countableRelations.length > 0) {
      fields.push(`  _count?: {`);
      fields.push(`    select?: {`);
      for (const rel of countableRelations) {
        fields.push(`      ${rel.field}?: boolean`);
      }
      fields.push(`    }`);
      fields.push(`  }`);
    }

    return `export interface ${model.name}Include {
${fields.join('\n')}
}`;
  }

  generateModelType(model: GraphQLModel): string {
    const modelDoc = model.description ? `/** ${model.description} */\n` : '';
    return `${modelDoc}export interface ${model.name} {
  id: string
${model.fields.filter(f => !f.isId).map(field => {
  const tsType = mapToTSType(field.type, field.isArray);
  const fieldDoc = field.description ? `  /** ${field.description} */\n` : '';
  return `${fieldDoc}  ${field.name}${field.isRequired ? '' : '?'}: ${tsType}`;
}).join('\n')}
}

export interface ${model.name}CreateInput {
${model.fields.filter(f => !f.isId && !f.isIgnored && !f.isRelation && !f.directives.includes('@generated')).map(field => {
  const tsType = mapToTSType(field.type, field.isArray);
  const fieldDoc = field.description ? `  /** ${field.description} */\n` : '';
  return `${fieldDoc}  ${field.name}${field.isRequired ? '' : '?'}: ${tsType}`;
}).join('\n')}
${model.relations.filter(r => !r.joinCollection).map(rel => {
  const isToMany = rel.type === 'oneToMany' || rel.type === 'manyToMany';
  if (isToMany) {
    return `  ${rel.field}?: { create?: ${rel.target}CreateInput[]; connect?: { id: string }[]; connectOrCreate?: { where: { id: string }; create: ${rel.target}CreateInput }[] }`;
  } else {
    return `  ${rel.field}?: { create?: ${rel.target}CreateInput; connect?: { id: string }; connectOrCreate?: { where: { id: string }; create: ${rel.target}CreateInput } }`;
  }
}).join('\n')}
}

export interface ${model.name}UpdateInput {
${model.fields.filter(f => !f.isId && !f.isIgnored && !f.isRelation).map(field => {
  const tsType = mapToTSType(field.type, field.isArray);
  const fieldDoc = field.description ? `  /** ${field.description} */\n` : '';
  return `${fieldDoc}  ${field.name}?: ${tsType}`;
}).join('\n')}
${model.relations.filter(r => !r.joinCollection).map(rel => {
  const isToMany = rel.type === 'oneToMany' || rel.type === 'manyToMany';
  if (isToMany) {
    return `  ${rel.field}?: { create?: ${rel.target}CreateInput[]; connect?: { id: string }[]; connectOrCreate?: { where: { id: string }; create: ${rel.target}CreateInput }[]; disconnect?: { id: string }[]; set?: { id: string }[]; update?: { where: { id: string }; data: ${rel.target}UpdateInput }[]; delete?: { id: string }[]; upsert?: { where: { id: string }; update: ${rel.target}UpdateInput; create: ${rel.target}CreateInput }[]; updateMany?: { where: ${rel.target}WhereInput; data: ${rel.target}UpdateInput }[]; deleteMany?: ${rel.target}WhereInput }`;
  } else {
    return `  ${rel.field}?: { create?: ${rel.target}CreateInput; connect?: { id: string }; connectOrCreate?: { where: { id: string }; create: ${rel.target}CreateInput }; disconnect?: boolean; update?: ${rel.target}UpdateInput; delete?: boolean; upsert?: { where: { id: string }; update: ${rel.target}UpdateInput; create: ${rel.target}CreateInput } }`;
  }
}).join('\n')}
}`;
  }

  generateModelOrderByInput(model: GraphQLModel): string {
    const sortableFields = model.fields.filter(f => !f.isRelation && !f.isIgnored && f.type !== 'Json');
    const fields = sortableFields.map(f => `  ${f.name}?: 'asc' | 'desc' | 1 | -1`);
    return `export interface ${model.name}OrderByInput {
${fields.join('\n')}
}`;
  }

  generateModelGroupByTypes(model: GraphQLModel): string {
    const aggFields = model.fields.filter(f =>
      !f.isIgnored && ['Int', 'Float'].includes(f.type)
    );
    const scalarFields = model.fields.filter(f => !f.isIgnored && !f.isRelation && !f.isId);
    const byFields = model.fields.filter(f => !f.isIgnored && !f.isRelation);

    return `export type ${model.name}GroupByScalar =
${byFields.map(f => `  | '${f.name}'`).join('\n')}

export interface ${model.name}GroupByArgs {
  by: ${model.name}GroupByScalar[]
  where?: ${model.name}WhereInput
  _count?: boolean | ${model.name}GroupByScalar[]
  _sum?: ${model.name}GroupByScalar[]
  _avg?: ${model.name}GroupByScalar[]
  _min?: ${model.name}GroupByScalar[]
  _max?: ${model.name}GroupByScalar[]
  orderBy?: ${model.name}OrderByInput | ${model.name}OrderByInput[]
  having?: any
  skip?: number
  take?: number
  session?: any
}

export interface ${model.name}GroupByResult {
${byFields.map(f => {
  const tsType = mapToTSType(f.type, f.isArray);
  return `  ${f.name}: ${tsType}`;
}).join('\n')}
${aggFields.length > 0 ? `  _sum: {${aggFields.map(f => `\n    ${f.name}: number`).join(',')}
  }
  _avg: {${aggFields.map(f => `\n    ${f.name}: number`).join(',')}
  }
  _min: {${scalarFields.map(f => `\n    ${f.name}: ${mapToTSType(f.type, f.isArray)} | null`).join(',')}
  }
  _max: {${scalarFields.map(f => `\n    ${f.name}: ${mapToTSType(f.type, f.isArray)} | null`).join(',')}
  }
  _count: {${scalarFields.map(f => `\n    ${f.name}: number`).join(',')}
  }` : ''}
}`;
  }

  generateModelAggregateTypes(model: GraphQLModel): string {
    const aggFields = model.fields.filter(f =>
      !f.isIgnored && ['Int', 'Float'].includes(f.type)
    );
    const scalarFields = model.fields.filter(f => !f.isIgnored && !f.isRelation && !f.isId);
    const byFields = model.fields.filter(f => !f.isIgnored && !f.isRelation);

    const aggScalarType = byFields.map(f => `  | '${f.name}'`).join('\n');

    return `export type ${model.name}AggregateScalar =
${aggScalarType}

export interface ${model.name}AggregateArgs {
  where?: ${model.name}WhereInput
  orderBy?: ${model.name}OrderByInput | ${model.name}OrderByInput[]
  _count?: boolean | ${model.name}AggregateScalar[]
  _sum?: ${model.name}AggregateScalar[]
  _avg?: ${model.name}AggregateScalar[]
  _min?: ${model.name}AggregateScalar[]
  _max?: ${model.name}AggregateScalar[]
  session?: any
}

export interface ${model.name}AggregateResult {
${aggFields.length > 0 ? `  _sum?: {${aggFields.map(f => `\n    ${f.name}: number | null`).join(',')}
  }
  _avg?: {${aggFields.map(f => `\n    ${f.name}: number | null`).join(',')}
  }
  _min?: {${scalarFields.map(f => `\n    ${f.name}: ${mapToTSType(f.type, f.isArray)} | null`).join(',')}
  }
  _max?: {${scalarFields.map(f => `\n    ${f.name}: ${mapToTSType(f.type, f.isArray)} | null`).join(',')}
  }
  _count?: {${scalarFields.map(f => `\n    ${f.name}: number`).join(',')}
  }` : ''}
}`;
  }

  generateModelArgTypes(model: GraphQLModel): string {
    const hasRelations = model.relations.length > 0;
    const includeType = hasRelations ? `${model.name}Include` : 'Record<string, never>';

    return `${this.generateModelGroupByTypes(model)}

${this.generateModelOrderByInput(model)}

${this.generateModelAggregateTypes(model)}

export interface ${model.name}FindManyArgs {
  where?: ${model.name}WhereInput
  select?: ${model.name}Select
  include?: ${includeType}
  omit?: ${model.name}Select
  skip?: number
  take?: number
  orderBy?: ${model.name}OrderByInput | ${model.name}OrderByInput[]
  distinct?: string | string[]
  cursor?: string | ObjectId
  session?: any
}

export interface ${model.name}FindUniqueArgs {
  where: ${model.name}WhereUniqueInput
  select?: ${model.name}Select
  include?: ${includeType}
  session?: any
}

export interface ${model.name}FindUniqueOrThrowArgs extends ${model.name}FindUniqueArgs {}

export interface ${model.name}FindFirstArgs extends ${model.name}FindManyArgs {}

export interface ${model.name}FindFirstOrThrowArgs extends ${model.name}FindFirstArgs {}

export interface ${model.name}CreateArgs {
  data: ${model.name}CreateInput
  select?: ${model.name}Select
  include?: ${includeType}
  session?: any
}

export interface ${model.name}UpdateArgs {
  where: ${model.name}WhereInput
  data: ${model.name}UpdateInput
  select?: ${model.name}Select
  include?: ${includeType}
  session?: any
}

export interface ${model.name}DeleteArgs {
  where: ${model.name}WhereInput
  select?: ${model.name}Select
  include?: ${includeType}
  session?: any
}

export interface ${model.name}UpsertArgs {
  where: ${model.name}WhereInput
  create: ${model.name}CreateInput
  update: ${model.name}UpdateInput
  select?: ${model.name}Select
  include?: ${includeType}
  session?: any
}

export type ${model.name}QueryOptions = ${model.name}FindManyArgs`;
  }

  generateTypes(models: GraphQLModel[], enums: GraphQLEnum[]): string {
    const nonEmbeddedModels = models.filter(m => !m.isEmbedded);

    return `// This file was auto-generated by Lenz. Do not edit manually.
// @generated

import { ObjectId } from 'mongodb'

// Base types
export type ScalarType = 'String' | 'Int' | 'Float' | 'Boolean' | 'ID' | 'DateTime' | 'Date' | 'Json' | 'ObjectId'
export type RelationType = 'oneToOne' | 'oneToMany' | 'manyToOne' | 'manyToMany'

// ===== Scalar Filter Types =====
${this.generateFilterTypes()}

// ===== Enum types =====
${enums.map(e => `
export enum ${e.name} {
  ${e.values.map(v => `${v} = '${v}'`).join(',\n  ')}
}`).join('\n\n')}

// ===== Model Types =====
${models.map(model => this.generateModelType(model)).join('\n\n')}

// ===== Per-Model WhereInput =====
${models.map(model => this.generateModelWhereInput(model, models)).join('\n\n')}

// ===== Per-Model WhereUniqueInput =====
${models.map(model => this.generateModelWhereUniqueInput(model)).join('\n\n')}

// ===== Per-Model SelectInput =====
${models.map(model => this.generateModelSelectInput(model, models)).join('\n\n')}

// ===== Per-Model IncludeInput =====
${models.map(model => this.generateModelIncludeInput(model, models)).join('\n\n')}

// ===== Per-Model Arg Types =====
${nonEmbeddedModels.map(model => this.generateModelArgTypes(model)).join('\n\n')}

// ===== Shared Utility Types =====

export interface OrderByInput {
  [key: string]: 'asc' | 'desc' | 1 | -1
}

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

export interface OffsetPaginationArgs<T = any> {
  where?: T
  skip?: number
  take?: number
  orderBy?: OrderByInput | OrderByInput[]
  page?: number
  perPage?: number
}

export interface CursorPaginationArgs<T = any> {
  where?: T
  take?: number
  skip?: number
  orderBy?: OrderByInput | OrderByInput[]
  cursor?: string | ObjectId
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
  schemaPath?: string
  log?: ('query' | 'error' | 'warn' | 'info')[]
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

  generateEnums(enums: GraphQLEnum[]): string {
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
}
