require('dotenv').config();
const express = require('express');
const router = express.Router();
const {createClient}= require('@supabase/supabase-js');
const supabaseUrl = 'https://jrkkjsjokqbgokcklnzf.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

//Prueba Endpoint
router.get("/", (request, response) => {
    response.json({ message: "Hola usuario" });
});

router.post("/agregar", async (request, response) => {
    try {
        const { data, error } = await supabase.from('articulos').insert([
            {
                codigo: request.body.codigo,
                nombre: request.body.nombre,
                descripcion: request.body.descripcion,
                precio: request.body.precio,
            },
        ]);

        // Manejo de error si hay un problema al insertar
        if (error) {
            return response.status(400).send({
                message: "Error al agregar articulo",
                error: error.message, // Mostrar el mensaje específico del error
            });
        }

        response.status(201).send({
            message: " articulo agregado exitosamente"
        });
    } catch (error) {
        response.status(500).send({
            message: "Error al agregar articulo",
            error: error.message,
        });
    }
});

// Nuevo Endpoint para obtener todos los artículos
router.get("/articulos", async (request, response) => {
    try {
        const { data, error } = await supabase
            .from('articulos')  // La tabla que consultas
            .select('*');       // Selecciona todos los campos

        if (error) {
            return response.status(400).send({
                message: "Error al obtener los artículos",
                error: error.message,
            });
        }

        // Si la consulta es exitosa, devuelve los artículos
        response.status(200).send({
            message: "Artículos obtenidos exitosamente",
            articulos: data,  // Aquí se envían los artículos al cliente
        });
    } catch (error) {
        response.status(500).send({
            message: "Error al obtener los artículos",
            error: error.message,
        });
    }
});


module.exports = router;