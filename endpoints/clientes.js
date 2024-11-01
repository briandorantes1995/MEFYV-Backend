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
            return res.status(400).json({ message: 'Error al crear el cliente', error: error.message });
        }

        res.status(201).json({ message: 'Cliente creado con éxito'});
    } catch (error) {
        res.status(500).json({ message: 'Error en el servidor al crear el cliente', error: error.message });
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

// Endpoint para buscar clientes sin especificar filtros
router.get('/buscar', async (req, res) => {
    const { query } = req;
    const searchTerm = query.q; // Obtener el término de búsqueda de la consulta

    try {
        // Inicializa la consulta
        let clientQuery = supabase.from('clientes').select('*');

        // Agregar condiciones de búsqueda a la consulta
        if (searchTerm) {
            // Usar `ilike` para que la búsqueda sea insensible a mayúsculas y minúsculas
            clientQuery = clientQuery.or(`nombre.ilike.%${searchTerm}%,rfc.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
        }

        // Ejecuta la consulta
        const { data, error } = await clientQuery;

        // Verificar el error de la consulta
        if (error) {
            console.error('Error al buscar clientes:', error); // Log de error
            return res.status(400).json({ message: 'Error al buscar clientes', error: error.message });
        }

        // Responder con los resultados
        if (data.length === 0) {
            return res.status(404).json({ message: 'No se encontraron clientes que coincidan con la búsqueda.' });
        }

        res.status(200).json(data);
    } catch (error) {
        console.error('Error en el servidor al buscar clientes:', error); // Log de error
        res.status(500).json({ message: 'Error en el servidor al buscar clientes', error: error.message });
    }
});

// Endpoint para buscar un cliente por ID
router.get('/cliente/:id', async (req, res) => {
    const { id } = req.params; // Obtener el ID del cliente desde los parámetros de la ruta

    try {
        // Realiza la consulta para buscar el cliente por ID
        const { data, error } = await supabase
            .from('clientes')
            .select('*')
            .eq('id', id) // Filtrar por ID

        // Verificar si ocurrió un error en la consulta
        if (error) {
            console.error('Error al buscar cliente por ID:', error); // Log de error
            return res.status(400).json({ message: 'Error al buscar cliente', error: error.message });
        }

        // Verificar si se encontró algún cliente
        if (data.length === 0) {
            return res.status(404).json({ message: 'Cliente no encontrado.' });
        }

        // Responder con el cliente encontrado
        res.status(200).json(data[0]); // Retornar solo el primer cliente encontrado
    } catch (error) {
        console.error('Error en el servidor al buscar cliente:', error); // Log de error
        res.status(500).json({ message: 'Error en el servidor al buscar cliente', error: error.message });
    }
});

// Endpoint para editar un cliente por ID
router.put('/editar/:id', async (req, res) => {
    const { id } = req.params; // Obtener el ID del cliente desde los parámetros de la ruta
    const { nombre, domicilio, rfc, telefono, email } = req.body; // Obtener los datos del cliente del cuerpo de la solicitud

    try {
        // Realiza la actualización del cliente por ID
        const { data, error } = await supabase
            .from('clientes')
            .update({ nombre, domicilio, rfc, telefono, email })
            .eq('id', id); // Filtrar por ID

        // Verificar si ocurrió un error en la consulta
        if (error) {
            console.error('Error al editar cliente:', error); // Log de error
            return res.status(400).json({ message: 'Error al editar cliente', error: error.message });
        }

        // Responder con el cliente actualizado
        res.status(200).json({ message: 'Cliente actualizado con éxito'});
    } catch (error) {
        console.error('Error en el servidor al editar cliente:', error); // Log de error
        res.status(500).json({ message: 'Error en el servidor al editar cliente', error: error.message });
    }
});

// Endpoint para borrar un cliente por ID
router.delete('/borrar/:id', async (req, res) => {
    const { id } = req.params; // Obtener el ID del cliente desde los parámetros de la ruta

    try {
        // Eliminar el cliente por ID
        const { data, error } = await supabase
            .from('clientes')
            .delete()
            .eq('id', id); // Filtrar por ID

        // Verificar si ocurrió un error en la consulta
        if (error) {
            console.error('Error al borrar cliente:', error); // Log de error
            return res.status(400).json({ message: 'Error al borrar cliente', error: error.message });
        }
        
        // Responder con un mensaje de éxito
        res.status(200).json({ message: 'Cliente eliminado con éxito' });
    } catch (error) {
        console.error('Error en el servidor al borrar cliente:', error); // Log de error
        res.status(500).json({ message: 'Error en el servidor al borrar cliente', error: error.message });
    }
});

module.exports = router;
