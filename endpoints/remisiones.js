require('dotenv').config();
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://jrkkjsjokqbgokcklnzf.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const PDFDocument = require('pdfkit');
const Mailgun = require('mailgun.js');
const formData = require('form-data');
const mailgun = new Mailgun(formData);
const mg = mailgun.client({ username: 'api', key: process.env.MAILGUN_API_KEY });

// Generador de identificador único alfanumérico para remisiones
const generateUniqueIdentifier = () => {
    return 'RM-' + Math.random().toString(36).substr(2, 9).toUpperCase();
};

// Endpoint para crear una remisión
router.post('/crear-remision', async (req, res) => {
    try {
        const { clienteId, articulos } = req.body;

        // Verificar si el cliente existe
        const { data: clienteData, error: clienteError } = await supabase
            .from('clientes')
            .select('id, nombre, email, domicilio, rfc')
            .eq('id', clienteId)
            .single();

        if (clienteError || !clienteData) {
            return res.status(400).send({ message: 'El cliente no existe', error: clienteError?.message });
        }

        // Generar el identificador único para la remisión
        const identificador = generateUniqueIdentifier();

        // Obtener la fecha actual para la remisión
        const fecha = new Date().toISOString().split('T')[0];

        // Insertar la remisión en la tabla "remisiones"
        const { data: remisionData, error: remisionError } = await supabase
            .from('remisiones')
            .insert([{ fecha, cliente_id: clienteId, identificador }])
            .select();

        if (remisionError) {
            throw remisionError;
        }

        const remisionId = remisionData[0].id;

        // Obtener la información completa de los artículos
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

        // Obtener los detalles de cada artículo para el PDF
        const articulosData = await Promise.all(
            articulos.map(async articulo => {
                const { data, error } = await supabase
                    .from('articulos') // Cambia 'articulos' por el nombre correcto de tu tabla
                    .select('id, descripcion, precio') // Asegúrate de que estos campos existan en tu tabla
                    .eq('id', articulo.articuloId)
                    .single();

                if (error) {
                    throw error;
                }

                return { ...data, cantidad: articulo.cantidad }; // Agrega cantidad a los detalles
            })
        );

        // Crear el PDF de la remisión
        const pdfBuffer = await generateRemisionPDF({
            id: remisionId,
            fecha,
            cliente: clienteData.nombre,
            domicilio: clienteData.domicilio,
            rfc: clienteData.rfc,
            identificador,
            detalles: articulosData // Usa la data completa
        });

        // Enviar el PDF por correo electrónico al cliente
        await sendEmailWithPDF(clienteData.email, identificador, pdfBuffer);

        // Responder con éxito
        res.status(201).send({
            message: 'Remisión creada con éxito y enviada por correo electrónico',
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


// Función para generar el PDF
async function generateRemisionPDF(remision) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument();
        let buffers = [];

        doc.on('data', data => buffers.push(data));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        const { id, fecha, cliente, domicilio, rfc, identificador, detalles } = remision;
        console.log(detalles)
        const total = detalles.reduce((sum, item) => sum + (item.precio || 0) * (item.cantidad || 0), 0);

        doc.fontSize(16).text('COMERCIALIZADORA Y DISTRIBUIDORA MEFYV, S.A. DE C.V.', { align: 'center' });
        doc.fontSize(12).text('Villa de Santiago No. 223, Col. Villas de Anáhuac, CP 66422, San Nicolás de los Garza, N.L.', { align: 'center' });
        doc.text('RFC CDM101108I55 Tel: 8117770920', { align: 'center' });

        doc.moveDown();
        doc.text(`REMISION N° ${identificador}`, { align: 'left' });
        doc.text(`FECHA: ${fecha}`, { align: 'left' });
        doc.text(`NOMBRE: ${cliente}`, { align: 'left' });
        doc.text(`DOMICILIO: ${domicilio}`, { align: 'left' });
        doc.text(`RFC: ${rfc}`, { align: 'left' });
        doc.moveDown();

        // Genera manualmente la "tabla" de detalles
        doc.fontSize(12).text('CANTIDAD    DESCRIPCIÓN              PRECIO UNITARIO      TOTAL', { underline: true });
        detalles.forEach(item => {
            doc.text(`${item.cantidad}             ${item.descripcion || ''}           $${(item.precio || 0).toFixed(2)}                $${((item.precio || 0) * (item.cantidad || 0)).toFixed(2)}`);
        });

        doc.moveDown();
        doc.text(`SUB-TOTAL: $${total.toFixed(2)}`, { align: 'right' });
        doc.text(`IVA: $0.00`, { align: 'right' });
        doc.text(`TOTAL: $${total.toFixed(2)}`, { align: 'right' });

        doc.end();
    });
}

async function sendEmailWithPDF(email, identificador, pdfBuffer) {
    const mailOptions = {
        from: 'noreply@yourdomain.com', // Cambia esto a un correo que hayas verificado en Mailgun
        to: email,
        subject: `Remisión N° ${identificador}`,
        text: `Adjunto se encuentra la remisión N° ${identificador}.`,
        attachment: [
            {
                data: pdfBuffer,
                filename: `remision_${identificador}.pdf`,
                contentType: 'application/pdf'
            }
        ]
    };

    try {
        const response = await mg.messages.create(process.env.MAILGUN_DOMAIN, mailOptions);
        console.log('Email enviado correctamente:', response);
    } catch (error) {
        console.error('Error al enviar el correo:', error);
        throw new Error('No se pudo enviar el correo');
    }
}

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

