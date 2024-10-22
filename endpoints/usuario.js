require('dotenv').config();
const express = require('express');
const bcrypt = require("bcryptjs"); // Cambiado a bcryptjs
const jwt = require("jsonwebtoken");
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const secretKey = process.env.SECRETO;
const supabaseUrl = 'https://jrkkjsjokqbgokcklnzf.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Prueba Endpoint
router.get("/", (request, response) => {
    response.json({ message: "Hola usuario" });
});

router.post("/registro", async (request, response) => {
    try {
        // Hashing con bcryptjs
        const hashedPassword = await bcrypt.hash(request.body.contrasena, 10);
        const { data, error } = await supabase.from('usuarios').insert([
            {
                nombre: request.body.nombre,
                correo: request.body.correo,
                contrasena: hashedPassword,
            },
        ]);

        // Manejo de error si hay un problema al insertar
        if (error) {
            return response.status(400).send({
                message: "Error al crear usuario",
                error: error.message, // Mostrar el mensaje específico del error
            });
        }

        response.status(201).send({
            message: "Usuario creado exitosamente"
        });
    } catch (error) {
        response.status(500).send({
            message: "Error al crear usuario",
            error: error.message, // Mostrar el mensaje específico del error
        });
    }
});

router.post("/login", async (request, response) => {
    try {
        // Buscar el usuario por correo
        const { data: usuarios, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('correo', request.body.correo);

        if (error || usuarios.length === 0) {
            return response.status(400).send({
                message: "Usuario no encontrado",
            });
        }

        const usuario = usuarios[0];

        // Verificar la contraseña con bcryptjs
        const passwordCheck = await bcrypt.compare(request.body.contrasena, usuario.contrasena);
        if (!passwordCheck) {
            return response.status(400).send({
                message: "Contraseña inválida",
            });
        }

        // Generar el token JWT
        const token = jwt.sign(
            {
                userId: usuario.id,  // o el campo correspondiente al id del usuario en la tabla 'usuarios'
                userName: usuario.nombre,
                userEmail: usuario.correo,
            },
            secretKey,  // Define tu clave secreta
            { expiresIn: "24h" }
        );

        // Login exitoso
        response.status(200).json({
            message: "Login exitoso",
            token: token,
        });
    } catch (error) {
        response.status(500).send({
            message: "Error en el proceso de login",
            error: error.message,
        });
    }
});

module.exports = router;
