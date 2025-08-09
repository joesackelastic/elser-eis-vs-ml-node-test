# ELSER EIS vs ML Node Test

A performance comparison tool for testing `.elser-2-elastic` (EIS) vs `.elser-2-elasticsearch` (ML Node) models on Elasticsearch serverless projects using the Shakespeare dataset.

## 🚀 Quick Start - Web Interface

The easiest way to use this tool is through the web interface:

```bash
# Install dependencies
npm install

# Start the web server
npm run server

# Open your browser to http://localhost:3000
```

## Features

- **Web Interface**: User-friendly browser-based interface with real-time updates
- **Dual Serverless Project Support**: Connect to two separate serverless projects simultaneously
- **Shakespeare Dataset**: Built-in Shakespeare text corpus for consistent testing
- **Multi-threaded Testing**: Concurrent query execution with configurable thread counts
- **Performance Metrics**: Comprehensive latency statistics (avg, min, max, median, p95, p99)
- **Multiple Test Modes**:
  - Single comparison
  - Benchmark with iterations
  - Multi-threaded concurrent testing
  - Load testing with sustained traffic
  - Stress testing to find breaking points
- **Real-time Updates**: WebSocket-based live test progress and results
- **Secure Credential Management**: Local credential caching (never committed to git)
- **Detailed Reporting**: Console tables, JSON exports, and HTML reports

## Installation

```bash
git clone https://github.com/yourusername/elser-eis-vs-ml-node-test.git
cd elser-eis-vs-ml-node-test
npm install
```

## Configuration

### First Time Setup

1. Configure your serverless project credentials:
```bash
npm run start config
```

You'll be prompted to enter:
- `.elser-2-elastic` (EIS) serverless project URL and API key
- `.elser-2-elasticsearch` (ML Node) serverless project URL and API key

Credentials are stored locally in `.credentials.json` (gitignored).

2. Setup the Shakespeare index on both projects:
```bash
npm run start setup
```

## Usage

### Web Interface (Recommended)

1. Start the server:
```bash
npm run server
```

2. Open your browser to `http://localhost:3000`

3. Enter your serverless project credentials in the web interface

4. Click "Setup Index" to initialize the Shakespeare dataset

5. Select a test type and configure parameters

6. Click "Start Test" to begin testing

The web interface provides:
- Real-time test progress and results
- Visual metrics and comparisons
- Easy test configuration
- Live console output
- Automatic credential saving (locally)

### Command Line Interface

```bash
# Show help
npm start

# Configure credentials
npm start config

# Setup Shakespeare index
npm start setup

# Run single comparison
npm start compare --query "love"

# Run benchmark
npm start benchmark --iterations 10 --queries "love" "death" "king"

# Run multi-threaded test
npm start multi-thread --concurrency 20 --count 100

# Run load test
npm start load-test --duration 60 --concurrency 10

# Run stress test
npm start stress-test --start 5 --max 50 --increment 5

# Interactive mode
npm start interactive
```

### Test Modes

#### Single Comparison
Runs a single query against both models and compares response times.

```bash
npm start compare --query "to be or not to be"
```

#### Benchmark
Runs multiple iterations of queries to get average performance metrics.

```bash
npm start benchmark --iterations 10 --queries "love" "death" "king" "sword" "night"
```

#### Multi-threaded Test
Executes queries concurrently to test throughput.

```bash
npm start multi-thread --concurrency 20 --count 100 --queries "love" "death"
```

#### Load Test
Sustains a constant load for a specified duration.

```bash
npm start load-test --duration 60 --concurrency 10 --target-qps 50
```

Options:
- `--duration`: Test duration in seconds
- `--concurrency`: Number of concurrent threads
- `--target-qps`: Target queries per second (optional)

#### Stress Test
Gradually increases load to find the breaking point.

```bash
npm start stress-test --start 5 --max 100 --increment 10 --duration 10
```

Options:
- `--start`: Starting concurrency level
- `--max`: Maximum concurrency level
- `--increment`: Step size for increasing concurrency
- `--duration`: Duration per step in seconds

## Output

### Console Output
- Real-time progress indicators
- Formatted tables with performance metrics
- Color-coded results for easy reading

### Saved Results
Results are automatically saved to the `results/` directory:
- JSON files with raw data
- HTML reports for browser viewing
- Timestamped for easy tracking

### Metrics Reported
- **Response Times**: Average, min, max, median
- **Percentiles**: P95, P99 for load tests
- **Throughput**: Queries per second (QPS)
- **Comparison**: Speedup factor between models
- **Success Rate**: For stress testing

## Project Structure

```
elser-eis-vs-ml-node-test/
├── src/
│   ├── index.js              # Main CLI entry point
│   ├── config.js             # Credential management
│   ├── shakespeare-data.js   # Shakespeare dataset
│   ├── setup-shakespeare.js  # Index setup utility
│   ├── elser-tester.js      # Core ELSER testing logic
│   ├── multi-thread-tester.js # Concurrent testing
│   └── reporter.js           # Results reporting
├── results/                  # Test results (gitignored)
├── package.json
├── .gitignore
└── README.md
```

## Security

- Credentials are stored locally in `.credentials.json`
- This file is automatically added to `.gitignore`
- Never commit credentials to version control
- Use environment-specific API keys with minimal required permissions

## Requirements

- Node.js 16+ 
- npm or yarn
- Access to two Elasticsearch serverless projects
- API keys for both projects with appropriate permissions

## Troubleshooting

### Connection Issues
- Verify your serverless project URLs are correct
- Check that API keys have the necessary permissions
- Ensure network connectivity to serverless endpoints

### Model Not Found
- Confirm that `.elser-2-elastic` is available on your EIS project
- Confirm that `.elser-2-elasticsearch` is available on your ML Node project

### Performance Issues
- Start with lower concurrency levels
- Monitor serverless project resource usage
- Check for rate limiting on your API keys

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT