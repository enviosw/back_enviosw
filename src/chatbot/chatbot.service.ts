import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ComerciosService } from '../comercios/comercios.service';
import { axiosWhatsapp } from '../common/axios-whatsapp.instance';
import { DomiciliosService } from '../domicilios/domicilios.service';
import { DomiciliariosService } from '../domiliarios/domiliarios.service';
import { Domiciliario } from '../domiliarios/entities/domiliario.entity';
import { Conversacion } from './entities/conversacion.entity';
import { Repository } from 'typeorm';
import { Mensaje } from './entities/mensajes.entity';
import { Cron } from '@nestjs/schedule';
import { stickerConstants, urlImagenConstants } from '../auth/constants/jwt.constant';


const estadoUsuarios = new Map<string, any>();
const temporizadoresInactividad = new Map<string, NodeJS.Timeout>(); // ⏰ Temporizadores
const temporizadoresEstado = new Map<string, NodeJS.Timeout>(); // TTL para solicitar estado a domiciliario
const bloqueoMenu = new Map<string, NodeJS.Timeout>(); // Bloqueo temporal del menú

const ESTADO_COOLDOWN_MS = 5 * 60 * 1000; // 5 min

function isExpired(ts?: number) {
  return !ts || Date.now() >= ts;
}


const ASESOR_PSQR = '573208729276';

const TRIGGER_PALABRA_CLAVE = '01';
// 👉 Si mañana agregas más stickers, solo pon sus SHA aquí:
const STICKERS_RAPIDOS = new Set<string>([
  String(stickerConstants.stickerChad), // sticker oficial actual
]);


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

  // ⏰ Cierre por inactividad (10 min)
  // No aplica si hay conversación activa o si el pedido está confirmado / esperando asignación
  private async reiniciarPorInactividad(numero: string) {
    const st = estadoUsuarios.get(numero) || {};

    // No cerrar si está en soporte o con pedido activo/en asignación
    if (st?.soporteActivo) return;
    if (st?.conversacionId) return;
    if (st?.confirmadoPedido === true) return;
    if (st?.esperandoAsignacion === true) return;

    // 🔻 Limpieza de estado en memoria
    estadoUsuarios.delete(numero);

    // ⏱️ Timer de inactividad
    if (temporizadoresInactividad.has(numero)) {
      clearTimeout(temporizadoresInactividad.get(numero)!);
      temporizadoresInactividad.delete(numero);
    }

    // ⏱️ Cooldown de estado (por si existía)
    if (temporizadoresEstado.has(numero)) {
      clearTimeout(temporizadoresEstado.get(numero)!);
      temporizadoresEstado.delete(numero);
    }

    // 🔒 Bloqueo de menú (por si estaba activo)
    if (bloqueoMenu.has(numero)) {
      clearTimeout(bloqueoMenu.get(numero)!);
      bloqueoMenu.delete(numero);
    }

    // (Opcional) si normalizas números, asegúrate de usar SIEMPRE el mismo formato para las claves

    try {
      await this.enviarMensajeTexto(numero, '🚨');
      const cierre = [
        '📕✨ *El chat se cerró automáticamente por inactividad*',
        '👉 ¡Pero aquí sigo listo para ayudarte!',
        '',
        'Escribe *Hola* y volvemos a empezar un nuevo chat 🚀💬'
      ].join('\n');
      await this.enviarMensajeTexto(numero, cierre);
    } catch (e: any) {
      this.logger.error(`❌ Error notificando cierre por inactividad a ${numero}: ${e?.message || e}`);
    }
  }



  // 🧠 helper: armar resumen desde registro de pedido en BD (no desde "datos")
  // private generarResumenPedidoDesdePedido(pedido: any): string {
  //   const recoger = pedido.origen_direccion
  //     ? `📍 *Recoger en:* ${pedido.origen_direccion}\n📞 *Tel:* ${pedido.telefono_contacto_origen || '-'}`
  //     : '';
  //   const entregar = pedido.destino_direccion
  //     ? `🏠 *Entregar en:* ${pedido.destino_direccion}\n📞 *Tel:* ${pedido.telefono_contacto_destino || '-'}`
  //     : '';
  //   const lista = pedido.detalles_pedido
  //     ? `🛒 *Lista de compras:*\n${pedido.detalles_pedido}`
  //     : '';
  //   const tipoTxt = pedido.tipo_servicio ? `\n\n🔁 Tipo de servicio: *${pedido.tipo_servicio}*` : '';
  //   return [recoger, entregar, lista].filter(Boolean).join('\n\n') + tipoTxt;
  // }

  // 🧠 helper: armar resumen desde registro de pedido en BD (con trato especial a "sticker")
  private generarResumenPedidoDesdePedido(pedido: any): string {
    const esSticker = String(pedido?.tipo_servicio || '').toLowerCase() === 'sticker';

    if (esSticker) {
      // ⚡ Pedido rápido por sticker: solo lo mínimo para el domiciliario
      const recoger = pedido.origen_direccion
        ? `📍 Recoger: ${pedido.origen_direccion}`
        : '';
      const tel = pedido.telefono_contacto_origen
        ? `📞 Tel: ${pedido.telefono_contacto_origen}`
        : '';

      return ['⚡ Pedido rápido (sticker)', recoger, tel]
        .filter(Boolean)
        .join('\n');
    }

    // 🧾 Comportamiento normal para los demás tipos
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


  @Cron('0 4 * * *', { timeZone: 'America/Bogota' })
  async cronReiniciarTurnos(): Promise<void> {
    this.logger.log('🔄 Iniciando reinicio diario de turnos (4:00 AM).');
    try {
      await this.domiciliarioService.reiniciarTurnosACeroYNoDisponibles();
      this.logger.log('✅ Reinicio de turnos completado (turno_orden=0, disponible=false).');
    } catch (err: any) {
      this.logger.error(`❌ Falló el reinicio de turnos: ${err?.message || err}`);
    }
  }


  @Cron('*/1 * * * *') // cada minuto
  async reintentarAsignacionPendientes(): Promise<void> {
    if (this.isRetryRunning) {
      this.logger.log('⏳ Reintento ya en ejecución; se omite esta corrida.');
      return;
    }
    this.isRetryRunning = true;

    // ⏱️ cuánto tiempo dejamos un pedido en estado 0 (pendiente)
    const MAX_WAIT_MS = 10 * 60 * 1000; // 10 minutos

    try {
      const pendientes = await this.domiciliosService.find({
        where: { estado: 0 },               // solo pendientes
        order: { fecha: 'ASC' },
        take: 25,
      });

      if (!pendientes?.length) {
        this.logger.log('✅ No hay pedidos pendientes para reintentar.');
        return;
      }

      this.logger.log(`🔁 Reintentando asignación para ${pendientes.length} pedido(s) pendiente(s).`);

      for (const pedido of pendientes) {
        try {
          // ########## NUEVO: cancelar si supera 8 minutos ##########
          const creadaMs = new Date(pedido.fecha).getTime(); // usa el campo correcto
          const diff = Date.now() - creadaMs;



          // ✅ Guardia contra carrera: ¿sigue pendiente?
          if (!(await this.estaPendiente(pedido.id))) {
            this.logger.log(`⏭️ Pedido id=${pedido.id} ya no está pendiente (posible cancelación).`);
            continue;
          }

          if (Number.isFinite(creadaMs) && diff >= MAX_WAIT_MS) {
            // Marca como cancelado (ajusta el código de estado a tu dominio)
            await this.domiciliosService.update(pedido.id, {
              estado: 2, // p.ej. -1 = cancelado_por_timeout
              motivo_cancelacion: 'Tiempo de espera de asignación superado (10m)',
            });

            // Notifica al cliente
            // Notifica al cliente
            await this.enviarMensajeTexto(
              pedido.numero_cliente,
              [
                '🚨 ¡Ups! *SIN DOMICILIARIOS DISPONIBLES*',
                '⛔ Tu solicitud fue cancelada.',
                '',
                '👉 Vuelve a pedir tu servicio o contacta a nuestros aliados:',
                '',
                '📞 *314 440 3062* – Veloz',
                '📞 *313 705 7041* – Rápigo',
                '📞 *314 242 3130* – EnviosW',
                '',
                '🌐 domiciliosw.com!',
                '⭐ *Tu mejor opción*'
              ].join('\n')
            );


            // Limpia flag de espera en memoria (si lo usas)
            const st = estadoUsuarios.get(pedido.numero_cliente) || {};
            st.esperandoAsignacion = false;
            estadoUsuarios.set(pedido.numero_cliente, st);

            this.logger.warn(`❌ Pedido id=${pedido.id} cancelado por timeout de asignación (>8m).`);
            continue; // pasa al siguiente pedido, no intentes asignar este
          }
          // ########## FIN NUEVO ##########

          // 2) Intentar asignar domiciliario disponible
          const domiciliario: Domiciliario | null =
            await this.domiciliarioService.asignarDomiciliarioDisponible();

          if (!domiciliario) {
            this.logger.warn(`⚠️ Sin domiciliarios para pedido id=${pedido.id}. Se mantiene pendiente.`);

            // 👇 ofrecer cancelar durante reintentos, sin spam (cada 5 min)
            await this.mostrarMenuPostConfirmacion(
              pedido.numero_cliente,
              pedido.id,
              '⏳ Seguimos buscando un domiciliario. Si ya no lo necesitas, puedes cancelar:',
              5 * 60 * 1000
            );

            continue;
          }

          // 3) Actualizar pedido -> asignado
          await this.domiciliosService.update(pedido.id, {
            estado: 5, // ofertado
            id_domiciliario: domiciliario.id,
          });

          await axiosWhatsapp.post('/messages', {
            messaging_product: 'whatsapp',
            to: domiciliario.telefono_whatsapp,
            type: 'interactive',
            interactive: {
              type: 'button',
              body: { text: `📦 *Nuevo pedido disponible*:\n\n${this.generarResumenPedidoDesdePedido(pedido)}` },
              action: {
                buttons: [
                  { type: 'reply', reply: { id: `aceptar_pedido_${pedido.id}`, title: '✅ Aceptar' } },
                  { type: 'reply', reply: { id: `rechazar_pedido_${pedido.id}`, title: '❌ Rechazar' } },
                ],
              },
            },
          });


          // 5) Timeout: si no responde, volver a pendiente y reintentar
          setTimeout(async () => {
            try {
              const p = await this.getPedidoById(pedido.id);
              if (p?.estado === 5) {
                await this.domiciliosService.update(p.id, {
                  estado: 0,
                  id_domiciliario: null,
                  motivo_cancelacion: 'No respuesta de domiciliario',
                });
                this.logger.warn(`⏰ Domi no respondió. Reofertando pedido id=${p.id}`);
                this.reintentarAsignacionPendientes();
              }
            } catch (e) {
              this.logger.error(`Timeout oferta falló para pedido ${pedido.id}: ${e?.message || e}`);
            }
          }, 120_000); // 2 minutos



          // // 4) Crear conversación (si no existe ya)
          // const conversacion = this.conversacionRepo.create({
          //   numero_cliente: pedido.numero_cliente,
          //   numero_domiciliario: domiciliario.telefono_whatsapp,
          //   fecha_inicio: new Date(),
          //   estado: 'activa',
          // });
          // await this.conversacionRepo.save(conversacion);

          // // 5) Notificar a cliente
          // const resumen = this.generarResumenPedidoDesdePedido(pedido);
          // await this.enviarMensajeTexto(
          //   pedido.numero_cliente,
          //   `✅ ¡Buenas noticias! Ya asignamos un domiciliario a tu pedido.\n\n` +
          //   `👤 *${domiciliario.nombre} ${domiciliario.apellido}*\n` +
          //   `🧥 Chaqueta: *${domiciliario.numero_chaqueta}*\n` +
          //   `📞 WhatsApp: *${domiciliario.telefono_whatsapp}*\n\n` +
          //   `✅ Ya estás conectado con el domiciliario desde este chat. ¡Respóndele aquí!`

          // );

          // // 6) Notificar al domiciliario
          // const telefonoDomiciliario = domiciliario.telefono_whatsapp.replace(/\D/g, '');
          // await this.enviarMensajeTexto(
          //   telefonoDomiciliario,
          //   `📦 *Nuevo pedido asignado*\n\n${resumen}\n\n` +
          //   `👤 Cliente: *${pedido.numero_cliente || 'Cliente'}*\n` +
          //   `📞 WhatsApp: ${String(pedido.numero_cliente).startsWith('+')
          //     ? String(pedido.numero_cliente)
          //     : '+57' + String(pedido.numero_cliente).slice(-10)
          //   }\n\n` +
          //   `✅ Ya estás conectado con el cliente en este chat. ¡Respóndele aquí!`
          // );

          // await this.enviarBotonFinalizarAlDomi(telefonoDomiciliario);


          // // 7) Conectar en memoria para que fluya el chat
          // estadoUsuarios.set(pedido.numero_cliente, {
          //   ...(estadoUsuarios.get(pedido.numero_cliente) || {}),
          //   conversacionId: conversacion.id,
          //   inicioMostrado: true,
          // });
          // estadoUsuarios.set(`${domiciliario.telefono_whatsapp}`, {
          //   conversacionId: conversacion.id,
          //   tipo: 'conversacion_activa',
          //   inicioMostrado: true,
          // });

          // // 8) Limpia flag de espera si existía
          // const st = estadoUsuarios.get(pedido.numero_cliente) || {};
          // st.esperandoAsignacion = false;
          // estadoUsuarios.set(pedido.numero_cliente, st);

          // this.logger.log(`✅ Pedido id=${pedido.id} asignado a domi id=${domiciliario.id}.`);
        } catch (err) {
          this.logger.error(`❌ Error reintentando pedido id=${pedido.id}: ${err?.message || err}`);
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

    // 🔎 Detección mínima basada SOLO en el prefijo "pedido desde"
    if (tipo === 'text' && this.empiezaConPedidoDesde(texto)) {
      try {
        await this.procesarAutoPedidoDesde(numero, texto, nombre);
      } catch (err) {
        this.logger.error(`❌ Error procesando 'pedido desde': ${err?.message || err}`);
        await this.enviarMensajeTexto(
          numero,
          '⚠️ Ocurrió un problema al crear tu pedido automáticamente. Intenta nuevamente o escribe *hola* para usar el menú.'
        );
      }
      return; // ⛔ ya gestionado
    }


    const esDomiciliario = await this.domiciliarioService.esDomiciliario(numero);
    // Solo mostrar botones si NO es respuesta interactiva (para evitar bucle)
    // Solo mostrar botones si NO es respuesta interactiva (para evitar bucle)
    const enConversacionActiva =
      estadoUsuarios.has(numero) && estadoUsuarios.get(numero)?.conversacionId;

    if (esDomiciliario && !enConversacionActiva && tipo !== 'interactive') {
      const st = estadoUsuarios.get(numero) || {};

      // NEW: si hay candado pero YA Venció, lo limpiamos para poder volver a pedir
      if (st.awaitingEstado && isExpired(st.awaitingEstadoExpiresAt)) {
        this.logger.log(`🔓 Cooldown vencido para ${numero}; se permite re-pedir estado.`);
        st.awaitingEstado = false;
        st.awaitingEstadoExpiresAt = undefined;
        // limpia TTL viejo si existiera
        if (temporizadoresEstado.has(numero)) {
          clearTimeout(temporizadoresEstado.get(numero)!);
          temporizadoresEstado.delete(numero);
        }
        estadoUsuarios.set(numero, st);
      }

      // Si aún está activo y NO ha vencido, no reenviar
      if (st.awaitingEstado && !isExpired(st.awaitingEstadoExpiresAt)) {
        this.logger.log(`⏭️ Ya se pidió estado a ${numero}; aún en cooldown.`);
        return;
      }

      // NEW: activa candado con expiración a 5 minutos
      st.awaitingEstado = true;
      st.awaitingEstadoExpiresAt = Date.now() + ESTADO_COOLDOWN_MS;
      estadoUsuarios.set(numero, st);

      // TTL en memoria para limpiar flags a los 5 min (resiliente si nunca llega respuesta)
      if (temporizadoresEstado.has(numero)) {
        clearTimeout(temporizadoresEstado.get(numero)!);
      }
      const t = setTimeout(() => {
        const s = estadoUsuarios.get(numero) || {};
        s.awaitingEstado = false;
        s.awaitingEstadoExpiresAt = undefined;
        estadoUsuarios.set(numero, s);
        temporizadoresEstado.delete(numero);
        this.logger.log(`⏳ Cooldown de estado expiró para ${numero}; desbloqueado.`);
      }, ESTADO_COOLDOWN_MS);
      temporizadoresEstado.set(numero, t);

      // 1) Obtener estado (solo esto en try/catch)
      let disponible: boolean, turno: number, nombreDomi: string;
      try {
        const res = await this.domiciliarioService.getEstadoPorTelefono(numero);
        disponible = res.disponible;
        turno = res.turno;
        nombreDomi = res.nombre;
      } catch (e) {
        this.logger.warn(`⚠️ No se pudo obtener estado actual para ${numero}: ${e?.message || e}`);
        await this.enviarMensajeTexto(numero, '❌ No encontré tu perfil como domiciliario.');

        // NEW: ante error, libera el candado para permitir reintento manual inmediato
        const s = estadoUsuarios.get(numero) || {};
        s.awaitingEstado = false;
        s.awaitingEstadoExpiresAt = undefined;
        estadoUsuarios.set(numero, s);

        if (temporizadoresEstado.has(numero)) {
          clearTimeout(temporizadoresEstado.get(numero)!);
          temporizadoresEstado.delete(numero);
        }
        return;
      }

      const estadoTxt = disponible ? '✅ DISPONIBLE' : '🛑 NO DISPONIBLE';
      const nextId = disponible ? 'cambiar_a_no_disponible' : 'cambiar_a_disponible';
      const nextLbl = disponible ? '🛑 No disponible' : '✅ Disponible'; // <= 20 chars
      const keepLbl = '↩️ Mantener'; // <= 20 chars

      try {
        await this.enviarMensajeTexto(
          numero,
          `👋 Hola ${nombreDomi || ''}\n` +
          `Tu *estado actual* es: ${estadoTxt}\n` +
          `🔢 Tu turno actual es: *${turno}*\n\n` +
          `¿Deseas cambiar tu estado?`
        );

        await axiosWhatsapp.post('/messages', {
          messaging_product: 'whatsapp',
          to: numero,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: 'Elige una opción:' },
            action: {
              buttons: [
                { type: 'reply', reply: { id: nextId, title: nextLbl } },
                { type: 'reply', reply: { id: 'mantener_estado', title: keepLbl } },
              ],
            },
          },
        });
      } catch (e) {
        this.logger.warn(`⚠️ Falló el envío de botones a ${numero}: ${e?.response?.data?.error?.message || e?.message || e}`);

        // NEW: si el envío falló, no tiene sentido mantener bloqueado; libera para reintento
        const s = estadoUsuarios.get(numero) || {};
        s.awaitingEstado = false;
        s.awaitingEstadoExpiresAt = undefined;
        estadoUsuarios.set(numero, s);

        if (temporizadoresEstado.has(numero)) {
          clearTimeout(temporizadoresEstado.get(numero)!);
          temporizadoresEstado.delete(numero);
        }
      }
      return;
    }





    // ⚡ Palabra clave "01" ⇒ mismo comportamiento que sticker oficial (pedido rápido comercio)
    if (tipo === 'text' && this.esTriggerRapidoPorTexto(texto)) {
      try {
        const numeroLimpio = numero.startsWith('57') ? numero.slice(2) : numero;
        const comercio = await this.comerciosService.findByTelefono(numeroLimpio);

        if (!comercio) {
          await this.enviarMensajeTexto(
            numero,
            '🧾 *No encontré tu comercio en nuestro sistema.*\n' +
            'Si deseas afiliarlo para activar pedidos rápidos,\n' +
            'escríbenos al 📞 314 242 3130.'
          );

          // 🔄 Reinicio inmediato del bot (hard reset)
          estadoUsuarios.delete(numero);
          await this.enviarListaOpciones(numero);

          return;
        }

        await this.enviarMensajeTexto(
          numero,
          `⚡ *Pedido rápido activado* (palabra clave: ${TRIGGER_PALABRA_CLAVE}).\nRevisando domiciliarios...`
        );

        await this.crearPedidoDesdeSticker(numero, comercio, comercio.nombre);
      } catch (err: any) {
        this.logger.error(`❌ Error en trigger por texto "${TRIGGER_PALABRA_CLAVE}": ${err?.message || err}`);
        await this.enviarMensajeTexto(
          numero,
          '❌ Ocurrió un problema creando tu pedido rápido. Intenta nuevamente.'
        );
      }
      return;
    }


    // 🧠 Obtener o inicializar estado del usuario
    let estado = estadoUsuarios.get(numero);

    if (!estado) {
      estado = { paso: 0, datos: {}, inicioMostrado: false };
      estadoUsuarios.set(numero, estado);
    }


    // 🔀 PUENTE PSQR: reenvía mensajes entre cliente y asesor
    // Nota: este bloque va ANTES del "if (estado?.conversacionId) {...}" de domiciliarios.
    const st = estadoUsuarios.get(numero);



    if (st?.soporteActivo && st?.soporteConversacionId) {
      const textoPlano = (texto || '').trim();

      // ✅ Permitir que CUALQUIERA (asesor o cliente) cierre con "salir"
      if (tipo === 'text' && /^salir$/i.test(textoPlano)) {
        await this.finalizarSoportePSQRPorCualquiera(numero);
        return;
      }

      // 2) Determinar el otro participante
      const esAsesor = !!st.soporteCliente; // si en mi estado existe soporteCliente => soy asesor
      const otro = esAsesor ? st.soporteCliente : st.soporteAsesor;

      // 3) Reenviar el mensaje con un pequeño prefijo de burbuja
      if (tipo === 'text' && texto) {
        const prefijo = esAsesor ? '👩‍💼' : '🙋‍♀️';
        await this.enviarMensajeTexto(otro, `${prefijo} ${texto}`);
      }

      // 4) No cierres por inactividad mientras soporteActivo sea true
      return;
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


      const entrada = texto
        ?.trim()
        .toLowerCase()
        .normalize('NFD') // separa acentos
        .replace(/[\u0300-\u036f]/g, ''); // elimina acentos


      // 🔚 Si escriben "fin_domi" / "fin domi", pedir confirmación primero
      const finales = ['fin_domi', 'fin-domi', 'fin domi'];
      if (entrada && finales.some(p => entrada.startsWith(p))) {
        // Solo permitir que el domiciliario dispare esto
        const conversacion = await this.conversacionRepo.findOne({ where: { id: estado.conversacionId } });
        if (!conversacion) return;

        const esDomi = numero === conversacion.numero_domiciliario;
        if (!esDomi) {
          await this.enviarMensajeTexto(numero, '⛔ Solo el domiciliario puede finalizar este pedido.');
          return;
        }

        // Mostrar confirmación SÍ/NO
        try {
          await axiosWhatsapp.post('/messages', {
            messaging_product: 'whatsapp',
            to: numero,
            type: 'interactive',
            interactive: {
              type: 'button',
              body: { text: '¿Seguro que deseas finalizar el pedido?' },
              action: {
                buttons: [
                  { type: 'reply', reply: { id: 'confirmar_fin_si', title: '✅ Sí, finalizar' } },
                  { type: 'reply', reply: { id: 'confirmar_fin_no', title: '↩️ No, continuar' } },
                ],
              },
            },
          });
        } catch (e) {
          this.logger.warn(`⚠️ Falló envío de confirmación de fin: ${(e?.response?.data?.error?.message || e?.message || e)}`);
        }
        return;
      }

      // Reenviar el mensaje al otro participante
      // Reenviar el mensaje al otro participante
      if (tipo === 'text' && texto) {
        await this.enviarMensajeTexto(receptor, `💬 ${texto}`);

        // Si el mensaje lo envía el CLIENTE, puedes (si quieres) mostrarle el botón de finalizar al DOMI:
        if (esCliente) {
          try {
            await axiosWhatsapp.post('/messages', {
              messaging_product: 'whatsapp',
              to: receptor, // DOMICILIARIO
              type: 'interactive',
              interactive: {
                type: 'button',
                body: { text: '¿Deseas finalizar el pedido?' },
                action: { buttons: [{ type: 'reply', reply: { id: 'fin_domi', title: '✅ Finalizar' } }] },
              },
            });
          } catch (e) {
            this.logger.warn(
              `⚠️ Falló botón fin_domi a ${receptor}: ` +
              (e?.response?.data?.error?.message || e?.message || e)
            );
          }
        }
        return;
      }

    }

    // const textoLimpio = (texto || '').trim().toLowerCase();


    estado.ultimoMensaje = Date.now();
    this.programarInactividad(numero);

    // ✅ Reiniciar solo si el mensaje es EXACTAMENTE el comando (no frases)
    // ✅ Reiniciar solo si el mensaje es EXACTAMENTE el comando (no frases)
    if (tipo === 'text' && this.esComandoReinicioSolo(texto)) {
      estadoUsuarios.delete(numero);

      if (estado?.conversacionId) {
        await this.conversacionRepo.update(estado.conversacionId, { fecha_fin: new Date(), estado: 'finalizada' });
      }

      // 🚀 Envía la imagen de saludo primero
      const urlImagen = `${urlImagenConstants.urlImg}`;
      const saludo = `🚀 Hola *${String(nombre)}*, ¡Bienvenido al futuro con *DOMICILIOS W*!  

🤖 Ahora nuestra central no es humana, es un ✨ChatBot inteligente que recibe y procesa tus pedidos directamente con tu domiciliario.  

🛵💨 Pide tu servicio ingresando a nuestra *página web*:  
🌐 https://domiciliosw.com`;


      await this.enviarMensajeImagenPorId(numero, urlImagen, saludo);

      // ⏱️ Pequeña pausa para que no se empalmen los mensajes
      await new Promise(resolve => setTimeout(resolve, 500));

      // 🚀 Lista de opciones
      await this.enviarListaOpciones(numero);

      return;
    }


    if (tipo === 'sticker') {
      const sha = mensaje?.sticker?.sha256;
      this.logger.log(`📎 SHA del sticker recibido: ${sha}`);

      // ¿Es un sticker de "pedido rápido"?
      if (this.esStickerRapido(sha)) {
        try {
          // a) Intentamos por número del emisor (comercio escribe desde su línea)
          const numeroLimpio = numero.startsWith('57') ? numero.slice(2) : numero;
          let comercio = await this.comerciosService.findByTelefono(numeroLimpio);

          // b) (Opcional) Si el sticker está mapeado a un comercio concreto (cuando no escribe desde la línea del comercio)
          // if (!comercio && STICKER_TO_COMERCIO_TEL[sha!]) {
          //   const tel = STICKER_TO_COMERCIO_TEL[sha!].replace(/^57/, '');
          //   comercio = await this.comerciosService.findByTelefono(tel);
          // }

          if (!comercio) {
            await this.enviarMensajeTexto(
              numero,
              '🧾 *No encontré tu comercio en nuestro sistema.*\n' +
              'Si deseas afiliarlo para activar pedidos rápidos,\n' +
              'escríbenos al 📞 314 242 3130.'
            );

            // 🔄 Reinicio inmediato del bot (hard reset)
            estadoUsuarios.delete(numero);
            await this.enviarListaOpciones(numero);

            return;
          }

          await this.enviarMensajeTexto(
            numero,
            `🎉 *Sticker oficial detectado* de ${comercio.nombre}.\n` +
            `🧾 Crearé tu pedido y revisaré domiciliario disponible...`
          );

          await this.crearPedidoDesdeSticker(numero, comercio, comercio.nombre);
        } catch (error: any) {
          this.logger.error(`❌ Error flujo sticker-rápido: ${error?.message || error}`);
          await this.enviarMensajeTexto(
            numero,
            '⚠️ Ocurrió un problema creando tu pedido desde el sticker. Intenta nuevamente.'
          );
        }
      } else {
        await this.enviarMensajeTexto(numero, '📎 ¡Gracias por tu sticker!');
      }

      return;
    }




    if (mensaje?.interactive?.type === 'button_reply') {
      const id = mensaje.interactive.button_reply.id;

      if (id === 'menu_cancelar') {
        await this.cancelarPedidoDesdeCliente(numero);
        return;
      }


      // dentro de: if (mensaje?.interactive?.type === 'button_reply') { ... }
      //       if (id === 'fin_domi') {
      //         // 1) Obtener conversación activa desde el emisor del botón
      //         const st = estadoUsuarios.get(numero);
      //         const conversacionId = st?.conversacionId;
      //         if (!conversacionId) {
      //           await this.enviarMensajeTexto(numero, '⚠️ No encontré una conversación activa para finalizar.');
      //           return;
      //         }

      //         const conversacion = await this.conversacionRepo.findOne({ where: { id: conversacionId } });
      //         if (!conversacion) {
      //           await this.enviarMensajeTexto(numero, '⚠️ No se encontró la conversación en el sistema.');
      //           return;
      //         }

      //         const cliente = conversacion.numero_cliente;
      //         const domi = conversacion.numero_domiciliario;

      //         // 2) (Opcional pero recomendable) Solo el DOMICILIARIO puede finalizar
      //         if (numero !== domi) {
      //           await this.enviarMensajeTexto(numero, '⛔ Solo el domiciliario puede finalizar este pedido.');
      //           return;
      //         }

      //         // 3) Mensajes de cierre
      //         //    3.1) Al DOMICILIARIO: texto + BOTONES para fijar disponibilidad
      //         await this.enviarMensajeTexto(
      //           domi,
      //           `✅ *¡SERVICIO FINALIZADO CON ÉXITO!* 🚀
      // Gracias por tu entrega y compromiso 👏

      // 👉 *Ahora elige tu estado:*`
      //         );

      //         try {
      //           await axiosWhatsapp.post('/messages', {
      //             messaging_product: 'whatsapp',
      //             to: domi,
      //             type: 'interactive',
      //             interactive: {
      //               type: 'button',
      //               body: { text: 'Cambia tu disponibilidad:' },
      //               action: {
      //                 buttons: [
      //                   { type: 'reply', reply: { id: 'cambiar_a_disponible', title: '✅ Disponible' } },
      //                   { type: 'reply', reply: { id: 'cambiar_a_no_disponible', title: '🛑 No disponible' } },
      //                   // (Opcional) { type: 'reply', reply: { id: 'mantener_estado', title: '↩️ Mantener' } },
      //                 ],
      //               },
      //             },
      //           });
      //         } catch (e) {
      //           this.logger.warn(
      //             `⚠️ Falló envío de botones de estado a ${domi}: ` +
      //             (e?.response?.data?.error?.message || e?.message || e)
      //           );
      //         }

      //         //    3.2) Al CLIENTE: gracias y cierre
      //         await this.enviarMensajeTexto(
      //           cliente,
      //           `✅ ¡Gracias por confiar en nosotros!
      // Tu pedido ha sido finalizado con éxito.

      // 📲 Para mayor seguridad y confianza en todos nuestros servicios, recuerda escribir siempre al 313 408 9563.
      // Domiciliosw.com`
      //         );

      //         // 4) Marcar la conversación como finalizada
      //         conversacion.estado = 'finalizada';
      //         conversacion.fecha_fin = new Date();
      //         await this.conversacionRepo.save(conversacion);

      //         // 5) Limpiar estados y timers
      //         estadoUsuarios.delete(cliente);
      //         estadoUsuarios.delete(domi);

      //         if (temporizadoresInactividad.has(cliente)) {
      //           clearTimeout(temporizadoresInactividad.get(cliente)!);
      //           temporizadoresInactividad.delete(cliente);
      //         }
      //         if (temporizadoresInactividad.has(domi)) {
      //           clearTimeout(temporizadoresInactividad.get(domi)!);
      //           temporizadoresInactividad.delete(domi);
      //         }

      //         return;
      //       }


      if (/^aceptar_pedido_(\d+)$/.test(id)) {
        const pedidoId = Number(id.match(/^aceptar_pedido_(\d+)$/)?.[1]);
        const pedido = await this.getPedidoById(pedidoId);

        if (!pedido || pedido.estado !== 5) {
          await this.enviarMensajeTexto(numero, '⚠️ El pedido ya no está disponible.');
          return;
        }

        // ✅ Confirmar asignación
        await this.domiciliosService.update(pedidoId, { estado: 1 }); // asignado

        // 🔄 Crear conversación
        const conversacion = this.conversacionRepo.create({
          numero_cliente: pedido.numero_cliente,
          numero_domiciliario: numero,
          fecha_inicio: new Date(),
          estado: 'activa',
        });
        await this.conversacionRepo.save(conversacion);

        estadoUsuarios.set(pedido.numero_cliente, {
          conversacionId: conversacion.id,
          inicioMostrado: true,
        });
        estadoUsuarios.set(numero, {
          conversacionId: conversacion.id,
          tipo: 'conversacion_activa',
          inicioMostrado: true,
        });

        // 🎉 Notificar DOMI
        await this.enviarMensajeTexto(numero, '📦 Pedido *asignado a ti*. Ya puedes hablar con el cliente.');

        // 🧩 Buscar datos del domi para informar bien al cliente
        const domi = await this.domiciliarioService.getByTelefono(numero);
        const nombreDomi = domi ? `${domi.nombre} ${domi.apellido ?? ''}`.trim() : numero;
        const chaqueta = domi?.numero_chaqueta ?? '-';
        const telDomi = numero.startsWith('+') ? numero : `+57${numero.replace(/\D/g, '').slice(-10)}`;

        // 👤 Notificar CLIENTE con toda la info
        await this.enviarMensajeTexto(
          pedido.numero_cliente,
          [
            '✅ ¡Domiciliario asignado!',
            `👤 *${nombreDomi}*`,
            `🧥 Chaqueta: *${chaqueta}*`,
            `📞 Telefono: *${telDomi}*`,
            '',
            '📲 Ya estás conectado con el domicilio. Si tienes alguna duda, *PUEDES ESCRIBIRLE AL DOMICILIARIO DESDE ESTE MISMO CHAT. ✅*'
          ].join('\n')
        );

        await this.enviarBotonFinalizarAlDomi(numero);
        return;
      }


      if (/^rechazar_pedido_(\d+)$/.test(id)) {
        const pedidoId = Number(id.match(/^rechazar_pedido_(\d+)$/)?.[1]);
        const pedido = await this.getPedidoById(pedidoId);
        if (!pedido || pedido.estado !== 5) return;

        // 👇 LIBERAR DOMICILIARIO
        if (pedido.id_domiciliario) {
          try {
            await this.domiciliarioService.liberarDomiciliario(pedido.id_domiciliario);
          } catch (e) {
            this.logger.warn(`No se pudo liberar domi ${pedido.id_domiciliario} tras rechazo: ${e?.message || e}`);
          }
        }

        await this.domiciliosService.update(pedidoId, {
          estado: 0,
          id_domiciliario: null,
          motivo_cancelacion: 'Rechazado por domiciliario',
        });

        await this.enviarMensajeTexto(numero, '❌ Has rechazado el pedido.');


            // Mensaje al domi: pedir disponibilidad
    await this.enviarMensajeTexto(
      numero,
      `✅ *¡SERVICIO FINALIZADO CON ÉXITO!* 🚀
Gracias por tu entrega y compromiso 👏

👉 *Ahora elige tu estado:*`
    );

    try {
      await axiosWhatsapp.post('/messages', {
        messaging_product: 'whatsapp',
        to: numero,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: 'Cambia tu disponibilidad:' },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'cambiar_a_disponible', title: '✅ Disponible' } },
              { type: 'reply', reply: { id: 'cambiar_a_no_disponible', title: '🛑 No disponible' } },
            ],
          },
        },
      });
    } catch (e) {
      this.logger.warn(`⚠️ Falló envío de botones de estado a ${numero}: ${(e?.response?.data?.error?.message || e?.message || e)}`);
    }


        // (Opcional) Avisar al cliente que seguimos buscando
        // await this.enviarMensajeTexto(
        //   pedido.numero_cliente,
        //   '⏳ El domiciliario no tomó la orden. Seguimos buscando otro disponible.'
        // );

        setTimeout(() => this.reintentarAsignacionPendientes(), 2000);
        return;
      }



      if (id === 'fin_domi') {
        const st = estadoUsuarios.get(numero);
        const conversacionId = st?.conversacionId;
        if (!conversacionId) {
          await this.enviarMensajeTexto(numero, '⚠️ No encontré una conversación activa para finalizar.');
          return;
        }

        // Solo el domi puede solicitar finalizar
        const conversacion = await this.conversacionRepo.findOne({ where: { id: conversacionId } });
        if (!conversacion) {
          await this.enviarMensajeTexto(numero, '⚠️ No se encontró la conversación en el sistema.');
          return;
        }
        if (numero !== conversacion.numero_domiciliario) {
          await this.enviarMensajeTexto(numero, '⛔ Solo el domiciliario puede finalizar este pedido.');
          return;
        }

        // ✅ Mostrar confirmación SÍ/NO
        await axiosWhatsapp.post('/messages', {
          messaging_product: 'whatsapp',
          to: numero,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: '¿Seguro que deseas finalizar el pedido?' },
            action: {
              buttons: [
                { type: 'reply', reply: { id: 'confirmar_fin_si', title: '✅ Sí, finalizar' } },
                { type: 'reply', reply: { id: 'confirmar_fin_no', title: '↩️ No, continuar' } },
              ],
            },
          },
        });

        return;
      }



      if (id === 'mantener_estado') {
        const s = estadoUsuarios.get(numero) || {};
        s.awaitingEstado = false;
        s.awaitingEstadoExpiresAt = undefined; // NEW
        estadoUsuarios.set(numero, s);

        if (temporizadoresEstado.has(numero)) { // NEW
          clearTimeout(temporizadoresEstado.get(numero)!);
          temporizadoresEstado.delete(numero);
        }

        await this.enviarMensajeTexto(
          numero,
          '👌 Mantendremos tu estado *sin cambios* y conservas tu turno.'
        );
        return;
      }

      if (id === 'confirmar_fin_si') {
        const st = estadoUsuarios.get(numero);
        const conversacionId = st?.conversacionId;
        if (!conversacionId) {
          await this.enviarMensajeTexto(numero, '⚠️ No encontré una conversación activa para finalizar.');
          return;
        }

        // Verificación de rol (opcional pero recomendado)
        const conversacion = await this.conversacionRepo.findOne({ where: { id: conversacionId } });
        if (!conversacion) {
          await this.enviarMensajeTexto(numero, '⚠️ No se encontró la conversación en el sistema.');
          return;
        }
        if (numero !== conversacion.numero_domiciliario) {
          await this.enviarMensajeTexto(numero, '⛔ Solo el domiciliario puede finalizar este pedido.');
          return;
        }

        const { ok, msg } = await this.finalizarConversacionPorDomi(conversacionId);
        if (!ok) await this.enviarMensajeTexto(numero, `❌ No fue posible finalizar: ${msg || 'Error desconocido'}`);
        return;
      }

      if (id === 'confirmar_fin_no') {
        // Simplemente avisar y continuar el chat
        await this.enviarMensajeTexto(numero, '👍 Entendido. La conversación continúa activa.');
        // (Opcional) volver a mostrar el botón "Finalizar" por comodidad:
        await this.enviarBotonFinalizarAlDomi(numero);
        return;
      }


      if (id === 'cambiar_a_disponible' || id === 'cambiar_a_no_disponible') {
        const disponible = id === 'cambiar_a_disponible';
        try {
          await this.domiciliarioService.cambiarDisponibilidadPorTelefono(numero, disponible);

          const s = estadoUsuarios.get(numero) || {};
          s.awaitingEstado = false;
          s.awaitingEstadoExpiresAt = undefined; // NEW
          estadoUsuarios.set(numero, s);

          if (temporizadoresEstado.has(numero)) { // NEW
            clearTimeout(temporizadoresEstado.get(numero)!);
            temporizadoresEstado.delete(numero);
          }

          await this.enviarMensajeTexto(
            numero,
            `✅ Estado actualizado. Ahora estás como *${disponible ? 'DISPONIBLE' : 'NO DISPONIBLE'}*.`
          );
          await this.enviarMensajeTexto(numero, '👋 Escribeme si necesitas consultar o actualizar tu estado.');
        } catch (error) {
          this.logger.warn(`⚠️ Error al cambiar disponibilidad: ${error?.message || error}`);

          // Libera para permitir reintentar
          const s = estadoUsuarios.get(numero) || {};
          s.awaitingEstado = false;
          s.awaitingEstadoExpiresAt = undefined; // NEW
          estadoUsuarios.set(numero, s);

          if (temporizadoresEstado.has(numero)) {
            clearTimeout(temporizadoresEstado.get(numero)!);
            temporizadoresEstado.delete(numero);
          }

          await this.enviarMensajeTexto(numero, '❌ No se pudo actualizar tu estado.');
        }
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
          // 1) Intentar asignar un domiciliario disponible
          domiciliario = await this.domiciliarioService.asignarDomiciliarioDisponible();

          // Si NO hay domiciliario disponible, creamos pedido PENDIENTE (estado=0) y avisamos
          if (!domiciliario) {
            this.logger.warn('⚠️ No hay domiciliarios disponibles en este momento.');

            // Flag de espera para no romper el flujo
            st.esperandoAsignacion = true;
            st.avisoNoDomiEnviado = Boolean(st.avisoNoDomiEnviado);

            if (!st.avisoNoDomiEnviado) {
              await this.enviarMensajeTexto(numero, '🚨');
              const aviso = [
                '✨ *Aviso importante*',
                'En este momento *NO TENEMOS DOMICILIARIOS DISPONIBLES*',
                '',
                '*Puedes:*',
                '1️⃣ *Esperar* ⏱️ ~10 minutos o menos mientras uno queda libre.',
                '2️⃣ ❌ *Cancelar* el servicio.'
              ].join('\n');
              await this.enviarMensajeTexto(numero, aviso);
              st.avisoNoDomiEnviado = true;
            } else {
              this.logger.debug('ℹ️ Aviso de no disponibilidad ya enviado. Se evita duplicar.');
            }
            estadoUsuarios.set(numero, st);

            // 2) Registrar pedido como PENDIENTE (sin domiciliario)
            const pedidoPendiente = await this.domiciliosService.create({
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

            if (pedidoPendiente?.id) {
              await this.mostrarMenuPostConfirmacion(
                numero,
                pedidoPendiente.id,
                '⏳ Seguimos buscando un domiciliario. Si ya no lo necesitas, puedes cancelar:',
                60 * 1000
              );
            }

            return;
          }

          // 2) Sí hay domi: crear pedido como OFERTADO (estado=5), sin conversación todavía
          const pedidoOfertado = await this.domiciliosService.create({
            mensaje_confirmacion: 'Confirmado por el cliente vía WhatsApp',
            estado: 5, // 👈 OFERTADO (esperando aceptación del domiciliario)
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

          // 3) Enviar botones al DOMI para Aceptar / Rechazar
          const resumenParaDomi = this.generarResumenPedido(datos, tipo, nombre, numero);
          await axiosWhatsapp.post('/messages', {
            messaging_product: 'whatsapp',
            to: domiciliario.telefono_whatsapp,
            type: 'interactive',
            interactive: {
              type: 'button',
              body: { text: `📦 *Nuevo pedido disponible*:\n\n${resumenParaDomi}` },
              action: {
                buttons: [
                  { type: 'reply', reply: { id: `aceptar_pedido_${pedidoOfertado.id}`, title: '✅ Aceptar' } },
                  { type: 'reply', reply: { id: `rechazar_pedido_${pedidoOfertado.id}`, title: '❌ Rechazar' } },
                ],
              },
            },
          });

          // 4) Avisar al cliente que estamos esperando confirmación del domiciliario
          await this.enviarMensajeTexto(
            numero,
            '⏳ Estamos procesando tu domicilio. Gracias por preferirnos.'
          );

          // 5) (Opcional) botón de cancelar para el cliente mientras espera
          if (pedidoOfertado?.id) {
            await this.mostrarMenuPostConfirmacion(
              numero,
              pedidoOfertado.id,
              '⏳ Si ya no lo necesitas, puedes cancelar:',
              60 * 1000
            );
          }

          // 6) TTL: si el domi NO responde en 2 minutos, volver a PENDIENTE (0) y reofertar
          setTimeout(async () => {
            try {
              // 🔹 DENTRO de: setTimeout(async () => { ... }, 120_000)
              const p = await this.getPedidoById(pedidoOfertado.id);
              if (p?.estado === 5) {

                // 👇 LIBERAR DOMICILIARIO SI NO RESPONDIÓ
                if (p.id_domiciliario) {
                  try {
                    await this.domiciliarioService.liberarDomiciliario(p.id_domiciliario);
                  } catch (e) {
                    this.logger.warn(`No se pudo liberar domi ${p.id_domiciliario} tras timeout: ${e?.message || e}`);
                  }
                }

                await this.domiciliosService.update(p.id, {
                  estado: 0,
                  id_domiciliario: null,
                  motivo_cancelacion: 'No respuesta de domiciliario',
                });

                this.logger.warn(`⏰ Domi no respondió. Reofertando pedido id=${p.id}`);
                this.reintentarAsignacionPendientes();
              }

            } catch (e) {
              this.logger.error(`Timeout oferta falló para pedido ${pedidoOfertado.id}: ${e?.message || e}`);
            }
          }, 120_000); // 2 minutos

          return; // ✅ No crees conversación aquí; se crea en aceptar_pedido_*
        } catch (error) {
          // Errores inesperados (distintos a "no hay domis")
          this.logger.warn(`⚠️ Error al ofertar pedido: ${error?.message || error}`);

          // Respaldo: crear PENDIENTE (0) y avisar
          st.esperandoAsignacion = true;
          st.avisoNoDomiEnviado = Boolean(st.avisoNoDomiEnviado);

          if (!st.avisoNoDomiEnviado) {
            await this.enviarMensajeTexto(numero, '🚨');
            const aviso = [
              '✨ *Aviso importante*',
              'En este momento *NO TENEMOS DOMICILIARIOS DISPONIBLES*',
              '',
              '*Puedes:*',
              '1️⃣ *Esperar* ⏱️ ~10 minutos o menos mientras uno queda libre.',
              '2️⃣ ❌ *Cancelar* el servicio.'
            ].join('\n');
            await this.enviarMensajeTexto(numero, aviso);
            st.avisoNoDomiEnviado = true;
          }
          estadoUsuarios.set(numero, st);

          const pedidoPendiente = await this.domiciliosService.create({
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

          if (pedidoPendiente?.id) {
            await this.mostrarMenuPostConfirmacion(
              numero,
              pedidoPendiente.id,
              '⏳ Seguimos buscando un domiciliario. Si ya no lo necesitas, puedes cancelar:',
              60 * 1000
            );
          }

          return;
        }
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

        case 'opcion_5': {
          // Inicia el puente de soporte PSQR (cliente ↔ asesor)
          await this.iniciarSoportePSQR(numero, nombre);
          return;
        }



        default:
          await this.enviarMensajeTexto(numero, '❓ Opción no reconocida.');
          return;
      }
    }


    // ✅ 1. Arrancar conversación con cualquier texto si no hay flujo activo
    const enConversacion = Boolean(estado?.conversacionId);
    const menuBloqueado = bloqueoMenu.has(numero);

    // helper reutilizable
    const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

    // ... dentro de tu bloque:
    if (
      tipo === 'text' &&
      !estado?.inicioMostrado &&
      !this.estaEnCualquierFlujo(numero) && // ⛔ NO mostrar menú si está en flujo
      !menuBloqueado
    ) {
      const saludo = `🚀 Hola ${nombre}, ¡Bienvenido al futuro con *Domicilios W*!  

🤖 Ahora nuestra central no es humana, es un ✨ChatBot inteligente que recibe y procesa tus pedidos directamente con tu domiciliario.  

🛵💨 Pide tu servicio ingresando a nuestra página web:  
🌐 https://domiciliosw.com/`;

      const urlImagen = `${urlImagenConstants.urlImg}`;

      await this.enviarMensajeImagenPorId(numero, urlImagen, saludo);

      // ⏱️ pausa de 300 ms (usa 3000 si quieres ~3 segundos)
      await new Promise(resolve => setTimeout(resolve, 500));


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
            text: `*O selecciona el servicio que deseas:* 👇`,
          },
          // footer: {
          //   text: 'Estamos para servirte 🧡',
          // },
          action: {
            button: 'Pedir servicio 🛵',
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
    case 0: {
      await this.enviarMensajeTexto(
        numero,
        '📝 Por favor, envíame en un *solo mensaje* los datos de *RECOGIDA*:\n' +
        '📍 Dirección de recogida (con detalles: Apto, Piso, etc.)\n' +
        '📞 Teléfono de recogida\n\n'       );
      estado.paso = 1;
      break;
    }

    case 1: {
      if (!mensaje?.trim()) return;

      const { direccion, telefono } = this.extraerDireccionYTelefono(mensaje);

      if (!direccion || direccion.length < 5) {
        await this.enviarMensajeTexto(
          numero,
          '⚠️ No detecté una *dirección de recogida* válida. Por favor envíala *junto con el teléfono* en un solo mensaje.\n' 
                );
        return;
      }
      if (!telefono || !/^\d{7,}$/.test(telefono)) {
        await this.enviarMensajeTexto(
          numero,
          '⚠️ No detecté un *teléfono de recogida* válido (mínimo 7 dígitos). Reenvía *dirección + teléfono* en un solo mensaje.'
        );
        return;
      }

      // Guarda en las claves que usa el creador de pedidos
      estado.datos.direccionRecoger = direccion;
      estado.datos.telefonoRecoger = telefono;

      await this.enviarMensajeTexto(
        numero,
        '📦 Ahora envíame en un *solo mensaje* los datos de *ENTREGA*:\n' +
        '📍 Dirección de entrega (con detalles: Apto, Piso, etc.)\n' +
        '📞 Teléfono de quien recibe\n\n' 
            );
      estado.paso = 2;
      break;
    }

    case 2: {
      if (!mensaje?.trim()) return;

      // Evitar repetición del resumen/botones si ya se envió
      if (estado.confirmacionEnviada) break;

      const { direccion, telefono } = this.extraerDireccionYTelefono(mensaje);

      if (!direccion || direccion.length < 5) {
        await this.enviarMensajeTexto(
          numero,
          '⚠️ No detecté una *dirección de entrega* válida. Envíala *junto con el teléfono* en un solo mensaje.\n' 
                );
        return;
      }
      if (!telefono || !/^\d{7,}$/.test(telefono)) {
        await this.enviarMensajeTexto(
          numero,
          '⚠️ No detecté un *teléfono de entrega* válido (mínimo 7 dígitos). Reenvía *dirección + teléfono* en un solo mensaje.'
        );
        return;
      }

      // Guarda en ambas variantes por compatibilidad con el resto del código
      estado.datos.direccionEntregar = direccion;
      estado.datos.direccionEntrega = direccion;
      estado.datos.telefonoEntregar = telefono;
      estado.datos.telefonoEntrega = telefono;

      const { direccionRecoger, telefonoRecoger, direccionEntregar, telefonoEntregar } = estado.datos;

      await this.enviarMensajeTexto(
        numero,
        '✅ Verifica la información:\n\n' +
        `📍 *Recoger en:* ${direccionRecoger}\n` +
        `📞 *Tel recogida:* ${telefonoRecoger}\n\n` +
        `🏠 *Entregar en:* ${direccionEntregar}\n` +
        `📞 *Tel entrega:* ${telefonoEntregar}`
      );

      await axiosWhatsapp.post('/messages', {
        messaging_product: 'whatsapp',
        to: numero,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: '¿La información es correcta?' },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'confirmar_info', title: '✅ Sí' } },
              { type: 'reply', reply: { id: 'editar_info', title: '🔁 No, editar' } },
            ],
          },
        },
      });

      estado.confirmacionEnviada = true;
      estado.paso = 3;
      break;
    }

    case 3:
      // A la espera del botón (confirmar_info / editar_info)
      break;

    default: {
      await this.enviarMensajeTexto(numero, '❓ No entendí. Vamos a comenzar de nuevo.');
      estadoUsuarios.delete(numero);
      await this.opcion1PasoAPaso(numero, '');
      return;
    }
  }

  estadoUsuarios.set(numero, estado);
}



