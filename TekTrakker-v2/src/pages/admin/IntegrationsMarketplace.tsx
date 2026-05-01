import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { doc, getDoc, setDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import showToast from 'lib/toast';
import {
  ArrowLeft, Search, Filter, CheckCircle2, Plus, ExternalLink, Key, Shield,
  CreditCard, FileText, TrendingUp, Truck, Users, Phone, Camera, Wrench,
  BarChart3, ShieldCheck, Globe, Star, Zap, Package, Lock, GraduationCap,
  Banknote, ShoppingCart, Headphones, Hammer, AlertCircle,
  Cpu, Home, Leaf, Thermometer, MessageSquare, Mail, PhoneCall, CloudSun, Code, Copy
} from 'lucide-react';

// ── Integration catalog ──
interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ElementType;
  iconColor: string;
  fields: { key: string; label: string; type?: string; placeholder?: string }[];
  learnMoreUrl?: string;
  platformLevel?: boolean;
  isStubbed?: boolean;
}

const CATEGORIES = [
  'All', 'Accounting', 'Payment Gateways', 'Marketing & CRM', 'Reviews & Reputation',
  'Fleet & GPS', 'HR & Payroll', 'Call Tracking', 'On-The-Job', 'Workflow Automation',
  'Estimations', 'Business Intelligence', 'E-Commerce', 'Financing', 'IoT & Telemetry',
  'Training', 'Warranty', 'Supply Chain', 'Communications', 'GovTech API', 'Geospatial API', 'Javascript Embed'
];

