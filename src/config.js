import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import inquirer from 'inquirer';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const CREDENTIALS_FILE = path.join(__dirname, '..', '.credentials.json');

export class Config {
  constructor() {
    this.credentials = {
      eisProject: null,
      mlNodeProject: null
    };
    this.loadCredentials();
  }

  loadCredentials() {
    try {
      if (fs.existsSync(CREDENTIALS_FILE)) {
        const data = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
        this.credentials = JSON.parse(data);
      }
    } catch (error) {
      console.error(chalk.yellow('Warning: Could not load credentials file'));
    }
  }

  saveCredentials() {
    try {
      fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(this.credentials, null, 2));
      console.log(chalk.green('Credentials saved locally (not tracked by git)'));
    } catch (error) {
      console.error(chalk.red('Error saving credentials:'), error.message);
    }
  }

  async promptForCredentials() {
    console.log(chalk.cyan('\n=== Serverless Project Configuration ===\n'));
    
    const questions = [
      {
        type: 'input',
        name: 'eisUrl',
        message: 'Enter .elser-2-elastic (EIS) serverless project URL:',
        default: this.credentials.eisProject?.url || '',
        validate: (input) => input.length > 0 || 'URL is required'
      },
      {
        type: 'input',
        name: 'eisApiKey',
        message: 'Enter .elser-2-elastic (EIS) API key:',
        default: this.credentials.eisProject?.apiKey || '',
        validate: (input) => input.length > 0 || 'API key is required'
      },
      {
        type: 'input',
        name: 'mlNodeUrl',
        message: 'Enter .elser-2-elasticsearch (ML Node) serverless project URL:',
        default: this.credentials.mlNodeProject?.url || '',
        validate: (input) => input.length > 0 || 'URL is required'
      },
      {
        type: 'input',
        name: 'mlNodeApiKey',
        message: 'Enter .elser-2-elasticsearch (ML Node) API key:',
        default: this.credentials.mlNodeProject?.apiKey || '',
        validate: (input) => input.length > 0 || 'API key is required'
      }
    ];

    const answers = await inquirer.prompt(questions);

    this.credentials = {
      eisProject: {
        url: answers.eisUrl,
        apiKey: answers.eisApiKey,
        modelId: '.elser-2-elastic'
      },
      mlNodeProject: {
        url: answers.mlNodeUrl,
        apiKey: answers.mlNodeApiKey,
        modelId: '.elser-2-elasticsearch'
      }
    };

    this.saveCredentials();
    return this.credentials;
  }

  async getCredentials() {
    if (!this.credentials.eisProject || !this.credentials.mlNodeProject) {
      await this.promptForCredentials();
    }
    return this.credentials;
  }

  getEisClient() {
    const { Client } = require('@elastic/elasticsearch');
    const creds = this.credentials.eisProject;
    
    if (!creds) {
      throw new Error('EIS project credentials not configured');
    }

    return new Client({
      node: creds.url,
      auth: {
        apiKey: creds.apiKey
      }
    });
  }

  getMlNodeClient() {
    const { Client } = require('@elastic/elasticsearch');
    const creds = this.credentials.mlNodeProject;
    
    if (!creds) {
      throw new Error('ML Node project credentials not configured');
    }

    return new Client({
      node: creds.url,
      auth: {
        apiKey: creds.apiKey
      }
    });
  }
}

export default new Config();