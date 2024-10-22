require('dotenv').config();
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://jrkkjsjokqbgokcklnzf.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// Endpoint para crear un cliente
router.post('/crear', async (req, res) => {
    const { nombre, domicilio, rfc, telefono, email } = req.body;

    try {
        const { data, error } = await supabase
            .from('clientes')
            .insert([{ nombre, domicilio, rfc, telefono, email }])
            .single();

        if (error) {
            return res.status(400).send({ message: 'Error al crear el cliente', error: error.message });
        }

        res.status(201).send({ message: 'Cliente creado con éxito', clienteId: data.id });
    } catch (error) {
        res.status(500).send({ message: 'Error al crear el cliente', error: error.message });
    }
});

router.get("/clientes", async (request, response) => {
    try {
        const { data, error } = await supabase
            .from('clientes')
            .select('*');

        if (error) {
            return response.status(400).send({
                message: "Error al obtener los clientes",
                error: error.message,
            });
        }

        response.status(200).send({
            message: "Clientes obtenidos exitosamente",
            clientes: data,
        });
    } catch (error) {
        response.status(500).send({
            message: "Error al obtener los clientes",
            error: error.message,
        });
    }
});

module.exports = router;
