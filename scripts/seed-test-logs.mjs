#!/usr/bin/env node

/**
 * Seed test logs into OpenSearch for development/testing
 * This generates sample OTLP-format logs that match what the OTEL collector would send
 */

import { Client } from '@opensearch-project/opensearch';

const client = new Client({
  node: process.env.OPENSEARCH_URL || 'http://localhost:9200',
  ssl: {
    rejectUnauthorized: false,
  },
});

const SERVICES = [
  'api-gateway',
  'core-service',
  'reservations-command-service',
  'settings-service',
];

const SEVERITIES = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];

const SAMPLE_MESSAGES = {
  INFO: [
    'Request processed successfully',
    'Database connection established',
    'Cache hit for key',
    'Health check passed',
    'Background job completed',
  ],
  WARN: [
    'Slow query detected: 250ms',
    'Cache miss - fetching from database',
    'Rate limit approaching threshold',
    'Deprecated API endpoint used',
    'Connection pool at 80% capacity',
  ],
  ERROR: [
    'Database query failed: timeout',
    'External API returned 500',
    'Failed to parse request body',
    'Authentication failed for user',
    'Invalid tenant configuration',
  ],
  DEBUG: [
    'Processing request with payload',
    'Query executed in 45ms',
    'Cache statistics updated',
    'Middleware chain completed',
    'Session validated successfully',
  ],
  TRACE: [
    'Entering function: handleRequest',
    'Variable state before operation',
    'Loop iteration 42 of 100',
    'Function call stack depth: 5',
    'Memory allocation: 2048 bytes',
  ],
  FATAL: [
    'Unrecoverable error: system shutdown',
    'Critical security breach detected',
    'Database connection pool exhausted',
    'Out of memory error',
    'Core service unavailable',
  ],
};

const randomItem = (array) => array[Math.floor(Math.random() * array.length)];

const generateTraceId = () => {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
};

const generateSpanId = () => {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
};

const generateLogEntry = (timestamp) => {
  const service = randomItem(SERVICES);
  const severity = randomItem(SEVERITIES);
  const shouldHaveTrace = Math.random() > 0.3; // 70% have trace IDs

  const traceId = shouldHaveTrace ? generateTraceId() : undefined;
  const spanId = shouldHaveTrace ? generateSpanId() : undefined;

  const messages = SAMPLE_MESSAGES[severity] || SAMPLE_MESSAGES.INFO;
  const message = randomItem(messages);

  return {
    time: timestamp.toISOString(),
    observed_time: timestamp.toISOString(),
    severity_text: severity,
    severity_number: {
      TRACE: 1,
      DEBUG: 5,
      INFO: 9,
      WARN: 13,
      ERROR: 17,
      FATAL: 21,
    }[severity] || 9,
    body: {
      message,
      details: {
        duration_ms: Math.floor(Math.random() * 500),
        http_status_code: severity === 'ERROR' ? 500 : severity === 'WARN' ? 429 : 200,
      }
    },
    trace_id: traceId,
    span_id: spanId,
    attributes: {
      'http.method': randomItem(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
      'http.route': randomItem(['/api/v1/reservations', '/api/v1/guests', '/api/v1/rooms', '/health']),
      'tenant_id': randomItem(['tenant-001', 'tenant-002', 'tenant-003']),
      'user_id': Math.random() > 0.5 ? `user-${Math.floor(Math.random() * 100)}` : undefined,
      'environment': 'development',
    },
    resource: {
      'service.name': service,
      'service.version': '1.0.0',
      'service.instance.id': `${service}-${Math.floor(Math.random() * 3)}`,
      'deployment.environment': 'development',
      'host.name': 'localhost',
    },
  };
};

const createIndexIfNotExists = async (indexName) => {
  const exists = await client.indices.exists({ index: indexName });

  if (!exists.body) {
    console.log(`Creating index: ${indexName}`);
    await client.indices.create({
      index: indexName,
      body: {
        mappings: {
          properties: {
            time: { type: 'date' },
            observed_time: { type: 'date' },
            severity_text: { type: 'keyword' },
            severity_number: { type: 'integer' },
            body: { type: 'object', enabled: true },
            trace_id: { type: 'keyword' },
            span_id: { type: 'keyword' },
            attributes: { type: 'object', enabled: true },
            resource: { type: 'object', enabled: true },
          },
        },
      },
    });
  }
};

const seedLogs = async (count = 500) => {
  console.log(`🌱 Seeding ${count} test logs into OpenSearch...`);

  const now = new Date();
  const indexName = `otel-logs-${now.toISOString().split('T')[0].replace(/-/g, '.')}`;

  try {
    await createIndexIfNotExists(indexName);

    const logs = [];

    // Generate logs spanning the last 24 hours
    for (let i = 0; i < count; i++) {
      const minutesAgo = Math.floor(Math.random() * 1440); // Random time in last 24h
      const timestamp = new Date(now.getTime() - minutesAgo * 60 * 1000);
      logs.push(generateLogEntry(timestamp));
    }

    // Bulk insert
    const body = logs.flatMap(doc => [
      { index: { _index: indexName } },
      doc,
    ]);

    const bulkResponse = await client.bulk({ refresh: true, body });

    if (bulkResponse.body.errors) {
      const erroredDocuments = [];
      bulkResponse.body.items.forEach((action, i) => {
        const operation = Object.keys(action)[0];
        if (action[operation].error) {
          erroredDocuments.push({
            status: action[operation].status,
            error: action[operation].error,
          });
        }
      });
      console.error('❌ Some documents failed to index:', erroredDocuments);
    } else {
      console.log(`✅ Successfully indexed ${logs.length} log entries`);
      console.log(`📊 Index: ${indexName}`);

      // Show severity breakdown
      const breakdown = logs.reduce((acc, log) => {
        acc[log.severity_text] = (acc[log.severity_text] || 0) + 1;
        return acc;
      }, {});

      console.log('\n📈 Severity Breakdown:');
      Object.entries(breakdown)
        .sort(([, a], [, b]) => b - a)
        .forEach(([severity, count]) => {
          console.log(`   ${severity.padEnd(6)}: ${count}`);
        });

      console.log('\n🎉 Test data seeded successfully!');
      console.log('🔗 View logs at: http://localhost:4200/pms/logs');
    }
  } catch (error) {
    console.error('❌ Error seeding logs:', error);
    process.exit(1);
  }
};

// Run the seeding
const logCount = parseInt(process.argv[2] || '500', 10);
await seedLogs(logCount);
process.exit(0);
