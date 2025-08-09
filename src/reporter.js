import Table from 'cli-table3';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class Reporter {
  constructor() {
    this.resultsDir = path.join(__dirname, '..', 'results');
    this.ensureResultsDir();
  }

  ensureResultsDir() {
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }
  }

  printComparisonResults(results) {
    console.log(chalk.cyan('\n=== Model Comparison Results ===\n'));

    const table = new Table({
      head: [
        chalk.white('Query'),
        chalk.blue('EIS Time (ms)'),
        chalk.green('ML Node Time (ms)'),
        chalk.yellow('Faster Model'),
        chalk.magenta('Speedup Factor')
      ],
      colWidths: [30, 15, 15, 15, 15]
    });

    results.forEach(result => {
      table.push([
        result.query.substring(0, 28),
        result.eisResult.duration,
        result.mlNodeResult.duration,
        result.comparison.fasterModel,
        `${result.comparison.speedupFactor}x`
      ]);
    });

    console.log(table.toString());
  }

  printBenchmarkResults(benchmarkResults) {
    console.log(chalk.cyan('\n=== Benchmark Summary ===\n'));

    const table = new Table({
      head: [
        chalk.white('Query'),
        chalk.white('Iterations'),
        chalk.blue('Avg EIS (ms)'),
        chalk.green('Avg ML Node (ms)'),
        chalk.yellow('Faster'),
        chalk.magenta('Speedup')
      ]
    });

    benchmarkResults.forEach(result => {
      table.push([
        result.query.substring(0, 40),
        result.iterations,
        result.avgEisTime.toFixed(2),
        result.avgMlNodeTime.toFixed(2),
        result.fasterModel,
        `${result.speedupFactor}x`
      ]);
    });

    console.log(table.toString());

    // Overall statistics
    const avgEisTotal = benchmarkResults.reduce((sum, r) => sum + r.avgEisTime, 0) / benchmarkResults.length;
    const avgMlNodeTotal = benchmarkResults.reduce((sum, r) => sum + r.avgMlNodeTime, 0) / benchmarkResults.length;

    console.log(chalk.cyan('\n=== Overall Statistics ===\n'));
    console.log(chalk.white(`Average EIS response time: ${avgEisTotal.toFixed(2)}ms`));
    console.log(chalk.white(`Average ML Node response time: ${avgMlNodeTotal.toFixed(2)}ms`));
    console.log(chalk.yellow(`Overall faster model: ${avgEisTotal < avgMlNodeTotal ? 'EIS' : 'ML Node'}`));
    console.log(chalk.magenta(`Overall speedup factor: ${(avgMlNodeTotal / avgEisTotal).toFixed(2)}x`));
  }

  printMultiThreadResults(results) {
    const { stats } = results;

    console.log(chalk.cyan('\n=== Multi-Thread Test Results ===\n'));
    console.log(chalk.white(`Total queries executed: ${stats.totalQueries}`));
    console.log(chalk.white(`Concurrency level: ${stats.concurrency}`));
    console.log(chalk.white(`Total duration: ${stats.totalDuration}ms`));
    console.log(chalk.white(`Queries per second: ${stats.queriesPerSecond}`));

    const table = new Table({
      head: [
        chalk.white('Model'),
        chalk.blue('Avg (ms)'),
        chalk.green('Min (ms)'),
        chalk.yellow('Max (ms)'),
        chalk.magenta('Median (ms)')
      ]
    });

    table.push(
      ['EIS', stats.eis.avg, stats.eis.min, stats.eis.max, stats.eis.median],
      ['ML Node', stats.mlNode.avg, stats.mlNode.min, stats.mlNode.max, stats.mlNode.median]
    );

    console.log(table.toString());
  }

  printLoadTestResults(results) {
    const { stats } = results;

    console.log(chalk.cyan('\n=== Load Test Results ===\n'));
    console.log(chalk.white(`Test duration: ${stats.duration} seconds`));
    console.log(chalk.white(`Total queries: ${stats.totalQueries}`));
    console.log(chalk.green(`Successful queries: ${stats.successfulQueries}`));
    if (stats.failedQueries > 0) {
      console.log(chalk.red(`Failed queries: ${stats.failedQueries}`));
    }
    console.log(chalk.white(`Actual QPS: ${stats.actualQPS}`));
    console.log(chalk.white(`Concurrency: ${stats.concurrency}`));

    const table = new Table({
      head: [
        chalk.white('Model'),
        chalk.blue('Avg'),
        chalk.green('Min'),
        chalk.yellow('Max'),
        chalk.magenta('Median'),
        chalk.cyan('P95'),
        chalk.white('P99')
      ],
      colWidths: [10, 10, 10, 10, 10, 10, 10]
    });

    table.push(
      [
        'EIS',
        `${stats.eis.avg}ms`,
        `${stats.eis.min}ms`,
        `${stats.eis.max}ms`,
        `${stats.eis.median}ms`,
        `${stats.eis.p95}ms`,
        `${stats.eis.p99}ms`
      ],
      [
        'ML Node',
        `${stats.mlNode.avg}ms`,
        `${stats.mlNode.min}ms`,
        `${stats.mlNode.max}ms`,
        `${stats.mlNode.median}ms`,
        `${stats.mlNode.p95}ms`,
        `${stats.mlNode.p99}ms`
      ]
    );

    console.log(table.toString());
  }

  printStressTestResults(results) {
    console.log(chalk.cyan('\n=== Stress Test Summary ===\n'));

    const table = new Table({
      head: [
        chalk.white('Threads'),
        chalk.white('QPS'),
        chalk.blue('EIS Avg'),
        chalk.blue('EIS P95'),
        chalk.green('ML Avg'),
        chalk.green('ML P95'),
        chalk.yellow('Success Rate')
      ]
    });

    results.forEach(result => {
      const successRate = ((result.successfulQueries / result.totalQueries) * 100).toFixed(1);
      table.push([
        result.concurrency,
        result.actualQPS,
        `${result.eis.avg}ms`,
        `${result.eis.p95}ms`,
        `${result.mlNode.avg}ms`,
        `${result.mlNode.p95}ms`,
        `${successRate}%`
      ]);
    });

    console.log(table.toString());

    // Find optimal concurrency
    const optimalResult = results.reduce((best, current) => {
      const currentQPS = parseFloat(current.actualQPS);
      const bestQPS = parseFloat(best.actualQPS);
      return currentQPS > bestQPS ? current : best;
    });

    console.log(chalk.cyan('\n=== Optimal Configuration ===\n'));
    console.log(chalk.green(`Optimal concurrency: ${optimalResult.concurrency} threads`));
    console.log(chalk.green(`Maximum QPS achieved: ${optimalResult.actualQPS}`));
    console.log(chalk.green(`EIS average at optimal: ${optimalResult.eis.avg}ms`));
    console.log(chalk.green(`ML Node average at optimal: ${optimalResult.mlNode.avg}ms`));
  }

  saveResults(results, testType = 'comparison') {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `${testType}-${timestamp}.json`;
    const filepath = path.join(this.resultsDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
    console.log(chalk.green(`\nResults saved to: ${filepath}`));
  }

  generateHTMLReport(results, testType = 'comparison') {
    const timestamp = new Date().toISOString();
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>ELSER Model Comparison Report - ${timestamp}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        h1 { color: #333; }
        .summary { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        table { width: 100%; border-collapse: collapse; background: white; }
        th { background: #4CAF50; color: white; padding: 12px; text-align: left; }
        td { padding: 12px; border-bottom: 1px solid #ddd; }
        tr:hover { background-color: #f5f5f5; }
        .faster { color: #4CAF50; font-weight: bold; }
        .slower { color: #f44336; }
        .chart { margin: 20px 0; background: white; padding: 20px; border-radius: 8px; }
    </style>
</head>
<body>
    <h1>ELSER Model Comparison Report</h1>
    <div class="summary">
        <h2>Test Configuration</h2>
        <p><strong>Test Type:</strong> ${testType}</p>
        <p><strong>Timestamp:</strong> ${timestamp}</p>
        <p><strong>EIS Model:</strong> .elser-2-elastic</p>
        <p><strong>ML Node Model:</strong> .elser-2-elasticsearch</p>
    </div>
    
    <div class="summary">
        <h2>Results</h2>
        <pre>${JSON.stringify(results, null, 2)}</pre>
    </div>
</body>
</html>
    `;

    const filename = `report-${testType}-${timestamp.replace(/:/g, '-').split('.')[0]}.html`;
    const filepath = path.join(this.resultsDir, filename);
    
    fs.writeFileSync(filepath, html);
    console.log(chalk.green(`HTML report saved to: ${filepath}`));
  }
}