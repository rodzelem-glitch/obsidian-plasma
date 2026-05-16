const fetch = require('node-fetch');

const KORT_SECRET_KEY = 'sk_d4dzLLmJJozgXwmmzJ45z7wa0khj45A22UyWVRQtYANW4Lx6KvgjPWxWeEmkhdq4FAlAJUfhZnwdh8uHF5nVMzUKV3huIOYBLzqQ';
const KORT_ACCOUNT_ID = 'acct_AJdH2w6qvR8UAFn7KxIwc';

async function testUsers() {
    try {
        const createRes = await fetch('https://sandbox-api.tilled.com/v1/users', {
            method: 'GET',
            headers: {
                'tilled-api-key': KORT_SECRET_KEY,
                'tilled-account': 'acct_OdyGoMCNF5SIe8qwNlnj4' // the created account
            }
        });
        
        const data = await createRes.json();
        console.log("Users Data:", data);
    } catch (e) {
        console.error("Error:", e);
    }
}

testUsers();
