import { parse, DocumentNode, ObjectTypeDefinitionNode, TypeNode, EnumTypeDefinitionNode, FieldDefinitionNode } from 'graphql';
import { SchemaValidator } from './SchemaValidator';
import { SchemaParseError } from '../errors';
import { lenzDirectives } from './directives';

export interface GraphQLField {
  name: string;
  type: string;
  isArray: boolean;
  isRequired: boolean;
  isId: boolean;
  isUnique: boolean;
  isRelation: boolean;
  isHidden: boolean;
  relationType?: 'oneToOne' | 'oneToMany' | 'manyToOne' | 'manyToMany';
  relationTo?: string;
  foreignKey: string | undefined;
  directives: string[];
  defaultValue?: any;
  relationStrategy?: 'populate' | 'lookup';
  relationIndex?: boolean;
}

export interface GraphQLModel {
  name: string;
  fields: GraphQLField[];
  collectionName: string;
  relations: ModelRelation[];
  indexes: ModelIndex[];
  isEmbedded: boolean;
}

export interface ModelRelation {
  type: 'oneToOne' | 'oneToMany' | 'manyToOne' | 'manyToMany';
  field: string;
  target: string;
  foreignKey: string | undefined;
  foreignKeyLocation: 'source' | 'target' | undefined;
  joinCollection: string | undefined;
  strategy: 'populate' | 'lookup';
  index: boolean;
}

export interface ModelIndex {
  fields: string[];
  unique: boolean;
  sparse?: boolean;
}

export interface GraphQLEnum {
  name: string;
  values: string[];
}

export class GraphQLParser {
  private ast: DocumentNode;
  private models = new Map<string, GraphQLModel>();
  private enums = new Map<string, GraphQLEnum>();
  private relations: ModelRelation[] = [];
  private allModelNames = new Set<string>();

  constructor(schemaSDL: string) {
    try {
      this.ast = parse(schemaSDL);

      // Проверка на определения директив Lenz в схеме (для обратной совместимости)
      const hasLenzDirectiveDefinitions = this.ast.definitions.some(def =>
        def.kind === 'DirectiveDefinition' &&
        lenzDirectives.some(d => d.name === def.name.value)
      );

      if (hasLenzDirectiveDefinitions) {
        console.warn('⚠️  Schema contains Lenz directive definitions. ' +
          'Directives are now defined in the library code. ' +
          'You can safely remove directive definitions from your schema file.');
      }

      this.parseEnums();
      this.parseModels();
      this.analyzeRelationships();
    } catch (error) {
      if (error instanceof Error) {
        throw new SchemaParseError(
          `Failed to parse GraphQL schema: ${error.message}`,
          { originalError: error, schemaSDL }
        );
      }
      throw error;
    }
  }

  private parseEnums(): void {
    const enumTypes = this.ast.definitions.filter(
      (def): def is EnumTypeDefinitionNode =>
        def.kind === 'EnumTypeDefinition'
    );

    for (const enumDef of enumTypes) {
      this.enums.set(enumDef.name.value, {
        name: enumDef.name.value,
        values: enumDef.values?.map(v => v.name.value) || []
      });
    }
  }

  private parseModels(): void {
    const objectTypes = this.ast.definitions.filter(
      (def): def is ObjectTypeDefinitionNode =>
        def.kind === 'ObjectTypeDefinition' &&
        !['Query', 'Mutation', 'Subscription'].includes(def.name.value)
    );

    // Собираем имена всех моделей для определения отношений
    this.allModelNames.clear();
    for (const typeDef of objectTypes) {
      this.allModelNames.add(typeDef.name.value);
    }

    for (const typeDef of objectTypes) {
      const modelName = typeDef.name.value;
      const fields: GraphQLField[] = [];
      const indexes: ModelIndex[] = [];
      const directives = typeDef.directives?.map(d => d.name.value) || [];
      const isEmbedded = directives.includes('embedded');

      if (typeDef.fields) {
        for (const field of typeDef.fields) {
          const fieldType = this.parseFieldType(field.type);
          const fieldDirectives = field.directives?.map(d => d.name.value) || [];

          const isRelation = this.isModelType(fieldType.baseType);

          const relationData = this.parseRelationDirective(field);
          const graphQLField: GraphQLField = {
            name: field.name.value,
            type: fieldType.baseType,
            isArray: fieldType.isArray,
            isRequired: fieldType.isRequired,
            isId: fieldDirectives.includes('id') || field.name.value === 'id',
            isUnique: fieldDirectives.includes('unique'),
            isRelation,
            isHidden: fieldDirectives.includes('hide'),
            directives: fieldDirectives,
            defaultValue: this.getDefaultValue(fieldDirectives, field),
            foreignKey: relationData.field ?? this.getRelationField(fieldDirectives, field),
            relationStrategy: relationData.strategy ?? 'populate',
            relationIndex: relationData.index ?? true
          };

          fields.push(graphQLField);

          if (fieldDirectives.includes('unique')) {
            indexes.push({
              fields: [field.name.value],
              unique: true
            });
          }

          if (fieldDirectives.includes('index')) {
            indexes.push({
              fields: [field.name.value],
              unique: false
            });
          }
        }
      }

      this.models.set(modelName, {
        name: modelName,
        fields,
        collectionName: isEmbedded ? '' : this.toCollectionName(modelName),
        relations: [],
        indexes,
        isEmbedded
      });
    }
  }

