const express = require('express');
const http = require('http');
const bodyParser = require("body-parser");
const app = express();
const usuarioRouter  = require('./endpoints/usuario')
const session = require("express-session");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', process.env.FRONTEND);
    res.header('Access-Control-Allow-Credentials', true);
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
        secure: false
    },
}));

app.use('/usuario',usuarioRouter);
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server up and running on port ${PORT}`);
})