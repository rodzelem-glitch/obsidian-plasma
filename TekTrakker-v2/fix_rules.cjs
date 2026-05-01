const fs = require('fs');
let c = fs.readFileSync('firestore.rules', 'utf8');

c = c.replace(
  "getUserData().get('role', '') == 'franchise_admin'",
  "getUserData().get('role', '') == 'franchise_admin' && resource != null && resource.data.get('franchiseId', null) == getUserData().get('franchiseId', 'X')"
); // Note: Since it replaces, we use regex with /g to get all instances
c = c.replace(/getUserData\(\)\.get\('role', ''\) == 'franchise_admin'(?! && resource)/g, "getUserData().get('role', '') == 'franchise_admin' && resource != null && resource.data.get('franchiseId', null) == getUserData().get('franchiseId', 'X')");


fs.writeFileSync('firestore.rules', c);
