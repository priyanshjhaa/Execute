#!/usr/bin/env node
/**
 * Test script for OpenRouter integration
 * Run with: pnpm tsx src/test.ts
 */

import { createParser } from './parser.js';

async function testParser() {
  console.log('🧪 Testing OpenRouter Integration\n');

  try {
    const parser = createParser();

    // Test 1: Simple workflow
    console.log('Test 1: Simple workflow instruction');
    console.log('Instruction: "Send email when user signs up"\n');

    const result1 = await parser.parseInstruction({
      instruction: 'Send email when user signs up',
      userId: 'test-user-123',
    });

    console.log('Result:');
    console.log(JSON.stringify(result1, null, 2));
    console.log('\n✅ Test 1 completed!\n');

    // Test 2: Complex workflow
    console.log('Test 2: Complex workflow instruction');
    console.log('Instruction: "Send Slack message to #sales when high-value lead fills form, then create task in Asana"\n');

    const result2 = await parser.parseInstruction({
      instruction: 'Send Slack message to #sales when high-value lead fills form, then create task in Asana with lead details',
      userId: 'test-user-123',
    });

    console.log('Result:');
    console.log(JSON.stringify(result2, null, 2));
    console.log('\n✅ Test 2 completed!\n');

    console.log('🎉 All tests passed! OpenRouter integration is working.');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Run tests
testParser();