// 👇 Helper: extrae la ÚLTIMA secuencia de ≥7 dígitos como teléfono y lo demás lo toma como dirección
private extraerDireccionYTelefono(raw: string): { direccion: string | null; telefono: string | null } {
  if (!raw) return { direccion: null, telefono: null };

  const texto = String(raw).trim();

  // busca secuencias de 7+ dígitos (captura móviles 10 dígitos y fijos 7+)
  const matches = texto.match(/\d{7,}/g);
  if (!matches || matches.length === 0) {
    return { direccion: texto, telefono: null };
  }

  const telefono = matches[matches.length - 1]; // tomamos la ÚLTIMA (cliente suele poner el tel al final)
  // quita separadores alrededor del teléfono al removerlo de la dirección
  const direccion = texto
    .replace(telefono, '')
    .replace(/[,\-–—|:/]*\s*$/,'')              // separadores al final
    .replace(/\s*(tel\.?:?)?\s*$/i,'')           // "tel:" al final
    .replace(/\s{2,}/g, ' ')
    .trim();

  return { direccion: direccion || null, telefono };
}

// Versión robusta con las mismas validaciones y tolerante a mensajes “juntos” (lista + dirección/teléfono)
// - Extrae dirección y teléfono con this.extraerDireccionYTelefono(mensaje)
// - Soporta cuando el usuario manda TODO en un solo mensaje (paso 1)
// - En paso 2 también acepta si reenvía lista + entrega otra vez
async opcion2PasoAPaso(numero: string, mensaje: string): Promise<void> {
  const estado = estadoUsuarios.get(numero) || { paso: 0, datos: {}, tipo: 'opcion_2' };

  // Helper para detectar si un texto parece “lista de compras”
  const esLista = (txt: string) => {
    if (!txt) return false;
    const lines = txt.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (lines.length === 0) return false;
    // Heurísticas simples: líneas que empiezan con guion o con cantidad (número)
    const score = lines.reduce((acc, line) => {
      if (/^[-•*]\s*\S+/.test(line)) return acc + 1;
      if (/^\d+(\s|x|un|una|dos|tres|cuatro|cinco)\b/i.test(line)) return acc + 1;
      return acc;
    }, 0);
    return score >= Math.max(1, Math.floor(lines.length * 0.3)); // al menos 30% de líneas parecen items
  };

  // Intenta separar una “lista” del bloque “entrega (dirección+tel)” cuando vienen juntos.
  // Estrategia: si el texto contiene una secuencia de ≥7 dígitos (tel) lo tratamos como que incluye entrega.
  const separarListaYEntrega = (txt: string): { lista?: string; direccion?: string | null; telefono?: string | null } => {
    if (!txt?.trim()) return {};
    const tieneTel = /\d{7,}/.test(txt);
    if (!tieneTel) {
      // No hay teléfono: si parece lista, la devolvemos como lista y sin entrega.
      return { lista: txt.trim(), direccion: null, telefono: null };
    }

    // Si hay teléfono, primero intentamos extraer (dirección+tel) del FINAL del mensaje:
    // Buscamos la ÚLTIMA coincidencia de teléfono y nos quedamos con un “bloque final” que parezca entrega.
    const matchAll = txt.match(/\d{7,}/g);
    const tel = matchAll ? matchAll[matchAll.length - 1] : null;
    if (!tel) return { lista: txt.trim(), direccion: null, telefono: null };

    // Partimos por el último teléfono hacia el final
    const idxTel = txt.lastIndexOf(tel);
    const cabeza = txt.slice(0, idxTel);        // posible lista
    const cola = (txt.slice(idxTel) || '').trim(); // teléfono + (posible dirección alrededor)

    // Reconstruimos “bloque entrega” reinsertando el tel y tomando un poco de contexto antes del tel
    const contextoAntes = cabeza.slice(Math.max(0, cabeza.length - 100)); // últimos 100 chars de “cabeza”
    const candidatoEntrega = `${contextoAntes} ${cola}`.trim();

    // Intentamos extraer dirección+tel del candidato
    const { direccion, telefono } = this.extraerDireccionYTelefono(candidatoEntrega);

    // Si logramos extraer una dirección decente, consideramos el resto (cabeza sin el contexto) como lista
    if (direccion && direccion.length >= 5 && telefono && /^\d{7,}$/.test(telefono)) {
      const listaPosible = cabeza.slice(0, Math.max(0, cabeza.length - contextoAntes.length)).trim();
      const listaFinal = esLista(listaPosible) ? listaPosible : txt.trim(); // fallback: todo como lista si no pasa heurística
      return { lista: listaFinal, direccion, telefono };
    }

    // Si no se pudo separar, lo tratamos como lista solamente
    return { lista: txt.trim(), direccion: null, telefono: null };
  };

  switch (estado.paso) {
    case 0: {
      await this.enviarMensajeTexto(
        numero,
        '🛍️ Por favor, envíame tu *lista completa de compras* en un solo mensaje.\n\n' +
        '👉 Incluye *cantidad* y *producto* por línea.\n' +
        '✅ Ejemplo:\n' +
        '- 2 Panes integrales\n' +
        '- 1 Arroz x 500g\n' +
        '- 3 Jugos de naranja\n\n'      );
      estado.paso = 1;
      break;
    }

    case 1: {
      if (!mensaje?.trim()) return;

      // Tolerar que el cliente mande *lista + entrega* en un solo mensaje
      const { lista, direccion, telefono } = separarListaYEntrega(mensaje);

      // Guardamos la lista si existe y pasa heurística; si no, guardamos “tal cual”
      const listaOk = lista && esLista(lista);
      estado.datos.listaCompras = listaOk ? lista!.trim() : mensaje.trim(); // fallback: todo el mensaje

      if (direccion && direccion.length >= 5 && telefono && /^\d{7,}$/.test(telefono)) {
        // Ya vino con datos de entrega: guardamos y saltamos directo a confirmación
        estado.datos.direccionEntrega = direccion;
        estado.datos.direccionEntregar = direccion; // compat
        estado.datos.telefonoEntrega = telefono;
        estado.datos.telefonoEntregar = telefono;   // compat

        if (!estado.confirmacionEnviada) {
          const { listaCompras, direccionEntrega, telefonoEntrega } = estado.datos;
          await this.enviarMensajeTexto(
            numero,
            `🧾 Esta es la compra que solicitaste:\n\n` +
            `📦 *Lista de compras:*\n${listaCompras}\n\n` +
            `📍 *Dirección de entrega:*\n${direccionEntrega}\n` +
            `📞 *Teléfono quien recibe:*\n${telefonoEntrega}`
          );

          await axiosWhatsapp.post('/messages', {
            messaging_product: 'whatsapp',
            to: numero,
            type: 'interactive',
            interactive: {
              type: 'button',
              body: { text: '¿La información es correcta?' },
              action: {
                buttons: [
                  { type: 'reply', reply: { id: 'confirmar_compra', title: '✅ Sí' } },
                  { type: 'reply', reply: { id: 'editar_compra', title: '🔁 No, editar' } },
                ],
              },
            },
          });

          estado.confirmacionEnviada = true;
          estado.paso = 3;
          break;
        }

        // Si por alguna razón ya estaba enviada, no repetir
        break;
      }

      // Si NO vino entrega aún, pedimos dirección + teléfono en un solo mensaje
      await this.enviarMensajeTexto(
        numero,
        '📦 Ahora envíame *en un solo mensaje* la *dirección de entrega* y el *teléfono de quien recibe*.\n\n' +
        '✍️ Escríbelo así (un solo texto):\n' +
        '📍 Dirección, detalle / Apto / Piso - 📞 Teléfono 313*******\n\n' 
      );
      estado.paso = 2;
      break;
    }

    case 2: {
      if (!mensaje?.trim()) return;

      // Evitar repetición del resumen y botones
      if (estado.confirmacionEnviada) break;

      // Tolerar que aquí el usuario reenvíe *lista + entrega* otra vez
      const { lista, direccion, telefono } = separarListaYEntrega(mensaje);

      // Si detectamos una lista y todavía no hay lista guardada, aprovechamos
      if (lista && esLista(lista) && !estado.datos.listaCompras) {
        estado.datos.listaCompras = lista.trim();
      }

      // Validamos dirección/teléfono
      if (!direccion || direccion.length < 5) {
        await this.enviarMensajeTexto(
          numero,
          '⚠️ No logré detectar una *dirección* válida. Por favor envíame *dirección y teléfono juntos en un solo mensaje*.\n\n' 
                );
        return;
      }

      if (!telefono || !/^\d{7,}$/.test(telefono)) {
        await this.enviarMensajeTexto(
          numero,
          '⚠️ No logré detectar un *teléfono* válido (mínimo 7 dígitos). ' +
          'Por favor reenvía *dirección y teléfono juntos en un solo mensaje*.\n\n' 
                );
        return;
      }

      // Guardamos ya separados (incluye claves de compatibilidad)
      estado.datos.direccionEntrega = direccion;
      estado.datos.direccionEntregar = direccion;
      estado.datos.telefonoEntrega = telefono;
      estado.datos.telefonoEntregar = telefono;

      const { listaCompras, direccionEntrega, telefonoEntrega } = estado.datos;

      await this.enviarMensajeTexto(
        numero,
        `🧾 Esta es la compra que solicitaste:\n\n` +
        `📦 *Lista de compras:*\n${listaCompras}\n\n` +
        `📍 *Dirección de entrega:*\n${direccionEntrega}\n` +
        `📞 *Teléfono quien recibe:*\n${telefonoEntrega}`
      );

      await axiosWhatsapp.post('/messages', {
        messaging_product: 'whatsapp',
        to: numero,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: '¿La información es correcta?' },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'confirmar_compra', title: '✅ Sí' } },
              { type: 'reply', reply: { id: 'editar_compra', title: '🔁 No, editar' } },
            ],
          },
        },
      });

      estado.confirmacionEnviada = true;
      estado.paso = 3;
      break;
    }

    case 3:
      // Esperamos respuesta de los botones (confirmar_compra / editar_compra)
      break;

    default: {
      await this.enviarMensajeTexto(numero, '❗ Algo salió mal. Reiniciamos el proceso.');
      estadoUsuarios.delete(numero);
      await this.opcion2PasoAPaso(numero, '');
      return;
    }
  }

  estadoUsuarios.set(numero, estado); // Guardar cambios en memoria
}




