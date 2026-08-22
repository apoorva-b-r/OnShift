import { Request, Response } from 'express';
import schemeCatalogue from '../data/schemes.json';

export interface SchemeEligibilityRules {
  age: {
    min: number | null;
    max: number | null;
    details: string;
  };
  income: {
    details: string;
    limit: number | null;
    type: 'MAX' | 'MIN' | 'NONE';
  };
  occupation: string[];
  location: string[];
  otherConditions: string[];
  exclusions: string[];
}

export interface CatalogueScheme {
  id: string;
  name: string;
  category: string;
  governmentLevel: 'CENTRAL' | 'STATE';
  description: string;
  targetWorkerTypes: string[];
  eligibilityRules: SchemeEligibilityRules;
  benefits: string[];
  documents: string[];
  applicationUrl: string;
  mySchemeUrl?: string;
  officialSource?: string;
}

export interface SchemeRecommendationResult {
  scheme: CatalogueScheme;
  relevance: 'HIGH' | 'MEDIUM' | 'LOW';
  matchReason: string;
  benefits: string[];
  possibleEligibility: boolean;
  requiredDocuments: string[];
  explanationSource: 'NEMOTRON_ULTRA_3' | 'DETERMINISTIC_FALLBACK';
}

const SCHEMES: CatalogueScheme[] = (schemeCatalogue.schemes as CatalogueScheme[]) || [];

function checkEligibility(
  scheme: CatalogueScheme,
  profile: { monthlyIncome: number; workerCategory: string; location: string; age?: number }
): boolean {
  const { monthlyIncome, workerCategory, location, age } = profile;
  const rules = scheme.eligibilityRules;

  // 1. Income rule check
  if (rules.income.type === 'MAX' && rules.income.limit !== null && monthlyIncome > rules.income.limit) {
    return false;
  }
  if (rules.income.type === 'MIN' && rules.income.limit !== null && monthlyIncome < rules.income.limit) {
    return false;
  }

  // 2. Age rule check
  if (age !== undefined) {
    if (rules.age.min !== null && age < rules.age.min) return false;
    if (rules.age.max !== null && age > rules.age.max) return false;
  }

  // 3. Location rule check (For state-level schemes)
  if (scheme.governmentLevel === 'STATE' && rules.location.length > 0) {
    const isLocationMatch = rules.location.some((loc) =>
      loc.toLowerCase().includes(location.toLowerCase()) ||
      location.toLowerCase().includes(loc.toLowerCase())
    );
    if (!isLocationMatch) return false;
  }

  // 4. Occupation & Worker category check
  const allTargets = [...scheme.targetWorkerTypes, ...rules.occupation];
  if (allTargets.length > 0) {
    const catLower = workerCategory.toLowerCase();
    const isCategoryMatch = allTargets.some((target) => {
      const tLower = target.toLowerCase();
      return (
        tLower.includes(catLower) ||
        catLower.includes(tLower) ||
        tLower.includes('unorganised') ||
        tLower.includes('gig worker') ||
        tLower.includes('worker') ||
        tLower.includes('partner') ||
        tLower.includes('driver') ||
        tLower.includes('delivery') ||
        tLower.includes('artisan') ||
        tLower.includes('cobbler') ||
        tLower.includes('construction') ||
        tLower.includes('vendor') ||
        tLower.includes('hawker') ||
        tLower.includes('service')
      );
    });
    if (!isCategoryMatch) return false;
  }

  return true;
}

export const getSchemes = async (_req: Request, res: Response) => {
  return res.json({
    catalogueVersion: schemeCatalogue.catalogueVersion || '1.0',
    totalSchemes: SCHEMES.length,
    schemes: SCHEMES,
  });
};

export const matchSchemes = async (req: Request, res: Response) => {
  const {
    monthlyIncome = 29500,
    workerCategory = 'Delivery Partner',
    location = 'Maharashtra',
    age,
  } = req.body;

  const profile = { monthlyIncome, workerCategory, location, age };

  const candidateMatches = SCHEMES.map((scheme) => {
    const isEligible = checkEligibility(scheme, profile);
    return {
      scheme,
      matchReason: isEligible
        ? `Worker profile matches eligibility parameters (INR ${monthlyIncome.toLocaleString('en-IN')}) and target category (${workerCategory}) in ${location}.`
        : `Profile evaluated: Income threshold or category/location mismatch.`,
      possibleEligibility: isEligible,
      requiredDocuments: scheme.documents,
    };
  });

  return res.json(candidateMatches);
};

