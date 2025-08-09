import { Client } from '@elastic/elasticsearch';
import chalk from 'chalk';
import ora from 'ora';
import config from './config.js';
import { shakespeareData } from './shakespeare-data.js';

const INDEX_NAME = 'shakespeare';

async function setupIndex(client, projectName) {
  const spinner = ora(`Setting up Shakespeare index on ${projectName}`).start();
  
  try {
    // Check if index exists
    const exists = await client.indices.exists({ index: INDEX_NAME });
    
    if (exists) {
      spinner.info(`Index '${INDEX_NAME}' already exists on ${projectName}, deleting...`);
      await client.indices.delete({ index: INDEX_NAME });
    }
    
    // Create index with mappings
    await client.indices.create({
      index: INDEX_NAME,
      body: {
        mappings: {
          properties: {
            line_id: { type: 'integer' },
            play_name: { type: 'keyword' },
            speech_number: { type: 'integer' },
            line_number: { type: 'keyword' },
            speaker: { type: 'keyword' },
            text_entry: { type: 'text' }
          }
        }
      }
    });
    
    spinner.text = `Indexing Shakespeare data on ${projectName}...`;
    
    // Bulk index documents
    const operations = shakespeareData.flatMap(doc => [
      { index: { _index: INDEX_NAME } },
      doc
    ]);
    
    const bulkResponse = await client.bulk({ 
      refresh: true, 
      operations 
    });
    
    if (bulkResponse.errors) {
      const erroredDocuments = [];
      bulkResponse.items.forEach((action, i) => {
        const operation = Object.keys(action)[0];
        if (action[operation].error) {
          erroredDocuments.push({
            status: action[operation].status,
            error: action[operation].error,
            operation: operations[i * 2 + 1]
          });
        }
      });
      console.error('Failed documents:', erroredDocuments);
      throw new Error('Bulk indexing had errors');
    }
    
    spinner.succeed(`Successfully indexed ${shakespeareData.length} documents on ${projectName}`);
    
    // Get index stats
    const stats = await client.indices.stats({ index: INDEX_NAME });
    const docCount = stats._all.primaries.docs.count;
    console.log(chalk.green(`  Total documents in index: ${docCount}`));
    
  } catch (error) {
    spinner.fail(`Failed to setup index on ${projectName}`);
    throw error;
  }
}

export async function setupShakespeareIndex() {
  console.log(chalk.cyan('\n=== Setting up Shakespeare Index ===\n'));
  
  try {
    await config.getCredentials();
    
    // Setup on EIS project
    console.log(chalk.blue('\nSetting up on .elser-2-elastic (EIS) project...'));
    const eisClient = await config.getEisClient();
    await setupIndex(eisClient, 'EIS project');
    
    // Setup on ML Node project
    console.log(chalk.blue('\nSetting up on .elser-2-elasticsearch (ML Node) project...'));
    const mlNodeClient = await config.getMlNodeClient();
    await setupIndex(mlNodeClient, 'ML Node project');
    
    console.log(chalk.green('\n✓ Shakespeare index setup complete on both projects!\n'));
    
  } catch (error) {
    console.error(chalk.red('\nError setting up Shakespeare index:'), error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupShakespeareIndex();
}