// Versión robusta y tolerante a mensajes “juntos” / reenvíos.
// - Usa this.extraerDireccionYTelefono(mensaje) para separar dirección y teléfono.
// - Acepta que el usuario reenvíe la info completa estando en paso 2 (actualiza y re-confirma sin duplicar).
// - Evita repetir el resumen/botones con estado.confirmacionEnviada.
// - Guarda claves de compatibilidad si aplica.
async opcion3PasoAPaso(numero: string, mensaje: string): Promise<void> {
  const estado = estadoUsuarios.get(numero) || { paso: 0, datos: {}, tipo: 'opcion_3' };

  switch (estado.paso) {
    case 0: {
      await this.enviarMensajeTexto(
        numero,
        '💰 Para realizar un pago, primero debemos *recoger el dinero*.\n\n' +
        '📍 Envíame *en un solo mensaje* la *dirección de recogida* y el *teléfono* de contacto.\n\n' 
            );
      estado.paso = 1;
      break;
    }

    case 1: {
      if (!mensaje?.trim()) return;

      const { direccion, telefono } = this.extraerDireccionYTelefono(mensaje);

      // Validación de dirección
      if (!direccion || direccion.length < 5) {
        await this.enviarMensajeTexto(
          numero,
          '⚠️ No logré detectar una *dirección válida*.\n' +
          'Por favor envíame *dirección y teléfono juntos en un solo mensaje*.\n\n' 
                );
        return;
      }

      // Validación de teléfono (mínimo 7 dígitos; acepta fijos y móviles)
      if (!telefono || !/^\d{7,}$/.test(telefono)) {
        await this.enviarMensajeTexto(
          numero,
          '⚠️ No logré detectar un *teléfono válido* (mínimo 7 dígitos).\n' +
          'Reenvía *dirección y teléfono juntos en un solo mensaje*.'
        );
        return;
      }

      // Guardado (incluye claves de compatibilidad usadas en otras partes del flujo)
      estado.datos.direccionRecoger = direccion;
      estado.datos.telefonoRecoger  = telefono;

      // Evitar repetición de confirmación si ya fue enviada
      if (estado.confirmacionEnviada) break;

      await this.enviarMensajeTexto(
        numero,
        `✅ Esta es la información que me diste:\n\n` +
        `📍 *Dirección de recogida:* ${estado.datos.direccionRecoger}\n` +
        `📞 *Teléfono:* ${estado.datos.telefonoRecoger}`
      );

      await axiosWhatsapp.post('/messages', {
        messaging_product: 'whatsapp',
        to: numero,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: '¿La información es correcta?' },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'confirmar_compra', title: '✅ Sí' } },
              { type: 'reply', reply: { id: 'editar_compra',    title: '🔁 No, editar' } },
            ],
          },
        },
      });

      estado.confirmacionEnviada = true;
      estado.paso = 2;
      break;
    }

    case 2: {
      // Aquí esperamos los botones, pero si el usuario reenvía la dirección+tel,
      // actualizamos y re-mostramos la confirmación (sin duplicar).
      if (!mensaje?.trim()) break;

      const { direccion, telefono } = this.extraerDireccionYTelefono(mensaje);

      // Si el mensaje contiene una dirección+tel válidos, lo tomamos como corrección
      if (direccion && direccion.length >= 5 && telefono && /^\d{7,}$/.test(telefono)) {
        estado.datos.direccionRecoger = direccion;
        estado.datos.telefonoRecoger  = telefono;

        await this.enviarMensajeTexto(
          numero,
          `✍️ *Actualicé* la información de recogida:\n\n` +
          `📍 *Dirección de recogida:* ${estado.datos.direccionRecoger}\n` +
          `📞 *Teléfono:* ${estado.datos.telefonoRecoger}`
        );

        // Reenviamos botones sin volver a marcar confirmacionEnviada (ya estaba true)
        await axiosWhatsapp.post('/messages', {
          messaging_product: 'whatsapp',
          to: numero,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: '¿La información es correcta ahora?' },
            action: {
              buttons: [
                { type: 'reply', reply: { id: 'confirmar_compra', title: '✅ Sí' } },
                { type: 'reply', reply: { id: 'editar_compra',    title: '🔁 No, editar' } },
              ],
            },
          },
        });
      }
      // Si no trae una dirección/teléfono válidos, simplemente ignoramos y seguimos esperando los botones
      break;
    }

    default: {
      await this.enviarMensajeTexto(numero, '❌ Algo salió mal. Empecemos de nuevo.');
      estadoUsuarios.delete(numero);
      await this.opcion3PasoAPaso(numero, '');
      return;
    }
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


  private async mostrarMenuPostConfirmacion(
    numero: string,
    pedidoId: number,
    bodyText = '¿Qué deseas hacer ahora?',
    ttlMs = 60 * 1000,
  ) {
    // ⛔ si no es cancelable, no muestres el botón
    if (!(await this.puedeCancelarPedido(pedidoId))) {
      this.logger.log(`⏭️ Botón cancelar omitido: pedido ${pedidoId} no es cancelable.`);
      return;
    }

    if (bloqueoMenu.has(numero)) return;

    const st = estadoUsuarios.get(numero) || {};
    st.pedidoId = pedidoId;
    estadoUsuarios.set(numero, st);

    await axiosWhatsapp.post('/messages', {
      messaging_product: 'whatsapp',
      to: numero,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'menu_cancelar', title: '❌ Cancelar pedido' } },
          ],
        },
      },
    });

    const t = setTimeout(() => bloqueoMenu.delete(numero), ttlMs);
    bloqueoMenu.set(numero, t);
  }


  // 👇 Pon esto una sola vez en tu clase (o como métodos privados)
  private clearTimer(map: Map<string, NodeJS.Timeout>, key: string) {
    if (map.has(key)) {
      clearTimeout(map.get(key)!);
      map.delete(key);
    }
  }

  private async notificarYFinalizarConversacionDe(numeroCliente: string) {
    const st = estadoUsuarios.get(numeroCliente);
    const conversacionId = st?.conversacionId;

    if (!conversacionId) return;

    // Traemos la conversación para avisar al domi si existiera
    const conversacion = await this.conversacionRepo.findOne({ where: { id: conversacionId } }).catch(() => null);

    // Marcamos como finalizada en BD
    await this.conversacionRepo.update(conversacionId, { estado: 'finalizada', fecha_fin: new Date() }).catch(() => { });

    // Aviso opcional al domiciliario (si había chat)
    const telDomi = conversacion?.numero_domiciliario;
    if (telDomi) {
      await this.enviarMensajeTexto(
        telDomi,
        '❌ El cliente *canceló* el pedido. Esta conversación ha sido cerrada.'
      );
    }

    // Limpieza de memoria y timers de ambos participantes
    estadoUsuarios.delete(numeroCliente);
    if (telDomi) estadoUsuarios.delete(telDomi);

    this.clearTimer(temporizadoresInactividad, numeroCliente);
    if (telDomi) this.clearTimer(temporizadoresInactividad, telDomi);

    this.clearTimer(temporizadoresEstado, numeroCliente);
    if (telDomi) this.clearTimer(temporizadoresEstado, telDomi);

    this.clearTimer(bloqueoMenu, numeroCliente);
  }



  private async cancelarPedidoDesdeCliente(numero: string): Promise<void> {
    try {
      const st = estadoUsuarios.get(numero) || {};
      const pedidoId: number | undefined = st.pedidoId;
      if (!pedidoId) return;

      const pedido = await this.getPedidoById(pedidoId);
      if (!pedido) {
        await this.enviarMensajeTexto(numero, '⚠️ No pude encontrar tu pedido. Intenta nuevamente.');
        return;
      }

      // 🛡️ Solo permitir cancelar si sigue PENDIENTE (estado=0)
      if (!(await this.puedeCancelarPedido(pedidoId))) {
        await this.enviarMensajeTexto(
          numero,
          '🔒 Este pedido ya fue confirmado con el domiciliario y no se puede cancelar por este medio.\n' +
          'Si necesitas ayuda, escríbenos por soporte.'
        );
        return;
      }

      // (Opcional defensivo) si por alguna razón ese pedido tuviera domi asignado, liberarlo
      const domiId = pedido.id_domiciliario;
      if (domiId) {
        try {
          await this.domiciliarioService.liberarDomiciliario(domiId);
        } catch (e) {
          this.logger.warn(`No se pudo liberar domi ${domiId} al cancelar: ${e instanceof Error ? e.message : e}`);
        }
      }

      // ✅ Cancelación en BD
      await this.domiciliosService.update(pedidoId, {
        estado: 2, // cancelado
        motivo_cancelacion: 'Cancelado por el cliente vía WhatsApp',
      });

      // 🧹 Cerrar ventana/puente de conversación si existiera y limpiar todo rastro de flujo
      await this.notificarYFinalizarConversacionDe(numero);

      // 🔄 Limpieza total de estado del cliente para que aparezca el saludo la próxima vez
      // (notificarYFinalizarConversacionDe ya hace un delete, pero repetimos por si no había conversación)
      estadoUsuarios.delete(numero);
      this.clearTimer(temporizadoresInactividad, numero);
      this.clearTimer(temporizadoresEstado, numero);
      this.clearTimer(bloqueoMenu, numero);

      // (Si tenías flags sueltos en memoria, asegúrate de no recrearlos)
      // No volvemos a setear nada en estadoUsuarios: queda "en frío"

      // 📣 Mensaje de confirmación al cliente
      await this.enviarMensajeTexto(
        numero,
        `🧡 Tu pedido ha sido cancelado. ¡Gracias por confiar en Domiciliosw.com!

Para no dejarte sin servicio, te compartimos opciones adicionales:
📞 3144403062 – Veloz
📞 3137057041 – Rapigo
📞 3142423130 – Enviosw

🚀 Así podrás realizar tu envío de manera rápida y segura.`
      );

      // ✅ Listo: al estar sin estado en memoria, cuando el usuario escriba de nuevo
      // se activará tu bloque de saludo inicial y menú.

    } catch (err: any) {
      this.logger.error(`❌ Error cancelando pedido: ${err?.message || err}`);
      await this.enviarMensajeTexto(numero, '⚠️ Ocurrió un problema al cancelar. Intenta nuevamente en unos segundos.');
    }
  }



  // Lee un pedido por id (compat con tus métodos actuales)
  private async getPedidoById(pedidoId: number) {
    return (await (this.domiciliosService as any).findOne?.(pedidoId))
      ?? (await this.domiciliosService.find({ where: { id: pedidoId }, take: 1 }))?.[0];
  }

  // ¿Sigue pendiente (estado 0)?
  private async estaPendiente(pedidoId: number): Promise<boolean> {
    const p = await this.getPedidoById(pedidoId);
    return !!p && p.estado === 0;
  }

  // Enviar mensaje solo si el pedido sigue pendiente (evita spam tras cancelación)
  private async enviarSiPendiente(pedidoId: number, numero: string, mensaje: string) {
    if (!(await this.estaPendiente(pedidoId))) {
      this.logger.log(`⏭️ Skip msg: pedido ${pedidoId} ya no está pendiente.`);
      return;
    }
    await this.enviarMensajeTexto(numero, mensaje);
  }



  // ✅ True si el mensaje arranca con "pedido desde" (tolerante a *PEDIDO* y espacios)
  private empiezaConPedidoDesde(raw: string): boolean {
    if (!raw) return false;
    // Conservar "raw" para guardar tal cual; aquí sólo normalizamos para detectar prefijo
    const t = raw
      .trim()
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // sin acentos

    // Quita asteriscos/líderes tipo "***" y espacios antes de la palabra
    const sinAsteriscos = t.replace(/^[^a-z0-9]+/g, ''); // descarta símbolos al inicio

    // Acepta "*pedido* desde", "pedido desde", etc.
    return /^\*?\s*pedido\*?\s+desde\b/.test(sinAsteriscos);
  }


  // 🚀 Crea el pedido con el TEXTO BRUTO en detalles_pedido y, si hay domi, crea la ventana cliente↔domi
  private async procesarAutoPedidoDesde(numeroWhatsApp: string, textoOriginal: string, nombreContacto: string) {
    const normalizar = (n: string) => {
      const digits = (n || '').replace(/\D/g, '');
      return digits.length === 10 ? `57${digits}` : digits;
    };

    let domiciliario: Domiciliario | null = null;
    try {
      domiciliario = await this.domiciliarioService.asignarDomiciliarioDisponible();
    } catch {
      domiciliario = null;
    }

    const estado = domiciliario ? 5 : 0;  // 5 si hay a quién ofertar

    const telClienteNorm = normalizar(numeroWhatsApp);
    const telDomiNorm = domiciliario ? normalizar(domiciliario.telefono_whatsapp) : null;

    const pedidoCreado = await this.domiciliosService.create({
      mensaje_confirmacion: 'Auto-ingreso (pedido desde)',
      estado,
      numero_cliente: telClienteNorm,
      fecha: new Date().toISOString(),
      hora: new Date().toTimeString().slice(0, 5),
      id_cliente: null,
      id_domiciliario: domiciliario?.id ?? null,
      tipo_servicio: 'auto',
      origen_direccion: '',
      destino_direccion: '',
      telefono_contacto_origen: '',
      telefono_contacto_destino: '',
      notas: '',
      detalles_pedido: textoOriginal, // TEXTO COMPLETO, TAL CUAL
      foto_entrega_url: '',
    });

    if (domiciliario && telDomiNorm) {
      // Crear conversación (ventana) y conectar ambos lados
      const conversacion = this.conversacionRepo.create({
        numero_cliente: telClienteNorm,
        numero_domiciliario: telDomiNorm,
        fecha_inicio: new Date(),
        estado: 'activa',
      });
      await this.conversacionRepo.save(conversacion);

      estadoUsuarios.set(telClienteNorm, {
        ...(estadoUsuarios.get(telClienteNorm) || {}),
        conversacionId: conversacion.id,
        inicioMostrado: true,
      });
      estadoUsuarios.set(telDomiNorm, {
        conversacionId: conversacion.id,
        tipo: 'conversacion_activa',
        inicioMostrado: true,
      });

      const resumen = this.generarResumenPedidoDesdePedido(pedidoCreado);

      // 👉 Cliente: SOLO info básica del domiciliario (sin resumen)
      await this.enviarMensajeTexto(
        telClienteNorm,
        `✅ ¡Pedido asignado!\n\n` +
        `👤 *${domiciliario.nombre} ${domiciliario.apellido}*\n` +
        `🧥 Chaqueta: *${domiciliario.numero_chaqueta}*\n` +
        `📞 Telefono: *${telDomiNorm}*\n\n` +
        `💬 Ya estás conectado con el domicilario. Escribele desde aquí mismo.`
      );

      // 👉 Domiciliario: TODA la información + resumen completo
      await this.enviarMensajeTexto(
        telDomiNorm,
        `📦 *Nuevo pedido asignado*\n\n${resumen}\n\n` +
        `👤 Cliente: *${nombreContacto || 'Cliente'}*\n` +
        `📞 Telefono: ${telClienteNorm}\n\n` +
        `✅ Ya estás conectado con el cliente. Responde aquí mismo.`
      );
      await this.enviarBotonFinalizarAlDomi(telDomiNorm!);


      // No mostramos menú porque ya hay conversación activa
      return;
    }

    // Sin domiciliarios disponibles: queda pendiente
    await this.enviarMensajeTexto(telClienteNorm, '🚨');
    await this.enviarMensajeTexto(
      telClienteNorm,
      [
        '✨ *Aviso importante*',
        'En este momento *NO TENEMOS DOMICILIARIOS DISPONIBLES*',
        '',
        '1️⃣ Puedes *esperar* ⏱️ ~10 minutos o menos.',
        '2️⃣ O *cancelar* el servicio.',
      ].join('\n')
    );

    if (pedidoCreado?.id) {
      await this.mostrarMenuPostConfirmacion(
        telClienteNorm,
        pedidoCreado.id,
        '⏳ Seguimos buscando un domiciliario. Si ya no lo necesitas, puedes cancelar:'
      );
    }

    const st = estadoUsuarios.get(telClienteNorm) || {};
    st.esperandoAsignacion = true;
    estadoUsuarios.set(telClienteNorm, st);
  }


  // ✅ Solo permitimos cancelar si el pedido sigue PENDIENTE (estado=0)
  private async puedeCancelarPedido(pedidoId: number): Promise<boolean> {
    const pedido = await this.getPedidoById(pedidoId);
    if (!pedido) return false;
    return pedido.estado === 0; // 0 = pendiente (sin domiciliario confirmado)
  }

  private programarInactividad(numero: string) {
    // limpia previo
    if (temporizadoresInactividad.has(numero)) {
      clearTimeout(temporizadoresInactividad.get(numero)!);
    }

    const t = setTimeout(() => {
      this.reiniciarPorInactividad(numero);
    }, 25 * 60 * 1000); // 10 minutos

    temporizadoresInactividad.set(numero, t);
  }


  // 🚀 Crea un pedido a partir del sticker oficial del COMERCIO
  private async crearPedidoDesdeSticker(numeroWhatsApp: string, comercio: any, nombreContacto?: string) {
    // Normaliza números a formato 57XXXXXXXXXX (como ya haces en otros lados)
    const normalizar = (n: string) => {
      const digits = (n || '').replace(/\D/g, '');
      return digits.length === 10 ? `57${digits}` : digits;
    };

    const telClienteNorm = normalizar(numeroWhatsApp); // el que envió el sticker (comercio)
    let domiciliario: Domiciliario | null = null;

    try {
      domiciliario = await this.domiciliarioService.asignarDomiciliarioDisponible();
    } catch {
      domiciliario = null;
    }

    const estado = domiciliario ? 1 : 0;
    const telDomiNorm = domiciliario ? normalizar(domiciliario.telefono_whatsapp) : null;

    // 🧾 Define los datos base del pedido creado por sticker oficial
    const detalles = `Pedido creado por *sticker oficial* del comercio:\n` +
      `🏪 ${comercio?.nombre || '-'}\n` +
      `📞 ${comercio?.telefono || '-'}\n` +
      `📌 ${comercio?.direccion || '-'}`;

    // 👉 Puedes mapear la dirección del comercio como origen (si aplica)
    const origenDireccion = comercio?.direccion ?? '';
    const telOrigen = comercio?.telefono ?? '';

    // Crea el registro del pedido
    const pedidoCreado = await this.domiciliosService.create({
      mensaje_confirmacion: 'Auto-ingreso (sticker oficial comercio)',
      estado, // 1 asignado / 0 pendiente
      numero_cliente: telClienteNorm,
      fecha: new Date().toISOString(),
      hora: new Date().toTimeString().slice(0, 5),
      id_cliente: null,
      id_domiciliario: domiciliario?.id ?? null,
      tipo_servicio: 'sticker',          // etiqueta de origen
      origen_direccion: origenDireccion, // opcional
      destino_direccion: '',             // si quieres, luego lo pide el domi por chat
      telefono_contacto_origen: telOrigen,
      telefono_contacto_destino: '',
      notas: '',
      detalles_pedido: detalles,
      foto_entrega_url: '',
    });

    // Si se asignó domiciliario, creamos conversación y notificamos a ambos
    if (domiciliario && telDomiNorm) {
      const conversacion = this.conversacionRepo.create({
        numero_cliente: telClienteNorm,
        numero_domiciliario: telDomiNorm,
        fecha_inicio: new Date(),
        estado: 'activa',
      });
      await this.conversacionRepo.save(conversacion);

      // Conectar en memoria
      estadoUsuarios.set(telClienteNorm, {
        ...(estadoUsuarios.get(telClienteNorm) || {}),
        conversacionId: conversacion.id,
        inicioMostrado: true,
      });
      estadoUsuarios.set(telDomiNorm, {
        conversacionId: conversacion.id,
        tipo: 'conversacion_activa',
        inicioMostrado: true,
      });


      // Cliente (comercio)
      await this.enviarMensajeTexto(
        telClienteNorm,
        `✅ ¡Pedido creado y asignado!\n\n` +
        `👤 *${String(domiciliario.nombre)}* *${String(domiciliario.apellido)}*\n` +
        `🧥 Chaqueta: *${domiciliario.numero_chaqueta}*\n` +
        `📞 Telefono: *${telDomiNorm}*\n\n` +
        `💬 Ya puedes coordinar con el domiciliario por aquí.`
      );

      // Domiciliario
      await this.enviarMensajeTexto(
        telDomiNorm,
        `📦 *Nuevo pedido` +
        `👤 Comercio: *${String(comercio?.nombre) || String(nombreContacto) || ''}*\n` +
        `📍 Dirección: ${comercio?.direccion ?? ''}\n\n` +
        `📞 Telefono: ${telClienteNorm}\n\n` +
        `✅ Ya estás conectado con el cliente.`
      );

      await this.enviarBotonFinalizarAlDomi(telDomiNorm!);

      return; // no mostrar menú, ya hay conversación
    }

    // Si no hubo domiciliarios: queda PENDIENTE y notificamos
    await this.enviarMensajeTexto(telClienteNorm, '🚨');
    await this.enviarMensajeTexto(
      telClienteNorm,
      [
        '✨ *Aviso importante*',
        'En este momento *NO TENEMOS DOMICILIARIOS DISPONIBLES*',
        '',
        '1️⃣ Puedes *esperar* ⏱️ ~10 minutos o menos.',
        '2️⃣ O *cancelar* el servicio.',
      ].join('\n')
    );

    if (pedidoCreado?.id) {
      await this.mostrarMenuPostConfirmacion(
        telClienteNorm,
        pedidoCreado.id,
        '⏳ Seguimos buscando un domiciliario. Si ya no lo necesitas, puedes cancelar:'
      );
    }

    const st = estadoUsuarios.get(telClienteNorm) || {};
    st.esperandoAsignacion = true;
    estadoUsuarios.set(telClienteNorm, st);
  }


  // Normaliza: quita espacios extra, pasa a minúsculas y elimina acentos
  private normalizarBasico(s: string): string {
    return (s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // quita acentos
      .replace(/\s+/g, ' ');            // colapsa espacios
  }

  // Devuelve true solo si el texto es EXACTAMENTE uno de los comandos
  private esComandoReinicioSolo(raw: string): boolean {
    const t = this.normalizarBasico(raw);
    // OJO: si quieres aceptar "hola!" o "hola." como reinicio, cambia aquí por .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'')
    const comandos = new Set([
      'hola',
      'menu',
      'inicio',
      'empezar',
      'buenas',
      'buenos dias',
      'buenas tardes',
      'buenas noches',
    ]);
    return comandos.has(t);
  }


  private async enviarBotonFinalizarAlDomi(to: string) {
    try {
      await axiosWhatsapp.post('/messages', {
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: '¿Deseas finalizar el pedido?' },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'fin_domi', title: '✅ Finalizar' } },
            ],
          },
        },
      });
    } catch (e) {
      this.logger.warn(
        `⚠️ Falló envío de botón fin_domi a ${to}: ` +
        (e?.response?.data?.error?.message || e?.message || e)
      );
    }
  }


  private async enviarMensajeImagenPorId(
    numero: string,
    mediaId: string,
    caption: string
  ): Promise<void> {
    try {
      await axiosWhatsapp.post('/messages', {
        messaging_product: 'whatsapp',
        to: numero,
        type: 'image',
        image: { id: mediaId, caption },
      });
      this.logger.log(`✅ Imagen enviada a ${numero}`);
    } catch (error) {
      this.logger.error('❌ Error al enviar imagen:', error.response?.data || error.message);
      // fallback para no perder el saludo
      await this.enviarMensajeTexto(numero, caption);
    }
  }



  private async finalizarConversacionPorDomi(conversacionId: number) {
    const conversacion = await this.conversacionRepo.findOne({ where: { id: String(conversacionId) } });
    if (!conversacion) return { ok: false, msg: 'No se encontró la conversación' };

    const cliente = conversacion.numero_cliente;
    const domi = conversacion.numero_domiciliario;

    // Mensaje al domi: pedir disponibilidad
    await this.enviarMensajeTexto(
      domi,
      `✅ *¡SERVICIO FINALIZADO CON ÉXITO!* 🚀
Gracias por tu entrega y compromiso 👏

👉 *Ahora elige tu estado:*`
    );

    try {
      await axiosWhatsapp.post('/messages', {
        messaging_product: 'whatsapp',
        to: domi,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: 'Cambia tu disponibilidad:' },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'cambiar_a_disponible', title: '✅ Disponible' } },
              { type: 'reply', reply: { id: 'cambiar_a_no_disponible', title: '🛑 No disponible' } },
            ],
          },
        },
      });
    } catch (e) {
      this.logger.warn(`⚠️ Falló envío de botones de estado a ${domi}: ${(e?.response?.data?.error?.message || e?.message || e)}`);
    }

    // Mensaje al cliente (nuevo)
    const mensajeCliente = [
      '✅ Gracias por confiar en nuestro servicio',
      'TU PEDIDO HA SIDO FINALIZADO CON ÉXITO.',
      '',
      '📲 Para mayor seguridad y transparencia escríbenos siempre al',
      '313 408 9563',
      'domiciliosw.com',
      '',
      '',
      '📞 Quejas, reclamos y afiliaciones: 314 242 3130 – Wilber Álvarez'
    ].join('\n');

    await this.enviarMensajeTexto(cliente, mensajeCliente);


    // Persistencia
    conversacion.estado = 'finalizada';
    conversacion.fecha_fin = new Date();
    await this.conversacionRepo.save(conversacion);

    // Limpieza de memoria/timers
    estadoUsuarios.delete(cliente);
    estadoUsuarios.delete(domi);

    if (temporizadoresInactividad.has(cliente)) {
      clearTimeout(temporizadoresInactividad.get(cliente)!);
      temporizadoresInactividad.delete(cliente);
    }
    if (temporizadoresInactividad.has(domi)) {
      clearTimeout(temporizadoresInactividad.get(domi)!);
      temporizadoresInactividad.delete(domi);
    }

    return { ok: true };
  }


  // ⚙️ Crear/activar puente de soporte con asesor PSQR
  private async iniciarSoportePSQR(numeroCliente: string, nombreCliente?: string) {
    // 1) Saludo bonito al cliente
    const msgCliente = [
      '🛟 *Soporte DomiciliosW (PSQR)*',
      '✅ Ya un asesor de *DomiciliosW* está en contacto contigo.',
      '',
      '👩‍💼 *Asesor asignado:*',
      `📞 ${ASESOR_PSQR}`,
      '',
      '✍️ Escribe tu caso aquí. Te responderemos en este mismo chat.',
      '❌ Escribe *salir* para terminar la conversación.'

    ].join('\n');

    await this.enviarMensajeTexto(numeroCliente, msgCliente);

    // 2) Aviso al asesor con datos del cliente
    const msgAsesor = [
      '🛎️ *NUEVO CONTACTO PSQR*',
      `👤 Cliente: ${nombreCliente || 'Cliente'}`,
      `📱 Telefono: ${numeroCliente}`,
      '',
      '💬 Responde aquí para iniciar el chat.',
      '🧷 Escribe *salir* cuando cierres el caso.',
    ].join('\n');

    await this.enviarMensajeTexto(ASESOR_PSQR, msgAsesor);

    // 3) Registra el "puente" en memoria para rutear mensajes
    const convId = `psqr-${Date.now()}-${numeroCliente}`; // id lógico para el puente
    const stCliente = estadoUsuarios.get(numeroCliente) || {};
    stCliente.soporteActivo = true;
    stCliente.soporteConversacionId = convId;
    stCliente.soporteAsesor = ASESOR_PSQR;
    estadoUsuarios.set(numeroCliente, stCliente);

    const stAsesor = estadoUsuarios.get(ASESOR_PSQR) || {};
    stAsesor.soporteActivo = true;
    stAsesor.soporteConversacionId = convId;
    stAsesor.soporteCliente = numeroCliente;
    estadoUsuarios.set(ASESOR_PSQR, stAsesor);
  }

  // 🧹 Finaliza el puente PSQR sin importar quién envía "salir"
  private async finalizarSoportePSQRPorCualquiera(quienEscribe: string) {
    const st = estadoUsuarios.get(quienEscribe);
    const convId = st?.soporteConversacionId;

    // Detectar roles y contrapartes a partir del estado en memoria
    let cliente = st?.soporteCliente ? st.soporteCliente : (st?.soporteAsesor ? quienEscribe : null);
    let asesor = st?.soporteAsesor ? st.soporteAsesor : (st?.soporteCliente ? quienEscribe : null);

    // Fallback por si el asesor es el fijo ASESOR_PSQR
    if (!asesor && st?.soporteConversacionId) asesor = ASESOR_PSQR;

    if (!convId || !cliente || !asesor) {
      // Nada que cerrar
      return;
    }

    // 1) Mensaje de gracias al cliente
    const gracias = [
      '🧡 *Gracias por contactarnos*',
      'Tu caso de PSQR ha sido *cerrado*.',
      '',
      'Si necesitas algo más, escribe *Hola* y con gusto te ayudamos. 🛵',
    ].join('\n');
    await this.enviarMensajeTexto(cliente, gracias);

    // 2) Aviso al asesor
    await this.enviarMensajeTexto(asesor, '✅ Caso cerrado. ¡Gracias!');

    // 3) Limpia estados (y timers si aplica)
    const stCliente = estadoUsuarios.get(cliente) || {};
    delete stCliente.soporteActivo;
    delete stCliente.soporteConversacionId;
    delete stCliente.soporteAsesor;
    estadoUsuarios.set(cliente, stCliente);

    const stAsesor = estadoUsuarios.get(asesor) || {};
    delete stAsesor.soporteActivo;
    delete stAsesor.soporteConversacionId;
    delete stAsesor.soporteCliente;
    estadoUsuarios.set(asesor, stAsesor);
  }

  private esTriggerRapidoPorTexto(raw?: string): boolean {
    if (!raw) return false;
    const t = this.normalizarBasico(raw);
    return t === TRIGGER_PALABRA_CLAVE;
  }

  private esStickerRapido(sha?: string): boolean {
    if (!sha) return false;
    return STICKERS_RAPIDOS.has(sha);
  }

}


