#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { ElserTester } from './elser-tester.js';
import { MultiThreadTester } from './multi-thread-tester.js';
import { Reporter } from './reporter.js';
import { setupShakespeareIndex } from './setup-shakespeare.js';
import config from './config.js';

const program = new Command();
const reporter = new Reporter();

program
  .name('elser-eis-vs-ml-node-test')
  .description('Compare performance of .elser-2-elastic vs .elser-2-elasticsearch models')
  .version('1.0.0');

program
  .command('setup')
  .description('Setup Shakespeare index on both serverless projects')
  .action(async () => {
    await setupShakespeareIndex();
  });

program
  .command('config')
  .description('Configure serverless project credentials')
  .action(async () => {
    await config.promptForCredentials();
    console.log(chalk.green('\nCredentials configured successfully!'));
  });

program
  .command('compare')
  .description('Run single comparison between models')
  .option('-q, --query <query>', 'Search query', 'love')
  .action(async (options) => {
    const tester = new ElserTester();
    await tester.initialize();
    
    const result = await tester.compareModels(options.query);
    reporter.printComparisonResults([result]);
    reporter.saveResults(result, 'single-comparison');
  });

program
  .command('benchmark')
  .description('Run benchmark with multiple queries and iterations')
  .option('-i, --iterations <number>', 'Number of iterations per query', '5')
  .option('-q, --queries <queries...>', 'Queries to test', ['love', 'death', 'king', 'sword', 'night'])
  .action(async (options) => {
    const tester = new ElserTester();
    await tester.initialize();
    
    const results = await tester.runBenchmark(
      options.queries,
      parseInt(options.iterations)
    );
    
    reporter.printBenchmarkResults(results);
    reporter.saveResults(results, 'benchmark');
    reporter.generateHTMLReport(results, 'benchmark');
  });

program
  .command('multi-thread')
  .description('Run multi-threaded concurrent test')
  .option('-c, --concurrency <number>', 'Number of concurrent threads', '10')
  .option('-n, --count <number>', 'Total number of queries to run', '50')
  .option('-q, --queries <queries...>', 'Queries to test', ['love', 'death', 'king', 'sword', 'night'])
  .action(async (options) => {
    const tester = new MultiThreadTester();
    await tester.initialize();
    
    // Generate query array based on count
    const queries = [];
    for (let i = 0; i < parseInt(options.count); i++) {
      queries.push(options.queries[i % options.queries.length]);
    }
    
    const results = await tester.runConcurrentQueries(
      queries,
      parseInt(options.concurrency)
    );
    
    reporter.printMultiThreadResults(results);
    reporter.saveResults(results, 'multi-thread');
  });

program
  .command('load-test')
  .description('Run load test with sustained traffic')
  .option('-d, --duration <seconds>', 'Test duration in seconds', '30')
  .option('-c, --concurrency <number>', 'Number of concurrent threads', '10')
  .option('-t, --target-qps <number>', 'Target queries per second (optional)')
  .option('-q, --queries <queries...>', 'Queries to test', ['love', 'death', 'king', 'sword', 'night'])
  .action(async (options) => {
    const tester = new MultiThreadTester();
    await tester.initialize();
    
    const results = await tester.runLoadTest({
      queries: options.queries,
      duration: parseInt(options.duration) * 1000,
      concurrency: parseInt(options.concurrency),
      targetQPS: options.targetQps ? parseInt(options.targetQps) : null
    });
    
    reporter.printLoadTestResults(results);
    reporter.saveResults(results, 'load-test');
    reporter.generateHTMLReport(results, 'load-test');
  });

program
  .command('stress-test')
  .description('Run stress test to find breaking point')
  .option('-s, --start <number>', 'Starting concurrency', '5')
  .option('-m, --max <number>', 'Maximum concurrency', '50')
  .option('-i, --increment <number>', 'Concurrency increment', '5')
  .option('-d, --duration <seconds>', 'Duration per step in seconds', '10')
  .option('-q, --queries <queries...>', 'Queries to test', ['love', 'death', 'king', 'sword', 'night'])
  .action(async (options) => {
    const tester = new MultiThreadTester();
    await tester.initialize();
    
    const results = await tester.runStressTest({
      queries: options.queries,
      startConcurrency: parseInt(options.start),
      maxConcurrency: parseInt(options.max),
      stepSize: parseInt(options.increment),
      stepDuration: parseInt(options.duration) * 1000
    });
    
    reporter.printStressTestResults(results);
    reporter.saveResults(results, 'stress-test');
    reporter.generateHTMLReport(results, 'stress-test');
  });

program
  .command('enrich')
  .description('Enrich documents with ELSER embeddings')
  .option('-p, --project <type>', 'Project to enrich (eis|mlnode|both)', 'both')
  .action(async (options) => {
    const tester = new ElserTester();
    await tester.initialize();
    
    if (options.project === 'both' || options.project === 'eis') {
      await tester.enrichDocuments(true);
    }
    
    if (options.project === 'both' || options.project === 'mlnode') {
      await tester.enrichDocuments(false);
    }
  });