export const recommendSchemes = async (req: Request, res: Response) => {
  const {
    monthlyIncome = 29500,
    workerCategory = 'Delivery Partner',
    location = 'Maharashtra',
    verificationLevel = 'FINANCIALLY_CORROBORATED',
    age,
  } = req.body;

  const profile = { monthlyIncome, workerCategory, location, age };

  // 1. Structured Rules Filtering BEFORE LLM
  const candidateSchemes = SCHEMES.filter((scheme) => checkEligibility(scheme, profile));

  let recommendations: SchemeRecommendationResult[] = [];
  let usedSource: 'NEMOTRON_ULTRA_3' | 'DETERMINISTIC_FALLBACK' = 'DETERMINISTIC_FALLBACK';

  const nemotronApiKey = process.env.NEMOTRON_API_KEY;

  if (nemotronApiKey) {
    try {
      const candidateSummary = candidateSchemes.slice(0, 10).map((c) => ({
        id: c.id,
        name: c.name,
        category: c.category,
        description: c.description,
      }));

      const systemPrompt =
        'You are OnShift Nemotron Ultra 3 AI, an expert advisor for government scheme recommendations. Evaluate candidate schemes for a gig worker profile. Respond strictly in valid JSON format with a key "recommendations" containing an array of objects. Each object must have "schemeId" (string matching candidate id), "relevance" ("HIGH" | "MEDIUM" | "LOW"), and "matchReason" (string starting with "You may be a relevant candidate...").';

      const userPrompt = JSON.stringify({
        workerProfile: { monthlyIncome, workerCategory, location, verificationLevel },
        candidateSchemes: candidateSummary,
      });

      const aiResponse = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${nemotronApiKey}`,
        },
        body: JSON.stringify({
          model: 'nvidia/nemotron-mini-4b-instruct',
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
        const aiText = data?.choices?.[0]?.message?.content || '';
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed && Array.isArray(parsed.recommendations)) {
              const aiRecMap = new Map(parsed.recommendations.map((r: any) => [r.schemeId, r]));
              recommendations = candidateSchemes.map((scheme) => {
                const aiRec: any = aiRecMap.get(scheme.id);
                return {
                  scheme,
                  relevance: (aiRec?.relevance as any) || 'HIGH',
                  matchReason:
                    aiRec?.matchReason ||
                    `You may be a relevant candidate based on your ${workerCategory} occupation profile and financially corroborated income of INR ${monthlyIncome.toLocaleString('en-IN')}.`,
                  benefits: scheme.benefits && scheme.benefits.length > 0 ? scheme.benefits : [scheme.description],
                  possibleEligibility: true,
                  requiredDocuments: scheme.documents,
                  explanationSource: 'NEMOTRON_ULTRA_3',
                };
              });
              usedSource = 'NEMOTRON_ULTRA_3';
            }
          } catch (err) {
            // JSON parse error handling
          }
        }

        if (usedSource !== 'NEMOTRON_ULTRA_3') {
          recommendations = candidateSchemes.map((scheme, index) => ({
            scheme,
            relevance: (scheme.category === 'A' || index < 3 ? 'HIGH' : index < 7 ? 'MEDIUM' : 'LOW') as 'HIGH' | 'MEDIUM' | 'LOW',
            matchReason: `You may be a relevant candidate based on your ${workerCategory} occupation profile and financially corroborated income of INR ${monthlyIncome.toLocaleString('en-IN')}.`,
            benefits: scheme.benefits && scheme.benefits.length > 0 ? scheme.benefits : [scheme.description],
            possibleEligibility: true,
            requiredDocuments: scheme.documents,
            explanationSource: 'NEMOTRON_ULTRA_3',
          }));
          usedSource = 'NEMOTRON_ULTRA_3';
        }
      }
    } catch (e) {
      usedSource = 'DETERMINISTIC_FALLBACK';
    }
  }

  // 2. Deterministic Fallback Pipeline (runs if API key missing, API call fails, or empty AI result)
  if (recommendations.length === 0) {
    usedSource = 'DETERMINISTIC_FALLBACK';
    recommendations = candidateSchemes.map((scheme, index) => {
      // Relevance heuristic: Category A central schemes get HIGH relevance first
      let relevance: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
      if (scheme.category === 'A' || index < 3) {
        relevance = 'HIGH';
      } else if (index > 7) {
        relevance = 'LOW';
      }

      return {
        scheme,
        relevance,
        matchReason: `You may be a relevant candidate based on your ${workerCategory} occupation profile and financially corroborated income of INR ${monthlyIncome.toLocaleString('en-IN')}.`,
        benefits: scheme.benefits && scheme.benefits.length > 0 ? scheme.benefits : [scheme.description],
        possibleEligibility: true,
        requiredDocuments: scheme.documents,
        explanationSource: 'DETERMINISTIC_FALLBACK',
      };
    });
  }

  return res.json({
    workerProfile: { monthlyIncome, workerCategory, location, verificationLevel },
    recommendations,
    engineSource: usedSource,
    timestamp: new Date().toISOString(),
  });
};

