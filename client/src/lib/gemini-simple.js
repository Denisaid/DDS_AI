// Simplified Gemini configuration - fallback approach
import { GoogleGenerativeAI } from '@google/generative-ai';

// Check if API key is configured
const apiKey = import.meta.env.VITE_GEMINI_PUBLIC_KEY;

if (!apiKey) {
  console.error('VITE_GEMINI_PUBLIC_KEY is not set in environment variables');
  console.error('Please create a .env file in the client folder with your API key');
}

// Initialize GoogleGenerativeAI instance
// Use v1beta for gemini-pro compatibility
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Simple function to get model without safety settings (in case they cause issues)
export const getSimpleModel = () => {
  if (!genAI) {
    console.error('GoogleGenerativeAI not initialized - missing API key');
    return null;
  }

  // Try latest models first, then fallback to older ones
  const modelsToTry = [
    'gemini-2.0-flash-exp',      // Latest experimental
    'gemini-1.5-flash-latest',   // Latest stable flash
    'gemini-1.5-pro-latest',     // Latest stable pro
    'gemini-1.5-flash',          // Stable flash
    'gemini-1.5-pro',            // Stable pro
    'gemini-pro'                 // Fallback
  ];
  
  for (const modelName of modelsToTry) {
    try {
      console.log(`Creating simple ${modelName} model...`);
      const model = genAI.getGenerativeModel({ 
        model: modelName
      });
      console.log(`Successfully created simple ${modelName} model`);
      return model;
    } catch (error) {
      console.warn(`Failed to create ${modelName}:`, error.message);
      // Continue to next model
    }
  }
  
  console.error('Failed to create any simple model');
  return null;
};

export default getSimpleModel();
