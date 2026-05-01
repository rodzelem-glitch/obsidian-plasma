const fs = require('fs');
const file = 'src/types/types.ts';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes("franchiseId?: string;")) {
  content = content.replace(
    /role: 'master_admin' \| 'admin' \| 'employee' \| 'both' \| 'customer' \| 'supervisor' \| 'platform_sales' \| 'Technician' \| 'Subcontractor';/,
    `role: 'master_admin' | 'admin' | 'employee' | 'both' | 'customer' | 'supervisor' | 'platform_sales' | 'Technician' | 'Subcontractor' | 'franchise_admin';\n  franchiseId?: string;\n  taxW9Content?: string;`
  );

  content = content.replace(
    /export interface Organization \{/,
    `export interface Organization {\n    franchiseId?: string;\n    gustoOnboardingUrl?: string;\n    gustoCompanyUuid?: string;`
  );
}

if (!content.includes("export interface Franchise")) {
  content += `\nexport interface Franchise { id: string; name: string; status: string; currentRoyaltyPct: number; currentMarketingFeePct: number; franchiseAgreementSignature?: string; franchiseAgreementSignedDate?: string; overrideSetupFee?: number; stripeAccountId?: string | null; ownerId?: string; createdAt: string; }\n`;
}

if (!content.includes("paymentProofUrl?: string;")) {
  content = content.replace(
    /totalAmount: number;/,
    `totalAmount: number;\n    paymentProofUrl?: string;\n    paymentProofDate?: string;`
  );
}

if (!content.includes("franchiseDiscountCodes?:")) {
  content = content.replace(
    /platformPaypalClientId\?: string;/,
    `platformPaypalClientId?: string;\n    franchiseFeePct?: number;\n    franchiseDiscountCodes?: { code: string; discountPct: number; active: boolean }[];`
  );
}

fs.writeFileSync(file, content);
