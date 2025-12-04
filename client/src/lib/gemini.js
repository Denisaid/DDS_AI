import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

// Check if API key is configured
const apiKey = import.meta.env.VITE_GEMINI_PUBLIC_KEY;

if (!apiKey) {
  console.error('VITE_GEMINI_PUBLIC_KEY is not set in environment variables');
}

// Initialize GoogleGenerativeAI instance
// Note: The SDK uses v1beta by default, which supports gemini-pro
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Function to get model - creates it dynamically
export const getModel = () => {
  if (!genAI) {
    console.error('GoogleGenerativeAI not initialized - missing API key');
    console.error('Please set VITE_GEMINI_PUBLIC_KEY in your .env file');
    return null;
  }

  // Try latest models first, then fallback to older ones
  // With SDK 0.24.1+, newer models should work with v1 API
  const modelsToTry = [
    'gemini-2.0-flash-exp',  // Latest experimental model
    'gemini-1.5-flash-latest', // Latest stable flash model
    'gemini-1.5-pro-latest',   // Latest stable pro model
    'gemini-1.5-flash',        // Stable flash model
    'gemini-1.5-pro',          // Stable pro model
    'gemini-pro'               // Fallback - works with v1beta
  ];

  for (const modelName of modelsToTry) {
    try {
      console.log(`Attempting to load model: ${modelName}`);
      const model = genAI.getGenerativeModel({ 
        model: modelName, 
        safetySettings 
      });
      console.log(`Successfully created model instance: ${modelName}`);
      return model;
    } catch (error) {
      console.warn(`Failed to create ${modelName}:`, error.message);
      // Continue to next model
    }
  }

  console.error('Failed to create any Gemini model');
  return null;
};

// Export model instance for backward compatibility
const model = getModel();

export default model;