require('dotenv').config();
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://jrkkjsjokqbgokcklnzf.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// Generador de identificador único alfanumérico para remisiones
const generateUniqueIdentifier = () => {
    return 'RM-' + Math.random().toString(36).substr(2, 9).toUpperCase();
};

// Endpoint para crear una remisión
router.post('/crear-remision', async (req, res) => {
    try {
        const { cliente, domicilio, rfc, articulos, observaciones } = req.body;

        // Generar el identificador único para la remisión
        const identificador = generateUniqueIdentifier();

        // Obtener la fecha actual para la remisión
        const fecha = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD

        // Insertar la remisión en la tabla "remisiones"
        const { data: remisionData, error: remisionError } = await supabase
            .from('remisiones')
            .insert([
                {
                    fecha,
                    cliente,
                    domicilio,
                    rfc,
                    identificador,
                }
            ])
            .select(); // Para obtener el ID de la remisión insertada

        if (remisionError) {
            throw remisionError;
        }

        const remisionId = remisionData[0].id;  // Obtener el ID de la remisión insertada

        // Insertar los artículos relacionados con esta remisión en la tabla "detalles_remision"
        const detallesToInsert = articulos.map(articulo => ({
            remision_id: remisionId,
            articulo_id: articulo.articuloId,
            cantidad: articulo.cantidad
        }));

        const { error: detallesError } = await supabase
            .from('detalles_remision')
            .insert(detallesToInsert);

        if (detallesError) {
            throw detallesError;
        }

        // Responder con éxito
        res.status(201).send({
            message: 'Remisión creada con éxito',
            remisionId,
            identificador
        });
    } catch (error) {
        console.error('Error al crear la remisión:', error);
        res.status(500).send({
            message: 'Error al crear la remisión',
            error: error.message
        });
    }
});

router.get('/buscar', async (req, res) => {
    try {
        const { identificador } = req.query;

        // Validar el parámetro
        if (!identificador) {
            return res.status(400).send({ message: 'Se requiere el parámetro identificador para la búsqueda.' });
        }

        // Construir la consulta
        let query = supabase.from('remisiones').select('*').eq('identificador', identificador);

        // Ejecutar la consulta
        const { data: remisiones, error } = await query;

        if (error) {
            console.error('Error en la consulta a remisiones:', error);
            return res.status(500).send({ message: 'Error al realizar la búsqueda de remisiones.', error: error.message });
        }

        if (!remisiones || remisiones.length === 0) {
            return res.status(404).send({ message: 'No se encontraron remisiones con el identificador especificado.' });
        }

        // Obtener detalles de las remisiones
        const remisionesConDetalles = await Promise.all(remisiones.map(async (remision) => {
            const { data: detalles, error: detallesError } = await supabase
                .from('detalles_remision')
                .select('articulo_id, cantidad')
                .eq('remision_id', remision.id);

            if (detallesError) {
                console.error('Error al obtener detalles de la remisión:', detallesError);
                throw detallesError;
            }

            return {
                ...remision,
                detalles
            };
        }));

        res.status(200).send({ remisiones: remisionesConDetalles });
    } catch (error) {
        console.error('Error al buscar remisiones:', error);
        res.status(500).send({ message: 'Error al buscar remisiones', error: error.message });
    }
});



module.exports = router;
