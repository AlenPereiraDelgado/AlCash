
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const DB_FILE = path.join(__dirname, 'finance_db.xlsx');

app.use(cors());
app.use(bodyParser.json());

// --- EXCEL HELPER FUNCTIONS ---

const initializeGenericData = () => ({
    transactions: [],
    joint_transactions: [],
    goals: [],
    debts: [],
    categories: {
        expense: {
            Alimentación: ["Supermercado", "Restaurantes", "Delivery", "Cafetería"],
            Transporte: ["Gasolina", "Transporte Público", "Uber/Taxi", "Mantenimiento Coche"],
            Hogar: ["Alquiler/Hipoteca", "Luz/Agua", "Internet", "Limpieza", "Muebles"],
            Suscripciones: ["Streaming", "Software", "Gimnasio", "Clubes"],
            Salud: ["Farmacia", "Médico", "Seguro", "Dentista"],
            Deportes: ["Equipamiento", "Cuotas", "Eventos"],
            Compras: ["Ropa", "Electrónica", "Regalos", "Cuidado Personal"],
            Educación: ["Cursos", "Libros", "Material"],
            Finanzas: ["Impuestos", "Comisiones", "Préstamos"],
            Otros: ["Varios", "Imprevistos"]
        },
        income: {
            Salario: ["Nómina Principal", "Bonus", "Horas Extra"],
            "Otros ingresos": ["Ventas", "Inversiones", "Regalos", "Freelance"]
        }
    },
    settings: { theme: 'dark', accent: 'blue' }
});

const initializeDB = () => {
    if (!fs.existsSync(DB_FILE)) {
        const wb = XLSX.utils.book_new();
        // Create Sheets
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([]), "Users");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([]), "Data"); // Store huge JSON blob for simplicity or separate sheets?
        // Let's use a "Data" sheet where each row is { user, type, json_content } to avoid complex schema mapping for now
        XLSX.writeFile(wb, DB_FILE);
        console.log("Database initialized.");
    }
};


const readDB = () => {
    initializeDB();
    const wb = XLSX.readFile(DB_FILE);
    const users = XLSX.utils.sheet_to_json(wb.Sheets["Users"]);
    const data = XLSX.utils.sheet_to_json(wb.Sheets["Data"]);
    return { users, data };
};

const writeDB = (users, data) => {
    if (fs.existsSync(DB_FILE)) {
        fs.copyFileSync(DB_FILE, DB_FILE + '.bak');
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(users), "Users");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Data");
    XLSX.writeFile(wb, DB_FILE);
};

// --- AUTH ENDPOINTS ---

app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing fields" });

    const { users, data } = readDB();
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ error: "User already exists" });
    }

    // Add User
    users.push({ username, password }); // In real app, hash password!

    // Initialize User Data
    data.push({
        username,
        content: JSON.stringify(initializeGenericData())
    });

    writeDB(users, data);
    res.json({ success: true, message: "User registered" });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const { users } = readDB();
    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
        res.json({ success: true, username: user.username });
    } else {
        res.status(401).json({ error: "Invalid credentials" });
    }
});

// --- DATA ENDPOINTS ---

app.get('/api/data/:username', (req, res) => {
    const { username } = req.params;
    const { data } = readDB();
    const userRow = data.find(d => d.username === username);

    if (userRow) {
        res.json(JSON.parse(userRow.content));
    } else {
        // Should not happen if registered, but handle it
        res.json(initializeGenericData());
    }
});

app.post('/api/data/:username', (req, res) => {
    const { username } = req.params;
    const newContent = req.body;

    let { users, data } = readDB();
    const index = data.findIndex(d => d.username === username);

    if (index !== -1) {
        data[index].content = JSON.stringify(newContent);
    } else {
        data.push({ username, content: JSON.stringify(newContent) });
    }

    writeDB(users, data);
    res.json({ success: true });
});

initializeDB();

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
