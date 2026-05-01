const http = require('http');

http.get('http://localhost:9002/src/pages/admin/projects/components/tabs/equipment/EquipmentHierarchy.tsx', (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    console.log(`STATUS: ${res.statusCode}`);
    if (res.statusCode !== 200) {
      console.log(data);
    } else {
      console.log('OK, response length:', data.length);
    }
  });
}).on('error', err => {
  console.error(err);
});
