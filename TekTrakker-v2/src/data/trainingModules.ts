import { Brain, CalendarClock, CarFront, FileSignature, MapPin, Search, Wrench, ShieldCheck, Mail, Building, Users, CreditCard, BarChart3, MessageSquare } from 'lucide-react';

export interface TrainingArticle {
    id: string;
    title: string;
    description: string;
    duration: string;
    roles: ('master' | 'admin' | 'employee' | 'customer' | 'platform_sales')[];
    category: 'Onboarding' | 'Jobs & Field' | 'Invoicing' | 'Admin & Settings';
    icon: any;        // LucideIcon 
    videoUrl?: string; // Currently we will point to the WebP recordings
    thumbnailUrl?: string;
    content: string; // Markdown formatted step by step
    tags: string[];
}

export const trainingCategories = ['Onboarding', 'Jobs & Field', 'Invoicing', 'Admin & Settings'] as const;

export const mockTrainingData: TrainingArticle[] = [
    {
        id: 'dispatch-job',
        title: 'How to Dispatch a New Job',
        description: 'Learn the quickest way to create a customer, assign a job to a field tech, and schedule it on the calendar.',
        duration: '1:15',
        roles: ['admin', 'master'],
        category: 'Jobs & Field',
        icon: MapPin,
        videoUrl: '/assets/training/dispatch_guide.webp',
        thumbnailUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=400&q=80',
        tags: ['dispatching', 'new job', 'calendar', 'scheduling'],
        content: `
### Creating a Job from the Admin Dashboard

Dispatching is the core of your daily operations. Follow these steps to fluidly create and assign a job.

1. **Navigate to the Dispatch Board**: On the left sidebar menu, click on \`Dispatch Board\`.
2. **Open the Job Creator**: Click the prominent **+ New Job** button in the top right.
3. **Select or Create Customer**: 
   - If the customer exists, search their name and select them.
   - If new, click *Add Customer* and input their vital contacts (Email/Phone).
4. **Assign a Technician**: Below the date selector, pick an available technician from the dropdown. 
5. **Set Priority**: For urgencies, toggle the *High Priority* switch so the tech gets a push notification.
6. **Save**: Click \`Dispatch\`! Your technician will instantly see this on their mobile app under *My Route*.

> [!TIP]
> **Pro Tip:** You can drag and drop jobs directly on the calendar view to automatically re-assign and reschedule them without opening the entire prompt!
        `
    },
    {
        id: 'tech-clocking-in',
        title: 'Field Mode: Clocking In & Out',
        description: 'A walkthrough for technicians on how to log their hours against specific jobs to ensure accurate payroll.',
        duration: '1:35',
        roles: ['employee', 'admin'],
        category: 'Jobs & Field',
        icon: CalendarClock,
        videoUrl: '/assets/training/clocking_in.webp',
        thumbnailUrl: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=400&q=80',
        tags: ['technician', 'timesheets', 'clock in', 'field'],
        content: `
### Managing Your Daily Shift

Your mobile device is your tracking device. Here is how you maintain your timesheet.

1. **Dashboard Home**: Upon logging in via the mobile site, your center UI is the *Quick Actions* panel.
2. **Start Shift**: Tap the massive **Clock In** button.
3. **Linking to a Job (Optional)**: If you are actively clocking in to head towards a job, select the upcoming job from your docket so the time is billed correctly to the customer's labor logs.
4. **Clocking Out**: At the end of the day, tap **Clock Out**. 

> [!WARNING]
> Timesheets are audited strictly. If you forget to clock out, your organization Admin will need to manually adjust your shift in the Master Settings!
        `
    },
    {
        id: 'build-proposal',
        title: 'Creating Good/Better/Best Proposals',
        description: 'Maximize your closing rate by offering tiered tiered pricing estimates to your customers directly from the field.',
        duration: '2:10',
        roles: ['admin', 'master', 'employee'],
        category: 'Invoicing',
        icon: FileSignature,
        videoUrl: '/assets/training/proposal_guide.webp',
        thumbnailUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=400&q=80',
        tags: ['proposals', 'estimates', 'good better best', 'sales'],
        content: `
### Closing Deals In The Field

Customers love options. Use the proposal builder to give them variations.

1. **Access Estimates**: From a specific Job card, click the \`Create Estimate\` tab.
2. **Add Items to Option 1**: This is your 'Good' tier. Add basic repairs or budget AC units.
3. **Duplicate & Upsell**: Click \`Add Option 2\`. Duplicate your first tier and add a maintenance package or premium filtration unit.
4. **Collect Signature**: Present the tablet to the customer. When they click \`Accept\` on an option, it binds uniquely to their digital footprint and triggers an invoice generation.
        `
    },
    {
        id: 'org-setup',
        title: 'Initial Organization Configuration',
        description: 'The very first things to set up when you create a new TekTrakker organization workspace.',
        duration: '0:45',
        roles: ['master', 'admin'],
        category: 'Onboarding',
        icon: Building,
        videoUrl: '/assets/training/org_setup.webp',
        thumbnailUrl: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=400&q=80',
        tags: ['onboarding', 'settings', 'organization', 'setup'],
        content: `
### Customizing Your Workspace

Make TekTrakker feel like yours from Day 1.

1. **Settings Navigation**: Go to your \`Organization Settings\` page (bottom left gear icon).
2. **Branding Assets**: Upload your company logo here. This strictly controls what is visible on your final Invoices and Customer Portals.
3. **Inviting Users**: Navigate to the \`Users\` tab. Click \`Invite Employee\` and input their emails. They will receive an automated signup link!
        `
    },
    {
        id: 'crm-guide',
        title: 'Managing the Customer CRM',
        description: 'Learn how to create customer profiles, link service locations, and view their history.',
        duration: '1:05',
        roles: ['admin', 'master', 'platform_sales'],
        category: 'Admin & Settings',
        icon: Users,
        videoUrl: '/assets/training/crm_guide.webp',
        thumbnailUrl: 'https://images.unsplash.com/photo-1552581234-26160f608093?auto=format&fit=crop&w=400&q=80',
        tags: ['crm', 'customers', 'database', 'locations'],
        content: `
### Building Your Customer Database

The CRM is the core of operations.

1. **Navigate to Customers**: Found under the Operations section in the sidebar.
2. **Add Customer**: Click the "+ New Customer" button in the top right.
3. **Fill Details**: Provide the Name, Email, Phone, and the primary Service Location.
4. **Save**: Once saved, you can view all past jobs, associated equipment, and invoices on their generated profile card!
        `
    },
    {
        id: 'invoicing-guide',
        title: 'Processing Invoices & Payments',
        description: 'How to convert a completed job into an invoice and securely process a credit card payment.',
        duration: '0:22',
        roles: ['master', 'admin', 'platform_sales'],
        category: 'Invoicing',
        icon: CreditCard,
        videoUrl: '/assets/training/invoice_payment.webp',
        thumbnailUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=400&q=80',
        tags: ['invoicing', 'payments', 'billing', 'financials'],
        content: `
### Getting Paid Faster

1. **Locate the Job**: Find a job that a technician has marked "Completed".
2. **Generate Invoice**: Click the "Invoice" tab. The system will automatically pull the line items the customer accepted from the proposal.
3. **Collect Payment**: Click "Take Payment" to open the secure Stripe interface.
4. **Process Card**: Manually enter the card details or use a connected card reader. The invoice state will automatically switch to "Paid".
        `
    },
    {
        id: 'messaging-guide',
        title: 'Team Briefing & Chat',
        description: 'Communication is key. Learn how to use the built-in team chat to stay connected with technicians.',
        duration: '0:12',
        roles: ['master', 'admin', 'employee'],
        category: 'Onboarding',
        icon: MessageSquare,
        videoUrl: '/assets/training/messaging_guide.webp',
        thumbnailUrl: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?auto=format&fit=crop&w=400&q=80',
        tags: ['chat', 'messaging', 'communications', 'team'],
        content: `
### Keeping The Team Connected

Stop texting your techs on their personal phones.

1. **Open Briefing**: The "Briefing" panel is found in the main navigation.
2. **Select Chat**: Click the Chat tab.
3. **Internal Thread**: You can create channels for specific teams (e.g. #Installers) or direct message a technician to ask for photos of a job site. Push notifications are automatically dispatched.
        `
    },
    {
        id: 'analytics-guide',
        title: 'Understanding Dashboard Analytics',
        description: 'How to read the main administrative financial metrics and performance charts.',
        duration: '0:26',
        roles: ['master', 'admin'],
        category: 'Admin & Settings',
        icon: BarChart3,
        videoUrl: '/assets/training/analytics_guide.webp',
        thumbnailUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=400&q=80',
        tags: ['analytics', 'charts', 'reporting', 'dashboard'],
        content: `
### Data-Driven Decisions

1. **The Home Dashboard**: When you log in as an Admin, your central hub is loaded with widgets.
2. **Revenue Metrics**: The top blocks show Total Revenue, Open Invoices, and Average Ticket Size.
3. **Technician Leaderboard**: Compare your field team's generated revenue to identify top performers.
4. **Filtering**: Use the date range selector at the top right to analyze specific quarters.
        `
    },
    {
        id: 'tech-workflow',
        title: 'Mastering the Technician Workflow Modal',
        description: 'A complete guide to the job workflow: Arrival, Diagnosis, Repair, Quality Assurance, and Billing.',
        duration: '0:25',
        roles: ['employee', 'admin', 'master'],
        category: 'Jobs & Field',
        icon: Wrench,
        videoUrl: '/assets/training/tech_workflow.webp',
        thumbnailUrl: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=400&q=80',
        tags: ['technician', 'workflow', 'diagnosis', 'repair', 'billing'],
        content: `
### End-to-End Job Execution

Navigate your field jobs with ease using the centralized Job Workflow Modal.
1. **Arrival**: Confirm your arrival to notify the customer and timestamp your visit.
2. **Diagnosis**: Log your pre-work findings, import required checklists, and sign any necessary waivers.
3. **Repair/Work**: Document the work performed, add materials used, and track refrigerant logs.
4. **Quality Control**: Complete the final QA checklist and import customer feedback.
5. **Billing & Completion**: Review the final invoice, collect payment, and safely depart the site.
        `
    },
    {
        id: 'tech-tools',
        title: 'Integrating Technician Tools & Smart Assistant',
        description: 'How to append digital tool readings to your jobs and leverage the AI Smart Tech Assistant.',
        duration: '0:28',
        roles: ['employee', 'admin', 'master'],
        category: 'Jobs & Field',
        icon: Brain,
        videoUrl: '/assets/training/tech_tools.webp',
        thumbnailUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=400&q=80',
        tags: ['tools', 'measurements', 'ai', 'assistant', 'diagnostics'],
        content: `
### Supercharge Your Diagnostics

1. **Add Measurements**: In the Diagnosis step, click **Add Measurement** to log data from your digital manifold gauge, multimeter, or scale. 
2. **Tool Selection**: Select your tool type and enter a quick summary of the readings. These are saved permanently to the job record.
3. **Smart Tech Assistant**: Stuck on a difficult repair? Click the **Assistant** button (sparkle icon) at the bottom of the workflow modal to open the AI-powered diagnostic helper and get instant suggestions based on your logged measurements.
        `
    },
    {
        id: 'gov-bid-helper',
        title: 'Navigating the Bid Optimization Tool',
        description: 'Learn how to find, analyze, and generate compliance checklists for government HVAC contracts.',
        duration: '0:48',
        roles: ['admin', 'master'],
        category: 'Admin & Settings',
        icon: Building,
        videoUrl: '/assets/training/gov_bid.webp',
        thumbnailUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=400&q=80',
        tags: ['government', 'bids', 'contracts', 'compliance', 'sales'],
        content: `
### Securing Public Sector Contracts

The Bid Optimization Tool is your central hub for federal and local contracts.

1. **Access the Tool**: Navigate to "Bid Optimization" from the admin sidebar.
2. **Search & Scrape**: Use the built-in search tools to pull active RFP/RFQ listings from government databases.
3. **Analyze Requirements**: Click on a contract to automatically extract the bonding, insurance, and certification requirements.
4. **Generate Proposals**: Use the tool to auto-generate a compliance checklist and start building your bid proposal directly within the platform.
        `
    },
    {
        id: 'records-assets',
        title: 'Managing Records and Assets',
        description: 'A comprehensive walkthrough of the organization-wide Records, Fleet, Toolbox, and Document repository.',
        duration: '0:42',
        roles: ['admin', 'master'],
        category: 'Admin & Settings',
        icon: Search,
        videoUrl: '/assets/training/records_assets.webp',
        thumbnailUrl: 'https://images.unsplash.com/photo-1554774853-719586f82d77?auto=format&fit=crop&w=400&q=80',
        tags: ['records', 'assets', 'fleet', 'documents', 'inventory'],
        content: `
### The Core Information Hub

Maintain full visibility over your operations.

1. **Accessing Records**: Navigate to "Records & Assets" on your administrative sidebar.
2. **Inventory & EPA Logs**: The first tab allows you to manage parts and view the legally-binding EPA Refrigerant usage logs.
3. **Fleet Management**: Track your service vehicles and review their maintenance history to stay compliant with DOT requirements.
4. **Documents & Forms**: Upload employee handbooks, create standardized inspection forms, and review signed waivers from one centralized location.
        `
    }
];
