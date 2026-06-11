const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Store licenses
let licenses = [];

// Generate random key
function generateKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            key += chars[Math.floor(Math.random() * chars.length)];
        }
        if (i < 3) key += '-';
    }
    return key;
}

// Verify license (for Lua script)
app.get('/verify', (req, res) => {
    const { key, hwid } = req.query;
    const license = licenses.find(l => l.key === key);
    
    if (!license) {
        return res.json({ valid: false, message: 'Invalid key' });
    }
    if (license.used && license.hwid !== hwid) {
        return res.json({ valid: false, message: 'HWID mismatch' });
    }
    
    if (!license.used) {
        license.used = true;
        license.hwid = hwid;
    }
    
    res.json({ valid: true, message: 'License valid' });
});

// Generate new key (admin)
app.post('/gen', (req, res) => {
    const key = generateKey();
    licenses.push({ key, used: false, hwid: null });
    res.json({ success: true, key: key });
});

// List all keys (admin)
app.get('/keys', (req, res) => {
    res.json(licenses);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ API running on port ${PORT}`);
});
