const express = require('express');
const mongoose = require('mongoose');
const app = express();

mongoose.connect(process.env.MONGODB_URI);
const License = mongoose.model('License', new mongoose.Schema({ key: String, hwid: String, expiresAt: Date }));

app.get('/verify', async (req, res) => {
  const { key, hwid } = req.query;
  const license = await License.findOne({ key });
  if (!license) return res.json({ valid: false });
  if (license.hwid && license.hwid !== hwid) return res.json({ valid: false });
  if (license.expiresAt && license.expiresAt < new Date()) return res.json({ valid: false });
  if (!license.hwid) license.hwid = hwid;
  await license.save();
  res.json({ valid: true });
});

app.listen(3001, () => console.log('✅ API on port 3001'));
