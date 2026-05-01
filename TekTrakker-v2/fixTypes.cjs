const fs = require('fs');
const file = 'src/types/types.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /role: 'master_admin' \| 'admin' \| 'employee' \| 'both' \| 'customer' \| 'supervisor' \| 'platform_sales' \| 'Technician' \| 'Subcontractor';/,
  `role: 'master_admin' | 'admin' | 'employee' | 'both' | 'customer' | 'supervisor' | 'platform_sales' | 'Technician' | 'Subcontractor' | 'franchise_admin';\n  franchiseId?: string;\n  taxW9Content?: string;`
);

content = content.replace(
  /gustoClientSecret\?: string \| null;/,
  `gustoClientSecret?: string | null;\n    franchiseFeePct?: number;\n    franchiseDiscountCodes?: { code: string; discountPct: number; active: boolean }[];`
);

content = content.replace(
  /export interface Organization \{/,
  `export interface Organization {\n    franchiseId?: string;\n    gustoOnboardingUrl?: string;\n    gustoCompanyUuid?: string;`
);

content += `\nexport interface Franchise { id: string; name: string; status: string; currentRoyaltyPct: number; currentMarketingFeePct: number; franchiseAgreementSignature?: string; franchiseAgreementSignedDate?: string; overrideSetupFee?: number; stripeAccountId?: string | null; ownerId?: string; createdAt: string; }\n`;

content = content.replace(
  /totalAmount: number;/,
  `totalAmount: number;\n    paymentProofUrl?: string;\n    paymentProofDate?: string;`
);

fs.writeFileSync(file, content);
