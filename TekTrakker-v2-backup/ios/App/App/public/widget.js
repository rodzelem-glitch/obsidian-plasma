
(function() {
    // 1. Configuration
    const scriptTag = document.currentScript || document.querySelector('script[data-org-id]');
    const orgId = scriptTag ? scriptTag.getAttribute('data-org-id') : null;
    const functionUrl = scriptTag ? scriptTag.getAttribute('data-function-url') : null;
    const googleMapsApiKey = scriptTag ? scriptTag.getAttribute('data-maps-api-key') : null;
    const mode = scriptTag ? scriptTag.getAttribute('data-mode') : 'popup';
    const containerId = scriptTag ? scriptTag.getAttribute('data-container-id') : 'tt-booking-container';

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
        .tt-widget-fab-container { position: fixed; bottom: 20px; right: 20px; display: flex; flex-direction: column; align-items: center; z-index: 9999; }
        .tt-widget-fab { background-color: #0284c7; color: white; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.2); cursor: pointer; font-size: 24px; transition: transform 0.2s; }
        .tt-widget-fab:hover { transform: scale(1.05); }
        .tt-widget-seo-link { display: block; font-size: 10px; color: #9ca3af; text-decoration: none; margin-top: 6px; font-family: sans-serif; opacity: 0.8; transition: opacity 0.2s; }
        .tt-widget-seo-link:hover { opacity: 1; text-decoration: underline; color: #6b7280; }
        .tt-widget-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: none; z-index: 10000; align-items: center; justify-content: center; }
        .tt-widget-container { background: white; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.2); width: 100%; height: 100%; max-width: 100%; max-height: 100%; overflow-y: auto; font-family: sans-serif; }
        .tt-widget-header { padding: 16px 24px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
        .tt-widget-title { font-size: 1.25rem; font-weight: bold; }
        .tt-widget-close { cursor: pointer; font-size: 1.5rem; color: #9ca3af; }
        .tt-widget-content { padding: 12px 24px 24px 24px; }
        .tt-widget-section-title { font-size: 1rem; font-weight: bold; margin-top: 20px; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb; color: #0284c7; }
        .tt-widget-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .tt-widget-input, .tt-widget-select { width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 4px; box-sizing: border-box; font-size: 1rem; }
        .tt-widget-button { width: 100%; padding: 12px; background-color: #0284c7; color: white; border: none; border-radius: 4px; font-size: 1rem; font-weight: bold; cursor: pointer; }
        .tt-widget-footer { text-align: center; padding: 16px; border-top: 1px solid #e5e7eb; }
        .tt-widget-footer a { display: inline-flex; align-items: center; color: #6b7280; text-decoration: none; font-size: 0.8rem; }
        .tt-widget-footer img { height: 20px; margin-left: 8px; }
        #tt-hvac-details, #tt-owner-details { display: none; margin-top: 16px; padding-top: 16px; border-top: 1px dashed #e5e7eb; }
        .tt-widget-success-message { text-align: center; padding: 40px; color: #059669; font-size: 1.2rem; }
    `;

    // 4. HTML Structure
    const widgetHTML = `...`; // Content is built inside initializeWidget

    // 5. Initialization
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
                        <h4 class="tt-widget-section-title">Property & Contact</h4>
                        <div class="tt-widget-grid">
                            <div class="tt-widget-group"><label class="tt-widget-label">Full Name</label><input class="tt-widget-input" name="name" required></div>
                            <div class="tt-widget-group"><label class="tt-widget-label">Phone</label><input class="tt-widget-input" name="phone" type="tel" required></div>
                        </div>
                        <div class="tt-widget-group"><label class="tt-widget-label">Email</label><input class="tt-widget-input" name="email" type="email" required></div>
                        <div class="tt-widget-group"><label class="tt-widget-label">Service Address</label><input class="tt-widget-input" id="tt-address" name="address" placeholder="Start typing..." required></div>
                        <div class="tt-widget-group"><label class="tt-widget-label">Are you the property owner?</label><input type="radio" name="isOwner" value="yes" checked> Yes <input type="radio" name="isOwner" value="no"> No</div>
                        <div id="tt-owner-details" class="tt-widget-grid">
                           <div class="tt-widget-group"><label class="tt-widget-label">Owner's Name</label><input class="tt-widget-input" name="ownerName"></div>
                           <div class="tt-widget-group"><label class="tt-widget-label">Owner's Phone</label><input class="tt-widget-input" name="ownerPhone" type="tel"></div>
                        </div>
                        <h4 class="tt-widget-section-title">Service Details</h4>
                        <div class="tt-widget-grid">
                            <div class="tt-widget-group"><label class="tt-widget-label">Service Category</label><select id="tt-service-category" class="tt-widget-select" name="serviceCategory">${serviceCategories.map(c => `<option>${c}</option>`).join('')}</select></div>
                            <div class="tt-widget-group"><label class="tt-widget-label">Job Type</label><select class="tt-widget-select" name="jobType">${jobTypes.map(t => `<option>${t}</option>`).join('')}</select></div>
                        </div>
                        <div id="tt-hvac-details" class="tt-widget-grid">
                           <div class="tt-widget-group"><label class="tt-widget-label">System Age (Years)</label><input class="tt-widget-input" name="systemAge" type="number"></div>
                           <div class="tt-widget-group"><label class="tt-widget-label">System Brand</label><input class="tt-widget-input" name="systemBrand" placeholder="e.g., Trane"></div>
                        </div>
                        <h4 class="tt-widget-section-title">Scheduling</h4>
                        <div class="tt-widget-grid">
                           <div class="tt-widget-group"><label class="tt-widget-label">Preferred Date</label><input class="tt-widget-input" id="tt-date" name="date" type="date" required></div>
                           <div class="tt-widget-group"><label class="tt-widget-label">Arrival Window</label><select class="tt-widget-select" name="arrivalWindow">${arrivalWindows.map(w => `<option>${w}</option>`).join('')}</select></div>
                        </div>
                        <h4 class="tt-widget-section-title">Extras</h4>
                        <div class="tt-widget-group"><label class="tt-widget-label">Upload a Photo (Optional)</label><input class="tt-widget-input" type="file" name="photo" accept="image/*"></div>
                        <button type="submit" class="tt-widget-button" style="margin-top:24px;">Confirm Booking</button>
                    </form>
                </div>
                <div class="tt-widget-footer">
                    <a href="https://tektrakker.com" target="_blank">
                        Powered by <img src="https://tektrakker.com/tektrakker-logo-full.png" alt="TekTrakker" />
                    </a>
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
                    <a href="https://tektrakker.com" class="tt-widget-seo-link" target="_blank" rel="noopener">Powered by TekTrakker</a>
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

    // 6. Form Logic
    function initAutocomplete(container) {
        const addressField = container.querySelector('#tt-address');
        if (addressField) new google.maps.places.Autocomplete(addressField, { types: ["address"] });
    }
    
    function setupFormLogic(container) {
        const form = container.querySelector('#tt-booking-form');
        const successMessage = container.querySelector('#tt-success-message');

        container.querySelector('#tt-service-category').addEventListener('change', (e) => {
            container.querySelector('#tt-hvac-details').style.display = e.target.value === 'HVAC' ? 'grid' : 'none';
        });
        container.querySelectorAll('input[name="isOwner"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                container.querySelector('#tt-owner-details').style.display = e.target.value === 'no' ? 'grid' : 'none';
            });
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = form.querySelector('button');
            submitBtn.innerText = 'Submitting...';
            submitBtn.disabled = true;

            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            data.type = 'booking';
            data.organizationId = orgId;
            delete data.photo; // Remove file object

            try {
                const file = formData.get('photo');
                if (file && file.size > 0) {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = async () => {
                        data.photoDataUrl = reader.result;
                        data.photoFileName = file.name;
                        await sendData(data);
                    };
                    reader.onerror = () => { throw new Error("Photo could not be read."); };
                } else {
                    await sendData(data);
                }
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
