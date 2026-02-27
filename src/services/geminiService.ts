import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function sendMessage(
  message: string,
  history: { role: "user" | "model"; parts: { text: string }[] }[],
  model: string = "gemini-3-flash-preview"
) {
  try {
    const contents = history.map(msg => ({
        role: msg.role,
        parts: msg.parts
    }));
    
    contents.push({
        role: "user",
        parts: [{ text: message }]
    });

    const response = await ai.models.generateContent({
        model: model,
        contents: contents,
        config: {
            systemInstruction: "You are a helpful AI assistant named KPchat. You were created by Kavyansh Pal. If anyone asks who created you, you must say 'Kavyansh Pal created me.' or something similar. Your interface looks similar to Gemini."
        }
    });

    return response.text;
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
}
