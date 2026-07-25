(function() {
    // 1. Configuration
    const scriptTag = document.currentScript || document.querySelector('script[data-org-id]');
    const orgId = scriptTag ? scriptTag.getAttribute('data-org-id') : null;
    const functionUrl = scriptTag ? scriptTag.getAttribute('data-function-url') : null;
    const googleMapsApiKey = scriptTag ? scriptTag.getAttribute('data-maps-api-key') : null;
    const mode = scriptTag ? scriptTag.getAttribute('data-mode') : 'popup';
    const containerId = scriptTag ? scriptTag.getAttribute('data-container-id') : 'tt-booking-container';

    const widgetSrc = scriptTag ? scriptTag.getAttribute('src') : '';
    let baseUrl = 'https://tektrakker.web.app';
    if (widgetSrc && widgetSrc.startsWith('http')) {
        try {
            baseUrl = new URL(widgetSrc).origin;
        } catch(e) {}
    }

    if (!orgId || !functionUrl) {
        console.error("TekTrakker Widget: Missing org-id or function-url.");
        return;
    }

    // 2. Dynamic Data
    const serviceCategories = ['HVAC', 'Plumbing', 'Electrical', 'Other'];
    const jobTypes = ['Emergency Repair', 'Maintenance / Tune-up', 'New Installation', 'Quote / Estimate'];
    const arrivalWindows = ['8am - 11am', '11am - 2pm', '2pm - 5pm', '5pm - 8pm (After Hours)'];

    // 3. CSS Styles
    const styles = `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        .tt-widget-fab-container { position: fixed; bottom: 20px; right: 20px; display: flex; flex-direction: column; align-items: center; z-index: 9999; }
        .tt-widget-fab { background-color: #0284c7; color: white; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.2); cursor: pointer; font-size: 24px; transition: transform 0.2s; }
        .tt-widget-fab:hover { transform: scale(1.05); }
        .tt-widget-seo-link { display: block; font-size: 10px; color: #9ca3af; text-decoration: none; margin-top: 6px; font-family: 'Plus Jakarta Sans', sans-serif; opacity: 0.8; transition: opacity 0.2s; }
        .tt-widget-seo-link:hover { opacity: 1; text-decoration: underline; color: #6b7280; }
        .tt-widget-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15,23,42,0.6); display: none; z-index: 10000; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
        .tt-widget-container { background: white; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); width: 100%; height: 100%; max-width: 100%; max-height: 100%; overflow-y: auto; font-family: 'Plus Jakarta Sans', sans-serif; border: 1px solid #e2e8f0; }
        .tt-widget-header { padding: 24px 24px 16px 24px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        .tt-widget-title { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin: 0; }
        .tt-widget-close { cursor: pointer; font-size: 1.5rem; color: #94a3b8; transition: color 0.2s; }
        .tt-widget-close:hover { color: #64748b; }
        .tt-widget-content { padding: 24px; }
        .tt-widget-section-title { font-size: 0.875rem; font-weight: 700; margin-top: 24px; margin-bottom: 16px; padding-bottom: 6px; border-bottom: 1px solid #f1f5f9; color: #0284c7; text-transform: uppercase; tracking: 0.05em; }
        .tt-widget-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        .tt-widget-group { display: flex; flex-direction: column; margin-bottom: 16px; }
        .tt-widget-label { font-size: 0.75rem; font-weight: 600; color: #475569; margin-bottom: 6px; text-transform: uppercase; tracking: 0.02em; }
        .tt-widget-input, .tt-widget-select { width: 100%; padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 8px; box-sizing: border-box; font-size: 0.875rem; font-family: inherit; color: #334155; transition: border-color 0.2s, box-shadow 0.2s; background: #fff; }
        .tt-widget-input::placeholder { color: #94a3b8; }
        .tt-widget-input:focus, .tt-widget-select:focus { outline: none; border-color: #0284c7; box-shadow: 0 0 0 3px rgba(2,132,199,0.15); }
        
        /* Customer Types Cards */
        .tt-widget-customer-types { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 10px; margin-bottom: 20px; }
        .tt-widget-customer-card { flex: 1; min-width: 90px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s ease-in-out; position: relative; background: #fff; text-align: center; }
        .tt-widget-customer-card:hover { border-color: #0284c7; background: #f8fafc; }
        .tt-widget-customer-card.active { border-color: #0284c7; background: #eff6ff; }
        .tt-widget-customer-card svg { width: 22px; height: 22px; stroke: #64748b; fill: none; stroke-width: 1.75; margin-bottom: 8px; transition: stroke 0.2s; }
        .tt-widget-customer-card.active svg { stroke: #0284c7; }
        .tt-widget-customer-card-title { font-size: 0.7rem; font-weight: 600; color: #475569; user-select: none; line-height: 1.2; }
        .tt-widget-customer-card.active .tt-widget-customer-card-title { color: #0369a1; }
        .tt-widget-customer-card-badge { display: none; position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%); width: 14px; height: 14px; border-radius: 50%; background: #0284c7; color: white; align-items: center; justify-content: center; font-size: 8px; }
        .tt-widget-customer-card.active .tt-widget-customer-card-badge { display: flex; }

        /* Custom File Uploads */
        .tt-widget-file-upload { border: 1.5px dashed #cbd5e1; border-radius: 10px; padding: 16px; text-align: center; cursor: pointer; transition: border-color 0.2s, background-color 0.2s; background: #f8fafc; display: flex; flex-direction: column; align-items: center; gap: 6px; }
        .tt-widget-file-upload:hover { border-color: #0284c7; background-color: #eff6ff; }
        .tt-widget-file-upload svg { width: 26px; height: 26px; stroke: #94a3b8; stroke-width: 1.5; fill: none; }
        .tt-widget-file-upload:hover svg { stroke: #0284c7; }
        .tt-widget-file-upload-btn { font-size: 0.8rem; font-weight: 700; color: #0284c7; }
        .tt-widget-file-upload-status { font-size: 0.7rem; color: #64748b; word-break: break-all; }

        .tt-widget-button { width: 100%; padding: 14px; background-color: #0284c7; color: white; border: none; border-radius: 8px; font-size: 0.95rem; font-weight: 700; cursor: pointer; transition: background-color 0.2s; }
        .tt-widget-button:hover { background-color: #0369a1; }
        .tt-widget-button:disabled { background-color: #94a3b8; cursor: not-allowed; }
        .tt-widget-footer { text-align: center; padding: 20px; border-top: 1px solid #f1f5f9; display: flex; flex-direction: column; align-items: center; gap: 8px; }
        .tt-widget-footer a { display: inline-flex; align-items: center; color: #64748b; text-decoration: none; font-size: 0.75rem; font-weight: 500; }
        .tt-widget-footer a:hover { color: #334155; }
        .tt-widget-success-message { text-align: center; padding: 40px 24px; color: #059669; font-size: 1.15rem; font-weight: 600; }
        
        .tt-details-section { display: none; }
        .tt-details-section.active { display: block; }
        
        @media (max-width: 768px) {
            .tt-widget-grid { display: flex !important; flex-direction: column; width: 100%; gap: 0; }
            .tt-widget-group { width: 100%; }
            .tt-widget-container { border-radius: 0; max-height: 100%; height: 100%; }
        }
    `;

    // 4. Initialization
    function initializeWidget() {
        const styleSheet = document.createElement("style");
        styleSheet.innerText = styles;
        document.head.appendChild(styleSheet);

        const fullHTML = `
            <div class="tt-widget-container">
                <div class="tt-widget-header">
                    <h3 class="tt-widget-title">Request a Service</h3>
                    ${mode === 'popup' ? '<span class="tt-widget-close">&times;</span>' : ''}
                </div>
                <div class="tt-widget-content">
                    <div id="tt-success-message" class="tt-widget-success-message" style="display: none;">
                        Thank you for your request! We will be in touch shortly.
                    </div>
                    <form id="tt-booking-form">
                        <label class="tt-widget-label">Customer Type</label>
                        <div class="tt-widget-customer-types">
                            <div class="tt-widget-customer-card active" data-type="Homeowner">
                                <svg viewBox="0 0 24 24"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                <span class="tt-widget-customer-card-title">Homeowner</span>
                                <div class="tt-widget-customer-card-badge">✓</div>
                            </div>
                            <div class="tt-widget-customer-card" data-type="Renter / Tenant">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                <span class="tt-widget-customer-card-title">Renter /<br>Tenant</span>
                                <div class="tt-widget-customer-card-badge">✓</div>
                            </div>
                            <div class="tt-widget-customer-card" data-type="Business / Commercial">
                                <svg viewBox="0 0 24 24"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                <span class="tt-widget-customer-card-title">Business /<br>Commercial</span>
                                <div class="tt-widget-customer-card-badge">✓</div>
                            </div>
                            <div class="tt-widget-customer-card" data-type="Property Manager">
                                <svg viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                <span class="tt-widget-customer-card-title">Property<br>Manager</span>
                                <div class="tt-widget-customer-card-badge">✓</div>
                            </div>
                            <div class="tt-widget-customer-card" data-type="General Contractor">
                                <svg viewBox="0 0 24 24"><path d="M4 15a8 8 0 0116 0H4zm0 0v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 4v4m0 0H8m4 0h4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                <span class="tt-widget-customer-card-title">General<br>Contractor</span>
                                <div class="tt-widget-customer-card-badge">✓</div>
                            </div>
                        </div>

                        <!-- 1. Homeowner Details -->
                        <div id="tt-details-Homeowner" class="tt-details-section active">
                            <h4 class="tt-widget-section-title">Homeowner Details</h4>
                            <div class="tt-widget-grid">
                                <div class="tt-widget-group"><label class="tt-widget-label">Full Name</label><input class="tt-widget-input" name="name" data-required="true" required></div>
                                <div class="tt-widget-group"><label class="tt-widget-label">Phone</label><input class="tt-widget-input" name="phone" type="tel" placeholder="(210) 555-1234" data-required="true" required></div>
                            </div>
                            <div class="tt-widget-group"><label class="tt-widget-label">Email</label><input class="tt-widget-input" name="email" type="email" placeholder="name@domain.com" data-required="true" required></div>
                            <div class="tt-widget-group"><label class="tt-widget-label">Service Address</label><input class="tt-widget-input tt-address-autocomplete" name="address" placeholder="Start typing your address..." data-required="true" required></div>
                            <div class="tt-widget-group"><label class="tt-widget-label">Are you the property owner?</label>
                                <div style="display:flex; gap:16px; margin-top:6px; font-size:0.9rem;">
                                    <label style="cursor:pointer;"><input type="radio" name="isOwner" value="Yes" checked> Yes</label>
                                    <label style="cursor:pointer;"><input type="radio" name="isOwner" value="No"> No</label>
                                </div>
                            </div>
                            <div class="tt-owner-subdetails" style="display:none; margin-top:12px; padding:12px; background:#f8fafc; border-radius:8px;">
                                <div class="tt-widget-grid">
                                    <div class="tt-widget-group"><label class="tt-widget-label">Owner's Name</label><input class="tt-widget-input" name="ownerName"></div>
                                    <div class="tt-widget-group"><label class="tt-widget-label">Owner's Phone</label><input class="tt-widget-input" name="ownerPhone" type="tel"></div>
                                </div>
                            </div>
                        </div>

                        <!-- 2. Renter / Tenant Details -->
                        <div id="tt-details-Tenant" class="tt-details-section">
                            <h4 class="tt-widget-section-title">Renter / Tenant Details</h4>
                            <div class="tt-widget-grid">
                                <div class="tt-widget-group"><label class="tt-widget-label">Tenant Name</label><input class="tt-widget-input" name="tenantName" data-required="true"></div>
                                <div class="tt-widget-group"><label class="tt-widget-label">Tenant Phone</label><input class="tt-widget-input" name="tenantPhone" type="tel" placeholder="(210) 555-1234" data-required="true"></div>
                            </div>
                            <div class="tt-widget-group"><label class="tt-widget-label">Tenant Email</label><input class="tt-widget-input" name="tenantEmail" type="email" placeholder="tenant@domain.com" data-required="true"></div>
                            <div class="tt-widget-group"><label class="tt-widget-label">Service Address</label><input class="tt-widget-input tt-address-autocomplete" name="tenantAddress" placeholder="Start typing your address..." data-required="true"></div>
                            <div class="tt-widget-grid" style="margin-top:12px; padding:12px; background:#f8fafc; border-radius:8px;">
                                <div class="tt-widget-group"><label class="tt-widget-label">Landlord / Owner Name</label><input class="tt-widget-input" name="landlordName" placeholder="Owner or PM name"></div>
                                <div class="tt-widget-group"><label class="tt-widget-label">Landlord / Owner Phone</label><input class="tt-widget-input" name="landlordPhone" type="tel" placeholder="Owner or PM phone"></div>
                            </div>
                        </div>

                        <!-- 3. Business / Commercial Details -->
                        <div id="tt-details-Commercial" class="tt-details-section">
                            <h4 class="tt-widget-section-title">Business / Commercial Details</h4>
                            <div class="tt-widget-grid">
                                <div class="tt-widget-group"><label class="tt-widget-label">Business Name</label><input class="tt-widget-input" name="businessName" placeholder="Enter business name" data-required="true"></div>
                                <div class="tt-widget-group"><label class="tt-widget-label">Store / Location #</label><input class="tt-widget-input" name="storeLocation" placeholder="Enter store or location #"></div>
                            </div>
                            <div class="tt-widget-grid">
                                <div class="tt-widget-group"><label class="tt-widget-label">On-Site Contact Name</label><input class="tt-widget-input" name="onSiteContactName" placeholder="Enter contact name" data-required="true"></div>
                                <div class="tt-widget-group"><label class="tt-widget-label">Phone</label><input class="tt-widget-input" name="commercialPhone" type="tel" placeholder="(210) 555-1234" data-required="true"></div>
                                <div class="tt-widget-group"><label class="tt-widget-label">Email</label><input class="tt-widget-input" name="commercialEmail" type="email" placeholder="name@company.com" data-required="true"></div>
                            </div>
                            <div class="tt-widget-group"><label class="tt-widget-label">Service Address</label><input class="tt-widget-input tt-address-autocomplete" name="commercialAddress" placeholder="Start typing your address..." data-required="true"></div>
                            <div class="tt-widget-group">
                                <label class="tt-widget-label">Are you authorized to request and approve service at this location?</label>
                                <div style="display:flex; gap:16px; margin-top:6px; font-size:0.9rem;">
                                    <label style="cursor:pointer;"><input type="radio" name="authorizedToApprove" value="Yes" checked> Yes</label>
                                    <label style="cursor:pointer;"><input type="radio" name="authorizedToApprove" value="No"> No</label>
                                </div>
                            </div>
                            <div class="tt-widget-group"><label class="tt-widget-label">Billing Contact Email</label><input class="tt-widget-input" name="commercialBillingEmail" type="email" placeholder="billing@company.com"></div>
                            <div class="tt-widget-grid">
                                <div class="tt-widget-group">
                                    <label class="tt-widget-label">PO Required?</label>
                                    <div style="display:flex; gap:16px; margin-top:6px; font-size:0.9rem;">
                                        <label style="cursor:pointer;"><input type="radio" name="poRequired" value="Yes"> Yes</label>
                                        <label style="cursor:pointer;"><input type="radio" name="poRequired" value="No" checked> No</label>
                                    </div>
                                </div>
                                <div class="tt-widget-group">
                                    <label class="tt-widget-label">Approval Limit</label>
                                    <select class="tt-widget-select" name="approvalLimit">
                                        <option>$500</option>
                                        <option>$1000</option>
                                        <option>$2000</option>
                                        <option>$5000</option>
                                        <option>No Limit</option>
                                    </select>
                                </div>
                            </div>
                            <div class="tt-widget-group">
                                <label class="tt-widget-label">Tax Exempt?</label>
                                <div style="display:flex; gap:16px; margin-top:6px; font-size:0.9rem;">
                                    <label style="cursor:pointer;"><input type="radio" name="commercialTaxExempt" value="Yes"> Yes</label>
                                    <label style="cursor:pointer;"><input type="radio" name="commercialTaxExempt" value="No" checked> No</label>
                                </div>
                            </div>
                        </div>

                        <!-- 4. Property Manager Details -->
                        <div id="tt-details-PropertyManager" class="tt-details-section">
                            <h4 class="tt-widget-section-title">Property Manager Details</h4>
                            <div class="tt-widget-grid">
                                <div class="tt-widget-group"><label class="tt-widget-label">Management Company Name</label><input class="tt-widget-input" name="pmCompanyName" placeholder="Management company name" data-required="true"></div>
                                <div class="tt-widget-group"><label class="tt-widget-label">Contact Person Name</label><input class="tt-widget-input" name="pmContactName" placeholder="Enter contact name" data-required="true"></div>
                            </div>
                            <div class="tt-widget-grid">
                                <div class="tt-widget-group"><label class="tt-widget-label">Phone</label><input class="tt-widget-input" name="pmPhone" type="tel" placeholder="(210) 555-1234" data-required="true"></div>
                                <div class="tt-widget-group"><label class="tt-widget-label">Email</label><input class="tt-widget-input" name="pmEmail" type="email" placeholder="pm@domain.com" data-required="true"></div>
                            </div>
                            <div class="tt-widget-group"><label class="tt-widget-label">Service Address</label><input class="tt-widget-input tt-address-autocomplete" name="pmAddress" placeholder="Start typing your address..." data-required="true"></div>
                            <div class="tt-widget-group">
                                <label class="tt-widget-label">Is Owner Approval Required?</label>
                                <div style="display:flex; gap:16px; margin-top:6px; font-size:0.9rem;">
                                    <label style="cursor:pointer;"><input type="radio" name="ownerApprovalRequired" value="Yes" checked> Yes</label>
                                    <label style="cursor:pointer;"><input type="radio" name="ownerApprovalRequired" value="No"> No</label>
                                </div>
                            </div>
                            <div class="tt-widget-group"><label class="tt-widget-label">Billing Contact Email</label><input class="tt-widget-input" name="pmBillingEmail" type="email" placeholder="ap@domain.com"></div>
                            <div class="tt-widget-group">
                                <label class="tt-widget-label">Tax Exempt?</label>
                                <div style="display:flex; gap:16px; margin-top:6px; font-size:0.9rem;">
                                    <label style="cursor:pointer;"><input type="radio" name="pmTaxExempt" value="Yes"> Yes</label>
                                    <label style="cursor:pointer;"><input type="radio" name="pmTaxExempt" value="No" checked> No</label>
                                </div>
                            </div>
                        </div>

                        <!-- 5. General Contractor Details -->
                        <div id="tt-details-GC" class="tt-details-section">
                            <h4 class="tt-widget-section-title">General Contractor Details</h4>
                            <div class="tt-widget-grid">
                                <div class="tt-widget-group"><label class="tt-widget-label">GC Company Name</label><input class="tt-widget-input" name="gcCompanyName" placeholder="GC company name" data-required="true"></div>
                                <div class="tt-widget-group"><label class="tt-widget-label">Project Manager Name</label><input class="tt-widget-input" name="gcContactName" placeholder="Enter PM name" data-required="true"></div>
                            </div>
                            <div class="tt-widget-grid">
                                <div class="tt-widget-group"><label class="tt-widget-label">Phone</label><input class="tt-widget-input" name="gcPhone" type="tel" placeholder="(210) 555-1234" data-required="true"></div>
                                <div class="tt-widget-group"><label class="tt-widget-label">Email</label><input class="tt-widget-input" name="gcEmail" type="email" placeholder="pm@gc-firm.com" data-required="true"></div>
                            </div>
                            <div class="tt-widget-group"><label class="tt-widget-label">Service Address</label><input class="tt-widget-input tt-address-autocomplete" name="gcAddress" placeholder="Start typing your address..." data-required="true"></div>
                            <div class="tt-widget-grid">
                                <div class="tt-widget-group"><label class="tt-widget-label">Job Name / Reference #</label><input class="tt-widget-input" name="gcJobName" placeholder="Job name or reference #"></div>
                                <div class="tt-widget-group"><label class="tt-widget-label">Billing/AP Email</label><input class="tt-widget-input" name="gcBillingEmail" type="email" placeholder="ap@gc-firm.com"></div>
                            </div>
                            <div class="tt-widget-grid">
                                <div class="tt-widget-group">
                                    <label class="tt-widget-label">PO Required?</label>
                                    <div style="display:flex; gap:16px; margin-top:6px; font-size:0.9rem;">
                                        <label style="cursor:pointer;"><input type="radio" name="gcPoRequired" value="Yes"> Yes</label>
                                        <label style="cursor:pointer;"><input type="radio" name="gcPoRequired" value="No" checked> No</label>
                                    </div>
                                </div>
                                <div class="tt-widget-group">
                                    <label class="tt-widget-label">Tax Exempt?</label>
                                    <div style="display:flex; gap:16px; margin-top:6px; font-size:0.9rem;">
                                        <label style="cursor:pointer;"><input type="radio" name="gcTaxExempt" value="Yes"> Yes</label>
                                        <label style="cursor:pointer;"><input type="radio" name="gcTaxExempt" value="No" checked> No</label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <h4 class="tt-widget-section-title">Service Details</h4>
                        <div class="tt-widget-grid">
                            <div class="tt-widget-group"><label class="tt-widget-label">Service Category</label><select id="tt-service-category" class="tt-widget-select" name="serviceCategory">${serviceCategories.map(c => `<option>${c}</option>`).join('')}</select></div>
                            <div class="tt-widget-group"><label class="tt-widget-label">Job Type</label><select class="tt-widget-select" name="jobType">${jobTypes.map(t => `<option>${t}</option>`).join('')}</select></div>
                        </div>
                        <div id="tt-hvac-details" class="tt-widget-grid" style="display: grid;">
                           <div class="tt-widget-group"><label class="tt-widget-label">System Age (Years)</label><input class="tt-widget-input" name="systemAge" type="number"></div>
                           <div class="tt-widget-group"><label class="tt-widget-label">System Brand</label><input class="tt-widget-input" name="systemBrand" placeholder="e.g., Trane"></div>
                        </div>
                        <div class="tt-widget-group"><label class="tt-widget-label">Issue Summary</label><textarea class="tt-widget-input" name="issueSummary" rows="3" placeholder="Please describe the issue or equipment needing service..." style="resize:vertical;"></textarea></div>

                        <h4 class="tt-widget-section-title">Scheduling</h4>
                        <div class="tt-widget-grid">
                           <div class="tt-widget-group"><label class="tt-widget-label">Preferred Date</label><input class="tt-widget-input" id="tt-date" name="date" type="date" required></div>
                           <div class="tt-widget-group"><label class="tt-widget-label">Arrival Window</label><select class="tt-widget-select" name="arrivalWindow">${arrivalWindows.map(w => `<option>${w}</option>`).join('')}</select></div>
                        </div>

                        <h4 class="tt-widget-section-title">Extras</h4>
                        <div class="tt-widget-grid">
                            <div class="tt-widget-group">
                                <label class="tt-widget-label">Upload a Photo (Optional)</label>
                                <div class="tt-widget-file-upload" onclick="this.querySelector('input').click()">
                                    <svg viewBox="0 0 24 24"><path d="M12 16v-8m0 0l-3 3m3-3l3 3M3 15v3a2 2 0 002 2h14a2 2 0 002-2v-3" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                    <span class="tt-widget-file-upload-btn">Choose File</span>
                                    <span class="tt-widget-file-upload-status">No file chosen</span>
                                    <input type="file" name="photo" accept="image/*" style="display:none;" onchange="this.parentElement.querySelector('.tt-widget-file-upload-status').innerText = this.files[0] ? this.files[0].name : 'No file chosen'">
                                </div>
                            </div>
                            <div class="tt-widget-group">
                                <label class="tt-widget-label">Upload Tax Exempt Certificate (Optional)</label>
                                <div class="tt-widget-file-upload" onclick="this.querySelector('input').click()">
                                    <svg viewBox="0 0 24 24"><path d="M12 16v-8m0 0l-3 3m3-3l3 3M3 15v3a2 2 0 002 2h14a2 2 0 002-2v-3" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                    <span class="tt-widget-file-upload-btn">Choose File</span>
                                    <span class="tt-widget-file-upload-status">No file chosen</span>
                                    <input type="file" name="taxExemptFile" accept=".pdf,image/*" style="display:none;" onchange="this.parentElement.querySelector('.tt-widget-file-upload-status').innerText = this.files[0] ? this.files[0].name : 'No file chosen'">
                                </div>
                            </div>
                        </div>

                        <label style="display:flex; align-items:flex-start; gap:8px; margin-top:16px; padding:12px; background-color:#eff6ff; border:1px solid #dbeafe; border-radius:8px; font-size:0.75rem; color:#1e40af; cursor:pointer; line-height:1.4;">
                             <input type="checkbox" required name="consent" value="true" style="margin-top:2px;">
                             <span>
                                By checking this box, you consent to receive SMS messages from TekAir Inc. regarding your service request. Message and data rates may apply. Message frequency varies. Reply STOP to opt-out or HELP for help. View our Privacy Policy at <a href="https://tekairinc.com/privacy" target="_blank" style="color:#1d4ed8; text-decoration:underline;">https://tekairinc.com/privacy</a>
                             </span>
                        </label>
                        <button type="submit" class="tt-widget-button" style="margin-top:24px;">Confirm Booking</button>
                    </form>
                </div>
                <div class="tt-widget-footer">
                    <a href="https://tektrakker.web.app" target="_blank" rel="noopener noreferrer">
                        Powered by <img src="${baseUrl}/tektrakker-logo-web.png" alt="TekTrakker" style="height: 16px; display: inline-block; vertical-align: middle; margin-left: 6px;" />
                    </a>
                    <div style="font-size:0.7rem; color:#64748b; font-weight: 600; margin-top: 4px;">
                        Need Immediate 24/7 help? Call <a href="tel:2103184197" style="color:#0284c7; text-decoration:underline; font-weight:700; display:inline;">(210) 318-4197</a>
                    </div>
                </div>
            </div>
        `;

        let targetContainer;
        if (mode === 'inline') {
            targetContainer = document.getElementById(containerId);
            if (!targetContainer) {
                console.error(`TekTrakker Widget: Container #${containerId} not found.`);
                return;
            }
            targetContainer.innerHTML = fullHTML;
        } else {
            document.body.insertAdjacentHTML('beforeend', `
                <div class="tt-widget-fab-container">
                    <div class="tt-widget-fab">💬</div>
                    <a href="https://tektrakker.web.app" class="tt-widget-seo-link" target="_blank" rel="noopener">Powered by TekTrakker</a>
                </div>
                <div class="tt-widget-overlay" style="display:none;"></div>
            `);
            targetContainer = document.querySelector('.tt-widget-overlay');
            targetContainer.innerHTML = fullHTML;
        }

        if (googleMapsApiKey) {
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places`;
            script.onload = () => initAutocomplete(targetContainer);
            document.head.appendChild(script);
        }
        
        setupFormLogic(targetContainer);
    }

    // 5. Form Logic
    function initAutocomplete(container) {
        container.querySelectorAll('.tt-address-autocomplete').forEach(field => {
            new google.maps.places.Autocomplete(field, { types: ["address"] });
        });
    }
    
    function setupFormLogic(container) {
        const form = container.querySelector('#tt-booking-form');
        const successMessage = container.querySelector('#tt-success-message');

        // Customer Type Card Selection
        container.querySelectorAll('.tt-widget-customer-card').forEach(card => {
            card.addEventListener('click', () => {
                container.querySelectorAll('.tt-widget-customer-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                
                const type = card.getAttribute('data-type');
                
                // Toggle sections visibility and required fields
                container.querySelectorAll('.tt-details-section').forEach(sec => {
                    sec.classList.remove('active');
                    sec.querySelectorAll('input, select, textarea').forEach(input => {
                        if (input.hasAttribute('data-required')) {
                            input.removeAttribute('required');
                        }
                    });
                });
                
                const activeId = type === 'Renter / Tenant' ? 'Tenant' : 
                                 type === 'Business / Commercial' ? 'Commercial' : 
                                 type === 'Property Manager' ? 'PropertyManager' : 
                                 type === 'General Contractor' ? 'GC' : 'Homeowner';
                                 
                const activeSec = container.querySelector(`#tt-details-${activeId}`);
                if (activeSec) {
                    activeSec.classList.add('active');
                    activeSec.querySelectorAll('input, select, textarea').forEach(input => {
                        if (input.hasAttribute('data-required')) {
                            input.setAttribute('required', 'true');
                        }
                    });
                }
            });
        });

        // HVAC toggle details
        container.querySelector('#tt-service-category').addEventListener('change', (e) => {
            container.querySelector('#tt-hvac-details').style.display = e.target.value === 'HVAC' ? 'grid' : 'none';
        });

        // Owner/Landlord toggle details for Homeowner
        container.querySelectorAll('input[name="isOwner"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                container.querySelector('.tt-owner-subdetails').style.display = e.target.value === 'No' ? 'block' : 'none';
            });
        });

        function readFileAsDataURL(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve({ dataUrl: reader.result, name: file.name });
                reader.onerror = (e) => reject(e);
            });
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = form.querySelector('button');
            submitBtn.innerText = 'Submitting...';
            submitBtn.disabled = true;

            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            data.type = 'booking';
            data.organizationId = orgId;

            // Get selected customer type
            const activeCard = container.querySelector('.tt-widget-customer-card.active');
            const customerType = activeCard ? activeCard.getAttribute('data-type') : 'Homeowner';
            data.customerType = customerType;

            // Normalize contact fields based on Customer Type
            if (customerType === 'Renter / Tenant') {
                data.name = data.tenantName;
                data.phone = data.tenantPhone;
                data.email = data.tenantEmail;
                data.address = data.tenantAddress;
            } else if (customerType === 'Business / Commercial') {
                data.name = data.onSiteContactName;
                data.phone = data.commercialPhone;
                data.email = data.commercialEmail;
                data.address = data.commercialAddress;
                data.taxExempt = data.taxExempt;
            } else if (customerType === 'Property Manager') {
                data.name = data.pmContactName;
                data.phone = data.pmPhone;
                data.email = data.pmEmail;
                data.address = data.pmAddress;
                data.taxExempt = data.pmTaxExempt;
            } else if (customerType === 'General Contractor') {
                data.name = data.gcContactName;
                data.phone = data.gcPhone;
                data.email = data.gcEmail;
                data.address = data.gcAddress;
                data.poRequired = data.gcPoRequired;
                data.taxExempt = data.gcTaxExempt;
            }

            // Remove file objects from direct posting
            delete data.photo;
            delete data.taxExemptFile;

            try {
                const photoFile = formData.get('photo');
                if (photoFile && photoFile.size > 0) {
                    const res = await readFileAsDataURL(photoFile);
                    data.photoDataUrl = res.dataUrl;
                    data.photoFileName = res.name;
                }

                const certFile = formData.get('taxExemptFile');
                if (certFile && certFile.size > 0) {
                    const res = await readFileAsDataURL(certFile);
                    data.taxExemptDataUrl = res.dataUrl;
                    data.taxExemptFileName = res.name;
                }

                await sendData(data);
            } catch (err) {
                 alert(`Error: ${err.message}`);
                 submitBtn.innerText = 'Confirm Booking';
                 submitBtn.disabled = false;
            }
        });

        async function sendData(data) {
            try {
                const response = await fetch(functionUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                if (!response.ok) throw new Error('Server submission failed.');
                
                form.style.display = 'none';
                successMessage.style.display = 'block';
            } finally {
                form.querySelector('button').innerText = 'Confirm Booking';
                form.querySelector('button').disabled = false;
            }
        }

        if (mode === 'popup') {
            document.querySelector('.tt-widget-fab').addEventListener('click', () => {
                container.style.display = 'flex';
                form.style.display = 'block';
                successMessage.style.display = 'none';
            });
            container.querySelector('.tt-widget-close').addEventListener('click', () => {
                container.style.display = 'none';
            });
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeWidget);
    } else {
        initializeWidget();
    }
})();
