import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { ElserTester } from './src/elser-tester.js';
import { MultiThreadTester } from './src/multi-thread-tester.js';
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
                modelId: creds.eisProject?.modelId || '.elser-2-elastic'
            },
            mlNodeProject: {
                url: creds.mlNodeProject?.url || '',
                apiKey: creds.mlNodeProject?.apiKey || '',
                modelId: creds.mlNodeProject?.modelId || '.elser-2-elasticsearch'
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Verify ELSER models are deployed
app.post('/api/verify-models', async (req, res) => {
    try {
        const { eisProject, mlNodeProject } = req.body;
        
        // Check EIS ELSER model
        const eisModel = await checkElserModel(eisProject, '.elser-2-elastic');
        
        // Check ML Node ELSER model  
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
        
        // For serverless, we'll try a simpler approach
        // First try to create a test pipeline with the model
        try {
            const testPipelineName = `test-elser-${Date.now()}`;
            
            // Try to create a pipeline using the model
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
            
            // If we got here, the model is available
            // Clean up test pipeline
            await client.ingest.deletePipeline({ id: testPipelineName });
            
            return {
                available: true,
                modelId: expectedModelId,
                version: 'Available',
                type: 'elser',
                deployed: true
            };
            
        } catch (pipelineError) {
            // If pipeline creation failed, try a simpler check
            console.log(`Pipeline test failed for ${expectedModelId}: ${pipelineError.message}`);
            
            // Try to just check if we can access the cluster
            try {
                const info = await client.info();
                
                // If we can access the cluster but not create pipeline, model might not be deployed
                return {
                    available: false,
                    modelId: expectedModelId,
                    error: `Model ${expectedModelId} may not be deployed. Pipeline creation failed: ${pipelineError.message}`
                };
            } catch (infoError) {
                return {
                    available: false,
                    modelId: expectedModelId,
                    error: `Cannot connect to cluster: ${infoError.message}`
                };
            }
        }
        
    } catch (error) {
        return {
            available: false,
            modelId: expectedModelId,
            error: `Connection error: ${error.message}`
        };
    }
}

// Test connections to both projects
app.post('/api/test-connection', async (req, res) => {
    try {
        const { eisProject, mlNodeProject } = req.body;
        
        // Test EIS connection
        const eisConnection = await testProjectConnection(eisProject);
        
        // Test ML Node connection
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

// Setup Shakespeare index
app.post('/api/setup', async (req, res) => {
    try {
        const { eisProject, mlNodeProject } = req.body;
        
        // Update config with provided credentials
        config.credentials = { eisProject, mlNodeProject };
        config.saveCredentials();
        
        sendOutput('Starting Shakespeare index setup...', 'info');
        
        // Setup on both projects
        await setupShakespeareIndex();
        
        sendOutput('Shakespeare index setup completed successfully!', 'success');
        res.json({ success: true });
    } catch (error) {
        sendOutput(`Setup failed: ${error.message}`, 'error');
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start a test
app.post('/api/test', async (req, res) => {
    try {
        const testId = uuidv4();
        const { testType, queries, eisProject, mlNodeProject, ...params } = req.body;
        
        // Update config with provided credentials
        config.credentials = { eisProject, mlNodeProject };
        config.saveCredentials();
        
        // Create test instance
        const testInstance = {
            id: testId,
            type: testType,
            status: 'running',
            startTime: Date.now(),
            abortController: new AbortController()
        };
        
        activeTests.set(testId, testInstance);
        
        // Start test in background
        runTest(testId, testType, queries, params);
        
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

// Get test status
app.get('/api/test/:id', (req, res) => {
    const test = activeTests.get(req.params.id);
    if (test) {
        res.json({
            id: test.id,
            type: test.type,
            status: test.status,
            duration: Date.now() - test.startTime
        });
    } else {
        res.status(404).json({ error: 'Test not found' });
    }
});

// Run test function
async function runTest(testId, testType, queries, params) {
    const test = activeTests.get(testId);
    if (!test) return;
    
    try {
        broadcast({ type: 'status', status: 'running', message: `Running ${testType} test` });
        
        let tester;
        let results;
        
        switch (testType) {
            case 'compare':
                tester = new ElserTester();
                await tester.initialize();
                sendOutput(`Running single comparison for query: "${queries[0]}"`, 'info');
                
                results = await tester.compareModels(queries[0]);
                
                broadcast({
                    type: 'comparison',
                    results: [{
                        query: results.query,
                        eisTime: results.eisResult.duration,
                        mlNodeTime: results.mlNodeResult.duration,
                        faster: results.comparison.fasterModel,
                        speedup: results.comparison.speedupFactor
                    }]
                });
                
                sendOutput(`EIS: ${results.eisResult.duration}ms | ML Node: ${results.mlNodeResult.duration}ms`, 'success');
                sendOutput(`Faster: ${results.comparison.fasterModel} (${results.comparison.speedupFactor}x)`, 'info');
                break;
                
            case 'benchmark':
                tester = new ElserTester();
                await tester.initialize();
                const iterations = params.iterations || 5;
                
                sendOutput(`Starting benchmark with ${iterations} iterations per query`, 'info');
                
                results = await tester.runBenchmark(queries, iterations);
                
                const compResults = results.map(r => ({
                    query: r.query,
                    eisTime: Math.round(r.avgEisTime),
                    mlNodeTime: Math.round(r.avgMlNodeTime),
                    faster: r.fasterModel,
                    speedup: r.speedupFactor
                }));
                
                broadcast({ type: 'comparison', results: compResults });
                
                results.forEach(r => {
                    sendOutput(`Query: "${r.query}" - EIS avg: ${r.avgEisTime.toFixed(2)}ms, ML Node avg: ${r.avgMlNodeTime.toFixed(2)}ms`, 'info');
                });
                break;
                
            case 'multithread':
                tester = new MultiThreadTester();
                await tester.initialize();
                
                const totalQueries = params.totalQueries || 50;
                const concurrency = params.concurrency || 10;
                
                sendOutput(`Starting multi-threaded test: ${totalQueries} queries with ${concurrency} threads`, 'info');
                
                // Generate query array
                const queryArray = [];
                for (let i = 0; i < totalQueries; i++) {
                    queryArray.push(queries[i % queries.length]);
                }
                
                let completedQueries = 0;
                const originalCompareModels = tester.tester.compareModels.bind(tester.tester);
                tester.tester.compareModels = async function(query) {
                    const result = await originalCompareModels(query);
                    completedQueries++;
                    broadcast({
                        type: 'progress',
                        current: completedQueries,
                        total: totalQueries
                    });
                    return result;
                };
                
                results = await tester.runConcurrentQueries(queryArray, concurrency);
                
                broadcast({
                    type: 'metrics',
                    metrics: {
                        'Total Queries': results.stats.totalQueries,
                        'QPS': results.stats.queriesPerSecond,
                        'EIS Avg': `${results.stats.eis.avg}ms`,
                        'ML Node Avg': `${results.stats.mlNode.avg}ms`,
                        'EIS Median': `${results.stats.eis.median}ms`,
                        'ML Node Median': `${results.stats.mlNode.median}ms`
                    }
                });
                
                sendOutput(`Completed ${results.stats.totalQueries} queries in ${results.stats.totalDuration}ms`, 'success');
                sendOutput(`Queries per second: ${results.stats.queriesPerSecond}`, 'info');
                break;
                
            case 'load':
                tester = new MultiThreadTester();
                await tester.initialize();
                
                const duration = (params.duration || 30) * 1000;
                const loadConcurrency = params.concurrency || 10;
                
                sendOutput(`Starting load test for ${duration/1000} seconds with ${loadConcurrency} threads`, 'info');
                
                results = await tester.runLoadTest({
                    queries,
                    duration,
                    concurrency: loadConcurrency,
                    targetQPS: params.targetQps
                });
                
                broadcast({
                    type: 'metrics',
                    metrics: {
                        'Duration': `${results.stats.duration}s`,
                        'Total Queries': results.stats.totalQueries,
                        'Actual QPS': results.stats.actualQPS,
                        'EIS P95': `${results.stats.eis.p95}ms`,
                        'ML Node P95': `${results.stats.mlNode.p95}ms`,
                        'Success Rate': `${((results.stats.successfulQueries / results.stats.totalQueries) * 100).toFixed(1)}%`
                    }
                });
                
                sendOutput(`Load test completed: ${results.stats.totalQueries} queries, ${results.stats.actualQPS} QPS`, 'success');
                break;
                
            case 'embed':
                sendOutput(`Starting ELSER embedding test`, 'info');
                sendOutput(`Models being used:`, 'info');
                sendOutput(`  EIS: .elser-2-elastic`, 'info');
                sendOutput(`  ML Node: .elser-2-elasticsearch`, 'info');
                
                const embedTarget = params.embedTarget || 'both';
                const documentCount = params.documentCount || 100;
                
                tester = new ElserTester();
                await tester.initialize();
                
                const embedResults = [];
                
                if (embedTarget === 'both' || embedTarget === 'eis') {
                    sendOutput(`\nCreating ELSER embeddings for ${documentCount} documents on EIS...`, 'info');
                    sendOutput(`Using model: .elser-2-elastic`, 'info');
                    const eisResult = await tester.embedDocuments(true, documentCount);
                    embedResults.push(eisResult);
                    
                    if (eisResult.success) {
                        sendOutput(`✓ EIS embedding completed in ${eisResult.duration}ms`, 'success');
                        sendOutput(`  Documents embedded: ${eisResult.documentsProcessed}`, 'info');
                        sendOutput(`  Model used: .elser-2-elastic`, 'success');
                    } else {
                        sendOutput(`✗ EIS embedding failed: ${eisResult.error}`, 'error');
                    }
                }
                
                if (embedTarget === 'both' || embedTarget === 'mlnode') {
                    sendOutput(`\nCreating ELSER embeddings for ${documentCount} documents on ML Node...`, 'info');
                    sendOutput(`Using model: .elser-2-elasticsearch`, 'info');
                    const mlResult = await tester.embedDocuments(false, documentCount);
                    embedResults.push(mlResult);
                    
                    if (mlResult.success) {
                        sendOutput(`✓ ML Node embedding completed in ${mlResult.duration}ms`, 'success');
                        sendOutput(`  Documents embedded: ${mlResult.documentsProcessed}`, 'info');
                        sendOutput(`  Model used: .elser-2-elasticsearch`, 'success');
                    } else {
                        sendOutput(`✗ ML Node embedding failed: ${mlResult.error}`, 'error');
                    }
                }
                
                // Send metrics for display
                const successfulResults = embedResults.filter(r => r.success);
                if (successfulResults.length > 0) {
                    const metrics = {};
                    successfulResults.forEach(r => {
                        metrics[`${r.projectType} Time`] = `${r.duration}ms`;
                        metrics[`${r.projectType} Docs`] = r.documentsProcessed;
                        metrics[`${r.projectType} Model`] = r.projectType === 'EIS' ? '.elser-2-elastic' : '.elser-2-elasticsearch';
                    });
                    
                    if (successfulResults.length === 2) {
                        const speedup = successfulResults[0].duration < successfulResults[1].duration 
                            ? (successfulResults[1].duration / successfulResults[0].duration).toFixed(2)
                            : (successfulResults[0].duration / successfulResults[1].duration).toFixed(2);
                        metrics['Speedup'] = `${speedup}x`;
                        metrics['Faster'] = successfulResults[0].duration < successfulResults[1].duration ? 'EIS' : 'ML Node';
                    }
                    
                    broadcast({ type: 'metrics', metrics });
                }
                
                sendOutput(`\n=== ELSER Embedding Test Completed ===`, 'success');
                sendOutput(`Models used:`, 'info');
                sendOutput(`  • EIS: .elser-2-elastic`, 'info');
                sendOutput(`  • ML Node: .elser-2-elasticsearch`, 'info');
                sendOutput(`You can now run search tests using ELSER semantic search.`, 'success');
                break;
                
            case 'stress':
                tester = new MultiThreadTester();
                await tester.initialize();
                
                sendOutput(`Starting stress test from ${params.startConcurrency} to ${params.maxConcurrency} threads`, 'info');
                
                results = await tester.runStressTest({
                    queries,
                    startConcurrency: params.startConcurrency || 5,
                    maxConcurrency: params.maxConcurrency || 50,
                    stepSize: params.stepSize || 5,
                    stepDuration: (params.stepDuration || 10) * 1000
                });
                
                const optimalResult = results.reduce((best, current) => {
                    const currentQPS = parseFloat(current.actualQPS);
                    const bestQPS = parseFloat(best.actualQPS);
                    return currentQPS > bestQPS ? current : best;
                });
                
                broadcast({
                    type: 'metrics',
                    metrics: {
                        'Optimal Threads': optimalResult.concurrency,
                        'Max QPS': optimalResult.actualQPS,
                        'EIS Avg @Optimal': `${optimalResult.eis.avg}ms`,
                        'ML Node Avg @Optimal': `${optimalResult.mlNode.avg}ms`
                    }
                });
                
                sendOutput(`Stress test completed. Optimal: ${optimalResult.concurrency} threads, ${optimalResult.actualQPS} QPS`, 'success');
                break;
        }
        
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
    console.log(`Open your browser and navigate to http://localhost:${PORT}`);
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