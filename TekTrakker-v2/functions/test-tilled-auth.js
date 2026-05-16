const fetch = require('node-fetch');

const KORT_SECRET_KEY = 'sk_d4dzLLmJJozgXwmmzJ45z7wa0khj45A22UyWVRQtYANW4Lx6KvgjPWxWeEmkhdq4FAlAJUfhZnwdh8uHF5nVMzUKV3huIOYBLzqQ';

async function testTilled() {
    try {
        console.log("Creating auth link...");
        const createRes = await fetch('https://sandbox-api.tilled.com/v1/auth-links', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'tilled-api-key': KORT_SECRET_KEY,
                'tilled-account': 'acct_zDruOrRgOZVtafF9TPC2J'
            },
            body: JSON.stringify({
                app: "merchant-application", // Maybe? Or "onboarding"?
            })
        });
        const createData = await createRes.json();
        console.log("Response:", createData);

    } catch (e) {
        console.error("Error:", e);
    }
}

testTilled();
