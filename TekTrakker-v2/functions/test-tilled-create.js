const fetch = require('node-fetch');

const KORT_SECRET_KEY = 'sk_d4dzLLmJJozgXwmmzJ45z7wa0khj45A22UyWVRQtYANW4Lx6KvgjPWxWeEmkhdq4FAlAJUfhZnwdh8uHF5nVMzUKV3huIOYBLzqQ';
const KORT_ACCOUNT_ID = 'acct_AJdH2w6qvR8UAFn7KxIwc';

async function testCreateAccount() {
    try {
        console.log("Creating connected account...");
        const createRes = await fetch('https://sandbox-api.tilled.com/v1/accounts/connected', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'tilled-api-key': KORT_SECRET_KEY,
                'tilled-account': KORT_ACCOUNT_ID
            },
            body: JSON.stringify({
                email: "testmerchant@example.com"
            })
        });
        
        const accountData = await createRes.json();
        // Get the real onboarding URL from capabilities
        let realOnboardingUrl = 'https://tektrakker.sandbox-paymentsonline.io/onboarding/';
        if (accountData.capabilities && accountData.capabilities.length > 0 && accountData.capabilities[0].onboarding_application_url) {
            realOnboardingUrl = accountData.capabilities[0].onboarding_application_url;
        }

        // Create user
        console.log("Creating user...");
        const createUserRes = await fetch('https://sandbox-api.tilled.com/v1/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'tilled-api-key': KORT_SECRET_KEY,
                'tilled-account': accountData.id
            },
            body: JSON.stringify({
                email: "testmerchant" + Date.now() + "@example.com",
                name: "Test Merchant",
                password: "SecurePassword123!",
                role: "merchant_owner"
            })
        });
        const userData = await createUserRes.json();
        console.log("User Data:", userData);

        if (createUserRes.ok) {
            console.log("Generating auth link...");
            const appRes = await fetch(`https://sandbox-api.tilled.com/v1/auth-links`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'tilled-api-key': KORT_SECRET_KEY,
                    'tilled-account': accountData.id
                },
                body: JSON.stringify({
                    user_id: userData.id,
                    expiration: "30d",
                    redirect_url: realOnboardingUrl
                })
            });
            const appData = await appRes.json();
            console.log("Auth Link Data:", appData);
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

testCreateAccount();
