const axios = require('axios');
require('dotenv').config();
const url = 'https://api.sam.gov/prod/opportunities/v2/search';
const toDate = new Date();
const fromDate = new Date();
fromDate.setDate(toDate.getDate() - 90);
const formatDate = (d) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;

console.log(process.env.SAM_GOV_API_KEY ? 'Has API Key' : 'No API Key');

axios.get(url, {
    params: {
        api_key: process.env.SAM_GOV_API_KEY,
        limit: 10,
        postedFrom: formatDate(fromDate),
        postedTo: formatDate(toDate)
    }
}).then(res => console.log('Data records:', res.data.totalRecords))
.catch(err => console.error('Error:', err.response ? err.response.data : err.message));
