import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ComerciosService } from 'src/comercios/comercios.service';
import { axiosWhatsapp } from 'src/common/axios-whatsapp.instance';
import { DomiciliosService } from 'src/domicilios/domicilios.service';
import { DomiciliariosService } from 'src/domiliarios/domiliarios.service';
import { Domiciliario } from 'src/domiliarios/entities/domiliario.entity';
import { Conversacion } from './entities/conversacion.entity';
import { Repository } from 'typeorm';
import { Mensaje } from './entities/mensajes.entity';
import { Cron } from '@nestjs/schedule';


const estadoUsuarios = new Map<string, any>();
const temporizadoresInactividad = new Map<string, NodeJS.Timeout>(); // ⏰ Temporizadores
const temporizadoresEstado = new Map<string, NodeJS.Timeout>(); // TTL para solicitar estado a domiciliario
const bloqueoMenu = new Map<string, NodeJS.Timeout>(); // Bloqueo temporal del menú


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
  private isRetryRunning = false; // 🔒 candado antisolape

    constructor(
        private readonly comerciosService: ComerciosService, // 👈 Aquí está la inyección
        private readonly domiciliarioService: DomiciliariosService, // 👈 Aquí está la inyección
        private readonly domiciliosService: DomiciliosService, // 👈 Aquí está la inyección


        @InjectRepository(Conversacion)
        private readonly conversacionRepo: Repository<Conversacion>,

        @InjectRepository(Mensaje)
        private readonly mensajeRepo: Repository<Mensaje>,

    ) { }

      // 🧠 helper: armar resumen desde registro de pedido en BD (no desde "datos")
  private generarResumenPedidoDesdePedido(pedido: any): string {
    const recoger = pedido.origen_direccion
      ? `📍 *Recoger en:* ${pedido.origen_direccion}\n📞 *Tel:* ${pedido.telefono_contacto_origen || '-'}`
      : '';
    const entregar = pedido.destino_direccion
      ? `🏠 *Entregar en:* ${pedido.destino_direccion}\n📞 *Tel:* ${pedido.telefono_contacto_destino || '-'}`
      : '';
    const lista = pedido.detalles_pedido
      ? `🛒 *Lista de compras:*\n${pedido.detalles_pedido}`
      : '';
    const tipoTxt = pedido.tipo_servicio ? `\n\n🔁 Tipo de servicio: *${pedido.tipo_servicio}*` : '';
    return [recoger, entregar, lista].filter(Boolean).join('\n\n') + tipoTxt;
  }

  // 🕑 Corre cada 2 minutos
  @Cron('*/2 * * * *')
  async reintentarAsignacionPendientes(): Promise<void> {
    if (this.isRetryRunning) {
      this.logger.log('⏳ Reintento ya en ejecución; se omite esta corrida.');
      return;
    }
    this.isRetryRunning = true;

    try {
      // 1) Trae pedidos PENDIENTES (ajusta take/orden según negocio)
      const pendientes = await this.domiciliosService.find({
        where: { estado: 0 },
        order: { fecha: 'ASC' }, // primero los más antiguos
        take: 25,
      });

      if (!pendientes?.length) {
        this.logger.log('✅ No hay pedidos pendientes para reintentar.');
        return;
      }

      this.logger.log(`🔁 Reintentando asignación para ${pendientes.length} pedido(s) pendiente(s).`);

      for (const pedido of pendientes) {
        try {
          // 2) Intentar asignar domiciliario disponible
          const domiciliario: Domiciliario | null =
            await this.domiciliarioService.asignarDomiciliarioDisponible();

          if (!domiciliario) {
            this.logger.warn(`⚠️ Sin domiciliarios para pedido id=${pedido.id}. Se mantiene pendiente.`);
            continue; // sigue con el siguiente
          }

          // 3) Actualizar pedido -> asignado
          await this.domiciliosService.update(pedido.id, {
            estado: 1,
            id_domiciliario: domiciliario.id,
          });

          // 4) Crear conversación (si no existe ya)
          const conversacion = this.conversacionRepo.create({
            numero_cliente: pedido.numero_cliente,
            numero_domiciliario: domiciliario.telefono_whatsapp,
            fecha_inicio: new Date(),
            estado: 'activa',
          });
          await this.conversacionRepo.save(conversacion);

          // 5) Notificar a cliente
          const resumen = this.generarResumenPedidoDesdePedido(pedido);
          await this.enviarMensajeTexto(
            pedido.numero_cliente,
            `✅ ¡Buenas noticias! Ya asignamos un domiciliario a tu pedido.\n\n` +
              `👤 *${domiciliario.nombre} ${domiciliario.apellido}*\n` +
              `🧥 Chaqueta: *${domiciliario.numero_chaqueta}*\n` +
              `📞 WhatsApp: *${domiciliario.telefono_whatsapp}*\n\n` +
              `🔎 Resumen:\n${resumen}\n\n` +
              `💬 Ya puedes chatear aquí. Escribe *fin* para terminar la conversación.`
          );

          // 6) Notificar al domiciliario
          const telefonoDomiciliario = domiciliario.telefono_whatsapp.replace(/\D/g, '');
          await this.enviarMensajeTexto(
            telefonoDomiciliario,
            `📦 *Nuevo pedido asignado*\n\n${resumen}\n\n` +
              `👤 Cliente: *${pedido.numero_cliente || 'Cliente'}*\n` +
              `📞 WhatsApp: ${pedido.numero_cliente.startsWith('+') ? pedido.numero_cliente : '+57' + String(pedido.numero_cliente).slice(-10)}`
          );

          // 7) Conectar en memoria para que fluya el chat
          estadoUsuarios.set(pedido.numero_cliente, {
            ...(estadoUsuarios.get(pedido.numero_cliente) || {}),
            conversacionId: conversacion.id,
            inicioMostrado: true,
          });
          estadoUsuarios.set(`${domiciliario.telefono_whatsapp}`, {
            conversacionId: conversacion.id,
            tipo: 'conversacion_activa',
            inicioMostrado: true,
          });

          // 8) Limpia flag de espera si existía
          const st = estadoUsuarios.get(pedido.numero_cliente) || {};
          st.esperandoAsignacion = false;
          estadoUsuarios.set(pedido.numero_cliente, st);

          this.logger.log(`✅ Pedido id=${pedido.id} asignado a domi id=${domiciliario.id}.`);
        } catch (err) {
          this.logger.error(`❌ Error reintentando pedido id=${pedido.id}: ${err?.message || err}`);
          // sigue con el siguiente
        }
      }
    } catch (err) {
      this.logger.error(`❌ Error global en reintentos: ${err?.message || err}`);
    } finally {
      this.isRetryRunning = false;
    }
  }

  // ✅ Guardia único: ¿está en cualquier flujo o puente?
  private estaEnCualquierFlujo(numero: string): boolean {
    const st = estadoUsuarios.get(numero);
    return Boolean(
      st?.conversacionId ||   // puente cliente-domiciliario activo
      st?.awaitingEstado ||   // domiciliario eligiendo estado via botones
      st?.tipo ||             // opcion_1/2/3 o etiquetas como 'restaurantes'/'soporte'
      st?.flujoActivo         // bandera genérica para flujos no guiados
    );
  }

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

        
        const esDomiciliario = await this.domiciliarioService.esDomiciliario(numero);
        // Solo mostrar botones si NO es respuesta interactiva (para evitar bucle)
