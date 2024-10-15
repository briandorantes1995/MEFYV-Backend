const express = require('express');
const http = require('http');
const session = require('express-session');
const usuarioRouter = require('./endpoints/usuario');
const articuloRouter = require('./endpoints/articulo');
const remisionRouter = require('./endpoints/remisiones');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', process.env.FRONTEND || '*'); // Temporarily allow all origins
    res.header('Access-Control-Allow-Credentials', true);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept'
    );
    next();
});

app.use(session({
    secret: 'PasswordResetNodeJs',
    name: "reset",
    resave: true,
    saveUninitialized: true,
    cookie: {
        secure: false,  // In production, set secure: true for HTTPS
    },
}));

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Routes
app.use('/usuario', usuarioRouter);
app.use('/articulo', articuloRouter);
app.use('/remision', remisionRouter);
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server up and running on port ${PORT}`);
});
