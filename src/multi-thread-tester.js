import pLimit from 'p-limit';
import chalk from 'chalk';
import { ElserTester } from './elser-tester.js';

export class MultiThreadTester {
  constructor() {
    this.tester = new ElserTester();
  }

  async initialize() {
    await this.tester.initialize();
  }

  async runConcurrentQueries(queries, concurrency = 5) {
    console.log(chalk.cyan(`\n=== Multi-threaded Test (${concurrency} concurrent threads) ===\n`));
    
    const limit = pLimit(concurrency);
    const startTime = Date.now();
    
    // Create array of query tasks
    const queryTasks = [];
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i % queries.length];
      queryTasks.push({
        id: i + 1,
        query: query
      });
    }

    // Run queries concurrently with limit
    const results = await Promise.all(
      queryTasks.map(task => 
        limit(async () => {
          console.log(chalk.gray(`Thread ${task.id}: Starting query "${task.query}"`));
          const result = await this.tester.compareModels(task.query);
          console.log(chalk.gray(`Thread ${task.id}: Completed in EIS: ${result.eisResult.duration}ms, ML Node: ${result.mlNodeResult.duration}ms`));
          return {
            threadId: task.id,
            ...result
          };
        })
      )
    );

    const totalDuration = Date.now() - startTime;

    // Calculate statistics
    const eisTimes = results.map(r => r.eisResult.duration);
    const mlNodeTimes = results.map(r => r.mlNodeResult.duration);

    const stats = {
      totalQueries: results.length,
      concurrency,
      totalDuration,
      queriesPerSecond: (results.length / (totalDuration / 1000)).toFixed(2),
      eis: {
        avg: (eisTimes.reduce((a, b) => a + b, 0) / eisTimes.length).toFixed(2),
        min: Math.min(...eisTimes),
        max: Math.max(...eisTimes),
        median: this.calculateMedian(eisTimes)
      },
      mlNode: {
        avg: (mlNodeTimes.reduce((a, b) => a + b, 0) / mlNodeTimes.length).toFixed(2),
        min: Math.min(...mlNodeTimes),
        max: Math.max(...mlNodeTimes),
        median: this.calculateMedian(mlNodeTimes)
      }
    };

    return {
      results,
      stats
    };
  }

  async runLoadTest(options = {}) {
    const {
      queries = ['love', 'death', 'king', 'sword', 'night'],
      duration = 30000, // 30 seconds default
      concurrency = 10,
      targetQPS = null // queries per second target
    } = options;

    console.log(chalk.cyan('\n=== Load Test Configuration ==='));
    console.log(chalk.white(`Duration: ${duration / 1000} seconds`));
    console.log(chalk.white(`Concurrency: ${concurrency} threads`));
    console.log(chalk.white(`Target QPS: ${targetQPS || 'Maximum'}`));
    console.log(chalk.white(`Query pool: ${queries.join(', ')}\n`));

    const limit = pLimit(concurrency);
    const startTime = Date.now();
    const results = [];
    let queryCount = 0;
    let shouldStop = false;

    // Calculate delay between queries if target QPS is set
    const delayBetweenQueries = targetQPS ? 1000 / targetQPS : 0;

    // Function to run a single query
    const runQuery = async () => {
      if (shouldStop) return null;
      
      const queryId = ++queryCount;
      const query = queries[queryId % queries.length];
      
      try {
        const result = await this.tester.compareModels(query);
        return {
          queryId,
          timestamp: Date.now() - startTime,
          ...result
        };
      } catch (error) {
        return {
          queryId,
          timestamp: Date.now() - startTime,
          error: error.message
        };
      }
    };

    // Start load test
    console.log(chalk.green('Starting load test...\n'));

    const queryPromises = [];
    const queryInterval = setInterval(() => {
      if (Date.now() - startTime >= duration) {
        shouldStop = true;
        clearInterval(queryInterval);
        return;
      }

      queryPromises.push(
        limit(() => runQuery().then(result => {
          if (result) {
            results.push(result);
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            const currentQPS = (results.length / elapsed).toFixed(2);
            process.stdout.write(`\r${chalk.gray(`Elapsed: ${elapsed}s | Queries: ${results.length} | QPS: ${currentQPS}`)}`);
          }
        }))
      );
    }, delayBetweenQueries || 1);

    // Wait for duration
    await new Promise(resolve => setTimeout(resolve, duration));
    shouldStop = true;
    clearInterval(queryInterval);

    // Wait for all queries to complete
    await Promise.all(queryPromises);

    console.log('\n\n' + chalk.green('Load test completed!\n'));

    // Calculate final statistics
    const successfulResults = results.filter(r => !r.error);
    const eisTimes = successfulResults.map(r => r.eisResult.duration);
    const mlNodeTimes = successfulResults.map(r => r.mlNodeResult.duration);

    const stats = {
      duration: duration / 1000,
      totalQueries: results.length,
      successfulQueries: successfulResults.length,
      failedQueries: results.length - successfulResults.length,
      actualQPS: (results.length / (duration / 1000)).toFixed(2),
      concurrency,
      eis: {
        avg: (eisTimes.reduce((a, b) => a + b, 0) / eisTimes.length).toFixed(2),
        min: Math.min(...eisTimes),
        max: Math.max(...eisTimes),
        median: this.calculateMedian(eisTimes),
        p95: this.calculatePercentile(eisTimes, 95),
        p99: this.calculatePercentile(eisTimes, 99)
      },
      mlNode: {
        avg: (mlNodeTimes.reduce((a, b) => a + b, 0) / mlNodeTimes.length).toFixed(2),
        min: Math.min(...mlNodeTimes),
        max: Math.max(...mlNodeTimes),
        median: this.calculateMedian(mlNodeTimes),
        p95: this.calculatePercentile(mlNodeTimes, 95),
        p99: this.calculatePercentile(mlNodeTimes, 99)
      }
    };

    return {
      results: successfulResults,
      stats
    };
  }

  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return ((sorted[middle - 1] + sorted[middle]) / 2).toFixed(2);
    }
    
    return sorted[middle].toFixed(2);
  }

  calculatePercentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index].toFixed(2);
  }

  async runStressTest(options = {}) {
    const {
      queries = ['love', 'death', 'king', 'sword', 'night'],
      startConcurrency = 5,
      maxConcurrency = 50,
      stepSize = 5,
      stepDuration = 10000 // 10 seconds per step
    } = options;

    console.log(chalk.cyan('\n=== Stress Test Configuration ==='));
    console.log(chalk.white(`Starting concurrency: ${startConcurrency}`));
    console.log(chalk.white(`Maximum concurrency: ${maxConcurrency}`));
    console.log(chalk.white(`Step size: ${stepSize}`));
    console.log(chalk.white(`Step duration: ${stepDuration / 1000} seconds\n`));

    const results = [];

    for (let concurrency = startConcurrency; concurrency <= maxConcurrency; concurrency += stepSize) {
      console.log(chalk.yellow(`\n--- Testing with ${concurrency} concurrent threads ---\n`));
      
      const stepResult = await this.runLoadTest({
        queries,
        duration: stepDuration,
        concurrency
      });

      results.push({
        concurrency,
        ...stepResult.stats
      });

      // Check for degradation
      if (stepResult.stats.failedQueries > stepResult.stats.successfulQueries * 0.1) {
        console.log(chalk.red(`\nStopping stress test - too many failures at ${concurrency} threads`));
        break;
      }
    }

    return results;
  }
}