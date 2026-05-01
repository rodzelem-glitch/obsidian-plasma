const fs = require('fs');

function fix() {
  let c = fs.readFileSync('src/pages/sales/SalesExpenses.tsx', 'utf8');
  c = c.replace(/import React, \{ useState, useEffect, useMemo \} from 'react';/, "import React, { useState, useEffect, useMemo } from 'react';\nimport { useNavigate } from 'react-router-dom';");
  c = c.replace(/Loader2 \} from 'lucide-react';/, "Loader2, ArrowLeft } from 'lucide-react';");
  fs.writeFileSync('src/pages/sales/SalesExpenses.tsx', c);
}

fix();
