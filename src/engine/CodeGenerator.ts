import { GraphQLModel, GraphQLEnum, ModelRelation } from './GraphQLParser.js';
import { compileTypeScriptToJavaScript, convertTypesToJavaScript, convertToDeclaration } from './generators/helpers.js';
import { TypeGenerator } from './generators/TypeGenerator.js';
import { ClientGenerator } from './generators/ClientGenerator.js';
import { DelegateGenerator } from './generators/DelegateGenerator.js';
import { RuntimeGenerator } from './generators/RuntimeGenerator.js';

export interface GenerateOptions {
  models: GraphQLModel[];
  enums: GraphQLEnum[];
  relations: ModelRelation[];
  outputPath: string;
  clientName?: string;
}

export interface GeneratedFiles {
  [filePath: string]: string;
}

export class CodeGenerator {
  private typeGenerator = new TypeGenerator();
  private clientGenerator = new ClientGenerator();
  private delegateGenerator = new DelegateGenerator();
  private runtimeGenerator = new RuntimeGenerator();

  generate(options: GenerateOptions): GeneratedFiles {
    const { models, enums, clientName = 'LenzClient' } = options;
    const nonEmbeddedModels = models.filter(m => !m.isEmbedded);

    const files: GeneratedFiles = {
      'index.ts': this.clientGenerator.generateIndex(clientName),
      'client.ts': this.clientGenerator.generateClient(clientName, nonEmbeddedModels),
      'types.ts': this.typeGenerator.generateTypes(models, enums),
      'enums.ts': this.typeGenerator.generateEnums(enums),
      'runtime/index.ts': this.runtimeGenerator.generateRuntimeIndex(),
      'runtime/query.ts': this.runtimeGenerator.generateRuntimeQuery(),
      'runtime/pagination.ts': this.runtimeGenerator.generateRuntimePagination(),
      'runtime/relations.ts': this.runtimeGenerator.generateRuntimeRelations(),
      'runtime/errors.ts': this.runtimeGenerator.generateRuntimeErrors(),
      'runtime/logger.ts': this.runtimeGenerator.generateRuntimeLogger(),
      'models/index.ts': this.delegateGenerator.generateModelsIndex(nonEmbeddedModels),
      ...this.delegateGenerator.generateModelFiles(nonEmbeddedModels)
    };

    const result: GeneratedFiles = {};
    for (const [filePath, content] of Object.entries(files)) {
      const jsPath = filePath.replace(/\.ts$/, '.js');

      if (filePath === 'types.ts' || filePath === 'enums.ts') {
        result[jsPath] = convertTypesToJavaScript(content);
      } else {
        result[jsPath] = compileTypeScriptToJavaScript(content);
      }

      const dtsPath = filePath.replace(/\.ts$/, '.d.ts');
      result[dtsPath] = convertToDeclaration(content);
    }
    return result;
  }
}
