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
        const { clienteId, articulos} = req.body;
        // Verificar si el cliente existe
        const { data: clienteData, error: clienteError } = await supabase
            .from('clientes')
            .select('id')
            .eq('id', clienteId) // Buscamos al cliente por su ID
            .single();

        if (clienteError || !clienteData) {
            return res.status(400).send({ message: 'El cliente no existe', error: clienteError?.message });
        }

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
                    cliente_id: clienteId, // Usar el clienteId recibido
                    identificador, // Asignar el identificador único
                }
            ])
            .select(); // Para obtener el ID de la remisión insertada

        if (remisionError) {
            throw remisionError; // Manejar el error de creación de la remisión
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
            throw detallesError; // Manejar el error de inserción de detalles
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


// Endpoint para buscar remisiones
router.get('/buscar', async (req, res) => {
    try {
        const { identificador } = req.query;

        // Validar el parámetro
        if (!identificador) {
            return res.status(400).send({ message: 'Se requiere el parámetro identificador para la búsqueda.' });
        }

        // Construir la consulta para obtener la remisión y la información del cliente
        const { data: remisiones, error: remisionError } = await supabase
            .from('remisiones')
            .select(`
                *,
                clientes (
                    nombre,
                    domicilio,
                    rfc
                )
            `)
            .ilike('identificador', `%${identificador}%`); // Cambiado a ilike para coincidencias parciales

        if (remisionError) {
            console.error('Error en la consulta a remisiones:', remisionError);
            return res.status(500).send({ message: 'Error al realizar la búsqueda de remisiones.', error: remisionError.message });
        }

        if (!remisiones || remisiones.length === 0) {
            return res.status(404).send({ message: 'No se encontraron remisiones con el identificador especificado.' });
        }

        // Obtener detalles de las remisiones
        const remisionesConDetalles = await Promise.all(remisiones.map(async (remision) => {
            const { data: detalles, error: detallesError } = await supabase
                .from('detalles_remision')
                .select(`
                    articulo_id,
                    cantidad,
                    articulos(
                        descripcion,
                        precio
                    )
                `)
                .eq('remision_id', remision.id);

            if (detallesError) {
                console.error('Error al obtener detalles de la remisión:', detallesError);
                throw detallesError;
            }

            // Asegurarse de que los detalles contienen los datos de los artículos
            const detallesConArticulos = detalles.map(detalle => ({
                ...detalle,
                descripcion: detalle.articulos.descripcion,
                precio: detalle.articulos.precio
            }));

            // Retornar la remisión junto con la información del cliente
            return {
                id: remision.id,
                fecha: remision.fecha,
                identificador: remision.identificador,
                cliente: remision.clientes?.nombre,
                domicilio: remision.clientes?.domicilio,
                rfc: remision.clientes?.rfc,
                detalles: detallesConArticulos
            };
        }));

        res.status(200).send({ remisiones: remisionesConDetalles });
    } catch (error) {
        console.error('Error al buscar remisiones:', error);
        res.status(500).send({ message: 'Error al buscar remisiones', error: error.message });
    }
});


// Endpoint para actualizar una remisión
router.put('/actualizar-remision/:identificador', async (req, res) => {
    const { identificador } = req.params; // Obtener el identificador de la remisión de los parámetros
    const { clienteId, articulos } = req.body; // Obtener los datos a actualizar del cuerpo de la solicitud

    try {
        // Verificar si la remisión existe
        const { data: remisionData, error: remisionError } = await supabase
            .from('remisiones')
            .select('*')
            .eq('identificador', identificador) // Cambia 'id' por 'identificador'
            .single(); // Obtener solo una remisión

        if (remisionError || !remisionData) {
            return res.status(404).send({
                message: 'Remisión no encontrada',
                error: remisionError ? remisionError.message : 'No existe una remisión con este identificador.'
            });
        }

        // Actualizar la remisión en la tabla "remisiones"
        const { error: updateError } = await supabase
            .from('remisiones')
            .update({
                cliente_id: clienteId // Actualizamos solo el cliente_id
            })
            .eq('identificador', identificador); // Usamos el identificador

        if (updateError) {
            throw updateError;
        }

        // Borrar los artículos existentes antes de insertar los nuevos
        await supabase
            .from('detalles_remision')
            .delete()
            .eq('remision_id', remisionData.id);

        // Insertar los artículos relacionados con esta remisión en la tabla "detalles_remision"
        const detallesToInsert = articulos.map(articulo => ({
            remision_id: remisionData.id, // ID de la remisión
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
        res.status(200).send({
            message: 'Remisión actualizada con éxito',
            remisionId: remisionData.id // Retorna el ID de la remisión actualizada
        });
    } catch (error) {
        console.error('Error al actualizar la remisión:', error);
        res.status(500).send({
            message: 'Error al actualizar la remisión',
            error: error.message
        });
    }
});


// Endpoint para borrar una remisión
router.delete('/borrar-remision/:identificador', async (req, res) => {
    const { identificador } = req.params; // Obtener el identificador de la remisión de los parámetros

    try {
        // Verificar si la remisión existe
        const { data: remisionData, error: remisionError } = await supabase
            .from('remisiones')
            .select('*')
            .eq('identificador', identificador) // Busca la remisión por su identificador
            .single(); // Obtener solo una remisión

        if (remisionError || !remisionData) {
            return res.status(404).send({
                message: 'Remisión no encontrada',
                error: remisionError ? remisionError.message : 'No existe una remisión con este identificador.'
            });
        }

        // Borrar los detalles de la remisión antes de eliminar la remisión en sí
        const { error: detallesError } = await supabase
            .from('detalles_remision')
            .delete()
            .eq('remision_id', remisionData.id); // Usa el ID de la remisión encontrada

        if (detallesError) {
            throw detallesError;
        }

        // Borrar la remisión
        const { error: deleteError } = await supabase
            .from('remisiones')
            .delete()
            .eq('identificador', identificador);

        if (deleteError) {
            throw deleteError;
        }

        // Responder con éxito
        res.status(200).send({
            message: 'Remisión eliminada con éxito',
            remisionId: remisionData.id
        });
    } catch (error) {
        console.error('Error al eliminar la remisión:', error);
        res.status(500).send({
            message: 'Error al eliminar la remisión',
            error: error.message
        });
    }
});



module.exports = router;

