export interface Franchise {
  id: string;
  name: string;
  ownerId: string; // User ID of the franchise_admin
  territory?: string;
  industry?: string;
  
  branding?: {
    appName?: string;
    logoUrl?: string;
    primaryColor?: string;
    customDomain?: string;
  };
  
  dnsConfig?: {
    domain?: string;
    records?: any;
    status?: string;
    provisionedAt?: any;
  };
  
  billingStatus: 'trial' | 'active' | 'past_due' | 'cancelled';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  
  billing?: {
    agreementSigned?: boolean;
    setupFeePaid?: boolean;
    monthlyFee?: number;
    perUserFee?: number;
    perVirtualWorkerFee?: number;
    signatureBase64?: string;
  };

  constraints?: {
    territoryStates?: string[];
    allowedBusinessTypes?: string[];
  };

  payoutConfig?: {
    stripeConnectAccountId?: string;
    percentageCut?: number;
  };
  
  aiApiKeys?: {
    openai?: string;
    anthropic?: string;
    gemini?: string;
    activeProvider?: 'openai' | 'anthropic' | 'gemini' | 'tektrakker';
  };
  
  createdAt: string;
}
