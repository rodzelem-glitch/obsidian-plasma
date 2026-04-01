export interface DiagnosticReport {
    id: string;
    jobId: string;
    organizationId: string;
    source: 'measureQuick' | 'manual';
    healthScore?: number;
    systemType?: string;
    pdfReportUrl?: string;
    measurements?: {
        outdoorTemp?: number;
        indoorTemp?: number;
        suctionPressure?: number;
        liquidPressure?: number;
        superheat?: number;
        subcooling?: number;
    };
    diagnostics?: string[];
    createdAt: string;
}
