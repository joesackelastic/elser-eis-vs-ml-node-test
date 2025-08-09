import { Client } from '@elastic/elasticsearch';
import chalk from 'chalk';
import ora from 'ora';
import config from './config.js';
import { shakespeareData } from './shakespeare-data.js';
import { generateExtendedShakespeareData } from './shakespeare-extended-data.js';

const INDEX_NAME = 'shakespeare';

async function setupIndex(client, projectName) {
  const spinner = ora(`Setting up Shakespeare index on ${projectName}`).start();
  
  try {
    // Check if index exists and delete if it does
    try {
      const exists = await client.indices.exists({ index: INDEX_NAME });
      if (exists) {
        spinner.info(`Index '${INDEX_NAME}' already exists on ${projectName}, deleting...`);
        await client.indices.delete({ index: INDEX_NAME });
      }
    } catch (e) {
      // Index might not exist, continue
      spinner.text = `Creating index on ${projectName}...`;
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
    
    // Try to get document count (may not work on all serverless deployments)
    try {
      const countResponse = await client.count({ index: INDEX_NAME });
      console.log(chalk.green(`  Total documents in index: ${countResponse.count}`));
    } catch (e) {
      // Stats API might not be available on serverless, skip it
      console.log(chalk.gray(`  Index created with ${shakespeareData.length} documents`));
    }
    
  } catch (error) {
    spinner.fail(`Failed to setup index on ${projectName}`);
    throw error;
  }
}

export async function setupShakespeareIndex(useExtendedData = false, documentCount = 1000) {
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
    
    // Add extended data if requested
    if (useExtendedData) {
      console.log(chalk.cyan(`\n=== Adding ${documentCount} Extended Shakespeare Documents ===\n`));
      const extendedData = generateExtendedShakespeareData(documentCount);
      
      console.log(chalk.blue('\nAdding to EIS project...'));
      await addDocuments(eisClient, extendedData, 'EIS project');
      
      console.log(chalk.blue('\nAdding to ML Node project...'));
      await addDocuments(mlNodeClient, extendedData, 'ML Node project');
    }
    
    console.log(chalk.green('\n✓ Shakespeare index setup complete on both projects!\n'));
    
  } catch (error) {
    console.error(chalk.red('\nError setting up Shakespeare index:'), error.message);
    process.exit(1);
  }
}

async function addDocuments(client, documents, projectName) {
  const spinner = ora(`Adding ${documents.length} documents to ${projectName}`).start();
  
  try {
    const operations = documents.flatMap(doc => [
      { index: { _index: INDEX_NAME } },
      doc
    ]);
    
    const bulkResponse = await client.bulk({ 
      refresh: true, 
      operations 
    });
    
    if (bulkResponse.errors) {
      spinner.warn(`Some documents failed to index on ${projectName}`);
    } else {
      spinner.succeed(`Added ${documents.length} documents to ${projectName}`);
    }
  } catch (error) {
    spinner.fail(`Failed to add documents to ${projectName}`);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupShakespeareIndex();
}