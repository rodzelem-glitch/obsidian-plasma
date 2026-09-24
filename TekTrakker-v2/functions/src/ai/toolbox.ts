/* eslint-disable @typescript-eslint/no-explicit-any */

export const standardToolDeclarations: any[] = [
    {
        name: "navigateToPage",
        description: "Navigates/redirects the user's browser to a specific page or section in the TekTrakker platform. Use this tool when the user asks to 'go to', 'open', 'take me to', or 'navigate to' a page, tab, dashboard, or setting.",
        parameters: {
            type: "OBJECT",
            properties: {
                path: { 
                    type: "STRING", 
                    description: "The exact path or URL route to navigate to. MUST be one of the supported routes (e.g. '/admin/settings', '/admin/operations', '/scheduling', '/timelog', etc.)." 
                },
                pageName: {
                    type: "STRING",
                    description: "A friendly name for the page being navigated to (e.g. 'Settings', 'Operations Dispatch', 'Timesheets')."
                }
            },
            required: ["path", "pageName"]
        }
    },
    {
        name: "createCustomer",
        description: "Creates a new customer profile in the active organization's database.",
        parameters: {
            type: "OBJECT",
            properties: {
                name: { type: "STRING", description: "The full name of the customer." },
                phone: { type: "STRING", description: "The customer's phone number." },
                email: { type: "STRING", description: "The customer's email address." },
                address: { type: "STRING", description: "The customer's physical street address." }
            },
            required: ["name"]
        }
    },
    {
        name: "scheduleAppointment",
        description: "Books an appointment or new job for a customer.",
        parameters: {
            type: "OBJECT",
            properties: {
                customerName: { type: "STRING", description: "Name of the customer needing service." },
                date: { type: "STRING", description: "The date of the appointment in strict ISO 8601 format (e.g., 2026-04-10T12:00:00Z)." },
                description: { type: "STRING", description: "The reason or description for the job." }
            },
            required: ["customerName", "date"]
        }
    },
    {
        name: "assignTechnician",
        description: "Dispatches or assigns a technician to a specific customer's job.",
        parameters: {
            type: "OBJECT",
            properties: {
                customerName: { type: "STRING", description: "Name of the customer. Omit this entirely if assigning ALL unassigned jobs." },
                technicianName: { type: "STRING", description: "The name of the technician being dispatched." },
                confirmed: { type: "BOOLEAN", description: "Set to true only if the user explicitly confirmed mass-dispatching all unassigned jobs." }
            },
            required: ["technicianName"]
        }
    },
    {
        name: "addCustomerEquipment",
        description: "Adds a new installed physical equipment asset (like an HVAC system, heat pump, or property appliance) to a customer's permanent account profile.",
        parameters: {
            type: "OBJECT",
            properties: {
                customerName: { type: "STRING", description: "Name of the customer." },
                brand: { type: "STRING", description: "The brand of the equipment (e.g. Trane, Carrier)." },
                type: { type: "STRING", description: "The type of equipment (e.g. 1-ton system, Heat Pump, AC)." },
                model: { type: "STRING", description: "The model name or number, if known. Leave blank if unknown." },
                serial: { type: "STRING", description: "The serial number, if known. Leave blank if unknown." }
            },
            required: ["customerName", "brand", "type"]
        }
    },
    {
        name: "createUser",
        description: "Creates a new simple user account (like a technician, office staff, or customer account). Note: Cannot adjust admin permissions or delete users.",
        parameters: {
            type: "OBJECT",
            properties: {
                name: { type: "STRING", description: "Full name of the new user." },
                email: { type: "STRING", description: "Email address." },
                role: { type: "STRING", description: "The role: 'technician', 'office', or 'customer'." },
                phone: { type: "STRING", description: "Phone number." }
            },
            required: ["name", "email", "role"]
        }
    },
    {
        name: "manageTimesheet",
        description: "Clocks a technician in or out for their shift.",
        parameters: {
            type: "OBJECT",
            properties: {
                technicianName: { type: "STRING", description: "Name of the technician." },
                action: { type: "STRING", description: "Either 'clock_in' or 'clock_out'." }
            },
            required: ["technicianName", "action"]
        }
    },
    {
        name: "createSalesProposal",
        description: "Constructs and saves a multi-tiered (Good, Better, Best) sales proposal presentation for a customer.",
        parameters: {
            type: "OBJECT",
            properties: {
                customerName: { type: "STRING", description: "Name of the customer." },
                goodTierDesc: { type: "STRING", description: "Description for the basic/good tier." },
                goodTierPrice: { type: "NUMBER", description: "Price for the good tier." },
                betterTierDesc: { type: "STRING", description: "Description for the middle/better tier." },
                betterTierPrice: { type: "NUMBER", description: "Price for the better tier." },
                bestTierDesc: { type: "STRING", description: "Description for the premium/best tier." },
                bestTierPrice: { type: "NUMBER", description: "Price for the best tier." }
            },
            required: ["customerName", "goodTierPrice", "betterTierPrice", "bestTierPrice"]
        }
    },
    {
        name: "createMarketingCampaign",
        description: "Generates and saves a new automated marketing sequence/campaign.",
        parameters: {
            type: "OBJECT",
            properties: {
                campaignName: { type: "STRING", description: "Name of the campaign." },
                targetAudience: { type: "STRING", description: "Target demographic (e.g. Past Customers, HVAC Maintenance)." },
                messageBody: { type: "STRING", description: "The text message or email content." },
                channel: { type: "STRING", description: "Either 'SMS' or 'Email'." }
            },
            required: ["campaignName", "targetAudience", "messageBody", "channel"]
        }
    },
    {
        name: "addServiceAgreement",
        description: "Sells and attaches a recurring membership or service agreement to a customer's profile.",
        parameters: {
            type: "OBJECT",
            properties: {
                customerName: { type: "STRING", description: "Name of the customer." },
                planName: { type: "STRING", description: "Name of the maintenance plan (e.g. Gold Plan, Spring Tune-up)." },
                price: { type: "NUMBER", description: "Recurring cost of the plan." },
                frequency: { type: "STRING", description: "Billing iteration (e.g. 'Monthly', 'Yearly')." }
            },
            required: ["customerName", "planName", "price", "frequency"]
        }
    },
    {
        name: "generateInvoice",
        description: "Generates an invoice line item or charges a customer for a specific amount.",
        parameters: {
            type: "OBJECT",
            properties: {
                customerName: { type: "STRING", description: "Name of the customer being invoiced." },
                amount: { type: "NUMBER", description: "The numerical total monetary amount of the invoice." },
                description: { type: "STRING", description: "A summary of the service provided." }
            },
            required: ["customerName", "amount", "description"]
        }
    },
    {
        name: "applyDiscount",
        description: "Automatically looks up a customer's active invoice and applies a percentage discount (e.g. 10 for 10%) or a flat amount.",
        parameters: {
            type: "OBJECT",
            properties: {
                customerName: { type: "STRING", description: "Name of the customer." },
                discountPercentage: { type: "NUMBER", description: "The percentage to discount (e.g. 10)." }
            },
            required: ["customerName", "discountPercentage"]
        }
    },
    {
        name: "getSchedule",
        description: "Reads the dispatch board and returns a list of active jobs, unassigned jobs, or jobs for a specific technician. Use this whenever the user asks about the schedule, who is working, or what jobs are unassigned.",
        parameters: {
            type: "OBJECT",
            properties: {
                date: { type: "STRING", description: "The date to check the schedule for, in YYYY-MM-DD format. If omitted, checks today's schedule." }
            },
            required: []
        }
    },
    {
        name: "cancelJob",
        description: "Cancels an active job for a customer.",
        parameters: {
            type: "OBJECT",
            properties: {
                customerName: { type: "STRING", description: "Name of the customer." },
                confirmed: { type: "BOOLEAN", description: "Set to true only if the user explicitly confirmed cancelling this active job." }
            },
            required: ["customerName"]
        }
    },
    {
        name: "checkInventory",
        description: "Searches the database to see if a specific part, material, or tool is in stock.",
        parameters: {
            type: "OBJECT",
            properties: {
                itemQuery: { type: "STRING", description: "The name, SKU, or type of item to search for." }
            },
            required: ["itemQuery"]
        }
    },
    {
        name: "sendMessage",
        description: "Sends a direct message to a technician or team member.",
        parameters: {
            type: "OBJECT",
            properties: {
                recipientName: { type: "STRING", description: "Name of the team member to message." },
                message: { type: "STRING", description: "The content of the message." }
            },
            required: ["recipientName", "message"]
        }
    },
    {
        name: "markJobStatus",
        description: "Changes the status of a job (e.g. Completed, In Progress, Canceled, Pending).",
        parameters: {
            type: "OBJECT",
            properties: {
                customerName: { type: "STRING", description: "Name of the customer." },
                status: { type: "STRING", description: "The new status of the job." }
            },
            required: ["customerName", "status"]
        }
    },
    {
        name: "addJobNote",
        description: "Adds a text note or comment to a job. Can be designated as an internal note or a work note.",
        parameters: {
            type: "OBJECT",
            properties: {
                customerName: { type: "STRING", description: "Name of the customer." },
                note: { type: "STRING", description: "The note content to add." },
                isInternal: { type: "BOOLEAN", description: "Set to true if this is a private office-only note, or false if it is a customer-visible work note." }
            },
            required: ["customerName", "note"]
        }
    },
    {
        name: "getJobDetails",
        description: "Retrieves the full details and history of a specific job.",
        parameters: {
            type: "OBJECT",
            properties: {
                customerName: { type: "STRING", description: "Name of the customer to lookup." }
            },
            required: ["customerName"]
        }
    },
    {
        name: "completeJobTask",
        description: "Marks a specific task or checklist item as completed for a job.",
        parameters: {
            type: "OBJECT",
            properties: {
                customerName: { type: "STRING", description: "Name of the customer." },
                taskName: { type: "STRING", description: "The task name they completed." }
            },
            required: ["customerName", "taskName"]
        }
    },
    {
        name: "appendWaiversAndChecklists",
        description: "Appends mandatory waivers and checklists (liability waivers, QA checklists) to a job.",
        parameters: {
            type: "OBJECT",
            properties: {
                customerName: { type: "STRING", description: "Name of the customer." }
            },
            required: ["customerName"]
        }
    },
    {
        name: "clockIn",
        description: "Clocks the technician in to start their shift.",
        parameters: { type: "OBJECT", properties: {}, required: [] }
    },
    {
        name: "clockOut",
        description: "Clocks the technician out to end their shift.",
        parameters: { type: "OBJECT", properties: {}, required: [] }
    },
    {
        name: "addInventoryItem",
        description: "Adds a new part or material to the organization's inventory.",
        parameters: {
            type: "OBJECT",
            properties: {
                itemName: { type: "STRING", description: "Name of the part or material." },
                sku: { type: "STRING", description: "SKU or barcode if available." },
                quantity: { type: "NUMBER", description: "Quantity added." }
            },
            required: ["itemName", "quantity"]
        }
    },
    {
        name: "linkJobToCustomer",
        description: "Re-links or re-maps a specific/current job to the correct customer profile in the database. Use this tool when a user asks you to link a job, fix a TBD address, or sync a job to the correct parent customer.",
        parameters: {
            type: "OBJECT",
            properties: {
                jobIdentifier: { type: "STRING", description: "The name, title, or identifier of the job being linked." },
                customerName: { type: "STRING", description: "The name of the customer profile to link the job to." }
            },
            required: []
        }
    },
    {
        name: "recordToolReading",
        description: "Records the results of a physical tool or diagnostic gauge reading to the customer's job.",
        parameters: {
            type: "OBJECT",
            properties: {
                customerName: { type: "STRING" },
                toolType: { type: "STRING", description: "The type of tool used (e.g. Multimeter, Manifold Gauge, Combustion Analyzer)" },
                summary: { type: "STRING", description: "The summarized results of the reading." }
            },
            required: ["customerName", "toolType", "summary"]
        }
    },
    {
        name: "getCustomerHistory",
        description: "Retrieves the past closed/completed jobs and history for a customer.",
        parameters: {
            type: "OBJECT",
            properties: {
                customerName: { type: "STRING", description: "Name of the customer." }
            },
            required: ["customerName"]
        }
    },
    {
        name: "startJobTimer",
        description: "Starts the labor clock for a specific job.",
        parameters: {
            type: "OBJECT",
            properties: {
                customerName: { type: "STRING", description: "Name of the customer." }
            },
            required: ["customerName"]
        }
    },
    {
        name: "stopJobTimer",
        description: "Stops the labor clock for a specific job.",
        parameters: {
            type: "OBJECT",
            properties: {
                customerName: { type: "STRING", description: "Name of the customer." }
            },
            required: ["customerName"]
        }
    },
    {
        name: "bookNewJob",
        description: "Books a new job or appointment for a new or existing customer.",
        parameters: {
            type: "OBJECT",
            properties: {
                customerName: { type: "STRING", description: "Name of the customer." },
                jobType: { type: "STRING", description: "The type of service or job (e.g. AC Tune Up, Diagnostic, Plumbing Repair)." },
                address: { type: "STRING", description: "The address for the service if provided." },
                scheduledDate: { type: "STRING", description: "The ISO 8601 string of the scheduled date/time (e.g. 2026-04-10T14:00:00Z). If none provided, omit." },
                waiverNames: { type: "ARRAY", items: { type: "STRING" }, description: "Optional. Array of strings specifying partial or exact names of Waivers to attach to the job." },
                checklistNames: { type: "ARRAY", items: { type: "STRING" }, description: "Optional. Array of strings specifying partial or exact names of Checklists to attach to the job." }
            },
            required: ["customerName", "jobType"]
        }
    },
    {
        name: "draftSocialMediaPosts",
        description: "Drafts one or multiple different variations of a social media post and saves them to the Social Media Hub for the user to review and approve.",
        parameters: {
            type: "OBJECT",
            properties: {
                drafts: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            topic: { type: "STRING", description: "The primary subject or hook of this draft variation." },
                            content: { type: "STRING", description: "The actual written caption/body of the social media post." },
                            platforms: { type: "ARRAY", items: { type: "STRING" }, description: "Array of platforms to target (e.g. ['facebook', 'instagram', 'linkedin'])." },
                            imagePrompt: { type: "STRING", description: "A detailed visual description for the AI image generator." }
                        }
                    }
                }
            },
            required: ["drafts"]
        }
    },
    {
        name: "draftProposal",
        description: "Drafts a new estimate or proposal for a customer.",
        parameters: {
            type: "OBJECT",
            properties: {
                customerName: { type: "STRING", description: "Name of the customer." },
                equipment: { type: "STRING", description: "The primary equipment or work being proposed (e.g. Carrier Infinity System)." },
                price: { type: "NUMBER", description: "The total estimated price of the proposed work." },
                description: { type: "STRING", description: "Details about what the proposal includes. Write as a short summary." }
            },
            required: ["customerName", "equipment", "price", "description"]
        }
    },
    {
        name: "textCustomer",
        description: "Sends an SMS message to a customer.",
        parameters: {
            type: "OBJECT",
            properties: {
                customerName: { type: "STRING", description: "Name of the customer." },
                message: { type: "STRING", description: "The actual core content of the message text to send." }
            },
            required: ["customerName", "message"]
        }
    },
    {
        name: "sendInvoice",
        description: "Generates an invoice for a customer's job and sends them a secure payment link.",
        parameters: {
            type: "OBJECT",
            properties: {
                customerName: { type: "STRING", description: "Name of the customer." },
                amount: { type: "NUMBER", description: "The total amount to charge." },
                description: { type: "STRING", description: "What the invoice is for." }
            },
            required: ["customerName", "amount", "description"]
        }
    },
    {
        name: "analyzeRevenue",
        description: "Analyzes the organization's revenue. Can filter by zip code or timeframe if requested. Use this for 'How much revenue did we generate...?'",
        parameters: {
            type: "OBJECT",
            properties: {
                zipCode: { type: "STRING", description: "Optional zip code or area to filter by." },
                timeframe: { type: "STRING", description: "Optional timeframe (e.g. 'last month', 'this year')." }
            },
            required: []
        }
    },
    {
        name: "getTechnicianEfficiency",
        description: "Tracks technician efficiency. Answers questions like who is running behind schedule or taking the longest on diagnostics.",
        parameters: {
            type: "OBJECT",
            properties: {
                technicianName: { type: "STRING", description: "Optional specific technician name." },
                jobType: { type: "STRING", description: "Optional job type to filter by (e.g. 'HVAC diagnostics')." }
            },
            required: []
        }
    },
    {
        name: "findClosestTechnician",
        description: "Analyzes real-time schedules and locations to find the closest or most available technician to a specific address or customer. Use this when the user asks 'who is closest to' or 'who can take a call at'.",
        parameters: {
            type: "OBJECT",
            properties: {
                address: { type: "STRING", description: "The address, zip code, or customer name to route to." }
            },
            required: ["address"]
        }
    },
    {
        name: "upsertPricebookItem",
        description: "Adds or edits an item in the company's master pricebook (proposal presets). Use this when the user asks you to update the cost, labor, or add a new task to the service catalog.",
        parameters: {
            type: "OBJECT",
            properties: {
                name: { type: "STRING", description: "The exact name of the task or part to add/edit." },
                category: { type: "STRING", description: "The category (e.g. Diagnostics, Cooling, Heating, Electrical, Plumbing). Defaults to Other." },
                baseCost: { type: "NUMBER", description: "The base cost or internal unit cost of the part." },
                avgLabor: { type: "NUMBER", description: "The number of labor hours estimated for this task." },
                description: { type: "STRING", description: "Detailed description of the task." }
            },
            required: ["name"]
        }
    },
    {
        name: "searchDatabase",
        description: "Queries any database collection (e.g., users, customers, jobs, proposals, inventory, vehicles, checklists, refrigerantLogs, warrantyClaims). Use this to lookup IDs or fetch current data before updating an exact entity.",
        parameters: {
            type: "OBJECT",
            properties: {
                collectionName: { type: "STRING", description: "The system name of the collection (e.g., customers, users, jobs, tools, vehicles)." },
                searchTerm: { type: "STRING", description: "Optional case-insensitive term to filter down results." }
            },
            required: ["collectionName"]
        }
    },
    {
        name: "learnFact",
        description: "Saves a permanent fact, preference, or learned behavior about the current user or organization so you will remember it in ALL future conversations. Use this when the user says 'remember that I prefer...' or 'always do X for our company'.",
        parameters: {
            type: "OBJECT",
            properties: {
                scope: { type: "STRING", enum: ["user", "organization"], description: "Whether this fact applies only to the current user or the entire organization." },
                fact: { type: "STRING", description: "The specific fact or preference to remember." }
            },
            required: ["scope", "fact"]
        }
    },
    {
        name: "upsertRecord",
        description: "Creates or updates a record in ANY database collection. First use searchDatabase to learn the fields if you don't know them.",
        parameters: {
            type: "OBJECT",
            properties: {
                collectionName: { type: "STRING", description: "The collection to modify." },
                recordId: { type: "STRING", description: "The ID of the record to update. Omit to create a brand new record." },
                payload: { type: "OBJECT", description: "The JSON data object to save/update into the database." }
            },
            required: ["collectionName", "payload"]
        }
    },
    {
        name: "deleteRecord",
        description: "Deletes a specific record from the database. NEVER use this on users/organizations.",
        parameters: {
            type: "OBJECT",
            properties: {
                collectionName: { type: "STRING", description: "The collection name." },
                recordId: { type: "STRING", description: "The ID of the document to delete." },
                confirmed: { type: "BOOLEAN", description: "Set to true only if the user explicitly confirmed permanently deleting this record." }
            },
            required: ["collectionName", "recordId"]
        }
    },
    {
        name: "predictiveMaintenanceAnalysis",
        description: "Analyzes equipment history and past sensor/repair data to predict when a failure is likely to occur.",
        parameters: {
            type: "OBJECT",
            properties: {
                customerName: { type: "STRING", description: "Name of the customer." }
            },
            required: ["customerName"]
        }
    },
    {
        name: "makeOutboundPhoneCall",
        description: "Initiates an automated outbound phone call to a customer using Twilio.",
        parameters: {
            type: "OBJECT",
            properties: {
                customerName: { type: "STRING", description: "Name of the customer to call." },
                message: { type: "STRING", description: "The message you should speak over the phone." }
            },
            required: ["customerName", "message"]
        }
    },
    {
        name: "manageAbsence",
        description: "Unassigns jobs for a technician for the day because they called in sick or absent.",
        parameters: {
            type: "OBJECT",
            properties: {
                technicianName: { type: "STRING", description: "Name of the absent technician." },
                confirmed: { type: "BOOLEAN", description: "Set to true only if the user explicitly confirmed unassigning all active jobs for this technician." }
            },
            required: ["technicianName"]
        }
    },
    {
        name: "optimizeRoute",
        description: "Reorders a technician's jobs for the day to minimize driving. IMPORTANT: Do not change any scheduled appointment times by more than 1 hour. If a customer has an appointment, they wouldn't like for a tech to show up 4 hours later.",
        parameters: {
            type: "OBJECT",
            properties: {
                technicianName: { type: "STRING", description: "Name of the technician to optimize." }
            },
            required: ["technicianName"]
        }
    },
    {
        name: "harvestReviews",
        description: "Finds jobs completed 3+ days ago with no review and queues SMS follow-ups.",
        parameters: { type: "OBJECT", properties: {}, required: [] }
    },
    {
        name: "followUpOnDeadQuotes",
        description: "Finds high-value proposals sitting in 'Sent' status for 3+ days and automatically drafts/queues personalized follow-up emails/SMS.",
        parameters: { type: "OBJECT", properties: {}, required: [] }
    },
    {
        name: "generateInvoiceFromNotes",
        description: "Reads sloppy/raw technician notes, cross-references the Price Book, and generates a beautifully itemized DRAFT invoice. It DOES NOT send it to the customer automatically.",
        parameters: {
            type: "OBJECT",
            properties: {
                customerName: { type: "STRING", description: "Name of the customer." },
                jobId: { type: "STRING", description: "Optional Job ID to attach the invoice to." },
                rawNotes: { type: "STRING", description: "The raw voice-to-text or typed notes from the technician." }
            },
            required: ["customerName", "rawNotes"]
        }
    },
    {
        name: "pitchSeasonalTuneUps",
        description: "Analyzes the CRM to find customers who haven't had service in 11+ months and drafts targeted email/SMS campaigns offering a Pre-Season Tune-Up Special.",
        parameters: { type: "OBJECT", properties: {}, required: [] }
    },
    {
        name: "forecastInventory",
        description: "Looks at upcoming scheduled jobs on the board, estimates the required materials/parts, and drafts a Purchase Order for the supply house.",
        parameters: { type: "OBJECT", properties: {}, required: [] }
    },
    {
        name: "queueLongFormResearch",
        description: "Queues a massive, long-running research or analytics task (like analyzing years of jobs, generating tax reports, finding deep profitability insights). This runs in the background. Tell the user you have queued it and it will appear in their Virtual Worker Reports tab.",
        parameters: {
            type: "OBJECT",
            properties: {
                prompt: { type: "STRING", description: "The detailed prompt/instructions of what needs to be researched or generated." }
            },
            required: ["prompt"]
        }
    },
    {
        name: "predictCustomerChurn",
        description: "Analyzes historical job data to predict which customers are at high risk of leaving and generates a retention strategy.",
        parameters: { type: "OBJECT", properties: {}, required: [] }
    },
    {
        name: "draftTargetedUpsellScripts",
        description: "Analyzes equipment age and previous service history to draft highly targeted upsell scripts for technicians or call center staff.",
        parameters: { type: "OBJECT", properties: {}, required: [] }
    },
    {
        name: "generateTechnicianMatrix",
        description: "Analyzes labor hours vs completed job revenue to determine the most profitable and efficient technicians.",
        parameters: { type: "OBJECT", properties: {}, required: [] }
    },
    {
        name: "generateInventoryAudit",
        description: "Cross-references job notes, tool readings, and final invoices to identify inventory billing leakage.",
        parameters: { type: "OBJECT", properties: {}, required: [] }
    },
    {
        name: "generateMaintenanceForecaster",
        description: "Analyzes equipment age and historical breakdowns to create a targeted call list for preventative maintenance.",
        parameters: { type: "OBJECT", properties: {}, required: [] }
    },
    {
        name: "generateMarketingROI",
        description: "Calculates Customer Lifetime Value (CLV) and groups it by lead source to determine the highest ROI marketing channels.",
        parameters: { type: "OBJECT", properties: {}, required: [] }
    },
    {
        name: "generateRouteAudit",
        description: "Analyzes zip codes, dispatch times, and travel data to recommend more efficient dispatch zones and reduce windshield time.",
        parameters: { type: "OBJECT", properties: {}, required: [] }
    },
    {
        name: "generateInvoiceDunning",
        description: "Analyzes unpaid and overdue invoices to draft and queue automated SMS/Email collection reminders.",
        parameters: { type: "OBJECT", properties: {}, required: [] }
    },
    {
        name: "generateStaleEstimateReactivation",
        description: "Analyzes old rejected or expired high-value proposals to create a re-engagement SMS/Email campaign.",
        parameters: { type: "OBJECT", properties: {}, required: [] }
    },
    {
        name: "generateFleetAudit",
        description: "Cross-references fleet vehicle mileage and fuel logs against actual job locations to detect gas card abuse and inefficient routes.",
        parameters: { type: "OBJECT", properties: {}, required: [] }
    },
    {
        name: "generateTechnicalSchematic",
        description: "Generates a highly detailed, zoomable, and pannable technical SVG schematic diagram (electrical wiring, piping, flow) for field technicians to diagnose machinery.",
        parameters: {
            type: "OBJECT",
            properties: {
                equipmentBrand: { type: "STRING", description: "The brand of the equipment (e.g. Carrier, Trane)." },
                equipmentType: { type: "STRING", description: "The type of equipment (e.g. Dual-Stage Heat Pump, Air Handler)." },
                specDetails: { type: "STRING", description: "Specific features or fault context (e.g. dual-stage compressor wiring, Y1/Y2 calls)." }
            },
            required: ["equipmentBrand", "equipmentType"]
        }
    },
    {
        name: "searchWebDiagnostics",
        description: "Searches the web for manufacturer manuals, diagnostic code databases, and specific troubleshooting guidelines for rare or complex machinery.",
        parameters: {
            type: "OBJECT",
            properties: {
                query: { type: "STRING", description: "The specific diagnostic query, fault code, or manual search." }
            },
            required: ["query"]
        }
    },
    {
        name: "generateMarketingAsset",
        description: "Generates high-quality AI marketing graphics and visual assets directly for drafted social media posts.",
        parameters: {
            type: "OBJECT",
            properties: {
                prompt: { type: "STRING", description: "A detailed visual description for the AI image generator." },
                topic: { type: "STRING", description: "The subject or hook of the marketing asset." }
            },
            required: ["prompt", "topic"]
        }
    },
    {
        name: "requestToolSynthesis",
        description: "Autonomously synthesizes, compiles, and registers a brand new custom database/workflow tool on-the-fly when a user requests a capability that is not supported by the existing toolbox.",
        parameters: {
            type: "OBJECT",
            properties: {
                requestedCapability: { type: "STRING", description: "Full description of what the user wants to achieve." },
                proposedToolName: { type: "STRING", description: "The name of the new tool (camelCase, e.g. trackRefrigerantLeak)." },
                inputParameters: { type: "STRING", description: "JSON string representing the parameters the tool takes." },
                dataMutations: { type: "STRING", description: "Description of what database collections/fields are updated or queried." }
            },
            required: ["requestedCapability", "proposedToolName"]
        }
    },
    {
        name: "generateCommercialReferenceSheet",
        description: "Generates a formal, executive-ready business reference sheet listing all commercial customers, their contact details, service locations, assets, and project histories, then saves it directly to AI Worker Reports.",
        parameters: {
            type: "OBJECT",
            properties: {},
            required: []
        }
    },
    {
        name: "searchKnowledgeBase",
        description: "Queries the organization's technical knowledge base (equipment manuals, trade guides, compliance documents, and training resources) for relevant information.",
        parameters: {
            type: "OBJECT",
            properties: {
                query: { type: "STRING", description: "The specific search query or keywords to look up." }
            },
            required: ["query"]
        }
    },
    {
        name: "reportFailureToAdmin",
        description: "Triggers a diagnostic email report to the administrator explaining a failure, error, or limitation that the AI worker cannot autonomously fix, along with the chat log.",
        parameters: {
            type: "OBJECT",
            properties: {
                reason: { type: "STRING", description: "Detailed description of the issue encountered and why it cannot be autonomously fixed." }
            },
            required: ["reason"]
        }
    },
    {
        name: "saveChatAttachment",
        description: "Saves the image or screenshot attached in the current chat request (from the user's uploaded attachment) to either a job or customer files array in the database, uploading it to Firebase Storage.",
        parameters: {
            type: "OBJECT",
            properties: {
                customerName: { type: "STRING", description: "Name of the customer whose job or profile this file belongs to." },
                parentType: { type: "STRING", enum: ["job", "customer"], description: "Whether to link this attachment to the customer's active job/visit, or directly to their customer profile." },
                label: { type: "STRING", description: "The type/category of file (e.g. 'Before Photo', 'After Photo', 'Diagnostic Reading', 'document', 'Receipt')." },
                fileName: { type: "STRING", description: "Optional. Friendly filename for the file (e.g. 'burnt_capacitor.png')." }
            },
            required: ["customerName", "parentType", "label"]
        }
    },
    {
        name: "logPartsUsedToJob",
        description: "Logs a part, material, or inventory item used by the technician during the service call, updating the job's materials log.",
        parameters: {
            type: "OBJECT",
            properties: {
                customerName: { type: "STRING", description: "Name of the customer." },
                partName: { type: "STRING", description: "Name of the part or material installed." },
                quantity: { type: "NUMBER", description: "Number of units used." },
                paymentMethod: { type: "STRING", enum: ["inventory", "company", "personal", "other"], description: "How the part is sourced or paid for. Defaults to 'inventory'." },
                unitPrice: { type: "NUMBER", description: "Optional. Unit price/cost of the part. Defaults to 0." }
            },
            required: ["customerName", "partName", "quantity"]
        }
    },
    {
        name: "logRefrigerantUsage",
        description: "Logs refrigerant addition or recovery on the customer's HVAC equipment and updates active cylinder/tank tracking.",
        parameters: {
            type: "OBJECT",
            properties: {
                customerName: { type: "STRING", description: "Name of the customer." },
                type: { type: "STRING", description: "Refrigerant type (e.g. 'R-410A', 'R-22', 'R-134a', 'R-404A')." },
                action: { type: "STRING", enum: ["Added", "Recovered"], description: "Whether refrigerant was added to the system or recovered/reclaimed from it." },
                amount: { type: "NUMBER", description: "Numeric amount added or recovered." },
                unit: { type: "STRING", enum: ["lbs", "oz", "kg"], description: "Weight unit of measurement." },
                cylinderNumber: { type: "STRING", description: "Optional. The cylinder number or cylinder document ID to deduct weight from/add weight to." }
            },
            required: ["customerName", "type", "action", "amount", "unit"]
        }
    },
    {
        name: "logJobPayment",
        description: "Logs a manual payment (Cash, Check, Manual Card, or Other) received on site for a customer's active job and invoice.",
        parameters: {
            type: "OBJECT",
            properties: {
                customerName: { type: "STRING", description: "Name of the customer." },
                amount: { type: "NUMBER", description: "The amount paid." },
                paymentMethod: { type: "STRING", enum: ["Cash", "Check", "Manual Card", "Other"], description: "Payment method." },
                settleInFull: { type: "BOOLEAN", description: "Whether this payment settles the invoice in full. Defaults to true." },
                proofUrl: { type: "STRING", description: "Optional. URL link to a photo of check/receipt or payment confirmation." },
                notes: { type: "STRING", description: "Optional. Additional details (e.g., check number)." }
            },
            required: ["customerName", "amount", "paymentMethod"]
        }
    },
    {
        name: "generateDailyBriefing",
        description: "Compiles a comprehensive morning, nightly, or weekly operational briefing for technicians and managers. Summarizes active/unassigned jobs, technician rosters, emergencies, and uncollected revenue.",
        parameters: {
            type: "OBJECT",
            properties: {
                type: { type: "STRING", enum: ["morning", "nightly", "weekly"], description: "The briefing timeframe type." },
                targetDate: { type: "STRING", description: "Optional target date (YYYY-MM-DD). Defaults to today in user's timezone." }
            }
        }
    },
    {
        name: "optimizeDispatchRoutes",
        description: "Autonomously optimizes dispatch routes by analyzing job locations, zip codes, and scheduled windows to group appointments geographically and minimize technician drive time. Supports previewing and two-phase confirmation.",
        parameters: {
            type: "OBJECT",
            properties: {
                technicianName: { type: "STRING", description: "Optional technician name to optimize for. If omitted, optimizes routes for all active technicians." },
                targetDate: { type: "STRING", description: "Optional target date (YYYY-MM-DD). Defaults to today." },
                confirmed: { type: "BOOLEAN", description: "Set to true only if the user explicitly confirmed applying the proposed route optimization." }
            }
        }
    },
    {
        name: "chaseOverdueInvoices",
        description: "Scans completed jobs and pending invoices that are past due according to each customer's agreed Net Terms (e.g. Net 15, Net 30, Net 45, Net 60, Due on Receipt), generates direct TekTrakker Kort online payment links, and drafts courteous payment reminders for customers. Accounts within their agreed credit window (e.g. a Net 45 customer at 30 days) are automatically protected and skipped. Restricted to Admin and Supervisor roles.",
        parameters: {
            type: "OBJECT",
            properties: {
                minDaysPastDue: { type: "NUMBER", description: "Minimum number of days past due beyond their agreed Net Terms (defaults to 1 day past due)." },
                customerId: { type: "STRING", description: "Optional customer ID or name to filter by." },
                action: { type: "STRING", enum: ["preview", "generate_links", "queue_reminders"], description: "Whether to preview overdue invoices, generate payment links, or queue reminder communications." },
                confirmed: { type: "BOOLEAN", description: "Set to true only if the user explicitly confirmed queuing reminder messages to customers." }
            }
        }
    },
    {
        name: "auditJobCompliance",
        description: "Performs a rigorous pre-close quality control and compliance audit on a job before completion. Checks for required photos, EPA refrigerant usage logs, customer sign-off signature, and safety checklists.",
        parameters: {
            type: "OBJECT",
            properties: {
                customerName: { type: "STRING", description: "Name of the customer whose job is being audited." },
                strictMode: { type: "BOOLEAN", description: "Whether to enforce strict failure if optional diagnostic notes are absent." }
            },
            required: ["customerName"]
        }
    },
    {
        name: "registerCustomerEquipment",
        description: "Registers or updates an equipment asset for a customer profile. Can be called directly or autonomously populated from an attached equipment rating data plate photo.",
        parameters: {
            type: "OBJECT",
            properties: {
                customerName: { type: "STRING", description: "Name of the customer who owns the equipment." },
                brand: { type: "STRING", description: "Manufacturer/Brand name (e.g. Trane, Carrier, Lennox, Goodman)." },
                model: { type: "STRING", description: "Model number extracted from equipment data plate." },
                serial: { type: "STRING", description: "Serial number extracted from equipment data plate." },
                type: { type: "STRING", description: "Type of unit (e.g., 'Heat Pump', 'Gas Furnace', 'Air Handler', 'Condenser', 'Rooftop Unit', 'Package Unit')." },
                tonnage: { type: "NUMBER", description: "Nominal cooling capacity in tons (e.g. 2.5, 3.0, 4.0, 5.0)." },
                refrigerantType: { type: "STRING", description: "Refrigerant type (e.g., 'R-410A', 'R-22', 'R-454B', 'R-32')." },
                year: { type: "STRING", description: "Estimated year of manufacture (e.g. '2019')." },
                volts: { type: "STRING", description: "Electrical voltage rating (e.g. '208/230V')." },
                amps: { type: "STRING", description: "Rated minimum circuit ampacity or MCA." },
                notes: { type: "STRING", description: "Physical location notes (e.g., 'Attic', 'West exterior pad', 'Roof RTU-2')." }
            },
            required: ["customerName", "brand", "model", "serial"]
        }
    }
];

export function getAgentToolbox(customDeclarations: any[] = []) {
    return {
        functionDeclarations: [
            ...customDeclarations,
            ...standardToolDeclarations
        ]
    };
}
