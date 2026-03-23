
(function() {
    // 1. Get Configuration
    const scriptTag = document.currentScript || document.querySelector('script[data-org-id]');
    const orgId = scriptTag ? scriptTag.getAttribute('data-org-id') : null;
    const functionUrl = scriptTag ? scriptTag.getAttribute('data-function-url') : null;
    const mode = scriptTag ? scriptTag.getAttribute('data-mode') : 'popup';
    const containerId = scriptTag ? scriptTag.getAttribute('data-container-id') : 'tt-hiring-container';
    const WIDGET_TIMEOUT = 15000;

    if (!orgId || !functionUrl) {
        console.error("TekTrakker Hiring Widget: Missing data-org-id or data-function-url.");
        return;
    }

    // 2. CSS Styles
    const styles = `
        .tt-hiring-fab { position: fixed; bottom: 90px; right: 20px; background-color: #10b981; color: white; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.2); cursor: pointer; z-index: 9998; font-size: 24px; }
        .tt-hiring-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: none; z-index: 10000; align-items: center; justify-content: center; }
        .tt-hiring-container { background: white; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.2); width: 100%; height: 100%; max-width: 100%; max-height: 100%; overflow-y: auto; font-family: sans-serif; }
        .tt-hiring-header { padding: 16px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
        .tt-hiring-title { font-size: 1.25rem; font-weight: bold; }
        .tt-hiring-close { cursor: pointer; font-size: 1.5rem; color: #9ca3af; }
        .tt-hiring-content { padding: 24px; }
        .tt-hiring-group { margin-bottom: 16px; }
        .tt-hiring-label { display: block; margin-bottom: 4px; font-size: 0.875rem; color: #4b5563; font-weight: 500; }
        .tt-hiring-input, .tt-hiring-select { width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 4px; box-sizing: border-box; font-size: 1rem; }
        .tt-hiring-button { width: 100%; padding: 12px; background-color: #10b981; color: white; border: none; border-radius: 4px; font-size: 1rem; font-weight: bold; cursor: pointer; }
        .tt-hiring-button:disabled { background-color: #9ca3af; }
        .tt-hiring-status { text-align: center; padding: 40px; color: #6b7280; }
        .tt-hiring-section-title { font-size: 1rem; font-weight: bold; margin-top: 24px; margin-bottom: 12px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; }
        .tt-hiring-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .tt-hiring-checkbox-group { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 0.9rem; }
        .tt-hiring-availability-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 0.9rem; }
        .tt-hiring-footer { text-align: center; padding: 16px; border-top: 1px solid #e5e7eb; }
        .tt-hiring-footer a { display: inline-flex; align-items: center; color: #6b7280; text-decoration: none; font-size: 0.8rem; }
        .tt-hiring-footer img { height: 20px; margin-left: 8px; }
        .tt-hiring-success-message { text-align: center; padding: 40px; color: #059669; font-size: 1.2rem; }
    `;

    // 3. HTML Structure
    const widgetHTML = `
        <div class="tt-hiring-container">
            <div class="tt-hiring-header">
                <h3 class="tt-hiring-title">Join Our Team</h3>
                ${mode === 'popup' ? '<span class="tt-hiring-close">&times;</span>' : ''}
            </div>
            <div class="tt-hiring-content">
                <div id="tt-hiring-success-message" class="tt-hiring-success-message" style="display: none;">
                    Thank you for your application! We will be in touch shortly.
                </div>
                <div class="tt-hiring-status" id="tt-hiring-status-display">Loading Application...</div>
                <form id="tt-hiring-form" style="display:none;">
                    
                    <h4 class="tt-hiring-section-title">Personal Information</h4>
                    <div class="tt-hiring-grid">
                        <div class="tt-hiring-group">
                            <label class="tt-hiring-label">Full Name</label>
                            <input class="tt-hiring-input" name="name" type="text" required>
                        </div>
                        <div class="tt-hiring-group">
                            <label class="tt-hiring-label">Email</label>
                            <input class="tt-hiring-input" name="email" type="email" required>
                        </div>
                        <div class="tt-hiring-group">
                            <label class="tt-hiring-label">Phone</label>
                            <input class="tt-hiring-input" name="phone" type="tel" required>
                        </div>
                        <div class="tt-hiring-group">
                            <label class="tt-hiring-label">Address / Location</label>
                            <input class="tt-hiring-input" name="address" type="text">
                        </div>
                    </div>
                    <div class="tt-hiring-checkbox-group">
                        <input type="checkbox" id="tt-sms-opt-in" name="smsOptIn" value="true" checked>
                        <label for="tt-sms-opt-in">Receive interview updates via SMS.</label>
                    </div>

                    <h4 class="tt-hiring-section-title">Professional Details</h4>
                    <div class="tt-hiring-grid">
                        <div class="tt-hiring-group">
                            <label class="tt-hiring-label">Desired Position</label>
                            <input class="tt-hiring-input" name="position" placeholder="e.g. HVAC Technician" required>
                        </div>
                        <div class="tt-hiring-group">
                            <label class="tt-hiring-label">Experience Level</label>
                            <select class="tt-hiring-select" name="experienceLevel">
                                <option>Apprentice (0-2 Yrs)</option>
                                <option>Junior Tech (2-4 Yrs)</option>
                                <option>Lead Tech (5+ Yrs)</option>
                                <option>Master Tech (10+ Yrs)</option>
                            </select>
                        </div>
                         <div class="tt-hiring-group">
                            <label class="tt-hiring-label">Desired Salary ($/hr)</label>
                            <input class="tt-hiring-input" name="desiredSalary" type="number" step="1" placeholder="e.g., 25">
                        </div>
                         <div class="tt-hiring-group">
                            <label class="tt-hiring-label">Referred By</label>
                            <input class="tt-hiring-input" name="referredBy" placeholder="Employee Name (if any)">
                        </div>
                    </div>

                    <h4 class="tt-hiring-section-title">Skills & Availability</h4>
                    <div class="tt-hiring-group">
                        <label class="tt-hiring-label">Primary Skills (Check all that apply based on the job)</label>
                        <div class="tt-hiring-grid" style="grid-template-columns: 1fr 1fr 1fr;">
                            <div class="tt-hiring-checkbox-group"><input type="checkbox" name="skills" value="Inverters"><span>Inverters</span></div>
                            <div class="tt-hiring-checkbox-group"><input type="checkbox" name="skills" value="Boilers"><span>Boilers</span></div>
                            <div class="tt-hiring-checkbox-group"><input type="checkbox" name="skills" value="Commercial Refrigeration"><span>Refrigeration</span></div>
                            <div class="tt-hiring-checkbox-group"><input type="checkbox" name="skills" value="Residential HVAC"><span>Residential</span></div>
                            <div class="tt-hiring-checkbox-group"><input type="checkbox" name="skills" value="Chillers"><span>Chillers</span></div>
                            <div class="tt-hiring-checkbox-group"><input type="checkbox" name="skills" value="VRF/VRV"><span>VRF/VRV</span></div>
                        </div>
                    </div>
                    <div class="tt-hiring-group">
                        <label class="tt-hiring-label">Availability</label>
                        <div class="tt-hiring-availability-grid">
                           <div class="tt-hiring-checkbox-group"><input type="checkbox" name="availability" value="WeekdayMorning"><span>M-F Mornings</span></div>
                           <div class="tt-hiring-checkbox-group"><input type="checkbox" name="availability" value="WeekdayAfternoon"><span>M-F Afternoons</span></div>
                           <div class="tt-hiring-checkbox-group"><input type="checkbox" name="availability" value="WeekdayEvening"><span>M-F Evenings</span></div>
                           <div class="tt-hiring-checkbox-group"><input type="checkbox" name="availability" value="WeekendMorning"><span>Weekend Mornings</span></div>
                           <div class="tt-hiring-checkbox-group"><input type="checkbox" name="availability" value="WeekendAfternoon"><span>Weekend Afternoons</span></div>
                           <div class="tt-hiring-checkbox-group"><input type="checkbox" name="availability" value="WeekendEvening"><span>Weekend Evenings</span></div>
                        </div>
                    </div>

                    <h4 class="tt-hiring-section-title">Documents & Authorization</h4>
                    <div class="tt-hiring-grid">
                        <div class="tt-hiring-group">
                            <label class="tt-hiring-label">Driver's License #</label>
                            <input class="tt-hiring-input" name="driversLicense" placeholder="Required for driving roles">
                        </div>
                         <div class="tt-hiring-group">
                            <label class="tt-hiring-label">License/Certification</label>
                            <input class="tt-hiring-input" name="license" placeholder="e.g., EPA Universal, Journeyman">
                        </div>
                    </div>
                    <div class="tt-hiring-group">
                        <label class="tt-hiring-label">Resume (PDF or Word)</label>
                        <input class="tt-hiring-input" type="file" name="resume" accept=".pdf,.doc,.docx">
                    </div>
                     <div class="tt-hiring-checkbox-group">
                        <input type="checkbox" id="tt-work-auth" name="workAuthorized" value="true" required>
                        <label for="tt-work-auth">I am legally authorized to work in the US.</label>
                    </div>

                    <button type="submit" class="tt-hiring-button" style="margin-top: 24px;">Submit Application</button>
                </form>
            </div>
            <div class="tt-hiring-footer">
                <a href="https://tektrakker.com" target="_blank" rel="noopener noreferrer">
                    Powered by <img src="https://tektrakker.com/tektrakker-logo-full.png" alt="TekTrakker">
                </a>
            </div>
        </div>
    `;

    function initializeWidget() {
        const styleSheet = document.createElement("style");
        styleSheet.innerText = styles;
        document.head.appendChild(styleSheet);
        
        let targetContainer;
        if (mode === 'inline') {
            targetContainer = document.getElementById(containerId);
            if (!targetContainer) return;
            targetContainer.innerHTML = widgetHTML;
        } else {
            document.body.insertAdjacentHTML('beforeend', '<div class="tt-hiring-fab">💼</div><div class="tt-hiring-overlay" style="display:none;"></div>');
            targetContainer = document.querySelector('.tt-hiring-overlay');
            targetContainer.innerHTML = widgetHTML;
        }

        const form = document.getElementById('tt-hiring-form');
        const statusDisplay = document.getElementById('tt-hiring-status-display');
        const successMessage = document.getElementById('tt-hiring-success-message');
        
        setTimeout(() => {
            statusDisplay.style.display = 'none';
            form.style.display = 'block';
        }, 500);
        
        setupListeners(form, document.querySelector('.tt-hiring-overlay'), successMessage);
    }

    function setupListeners(form, overlay, successMessage) {
        if (!form) return;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = form.querySelector('button');
            submitBtn.innerText = 'Submitting...';
            submitBtn.disabled = true;

            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            
            const skills = Array.from(formData.getAll("skills"));
            const availability = Array.from(formData.getAll("availability"));

            const payload = { ...data, skills, availability, type: "applicant", organizationId: orgId };
            delete payload.resume; // remove file from payload object
            
            try {
                const file = formData.get('resume');
                if (file && file.size > 0) {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = async () => {
                        payload.resumeDataUrl = reader.result;
                        payload.resumeFileName = file.name;
                        await sendData(payload, form, successMessage);
                    };
                    reader.onerror = () => { throw new Error("Resume could not be read."); };
                } else {
                    await sendData(payload, form, successMessage);
                }
            } catch (err) {
                 alert(`Error: ${err.message}`);
                 submitBtn.innerText = 'Submit Application';
                 submitBtn.disabled = false;
            }
        });
        
        async function sendData(payload, form, successMessage) {
            try {
                const response = await fetch(functionUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!response.ok) throw new Error('Server submission failed.');
                form.style.display = 'none';
                successMessage.style.display = 'block';

            } finally {
                form.querySelector('button').innerText = 'Submit Application';
                form.querySelector('button').disabled = false;
            }
        }

        if (mode === 'popup' && overlay) {
            document.querySelector('.tt-hiring-fab').addEventListener('click', () => {
                overlay.style.display = 'flex';
                form.style.display = 'block';
                successMessage.style.display = 'none';

            });
            overlay.querySelector('.tt-hiring-close').addEventListener('click', () => {
                overlay.style.display = 'none';
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeWidget);
    } else {
        initializeWidget();
    }
})();
