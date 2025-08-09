import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { ElserTester } from './src/elser-tester.js';
import { setupShakespeareIndex } from './src/setup-shakespeare.js';
import config from './src/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Store active tests
const activeTests = new Map();

// WebSocket setup
let wss;
const clients = new Set();

// Broadcast to all connected clients
function broadcast(data) {
    const message = JSON.stringify(data);
    clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(message);
        }
    });
}

// Send console output to clients
function sendOutput(message, level = 'info') {
    broadcast({
        type: 'output',
        message,
        level,
        timestamp: new Date().toISOString()
    });
}

// API Routes

// Get saved credentials (from local cache only, never from version control)
app.get('/api/credentials', async (req, res) => {
    try {
        const creds = config.credentials;
        // Return full credentials from local cache
        // These are stored in .credentials.json which is gitignored
        res.json({
            eisProject: {
                url: creds.eisProject?.url || '',
                apiKey: creds.eisProject?.apiKey || '',
                modelId: '.elser-2-elastic'
            },
            mlNodeProject: {
                url: creds.mlNodeProject?.url || '',
                apiKey: creds.mlNodeProject?.apiKey || '',
                modelId: '.elser-2-elasticsearch'
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Test connections to both projects
app.post('/api/test-connection', async (req, res) => {
    try {
        const { eisProject, mlNodeProject } = req.body;
        
        // Update config
        config.credentials = { eisProject, mlNodeProject };
        config.saveCredentials();
        
        // Test connections
        const eisConnection = await testProjectConnection(eisProject);
        const mlNodeConnection = await testProjectConnection(mlNodeProject);
        
        res.json({
            eisConnection,
            mlNodeConnection
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

async function testProjectConnection(project) {
    try {
        const { Client } = await import('@elastic/elasticsearch');
        const client = new Client({
            node: project.url,
            auth: {
                apiKey: project.apiKey
            }
        });
        
        const info = await client.info();
        return {
            success: true,
            cluster: info.name,
            version: info.version.number
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// Verify ELSER models are deployed
app.post('/api/verify-models', async (req, res) => {
    try {
        const { eisProject, mlNodeProject } = req.body;
        
        // Update config
        config.credentials = { 
            eisProject: { ...eisProject, modelId: '.elser-2-elastic' },
            mlNodeProject: { ...mlNodeProject, modelId: '.elser-2-elasticsearch' }
        };
        config.saveCredentials();
        
        // Check models
        const eisModel = await checkElserModel(eisProject, '.elser-2-elastic');
        const mlNodeModel = await checkElserModel(mlNodeProject, '.elser-2-elasticsearch');
        
        res.json({
            eisModel,
            mlNodeModel
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

async function checkElserModel(project, expectedModelId) {
    try {
        const { Client } = await import('@elastic/elasticsearch');
        const client = new Client({
            node: project.url,
            auth: {
                apiKey: project.apiKey
            }
        });
        
        // For serverless, try to create a test pipeline with the model
        try {
            const testPipelineName = `test-elser-${Date.now()}`;
            
            await client.ingest.putPipeline({
                id: testPipelineName,
                body: {
                    description: `Test pipeline for ${expectedModelId}`,
                    processors: [
                        {
                            inference: {
                                model_id: expectedModelId,
                                field_map: {
                                    'text_field': 'text_field'
                                }
                            }
                        }
                    ]
                }
            });
            
            // Clean up test pipeline
            await client.ingest.deletePipeline({ id: testPipelineName });
            
            return {
                available: true,
                modelId: expectedModelId,
                version: 'Deployed',
                deployed: true
            };
            
        } catch (pipelineError) {
            console.log(`Model check failed for ${expectedModelId}: ${pipelineError.message}`);
            return {
                available: false,
                modelId: expectedModelId,
                error: `Model may not be deployed: ${pipelineError.message}`
            };
        }
        
    } catch (error) {
        return {
            available: false,
            modelId: expectedModelId,
            error: `Connection error: ${error.message}`
        };
    }
}

// Setup Shakespeare index
app.post('/api/setup', async (req, res) => {
    try {
        const { eisProject, mlNodeProject } = req.body;
        
        // Update config
        config.credentials = { 
            eisProject: { ...eisProject, modelId: '.elser-2-elastic' },
            mlNodeProject: { ...mlNodeProject, modelId: '.elser-2-elasticsearch' }
        };
        config.saveCredentials();
        
        sendOutput('Starting Shakespeare index setup...', 'info');
        
        // Setup on both projects
        await setupShakespeareIndex(false, 0); // Just base data
        
        sendOutput('Shakespeare index setup completed successfully!', 'success');
        res.json({ success: true });
    } catch (error) {
        sendOutput(`Setup failed: ${error.message}`, 'error');
        res.status(500).json({ success: false, error: error.message });
    }
});

// ELSER Embedding Test
app.post('/api/embed-test', async (req, res) => {
    try {
        const testId = uuidv4();
        const { documentCount, batchSize, threads, target, eisProject, mlNodeProject } = req.body;
        
        // Update config
        config.credentials = { 
            eisProject: { ...eisProject, modelId: '.elser-2-elastic' },
            mlNodeProject: { ...mlNodeProject, modelId: '.elser-2-elasticsearch' }
        };
        config.saveCredentials();
        
        // Create test instance
        const testInstance = {
            id: testId,
            status: 'running',
            startTime: Date.now(),
            abortController: new AbortController()
        };
        
        activeTests.set(testId, testInstance);
        
        // Start test in background
        runEmbeddingTest(testId, {
            documentCount,
            batchSize: batchSize || 100,
            threads: threads || 1,
            target
        });
        
        res.json({ id: testId, status: 'started' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Stop a test
app.post('/api/test/:id/stop', (req, res) => {
    const test = activeTests.get(req.params.id);
    if (test) {
        test.abortController.abort();
        test.status = 'stopped';
        sendOutput('Test stopped by user', 'warning');
        broadcast({ type: 'complete', testId: req.params.id });
        activeTests.delete(req.params.id);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Test not found' });
    }
});

// Run ELSER embedding test
async function runEmbeddingTest(testId, params) {
    const test = activeTests.get(testId);
    if (!test) return;
    
    try {
        sendOutput('=== Starting ELSER Embedding Performance Test ===', 'info');
        sendOutput(`Documents to embed: ${params.documentCount}`, 'info');
        sendOutput(`Batch size: ${params.batchSize}`, 'info');
        sendOutput(`Concurrent operations: ${params.threads}`, 'info');
        sendOutput('', 'info');
        
        const tester = new ElserTester();
        await tester.initialize();
        
        const results = [];
        
        if (params.target === 'both' || params.target === 'eis') {
            sendOutput('--- EIS Project (.elser-2-elastic) ---', 'info');
            broadcast({
                type: 'progress',
                processed: 0,
                total: params.documentCount,
                operation: 'Starting EIS embedding'
            });
            
            const startTime = Date.now();
            const eisResult = await tester.embedDocuments(true, params.documentCount);
            const duration = Date.now() - startTime;
            
            if (eisResult.success) {
                sendOutput(`✓ EIS embedding completed`, 'success');
                sendOutput(`  Model: .elser-2-elastic`, 'info');
                sendOutput(`  Time: ${duration}ms`, 'info');
                sendOutput(`  Documents: ${eisResult.documentsProcessed}`, 'info');
                sendOutput(`  Rate: ${(eisResult.documentsProcessed / (duration / 1000)).toFixed(2)} docs/sec`, 'success');
                
                results.push({
                    project: 'EIS',
                    model: '.elser-2-elastic',
                    duration,
                    documents: eisResult.documentsProcessed,
                    rate: (eisResult.documentsProcessed / (duration / 1000)).toFixed(2)
                });
            } else {
                sendOutput(`✗ EIS embedding failed: ${eisResult.error}`, 'error');
            }
            sendOutput('', 'info');
        }
        
        if (params.target === 'both' || params.target === 'mlnode') {
            sendOutput('--- ML Node Project (.elser-2-elasticsearch) ---', 'info');
            broadcast({
                type: 'progress',
                processed: 0,
                total: params.documentCount,
                operation: 'Starting ML Node embedding'
            });
            
            const startTime = Date.now();
            const mlResult = await tester.embedDocuments(false, params.documentCount);
            const duration = Date.now() - startTime;
            
            if (mlResult.success) {
                sendOutput(`✓ ML Node embedding completed`, 'success');
                sendOutput(`  Model: .elser-2-elasticsearch`, 'info');
                sendOutput(`  Time: ${duration}ms`, 'info');
                sendOutput(`  Documents: ${mlResult.documentsProcessed}`, 'info');
                sendOutput(`  Rate: ${(mlResult.documentsProcessed / (duration / 1000)).toFixed(2)} docs/sec`, 'success');
                
                results.push({
                    project: 'ML Node',
                    model: '.elser-2-elasticsearch',
                    duration,
                    documents: mlResult.documentsProcessed,
                    rate: (mlResult.documentsProcessed / (duration / 1000)).toFixed(2)
                });
            } else {
                sendOutput(`✗ ML Node embedding failed: ${mlResult.error}`, 'error');
            }
        }
        
        // Send comparison metrics if both were tested
        if (results.length === 2) {
            sendOutput('', 'info');
            sendOutput('=== Performance Comparison ===', 'success');
            
            const eisResult = results.find(r => r.project === 'EIS');
            const mlResult = results.find(r => r.project === 'ML Node');
            
            const speedup = eisResult.duration < mlResult.duration 
                ? (mlResult.duration / eisResult.duration).toFixed(2)
                : (eisResult.duration / mlResult.duration).toFixed(2);
            
            const faster = eisResult.duration < mlResult.duration ? 'EIS' : 'ML Node';
            
            broadcast({
                type: 'metrics',
                metrics: {
                    'EIS Time': `${eisResult.duration}ms`,
                    'ML Node Time': `${mlResult.duration}ms`,
                    'EIS Rate': `${eisResult.rate} docs/sec`,
                    'ML Node Rate': `${mlResult.rate} docs/sec`,
                    'Faster': faster,
                    'Speedup': `${speedup}x`
                }
            });
            
            sendOutput(`Faster model: ${faster} (${speedup}x faster)`, 'success');
            sendOutput(`EIS: ${eisResult.rate} docs/sec`, 'info');
            sendOutput(`ML Node: ${mlResult.rate} docs/sec`, 'info');
        }
        
        sendOutput('', 'info');
        sendOutput('=== Test Completed ===', 'success');
        test.status = 'completed';
        broadcast({ type: 'complete', testId });
        
    } catch (error) {
        sendOutput(`Test error: ${error.message}`, 'error');
        test.status = 'failed';
        broadcast({ type: 'error', message: error.message, testId });
    } finally {
        activeTests.delete(testId);
    }
}

// Start server
const server = app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Open your browser to http://localhost:${PORT}/simple.html`);
});

// Setup WebSocket server
wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('New WebSocket client connected');
    
    ws.on('close', () => {
        clients.delete(ws);
        console.log('WebSocket client disconnected');
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
    
    // Send initial connection confirmation
    ws.send(JSON.stringify({
        type: 'status',
        status: 'idle',
        message: 'Connected to server'
    }));
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    
    // Stop all active tests
    activeTests.forEach(test => {
        test.abortController.abort();
    });
    
    // Close WebSocket connections
    clients.forEach(client => {
        client.close();
    });
    
    server.close(() => {
        console.log('Server shut down');
        process.exit(0);
    });
});