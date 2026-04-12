import { GoogleGenAI } from "@google/genai";

import { getSecret } from './config-helper';

export interface AIParsedMetadata {
    title?: string;
    description?: string;
    tags?: string[];
    categories?: string[];
    attributions?: Array<{ name: string; url: string; role: string }>;
    summary?: string;
}

export async function enrichResourceMetadata(
    url: string, 
    context: { title?: string; description?: string; existingTags?: string[] }
): Promise<AIParsedMetadata> {
    const apiKey = await getSecret('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }
    const client = new GoogleGenAI({ apiKey });
    
    const model = 'gemini-2.5-flash';
    
    const systemInstruction = `
        You are an expert AI resource curator for the Stillwater Pro Suite. 
        Analyze the following resource information and provide high-quality, professional metadata.
        
        Guidelines:
        - title: A polished, optimized title.
        - description: A detailed, engaging 2-3 sentence description.
        - tags: An array of 5-8 relevant SEO-friendly tags.
        - categories: An array of 1-3 categories selected from this list: [Prompt Engineering, Image Generation, Text Generation, Code Generation, Video Generation, Audio Generation, Chatbot Development, API Integration, Best Practices, Advanced Techniques, Beginner Guide, Use Cases, Comparison, News & Updates, Research, Tools & Plugins, Templates, Workflow].
        - attributions: Suggested creator information if identifiable.
        - summary: A concise 1-sentence summary for quick previews.

        Return ONLY valid JSON.
    `;

    const userPrompt = `
        URL: ${url}
        Title Context: ${context.title || "Unknown"}
        Description Context: ${context.description || "None provided"}
    `;

    try {
        const result = await client.models.generateContent({
            model,
            contents: [
                { role: 'user', parts: [{ text: userPrompt }] }
            ],
            config: {
                systemInstruction: { parts: [{ text: systemInstruction }] },
                responseMimeType: 'application/json'
            }
        });

        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text) {
            throw new Error("Empty response from AI");
        }

        try {
            return JSON.parse(text) as AIParsedMetadata;
        } catch (e) {
            // Handle case where it might wrap in markdown even though we asked for JSON
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]) as AIParsedMetadata;
            }
            throw e;
        }
    } catch (error: any) {
        console.error("AI Enrichment Error:", error);
        // Special handling for 503/High Demand to provide a cleaner message
        if (error.message?.includes('503') || error.message?.includes('high demand')) {
            throw new Error("The AI engine is currently overloaded. Please try again in a few seconds.");
        }
        throw error;
    }
}
