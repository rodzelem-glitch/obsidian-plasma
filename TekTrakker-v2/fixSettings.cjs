const fs = require('fs');
const file = 'src/types/types.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /platformPaypalClientId\?: string;/,
  `platformPaypalClientId?: string;\n    franchiseFeePct?: number;\n    franchiseDiscountCodes?: { code: string; discountPct: number; active: boolean }[];`
);

fs.writeFileSync(file, content);
