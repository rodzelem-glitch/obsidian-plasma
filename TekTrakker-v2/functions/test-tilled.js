const fetch = require('node-fetch');

const KORT_SECRET_KEY = 'sk_d4dzLLmJJozgXwmmzJ45z7wa0khj45A22UyWVRQtYANW4Lx6KvgjPWxWeEmkhdq4FAlAJUfhZnwdh8uHF5nVMzUKV3huIOYBLzqQ';

async function testTilled() {
    try {
        console.log("Creating connected account...");
        const createRes = await fetch('https://sandbox-api.tilled.com/v1/accounts/connected', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'tilled-api-key': KORT_SECRET_KEY,
                'tilled-account': 'acct_zDruOrRgOZVtafF9TPC2J'
            },
            body: JSON.stringify({}) // Let's see what validation error it gives
        });
        const createData = await createRes.json();
        console.log("Create Account Response:", createData);

    } catch (e) {
        console.error("Error:", e);
    }
}

testTilled();
