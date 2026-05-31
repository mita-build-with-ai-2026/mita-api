import { GoogleGenAI } from '@google/genai';
import { config } from '../config/env.js';

let clientInstance = null;

function getClient() {
  if (!config.geminiApiKey) {
    return null;
  }
  if (!clientInstance) {
    clientInstance = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }
  return clientInstance;
}

export const geminiClient = {
  isAvailable() {
    return !!config.geminiApiKey;
  },

  async generateContent(prompt, options = {}) {
    const client = getClient();
    if (!client) {
      throw new Error('Gemini API Key no configurada. Por favor, agregue GEMINI_API_KEY a su archivo .env');
    }

    const model = options.model || 'gemini-3.5-flash';
    const contents = options.contents || prompt;
    
    const requestConfig = {
      model,
      contents,
      config: options.config || {}
    };

    try {
      const response = await client.models.generateContent(requestConfig);
      return response;
    } catch (error) {
      console.error('[Gemini Client] Error en generateContent:', error);
      throw error;
    }
  },

  async generateWithSearchGrounding(prompt, options = {}) {
    const client = getClient();
    if (!client) {
      throw new Error('Gemini API Key no configurada.');
    }

    const model = options.model || 'gemini-3.5-flash';
    
    const requestConfig = {
      model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        ...(options.config || {})
      }
    };

    try {
      const response = await client.models.generateContent(requestConfig);
      return response;
    } catch (error) {
      console.error('[Gemini Client] Error en generateWithSearchGrounding:', error);
      throw error;
    }
  },

  async generateEmbedding(text, options = {}) {
    const client = getClient();
    if (!client) {
      throw new Error('Gemini API Key no configurada.');
    }

    const model = options.model || 'gemini-embedding-2';
    const outputDimensionality = options.outputDimensionality || 768;

    try {
      const response = await client.models.embedContent({
        model,
        contents: text,
        config: {
          outputDimensionality
        }
      });
      
      if (response && response.embeddings && response.embeddings[0] && response.embeddings[0].values) {
        return response.embeddings[0].values;
      }
      throw new Error('Formato de respuesta de embedding inválido.');
    } catch (error) {
      console.error('[Gemini Client] Error en generateEmbedding:', error);
      throw error;
    }
  }
};
