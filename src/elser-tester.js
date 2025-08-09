import { Client } from '@elastic/elasticsearch';
import chalk from 'chalk';
import config from './config.js';

const INDEX_NAME = 'shakespeare';

export class ElserTester {
  constructor() {
    this.eisClient = null;
    this.mlNodeClient = null;
    this.eisModelId = '.elser-2-elastic';
    this.mlNodeModelId = '.elser-2-elasticsearch';
  }

  async initialize() {
    await config.getCredentials();
    this.eisClient = config.getEisClient();
    this.mlNodeClient = config.getMlNodeClient();
  }

  async ensureInferencePipeline(client, pipelineName, modelId) {
    try {
      // Check if pipeline exists
      try {
        await client.ingest.getPipeline({ id: pipelineName });
        console.log(chalk.gray(`Pipeline ${pipelineName} already exists`));
        return;
      } catch (e) {
        // Pipeline doesn't exist, create it
      }

      // Create inference pipeline
      await client.ingest.putPipeline({
        id: pipelineName,
        body: {
          description: `ELSER inference pipeline using ${modelId}`,
          processors: [
            {
              inference: {
                model_id: modelId,
                input_output: [
                  {
                    input_field: 'text_entry',
                    output_field: 'text_embedding'
                  }
                ]
              }
            }
          ]
        }
      });
      
      console.log(chalk.green(`Created pipeline ${pipelineName}`));
    } catch (error) {
      console.error(chalk.red(`Error creating pipeline ${pipelineName}:`), error.message);
      throw error;
    }
  }

  async runElserQuery(client, query, modelId, projectType) {
    const startTime = Date.now();
    
    try {
      const response = await client.search({
        index: INDEX_NAME,
        body: {
          query: {
            text_expansion: {
              'text_embedding': {
                model_id: modelId,
                model_text: query
              }
            }
          },
          size: 10,
          _source: ['line_id', 'play_name', 'speaker', 'text_entry']
        }
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      return {
        projectType,
        modelId,
        query,
        duration,
        hits: response.hits.total.value,
        topResults: response.hits.hits.map(hit => ({
          score: hit._score,
          play: hit._source.play_name,
          speaker: hit._source.speaker,
          text: hit._source.text_entry.substring(0, 100) + '...'
        }))
      };
    } catch (error) {
      console.error(chalk.red(`Error running query on ${projectType}:`), error.message);
      return {
        projectType,
        modelId,
        query,
        duration: Date.now() - startTime,
        error: error.message,
        hits: 0,
        topResults: []
      };
    }
  }

  async compareModels(query) {
    console.log(chalk.cyan(`\nRunning query: "${query}"\n`));

    // Run queries in parallel
    const [eisResult, mlNodeResult] = await Promise.all([
      this.runElserQuery(this.eisClient, query, this.eisModelId, 'EIS'),
      this.runElserQuery(this.mlNodeClient, query, this.mlNodeModelId, 'ML Node')
    ]);

    return {
      query,
      eisResult,
      mlNodeResult,
      comparison: {
        eisFaster: eisResult.duration < mlNodeResult.duration,
        timeDifference: Math.abs(eisResult.duration - mlNodeResult.duration),
        speedupFactor: eisResult.duration < mlNodeResult.duration 
          ? (mlNodeResult.duration / eisResult.duration).toFixed(2)
          : (eisResult.duration / mlNodeResult.duration).toFixed(2),
        fasterModel: eisResult.duration < mlNodeResult.duration ? 'EIS' : 'ML Node'
      }
    };
  }

  async runBenchmark(queries, iterations = 5) {
    const results = [];
    
    console.log(chalk.cyan(`\nStarting benchmark with ${iterations} iterations per query\n`));

    for (const query of queries) {
      const queryResults = [];
      
      for (let i = 0; i < iterations; i++) {
        console.log(chalk.gray(`  Iteration ${i + 1}/${iterations} for query: "${query}"`));
        const result = await this.compareModels(query);
        queryResults.push(result);
      }

      // Calculate average times
      const avgEisTime = queryResults.reduce((sum, r) => sum + r.eisResult.duration, 0) / iterations;
      const avgMlNodeTime = queryResults.reduce((sum, r) => sum + r.mlNodeResult.duration, 0) / iterations;

      results.push({
        query,
        iterations,
        avgEisTime,
        avgMlNodeTime,
        speedupFactor: avgEisTime < avgMlNodeTime 
          ? (avgMlNodeTime / avgEisTime).toFixed(2)
          : (avgEisTime / avgMlNodeTime).toFixed(2),
        fasterModel: avgEisTime < avgMlNodeTime ? 'EIS' : 'ML Node',
        allResults: queryResults
      });
    }

    return results;
  }

  async enrichDocuments(useEis = true) {
    const client = useEis ? this.eisClient : this.mlNodeClient;
    const modelId = useEis ? this.eisModelId : this.mlNodeModelId;
    const projectType = useEis ? 'EIS' : 'ML Node';
    const pipelineName = `elser-${projectType.toLowerCase().replace(' ', '-')}-pipeline`;

    console.log(chalk.cyan(`\nEnriching documents on ${projectType} with ${modelId}\n`));

    try {
      // Ensure pipeline exists
      await this.ensureInferencePipeline(client, pipelineName, modelId);

      // Reindex with pipeline
      const startTime = Date.now();
      
      await client.reindex({
        wait_for_completion: true,
        body: {
          source: {
            index: INDEX_NAME
          },
          dest: {
            index: `${INDEX_NAME}-enriched`,
            pipeline: pipelineName
          }
        }
      });

      const duration = Date.now() - startTime;
      console.log(chalk.green(`✓ Enrichment completed in ${duration}ms on ${projectType}`));

      // Get stats
      const stats = await client.indices.stats({ index: `${INDEX_NAME}-enriched` });
      console.log(chalk.blue(`  Documents enriched: ${stats._all.primaries.docs.count}`));

      return { success: true, duration, projectType };
    } catch (error) {
      console.error(chalk.red(`Error enriching documents on ${projectType}:`), error.message);
      return { success: false, error: error.message, projectType };
    }
  }
}