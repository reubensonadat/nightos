const fs = require('fs');
const path = require('path');

const filesToFix = [
  "src/App.tsx",
  "src/components/ItemDetailsSheet.tsx",
  "src/components/PaystackButton.tsx",
  "src/context/NetworkContext.tsx",
  "src/hooks/useBill.ts",
  "src/hooks/useCustomerSession.ts",
  "src/hooks/useManagerDashboard.ts",
  "src/hooks/useOrders.ts",
  "src/hooks/useQrTable.ts",
  "src/hooks/useVenue.ts",
  "src/screens/CheckoutScreen.tsx",
  "src/screens/MenuScreen.tsx",
  "src/screens/ReservationsScreen.tsx",
  "src/screens/auth/VenueSetupScreen.tsx",
  "src/screens/kitchen/KitchenDisplayScreen.tsx",
  "src/screens/manager/CrmScreen.tsx",
  "src/screens/manager/FinancialReportsScreen.tsx",
  "src/screens/manager/LiveOpsScreen.tsx",
  "src/screens/manager/MenuManagerScreen.tsx",
  "src/screens/manager/StaffManagerScreen.tsx",
  "src/screens/waiter/ShiftPerformanceScreen.tsx",
  "src/screens/waiter/StaffAuthScreen.tsx",
];

const patterns = [
  // Pattern 1: useEffect(() => { load() }, [load]) or similar
  {
    regex: /useEffect\(\(\) => \{\n(\s+)([a-zA-Z0-9_]+)\(\);\n\s+\}, \[([a-zA-Z0-9_, ]*)\]\);/g,
    replacer: (match, indent, funcName, deps) => {
      return `useEffect(() => {\n${indent}const init = async () => {\n${indent}    await ${funcName}();\n${indent}};\n${indent}init();\n${indent}}, [${deps}]);`;
    }
  },
  // Pattern 2: useEffect(() => { fetchX() }, [])
  {
    regex: /useEffect\(\(\) => \{\n(\s+)([a-zA-Z0-9_]+)\(\);\n\s+\}, \[\]\);/g,
    replacer: (match, indent, funcName) => {
      return `useEffect(() => {\n${indent}const init = async () => {\n${indent}    await ${funcName}();\n${indent}};\n${indent}init();\n${indent}}, []);`;
    }
  },
  // Pattern 3: fetcher is not async but it's okay to wrap it.
];

for (const file of filesToFix) {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    let original = content;
    content = content.replace(/\r\n/g, '\n');
    
    for (const p of patterns) {
      content = content.replace(p.regex, p.replacer);
    }
    
    // Also remove unused vars like empty blocks catch (e) {}
    content = content.replace(/catch \([a-zA-Z0-9_]+\) \{\s*\}/g, 'catch {\n        }');

    if (content !== original) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log('Fixed', file);
    }
  }
}
