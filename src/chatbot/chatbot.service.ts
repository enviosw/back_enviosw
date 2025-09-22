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
import { PrecioDomicilio } from './entities/precio-domicilio.entity';


const estadoUsuarios = new Map<string, any>();
const temporizadoresInactividad = new Map<string, NodeJS.Timeout>(); // ⏰ Temporizadores
const temporizadoresEstado = new Map<string, NodeJS.Timeout>(); // TTL para solicitar estado a domiciliario
const bloqueoMenu = new Map<string, NodeJS.Timeout>(); // Bloqueo temporal del menú

const ESTADO_COOLDOWN_MS = 5 * 60 * 1000; // 5 min

function isExpired(ts?: number) {
  return !ts || Date.now() >= ts;
}


const ASESOR_PSQR = '573142423130';

const TRIGGER_PALABRA_CLAVE = '1';
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

    @InjectRepository(PrecioDomicilio)
    private readonly precioRepo: Repository<PrecioDomicilio>,

  ) { }

  // ⏰ Cierre por inactividad (10 min)
  // No aplica si hay conversación activa o si el pedido está confirmado / esperando asignación
  // ⏰ Cierre por inactividad (10 min)
  // Cierra y limpia estado/timers. Solo NOTIFICA al cliente; si es domiciliario, cierra en silencio.
  private async reiniciarPorInactividad(numero: string) {
    const st = estadoUsuarios.get(numero) || {};

    // No cerrar si está en soporte o con pedido activo/en asignación
    if (st?.soporteActivo) return;
    if (st?.conversacionId) return;
    if (st?.confirmadoPedido === true) return;
    if (st?.esperandoAsignacion === true) return;

    // ¿Es domiciliario? (si falla la consulta, asumimos que NO lo es para no silenciar por error)
    let esDomiciliario = false;
    try {
      esDomiciliario = await this.domiciliarioService.esDomiciliario(numero);
    } catch {
      esDomiciliario = false;
    }

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

    // 🔕 Si es domiciliario: cierre silencioso (no notificar)
    if (esDomiciliario) {
      this.logger.log(`🔕 Chat cerrado por inactividad (silencioso) para domiciliario ${numero}.`);
      return;
    }

    // 📣 Si es cliente: notificar cierre
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
  // private generarResumenPedidoDesdePedido(pedido: any): string {
  //   const esSticker = String(pedido?.tipo_servicio || '').toLowerCase() === 'sticker';

  //   if (esSticker) {
  //     // ⚡ Pedido rápido por sticker: solo lo mínimo para el domiciliario
  //     const recoger = pedido.origen_direccion
  //       ? `📍 Recoger: ${pedido.origen_direccion}`
  //       : '';
  //     const tel = pedido.telefono_contacto_origen
  //       ? `📞 Tel: ${pedido.telefono_contacto_origen}`
  //       : '';

  //     return ['⚡ Pedido rápido (sticker)', recoger, tel]
  //       .filter(Boolean)
  //       .join('\n');
  //   }

  //   // 🧾 Comportamiento normal para los demás tipos
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

  const MAX_WAIT_MS = 10 * 60 * 1000; // 10 minutos

  try {
    const pendientes = await this.domiciliosService.find({
      where: { estado: 0 },        // pendientes
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
        // 1) Cancelar por timeout si sigue PENDIENTE
        const creadaMs = new Date(pedido.fecha).getTime();
        const diff = Date.now() - creadaMs;

        if (Number.isFinite(creadaMs) && diff >= MAX_WAIT_MS) {
          const cancelado = await this.domiciliosService.cancelarPorTimeoutSiPendiente(
            pedido.id,
            'Tiempo de espera de asignación superado (10m)',
          );
          if (cancelado) {
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
            const st = estadoUsuarios.get(pedido.numero_cliente) || {};
            st.esperandoAsignacion = false;
            estadoUsuarios.set(pedido.numero_cliente, st);
            this.logger.warn(`❌ Pedido id=${pedido.id} cancelado por timeout de asignación (>10m).`);
          }
          continue;
        }

        // 2) Intentar asignar un domi
        const domiciliario: Domiciliario | null =
          await this.domiciliarioService.asignarDomiciliarioDisponible();

        if (!domiciliario) {
          this.logger.warn(`⚠️ Sin domiciliarios para pedido id=${pedido.id}. Se mantiene pendiente.`);
          // Ofrece cancelar sin spamear (usa tu botón)
          await this.mostrarMenuPostConfirmacion(
            pedido.numero_cliente,
            pedido.id,
            '⏳ Seguimos buscando un domiciliario. Si ya no lo necesitas, puedes cancelar:',
            5 * 60 * 1000
          );
          continue;
        }

        // 3) MARCAR OFERTADO **ATOMICO** (evita 2 domis a la vez)
        const ofertado = await this.domiciliosService.marcarOfertadoSiPendiente(
          pedido.id,
          domiciliario.id
        );
        if (!ofertado) {
          // Otro proceso lo tomó / cambió estado → liberar domi y seguir
          try { await this.domiciliarioService.liberarDomiciliario(domiciliario.id); } catch {}
          this.logger.warn(`⛔ Race detectada: pedido ${pedido.id} ya no está pendiente.`);
          continue;
        }

        // 4) Armar resumen para el domi (sin lista si es sticker)
        const tipo = String(pedido?.tipo_servicio || '').trim();
        const esSticker = tipo.toLowerCase() === 'sticker';

        const tipoLinea = tipo ? `🔁 *Tipo de servicio:* ${tipo}` : '';
        const recoger = pedido.origen_direccion
          ? `📍 *Recoger en:* ${pedido.origen_direccion}\n📞 *Tel:* ${pedido.telefono_contacto_origen || '-'}`
          : '';
        const entregar = pedido.destino_direccion
          ? `🏠 *Entregar en:* ${pedido.destino_direccion}\n📞 *Tel:* ${pedido.telefono_contacto_destino || '-'}`
          : '';

        const lista = (() => {
          if (!pedido.detalles_pedido) return '';
          if (esSticker) {
            // Extrae nombre del comercio de los detalles (línea con "🏪")
            const match = pedido.detalles_pedido.match(/🏪\s*(.+)/);
            const comercio = match ? match[1].trim() : null;
            return comercio ? `🏪 *Comercio:* ${comercio}` : '';
          }
          return `🛒 *Lista de compras:*\n${String(pedido.detalles_pedido).trim()}`;
        })();

        const resumenPedido = [tipoLinea, recoger, entregar, lista]
          .filter(Boolean)
          .join('\n\n');

        const bodyTexto = this.sanitizeWaBody(
          `📦 *Nuevo pedido disponible:*\n\n${resumenPedido}`
        );

        // 5) Enviar resumen + botones (IDs: ACEPTAR_<id> / RECHAZAR_<id>)
        await this.enviarOfertaAceptarRechazarConId({
          telefonoDomi: domiciliario.telefono_whatsapp,
          pedidoId: pedido.id,
          resumenLargo: bodyTexto,
          bodyCorto: '¿Deseas tomar este pedido?',
        });

        // 6) Timeout: si el domi NO responde, vuelve a pendiente de forma ATÓMICA
        setTimeout(async () => {
          try {
            const volvio = await this.domiciliosService.volverAPendienteSiOfertado(pedido.id);
            if (volvio) {
              try { await this.domiciliarioService.liberarDomiciliario(domiciliario.id); } catch {}
              this.logger.warn(`⏰ Domi no respondió. Pedido ${pedido.id} vuelve a pendiente.`);
              this.reintentarAsignacionPendientes();
            }
          } catch (e) {
            this.logger.error(`Timeout oferta falló para pedido ${pedido.id}: ${e?.message || e}`);
          }
        }, 120_000);

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


    // 🛡️ FILTRO TEMPRANO DE TIPOS NO SOPORTADOS
    if (this.esMedioNoSoportado(mensaje)) {
      // Tipifica la razón: si fue sticker NO permitido, avisa específicamente
      if (tipo === 'sticker') {
        await this.enviarMensajeTexto(
          numero,
          '📎 Gracias por tu sticker. Por ahora solo acepto *texto* o el *sticker oficial* del servicio. 🙏'
        );
      } else {
        await this.enviarMensajeTexto(
          numero,
          '⛔ Por ahora solo acepto *texto*. Si ves botones, puedes usarlos también. 😊'
        );
      }
      return; // ⛔ no procesar nada más
    }


    // --- CAPTURA DE PRECIO EN CURSO ---
    {
      const key = this.toKey(numero);
      const stLocal = estadoUsuarios.get(key) || estadoUsuarios.get(numero);

      if (tipo === 'text' && stLocal?.capturandoPrecio && !stLocal?.conversacionFinalizada) {
        const monto = this.parseMonto(texto || '');
        if (monto === null) {
          await this.enviarMensajeTexto(numero, '❌ No pude leer el valor. Intenta de nuevo, ejemplo: 15000 o 12.500');
          return;
        }

        stLocal.precioTmp = monto;
        stLocal.capturandoPrecio = false;
        stLocal.confirmandoPrecio = true;
        estadoUsuarios.set(key, stLocal);

        await this.enviarMensajeTexto(
          numero,
          `🧾 *Precio detectado:* ${monto.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
        );

        await axiosWhatsapp.post('/messages', {
          messaging_product: 'whatsapp',
          to: numero,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: '¿Confirmas este valor?' },
            action: {
              buttons: [
                { type: 'reply', reply: { id: 'confirmar_precio_si', title: '✅ Sí, Finalizar' } },
                { type: 'reply', reply: { id: 'confirmar_precio_no', title: '↩️ No, reingresar' } },

              ],
            },
          },
        });

        return; // detenemos el flujo normal hasta confirmar
      }
    }


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





    // ⚡ Palabra clave "1" ⇒ mismo comportamiento que sticker oficial (pedido rápido comercio)
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
      const saludo = `🚀 ${String(nombre)} Bienvenido al futuro con *DomiciliosW.com*  

🤖 Tu pedido ahora lo recibe un ChatBot inteligente y lo envía directo a tu domiciliario.  

🛵💨 Pide fácil en 👉 https://domiciliosw.com`;

      //QUITAR
      // await this.enviarSticker(numero, String(stickerConstants.stickerId))

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

      // =========================
      // ACEPTAR / RECHAZAR OFERTA
      // =========================

      // ACEPTAR_<id>  (nuevo)  |  aceptar_pedido_<id> (legacy)
      const matchAceptar = id.match(/^(?:ACEPTAR|aceptar_pedido)_(\d+)$/);
      if (matchAceptar) {
        const pedidoId = Number(matchAceptar[1]);
        const pedido = await this.getPedidoById(pedidoId);

        if (!pedido || pedido.estado !== 5) {
          await this.enviarMensajeTexto(numero, '⚠️ El pedido ya no está disponible.');
          return;
        }

        // ✅ Confirmar asignación
        await this.domiciliosService.update(pedidoId, { estado: 1 }); // asignado

        // 🔄 Crear conversación (se crea SOLO tras aceptar)
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
        await this.enviarMensajeTexto(
          numero,
          '📦 Pedido *asignado a ti*. Ya puedes hablar con el cliente.'
        );

        // 🧩 Buscar datos del domi para informar bien al cliente
        const domi = await this.domiciliarioService.getByTelefono(numero);
        const nombreDomi = domi ? `${domi.nombre} ${domi.apellido ?? ''}`.trim() : numero;
        const chaqueta = domi?.numero_chaqueta ?? '-';
        const telDomi = numero.startsWith('+')
          ? numero
          : `+57${numero.replace(/\D/g, '').slice(-10)}`;

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

      // RECHAZAR_<id> (nuevo) |  rechazar_pedido_<id> (legacy)
      const matchRechazar = id.match(/^(?:RECHAZAR|rechazar_pedido)_(\d+)$/);
      if (matchRechazar) {
        const pedidoId = Number(matchRechazar[1]);
        const pedido = await this.getPedidoById(pedidoId);
        if (!pedido || pedido.estado !== 5) return;

        // 👇 LIBERAR DOMICILIARIO (si había)
        if (pedido.id_domiciliario) {
          try {
            await this.domiciliarioService.liberarDomiciliario(pedido.id_domiciliario);
          } catch (e) {
            this.logger.warn(`No se pudo liberar domi ${pedido.id_domiciliario} tras rechazo: ${e?.message || e}`);
          }
        }

        await this.domiciliosService.update(pedidoId, {
          estado: 0, // vuelve a pendiente para reofertar
          id_domiciliario: null,
          motivo_cancelacion: 'Rechazado por domiciliario',
        });

        await this.enviarMensajeTexto(numero, '❌ Has rechazado el pedido.');

        // (Opcional) Botones de disponibilidad
        try {
          await axiosWhatsapp.post('/messages', {
            messaging_product: 'whatsapp',
            to: numero,
            type: 'interactive',
            interactive: {
              type: 'button',
              body: { text: '¿Deseas cambiar tu disponibilidad?' },
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

      // =========================
      // FIN ACEPTAR/RECHAZAR
      // =========================


      if (id === 'fin_domi') {
        const st = estadoUsuarios.get(numero) || {};
        const conversacionId = st?.conversacionId;
        if (!conversacionId) {
          await this.enviarMensajeTexto(numero, '⚠️ No encontré una conversación activa para finalizar.');
          return;
        }

        const conversacion = await this.conversacionRepo.findOne({ where: { id: conversacionId } });
        if (!conversacion) {
          await this.enviarMensajeTexto(numero, '⚠️ No se encontró la conversación en el sistema.');
          return;
        }
        if (numero !== conversacion.numero_domiciliario) {
          await this.enviarMensajeTexto(numero, '⛔ Solo el domiciliario puede finalizar este pedido.');
          return;
        }

        // Paso 1: pedimos el valor
        const s = estadoUsuarios.get(numero) || {};
        s.capturandoPrecio = true;
        s.confirmandoPrecio = false;
        s.precioTmp = undefined;
        estadoUsuarios.set(numero, s);

        await this.enviarMensajeTexto(
          numero,
          '💰 *Escribe el valor total cobrado al cliente* (ej: 15000, $ 15.000 o 12.500).'
        );
        return;
      }

      if (id === 'mantener_estado') {
        const s = estadoUsuarios.get(numero) || {};
        s.awaitingEstado = false;
        s.awaitingEstadoExpiresAt = undefined;
        estadoUsuarios.set(numero, s);

        if (temporizadoresEstado.has(numero)) {
          clearTimeout(temporizadoresEstado.get(numero)!);
          temporizadoresEstado.delete(numero);
        }

        await this.enviarMensajeTexto(numero, '👌 Mantendremos tu estado *sin cambios* y conservas tu turno.');
        return;
      }

      if (id === 'confirmar_fin_si') {
        const st = estadoUsuarios.get(numero);

        const s = estadoUsuarios.get(numero) || {};
        if (s?.capturandoPrecio || s?.confirmandoPrecio) {
          await this.enviarMensajeTexto(numero, '💡 Primero confirma el *precio* para poder finalizar.');
          return;
        }

        const conversacionId = st?.conversacionId;
        if (!conversacionId) {
          await this.enviarMensajeTexto(numero, '⚠️ No encontré una conversación activa para finalizar.');
          return;
        }

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
        await this.enviarMensajeTexto(numero, '👍 Entendido. La conversación continúa activa.');
        await this.enviarBotonFinalizarAlDomi(numero);
        return;
      }

      if (id === 'confirmar_precio_no') {
        const s = estadoUsuarios.get(numero) || {};
        s.capturandoPrecio = true;
        s.confirmandoPrecio = false;
        s.precioTmp = undefined;
        estadoUsuarios.set(numero, s);

        await this.enviarMensajeTexto(numero, '✍️ Escribe nuevamente el valor total (ej: 15000 o 12.500).');
        return;
      }

      if (id === 'confirmar_precio_si') {
        const s = estadoUsuarios.get(numero) || {};
        const conversacionId = s?.conversacionId;

        if (!conversacionId || typeof s?.precioTmp !== 'number') {
          await this.enviarMensajeTexto(numero, '⚠️ No encontré el precio o la conversación para finalizar.');
          return;
        }

        const conv = await this.conversacionRepo.findOne({ where: { id: conversacionId } });
        if (!conv) {
          await this.enviarMensajeTexto(numero, '⚠️ No se encontró la conversación en el sistema.');
          return;
        }
        if (numero !== conv.numero_domiciliario) {
          await this.enviarMensajeTexto(numero, '⛔ Solo el domiciliario puede finalizar este pedido.');
          return;
        }

        try {
          const numeroKey = this.toKey(numero);
          await this.precioRepo.save({
            numero_domiciliario: numeroKey,
            costo: s.precioTmp.toFixed(2),
          });
        } catch (e) {
          this.logger.error(`❌ Error guardando precio: ${e instanceof Error ? e.message : e}`);
          await this.enviarMensajeTexto(numero, '⚠️ No pude guardar el precio. Intenta confirmar nuevamente.');
          return;
        }

        s.confirmandoPrecio = false;
        s.capturandoPrecio = false;
        s.conversacionFinalizada = true;
        estadoUsuarios.set(numero, s);
        const monto = s.precioTmp;

        const { ok, msg } = await this.finalizarConversacionPorDomi(conversacionId, monto);
        if (!ok) {
          await this.enviarMensajeTexto(numero, `❌ No fue posible finalizar: ${msg || 'Error desconocido'}`);
        }
        return;
      }

      if (id === 'cambiar_a_disponible' || id === 'cambiar_a_no_disponible') {
        const disponible = id === 'cambiar_a_disponible';
        try {
          await this.domiciliarioService.cambiarDisponibilidadPorTelefono(numero, disponible);

          const s = estadoUsuarios.get(numero) || {};
          s.awaitingEstado = false;
          s.awaitingEstadoExpiresAt = undefined;
          estadoUsuarios.set(numero, s);

          if (temporizadoresEstado.has(numero)) {
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

          const s = estadoUsuarios.get(numero) || {};
          s.awaitingEstado = false;
          s.awaitingEstadoExpiresAt = undefined;
          estadoUsuarios.set(numero, s);

          if (temporizadoresEstado.has(numero)) {
            clearTimeout(temporizadoresEstado.get(numero)!);
            temporizadoresEstado.delete(numero);
          }

          await this.enviarMensajeTexto(numero, '❌ No se pudo actualizar tu estado.');
        }
        return;
      }

      // =========================
      // Confirmaciones de pedido del cliente
      // =========================
      if (id === 'confirmar_info' || id === 'confirmar_pago' || id === 'confirmar_compra') {
        let domiciliario: Domiciliario | null = null;

        const st = estadoUsuarios.get(numero) || {};
        const datos = st?.datos || {};
        const tipo = st?.tipo || 'servicio';

        try {
          // 1) Intentar asignar un domiciliario disponible
          domiciliario = await this.domiciliarioService.asignarDomiciliarioDisponible();

          // Si NO hay domiciliario disponible → PENDIENTE (0) y aviso
          if (!domiciliario) {
            this.logger.warn('⚠️ No hay domiciliarios disponibles en este momento.');

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

            const pedidoPendiente = await this.domiciliosService.create({
              mensaje_confirmacion: 'Confirmado por el cliente vía WhatsApp',
              estado: 0,
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

          // 2) Sí hay domi: crear pedido como OFERTADO
          const pedidoOfertado = await this.domiciliosService.create({
            mensaje_confirmacion: 'Confirmado por el cliente vía WhatsApp',
            estado: 5, // ofertado
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

          // ——— construir RESUMEN y OFERTAR con helper
          const partes: string[] = [];
          partes.push('📦 *Nuevo pedido disponible*', '');
          partes.push(`🔁 *Tipo de servicio:*\n${String(tipo || 'servicio').replace('opcion_', '')}`);

          if (datos.listaCompras) {
            const listaRaw = String(datos.listaCompras).trim().replace(/\r\n?/g, '\n');
            const listaFmt = /\n/.test(listaRaw) ? listaRaw : listaRaw.replace(/,\s*/g, '\n');
            partes.push('🛒 *Lista de compras:*\n' + listaFmt);
            partes.push('');
          }
          if (datos.direccionRecoger) {
            partes.push(`📍 *Recoger en:*\n${datos.direccionRecoger}`);
            partes.push(`\n📞 *Tel:*\n${datos.telefonoRecoger || ''}`);
            partes.push('');
          }
          const entregarDir = datos.direccionEntregar || datos.direccionEntrega;
          const telEntregar = datos.telefonoEntregar || datos.telefonoEntrega;
          if (entregarDir) {
            partes.push(`🏠 *Entregar en:*\n${entregarDir}`);
            partes.push(`\n📞 *Tel:*\n${telEntregar || ''}`);
            partes.push('');
          }
          const resumenLargo = this.sanitizeWaBody(partes.join('\n'));

          await this.enviarOfertaAceptarRechazarConId({
            telefonoDomi: domiciliario.telefono_whatsapp,
            pedidoId: pedidoOfertado.id,
            resumenLargo,
            // bodyCorto opcional
          });

          await this.enviarMensajeTexto(numero, '⏳ Estamos procesando tu domicilio. Gracias por preferirnos.');

          if (pedidoOfertado?.id) {
            await this.mostrarMenuPostConfirmacion(
              numero,
              pedidoOfertado.id,
              '⏳ Si ya no lo necesitas, puedes cancelar:',
              60 * 1000
            );
          }

          setTimeout(async () => {
            try {
              const p = await this.getPedidoById(pedidoOfertado.id);
              if (p?.estado === 5) {
                if (p.id_domiciliario) {
                  try { await this.domiciliarioService.liberarDomiciliario(p.id_domiciliario); } catch { }
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
          }, 120_000);

          return;
        } catch (error) {
          this.logger.warn(`⚠️ Error al ofertar pedido: ${error?.message || error}`);
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
            estado: 0,
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

    // Helpers
    const pistaDireccion = /(calle|cra|carrera|avenida|av\.?|diag|transv|#|mz|manzana|barrio|sector|torre|bloque|int|apto|piso|oficina)/i;
    const extraerTelefono = (txt?: string): string | null => {
      if (!txt) return null;
      const all = txt.match(/\d{7,}/g);
      return all?.length ? all[all.length - 1] : null;
    };
    const extraerDireccion = (txt?: string): string | null => {
      if (!txt?.trim()) return null;
      if (!pistaDireccion.test(txt)) return null;
      const tel = extraerTelefono(txt);
      const sinTel = tel ? txt.replace(new RegExp(tel, 'g'), '').trim() : txt.trim();
      return sinTel || null;
    };

    // Prompts cortos
    const pedirDireccionRecogida = async () =>
      this.enviarMensajeTexto(numero, '📍 Dirección de *recogida* (ej: Calle 12 #34-56 Apto 101)');
    const pedirTelefonoRecogida = async () =>
      this.enviarMensajeTexto(numero, '📞 Teléfono de *recogida* (mín. 7 dígitos)');
    const pedirDireccionEntrega = async () =>
      this.enviarMensajeTexto(numero, '🏠 Dirección de *entrega*');
    const pedirTelefonoEntrega = async () =>
      this.enviarMensajeTexto(numero, '📞 Teléfono de *entrega*');

    switch (estado.paso) {
      case 0: {
        await pedirDireccionRecogida();
        estado.paso = 1;
        break;
      }

      case 1: {
        const dir = extraerDireccion(mensaje);
        if (!dir) {
          await this.enviarMensajeTexto(numero, '⚠️ Envía una dirección válida de *recogida*.');
          await pedirDireccionRecogida();
          break;
        }
        estado.datos.direccionRecoger = dir;
        await pedirTelefonoRecogida();
        estado.paso = 2;
        break;
      }

      case 2: {
        const tel = extraerTelefono(mensaje);
        if (!tel || !/^\d{7,}$/.test(tel)) {
          await this.enviarMensajeTexto(numero, '⚠️ Teléfono inválido. Intenta de nuevo.');
          await pedirTelefonoRecogida();
          break;
        }
        estado.datos.telefonoRecoger = tel;
        await pedirDireccionEntrega();
        estado.paso = 3;
        break;
      }

      case 3: {
        const dir = extraerDireccion(mensaje);
        if (!dir) {
          await this.enviarMensajeTexto(numero, '⚠️ Envía una dirección válida de *entrega*.');
          await pedirDireccionEntrega();
          break;
        }
        estado.datos.direccionEntrega = dir;
        estado.datos.direccionEntregar = dir;
        await pedirTelefonoEntrega();
        estado.paso = 4;
        break;
      }

      case 4: {
        const tel = extraerTelefono(mensaje);
        if (!tel || !/^\d{7,}$/.test(tel)) {
          await this.enviarMensajeTexto(numero, '⚠️ Teléfono inválido. Intenta de nuevo.');
          await pedirTelefonoEntrega();
          break;
        }
        estado.datos.telefonoEntrega = tel;
        estado.datos.telefonoEntregar = tel;

        // Resumen final
        const { direccionRecoger, telefonoRecoger, direccionEntrega, telefonoEntrega } = estado.datos;
        await this.enviarMensajeTexto(
          numero,
          '✅ Verifica:\n\n' +
          `📍 Recoger: ${direccionRecoger}\n` +
          `📞 Tel: ${telefonoRecoger}\n\n` +
          `🏠 Entregar: ${direccionEntrega}\n` +
          `📞 Tel: ${telefonoEntrega}`
        );

        await axiosWhatsapp.post('/messages', {
          messaging_product: 'whatsapp',
          to: numero,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: '¿Es correcto?' },
            action: {
              buttons: [
                { type: 'reply', reply: { id: 'confirmar_info', title: '✅ Sí' } },
                { type: 'reply', reply: { id: 'editar_info', title: '🔁 No, editar' } },
              ],
            },
          },
        });

        estado.confirmacionEnviada = true;
        estado.paso = 5;
        break;
      }

      case 5: {
        // Correcciones opcionales
        const tel = extraerTelefono(mensaje);
        const dir = extraerDireccion(mensaje);
        if (dir) estado.datos.direccionEntrega = dir;
        if (tel && /^\d{7,}$/.test(tel)) estado.datos.telefonoEntrega = tel;

        await this.enviarMensajeTexto(
          numero,
          '✍️ Datos actualizados:\n\n' +
          `📍 Recoger: ${estado.datos.direccionRecoger}\n` +
          `📞 Tel: ${estado.datos.telefonoRecoger}\n\n` +
          `🏠 Entregar: ${estado.datos.direccionEntrega}\n` +
          `📞 Tel: ${estado.datos.telefonoEntrega}`
        );
        break;
      }

      default: {
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
      .replace(/[,\-–—|:/]*\s*$/, '')              // separadores al final
      .replace(/\s*(tel\.?:?)?\s*$/i, '')           // "tel:" al final
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

    // Helpers breves
    const extraerTelefono = (txt?: string): string | null => {
      if (!txt) return null;
      const all = txt.match(/\d{7,}/g);
      return all?.length ? all[all.length - 1] : null;
    };
    const direccionValida = (txt?: string) => !!txt && txt.trim().length >= 5;

    // Prompts cortos
    const pedirLista = async () =>
      this.enviarMensajeTexto(numero, '🛒 Envía tu *lista completa*. (Puedes pegar todo en un mensaje)');
    const pedirDirEntrega = async () =>
      this.enviarMensajeTexto(numero, '🏠 Dirección de *entrega*');
    const pedirTelEntrega = async () =>
      this.enviarMensajeTexto(numero, '📞 Teléfono de quien *recibe* (7+ dígitos)');

    switch (estado.paso) {
      // 0) Pedimos la lista
      case 0: {
        await pedirLista();
        estado.paso = 1;
        break;
      }

      // 1) Guardamos la lista tal cual y pedimos dirección
      case 1: {
        if (!mensaje?.trim()) {
          await this.enviarMensajeTexto(numero, '⚠️ Envía la *lista* para continuar.');
          await pedirLista();
          break;
        }

        estado.datos.listaCompras = mensaje.trim();
        await pedirDirEntrega();
        estado.paso = 2;
        break;
      }

      // 2) Guardamos dirección (mín. 5 caracteres) y pedimos teléfono
      case 2: {
        if (!direccionValida(mensaje)) {
          await this.enviarMensajeTexto(numero, '⚠️ Escribe una *dirección válida* (mín. 5 caracteres).');
          await pedirDirEntrega();
          break;
        }

        const dir = mensaje.trim();
        estado.datos.direccionEntrega = dir;
        estado.datos.direccionEntregar = dir; // compat
        await pedirTelEntrega();
        estado.paso = 3;
        break;
      }

      // 3) Guardamos teléfono (7+ dígitos) y confirmamos
      case 3: {
        const tel = extraerTelefono(mensaje);
        if (!tel || !/^\d{7,}$/.test(tel)) {
          await this.enviarMensajeTexto(numero, '⚠️ Teléfono inválido. Intenta de nuevo (7+ dígitos).');
          await pedirTelEntrega();
          break;
        }

        estado.datos.telefonoEntrega = tel;
        estado.datos.telefonoEntregar = tel;

        // Resumen + botones (corto)
        const { listaCompras, direccionEntrega, telefonoEntrega } = estado.datos;
        await this.enviarMensajeTexto(
          numero,
          '✅ Verifica:\n\n' +
          `🛒 Lista:\n${listaCompras}\n\n` +
          `🏠 Entrega: ${direccionEntrega}\n` +
          `📞 Tel: ${telefonoEntrega}`
        );

        await axiosWhatsapp.post('/messages', {
          messaging_product: 'whatsapp',
          to: numero,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: '¿Es correcto?' },
            action: {
              buttons: [
                { type: 'reply', reply: { id: 'confirmar_compra', title: '✅ Sí' } },
                { type: 'reply', reply: { id: 'editar_compra', title: '🔁 No, editar' } },
              ],
            },
          },
        });

        estado.confirmacionEnviada = true;
        estado.paso = 4;
        break;
      }

      // 4) Correcciones después del resumen (si el usuario envía algo)
      case 4: {
        if (!mensaje?.trim()) break;

        // Permitir correcciones rápidas: si hay 7+ dígitos, lo tomamos como tel; si no, como dirección
        const tel = extraerTelefono(mensaje);
        if (tel && /^\d{7,}$/.test(tel)) {
          estado.datos.telefonoEntrega = tel;
          estado.datos.telefonoEntregar = tel;
        } else if (direccionValida(mensaje)) {
          const dir = mensaje.trim();
          estado.datos.direccionEntrega = dir;
          estado.datos.direccionEntregar = dir;
        }

        await this.enviarMensajeTexto(
          numero,
          '✍️ Datos actualizados:\n\n' +
          `🏠 Entrega: ${estado.datos.direccionEntrega}\n` +
          `📞 Tel: ${estado.datos.telefonoEntrega}`
        );

        // (Opcional) volver a mostrar los botones
        try {
          await axiosWhatsapp.post('/messages', {
            messaging_product: 'whatsapp',
            to: numero,
            type: 'interactive',
            interactive: {
              type: 'button',
              body: { text: '¿Es correcto ahora?' },
              action: {
                buttons: [
                  { type: 'reply', reply: { id: 'confirmar_compra', title: '✅ Sí' } },
                  { type: 'reply', reply: { id: 'editar_compra', title: '🔁 No, editar' } },
                ],
              },
            },
          });
        } catch (e) {
          // no bloquear si falla el reenvío de botones
        }
        break;
      }

      default: {
        await this.enviarMensajeTexto(numero, '❗ Reiniciaremos el proceso.');
        estadoUsuarios.delete(numero);
        await this.opcion2PasoAPaso(numero, '');
        return;
      }
    }

    estadoUsuarios.set(numero, estado);
  }




  // Versión robusta y tolerante a mensajes “juntos” / reenvíos.
  // - Usa this.extraerDireccionYTelefono(mensaje) para separar dirección y teléfono.
  // - Acepta que el usuario reenvíe la info completa estando en paso 2 (actualiza y re-confirma sin duplicar).
  // - Evita repetir el resumen/botones con estado.confirmacionEnviada.
  // - Guarda claves de compatibilidad si aplica.
  async opcion3PasoAPaso(numero: string, mensaje: string): Promise<void> {
    const estado = estadoUsuarios.get(numero) || { paso: 0, datos: {}, tipo: 'opcion_3' };

    // Helpers simples
    const extraerTelefono = (txt?: string): string | null => {
      if (!txt) return null;
      const all = txt.match(/\d{7,}/g);
      return all?.length ? all[all.length - 1] : null;
    };
    const direccionValida = (txt?: string) => !!txt && txt.trim().length >= 5;

    // Prompts cortos
    const pedirDirRecoger = async () =>
      this.enviarMensajeTexto(
        numero,
        '📍 Dirección de *RECOGER*'
      );
    const pedirTelRecoger = async () =>
      this.enviarMensajeTexto(
        numero,
        '📞 Teléfono de quien *entrega* (7+ dígitos)'
      );

    switch (estado.paso) {
      // 0) Pedir dirección de RECOGER
      case 0: {
        await this.enviarMensajeTexto(
          numero,
          '💰 Vamos a recoger dinero/facturas.\n' +
          '📍 Envíame la *dirección de RECOGER*.\n' +
          '🔐 Si el pago supera 200.000, escribe al 314 242 3130.'
        );
        estado.paso = 1;
        break;
      }

      // 1) Guardar dirección de RECOGER y pedir teléfono
      case 1: {
        if (!direccionValida(mensaje)) {
          await this.enviarMensajeTexto(numero, '⚠️ Dirección inválida. Escribe una *dirección válida* (mín. 5 caracteres).');
          await pedirDirRecoger();
          break;
        }
        const dir = mensaje.trim();
        estado.datos.direccionRecoger = dir;
        estado.datos.direccionRecogida = dir; // compat
        await pedirTelRecoger();
        estado.paso = 2;
        break;
      }

      // 2) Guardar teléfono y confirmar
      case 2: {
        const tel = extraerTelefono(mensaje);
        if (!tel || !/^\d{7,}$/.test(tel)) {
          await this.enviarMensajeTexto(numero, '⚠️ Teléfono inválido. Envía *7+ dígitos*.');
          await pedirTelRecoger();
          break;
        }
        estado.datos.telefonoRecoger = tel;
        estado.datos.telefonoRecogida = tel; // compat

        // Resumen + botones
        const { direccionRecoger, telefonoRecoger } = estado.datos;
        await this.enviarMensajeTexto(
          numero,
          '✅ Verifica:\n\n' +
          `📍 Recoger: ${direccionRecoger}\n` +
          `📞 Tel: ${telefonoRecoger}`
        );

        await axiosWhatsapp.post('/messages', {
          messaging_product: 'whatsapp',
          to: numero,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: '¿Es correcto?' },
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

      // 3) Correcciones rápidas después del resumen
      case 3: {
        if (!mensaje?.trim()) break;

        // Si el mensaje trae 7+ dígitos => teléfono; si no => dirección
        const tel = extraerTelefono(mensaje);
        let huboCambio = false;

        if (tel && /^\d{7,}$/.test(tel)) {
          estado.datos.telefonoRecoger = tel;
          estado.datos.telefonoRecogida = tel;
          huboCambio = true;
        } else if (direccionValida(mensaje)) {
          const dir = mensaje.trim();
          estado.datos.direccionRecoger = dir;
          estado.datos.direccionRecogida = dir;
          huboCambio = true;
        }

        if (huboCambio) {
          await this.enviarMensajeTexto(
            numero,
            '✍️ Actualizado:\n\n' +
            `📍 Recoger: ${estado.datos.direccionRecoger}\n` +
            `📞 Tel: ${estado.datos.telefonoRecoger}`
          );

          // Reenviar botones por comodidad (ignorar fallo)
          try {
            await axiosWhatsapp.post('/messages', {
              messaging_product: 'whatsapp',
              to: numero,
              type: 'interactive',
              interactive: {
                type: 'button',
                body: { text: '¿Es correcto ahora?' },
                action: {
                  buttons: [
                    { type: 'reply', reply: { id: 'confirmar_compra', title: '✅ Sí' } },
                    { type: 'reply', reply: { id: 'editar_compra', title: '🔁 No, editar' } },
                  ],
                },
              },
            });
          } catch { }
        }
        break;
      }

      default: {
        await this.enviarMensajeTexto(numero, '❗ Reiniciaremos el proceso.');
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



  // private generarResumenPedido(datos: any, tipo: string, nombre: string, numero: string): string {
  //   if (!datos) return 'Sin datos del pedido.';

  //   const recoger = datos.direccionRecoger
  //     ? `📍 *Recoger en:* ${datos.direccionRecoger}\n📞 *Tel:* ${datos.telefonoRecoger}`
  //     : '';

  //   const entregar = datos.direccionEntregar || datos.direccionEntrega;
  //   const telEntregar = datos.telefonoEntregar;
  //   const entrega = entregar
  //     ? `🏠 *Entregar en:* ${entregar}\n📞 *Tel:* ${telEntregar}`
  //     : '';

  //   const lista = datos.listaCompras
  //     ? `🛒 *Lista de compras:*\n${datos.listaCompras}`
  //     : '';

  //   let resumen = [recoger, entrega, lista].filter(Boolean).join('\n\n');
  //   resumen += `\n\n🔁 Tipo de servicio: *${tipo.replace('opcion_', '')}*`;

  //   return resumen.trim();
  // }


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
private async procesarAutoPedidoDesde(
  numeroWhatsApp: string,
  textoOriginal: string,
  nombreContacto: string
) {
  const normalizar = (n: string) => {
    const digits = (n || '').replace(/\D/g, '');
    return digits.length === 10 ? `57${digits}` : digits;
  };

  const sanearBodyMultiline = (s: string, max = 900) => {
    let t = String(s || '')
      .replace(/\r\n/g, '\n')     // CRLF -> LF
      .replace(/\u00A0/g, ' ')    // NBSP -> espacio
      .replace(/[ \t]+/g, ' ')    // colapsa espacios/tabs (NO \n)
      .replace(/\n{3,}/g, '\n\n') // máx doble salto
      .trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  };

  const telClienteNorm = normalizar(numeroWhatsApp);

  // 1) Crear SIEMPRE el pedido como PENDIENTE (0)
  const pedidoCreado = await this.domiciliosService.create({
    mensaje_confirmacion: 'Auto-ingreso (pedido desde)',
    estado: 0, // ← pendiente
    numero_cliente: telClienteNorm,
    fecha: new Date().toISOString(),
    hora: new Date().toTimeString().slice(0, 5),
    id_cliente: null,
    // ¡NO pongas aquí domiciliario! La relación se setea solo si pasa a ofertado
    tipo_servicio: 'auto',
    origen_direccion: '',
    destino_direccion: '',
    telefono_contacto_origen: '',
    telefono_contacto_destino: '',
    notas: '',
    detalles_pedido: textoOriginal, // guardar todo el texto
    foto_entrega_url: '',
  });

  // 2) Intentar tomar un domiciliario del turno
  let domiciliario: Domiciliario | null = null;
  try {
    domiciliario = await this.domiciliarioService.asignarDomiciliarioDisponible();
  } catch {
    domiciliario = null;
  }

  // 2.a) Si NO hay domi → informar cliente y mostrar menú de cancelar
  if (!domiciliario) {
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
    return;
  }

  // 3) Si HAY domi: pasar a OFERTADO (5) **solo si sigue pendiente**, y setear relación domi de forma segura
  const ofertado = await this.domiciliosService.marcarOfertadoSiPendiente(
    pedidoCreado.id,
    domiciliario.id
  );

  // Si PERDIMOS la carrera (ya cambió el estado), liberar domi y dejar pendiente
  if (!ofertado) {
    try { await this.domiciliarioService.liberarDomiciliario(domiciliario.id); } catch {}
    await this.enviarMensajeTexto(
      telClienteNorm,
      '⏳ Estamos gestionando tu pedido. Te avisaremos apenas asignemos un domiciliario.'
    );
    await this.mostrarMenuPostConfirmacion(
      telClienteNorm,
      pedidoCreado.id,
      '⏳ Seguimos buscando un domiciliario. Si ya no lo necesitas, puedes cancelar:',
      60 * 1000
    );
    return;
  }

  // 4) Construir resumen (para “auto” no hay direcciones; usa el texto original como detalles)
  const tipo = 'auto';
  const tipoLinea = '🔁 *Tipo de servicio:* auto';
  const listaODetalles = textoOriginal
    ? `📝 *Detalles:*\n${sanearBodyMultiline(textoOriginal)}`
    : '';

  const resumenParaDomi = [tipoLinea, listaODetalles].filter(Boolean).join('\n\n');

  const resumenLargo = sanearBodyMultiline(
    `📦 *Nuevo pedido disponible:*\n\n${resumenParaDomi}\n\n` +
    `👤 Cliente: *${nombreContacto || 'Cliente'}*\n` +
    `📞 Teléfono: ${telClienteNorm}`
  );

  // 5) Enviar OFERTA al domi: primero el resumen (texto) y luego botones Aceptar/Rechazar
  await this.enviarOfertaAceptarRechazarConId({
    telefonoDomi: domiciliario.telefono_whatsapp,
    pedidoId: pedidoCreado.id,
    resumenLargo,
    bodyCorto: '¿Deseas tomar este pedido?',
  });

  // 6) Avisar al cliente que estamos ofertando (AÚN NO hay conversación)
  await this.enviarMensajeTexto(
    telClienteNorm,
    '⏳ Estamos procesando tu domicilio. Gracias por preferirnos.'
  );

  await this.mostrarMenuPostConfirmacion(
    telClienteNorm,
    pedidoCreado.id,
    '⏳ Si ya no lo necesitas, puedes cancelar:',
    60 * 1000
  );

  // 7) Timeout: si el domi NO responde, revertir a PENDIENTE y liberar domi de forma atómica
  setTimeout(async () => {
    try {
      const volvio = await this.domiciliosService.volverAPendienteSiOfertado(pedidoCreado.id);
      if (volvio) {
        try { await this.domiciliarioService.liberarDomiciliario(domiciliario!.id); } catch {}
        this.logger.warn(`⏰ Domi no respondió. Pedido ${pedidoCreado.id} vuelve a pendiente.`);
        this.reintentarAsignacionPendientes();
      }
    } catch (e) {
      this.logger.error(`Timeout oferta falló para pedido ${pedidoCreado.id}: ${e?.message || e}`);
    }
  }, 120_000);
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
    // Normaliza números a formato 57XXXXXXXXXX
    const normalizar = (n: string) => {
      const digits = (n || '').replace(/\D/g, '');
      return digits.length === 10 ? `57${digits}` : digits;
    };

    const telClienteNorm = normalizar(numeroWhatsApp); // quien envió el sticker (comercio)
    let domiciliario: Domiciliario | null = null;

    try {
      domiciliario = await this.domiciliarioService.asignarDomiciliarioDisponible();
    } catch {
      domiciliario = null;
    }

    // 🧾 Datos base del pedido por sticker
    const detalles =
      `Pedido creado por *sticker oficial* del comercio:\n` +
      `🏪 ${comercio?.nombre || '-'}\n` +
      `📞 ${comercio?.telefono || '-'}\n` +
      `📌 ${comercio?.direccion || '-'}`;

    const origenDireccion = comercio?.direccion ?? '';
    const telOrigen = comercio?.telefono ?? '';

    // Si hay domi → estado 5 (OFERTADO). Si no, 0 (PENDIENTE)
    const estado = domiciliario ? 5 : 0;

    // Crear el pedido en BD
    const pedidoCreado = await this.domiciliosService.create({
      mensaje_confirmacion: 'Auto-ingreso (sticker oficial comercio)',
      estado, // 5 ofertado / 0 pendiente
      numero_cliente: telClienteNorm,
      fecha: new Date().toISOString(),
      hora: new Date().toTimeString().slice(0, 5),
      id_cliente: null,
      id_domiciliario: domiciliario?.id ?? null,
      tipo_servicio: 'sticker',          // etiqueta de origen
      origen_direccion: origenDireccion, // opcional
      destino_direccion: '',             // lo puede pedir el domi por chat luego
      telefono_contacto_origen: telOrigen,
      telefono_contacto_destino: '',
      notas: '',
      detalles_pedido: detalles,
      foto_entrega_url: '',
    });

    // Si HAY domiciliario: OFERTAR (NO abrir conversación aún)
    if (domiciliario) {
      // Avisar al cliente que estamos ofertando y permitir cancelar
      await this.enviarMensajeTexto(
        telClienteNorm,
        [
          '⏳ Estamos *procesando* tu pedido. Gracias por preferirnos'
        ].join('\n')
      );
      if (pedidoCreado?.id) {
        await this.mostrarMenuPostConfirmacion(
          telClienteNorm,
          pedidoCreado.id,
          '⏳ Si ya no lo necesitas, puedes cancelar:',
          60 * 1000
        );
      }

      // Armar resumen para el domiciliario (corto y seguro para WhatsApp)
      const resumenParaDomi = this.sanitizeWaBody(
        [
          '📦 *Nuevo pedido disponible*',
          '',
          comercio?.nombre ? `🏪 *Comercio:* ${comercio.nombre}` : '',
          origenDireccion ? `📍 *Recoger en:* ${origenDireccion}` : '',
          telOrigen ? `📞 *Tel:* ${telOrigen}` : '',
          '',
          // '📝 *Detalles:*\n' + detalles,
        ]
          .filter(Boolean)
          .join('\n')
      );

      // Enviar: texto + botones (IDs cortos: ACEPTAR_<id> / RECHAZAR_<id>)
      await this.enviarOfertaAceptarRechazarConId({
        telefonoDomi: domiciliario.telefono_whatsapp,
        pedidoId: pedidoCreado.id,
        resumenLargo: resumenParaDomi,
        bodyCorto: '¿Deseas tomar este pedido?',
      });

      // ❌ IMPORTANTE: NO crear conversación aquí. Se crea SOLO cuando el domi acepta.
      return;
    }

    // Si NO hay domiciliario: queda PENDIENTE (0) y se notifica al cliente
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



  private async finalizarConversacionPorDomi(conversacionId: number, monto?: number) {
    const conv = await this.conversacionRepo.findOne({ where: { id: String(conversacionId) } });
    if (!conv) return { ok: false, msg: 'No se encontró la conversación' };
    if (conv.estado === 'finalizada') return { ok: true }; // idempotente

    const cliente = conv.numero_cliente;
    const domi = conv.numero_domiciliario;

    // Helpers locales
    const norm = (n?: string) => (String(n || '').replace(/\D/g, ''));
    const variants = (n?: string) => {
      const d = norm(n);
      const ten = d.slice(-10);
      const v = new Set<string>();
      if (!ten) return v;
      v.add(ten);
      v.add(`57${ten}`);
      v.add(`+57${ten}`);
      v.add(d);
      return v;
    };
    const clearAllFor = (num?: string) => {
      for (const v of variants(num)) {
        // estado en memoria
        const st = estadoUsuarios.get(v);
        if (st) {
          delete st.conversacionId;
          delete st.flujoActivo;
          delete st.awaitingEstado;
          delete st.awaitingEstadoExpiresAt;
          delete st.soporteActivo;
          delete st.soporteConversacionId;
          delete st.soporteAsesor;
          delete st.soporteCliente;
          delete st.pedidoId;
          estadoUsuarios.delete(v);
        }
        // timers
        if (temporizadoresInactividad.has(v)) {
          clearTimeout(temporizadoresInactividad.get(v)!);
          temporizadoresInactividad.delete(v);
        }
        if (temporizadoresEstado.has(v)) {
          clearTimeout(temporizadoresEstado.get(v)!);
          temporizadoresEstado.delete(v);
        }
        if (bloqueoMenu.has(v)) {
          clearTimeout(bloqueoMenu.get(v)!);
          bloqueoMenu.delete(v);
        }
      }
    };

    // Mensajes (no bloquean el cierre si fallan)
    try {
      await this.enviarMensajeTexto(
        domi,
        `✅ *¡SERVICIO FINALIZADO CON ÉXITO!* 🚀
Gracias por tu entrega y compromiso 👏

👉 *Ahora elige tu estado:*`
      );
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
    } catch (e: any) {
      this.logger.warn(`⚠️ Botones de estado al domi fallaron: ${e?.response?.data?.error?.message || e?.message || e}`);
    }

    try {
      // 👇 línea opcional con el valor si viene definido
      const montoLinea =
        (typeof monto === 'number' && Number.isFinite(monto))
          ? `\n💵 *Valor del domicilio:* ${Math.round(monto).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}`
          : '';

      const mensajeCliente = [
        '✅ Gracias por confiar en nuestro servicio',
        'TU PEDIDO HA SIDO FINALIZADO CON ÉXITO.',
        montoLinea, // 👈 se agrega aquí
        '',
        '📲 Para mayor seguridad y transparencia escríbenos siempre al',
        '313 408 9563',
        'domiciliosw.com',
        '',
        '',
        '📞 Quejas, reclamos y afiliaciones: 314 242 3130 – Wilber Álvarez'
      ].join('\n');

      await this.enviarMensajeTexto(cliente, mensajeCliente);
    } catch (e: any) {
      this.logger.warn(`⚠️ Mensaje de cierre a cliente falló: ${e?.response?.data?.error?.message || e?.message || e}`);
    }
    // Persistencia: cerrar conversación SIEMPRE
    conv.estado = 'finalizada';
    conv.fecha_fin = new Date();
    try {
      await this.conversacionRepo.save(conv);
    } catch (e: any) {
      this.logger.error(`❌ No se pudo guardar el cierre de la conversación ${conversacionId}: ${e?.message || e}`);
      // seguimos con limpieza en memoria igualmente
    }

    // Limpieza en memoria/timers (todas las variantes de número)
    clearAllFor(cliente);
    clearAllFor(domi);

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


  // Normaliza a clave 57 + 10 dígitos
  private toKey(n: string) {
    const d = String(n || '').replace(/\D/g, '');
    const ten = d.slice(-10);
    return ten ? `57${ten}` : d;
  }

  // Lee un monto desde texto: soporta 15000, 15.000, $ 12.500, 12,5 etc.
  // Lee un monto desde texto PERO:
  // - Solo acepta dígitos (se ignoran $ . , espacios, etc.)
  // - Requiere al menos 4 cifras (>= 1000)
  // - Rechaza decimales
  // Solo acepta números enteros, sin símbolos ni separadores
  // Requiere al menos 4 cifras (>= 1000)
  private parseMonto(raw?: string): number | null {
    if (!raw) return null;

    const limpio = String(raw).trim();

    // ✅ Solo dígitos permitidos
    if (!/^\d+$/.test(limpio)) return null;

    // Convierte a número
    const n = Number(limpio);

    // Debe ser al menos 1000 (4 cifras)
    if (!Number.isFinite(n) || n < 1000) return null;

    return n;
  }

  // 👇 Añade estos helpers dentro de tu ChatbotService

  /** Solo texto limpio (no vacío) o respuestas de botones (interactive) */
  private esTextoValido(m: any): boolean {
    return (
      (m?.type === 'text' && typeof m?.text?.body === 'string' && m.text.body.trim().length > 0) ||
      m?.type === 'interactive' // botones/replies de WhatsApp
    );
  }

  /** Acepta únicamente stickers cuyo sha esté en STICKERS_RAPIDOS */
  private esStickerPermitido(m: any): boolean {
    if (m?.type !== 'sticker') return false;
    const sha = String(m?.sticker?.sha256 || '');
    return STICKERS_RAPIDOS.has(sha);
  }

  /** Devuelve true si es un medio que NO soportas por ahora */
  private esMedioNoSoportado(m: any): boolean {
    const t = m?.type;
    // Todo lo que no sea texto/interactive/sticker-permitido se bloquea
    // Lista típica de tipos: text, image, video, audio, voice, document, contacts, location, reaction, sticker, interactive, unknown
    if (t === 'text' || t === 'interactive') return false;
    if (t === 'sticker') return !this.esStickerPermitido(m);
    // cualquier otro tipo => no soportado
    return true;
  }


  /** Enviar oferta con Aceptar/Rechazar usando EL MISMO pedidoId.
 *  Envía (1) resumen como texto y (2) botones con body corto.
 */
  private async enviarOfertaAceptarRechazarConId(params: {
    telefonoDomi: string;
    pedidoId: number | string;
    resumenLargo?: string;                  // opcional, se envía antes como texto
    bodyCorto?: string;                     // por defecto: "¿Deseas tomar este pedido?"
  }) {
    const { telefonoDomi, pedidoId } = params;
    const to = this.toKey(telefonoDomi);
    const bodyCorto = params.bodyCorto ?? '¿Deseas tomar este pedido?';

    // (A) Enviar resumen como TEXTO (si viene)
    if (params.resumenLargo) {
      await this.enviarMensajeTexto(to, this.sanitizeWaBody(params.resumenLargo));
      await new Promise(r => setTimeout(r, 400)); // pequeña pausa antes del interactivo
    }

    // (B) Preparar body CORTO del interactivo (evitar >1024; nosotros lo acotamos a ~120)
    const body = this.sanitizeWaBody(bodyCorto, 120);

    // (C) Reintentos con backoff + jitter para errores transitorios
    const TRANSIENT = new Set([408, 429, 500, 502, 503, 504]);
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    let enviado = false;

    for (let i = 0; i < 3 && !enviado; i++) {
      try {
        await axiosWhatsapp.post('/messages', {
          messaging_product: 'whatsapp',
          to,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: body },
            action: {
              buttons: [
                { type: 'reply', reply: { id: `aceptar_pedido_${pedidoId}`, title: '✅ Aceptar' } },
                { type: 'reply', reply: { id: `rechazar_pedido_${pedidoId}`, title: '❌ Rechazar' } },
              ],
            },
          },
        });
        enviado = true;
      } catch (e: any) {
        const status = Number(e?.response?.status);
        if (!TRANSIENT.has(status)) break;               // error no transitorio -> salir
        const base = 400 * Math.pow(2, i);               // 400ms, 800ms, 1600ms
        const jitter = Math.floor(Math.random() * 250);  // +[0..250]ms
        await sleep(base + jitter);
      }
    }

    // (D) Fallback: texto + botones mínimos otra vez
    if (!enviado) {
      try { await this.enviarMensajeTexto(to, body); } catch { }
      try {
        await axiosWhatsapp.post('/messages', {
          messaging_product: 'whatsapp',
          to,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: 'Tomar pedido:' },
            action: {
              buttons: [
                { type: 'reply', reply: { id: `aceptar_pedido_${pedidoId}`, title: '✅ Aceptar' } },
                { type: 'reply', reply: { id: `rechazar_pedido_${pedidoId}`, title: '❌ Rechazar' } },
              ],
            },
          },
        });
      } catch { }
    }
  }


  // 👇 Pega esto dentro de ChatbotService (igual nivel que tus otros "private async ...")
  private sanitizeWaBody(s: string, max = 900): string {
    let t = String(s || '')
      .replace(/\r\n/g, '\n')     // CRLF -> LF
      .replace(/\u00A0/g, ' ')    // NBSP -> espacio normal
      .replace(/[ \t]+/g, ' ')    // colapsa tabs/espacios
      .replace(/\n{3,}/g, '\n\n') // máximo dos saltos de línea seguidos
      .trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }


}