const enConversacionActiva =
  estadoUsuarios.has(numero) && estadoUsuarios.get(numero)?.conversacionId;

  if (esDomiciliario && !enConversacionActiva && tipo !== 'interactive') {
      const st = estadoUsuarios.get(numero) || {};
      if (st.awaitingEstado) {
        this.logger.log(`⏭️ Ya se pidió estado a ${numero}; no se reenvía.`);
        return;
      }

      st.awaitingEstado = true;
      estadoUsuarios.set(numero, st);

      // TTL de seguridad (5 min)
      if (temporizadoresEstado.has(numero)) {
        clearTimeout(temporizadoresEstado.get(numero)!);
      }
      const t = setTimeout(() => {
        const s = estadoUsuarios.get(numero) || {};
        s.awaitingEstado = false;
        estadoUsuarios.set(numero, s);
        temporizadoresEstado.delete(numero);
        this.logger.log(`⏳ TTL expiró; limpiada awaitingEstado de ${numero}`);
      }, 5 * 60 * 1000);
      temporizadoresEstado.set(numero, t);

      await this.enviarMensajeTexto(numero, '👋 Hola, ¿qué estado deseas establecer?');

      await axiosWhatsapp.post('/messages', {
        messaging_product: 'whatsapp',
        to: numero,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: 'Selecciona tu estado actual:' },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'disponible', title: '✅ Disponible' } },
              { type: 'reply', reply: { id: 'no_disponible', title: '🛑 No disponible' } },
            ],
          },
        },
      });

      return;
    }



        // 🧠 Obtener o inicializar estado del usuario
        let estado = estadoUsuarios.get(numero);

        if (!estado) {
            estado = { paso: 0, datos: {}, inicioMostrado: false };
            estadoUsuarios.set(numero, estado);
        }

   if (estado?.conversacionId) {
  const conversacion = await this.conversacionRepo.findOne({
    where: { id: estado.conversacionId },
  });

  if (!conversacion) {
    return;
  }

  const esCliente = numero === conversacion.numero_cliente;
  const esDomiciliario = numero === conversacion.numero_domiciliario;
  const receptor = esCliente ? conversacion.numero_domiciliario : conversacion.numero_cliente;

  // Guardar mensaje en la base de datos
  await this.mensajeRepo.save({
    conversacion_id: String(conversacion.id),
    emisor: numero,
    receptor,
    contenido: texto,
    tipo,
  });

  // 🔚 Si escriben "fin", finalizar conversación
  if (texto?.trim().toLowerCase() === 'fin') {
    await this.enviarMensajeTexto(numero, '✅ Has finalizado la conversación.');
    await this.enviarMensajeTexto(receptor, '⚠️ La otra persona finalizó la conversación.');

    conversacion.estado = 'finalizada';
    conversacion.fecha_fin = new Date();
    await this.conversacionRepo.save(conversacion);

    estadoUsuarios.delete(numero);
    estadoUsuarios.delete(receptor);
    temporizadoresInactividad.delete(numero);
    temporizadoresInactividad.delete(receptor);

    return;
  }

  // Reenviar el mensaje al otro participante
  await this.enviarMensajeTexto(receptor, `💬 ${texto}`);
  return;
}

