import { Command } from 'commander';
import { LenzEngine } from '../../engine/LenzEngine';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import chalk from 'chalk';

interface GenerateOptions {
  schema?: string;
  output?: string;
  name?: string;
  config?: string;
}

export const generateCommand = new Command('generate')
  .description('Generate Lenz client from GraphQL schema')
  .option('-c, --config <path>', 'Path to lenz config file', 'lenz/lenz.config.ts')
  .option('-s, --schema <path>', 'Path to GraphQL schema file')
  .option('-o, --output <path>', 'Output directory for generated client')
  .option('-n, --name <name>', 'Name of the generated client', 'LenzClient')
  .action(async (options: GenerateOptions) => {
    console.log(chalk.blue('🚀 Generating Lenz client...'));

    try {
      let config: any = {};

      // Автоматически определяем конфиг по типу проекта, если используется значение по умолчанию
      let configFile = options.config!;
      if (configFile === 'lenz/lenz.config.ts') {
        const tsConfigPath = resolve(process.cwd(), 'lenz/lenz.config.ts');
        const jsConfigPath = resolve(process.cwd(), 'lenz/lenz.config.js');
        if (!existsSync(tsConfigPath) && existsSync(jsConfigPath)) {
          configFile = 'lenz/lenz.config.js';
          console.log(chalk.gray(`📦 Using JavaScript config: ${configFile}`));
        }
      }

      const configPath = resolve(process.cwd(), configFile);

      // Загружаем конфигурацию
      if (existsSync(configPath)) {
        if (configPath.endsWith('.ts')) {
          // Для TypeScript конфига
          const configModule = await import(configPath);
          config = configModule.default || configModule;
        } else if (configPath.endsWith('.js') || configPath.endsWith('.mjs')) {
          // Для JavaScript конфига (только ESM)
          const configModule = await import(configPath);
          config = configModule.default || configModule;
        }
      } else {
        console.log(chalk.yellow('⚠️  Config file not found, using defaults'));
      }

      // Определяем пути
      const schemaPath = resolve(
        dirname(configPath),
        options.schema || config.schema || 'schema.graphql'
      );

      if (!existsSync(schemaPath)) {
        console.log(chalk.red(`❌ Schema file not found: ${schemaPath}`));
        console.log(chalk.yellow('💡 Try running: lenz init'));
        process.exit(1);
      }

      const outputPath = resolve(
        dirname(configPath),
        options.output || config.generate?.client?.output || '../generated/lenz/client'
      );

      // Создаем движок и генерируем
      const engine = new LenzEngine({
        schemaPath,
        outputPath,
        clientName: options.name!
      });

      await engine.generate();

      // Отображаем информацию
      const schemaInfo = engine.getSchemaInfo();
      if (schemaInfo) {
        console.log(chalk.green('✅ Generation complete!'));
        console.log(chalk.gray('================================'));
        console.log(chalk.cyan('📊 Generated:'));
        console.log(chalk.white(`  • ${schemaInfo.modelCount} models`));
        console.log(chalk.white(`  • ${schemaInfo.enumCount} enums`));
        console.log(chalk.white(`  • ${schemaInfo.relationCount} relations`));
        console.log(chalk.gray('================================\n'));

        console.log(chalk.yellow('🚀 Next steps:'));
        console.log(chalk.white(`  1. Import client: ${chalk.cyan(`import { LenzClient } from '../generated/lenz/client'`)}`));
        console.log(chalk.white(`  2. Create instance: ${chalk.cyan(`const lenz = new LenzClient({ url: 'mongodb://...' })`)}`));
        console.log(chalk.white(`  3. Connect: ${chalk.cyan(`await lenz.$connect()`)}`));
        console.log(chalk.white(`  4. Use models: ${chalk.cyan(`await lenz.user.findMany()`)}\n`));
      }

    } catch (error) {
      console.log(chalk.red('❌ Generation failed:'));
      console.log(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });