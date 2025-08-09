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
    this.eisClient = await config.getEisClient();
    this.mlNodeClient = await config.getMlNodeClient();
  }

  async ensureInferencePipeline(client, pipelineName, modelId) {
    try {
      // Check if pipeline exists
      try {
        await client.ingest.getPipeline({ id: pipelineName });
        console.log(chalk.gray(`Pipeline ${pipelineName} already exists, updating...`));
        await client.ingest.deletePipeline({ id: pipelineName });
      } catch (e) {
        // Pipeline doesn't exist, we'll create it
      }

      // Create ELSER inference pipeline with correct configuration
      // Note: .elser-2-elastic is a tech preview model, .elser-2-elasticsearch is standard
      await client.ingest.putPipeline({
        id: pipelineName,
        body: {
          description: `ELSER inference pipeline using ${modelId}`,
          processors: [
            {
              inference: {
                model_id: modelId,
                input_output: [  // Note: this should be an array
                  {
                    input_field: 'text_entry',
                    output_field: 'text_embedding'
                  }
                ]
              }
            }
          ],
          on_failure: [
            {
              set: {
                field: 'error_message',
                value: '{{_ingest.on_failure_message}}'
              }
            }
          ]
        }
      });
      
      console.log(chalk.green(`Created ELSER pipeline ${pipelineName}`));
    } catch (error) {
      console.error(chalk.red(`Error creating pipeline ${pipelineName}:`), error.message);
      throw error;
    }
  }

  async runElserQuery(client, query, modelId, projectType) {
    const startTime = Date.now();
    
    try {
      // Use text_expansion query for ELSER v2 (as per Elastic documentation)
      const response = await client.search({
        index: `${INDEX_NAME}-enriched`,
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
      // If enriched index doesn't exist, try regular search as fallback
      console.log(chalk.yellow(`ELSER search failed on ${projectType}, trying regular search: ${error.message}`));
      
      try {
        const response = await client.search({
          index: INDEX_NAME,
          body: {
            query: {
              match: {
                text_entry: query
              }
            },
            size: 10,
            _source: ['line_id', 'play_name', 'speaker', 'text_entry']
          }
        });

        return {
          projectType,
          modelId,
          query,
          duration: Date.now() - startTime,
          error: 'Using fallback text search (ELSER not configured)',
          hits: response.hits.total.value,
          topResults: response.hits.hits.map(hit => ({
            score: hit._score,
            play: hit._source.play_name,
            speaker: hit._source.speaker,
            text: hit._source.text_entry.substring(0, 100) + '...'
          }))
        };
      } catch (fallbackError) {
        return {
          projectType,
          modelId,
          query,
          duration: Date.now() - startTime,
          error: fallbackError.message,
          hits: 0,
          topResults: []
        };
      }
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

  async embedDocuments(useEis = true, documentCount = null) {
    const client = useEis ? this.eisClient : this.mlNodeClient;
    const modelId = useEis ? this.eisModelId : this.mlNodeModelId;
    const projectType = useEis ? 'EIS' : 'ML Node';
    const pipelineName = `elser-${projectType.toLowerCase().replace(' ', '-')}-pipeline`;

    console.log(chalk.cyan(`\nCreating ELSER embeddings on ${projectType} with model: ${modelId}\n`));

    try {
      // First, ensure the ELSER model is deployed
      try {
        const modelInfo = await client.ml.getTrainedModels({ model_id: modelId });
        console.log(chalk.green(`✓ Model ${modelId} is available`));
      } catch (e) {
        console.log(chalk.yellow(`Model ${modelId} check failed, attempting to proceed...`));
      }

      // Create inference pipeline for ELSER
      await this.ensureInferencePipeline(client, pipelineName, modelId);

      // Delete existing enriched index if it exists
      try {
        await client.indices.delete({ index: `${INDEX_NAME}-enriched` });
        console.log(chalk.gray(`Deleted existing enriched index`));
      } catch (e) {
        // Index doesn't exist, that's fine
      }

      // Create the enriched index with proper mappings for ELSER (using sparse_vector like the working project)
      await client.indices.create({
        index: `${INDEX_NAME}-enriched`,
        body: {
          mappings: {
            properties: {
              line_id: { type: 'integer' },
              play_name: { type: 'keyword' },
              speech_number: { type: 'integer' },
              line_number: { type: 'keyword' },
              speaker: { type: 'keyword' },
              text_entry: { type: 'text' },
              text_embedding: { type: 'sparse_vector' }  // ELSER sparse embeddings field
            }
          }
        }
      });

      console.log(chalk.blue(`Created index with ELSER mappings for sparse embeddings`));

      // Reindex with pipeline to create embeddings
      const startTime = Date.now();
      
      const reindexBody = {
        source: {
          index: INDEX_NAME
        },
        dest: {
          index: `${INDEX_NAME}-enriched`,
          pipeline: pipelineName
        }
      };

      // If document count is specified, limit the reindex
      if (documentCount) {
        reindexBody.source.size = documentCount;
      }

      console.log(chalk.blue(`Starting embedding process with model ${modelId}...`));
      const reindexResult = await client.reindex({
        wait_for_completion: true,
        refresh: true,  // Ensure index is refreshed after reindexing
        body: reindexBody
      });

      const duration = Date.now() - startTime;
      
      // Check for failures
      if (reindexResult.failures && reindexResult.failures.length > 0) {
        console.log(chalk.yellow(`⚠ Some documents failed to embed:`));
        reindexResult.failures.slice(0, 5).forEach(failure => {
          console.log(chalk.yellow(`  - ${failure.cause?.reason || failure.cause?.type || 'Unknown error'}`));
        });
      }
      
      console.log(chalk.green(`✓ ELSER embedding completed in ${duration}ms on ${projectType}`));
      console.log(chalk.blue(`  Model used: ${modelId}`));
      console.log(chalk.blue(`  Documents processed: ${reindexResult.total}`));
      console.log(chalk.blue(`  Documents with embeddings: ${reindexResult.created}`));
      
      if (reindexResult.created < reindexResult.total) {
        console.log(chalk.yellow(`  ⚠ Failed to embed: ${reindexResult.total - reindexResult.created} documents`));
      }

      // Try to get document count
      try {
        const count = await client.count({ index: `${INDEX_NAME}-enriched` });
        console.log(chalk.blue(`  Total documents in embedded index: ${count.count}`));
      } catch (e) {
        // Count might not work on serverless
      }

      return { 
        success: true, 
        duration, 
        projectType,
        modelId,
        documentsProcessed: reindexResult.total,
        documentsCreated: reindexResult.created
      };
    } catch (error) {
      console.error(chalk.red(`Error creating ELSER embeddings on ${projectType} with ${modelId}:`), error.message);
      return { success: false, error: error.message, projectType, modelId };
    }
  }
}