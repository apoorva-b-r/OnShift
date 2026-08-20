import { Request, Response } from 'express';
import { DEMO_GOVERNMENT_SCHEMES } from '@onshift/mock-data';
import { SchemeMatch } from '@onshift/shared-types';

export const getSchemes = async (_req: Request, res: Response) => {
  return res.json(DEMO_GOVERNMENT_SCHEMES);
};

export const matchSchemes = async (req: Request, res: Response) => {
  const { monthlyIncome = 30100, workerType = 'Delivery Partner' } = req.body;

  const matches: SchemeMatch[] = DEMO_GOVERNMENT_SCHEMES.map((scheme) => {
    const incomeEligible =
      (!scheme.minMonthlyIncome || monthlyIncome >= scheme.minMonthlyIncome) &&
      (!scheme.maxMonthlyIncome || monthlyIncome <= scheme.maxMonthlyIncome);

    return {
      scheme,
      matchReason: incomeEligible
        ? `Worker profile matches income parameters and target role: ${workerType}`
        : `Income of INR ${monthlyIncome} exceeds maximum scheme threshold`,
      possibleEligibility: incomeEligible,
      requiredDocuments: scheme.documents,
    };
  });

  return res.json(matches);
};
