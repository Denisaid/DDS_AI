// Simple test script to verify Gemini API key
// Run with: node test-gemini-api.js

import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
dotenv.config({ path: join(__dirname, '.env') });

const apiKey = process.env.VITE_GEMINI_PUBLIC_KEY;

console.log('=== Gemini API Test ===\n');
console.log('API Key present:', !!apiKey);
console.log('API Key length:', apiKey?.length);
console.log('API Key preview:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT SET\n');

if (!apiKey) {
  console.error('❌ ERROR: VITE_GEMINI_PUBLIC_KEY is not set in .env file');
  console.error('Please create a .env file with: VITE_GEMINI_PUBLIC_KEY=your-api-key');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

// Test different models
const modelsToTest = ['gemini-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'];

for (const modelName of modelsToTest) {
  try {
    console.log(`\nTesting model: ${modelName}...`);
    const model = genAI.getGenerativeModel({ model: modelName });
    
    const result = await model.generateContent('Say hello in one word');
    const response = await result.response;
    const text = response.text();
    
    console.log(`✅ ${modelName} works! Response: ${text}`);
    break; // If one works, we're good
  } catch (error) {
    console.log(`❌ ${modelName} failed: ${error.message}`);
  }
}

console.log('\n=== Test Complete ===');

