require("dotenv").config();
const express = require('express');
const app = express();

app.use(express.json())

app.get('/_/health', (req, res) => res.sendStatus(200));
app.use('/api/analyze', require('./routes/analyze'))

app.listen(process.env.PORT || 4000, () => {
    console.log(`Analyzer-Dummy is listening at ${process.env.PORT || 4000}`);
});
