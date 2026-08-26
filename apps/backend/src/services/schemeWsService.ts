import { WebSocket } from 'ws';
import { SCHEMES, checkEligibility } from '../controllers/schemeController';

// --- Types -------------------------------------------------------------------

interface WsWorkerProfile {
  monthlyIncome?: number;
  workerCategory?: string;
  location?: string;
  verificationLevel?: string;
  age?: number;
}

export interface WsSchemeRecommendation {
  schemeId: string;
  schemeName: string;
  description: string;
  relevance: 'HIGH' | 'MEDIUM' | 'LOW';
  matchReason: string;
  benefits: string[];
  applicationUrl: string;
  explanationSource: 'NEMOTRON_ULTRA_3' | 'DETERMINISTIC_FALLBACK';
}

// --- Helpers -----------------------------------------------------------------

function sendWs(ws: WebSocket, type: string, payload: object): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload }));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Streams the matchReason text word-by-word as scheme:chunk events.
 * Gives the Android app a live typewriter streaming effect.
 */
async function streamReasonChunks(ws: WebSocket, schemeId: string, text: string): Promise<void> {
  const words = text.split(' ');
  for (let i = 0; i < words.length; i++) {
    // Leading space on every word after the first so the client can just concatenate
    const chunk = (i === 0 ? '' : ' ') + words[i];
    sendWs(ws, 'scheme:chunk', { schemeId, text: chunk });
    await sleep(30);
  }
}

// --- Main Handler ------------------------------------------------------------

/**
 * Handles a `scheme:recommend` WebSocket message from the Android app.
 *
 * Flow:
 *  1. Deterministic eligibility filter (fast, no API cost)
 *  2. Call OpenRouter -> Nemotron Ultra 253B for AI-ranked recommendations
 *  3. Stream each scheme's matchReason word-by-word via `scheme:chunk`
 *  4. Send `scheme:complete` with the full recommendations list
 *
 * Falls back to deterministic ranking if no API key or if the AI call fails.
 */
export async function handleSchemeRecommendWs(
  ws: WebSocket,
  workerProfile: WsWorkerProfile
): Promise<void> {
  const {
    monthlyIncome = 29500,
    workerCategory = 'Delivery Partner',
    location = 'Maharashtra',
    verificationLevel = 'FINANCIALLY_CORROBORATED',
    age,
  } = workerProfile;

  const profile = { monthlyIncome, workerCategory, location, age };

  // 1. Deterministic filter -- always runs before the LLM
  const candidateSchemes = SCHEMES.filter((scheme) => checkEligibility(scheme, profile));

  const apiKey = process.env.OPENROUTER_API_KEY;
  const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  const model = process.env.OPENROUTER_MODEL || 'nvidia/llama-3.1-nemotron-ultra-253b-v1';

  let recommendations: WsSchemeRecommendation[] = [];
  let engineSource: 'NEMOTRON_ULTRA_3' | 'DETERMINISTIC_FALLBACK' = 'DETERMINISTIC_FALLBACK';

  // 2. OpenRouter / Nemotron Ultra call
  if (apiKey && apiKey !== 'your_openrouter_api_key_here' && candidateSchemes.length > 0) {
    try {
      const candidateSummary = candidateSchemes.slice(0, 10).map((c) => ({
        id: c.id,
        name: c.name,
        category: c.category,
        description: c.description,
      }));

      const systemPrompt =
        'You are OnShift Nemotron Ultra 3 AI, an expert advisor for government scheme recommendations. ' +
        'Evaluate candidate schemes for a gig worker profile. ' +
        'Respond strictly in valid JSON format with a key "recommendations" containing an array of objects. ' +
        'Each object must have "schemeId" (string matching candidate id), ' +
        '"relevance" ("HIGH" | "MEDIUM" | "LOW"), ' +
        'and "matchReason" (string starting with "You may be a relevant candidate...").';

      const userPrompt = JSON.stringify({
        workerProfile: { monthlyIncome, workerCategory, location, verificationLevel },
        candidateSchemes: candidateSummary,
      });

      const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://onshift.app',
          'X-Title': 'OnShift Nemotron Ultra',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
          max_tokens: 1024,
        }),
      });

      if (aiResponse.ok) {
        const data = (await aiResponse.json()) as any;
        const aiText: string = data?.choices?.[0]?.message?.content || '';
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed && Array.isArray(parsed.recommendations)) {
            const aiRecMap = new Map<string, any>(
              parsed.recommendations.map((r: any) => [r.schemeId, r])
            );

            recommendations = candidateSchemes.map((scheme) => {
              const aiRec = aiRecMap.get(scheme.id);
              return {
                schemeId: scheme.id,
                schemeName: scheme.name,
                description: scheme.description,
                relevance: (aiRec?.relevance || 'HIGH') as 'HIGH' | 'MEDIUM' | 'LOW',
                matchReason:
                  aiRec?.matchReason ||
                  `You may be a relevant candidate based on your ${workerCategory} occupation profile ` +
                    `and financially corroborated income of INR ${monthlyIncome.toLocaleString('en-IN')}.`,
                benefits: scheme.benefits?.length > 0 ? scheme.benefits : [scheme.description],
                applicationUrl: scheme.applicationUrl || '',
                explanationSource: 'NEMOTRON_ULTRA_3',
              };
            });
            engineSource = 'NEMOTRON_ULTRA_3';
          }
        }
      }
    } catch (_e) {
      // Fall through to deterministic fallback
    }
  }

  // 3. Deterministic fallback -- runs if API key missing, call failed, or empty result
  if (recommendations.length === 0) {
    engineSource = 'DETERMINISTIC_FALLBACK';
    recommendations = candidateSchemes.map((scheme, index) => ({
      schemeId: scheme.id,
      schemeName: scheme.name,
      description: scheme.description,
      relevance: (
        scheme.category === 'A' || index < 3 ? 'HIGH' : index < 7 ? 'MEDIUM' : 'LOW'
      ) as 'HIGH' | 'MEDIUM' | 'LOW',
      matchReason:
        `You may be a relevant candidate based on your ${workerCategory} occupation profile ` +
        `and financially corroborated income of INR ${monthlyIncome.toLocaleString('en-IN')}.`,
      benefits: scheme.benefits?.length > 0 ? scheme.benefits : [scheme.description],
      applicationUrl: scheme.applicationUrl || '',
      explanationSource: 'DETERMINISTIC_FALLBACK',
    }));
  }

  // 4. Stream matchReason word-by-word for each scheme -> typewriter effect in Android app
  for (const rec of recommendations) {
    if (ws.readyState !== WebSocket.OPEN) break;
    await streamReasonChunks(ws, rec.schemeId, rec.matchReason);
  }

  // 5. Send final complete event with all recommendations
  sendWs(ws, 'scheme:complete', {
    recommendations,
    engineSource,
  });
}
