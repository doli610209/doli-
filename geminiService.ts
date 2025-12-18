
import { GoogleGenAI, Type } from "@google/genai";
import { FoodItem } from "./types";

// Always use process.env.API_KEY directly for the apiKey parameter as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const nutritionSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: 'The food item name in Traditional Chinese' },
    portion: { type: Type.STRING, description: 'The quantity or portion size (e.g., 1 cup 350ml) in Traditional Chinese' },
    calories: { type: Type.NUMBER, description: 'Estimated calories in kcal' },
    protein: { type: Type.NUMBER, description: 'Estimated protein in grams' },
    fat: { type: Type.NUMBER, description: 'Estimated fat in grams' },
    carbs: { type: Type.NUMBER, description: 'Estimated carbohydrates in grams' },
  },
  required: ['name', 'portion', 'calories', 'protein', 'fat', 'carbs'],
};

export const analyzeFoodInput = async (input: string | { base64: string, mimeType: string }): Promise<FoodItem> => {
  const model = 'gemini-3-flash-preview';
  const systemInstruction = `You are a professional nutritionist. 
  Your goal is to estimate the nutritional value of food items described in text or shown in photos. 
  Respond in Traditional Chinese. 
  Always provide a single consolidated food item entry.`;

  let contents;
  if (typeof input === 'string') {
    contents = `Analyze this food: "${input}"`;
  } else {
    contents = {
      parts: [
        { inlineData: { data: input.base64, mimeType: input.mimeType } },
        { text: "Estimate the calories and macros for the food in this photo." }
      ]
    };
  }

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: nutritionSchema
    }
  });

  const data = JSON.parse(response.text || '{}');
  return {
    ...data,
    id: Math.random().toString(36).substring(7),
  };
};
