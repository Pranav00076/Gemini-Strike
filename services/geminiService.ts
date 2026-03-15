
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getTacticalBriefing = async (level: number): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a futuristic AI tactical commander. Give a short, 2-sentence mission briefing for Level ${level} of a space shooter. The player uses hand gestures to shoot digital drones. Make it sound urgent and high-tech.`,
      config: {
        temperature: 0.8,
        topP: 0.9,
      },
    });
    return response.text || "Commander, standard protocol active. Eliminate all digital anomalies.";
  } catch (error) {
    console.error("Gemini Briefing Error:", error);
    return "Tactical data stream interrupted. Proceed with caution.";
  }
};

export const getTauntOrPraise = async (isVictory: boolean, score: number): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a futuristic tactical commander. Give a 1-sentence ${isVictory ? 'praise' : 'encouragement'} based on a score of ${score} in an AR hand-tracking game.`,
      config: {
        temperature: 1.0,
      },
    });
    return response.text || "Systems nominal.";
  } catch (error) {
    return isVictory ? "Outstanding performance." : "Recalibrating for next mission.";
  }
};