const textoLimpio = (texto || '').trim().toLowerCase();


        estado.ultimoMensaje = Date.now(); // ⏱️ Guarda la hora

        // Borra temporizador anterior si existe
        if (temporizadoresInactividad.has(numero)) {
            clearTimeout(temporizadoresInactividad.get(numero));
        }

        // Crea nuevo temporizador
        const timeout = setTimeout(() => {
            reiniciarPorInactividad(numero, this.enviarMensajeTexto.bind(this));
            
        }, 10 * 60 * 1000); // ⏳ 5 minutos

        temporizadoresInactividad.set(numero, timeout);


       // ✅ Reiniciar si el usuario escribe un saludo/comando
const triggersReinicio = ['hola','menu','inicio','empezar','buenas','buenos dias','buenas tardes','buenas noches'];
if (tipo === 'text' && triggersReinicio.some(t => textoLimpio.includes(t))) {
  estadoUsuarios.delete(numero);
  if (estado?.conversacionId) {
    await this.conversacionRepo.update(estado.conversacionId, { fecha_fin: new Date(), estado: 'finalizada' });
  }
  await this.enviarMensajeTexto(
    numero,
    `👋 Hola ${nombre}, soy *Wilber*, tu asistente virtual de *Domicilios W* 🛵💨

📲 Pide tu servicio ingresando a nuestra página web:
🌐 https://domiciliosw.com/`
  );
  await this.enviarSticker(numero, '3908588892738247');
  await this.enviarListaOpciones(numero);
  return;
}

        if (tipo === 'sticker') {
            const sha = mensaje?.sticker?.sha256;
            const STICKER_EMPRESA_SHA = '8Tno525We2epSZU4qLJ/E5+u/7NSBK9kkyW9sQ2Uvqw=';

            this.logger.log(`📎 SHA del sticker recibido: ${sha}`);

            const numeroLimpio = numero.startsWith('57') ? numero.slice(2) : numero;

            if (sha === STICKER_EMPRESA_SHA) {
                try {
                    const comercio = await this.comerciosService.findByTelefono(numeroLimpio);

                    await this.enviarMensajeTexto(
                        numero,
                        `🎉 ¡Gracias por usar nuestro *sticker oficial*! 🎉\n\n📍 *Comercio detectado:*\n🏪 ${comercio.nombre}\n📞 ${comercio.telefono}\n📌 ${comercio.direccion}`
                    );
                } catch (error) {
                    await this.enviarMensajeTexto(numero, '🎉 ¡Gracias por usar nuestro *sticker oficial*!');
                    this.logger.warn(`⚠️ No se encontró comercio para el número: ${numeroLimpio}`);
                }
            } else {
                await this.enviarMensajeTexto(numero, '📎 ¡Gracias por tu sticker!');
            }

            return;
        }


        if (mensaje?.interactive?.type === 'button_reply') {
            const id = mensaje.interactive.button_reply.id;

            // 🔄 Actualizar estado del domiciliario
            if (id === 'disponible' || id === 'no_disponible') {
                const disponible = id === 'disponible';

                try {
                    await this.domiciliarioService.cambiarDisponibilidadPorTelefono(numero, disponible);

                    await this.enviarMensajeTexto(
                        numero,
                        `✅ Estado actualizado. Ahora estás como *${disponible ? 'DISPONIBLE' : 'NO DISPONIBLE'}*.`
                    );
                } catch (error) {
                    this.logger.warn(`⚠️ Error al cambiar disponibilidad: ${error.message}`);
                    await this.enviarMensajeTexto(numero, '❌ No se encontró tu perfil como domiciliario.');
                }

                // 🧹 Finaliza conversación y limpia estado
                estadoUsuarios.delete(numero);

                if (temporizadoresInactividad.has(numero)) {
                    clearTimeout(temporizadoresInactividad.get(numero));
                    temporizadoresInactividad.delete(numero);
                }

                await this.enviarMensajeTexto(
                    numero,
                    '👋 Gracias por actualizar tu estado. Puedes escribir *hola* si necesitas algo más.'
                );

                return;
            }

            // ✅ Confirmaciones de pedido
    // ✅ Confirmaciones de pedido
if (id === 'confirmar_info' || id === 'confirmar_pago' || id === 'confirmar_compra') {
  let domiciliario: Domiciliario | null = null;

  const st = estadoUsuarios.get(numero) || {};
  const datos = st?.datos || {};
  const tipo = st?.tipo || 'servicio';

  try {
    // 1) Intentar asignar
    domiciliario = await this.domiciliarioService.asignarDomiciliarioDisponible();

    // 2) Crear conversación y puentear a ambos
    const conversacion = this.conversacionRepo.create({
      numero_cliente: numero,
      numero_domiciliario: domiciliario.telefono_whatsapp,
      fecha_inicio: new Date(),
      estado: 'activa',
    });
    await this.conversacionRepo.save(conversacion);

    st.conversacionId = conversacion.id;
    estadoUsuarios.set(numero, st);

    estadoUsuarios.set(`${domiciliario.telefono_whatsapp}`, {
      conversacionId: conversacion.id,
      tipo: 'conversacion_activa',
      inicioMostrado: true,
    });

    // 3) Avisar a cliente
    await this.enviarMensajeTexto(
      numero,
      `✅ Ya enviamos un domiciliario para ti:

👤 *${domiciliario.nombre} ${domiciliario.apellido}*
🧥 Chaqueta: *${domiciliario.numero_chaqueta}*
📞 WhatsApp: *${domiciliario.telefono_whatsapp}*

🚀 Está en camino. Gracias por usar *Domicilios W* 🛵💨`
    );

    // 4) Avisar al domiciliario
    const resumenPedido = this.generarResumenPedido(datos, tipo, nombre, numero);
    const telefonoDomiciliario = domiciliario.telefono_whatsapp.replace(/\D/g, '');
    await this.enviarMensajeTexto(
      telefonoDomiciliario,
      `📦 *Nuevo pedido asignado*\n\n${resumenPedido}\n\n👤 Cliente: *${nombre}*\n📞 WhatsApp: ${numero.startsWith('+') ? numero : '+57' + numero.slice(-10)}`
    );

    // 5) Registrar pedido como ASIGNADO
    await this.domiciliosService.create({
      mensaje_confirmacion: 'Confirmado por el cliente vía WhatsApp',
      estado: 1, // asignado
      numero_cliente: numero,
      fecha: new Date().toISOString(),
      hora: new Date().toTimeString().slice(0, 5),
      id_cliente: null,
      id_domiciliario: domiciliario.id,
      tipo_servicio: tipo.replace('opcion_', ''),
      origen_direccion: datos.direccionRecoger ?? '',
      destino_direccion: datos.direccionEntregar ?? datos.direccionEntrega ?? '',
      telefono_contacto_origen: datos.telefonoRecoger ?? '',
      telefono_contacto_destino: datos.telefonoEntregar ?? datos.telefonoEntrega ?? '',
      notas: '',
      detalles_pedido: datos.listaCompras ?? '',
      foto_entrega_url: '',
    });

    // 🔐 Mensaje final SOLO si hay conversacion activa
    await this.enviarMensajeTexto(
      numero,
      '✅ Ya estás conectado con el domiciliario. Puedes chatear aquí. Escribe *fin* para terminar la conversación.'
    );
  } catch (error) {
    // ❌ No hay domiciliarios disponibles
    this.logger.warn('⚠️ No hay domiciliarios disponibles en este momento.');

    // ⚠️ IMPORTANTE: NO crear conversación aquí
    // Guardamos un flag de espera para no mostrar menú ni romper el flujo
    st.esperandoAsignacion = true;
    estadoUsuarios.set(numero, st);

    // 1) Mensaje claro al cliente
    await this.enviarMensajeTexto(
      numero,
      '🕐 *Tu pedido está siendo procesado.* En cuanto uno de nuestros domiciliarios esté disponible, te lo asignaremos y te avisaremos por este chat. Gracias por usar *Domicilios W* 🛵💨'
    );

    // 2) Registrar pedido como PENDIENTE (sin domiciliario)
    await this.domiciliosService.create({
      mensaje_confirmacion: 'Confirmado por el cliente vía WhatsApp',
      estado: 0, // pendiente
      numero_cliente: numero,
      fecha: new Date().toISOString(),
      hora: new Date().toTimeString().slice(0, 5),
      id_cliente: null,
      id_domiciliario: null,
      tipo_servicio: tipo.replace('opcion_', ''),
      origen_direccion: datos.direccionRecoger ?? '',
      destino_direccion: datos.direccionEntregar ?? datos.direccionEntrega ?? '',
      telefono_contacto_origen: datos.telefonoRecoger ?? '',
      telefono_contacto_destino: datos.telefonoEntregar ?? datos.telefonoEntrega ?? '',
      notas: '',
      detalles_pedido: datos.listaCompras ?? '',
      foto_entrega_url: '',
    });

    // (Opcional) Podrías lanzar un proceso de reintento aquí
    // this.programarReintentoAsignacion(numero);
  }

  return;
}


            
            // ✏️ Editar información
            if (id === 'editar_info') {
                await this.enviarMensajeTexto(numero, '🔁 Vamos a corregir la información. Empecemos de nuevo...');
                estadoUsuarios.set(numero, { paso: 0, datos: {}, tipo: 'opcion_1' });
                await this.opcion1PasoAPaso(numero, '');
                return;
            }

            if (id === 'editar_compra') {
                const tipo = estadoUsuarios.get(numero)?.tipo;
                if (tipo === 'opcion_2') {
                    await this.enviarMensajeTexto(numero, '🔁 Vamos a actualizar tu lista de compras...');
                    estadoUsuarios.set(numero, { paso: 0, datos: {}, tipo: 'opcion_2' });
                    await this.opcion2PasoAPaso(numero, '');
                } else if (tipo === 'opcion_3') {
                    await this.enviarMensajeTexto(numero, '🔁 Vamos a corregir la información del pago...');
                    estadoUsuarios.set(numero, { paso: 0, datos: {}, tipo: 'opcion_3' });
                    await this.opcion3PasoAPaso(numero, '');
                } else {
                    await this.enviarMensajeTexto(numero, '❓ No se pudo identificar el tipo de flujo para editar.');
                }
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
  const st4 = estadoUsuarios.get(numero) || { paso: 0, datos: {} };
  st4.flujoActivo = true;
  st4.tipo = 'restaurantes';
  estadoUsuarios.set(numero, st4);
  await this.enviarMensajeTexto(
    numero,
    '🍽️ Mira nuestras cartas de *RESTAURANTES* en: https://domiciliosw.com'
  );
  return;

case 'opcion_5':
  const st5 = estadoUsuarios.get(numero) || { paso: 0, datos: {} };
  st5.flujoActivo = true;
  st5.tipo = 'soporte';
  estadoUsuarios.set(numero, st5);
  await this.enviarMensajeTexto(
    numero,
    '📞 Para PSQR comunícate por WhatsApp al *3108857311*'
  );
  return;


                default:
                    await this.enviarMensajeTexto(numero, '❓ Opción no reconocida.');
                    return;
            }
        }


        // ✅ 1. Arrancar conversación con cualquier texto si no hay flujo activo
