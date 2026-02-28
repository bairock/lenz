import { GraphQLParser } from './GraphQLParser';
import { CodeGenerator, GenerateOptions as CodeGenOptions } from './CodeGenerator';
import { promises as fs, existsSync } from 'fs';
import { join, dirname } from 'path';
import chalk from 'chalk';
import {
  SchemaValidationError,
  SchemaParseError,
  CodeGenerationError,
  ConfigurationError
} from '../errors';

export interface GenerateOptions {
  schemaPath: string;
  outputPath: string;
  clientName?: string;
}

export class LenzEngine {
  private parser: GraphQLParser | null = null;
  private generator: CodeGenerator;

  constructor(private options: GenerateOptions) {
    this.generator = new CodeGenerator();
  }

  async generate(): Promise<void> {
    try {
      console.log(chalk.blue('🚀 Starting Lenz code generation...'));

      // 1. Load and parse schema
      console.log(chalk.blue(`📄 Loading schema from: ${this.options.schemaPath}`));

      if (!existsSync(this.options.schemaPath)) {
        throw new ConfigurationError(
          `Schema file not found: ${this.options.schemaPath}`,
          { schemaPath: this.options.schemaPath }
        );
      }

      const schemaSDL = await fs.readFile(this.options.schemaPath, 'utf-8');
      this.parser = new GraphQLParser(schemaSDL);

      // Validate schema
      console.log(chalk.blue('🔍 Validating schema...'));
      this.parser.validate();

      const schemaInfo = this.parser.getSchemaInfo();
      console.log(chalk.blue(`📊 Found ${schemaInfo.modelCount} models, ${schemaInfo.enumCount} enums, ${schemaInfo.relationCount} relations`));

      // 2. Create output directory structure
      await this.ensureDirectoryStructure(this.options.outputPath);

      // 3. Generate code
      const codeGenOptions: CodeGenOptions = {
        models: schemaInfo.models,
        enums: schemaInfo.enums,
        relations: schemaInfo.relations,
        outputPath: this.options.outputPath,
        clientName: this.options.clientName || 'LenzClient'
      };

      const generatedFiles = this.generator.generate(codeGenOptions);

      // 4. Write files
      let fileCount = 0;
      for (const [filePath, content] of Object.entries(generatedFiles)) {
        const fullPath = join(this.options.outputPath, filePath);
        await this.ensureDirectoryStructure(dirname(fullPath));
        await fs.writeFile(fullPath, content, 'utf-8');
        fileCount++;
      }

      // 5. Generate package.json for the client
      await this.generateClientPackageJson();

      console.log(chalk.green(`✅ Generated ${fileCount} files to ${this.options.outputPath}`));
      console.log(chalk.green('✨ Client is ready to use!'));

    } catch (error) {
      console.log(chalk.red('❌ Generation failed:'));

      // Check if it's already a LenzError
      const isLenzError = error instanceof SchemaValidationError || error instanceof SchemaParseError ||
          error instanceof CodeGenerationError || error instanceof ConfigurationError;

      if (isLenzError) {
        console.log(chalk.red(`   ${error.code}: ${error.message}`));
        if (error.details) {
          console.log(chalk.gray('   Details:', JSON.stringify(error.details, null, 2)));
        }
        throw error;
      } else {
        // Wrap generic errors
        const generationError = new CodeGenerationError(
          error instanceof Error ? error.message : String(error),
          { originalError: error }
        );
        console.log(chalk.red(`   ${generationError.code}: ${generationError.message}`));
        throw generationError;
      }
    }
  }

  private async ensureDirectoryStructure(path: string): Promise<void> {
    if (!existsSync(path)) {
      await fs.mkdir(path, { recursive: true });
    }
  }

  private async generateClientPackageJson(): Promise<void> {
    const packageJson = {
      name: 'lenz-client',
      version: '1.0.0',
      type: 'module',
      main: './index.js',
      types: './index.d.ts',
      dependencies: {
        mongodb: '^6.0.0'
      },
      exports: {
        '.': {
          import: './index.js',
          types: './index.d.ts'
        },
        './runtime': {
          import: './runtime/index.js',
          types: './runtime/index.d.ts'
        }
      }
    };

    const packageJsonPath = join(this.options.outputPath, 'package.json');
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');
  }

  getSchemaInfo() {
    return this.parser?.getSchemaInfo();
  }
}