const INTEGRATIONS: Integration[] = [
  { id: 'qb_desktop', name: 'QuickBooks Desktop', description: 'Sync invoices and payments with your QuickBooks Desktop instance via Web Connector.', category: 'Accounting', icon: FileText, iconColor: 'text-green-600', fields: [{ key: 'qbDesktopCompanyFile', label: 'Company File Path', placeholder: 'C:\\Users\\...\\Company.qbw' }], learnMoreUrl: 'https://quickbooks.intuit.com/desktop/', isStubbed: true },
  { id: 'quickbooks_online', name: 'QuickBooks Online', description: 'Two-way sync your invoices, customers, and payments directly into QuickBooks online to keep your ledger accurate.', category: 'Accounting', icon: FileText, iconColor: 'text-green-600', fields: [{ key: 'quickbooksConnected', label: 'OAuth Setup Required (Type "true" to simulate)', placeholder: 'true' }], isStubbed: true },
  { id: 'acumatica', name: 'Acumatica', description: 'Enterprise ERP integration for multi-entity accounting, job costing, and AP/AR automation.', category: 'Accounting', icon: FileText, iconColor: 'text-blue-700', fields: [{ key: 'acumaticaUrl', label: 'Instance URL', placeholder: 'https://yourcompany.acumatica.com' }, { key: 'acumaticaUser', label: 'API Username' }, { key: 'acumaticaPassword', label: 'API Password', type: 'password' }], isStubbed: true },
  { id: 'netsuite', name: 'NetSuite (Oracle)', description: 'Sync financials, customers, and work orders with your Oracle NetSuite ERP.', category: 'Accounting', icon: FileText, iconColor: 'text-red-700', fields: [{ key: 'netsuiteAccountId', label: 'Account ID' }, { key: 'netsuiteConsumerKey', label: 'Consumer Key' }, { key: 'netsuiteConsumerSecret', label: 'Consumer Secret', type: 'password' }, { key: 'netsuiteTokenId', label: 'Token ID' }, { key: 'netsuiteTokenSecret', label: 'Token Secret', type: 'password' }], isStubbed: true },
  // Payment Gateways
  { id: 'stripe', name: 'Stripe', description: 'Connect Stripe to process credit card payments natively inside invoices. Accept all major credit cards securely.', category: 'Payment Gateways', icon: CreditCard, iconColor: 'text-indigo-500', fields: [{ key: 'stripePublicKey', label: 'Publishable Key', placeholder: 'pk_live_...' }] },
  { id: 'square', name: 'Square', description: 'Connect Square to process card payments or sync transactions.', category: 'Payment Gateways', icon: CreditCard, iconColor: 'text-slate-800 dark:text-slate-200', fields: [{ key: 'squareAppId', label: 'Application ID', placeholder: 'sq0idp-...' }, { key: 'squareLocId', label: 'Location ID', placeholder: 'L...' }, { key: 'squareToken', label: 'Square Personal Access Token', type: 'password', placeholder: 'EAAAE...' }] },
  { id: 'paypal', name: 'PayPal', description: 'Accept payments directly via PayPal.', category: 'Payment Gateways', icon: CreditCard, iconColor: 'text-blue-500', fields: [{ key: 'paypalClientId', label: 'Client ID', placeholder: 'Enter Live Client ID' }] },
  // Financing
  { id: 'hearth', name: 'Hearth', description: 'Offer customers instant financing options directly on proposals and invoices.', category: 'Financing', icon: CreditCard, iconColor: 'text-teal-600', fields: [{ key: 'hearthApiKey', label: 'API Key', type: 'password', placeholder: 'hearth_...' }], learnMoreUrl: 'https://www.gethearth.com' },
  // Marketing & CRM
  { id: 'google_ads', name: 'Google Ads', description: 'Track ad spend ROI by linking your Google Ads account for lead attribution.', category: 'Marketing & CRM', icon: TrendingUp, iconColor: 'text-blue-500', fields: [{ key: 'googleAdsCustomerId', label: 'Customer ID', placeholder: '123-456-7890' }, { key: 'googleAdsDeveloperToken', label: 'Developer Token', type: 'password' }] },
  { id: 'google_lsa', name: 'Google Local Services Ads', description: 'Import Google Guaranteed leads directly into your dispatch board.', category: 'Marketing & CRM', icon: Globe, iconColor: 'text-green-500', fields: [{ key: 'googleLsaAccountId', label: 'LSA Account ID' }] },
  { id: 'mailchimp', name: 'Mailchimp', description: 'Sync your customer list for automated email marketing campaigns and newsletters.', category: 'Marketing & CRM', icon: TrendingUp, iconColor: 'text-yellow-600', fields: [{ key: 'mailchimpApiKey', label: 'API Key', type: 'password', placeholder: 'xxxxxxxx-us21' }, { key: 'mailchimpListId', label: 'Audience/List ID' }], learnMoreUrl: 'https://mailchimp.com' },
  { id: 'hubspot', name: 'HubSpot', description: 'Two-way CRM sync for contacts, deals, and marketing analytics.', category: 'Marketing & CRM', icon: TrendingUp, iconColor: 'text-orange-500', fields: [{ key: 'hubspotAccessToken', label: 'Private App Access Token', type: 'password', placeholder: 'pat-na1-...' }], learnMoreUrl: 'https://www.hubspot.com' },
  // Reviews & Reputation
  { id: 'podium', name: 'Podium', description: 'Automate review requests via text message after every completed job.', category: 'Reviews & Reputation', icon: Star, iconColor: 'text-blue-600', fields: [{ key: 'podiumApiKey', label: 'API Key', type: 'password' }, { key: 'podiumLocationUid', label: 'Location UID' }], learnMoreUrl: 'https://www.podium.com' },
  { id: 'broadly', name: 'Broadly', description: 'Automated review generation and customer feedback collection after service.', category: 'Reviews & Reputation', icon: Star, iconColor: 'text-green-600', fields: [{ key: 'broadlyApiKey', label: 'API Key', type: 'password' }], learnMoreUrl: 'https://broadly.com' },
  { id: 'birdeye', name: 'Birdeye', description: 'Manage online reputation across 200+ review sites from a single dashboard.', category: 'Reviews & Reputation', icon: Star, iconColor: 'text-indigo-600', fields: [{ key: 'birdeyeApiKey', label: 'API Key', type: 'password' }, { key: 'birdeyeBusinessId', label: 'Business ID' }], learnMoreUrl: 'https://birdeye.com' },
  // Fleet & GPS
  { id: 'gps_insight', name: 'GPS Insight', description: 'Real-time fleet tracking, driver behavior scoring, and route optimization.', category: 'Fleet & GPS', icon: Truck, iconColor: 'text-blue-600', fields: [{ key: 'gpsInsightUsername', label: 'Username' }, { key: 'gpsInsightPassword', label: 'Password', type: 'password' }, { key: 'gpsInsightAppToken', label: 'App Token', type: 'password' }], isStubbed: true },
  { id: 'clearpath_gps', name: 'ClearPath GPS', description: 'Live vehicle tracking with geofence alerts and maintenance reminders.', category: 'Fleet & GPS', icon: Truck, iconColor: 'text-emerald-600', fields: [{ key: 'clearPathApiKey', label: 'API Key', type: 'password' }], isStubbed: true },
  { id: 'azuga', name: 'Azuga', description: 'Fleet management with driver safety scores and fuel usage analytics.', category: 'Fleet & GPS', icon: Truck, iconColor: 'text-orange-500', fields: [{ key: 'azugaApiKey', label: 'API Key', type: 'password' }, { key: 'azugaWebhooksUrl', label: 'Webhook URL (Optional)' }], isStubbed: true },
  { id: 'onestep_gps', name: 'One Step GPS', description: 'Budget-friendly GPS tracking with no monthly per-vehicle fees.', category: 'Fleet & GPS', icon: Truck, iconColor: 'text-purple-600', fields: [{ key: 'oneStepApiKey', label: 'API Key', type: 'password' }], isStubbed: true },
  { id: 'us_fleet', name: 'US Fleet Tracking', description: 'Simple, reliable fleet tracking with live map and history playback.', category: 'Fleet & GPS', icon: Truck, iconColor: 'text-red-600', fields: [{ key: 'usFleetUsername', label: 'Username' }, { key: 'usFleetPassword', label: 'Password', type: 'password' }], isStubbed: true },
  { id: 'zubie', name: 'Zubie', description: 'Vehicle health monitoring, trip tracking, and OBD-II diagnostics.', category: 'Fleet & GPS', icon: Truck, iconColor: 'text-cyan-600', fields: [{ key: 'zubieClientId', label: 'Client ID' }, { key: 'zubieApiKey', label: 'API Key', type: 'password' }], isStubbed: true },
  { id: 'intouch_gps', name: 'InTouch GPS', description: 'Enterprise fleet tracking with driver ID and temperature monitoring.', category: 'Fleet & GPS', icon: Truck, iconColor: 'text-teal-600', fields: [{ key: 'inTouchApiKey', label: 'API Key', type: 'password' }], isStubbed: true },
  { id: 'smart_fleet', name: 'Smart Fleet / Fleet Nova', description: 'AI-powered fleet management with predictive maintenance alerts.', category: 'Fleet & GPS', icon: Truck, iconColor: 'text-slate-700', fields: [{ key: 'smartFleetApiKey', label: 'API Key', type: 'password' }], isStubbed: true },
  { id: 'samsara', name: 'Samsara Fleet Tracking', description: 'Connect Samsara to enable real-time fleet visibility on the dispatch board and automate technician arrival times.', category: 'Fleet & GPS', icon: Truck, iconColor: 'text-blue-600', fields: [{ key: 'samsaraApiKey', label: 'Samsara API Token', type: 'password', placeholder: 'Enter Samsara Token...' }] },
  // Call Tracking
  { id: 'callrail', name: 'CallRail', description: 'Track which marketing campaigns drive phone calls with dynamic number insertion.', category: 'Call Tracking', icon: Phone, iconColor: 'text-green-600', fields: [{ key: 'callRailApiKey', label: 'API Key (v3)', type: 'password' }, { key: 'callRailAccountId', label: 'Account ID' }], learnMoreUrl: 'https://www.callrail.com' },
  // On-The-Job
  { id: 'companycam', name: 'CompanyCam', description: 'Auto-sync GPS-stamped job site photos to every work order and invoice.', category: 'On-The-Job', icon: Camera, iconColor: 'text-blue-500', fields: [{ key: 'companyCamApiKey', label: 'API Key', type: 'password' }], learnMoreUrl: 'https://companycam.com' },
  // Leads
  { id: 'hatch', name: 'Hatch', description: 'AI-powered lead follow-up via text, email, and voicemail drops.', category: 'Marketing & CRM', icon: Zap, iconColor: 'text-yellow-500', fields: [{ key: 'hatchBoardId', label: 'Board ID' }, { key: 'hatchApiKey', label: 'API Key', type: 'password' }], learnMoreUrl: 'https://www.usehatchapp.com', isStubbed: true },
  // Estimations
  { id: 'sumoquote', name: 'SumoQuote', description: 'Generate professional, interactive roofing and exterior quotes with good-better-best options.', category: 'Estimations', icon: Wrench, iconColor: 'text-red-500', fields: [{ key: 'sumoQuoteApiKey', label: 'API Key', type: 'password' }], learnMoreUrl: 'https://sumoquote.com', isStubbed: true },
  // BI
  { id: 'domo', name: 'Domo', description: 'Connect your business data to Domo for advanced dashboards and executive reporting.', category: 'Business Intelligence', icon: BarChart3, iconColor: 'text-blue-600', fields: [{ key: 'domoClientId', label: 'Client ID' }, { key: 'domoClientSecret', label: 'Client Secret', type: 'password' }], learnMoreUrl: 'https://www.domo.com', isStubbed: true },
  { id: 'powerbi', name: 'Microsoft Power BI', description: 'Push operational data into Power BI for custom reports and data visualization.', category: 'Business Intelligence', icon: BarChart3, iconColor: 'text-amber-500', fields: [{ key: 'powerBiTenantId', label: 'Tenant ID' }, { key: 'powerBiClientId', label: 'Client ID' }, { key: 'powerBiClientSecret', label: 'Client Secret', type: 'password' }], isStubbed: true },
  // E-Commerce
  { id: 'shopify', name: 'Shopify', description: 'Sync your product catalog and orders with your Shopify storefront.', category: 'E-Commerce', icon: Package, iconColor: 'text-green-600', fields: [{ key: 'shopifyStoreDomain', label: 'Store Domain', placeholder: 'yourstore.myshopify.com' }, { key: 'shopifyAccessToken', label: 'Admin API Access Token', type: 'password' }], learnMoreUrl: 'https://shopify.com' },
  // Workflow Automation
  { id: 'webhook', name: 'Zapier / Webhooks', description: 'Use this secure Webhook Endpoint to automatically inject Leads into your Dispatch Board.', category: 'Workflow Automation', icon: Zap, iconColor: 'text-orange-500', fields: [{ key: 'webhookSecretKey', label: 'Webhook API Key', type: 'password', placeholder: 'Enter a secure key...' }] },
  // IoT & Telemetry
  { id: 'seam', name: 'Seam API', description: 'Connect once to the Seam API Gateway to bypass individual approvals and instantly unlock telemetry access.', category: 'IoT & Telemetry', icon: Cpu, iconColor: 'text-emerald-500', fields: [{ key: 'seamApiKey', label: 'Seam Workspace API Key', type: 'password', placeholder: 'seam_live_...' }] },
  { id: 'nest', name: 'Google Nest', description: 'Bring your own Google Device Access Console keys for a direct, free connection to Nest Thermostats.', category: 'IoT & Telemetry', icon: Home, iconColor: 'text-blue-500', fields: [{ key: 'nestProjectId', label: 'Device Access Project ID' }, { key: 'nestClientId', label: 'Google Cloud Client ID' }, { key: 'nestClientSecret', label: 'Google Cloud Client Secret', type: 'password' }] },
  { id: 'ecobee', name: 'Ecobee', description: 'Bring your own Ecobee App Developer key.', category: 'IoT & Telemetry', icon: Leaf, iconColor: 'text-green-500', fields: [{ key: 'ecobeeApiKey', label: 'Ecobee Application Secret Key', type: 'password' }] },
  { id: 'honeywell', name: 'Honeywell Home', description: 'Bring your own Resideo API keys.', category: 'IoT & Telemetry', icon: Thermometer, iconColor: 'text-red-500', fields: [{ key: 'honeywellApiKey', label: 'Consumer App Key', type: 'password' }, { key: 'honeywellClientSecret', label: 'Consumer Secret', type: 'password' }] },
  { id: 'mq', name: 'measureQuick', description: 'Stream real-time diagnostic reports from technician field tools straight onto the job invoice.', category: 'IoT & Telemetry', icon: Wrench, iconColor: 'text-blue-500', fields: [{ key: 'measureQuickApiKey', label: 'measureQuick Cloud API Key', type: 'password', placeholder: 'mq_live_...' }] },
  // ── Platform-Level (Partnership Required) - Now BYOK ──
  { id: 'sage_intacct', name: 'Sage Intacct', description: 'Enterprise cloud financial management with multi-entity consolidation and advanced job costing.', category: 'Accounting', icon: FileText, iconColor: 'text-green-700', fields: [{ key: 'sageCompanyId', label: 'Company ID' }, { key: 'sageSenderId', label: 'Sender ID' }, { key: 'sageSenderPassword', label: 'Sender Password', type: 'password' }, { key: 'sageUserId', label: 'User ID' }, { key: 'sageUserPassword', label: 'User Password', type: 'password' }], isStubbed: true },
  { id: 'xero', name: 'Xero', description: 'Cloud accounting for small businesses with bank reconciliation and invoicing.', category: 'Accounting', icon: FileText, iconColor: 'text-blue-500', fields: [{ key: 'xeroTenantId', label: 'Tenant ID' }, { key: 'xeroClientId', label: 'Client ID' }, { key: 'xeroClientSecret', label: 'Client Secret', type: 'password' }] },
  { id: 'greensky', name: 'GreenSky', description: 'Point-of-sale consumer financing for home improvement with instant credit decisions.', category: 'Financing', icon: Banknote, iconColor: 'text-green-600', fields: [{ key: 'greenskyMerchantId', label: 'Merchant ID' }, { key: 'greenskyApiKey', label: 'API Key / Secret', type: 'password' }], isStubbed: true },
  { id: 'goodleap_partner', name: 'GoodLeap', description: 'Sustainable home improvement financing with flexible payment plans.', category: 'Financing', icon: Banknote, iconColor: 'text-emerald-500', fields: [{ key: 'goodleapMerchantId', label: 'Merchant ID' }, { key: 'goodleapApiKey', label: 'API Key', type: 'password' }], isStubbed: true },
  { id: 'wisetack', name: 'Wisetack', description: 'Buy-now-pay-later financing embedded directly into invoices and proposals.', category: 'Financing', icon: Banknote, iconColor: 'text-purple-600', fields: [{ key: 'wisetackApiKey', label: 'API Key', type: 'password' }], isStubbed: true },
  { id: 'thumbtack', name: 'Thumbtack', description: 'Receive homeowner service requests and leads directly from the Thumbtack marketplace.', category: 'Marketing & CRM', icon: Globe, iconColor: 'text-blue-600', fields: [{ key: 'thumbtackWebhookUrl', label: 'Webhook Config URL (Generated)' }, { key: 'thumbtackApiKey', label: 'API Key', type: 'password' }], isStubbed: true },
  { id: 'angi', name: 'Angi (Angie\'s List)', description: 'Import verified homeowner leads from the Angi marketplace into your dispatch board.', category: 'Marketing & CRM', icon: Globe, iconColor: 'text-red-500', fields: [{ key: 'angiAccountId', label: 'Account ID' }, { key: 'angiApiKey', label: 'API Key', type: 'password' }], isStubbed: true },
  { id: 'nextdoor', name: 'Nextdoor for Business', description: 'Neighborhood-level advertising and local recommendations from trusted neighbors.', category: 'Marketing & CRM', icon: Globe, iconColor: 'text-green-500', fields: [{ key: 'nextdoorBusinessId', label: 'Business ID' }, { key: 'nextdoorApiKey', label: 'API Key', type: 'password' }] },
  { id: 'adp', name: 'ADP Workforce', description: 'Enterprise payroll processing, tax filing, and HR compliance management.', category: 'HR & Payroll', icon: Users, iconColor: 'text-red-600', fields: [{ key: 'adpClientId', label: 'Client ID' }, { key: 'adpClientSecret', label: 'Client Secret', type: 'password' }], isStubbed: true },
  { id: 'paychex', name: 'Paychex', description: 'Payroll, benefits, and HR services for growing field service companies.', category: 'HR & Payroll', icon: Users, iconColor: 'text-blue-700', fields: [{ key: 'paychexCompanyId', label: 'Company ID' }, { key: 'paychexClientId', label: 'Client ID' }, { key: 'paychexClientSecret', label: 'Client Secret', type: 'password' }], isStubbed: true },
  { id: 'indeed', name: 'Indeed', description: 'Post job listings and receive applicants directly into your hiring pipeline.', category: 'HR & Payroll', icon: Users, iconColor: 'text-blue-500', fields: [{ key: 'indeedEmployerId', label: 'Employer ID' }, { key: 'indeedApiKey', label: 'API Key', type: 'password' }], isStubbed: true },
  { id: 'ziprecruiter', name: 'ZipRecruiter', description: 'AI-powered job matching to find qualified HVAC technicians and plumbers fast.', category: 'HR & Payroll', icon: Users, iconColor: 'text-emerald-600', fields: [{ key: 'ziprecruiterApiKey', label: 'API Key', type: 'password' }], isStubbed: true },
  { id: 'checkr', name: 'Checkr Background Checks', description: 'Continuously screen your workforce. Run MVRs and criminal background checks effortlessly before dispatching to a home.', category: 'HR & Payroll', icon: Users, iconColor: 'text-purple-600', fields: [{ key: 'checkrApiKey', label: 'Checkr API Key', type: 'password', placeholder: 'sk_live_...' }] },
  { id: 'lennox', name: 'Lennox iComfort', description: 'Access Lennox dealer portal for equipment registration, warranty lookup, and parts ordering.', category: 'Supply Chain', icon: ShoppingCart, iconColor: 'text-blue-800', fields: [{ key: 'lennoxDealerId', label: 'Dealer ID' }, { key: 'lennoxApiKey', label: 'API Key', type: 'password' }], isStubbed: true },
  { id: 'trane', name: 'Trane Technologies', description: 'Trane dealer integration for equipment specs, warranty claims, and coil matching.', category: 'Supply Chain', icon: ShoppingCart, iconColor: 'text-red-700', fields: [{ key: 'traneDealerId', label: 'Dealer ID' }, { key: 'traneApiKey', label: 'API Key', type: 'password' }], isStubbed: true },
  { id: 'carrier', name: 'Carrier Enterprise', description: 'Real-time parts availability, pricing, and order placement with Carrier distributors.', category: 'Supply Chain', icon: ShoppingCart, iconColor: 'text-blue-600', fields: [{ key: 'carrierDealerId', label: 'Dealer ID' }, { key: 'carrierApiKey', label: 'API Key', type: 'password' }], isStubbed: true },
  { id: 'ferguson', name: 'Ferguson Enterprises', description: 'Plumbing and HVAC supply ordering with account-level pricing and delivery tracking.', category: 'Supply Chain', icon: ShoppingCart, iconColor: 'text-blue-900', fields: [{ key: 'fergusonAccountNumber', label: 'Account Number' }, { key: 'fergusonApiKey', label: 'API Key', type: 'password' }], isStubbed: true },
  { id: 'johnstone', name: 'Johnstone Supply', description: 'HVAC wholesale parts and equipment ordering with real-time inventory lookup.', category: 'Supply Chain', icon: ShoppingCart, iconColor: 'text-orange-600', fields: [{ key: 'johnstoneAccountNumber', label: 'Account Number' }, { key: 'johnstoneApiKey', label: 'API Key', type: 'password' }], isStubbed: true },
  { id: 'grainger', name: 'Grainger', description: 'Industrial supply procurement with same-day delivery and inventory management.', category: 'Supply Chain', icon: ShoppingCart, iconColor: 'text-red-600', fields: [{ key: 'graingerAccountNumber', label: 'Account Number' }, { key: 'graingerApiKey', label: 'API Key', type: 'password' }], isStubbed: true },
  { id: 'punchout', name: 'B2B cXML PunchOut', description: 'Connect to major distributors (Johnstone, Trane, Ferguson, Grainger) that support cXML PunchOut.', category: 'Supply Chain', icon: Package, iconColor: 'text-amber-500', fields: [{ key: 'punchoutSupplierName', label: 'Supplier Name (e.g. Trane)' }, { key: 'punchoutSetupUrl', label: 'Supplier Setup URL' }, { key: 'punchoutFromDomain', label: 'From Domain' }, { key: 'punchoutFromIdentity', label: 'From Identity' }, { key: 'punchoutToDomain', label: 'To Domain' }, { key: 'punchoutToIdentity', label: 'To Identity' }, { key: 'punchoutSharedSecret', label: 'Shared Secret Password', type: 'password' }] },
  { id: 'interplay', name: 'Interplay Learning', description: 'VR and simulation-based HVAC and plumbing training for technician skill development.', category: 'Training', icon: GraduationCap, iconColor: 'text-purple-600', fields: [{ key: 'interplayOrgId', label: 'Organization ID' }, { key: 'interplayApiKey', label: 'API Key', type: 'password' }], isStubbed: true },
  { id: 'skillcat', name: 'SkillCat', description: 'Mobile-first trade certification and continuing education for field technicians.', category: 'Training', icon: GraduationCap, iconColor: 'text-teal-500', fields: [{ key: 'skillcatOrgId', label: 'Organization ID' }, { key: 'skillcatApiKey', label: 'API Key', type: 'password' }], isStubbed: true },
  { id: 'jb_warranties', name: 'JB Warranties', description: 'Extended labor warranty management with automated claims processing.', category: 'Warranty', icon: ShieldCheck, iconColor: 'text-blue-600', fields: [{ key: 'jbDealerId', label: 'Dealer ID' }, { key: 'jbApiKey', label: 'API Key', type: 'password' }], isStubbed: true },
  { id: 'service_plus', name: 'ServicePlus Home Warranty', description: 'Home warranty claim intake and dispatch integration for warranty contractors.', category: 'Warranty', icon: ShieldCheck, iconColor: 'text-green-600', fields: [{ key: 'servicePlusProviderId', label: 'Provider ID' }, { key: 'servicePlusApiKey', label: 'API Key', type: 'password' }], isStubbed: true },
  { id: 'cinch', name: 'Cinch Home Services', description: 'Home warranty work order management and automatic claim submission.', category: 'Warranty', icon: ShieldCheck, iconColor: 'text-indigo-600', fields: [{ key: 'cinchContractorId', label: 'Contractor ID' }, { key: 'cinchApiKey', label: 'API Key', type: 'password' }], isStubbed: true },
  { id: 'schedule_engine', name: 'Schedule Engine', description: 'After-hours call handling and live booking with AI-powered scheduling.', category: 'Communications', icon: Headphones, iconColor: 'text-orange-500', fields: [{ key: 'scheduleEngineApiKey', label: 'API Key', type: 'password' }], isStubbed: true },
  { id: 'twilio', name: 'Twilio', description: 'Provide Twilio credentials to send "On My Way" texts and appointment reminders.', category: 'Communications', icon: MessageSquare, iconColor: 'text-red-500', fields: [{ key: 'twilioSid', label: 'Account SID' }, { key: 'twilioToken', label: 'Auth Token', type: 'password' }, { key: 'twilioNumber', label: 'Origin Phone Number', placeholder: '+15551234567' }] },
  { id: 'smtp', name: 'Custom SMTP Server', description: 'Ensure maximum inbox deliverability for invoices and proposals by sending from your own email servers.', category: 'Communications', icon: Mail, iconColor: 'text-slate-500', fields: [{ key: 'smtpHost', label: 'SMTP Host', placeholder: 'smtp.gmail.com' }, { key: 'smtpPort', label: 'SMTP Port', placeholder: '587' }, { key: 'smtpUser', label: 'Username (Email)' }, { key: 'smtpPass', label: 'Password or App Password', type: 'password' }] },
  { id: 'ringcentral', name: 'RingCentral VoIP', description: 'Enable screen-pops. When a customer calls your RingCentral numbers, their profile pops up instantly on the dashboard.', category: 'Communications', icon: PhoneCall, iconColor: 'text-orange-500', fields: [{ key: 'ringCentralClientId', label: 'Client ID', placeholder: 'Enter RingCentral Client ID' }, { key: 'ringCentralClientSecret', label: 'Client Secret', type: 'password', placeholder: 'Enter RingCentral Client Secret' }] },
  { id: 'xoi', name: 'XOi Technologies', description: 'AI-powered video documentation and remote visual assistance for field technicians.', category: 'On-The-Job', icon: Camera, iconColor: 'text-indigo-500', fields: [{ key: 'xoiCompanyId', label: 'Company ID' }, { key: 'xoiApiKey', label: 'API Key', type: 'password' }], isStubbed: true },
  { id: 'profit_rhino', name: 'Profit Rhino', description: 'Dynamic flat-rate pricing engine with real-time material cost updates.', category: 'Estimations', icon: Hammer, iconColor: 'text-amber-600', fields: [{ key: 'profitRhinoApiKey', label: 'API Key', type: 'password' }], isStubbed: true },
  { id: 'salesrabbit', name: 'SalesRabbit', description: 'Door-to-door sales tracking with territory mapping and lead management.', category: 'Marketing & CRM', icon: TrendingUp, iconColor: 'text-green-600', fields: [{ key: 'salesRabbitApiKey', label: 'API Key', type: 'password' }], isStubbed: true },
  { id: 'sendgrid', name: 'SendGrid (Twilio)', description: 'Transactional email delivery with templates, analytics, and deliverability tools.', category: 'Communications', icon: Headphones, iconColor: 'text-blue-500', fields: [{ key: 'sendGridApiKey', label: 'API Key', type: 'password' }], isStubbed: true },
  { id: 'openweather', name: 'OpenWeather Map Viewer', description: 'Provide technicians with real-time job site temperatures, UV index warnings, and storm reports before they dispatch.', category: 'Geospatial API', icon: CloudSun, iconColor: 'text-sky-500', fields: [{ key: 'openWeatherApiKey', label: 'Custom API Key Override (Optional)', type: 'password' }] },
  { id: 'shovels', name: 'Shovels.ai Permit Tracking', description: 'Automatically track US municipal building permits nationwide for all jobs without calling the town hall.', category: 'GovTech API', icon: CloudSun, iconColor: 'text-amber-500', fields: [{ key: 'shovelsApiKey', label: 'Shovels.ai API Key', type: 'password', placeholder: 'Enter your sandbox API key' }] },
];

