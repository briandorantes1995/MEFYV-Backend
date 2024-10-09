require('dotenv').config();
const express = require('express');
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const router = express.Router();
const {createClient}= require('@supabase/supabase-js');
const supabaseUrl = 'https://jrkkjsjokqbgokcklnzf.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

//Prueba Endpoint
router.get("/", (request, response) => {
    response.json({ message: "Hola usuario" });
});

//Registro
router.post("/registro", async (request, response) => {
    try {

        const hashedPassword = await bcrypt.hash(request.body.contrasena, 10);
        const { data, error } = await supabase.from('usuarios').insert([
                {
                    nombre: request.body.nombre,
                    correo:request.body.correo,
                    contrasena: hashedPassword,
                },
            ])

        response.status(201).send({
            message: "Usuario creado exitosamente"
        });
    } catch (error) {
        response.status(500).send({
            message: "Error al crear usuario",
            error:error,
        });
    }
});

module.exports = router;