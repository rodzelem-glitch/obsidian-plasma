/**
 * Trade Resolver Utility
 * Single Source of Truth for resolving the active trade/industry for a job or organization.
 */

export function resolveJobTrade(job?: any, organization?: any): string {
  if (!job && !organization) return 'HVAC';

  // 1. Direct job industry / trade / vertical / serviceType
  if (job?.trade && typeof job.trade === 'string' && job.trade.trim() !== '') return job.trade.trim();
  if (job?.industry && typeof job.industry === 'string' && job.industry.trim() !== '') return job.industry.trim();
  if (job?.vertical && typeof job.vertical === 'string' && job.vertical.trim() !== '') return job.vertical.trim();
  if (job?.serviceType && typeof job.serviceType === 'string' && job.serviceType.trim() !== '') return job.serviceType.trim();

  // 2. Division trade lookup from organization.divisions using job.divisionId
  if (job?.divisionId && organization?.divisions && Array.isArray(organization.divisions)) {
    const matchedDivision = organization.divisions.find((d: any) => d.id === job.divisionId);
    const divTrade = matchedDivision?.trade || matchedDivision?.industryTrade || matchedDivision?.name;
    if (divTrade && typeof divTrade === 'string' && divTrade.trim() !== '') {
      return divTrade.trim();
    }
  }

  // 3. Deep scan of job object for explicit trade keywords in division, tasks, titles, or divisionId
  if (job) {
    const jobStr = (
      (job.divisionName || '') + ' ' + 
      (job.divisionId || '') + ' ' + 
      (job.title || '') + ' ' + 
      (Array.isArray(job.tasks) ? job.tasks.join(' ') : '') + ' ' + 
      (job.description || '') + ' ' +
      (job.notes?.diagnosis || '') + ' ' +
      (job.notes?.workNotes || '')
    ).toUpperCase();

    if (jobStr.includes('ELECTR')) return 'Electrical';
    if (jobStr.includes('PLUMB')) return 'Plumbing';
    if (jobStr.includes('LANDSCAPE') || jobStr.includes('IRRIGAT')) return 'Landscaping';
    if (jobStr.includes('ROOF')) return 'Roofing';
    if (jobStr.includes('PAINT')) return 'Painting';
    if (jobStr.includes('CLEAN') || jobStr.includes('JANITOR')) return 'Cleaning';
    if (jobStr.includes('CONTRACT') || jobStr.includes('CARPENT') || jobStr.includes('REMODEL')) return 'Contracting';
    if (jobStr.includes('MASON') || jobStr.includes('CONCRETE')) return 'Masonry';
    if (jobStr.includes('TELECOM') || jobStr.includes('CABLING')) return 'Telecommunications';
    if (jobStr.includes('SOLAR')) return 'Solar';
    if (jobStr.includes('SECUR') || jobStr.includes('ACCESS CONTROL')) return 'Security';
    if (jobStr.includes('GROOM') || jobStr.includes('PET')) return 'Pet Grooming';
  }

  // 4. If job has a divisionId set but organization divisions wasn't loaded, default to Electrical if divisionId present & org is HVAC
  if (job?.divisionId && (!organization?.divisions || organization.divisions.length === 0)) {
    return 'Electrical'; // Division jobs default to non-HVAC Electrical
  }

  // 5. Organization primary industry / trade
  if (organization?.industry && typeof organization.industry === 'string' && organization.industry.trim() !== '') return organization.industry.trim();
  if (organization?.trade && typeof organization.trade === 'string' && organization.trade.trim() !== '') return organization.trade.trim();

  return 'HVAC';
}

export function isHvacTrade(job?: any, organization?: any): boolean {
  const trade = resolveJobTrade(job, organization).toUpperCase();
  return trade.includes('HVAC');
}
