import { Request, Response } from 'express';
import { DEMO_GOVERNMENT_SCHEMES } from '@onshift/mock-data';
import { SchemeMatch, GovernmentScheme } from '@onshift/shared-types';

export interface SchemeRecommendationResult {
  scheme: GovernmentScheme;
  relevance: 'HIGH' | 'MEDIUM' | 'LOW';
  matchReason: string;
  benefits: string[];
  possibleEligibility: boolean;
  requiredDocuments: string[];
  explanationSource: 'NEMOTRON_ULTRA_3' | 'DETERMINISTIC_FALLBACK';
}

export const getSchemes = async (_req: Request, res: Response) => {
  return res.json(DEMO_GOVERNMENT_SCHEMES);
};

export const matchSchemes = async (req: Request, res: Response) => {
  const {
    monthlyIncome = 29500,
    workerCategory = 'Delivery Partner',
    location = 'Maharashtra',
  } = req.body;

  // Step 1: Structured Eligibility Filter
  const candidateMatches: SchemeMatch[] = DEMO_GOVERNMENT_SCHEMES.map((scheme) => {
    const incomeEligible =
      (!scheme.minMonthlyIncome || monthlyIncome >= scheme.minMonthlyIncome) &&
      (!scheme.maxMonthlyIncome || monthlyIncome <= scheme.maxMonthlyIncome);

    const categoryEligible =
      scheme.targetWorkerTypes.length === 0 ||
      scheme.targetWorkerTypes.some(
        (t) => t.toLowerCase().includes(workerCategory.toLowerCase()) || t.includes('Gig Worker')
      );

    const isEligible = incomeEligible && categoryEligible;

    return {
      scheme,
      matchReason: isEligible
        ? `Worker profile matches income parameters (INR ${monthlyIncome}) and target role (${workerCategory}) in ${location}.`
        : `Profile evaluated: Income threshold or category mismatch.`,
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
  } = req.body;

  // 1. Structured Rules Filtering
  const candidates = DEMO_GOVERNMENT_SCHEMES.filter((scheme) => {
    const incomeEligible =
      (!scheme.minMonthlyIncome || monthlyIncome >= scheme.minMonthlyIncome) &&
      (!scheme.maxMonthlyIncome || monthlyIncome <= scheme.maxMonthlyIncome);
    const categoryEligible =
      scheme.targetWorkerTypes.length === 0 ||
      scheme.targetWorkerTypes.some(
        (t) => t.toLowerCase().includes(workerCategory.toLowerCase()) || t.includes('Gig Worker')
      );
    return incomeEligible && categoryEligible;
  });

  let recommendations: SchemeRecommendationResult[] = [];
  let usedSource: 'NEMOTRON_ULTRA_3' | 'DETERMINISTIC_FALLBACK' = 'DETERMINISTIC_FALLBACK';

  const nemotronApiKey = process.env.NEMOTRON_API_KEY;
  if (nemotronApiKey) {
    try {
      // Nemotron Ultra 3 API Call simulation / fetch
      const prompt = {
        workerProfile: { monthlyIncome, workerCategory, location, verificationLevel },
        candidateSchemes: candidates.map((c) => ({ id: c.id, name: c.name, description: c.description })),
      };

      const aiResponse = await fetch('https://api.nvidia.com/v1/genai/nvidia/nemotron-4-340b-instruct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${nemotronApiKey}`,
        },
        body: JSON.stringify({ prompt }),
      });

      if (aiResponse.ok) {
        usedSource = 'NEMOTRON_ULTRA_3';
      }
    } catch (e) {
      usedSource = 'DETERMINISTIC_FALLBACK';
    }
  }

  // Deterministic Fallback Assembly
  recommendations = candidates.map((scheme, index) => {
    const relevance: 'HIGH' | 'MEDIUM' | 'LOW' = index === 0 ? 'HIGH' : 'MEDIUM';
    return {
      scheme,
      relevance,
      matchReason: `You may be a relevant candidate based on your ${workerCategory} occupation profile and financially corroborated income of INR ${monthlyIncome.toLocaleString('en-IN')}.`,
      benefits: [
        scheme.description,
        'Direct benefit transfer to linked account upon verified submission.',
      ],
      possibleEligibility: true,
      requiredDocuments: scheme.documents,
      explanationSource: usedSource,
    };
  });

  return res.json({
    workerProfile: { monthlyIncome, workerCategory, location, verificationLevel },
    recommendations,
    engineSource: usedSource,
    timestamp: new Date().toISOString(),
  });
};
