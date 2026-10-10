const express = require('express');
const candidateRoutes = require('./routes/candidateRoutes');
const jobRoutes = require('./routes/jobRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/candidates', candidateRoutes);
app.use('/jobs', jobRoutes);
app.use('/', adminRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