program
  .command('interactive')
  .description('Interactive testing mode')
  .action(async () => {
    console.log(chalk.cyan('\n=== ELSER Model Comparison Tool ===\n'));
    
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Setup Shakespeare index', value: 'setup' },
          { name: 'Configure credentials', value: 'config' },
          { name: 'Run single comparison', value: 'compare' },
          { name: 'Run benchmark', value: 'benchmark' },
          { name: 'Run multi-threaded test', value: 'multithread' },
          { name: 'Run load test', value: 'loadtest' },
          { name: 'Run stress test', value: 'stress' },
          { name: 'Enrich documents', value: 'enrich' },
          { name: 'Exit', value: 'exit' }
        ]
      }
    ]);

    switch (answers.action) {
      case 'setup':
        await setupShakespeareIndex();
        break;
        
      case 'config':
        await config.promptForCredentials();
        break;
        
      case 'compare':
        const compareAnswers = await inquirer.prompt([
          {
            type: 'input',
            name: 'query',
            message: 'Enter search query:',
            default: 'love'
          }
        ]);
        
        const tester = new ElserTester();
        await tester.initialize();
        const result = await tester.compareModels(compareAnswers.query);
        reporter.printComparisonResults([result]);
        reporter.saveResults(result, 'single-comparison');
        break;
        
      case 'benchmark':
        const benchAnswers = await inquirer.prompt([
          {
            type: 'input',
            name: 'queries',
            message: 'Enter queries (comma-separated):',
            default: 'love,death,king,sword,night'
          },
          {
            type: 'number',
            name: 'iterations',
            message: 'Number of iterations per query:',
            default: 5
          }
        ]);
        
        const benchTester = new ElserTester();
        await benchTester.initialize();
        const benchResults = await benchTester.runBenchmark(
          benchAnswers.queries.split(',').map(q => q.trim()),
          benchAnswers.iterations
        );
        reporter.printBenchmarkResults(benchResults);
        reporter.saveResults(benchResults, 'benchmark');
        break;
        
      case 'multithread':
        const mtAnswers = await inquirer.prompt([
          {
            type: 'number',
            name: 'concurrency',
            message: 'Number of concurrent threads:',
            default: 10
          },
          {
            type: 'number',
            name: 'count',
            message: 'Total number of queries:',
            default: 50
          }
        ]);
        
        const mtTester = new MultiThreadTester();
        await mtTester.initialize();
        const queries = [];
        const defaultQueries = ['love', 'death', 'king', 'sword', 'night'];
        for (let i = 0; i < mtAnswers.count; i++) {
          queries.push(defaultQueries[i % defaultQueries.length]);
        }
        
        const mtResults = await mtTester.runConcurrentQueries(queries, mtAnswers.concurrency);
        reporter.printMultiThreadResults(mtResults);
        reporter.saveResults(mtResults, 'multi-thread');
        break;
        
      case 'loadtest':
        const loadAnswers = await inquirer.prompt([
          {
            type: 'number',
            name: 'duration',
            message: 'Test duration (seconds):',
            default: 30
          },
          {
            type: 'number',
            name: 'concurrency',
            message: 'Number of concurrent threads:',
            default: 10
          }
        ]);
        
        const loadTester = new MultiThreadTester();
        await loadTester.initialize();
        const loadResults = await loadTester.runLoadTest({
          duration: loadAnswers.duration * 1000,
          concurrency: loadAnswers.concurrency
        });
        reporter.printLoadTestResults(loadResults);
        reporter.saveResults(loadResults, 'load-test');
        break;
        
      case 'stress':
        const stressAnswers = await inquirer.prompt([
          {
            type: 'number',
            name: 'start',
            message: 'Starting concurrency:',
            default: 5
          },
          {
            type: 'number',
            name: 'max',
            message: 'Maximum concurrency:',
            default: 50
          },
          {
            type: 'number',
            name: 'step',
            message: 'Step increment:',
            default: 5
          }
        ]);
        
        const stressTester = new MultiThreadTester();
        await stressTester.initialize();
        const stressResults = await stressTester.runStressTest({
          startConcurrency: stressAnswers.start,
          maxConcurrency: stressAnswers.max,
          stepSize: stressAnswers.step
        });
        reporter.printStressTestResults(stressResults);
        reporter.saveResults(stressResults, 'stress-test');
        break;
        
      case 'enrich':
        const enrichAnswers = await inquirer.prompt([
          {
            type: 'list',
            name: 'project',
            message: 'Which project to enrich?',
            choices: [
              { name: 'Both projects', value: 'both' },
              { name: 'EIS project only', value: 'eis' },
              { name: 'ML Node project only', value: 'mlnode' }
            ]
          }
        ]);
        
        const enrichTester = new ElserTester();
        await enrichTester.initialize();
        
        if (enrichAnswers.project === 'both' || enrichAnswers.project === 'eis') {
          await enrichTester.enrichDocuments(true);
        }
        
        if (enrichAnswers.project === 'both' || enrichAnswers.project === 'mlnode') {
          await enrichTester.enrichDocuments(false);
        }
        break;
        
      case 'exit':
        console.log(chalk.green('\nGoodbye!'));
        process.exit(0);
    }
    
    // Return to menu
    program.parse(['node', 'index.js', 'interactive']);
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}