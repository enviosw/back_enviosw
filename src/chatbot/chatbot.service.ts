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

                estadoUsuarios.delete(numero); // Finaliza correctamente
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
                    await this.opcion1PasoAPaso(numero, '');
                    return;
                case 'opcion_2':
                    await this.opcion2PasoAPaso(numero, '');
                    return;
                case 'opcion_3':
                    await this.opcion3PasoAPaso(numero, '');
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
                    await this.opcion1PasoAPaso(numero, texto);
                    break;
                case 'opcion_2':
                    await this.opcion2PasoAPaso(numero, texto);
                    break;
                case 'opcion_3':
                    await this.opcion3PasoAPaso(numero, texto);
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



    async opcion1PasoAPaso(numero: string, mensaje: string): Promise<void> {
        const estado = estadoUsuarios.get(numero) || { paso: 0, datos: {} };

        switch (estado.paso) {
            case 0:
                // Solo enviar la primera vez
                await this.enviarMensajeTexto(numero, '📝 Por favor, indícame la *Dirección de recogida*.');
                estado.paso = 1;
                break;

            case 1:
                if (!mensaje?.trim()) return; // Espera una respuesta
                estado.datos.direccionRecoger = mensaje;
                await this.enviarMensajeTexto(numero, '📞 Ahora dime el *Teléfono de recogida*.');
                estado.paso = 2;
                break;

            case 2:
                if (!mensaje?.trim()) return;
                estado.datos.telefonoRecoger = mensaje;
                await this.enviarMensajeTexto(numero, '📍 Indica la *Dirección de entrega*.');
                estado.paso = 3;
                break;

            case 3:
                if (!mensaje?.trim()) return;
                estado.datos.direccionEntregar = mensaje;
                await this.enviarMensajeTexto(numero, '📞 Por último, el *Teléfono de entrega*.');
                estado.paso = 4;
                break;

            case 4:
                if (!mensaje?.trim()) return;
                estado.datos.telefonoEntregar = mensaje;

                const { direccionRecoger, telefonoRecoger, direccionEntregar, telefonoEntregar } = estado.datos;

                await this.enviarMensajeTexto(
                    numero,
                    `✅ Esta es la información que me diste:

📝 Dirección de recogida: ${direccionRecoger}
📞 Teléfono: ${telefonoRecoger}

📍 Dirección de entrega: ${direccionEntregar}
📞 Teléfono: ${telefonoEntregar}`
                );

                // Botones para confirmar o editar
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
                                        id: 'confirmar_info',
                                        title: '✅ Sí',
                                    },
                                },
                                {
                                    type: 'reply',
                                    reply: {
                                        id: 'editar_info',
                                        title: '🔁 No, editar',
                                    },
                                },
                            ],
                        },
                    },
                });

                estado.paso = 5;
                break;

            case 5:
                // Esperamos respuesta del botón
                break;

            default:
                await this.enviarMensajeTexto(numero, '❓ No entendí. Vamos a comenzar de nuevo.');
                estadoUsuarios.delete(numero);
                await this.opcion1PasoAPaso(numero, '');
                return;
        }

        estadoUsuarios.set(numero, estado);
    }


    async opcion2PasoAPaso(numero: string, mensaje: string): Promise<void> {
        const estado = estadoUsuarios.get(numero) || { paso: 0, datos: {}, tipo: 'opcion_2' };

        switch (estado.paso) {
            case 0:
                await this.enviarMensajeTexto(
                    numero,
                    '🛍️ Por favor, envíame tu *lista de compras*.\n\nEjemplo:\n- Pan\n- Arroz\n- Jugo de naranja'
                );
                estado.paso = 1;
                break;

            case 1:
                if (!mensaje?.trim()) return;
                estado.datos.listaCompras = mensaje.trim();
                await this.enviarMensajeTexto(numero, '📍 Ahora indícame la *dirección de entrega*.');
                estado.paso = 2;
                break;

            case 2:
                if (!mensaje?.trim() || mensaje.length < 5) {
                    await this.enviarMensajeTexto(numero, '⚠️ La dirección parece muy corta. Por favor, envíala nuevamente.');
                    return;
                }
                estado.datos.direccionEntrega = mensaje.trim();
                await this.enviarMensajeTexto(numero, '📞 Por último, dime el *teléfono de quien recibirá la compra*.');
                estado.paso = 3;
                break;

            case 3:
                if (!mensaje?.trim() || !/^\d{7,}$/.test(mensaje)) {
                    await this.enviarMensajeTexto(numero, '⚠️ El teléfono debe tener al menos 7 dígitos. Escríbelo nuevamente.');
                    return;
                }

                estado.datos.telefonoEntrega = mensaje.trim();

                const { listaCompras, direccionEntrega, telefonoEntrega } = estado.datos;

                await this.enviarMensajeTexto(
                    numero,
                    `🧾 Esta es la compra que solicitaste:\n\n📦 *Lista de compras:*\n${listaCompras}\n\n📍 *Dirección de entrega:*\n${direccionEntrega}\n📞 *Teléfono quien recibe:*\n${telefonoEntrega}`
                );

                if (!estado.botonesEnviados) {
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
                                            title: 'Sí, es correcto',
                                        },
                                    },
                                    {
                                        type: 'reply',
                                        reply: {
                                            id: 'editar_compra',
                                            title: 'Cambiar la lista',
                                        },
                                    },
                                ],
                            },
                        },
                    });
                    estado.botonesEnviados = true; // 🔐 Control de repetición
                }

                estado.paso = 4;
                break;

            case 4:
                // Esperamos respuesta del botón
                break;

            default:
                await this.enviarMensajeTexto(numero, '❗ Algo salió mal. Reiniciamos el proceso.');
                estadoUsuarios.delete(numero);
                await this.opcion2PasoAPaso(numero, '');
                return;
        }

        estadoUsuarios.set(numero, estado); // Guardar cambios
    }





    async opcion3PasoAPaso(numero: string, mensaje: string): Promise<void> {
        const estado = estadoUsuarios.get(numero) || { paso: 0, datos: {}, tipo: 'opcion_3' };

        switch (estado.paso) {
            case 0:
                await this.enviarMensajeTexto(
                    numero,
                    '💰 Para realizar un pago, primero debemos recoger el dinero.\n\n📍 Por favor, indícame la *dirección de recogida*.'
                );
                estado.paso = 1;
                break;

            case 1:
                if (!mensaje?.trim()) return;
                estado.datos.direccionRecoger = mensaje;

                await this.enviarMensajeTexto(
                    numero,
                    '📞 Ahora dime el *teléfono del lugar de recogida*.'
                );
                estado.paso = 2;
                break;

            case 2:
                if (!mensaje?.trim()) return;
                estado.datos.telefonoRecoger = mensaje;

                const { direccionRecoger, telefonoRecoger } = estado.datos;

                await this.enviarMensajeTexto(
                    numero,
                    `✅ Esta es la información que me diste:\n\n📍 Dirección de recogida: ${direccionRecoger}\n📞 Teléfono: ${telefonoRecoger}`
                );

                // Botones para confirmar o editar
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
                                        title: '🔁 Quiero cambiar la lista',
                                    },
                                },
                            ],
                        },
                    },
                });


                estado.paso = 3;
                break;

            case 3:
                // A la espera del botón de confirmación
                break;

            default:
                await this.enviarMensajeTexto(numero, '❌ Algo salió mal. Empecemos de nuevo.');
                estadoUsuarios.delete(numero);
                await this.opcion3PasoAPaso(numero, '');
                return;
        }

        estadoUsuarios.set(numero, estado);
    }




}