  private parseFieldType(typeNode: TypeNode): {
    baseType: string;
    isArray: boolean;
    isRequired: boolean;
  } {
    let current = typeNode;
    let isArray = false;
    let isRequired = false;

    while (true) {
      switch (current.kind) {
        case 'NonNullType':
          isRequired = true;
          current = current.type;
          break;
        case 'ListType':
          isArray = true;
          current = current.type;
          break;
        case 'NamedType':
          return {
            baseType: current.name.value,
            isArray,
            isRequired
          };
      }
    }
  }

  private parseRelationDirective(fieldNode: FieldDefinitionNode): {
    field?: string;
    strategy?: 'populate' | 'lookup';
    index?: boolean
  } {
    const result: { field?: string; strategy?: 'populate' | 'lookup'; index?: boolean } = {};
    const relationDirective = fieldNode.directives?.find(d => d.name.value === 'relation');
    if (relationDirective?.arguments) {
      for (const arg of relationDirective.arguments) {
        if (arg.name.value === 'field' && arg.value.kind === 'StringValue') {
          result.field = arg.value.value;
        } else if (arg.name.value === 'strategy' && arg.value.kind === 'StringValue') {
          if (arg.value.value === 'populate' || arg.value.value === 'lookup') {
            result.strategy = arg.value.value;
          }
        } else if (arg.name.value === 'index' && arg.value.kind === 'BooleanValue') {
          result.index = arg.value.value;
        }
      }
    }
    return result;
  }

  private isModelType(typeName: string): boolean {
    // Проверяем по всем именам моделей (включая еще не обработанные)
    return this.allModelNames.has(typeName) || this.allModelNames.has(typeName.replace(/\[\]!/, ''));
  }

