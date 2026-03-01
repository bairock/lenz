import { parse, DocumentNode, ObjectTypeDefinitionNode, TypeNode, EnumTypeDefinitionNode, FieldDefinitionNode } from 'graphql';
import { SchemaValidator } from './SchemaValidator';
import { SchemaParseError, RelationValidationError } from '../errors';
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
  foreignKey?: string;
  foreignKeyLocation?: 'source' | 'target';
  joinCollection?: string;
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
            foreignKey: this.getRelationField(fieldDirectives, field)
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

    const reverseField = targetModel.fields.find(f =>
      f.isRelation && f.type === modelName
    );

    // Если это отношение, но обратное поле не найдено, выбрасываем ошибку
    if (field.isRelation && !reverseField) {
      // Определяем возможный тип связи на основе текущего поля
      let suggestion = '';
      if (field.isArray) {
        if (field.foreignKey && field.foreignKey.endsWith('Ids')) {
          suggestion = `Это похоже на many-to-many отношение. Добавьте в модель '${field.type}' поле: ${modelName.toLowerCase()}s: [${modelName}!]! @relation(field: "${field.foreignKey}")`;
        } else {
          suggestion = `Это может быть one-to-many отношение. Добавьте в модель '${field.type}' поле: ${modelName.toLowerCase()}: ${modelName}! @relation(field: "${field.name}Id")`;
        }
      } else {
        suggestion = `Это может быть many-to-one или one-to-one отношение. Добавьте в модель '${field.type}' поле: ${modelName.toLowerCase()}s: [${modelName}!]! для one-to-many или ${modelName.toLowerCase()}: ${modelName}! для one-to-one`;
      }

      throw new RelationValidationError(
        `Неполная связь: поле '${field.name}' в модели '${modelName}' ссылается на модель '${field.type}', но обратная связь не определена. ${suggestion}`,
        { modelName, field: field.name, targetModel: field.type }
      );
    }

    // Определяем тип отношения
    const isManyToMany = field.isArray && reverseField?.isArray;
    const isOneToMany = field.isArray && !reverseField?.isArray;
    const isManyToOne = !field.isArray && reverseField?.isArray;
    const isOneToOne = !field.isArray && !reverseField?.isArray;

    // Определяем foreign key: используем значение из директивы @relation(field: "...") если задано,
    // иначе генерируем автоматически по правилам Lenz
    let foreignKey: string | undefined = field.foreignKey;
    if (!foreignKey && !isManyToMany) {
      // Автоматическая генерация по типу отношения
      if (isOneToMany) {
        // oneToMany: foreign key находится в исходной модели как массив ID целевой модели
        foreignKey = `${targetModel.name.toLowerCase()}Ids`;
      } else if (isManyToOne) {
        // manyToOne: foreign key находится в исходной модели как одиночный ID целевой модели
        foreignKey = `${targetModel.name.toLowerCase()}Id`;
      } else if (isOneToOne) {
        // oneToOne: foreign key находится в исходной модели как одиночный ID целевой модели
        foreignKey = `${targetModel.name.toLowerCase()}Id`;
      }
    }


    // Для manyToMany foreignKey не нужен
    if (isManyToMany) {
      return {
        type: 'manyToMany',
        field: field.name,
        target: field.type,
        joinCollection: this.getJoinCollectionName(modelName, field.type)
      };
    }

    // Для остальных типов foreignKey должен быть определен
    if (!foreignKey) {
      // Это не должно происходить, но на всякий случай генерируем
      if (isOneToMany) {
        foreignKey = `${targetModel.name.toLowerCase()}Ids`;
      } else {
        // manyToOne или oneToOne
        foreignKey = `${targetModel.name.toLowerCase()}Id`;
      }
    }

    // Determine foreign key location
    // For all relation types except manyToMany, foreign key must be in source model
    let foreignKeyLocation: 'source' | 'target' = 'source';

    if (foreignKey) {
      if (isManyToOne || isOneToOne || isOneToMany) {
        // For manyToOne, oneToOne, and oneToMany: foreign key must be in source model
        foreignKeyLocation = 'source';
      }
      // manyToMany doesn't have foreign key
    }

    const relation: ModelRelation = {
      type: isOneToMany ? 'oneToMany' : isManyToOne ? 'manyToOne' : 'oneToOne',
      field: field.name,
      target: field.type,
      foreignKey,
      foreignKeyLocation
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