const enConversacion = Boolean(estado?.conversacionId);
const menuBloqueado = bloqueoMenu.has(numero);

if (
  tipo === 'text' &&
  !estado?.inicioMostrado &&
  !this.estaEnCualquierFlujo(numero) && // ⛔ NO mostrar menú si está en flujo
  !menuBloqueado
) {
  await this.enviarMensajeTexto(
    numero,
    `👋 Hola ${nombre}, soy *Wilber*, tu asistente virtual de *Domicilios W* 🛵💨

📲 Pide tu servicio ingresando a nuestra página web:
🌐 https://domiciliosw.com/`
  );
  await this.enviarListaOpciones(numero);
  estado.inicioMostrado = true;
  estadoUsuarios.set(numero, estado);
  return;
}


        // ✅ 2. Si el usuario ya está en flujo guiado
       if (estadoUsuarios.has(numero) && tipo === 'text' && estado?.tipo) {
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
+       this.logger.warn(`⚠️ Tipo de flujo desconocido para ${numero} (estado.tipo vacío)`);
            }
            return;
        }


        // ✅ 3. Enviar saludo y menú solo si no se mostró antes
//         if (!estado.inicioMostrado && numero && texto) {
//             this.logger.log(`📨 Mensaje recibido de ${nombre} (${numero}): "${texto}"`);