const IntegrationsMarketplace: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useAppContext();
  const orgId = state.currentUser?.organizationId;
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [enabledIntegrations, setEnabledIntegrations] = useState<Record<string, any>>({});
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Widget states
  const [bookingWidgetMode, setBookingWidgetMode] = useState<'inline'|'popup'>('inline');
  const [hiringWidgetMode, setHiringWidgetMode] = useState<'inline'|'popup'>('inline');

  // Load enabled integrations
  useEffect(() => {
    if (!orgId) return;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'organizations', orgId, 'settings', 'marketplace_integrations'));
        if (snap.exists()) setEnabledIntegrations(snap.data()?.integrations || {});
      } catch (e) { console.error(e); }
    };
    load();
  }, [orgId]);

  const [showPlatform, setShowPlatform] = useState(true);

  const filtered = INTEGRATIONS.filter(i => {
    const matchCat = category === 'All' || i.category === category;
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase());
    const matchType = showPlatform || !i.platformLevel;
    return matchCat && matchSearch && matchType;
  });
  // Sort: BYOK first, then platform-level
  const sorted = [...filtered].sort((a, b) => (a.platformLevel ? 1 : 0) - (b.platformLevel ? 1 : 0));

  const handleEnable = (integration: Integration) => {
    setConfiguring(integration.id);
    const existing = enabledIntegrations[integration.id] || {};
    const vals: Record<string, string> = {};
    integration.fields.forEach(f => { vals[f.key] = existing[f.key] || ''; });
    setFieldValues(vals);
  };

  const handleSave = async (integration: Integration) => {
    if (!orgId) return;
    setSaving(true);
    try {
      const isNewEnable = !enabledIntegrations[integration.id];
      const updated = { ...enabledIntegrations, [integration.id]: { ...fieldValues, enabled: true, name: integration.name, category: integration.category, enabledAt: enabledIntegrations[integration.id]?.enabledAt || new Date().toISOString() } };
      await setDoc(doc(db, 'organizations', orgId, 'settings', 'marketplace_integrations'), { integrations: updated }, { merge: true });
      setEnabledIntegrations(updated);
      setConfiguring(null);

      if (integration.isStubbed && isNewEnable) {
        // Log a notification for the engineering team
        await setDoc(doc(db, 'integration_requests', `${orgId}_${integration.id}`), {
          orgId,
          integrationId: integration.id,
          integrationName: integration.name,
          requestedAt: new Date().toISOString(),
          status: 'pending',
          fieldsProvided: Object.keys(fieldValues).filter(k => !!fieldValues[k])
        });

        // Trigger an email to the admin
        await addDoc(collection(db, 'mail'), {
          to: 'platform@tektrakker.com', // Replace with the actual admin email or use an env variable
          message: {
            subject: `New Integration Request: ${integration.name}`,
            html: `
              <h3>New Stubbed Integration Requested</h3>
              <p><strong>Organization ID:</strong> ${orgId}</p>
              <p><strong>Integration:</strong> ${integration.name} (${integration.id})</p>
              <p><strong>Fields Provided:</strong> ${Object.keys(fieldValues).filter(k => !!fieldValues[k]).join(', ')}</p>
              <p>Please review this request in the Master Admin panel.</p>
            `
          },
          type: 'System Alert',
          createdAt: new Date().toISOString()
        });
      }

      showToast.success(`${integration.name} has been enabled!`);
    } catch (e: unknown) {
      showToast.warn('Failed to save: ' + (e as Error).message);
    } finally { setSaving(false); }
  };

  const handleDisable = async (integrationId: string, name: string) => {
    if (!orgId) return;
    try {
      const updated = { ...enabledIntegrations };
      delete updated[integrationId];
      await setDoc(doc(db, 'organizations', orgId, 'settings', 'marketplace_integrations'), { integrations: updated }, { merge: true });
      setEnabledIntegrations(updated);
      showToast.success(`${name} has been disabled.`);
    } catch (e: unknown) { showToast.warn('Failed: ' + (e as Error).message); }
  };

  const enabledCount = Object.keys(enabledIntegrations).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/admin/settings')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors" title="Back to Settings">
                <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
              </button>
              <div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Integrations Marketplace</h1>
                <p className="text-sm text-slate-500 mt-0.5">Browse and enable third-party integrations · <span className="text-primary-600 font-bold">{enabledCount} active</span></p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-800 font-bold">
                <Key size={12} /> BYOK
              </span>
              <button onClick={() => setShowPlatform(!showPlatform)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-bold transition-colors ${showPlatform ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'}`}>
                <Lock size={12} /> {showPlatform ? 'Hide' : 'Show'} Partnership
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search integrations..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" autoComplete="off" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                &times;
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            <Filter size={14} className="text-slate-400 flex-shrink-0" />
            {CATEGORIES.map(cat => (
              <button 
                key={cat} 
                onClick={() => setCategory(category === cat ? 'All' : cat)} 
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${category === cat ? 'bg-primary-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map(integration => {
            const isEnabled = !!enabledIntegrations[integration.id];
            const isConfigOpen = configuring === integration.id;
            const Icon = integration.icon;
            const isPlatform = !!integration.platformLevel;

            return (
              <div key={integration.id} className={`relative rounded-2xl border-2 transition-all duration-300 overflow-hidden ${isPlatform ? 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 opacity-80' : isEnabled ? 'bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-700 shadow-md shadow-emerald-500/5' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md'}`}>
                {/* Card header */}
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isEnabled ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-slate-50 dark:bg-slate-800'} border border-slate-100 dark:border-slate-700`}>
                        <Icon size={24} className={integration.iconColor} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm">{integration.name}</h3>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-100 dark:border-slate-700">{integration.category}</span>
                      </div>
                    </div>
                    {isPlatform ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded-full border border-amber-200 dark:border-amber-800">
                        <Lock size={10} /> Partnership
                      </span>
                    ) : isEnabled ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 size={10} /> Active
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">{integration.description}</p>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {isPlatform ? (
                      <div className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-lg cursor-not-allowed">
                        <Lock size={14} /> Coming Soon — Partnership Required
                      </div>
                    ) : isEnabled && !isConfigOpen ? (
                      <>
                        <button onClick={() => handleEnable(integration)} className="flex-1 px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                          Configure
                        </button>
                        <button onClick={() => handleDisable(integration.id, integration.name)} className="px-3 py-2 text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                          Disable
                        </button>
                      </>
                    ) : !isConfigOpen ? (
                      <button onClick={() => handleEnable(integration)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-bold bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm">
                        <Plus size={14} /> Enable Integration
                      </button>
                    ) : null}
                    {integration.learnMoreUrl && !isConfigOpen && (
                      <a href={integration.learnMoreUrl} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:text-primary-600 transition-colors" title="Learn more">
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </div>

                {/* Config Panel */}
                {isConfigOpen && (
                  <div className="border-t-2 border-primary-100 dark:border-primary-900 bg-primary-50/30 dark:bg-primary-950/20 p-5">
                    <h4 className="text-xs font-black uppercase tracking-widest text-primary-700 dark:text-primary-400 mb-3 flex items-center gap-1.5">
                      <Shield size={12} /> API Credentials
                    </h4>
                    
                    {integration.isStubbed && (
                      <div className="mb-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-400">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <p>
                            <strong>Notice:</strong> Once you save your credentials, it may take up to 48 hours for our engineering team to securely map your custom integration. You will be notified once data begins syncing.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      {integration.fields.map(field => (
                        <div key={field.key}>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">{field.label}</label>
                          <input
                            type={field.type || 'text'}
                            value={fieldValues[field.key] || ''}
                            onChange={e => setFieldValues({ ...fieldValues, [field.key]: e.target.value })}
                            placeholder={field.placeholder || ''}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500"
                            autoComplete="new-password"
                            data-lpignore="true"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button onClick={() => handleSave(integration)} disabled={saving} className="flex-1 px-4 py-2.5 text-xs font-bold bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
                        {saving ? 'Saving...' : isEnabled ? 'Update' : 'Enable & Save'}
                      </button>
                      <button onClick={() => setConfiguring(null)} className="px-4 py-2.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20">
            <Search size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
            <h3 className="text-lg font-bold text-slate-600 dark:text-slate-400">No integrations found</h3>
            <p className="text-sm text-slate-400 mt-1 mb-6">Try adjusting your search or filter criteria.</p>
            <button 
              onClick={() => {
                setSearch('');
                setCategory('All');
                setShowPlatform(true);
              }}
              className="px-6 py-2.5 bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 font-bold rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        )}

        {/* Web Widgets Section */}
        <div className="mt-12 mb-6">
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2"><Code className="text-purple-500" /> Web Widgets</h2>
          <p className="text-sm text-slate-500 mt-1">Embeddable code snippets for your public website.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-12">
            {/* Booking Widget */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-full relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Code size={64} className="text-purple-500" />
                </div>
                <div className="flex items-start gap-3 mb-3 relative z-10">
                    <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600">
                        <Code size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white">Service Booking Form</h3>
                        <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Free Included</p>
                    </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4 flex-grow relative z-10">
                    Place this powerful widget onto your public website to instantly inject online bookings into the dispatcher calendar.
                </p>
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Mode:</span>
                        <button onClick={() => setBookingWidgetMode('inline')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${bookingWidgetMode === 'inline' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}>Inline</button>
                        <button onClick={() => setBookingWidgetMode('popup')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${bookingWidgetMode === 'popup' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}>Popup</button>
                    </div>
                    <p className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-2">Embed Code snippet:</p>
                    <code className="block text-[10px] p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 text-slate-500 font-mono select-all overflow-x-auto whitespace-nowrap mb-3">
                        {`<script src="https://app.tektrakker.com/widgets/booking.js?org=${orgId}&mode=${bookingWidgetMode}"></script>`}
                    </code>
                    <button onClick={(e) => { e.preventDefault(); navigator.clipboard.writeText(`<script src="https://app.tektrakker.com/widgets/booking.js?org=${orgId}&mode=${bookingWidgetMode}"></script>`); showToast.success("Copied to clipboard!"); }} className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs font-bold bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors">
                        <Copy size={14} /> Auto-Copy Script Tag
                    </button>
                </div>
            </div>

            {/* Hiring Widget */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-full relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Code size={64} className="text-purple-500" />
                </div>
                <div className="flex items-start gap-3 mb-3 relative z-10">
                    <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600">
                        <Code size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white">Career Application Form</h3>
                        <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Free Included</p>
                    </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4 flex-grow relative z-10">
                    Place this widget on your careers page to instantly route new mechanic or office applicants natively into HR queue.
                </p>
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Mode:</span>
                        <button onClick={() => setHiringWidgetMode('inline')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${hiringWidgetMode === 'inline' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}>Inline</button>
                        <button onClick={() => setHiringWidgetMode('popup')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${hiringWidgetMode === 'popup' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}>Popup</button>
                    </div>
                    <p className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-2">Embed Code snippet:</p>
                    <code className="block text-[10px] p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 text-slate-500 font-mono select-all overflow-x-auto whitespace-nowrap mb-3">
                        {`<script src="https://app.tektrakker.com/widgets/hiring.js?org=${orgId}&mode=${hiringWidgetMode}"></script>`}
                    </code>
                    <button onClick={(e) => { e.preventDefault(); navigator.clipboard.writeText(`<script src="https://app.tektrakker.com/widgets/hiring.js?org=${orgId}&mode=${hiringWidgetMode}"></script>`); showToast.success("Copied to clipboard!"); }} className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs font-bold bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors">
                        <Copy size={14} /> Auto-Copy Script Tag
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsMarketplace;
