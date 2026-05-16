const fetch = require('node-fetch');

const KORT_SECRET_KEY = 'sk_d4dzLLmJJozgXwmmzJ45z7wa0khj45A22UyWVRQtYANW4Lx6KvgjPWxWeEmkhdq4FAlAJUfhZnwdh8uHF5nVMzUKV3huIOYBLzqQ';
const KORT_ACCOUNT_ID = 'acct_zDruOrRgOZVtafF9TPC2J';

async function testTilled() {
    try {
        console.log("Getting account info...");
        const res = await fetch(`https://sandbox-api.tilled.com/v1/accounts/${KORT_ACCOUNT_ID}`, {
            method: 'GET',
            headers: {
                'tilled-api-key': KORT_SECRET_KEY,
                'tilled-account': KORT_ACCOUNT_ID
            }
        });
        const data = await res.json();
        console.log("Response:", data);

    } catch (e) {
        console.error("Error:", e);
    }
}

testTilled();
