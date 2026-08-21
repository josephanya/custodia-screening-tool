import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  PrismaClient,
  ScoringBranch,
  ScoringRuleStatus,
} from "../lib/generated/prisma/client";
import { rulesetHash } from "../lib/hashing";
import { complicationRiskRules, riskOfDiabetesRules } from "../lib/scoring-rules";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const seededRulesets = [
  { branch: ScoringBranch.RISK_OF_DIABETES, rules: riskOfDiabetesRules },
  { branch: ScoringBranch.COMPLICATION_RISK, rules: complicationRiskRules },
];

async function main() {
  for (const { branch, rules } of seededRulesets) {
    const hash = rulesetHash(rules);
    const shared = {
      rules,
      rulesetHash: hash,
      status: ScoringRuleStatus.ACTIVE,
      createdBy: "seed",
      approvedBy: process.env.SCORING_RULE_APPROVER ?? "pending-clinical-approval",
      approvedAt: new Date(),
    };

    await prisma.scoringRuleVersion.upsert({
      where: {
        branch_versionNumber: {
          branch,
          versionNumber: rules.versionNumber,
        },
      },
      update: shared,
      create: {
        branch,
        versionNumber: rules.versionNumber,
        ...shared,
      },
    });

    await prisma.scoringRuleVersion.updateMany({
      where: {
        branch,
        versionNumber: { not: rules.versionNumber },
        status: ScoringRuleStatus.ACTIVE,
      },
      data: {
        status: ScoringRuleStatus.RETIRED,
        retiredAt: new Date(),
      },
    });

    console.log(`Seeded ${branch} v${rules.versionNumber} (${hash.slice(0, 12)}...)`);
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });