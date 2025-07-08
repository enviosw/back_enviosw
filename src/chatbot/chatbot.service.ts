import { Injectable, Logger } from '@nestjs/common';
import { axiosWhatsapp } from 'src/common/axios-whatsapp.instance';

const estadoUsuarios = new Map<string, any>();
const temporizadoresInactividad = new Map<string, NodeJS.Timeout>(); // ⏰ Temporizadores

async function reiniciarPorInactividad(numero: string, enviarMensajeTexto: Function) {
    estadoUsuarios.delete(numero);
    temporizadoresInactividad.delete(numero);

    await enviarMensajeTexto(
        numero,
        '⏳ Como no recibimos más mensajes, el chat fue finalizado automáticamente.\nEscribe *hola* si deseas empezar de nuevo.'
    );
}

@Injectable()
export class ChatbotService {


    private readonly logger = new Logger(ChatbotService.name);




    async procesarMensajeEntrante(body: any): Promise<void> {
        this.logger.debug('📦 Payload recibido del webhook:', JSON.stringify(body, null, 2));

        const entry = body?.entry?.[0];
        const value = entry?.changes?.[0]?.value;
        const mensaje = value?.messages?.[0];
        const tipo = mensaje?.type;

        if (!mensaje) {
            this.logger.warn('⚠️ Webhook recibido sin mensajes. Ignorado.');
            return;
        }



        const numero = mensaje?.from;
        const texto = mensaje?.text?.body;
        const nombre = value?.contacts?.[0]?.profile?.name ?? 'cliente';

        // 🧠 Obtener o inicializar estado del usuario
        let estado = estadoUsuarios.get(numero);

        if (!estado) {
            estado = { paso: 0, datos: {}, inicioMostrado: false };
            estadoUsuarios.set(numero, estado);
        }

        estado.ultimoMensaje = Date.now(); // ⏱️ Guarda la hora

        // Borra temporizador anterior si existe
        if (temporizadoresInactividad.has(numero)) {
            clearTimeout(temporizadoresInactividad.get(numero));
        }

        // Crea nuevo temporizador
        const timeout = setTimeout(() => {
            reiniciarPorInactividad(numero, this.enviarMensajeTexto.bind(this));
        }, 5 * 60 * 1000); // ⏳ 5 minutos

        temporizadoresInactividad.set(numero, timeout);


        // ✅ Reiniciar si el usuario escribe "hola"
        if (texto?.trim().toLowerCase() === 'hola') {
            estadoUsuarios.delete(numero); // Limpiar estado anterior

            await this.enviarMensajeTexto(
                numero,
                `👋 Hola ${nombre}, soy *Wilber*, tu asistente virtual de *Domicilios W* 🛵💨

📲 Pide tu servicio ingresando a nuestra página web:
🌐 https://domiciliosw.com/`
            );

            await this.enviarListaOpciones(numero);
            return; // Evita que se siga ejecutando el flujo anterior
        }

        if (mensaje?.interactive?.type === 'button_reply') {
            const id = mensaje.interactive.button_reply.id;

            if (id === 'confirmar_info' || id === 'confirmar_pago' || id === 'confirmar_compra') {
                await this.enviarMensajeTexto(
                    numero,
                    `✅ Listo, ya enviamos un domiciliario:\n👤 *Juliano*\n🧥 Número de chaqueta: *15*\n\n🏠 A la dirección que me enviaste.`
                );

                await this.enviarMensajeTexto(numero, '✅ Gracias por preferirnos. El chat ha finalizado. Puedes escribir *hola* para comenzar de nuevo.');
                estadoUsuarios.delete(numero);
                return;
            }

            if (id === 'editar_info') {
                // Reiniciar flujo de opción 1
                estadoUsuarios.set(numero, { paso: 0, datos: {}, tipo: 'opcion_1' });
                await this.opcion1PasoUnico(numero, '');
                return;
            }

            if (id === 'editar_compra') {
                estadoUsuarios.set(numero, { paso: 0, datos: {}, tipo: 'opcion_2' });
                await this.opcion2PasoUnico(numero, '');
                return;
            }
        }



        // ✅ 1. Procesar selección de lista interactiva
        if (tipo === 'interactive' && mensaje?.interactive?.type === 'list_reply') {
            const opcionSeleccionada = mensaje.interactive.list_reply.id;

            // Reiniciar estado del usuario antes de comenzar nuevo flujo
            estadoUsuarios.set(numero, { paso: 0, datos: {}, tipo: opcionSeleccionada });

            switch (opcionSeleccionada) {
                case 'opcion_1':
                    await this.opcion1PasoUnico(numero, '');
                    return;
                case 'opcion_2':
                    await this.opcion2PasoUnico(numero, '');
                    return;
                case 'opcion_3':
                    await this.opcion3PasoUnico(numero, '');
                    return;
                case 'opcion_4':
                    await this.enviarMensajeTexto(
                        numero,
                        '🍽️ Mira nuestras cartas de los mejores *RESTAURANTES DE LA CIUDAD*.\n\n🌐 Ingresa a:\nhttps://domiciliosw.com'
                    );
                    estadoUsuarios.delete(numero); // 🔁 Reinicia el chat
                    return;

                case 'opcion_5':
                    await this.enviarMensajeTexto(
                        numero,
                        '📞 Para *Peticiones, Sugerencias, Quejas o Reclamos*, comunícate directamente por *WhatsApp* al *3108857311*.\nNuestro equipo de atención al cliente está listo para ayudarte lo antes posible.'
                    );
                    estadoUsuarios.delete(numero); // 🔁 Reinicia el chat
                    return;

                default:
                    await this.enviarMensajeTexto(numero, '❓ Opción no reconocida.');
                    return;
            }
        }

        // ✅ 2. Si el usuario ya está en flujo guiado
        if (estadoUsuarios.has(numero) && tipo === 'text') {
            switch (estado.tipo) {
                case 'opcion_1':
                    await this.opcion1PasoUnico(numero, texto);
                    break;
                case 'opcion_2':
                    await this.opcion2PasoUnico(numero, texto);
                    break;
                case 'opcion_3':
                    await this.opcion3PasoUnico(numero, texto);
                    break;
                default:
                    this.logger.warn(`⚠️ Tipo de flujo desconocido para ${numero}`);
                    break;
            }
            return;
        }


        // ✅ 3. Enviar saludo y menú solo si no se mostró antes
        if (!estado.inicioMostrado && numero && texto) {
            this.logger.log(`📨 Mensaje recibido de ${nombre} (${numero}): "${texto}"`);

            await this.enviarMensajeTexto(
                numero,
                `👋 Hola ${nombre}, soy *Wilber*, tu asistente virtual de *Domicilios W* 🛵💨

📲 Pide tu servicio ingresando a nuestra página web:
🌐 https://domiciliosw.com/`
            );

            await this.enviarListaOpciones(numero);

            estado.inicioMostrado = true;
            estadoUsuarios.set(numero, estado);
        } else {
            this.logger.warn('⚠️ Mensaje sin número o texto válido, o saludo ya enviado.');
        }
    }





    private async enviarMensajeTexto(numero: string, mensaje: string): Promise<void> {
        try {
            const response = await axiosWhatsapp.post('/messages', {
                messaging_product: 'whatsapp',
                to: numero,
                type: 'text',
                text: { body: mensaje },
            })
            this.logger.log(`✅ Mensaje enviado a ${numero}`);

        } catch (error) {
            this.logger.error('❌ Error al enviar el mensaje:', error.response?.data || error.message);
        }
    }


    private async enviarListaOpciones(numero: string): Promise<void> {
        try {
            await axiosWhatsapp.post('/messages', {
                messaging_product: 'whatsapp',
                to: numero,
                type: 'interactive',
                interactive: {
                    type: 'list',
                    // header: {
                    //     type: 'text',
                    //     text: '¡Hola, soy Wilber!',
                    // },
                    body: {
                        text: `👇 O selecciona el servicio que deseas:`,
                    },
                    footer: {
                        text: 'Estamos para servirte 🧡',
                    },
                    action: {
                        button: 'Ver opciones',
                        sections: [
                            {
                                title: 'Servicios disponibles',
                                rows: [
                                    {
                                        id: 'opcion_1',
                                        title: '1. Recoger y entregar',
                                        description: 'Envíos puerta a puerta',
                                    },
                                    {
                                        id: 'opcion_2',
                                        title: '2. Realizar una compra',
                                        description: 'Compramos lo que necesites',
                                    },
                                    {
                                        id: 'opcion_3',
                                        title: '3. Hacer un pago',
                                        description: 'Pagamos por ti y entregamos el recibo',
                                    },
                                    {
                                        id: 'opcion_4',
                                        title: '4. Ver Restaurantes',
                                        description: 'Explora nuestros aliados gastronómicos',
                                    },
                                    {
                                        id: 'opcion_5',
                                        title: '5. PSQR',
                                        description: 'Peticiones, sugerencias, quejas o reclamos',
                                    },
                                ],
                            },
                        ],
                    },
                },
            });

            this.logger.log(`✅ Lista de opciones enviada a ${numero}`);
        } catch (error) {
            this.logger.error('❌ Error al enviar lista:', error.response?.data || error.message);
        }
    }


    async opcion1PasoUnico(numero: string, mensaje: string): Promise<void> {
        const estado = estadoUsuarios.get(numero) || { paso: 0, datos: {} };

        switch (estado.paso) {
            case 0:
                await this.enviarMensajeTexto(
                    numero,
                    `📝 Claro, con mucho gusto.\nEnvíame la información en un solo mensaje con el siguiente formato:\n\n` +
                    `Dirección de Recoger: ______\nTeléfono: ______\n\n` +
                    `Dirección de entregar: ______\nTeléfono: ______`
                );
                estado.paso = 1;
                break;

            case 1:
                if (!mensaje?.trim()) return;

                const mensajeNormalizado = mensaje.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

                const recogerMatch = mensajeNormalizado.match(/direccion\s*de\s*recoger\s*:\s*(.+)\n\s*telefono\s*:\s*(.+)/i);
                const entregarMatch = mensajeNormalizado.match(/direccion\s*de\s*entregar\s*:\s*(.+)\n\s*telefono\s*:\s*(.+)/i);


                if (!recogerMatch || !entregarMatch) {
                    await this.enviarMensajeTexto(numero, '❌ El formato no es válido. Asegúrate de usar el formato exacto.');
                    return;
                }

                estado.datos = {
                    direccionRecoger: recogerMatch[1].trim(),
                    telefonoRecoger: recogerMatch[2].trim(),
                    direccionEntregar: entregarMatch[1].trim(),
                    telefonoEntregar: entregarMatch[2].trim(),
                };

                const { direccionRecoger, telefonoRecoger, direccionEntregar, telefonoEntregar } = estado.datos;

                await this.enviarMensajeTexto(
                    numero,
                    `✅ Esta es la información que me diste:\n\n` +
                    `📍 Dirección de recogida: ${direccionRecoger}\n📞 Teléfono: ${telefonoRecoger}\n\n` +
                    `📍 Dirección de entrega: ${direccionEntregar}\n📞 Teléfono: ${telefonoEntregar}`
                );

                await axiosWhatsapp.post('/messages', {
                    messaging_product: 'whatsapp',
                    to: numero,
                    type: 'interactive',
                    interactive: {
                        type: 'button',
                        body: {
                            text: '¿La información es correcta?',
                        },
                        action: {
                            buttons: [
                                {
                                    type: 'reply',
                                    reply: { id: 'confirmar_info', title: '✅ Sí' },
                                },
                                {
                                    type: 'reply',
                                    reply: { id: 'editar_info', title: '🔁 No, editar' },
                                },
                            ],
                        },
                    },
                });

                estado.paso = 2;
                break;

            case 2:
                // Esperas el botón: confirmar_info o editar_info
                break;

            default:
                await this.enviarMensajeTexto(numero, '❓ No entendí. Vamos a comenzar de nuevo.');
                estadoUsuarios.delete(numero);
                await this.opcion1PasoUnico(numero, '');
                return;
        }

        estadoUsuarios.set(numero, estado);
    }


    async opcion2PasoUnico(numero: string, mensaje: string): Promise<void> {
        const estado = estadoUsuarios.get(numero) || { paso: 0, datos: {}, tipo: 'opcion_2' };

        switch (estado.paso) {
            case 0:
                await this.enviarMensajeTexto(
                    numero,
                    `🛍️ Claro, con gusto.\nPor favor, escribe tu *lista de compras*.\n\nEjemplo:\n- Pan\n- Leche\n- Jugo`
                );
                estado.paso = 1;
                break;

            case 1:
                if (!mensaje?.trim()) return;

                estado.datos.listaCompras = mensaje.trim();

                await this.enviarMensajeTexto(
                    numero,
                    `📍 Ahora indícame en un solo mensaje:\n\n` +
                    `Dirección de entrega: ______\nTeléfono quien recibe: ______`
                );
                estado.paso = 2;
                break;

            case 2:
                if (!mensaje?.trim()) return;

                const mensajeNormalizado = normalizarTexto(mensaje);

                // Expresiones sin tildes
                const direccionRegex = /direccion(?:\s+de\s+entrega)?\s*:\s*(.+)/i;
                const telefonoRegex = /(?:telefono|celular|tel)(?:\s+quien\s+recibe)?\s*:\s*(.+)/i;

                const direccionMatch = mensajeNormalizado.match(direccionRegex);
                const telefonoMatch = mensajeNormalizado.match(telefonoRegex);

                if (!direccionMatch || !telefonoMatch) {
                    await this.enviarMensajeTexto(
                        numero,
                        `❌ El formato no es válido.\nPor favor, incluye algo como:\n\nDirección de entrega: Calle 1 #2-34\nTeléfono: 3001234567`
                    );
                    return;
                }

                // Limpieza


                estado.datos.direccionEntrega = limpiarCampo(direccionMatch[1]);
                estado.datos.telefonoEntrega = limpiarCampo(telefonoMatch[1]); // ✅ Funciona

                const { listaCompras, direccionEntrega, telefonoEntrega } = estado.datos;


                const resumen =
                    `🧾 Esta es la compra que solicitaste:\n\n` +
                    `📦 *Lista de compras:*\n${listaCompras}\n\n` +
                    `📍 *Dirección de entrega:*\n${direccionEntrega}\n` +
                    `📞 *Teléfono quien recibe:*\n${telefonoEntrega}`;

                console.log(numero, resumen)

                await this.enviarMensajeTexto(numero, resumen);

                try {
                    await axiosWhatsapp.post('/messages', {
                        messaging_product: 'whatsapp',
                        to: numero,
                        type: 'interactive',
                        interactive: {
                            type: 'button',
                            body: {
                                text: '¿La información es correcta?',
                            },
                            action: {
                                buttons: [
                                    {
                                        type: 'reply',
                                        reply: {
                                            id: 'confirmar_compra',
                                            title: '✅ Sí, es correcto',
                                        },
                                    },
                                    {
                                        type: 'reply',
                                        reply: {
                                            id: 'editar_compra',
                                            title: '🔁 Editar info', // ✅ Menos de 20 caracteres

                                        },
                                    },
                                ],
                            },
                        },
                    });

                    estado.paso = 3;
                } catch (error) {
                    this.logger.error('❌ Error al enviar botones en opción 2:', error.response?.data || error.message);
                    await this.enviarMensajeTexto(numero, '❌ No pudimos mostrar las opciones. Escribe *hola* para reiniciar.');
                    estadoUsuarios.delete(numero);
                    return;
                }

                break;

            case 3:
                // Esperando botón
                break;

            default:
                await this.enviarMensajeTexto(numero, '❌ Algo salió mal. Empecemos de nuevo.');
                estadoUsuarios.delete(numero);
                await this.opcion2PasoUnico(numero, '');
                return;
        }

        estadoUsuarios.set(numero, estado);
    }





    async opcion3PasoUnico(numero: string, mensaje: string): Promise<void> {
        const estado = estadoUsuarios.get(numero) || { paso: 0, datos: {}, tipo: 'opcion_3' };

        switch (estado.paso) {
            case 0:
                await this.enviarMensajeTexto(
                    numero,
                    '💰 Claro, para realizar un pago primero debemos recoger el dinero.\n\n' +
                    'Envíame la dirección y el teléfono en el siguiente formato:\n\n' +
                    'Dirección de Recoger: ______\nTeléfono: ______'
                );
                estado.paso = 1;
                break;

            case 1:
                if (!mensaje?.trim()) return;

                // 🔤 Normalizar mensaje y limpiar
                const mensajeNormalizado = mensaje
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "") // eliminar tildes
                    .replace(/_{2,}/g, '')            // eliminar ___
                    .toLowerCase();

                const direccionRegex = /direccion\s*de\s*recoger\s*:\s*(.+)\n/i;
                const telefonoRegex = /telefono\s*:\s*(.+)/i;

                const direccionMatch = mensajeNormalizado.match(direccionRegex);
                const telefonoMatch = mensajeNormalizado.match(telefonoRegex);

                if (!direccionMatch || !telefonoMatch) {
                    await this.enviarMensajeTexto(
                        numero,
                        '❌ El formato no es válido. Asegúrate de escribir:\n\n' +
                        'Dirección de Recoger: Calle 123\nTeléfono: 3001234567'
                    );
                    return;
                }

                // 🧹 Limpieza extra por si queda ruido
                const limpiarCampo = (texto: string) =>
                    texto.replace(/_{2,}/g, '').replace(/\s+/g, ' ').trim();

                estado.datos.direccionRecoger = limpiarCampo(direccionMatch[1]);
                estado.datos.telefonoRecoger = limpiarCampo(telefonoMatch[1]);

                const { direccionRecoger, telefonoRecoger } = estado.datos;

                const resumen =
                    `✅ Esta es la información que me diste:\n\n` +
                    `📍 Dirección de recogida: ${direccionRecoger}\n` +
                    `📞 Teléfono: ${telefonoRecoger}`;

                await this.enviarMensajeTexto(numero, resumen);

                // 📲 Enviar botones
                try {
                    await axiosWhatsapp.post('/messages', {
                        messaging_product: 'whatsapp',
                        to: numero,
                        type: 'interactive',
                        interactive: {
                            type: 'button',
                            body: {
                                text: '¿La información es correcta?',
                            },
                            action: {
                                buttons: [
                                    {
                                        type: 'reply',
                                        reply: {
                                            id: 'confirmar_pago',
                                            title: '✅ Sí',
                                        },
                                    },
                                    {
                                        type: 'reply',
                                        reply: {
                                            id: 'editar_info',
                                            title: '🔁 Modificar',
                                        },
                                    },
                                ],
                            },
                        },
                    });

                    estado.paso = 2;
                } catch (error) {
                    this.logger.error('❌ Error al enviar botones en opción 3:', error.response?.data || error.message);
                    await this.enviarMensajeTexto(numero, '❌ No se pudieron mostrar las opciones. Escribe *hola* para reiniciar.');
                    estadoUsuarios.delete(numero);
                    return;
                }

                break;

            case 2:
                // Esperando confirmación o edición
                break;

            default:
                await this.enviarMensajeTexto(numero, '❌ Algo salió mal. Empecemos de nuevo.');
                estadoUsuarios.delete(numero);
                await this.opcion3PasoUnico(numero, '');
                return;
        }

        estadoUsuarios.set(numero, estado);
    }




}


function normalizarTexto(texto: string): string {
    return texto
        .normalize("NFD") // descompone tildes
        .replace(/[\u0300-\u036f]/g, "") // elimina tildes
        .toLowerCase(); // minúsculas
}

// Limpieza: elimina caracteres como ___ y espacios innecesarios
const limpiarCampo = (texto: string) =>
    texto.replace(/_{2,}/g, '').replace(/\s+/g, ' ').trim();
