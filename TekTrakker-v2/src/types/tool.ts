
export interface ToolReading {
    id: string;
    toolType: string;
    date: string;
    technicianId: string;
    data: any;
    results: any;
    summary: string;
    reportUrl?: string;
}

export interface ToolMaintenanceLog {
    id: string;
    organizationId: string;
    date: string;
    toolType: string;
    serialNumber: string;
    action?: string;
    result?: string;
    nextDueDate?: string;
    notes?: string;
}
