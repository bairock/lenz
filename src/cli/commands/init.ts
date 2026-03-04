import { Command } from 'commander';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import chalk from 'chalk';
import inquirer from 'inquirer';

const DEFAULT_SCHEMA = `# Welcome to Lenz!
# This is your GraphQL schema file.
# Define your models here using GraphQL SDL syntax.

type User @model {
  id: ID! @id
  email: String! @unique
  name: String!
  age: Int
  posts: [Post!]! @relation(field: "authorId")
  createdAt: DateTime! @createdAt
  updatedAt: DateTime! @updatedAt
}

type Post @model {
  id: ID! @id
  title: String!
  content: String
  published: Boolean! @default(value: false)
  author: User! @relation(field: "authorId")
  authorId: ID!
  tags: [String!]
}

# Directives available:
# @model - Marks a type as a database model
# @id - Marks a field as primary key
# @unique - Creates a unique index
# @index - Creates a regular index
# @default(value: "...") - Sets default value
# @relation(field: "...") - Defines relation field
# @createdAt - Auto-sets creation timestamp
# @updatedAt - Auto-updates timestamp`;

const DEFAULT_CONFIG_TS = `import 'dotenv/config'
import { defineConfig } from '@bairock/lenz'

export default defineConfig({
  schema: 'schema.graphql',
  datasource: {
    url: process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp',
  },
  generate: {
    client: {
      output: '../generated/lenz/client',
    },
  },
  log: ['query', 'info', 'warn', 'error'] as const,
  autoCreateCollections: true,
})`;

const DEFAULT_CONFIG_JS = `import 'dotenv/config'
import { defineConfig } from '@bairock/lenz'

export default defineConfig({
  schema: 'schema.graphql',
  datasource: {
    url: process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp',
  },
  generate: {
    client: {
      output: '../generated/lenz/client',
    },
  },
  log: ['query', 'info', 'warn', 'error'],
  autoCreateCollections: true,
});`;


const EXAMPLE_ENV = `# MongoDB connection string (include database name in URL)
MONGODB_URI=mongodb://localhost:27017/myapp

# Log level (debug, info, warn, error)
LOG_LEVEL=info

# Enable query logging
LOG_QUERIES=true`;

export const initCommand = new Command('init')
  .description('Initialize a new Lenz project')
  .option('--skip-prompts', 'Skip interactive prompts')
  .action(async (options) => {
    console.log(chalk.blue('🚀 Initializing Lenz project...\n'));

    const answers = options.skipPrompts ? {} : await inquirer.prompt([
      {
        type: 'input',
        name: 'url',
        message: 'MongoDB URL (include database name):',
        default: 'mongodb://localhost:27017/myapp'
      },
      {
        type: 'confirm',
        name: 'createExample',
        message: 'Create example schema?',
        default: true
      }
    ]);

    // Создаем директории
    const dirs = ['lenz', 'generated'];
    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        console.log(chalk.green(`📁 Created directory: ./${dir}`));
      }
    }

    // Определяем тип проекта (TypeScript или JavaScript)
    const isTypeScriptProject = existsSync('tsconfig.json');
    const configExtension = isTypeScriptProject ? 'ts' : 'js';
    const configTemplate = isTypeScriptProject ? DEFAULT_CONFIG_TS : DEFAULT_CONFIG_JS;

    console.log(chalk.gray(`📦 Detected ${isTypeScriptProject ? 'TypeScript' : 'JavaScript (ESM)'} project`));

    // Создаем файлы
    const files = [
      {
        path: 'lenz/schema.graphql',
        content: answers.createExample ? DEFAULT_SCHEMA : '# Your GraphQL schema here'
      },
      {
        path: `lenz/lenz.config.${configExtension}`,
        content: configTemplate.replace('mongodb://localhost:27017/myapp', answers.url || 'mongodb://localhost:27017/myapp')
      },
      {
        path: '.env.example',
        content: EXAMPLE_ENV
      },
      {
        path: '.gitignore',
        content: `node_modules/
dist/
generated/
.env
*.log`
      }
    ];

    for (const file of files) {
      if (!existsSync(file.path)) {
        writeFileSync(file.path, file.content, 'utf-8');
        console.log(chalk.green(`📄 Created file: ${file.path}`));
      } else {
        console.log(chalk.yellow(`⚠️  File already exists: ${file.path}`));
      }
    }

    console.log(chalk.green('\n✅ Lenz project initialized!'));
    console.log(chalk.gray('\nNext steps:'));
    console.log(chalk.white('  1. Edit your schema: ') + chalk.cyan('lenz/schema.graphql'));
    console.log(chalk.white('  2. Configure database: ') + chalk.cyan(`lenz/lenz.config.${configExtension}`));
    console.log(chalk.white('  3. Generate client: ') + chalk.cyan('npx lenz generate'));
    console.log(chalk.white('  4. Start coding! 🚀\n'));
  });