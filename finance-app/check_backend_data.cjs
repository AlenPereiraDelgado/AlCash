const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const DB_FILE = path.join(__dirname, 'finance_db.xlsx');

if (!fs.existsSync(DB_FILE)) {
    console.log("Database file not found!");
    process.exit(1);
}

const wb = XLSX.readFile(DB_FILE);
const data = XLSX.utils.sheet_to_json(wb.Sheets["Data"]);

data.forEach(row => {
    if (row.username === 'Alén') {
        const content = JSON.parse(row.content);
        const personal = content.transactions || [];
        const joint = content.joint_transactions || [];

        console.log(`User: ${row.username}`);
        console.log(`- Personal transactions count: ${personal.length}`);
        console.log(`- Joint transactions count: ${joint.length}`);

        const personalSignatures = personal.map(t => `${t.date}|${t.amountVal}|${t.note}|${t.category}`);
        const jointSignatures = joint.map(t => `${t.date}|${t.amountVal}|${t.note}|${t.category}`);

        const jointSet = new Set(jointSignatures);
        const duplicatesInPersonal = personalSignatures.filter(sig => jointSet.has(sig));

        if (duplicatesInPersonal.length > 0) {
            console.log(`  WARNING: ${duplicatesInPersonal.length} personal transactions have IDENTICAL content to joint transactions!`);
            duplicatesInPersonal.slice(0, 5).forEach(sig => console.log(`    - ${sig}`));
        } else {
            console.log("  Check: No content overlap between personal and joint lists (based on date, amount, note, category).");
        }
    }
});