//             await this.enviarMensajeTexto(
//                 numero,
//                 `👋 Hola ${nombre}, soy *Wilber*, tu asistente virtual de *Domicilios W* 🛵💨

// 📲 Pide tu servicio ingresando a nuestra página web:
// 🌐 https://domiciliosw.com/`
//             );

//             await this.enviarListaOpciones(numero);

//             estado.inicioMostrado = true;
//             estadoUsuarios.set(numero, estado);
//         } else {
//             this.logger.warn('⚠️ Mensaje sin número o texto válido, o saludo ya enviado.');
//         }
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
        const estado = estadoUsuarios.get(numero) || { paso: 0, datos: {}, tipo: 'opcion_1' };

        switch (estado.paso) {
            case 0:
                await this.enviarMensajeTexto(numero, '📝 Por favor, indícame la *Dirección de recogida*.');
                estado.paso = 1;
                break;

            case 1:
                if (!mensaje?.trim()) return;
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

                // ✅ Evitar repetición del resumen y botones
                if (estado.confirmacionEnviada) break;

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

                estado.confirmacionEnviada = true;
                estado.paso = 5;
                break;

            case 5:
                // A la espera del botón
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

                if (estado.confirmacionEnviada) break; // 🚫 Evitar repetición

                estado.datos.telefonoEntrega = mensaje.trim();

                const { listaCompras, direccionEntrega, telefonoEntrega } = estado.datos;

                await this.enviarMensajeTexto(
                    numero,
                    `🧾 Esta es la compra que solicitaste:\n\n📦 *Lista de compras:*\n${listaCompras}\n\n📍 *Dirección de entrega:*\n${direccionEntrega}\n📞 *Teléfono quien recibe:*\n${telefonoEntrega}`
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
                                    reply: {
                                        id: 'confirmar_compra',
                                        title: '✅ Sí',
                                    },
                                },
                                {
                                    type: 'reply',
                                    reply: {
                                        id: 'editar_compra',
                                        title: '🔁 No, editar',
                                    },
                                },
                            ],
                        },
                    },
                });

                estado.confirmacionEnviada = true; // ✅ Marca como enviado
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

                // Si ya se envió el resumen y los botones, no repetir
                if (estado.confirmacionEnviada) break;

                estado.datos.telefonoRecoger = mensaje;

                const { direccionRecoger, telefonoRecoger } = estado.datos;

                await this.enviarMensajeTexto(
                    numero,
                    `✅ Esta es la información que me diste:\n\n📍 Dirección de recogida: ${direccionRecoger}\n📞 Teléfono: ${telefonoRecoger}`
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
                                    reply: {
                                        id: 'confirmar_compra',
                                        title: '✅ Sí',
                                    },
                                },
                                {
                                    type: 'reply',
                                    reply: {
                                        id: 'editar_compra',
                                        title: '🔁 No, editar',
                                    },
                                },
                            ],
                        },
                    },
                });

                estado.confirmacionEnviada = true; // ✅ Marca como enviado
                estado.paso = 3;
                break;


            default:
                await this.enviarMensajeTexto(numero, '❌ Algo salió mal. Empecemos de nuevo.');
                estadoUsuarios.delete(numero);
                await this.opcion3PasoAPaso(numero, '');
                return;
        }

        estadoUsuarios.set(numero, estado);
    }


    private async enviarSticker(numero: string, mediaId: string): Promise<void> {
        try {
            await axiosWhatsapp.post('/messages', {
                messaging_product: 'whatsapp',
                to: numero,
                type: 'sticker',
                sticker: {
                    id: mediaId,
                },
            });

            this.logger.log(`✅ Sticker enviado a ${numero}`);
        } catch (error) {
            this.logger.error('❌ Error al enviar el sticker:', error.response?.data || error.message);
        }
    }



    private generarResumenPedido(datos: any, tipo: string, nombre: string, numero: string): string {
        if (!datos) return 'Sin datos del pedido.';

        const recoger = datos.direccionRecoger
            ? `📍 *Recoger en:* ${datos.direccionRecoger}\n📞 *Tel:* ${datos.telefonoRecoger}`
            : '';

        const entregar = datos.direccionEntregar || datos.direccionEntrega;
        const telEntregar = datos.telefonoEntregar;
        const entrega = entregar
            ? `🏠 *Entregar en:* ${entregar}\n📞 *Tel:* ${telEntregar}`
            : '';

        const lista = datos.listaCompras
            ? `🛒 *Lista de compras:*\n${datos.listaCompras}`
            : '';

        let resumen = [recoger, entrega, lista].filter(Boolean).join('\n\n');
        resumen += `\n\n🔁 Tipo de servicio: *${tipo.replace('opcion_', '')}*`;

        return resumen.trim();
    }


    

}