  private getDefaultValue(directives: string[], fieldNode?: FieldDefinitionNode): any {
    // Пробуем извлечь значение из AST узла директивы (новый способ)
    if (fieldNode?.directives) {
      const defaultDirective = fieldNode.directives.find(d => d.name.value === 'default');
      if (defaultDirective?.arguments) {
        const valueArg = defaultDirective.arguments.find(arg => arg.name.value === 'value');
        if (valueArg?.value.kind === 'StringValue') {
          try {
            return JSON.parse(valueArg.value.value);
          } catch {
            return valueArg.value.value;
          }
        }
      }
    }

    // Fallback для обратной совместимости (старый способ через регулярное выражение)
    const defaultDirective = directives.find(d => d.startsWith('default'));
    if (defaultDirective) {
      // Извлекаем значение из директивы @default(value: "...")
      const match = defaultDirective.match(/default\(value:\s*"([^"]+)"\)/);
      if (match) {
        const value = match[1];
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
    }
    return undefined;
  }

  private getRelationField(directives: string[], fieldNode?: FieldDefinitionNode): string | undefined {
    // Пробуем извлечь значение из AST узла директивы
    if (fieldNode?.directives) {
      const relationDirective = fieldNode.directives.find(d => d.name.value === 'relation');
      if (relationDirective?.arguments) {
        const fieldArg = relationDirective.arguments.find(arg => arg.name.value === 'field');
        if (fieldArg?.value.kind === 'StringValue') {
          return fieldArg.value.value;
        }
      }
    }

    // Fallback для обратной совместимости (старый способ через регулярное выражение)
    const relationDirective = directives.find(d => d.startsWith('relation'));
    if (relationDirective) {
      // Извлекаем значение из директивы @relation(field: "...")
      const match = relationDirective.match(/relation\(field:\s*"([^"]+)"\)/);
      if (match) {
        return match[1];
      }
    }
    return undefined;
  }

  private analyzeRelationships(): void {
    for (const [modelName, model] of this.models) {
      // Пропускаем embedded модели для анализа отношений
      if (model.isEmbedded) continue;

      for (const field of model.fields) {
        if (field.isRelation && this.models.has(field.type)) {
          const targetModel = this.models.get(field.type);
          // Пропускаем отношения с embedded моделями
          if (targetModel?.isEmbedded) continue;

          const relation = this.determineRelationType(modelName, field);
          if (relation) {
            model.relations.push(relation);
            this.relations.push(relation);

            // Add index for foreign key field if relation.index is true
            if (relation.index && relation.foreignKey && relation.foreignKeyLocation === 'source') {
              // Check if index already exists for this field
              const existingIndex = model.indexes.find(idx =>
                idx.fields.length === 1 && idx.fields[0] === relation.foreignKey
              );
              if (!existingIndex) {
                model.indexes.push({
                  fields: [relation.foreignKey],
                  unique: false,
                  sparse: relation.type === 'oneToOne' || relation.type === 'manyToOne' ? true : false
                });
              }
            }
          }
        }
      }
    }
  }

  private getJoinCollectionName(model1: string, model2: string): string {
    // Сортируем имена моделей лексикографически для консистентности
    const [first, second] = [model1.toLowerCase(), model2.toLowerCase()].sort();
    return `${first}_${second}`;
  }



  private determineRelationType(modelName: string, field: GraphQLField): ModelRelation | null {
    const targetModel = this.models.get(field.type);
    if (!targetModel) return null;

    // Определяем тип отношения на основе структуры поля
    let relationType: 'oneToMany' | 'manyToOne' | 'oneToOne' | 'manyToMany';
    let foreignKey: string | undefined = field.foreignKey;
    let foreignKeyLocation: 'source' | 'target' = 'source';
    let joinCollection: string | undefined = undefined;

    if (field.isArray) {
      // Массив может быть oneToMany или manyToMany
      if (foreignKey && foreignKey.endsWith('Ids')) {
        relationType = 'oneToMany';
      } else {
        // manyToMany отношение требует join-коллекции
        relationType = 'manyToMany';
        joinCollection = this.getJoinCollectionName(modelName, field.type);
        foreignKey = undefined; // для manyToMany foreignKey не используется
      }
    } else {
      // Одиночное поле - manyToOne или oneToOne
      relationType = foreignKey && foreignKey.endsWith('Id') ? 'manyToOne' : 'oneToOne';
    }

    // Автоматическая генерация foreign key если не указан
    if (!foreignKey && relationType !== 'manyToMany') {
      if (relationType === 'oneToMany') {
        foreignKey = `${targetModel.name.toLowerCase()}Ids`;
      } else {
        // manyToOne или oneToOne
        foreignKey = `${targetModel.name.toLowerCase()}Id`;
      }
    }

    // Автоматическое определение стратегии по умолчанию на основе типа отношения
    let defaultStrategy: 'populate' | 'lookup' = 'populate';
    if (relationType === 'oneToMany') {
      // Двусторонние связи с массивами ID (например, Author.bookIds) используют lookup
      defaultStrategy = 'lookup';
    } else if (relationType === 'manyToMany') {
      // manyToMany пока не поддерживает lookup (требует join-коллекции)
      defaultStrategy = 'populate';
    }
    // manyToOne и oneToOne используют populate по умолчанию

    const relation: ModelRelation = {
      type: relationType,
      field: field.name,
      target: field.type,
      foreignKey,
      foreignKeyLocation,
      joinCollection,
      strategy: field.relationStrategy ?? defaultStrategy,
      index: field.relationIndex ?? true
    };

    return relation;
  }

  private toCollectionName(modelName: string): string {
    return modelName.toLowerCase() + 's';
  }

  getModels(): GraphQLModel[] {
    return Array.from(this.models.values());
  }

  getModel(name: string): GraphQLModel | undefined {
    return this.models.get(name);
  }

  getEnums(): GraphQLEnum[] {
    return Array.from(this.enums.values());
  }

  getEnum(name: string): GraphQLEnum | undefined {
    return this.enums.get(name);
  }

  getRelations(): ModelRelation[] {
    return this.relations;
  }

  getSchemaInfo() {
    return {
      models: this.getModels(),
      enums: this.getEnums(),
      relations: this.getRelations(),
      modelCount: this.models.size,
      enumCount: this.enums.size,
      relationCount: this.relations.length
    };
  }

  /**
   * Validate the parsed schema
   * @throws {SchemaValidationError} If schema validation fails
   */
  validate(): void {
    const validator = new SchemaValidator(
      this.getModels(),
      this.getEnums(),
      this.getRelations()
    );
    validator.validate({
      validateRelations: true,
      checkCircularDependencies: false  // Disabled because circular dependencies are allowed in relationships
    });

    // Log warnings
    const warnings = validator.getWarnings();
    if (warnings.length > 0) {
      console.warn('⚠️  Schema validation warnings:');
      warnings.forEach(warning => console.warn(`   ${warning}`));
    }
  }
}