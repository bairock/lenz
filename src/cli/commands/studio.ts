import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import { existsSync } from 'fs';

export const studioCommand = new Command('studio')
  .description('Open Lenz Studio - visual database management')
  .option('-p, --port <port>', 'Port for Lenz Studio', '5555')
  .option('--host <host>', 'Host for Lenz Studio', 'localhost')
  .action(async (options) => {
    console.log(chalk.blue(boxen('🚀 Lenz Studio', { padding: 1, borderStyle: 'round' })));

    // Проверяем наличие схемы
    const schemaPath = 'lenz/schema.graphql';
    if (!existsSync(schemaPath)) {
      console.log(chalk.red('❌ Schema file not found'));
      console.log(chalk.yellow('💡 Run: lenz init'));
      process.exit(1);
    }

    console.log(chalk.green('📡 Starting Lenz Studio...'));
    console.log(chalk.gray(`🌐 Available at: http://${options.host}:${options.port}`));

    // В реальности здесь будет запуск веб-сервера с интерфейсом
    console.log(chalk.yellow('⚠️  Studio is under development'));
    console.log(chalk.gray('\nIn the meantime, you can use:'));
    console.log(chalk.white('  • MongoDB Compass'));
    console.log(chalk.white('  • Generated TypeScript client\n'));
  });