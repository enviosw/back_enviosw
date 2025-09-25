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
import { Cron, Interval } from '@nestjs/schedule';
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


type VigenciaOferta = { expira: number; domi: string };
const ofertasVigentes = new Map<number, VigenciaOferta>(); // pedidoId -> vigencia
const OFERTA_TIMEOUT_MS = 120_000;


// 🚀 Crea un pedido a partir del sticker oficial del COMERCIO
// 🚀 Crea un pedido a partir del sticker oficial del COMERCIO
// 🚀 Crea un pedido a partir del sticker oficial del COMERCIO (versión corregida)
// 👇 IDs de botones que usaremos
const BTN_STICKER_CONFIRM_SI = 'sticker_confirmar_si';
const BTN_STICKER_CONFIRM_NO = 'sticker_confirmar_no';

const BTN_STICKER_CREAR_SI = 'sticker_crear_otro_si';
const BTN_STICKER_CREAR_NO = 'sticker_crear_otro_no';

const ESTADOS_ABIERTOS = [0, 5, 1]; // pendiente, ofertado, asignado


const ASESOR_PSQR = '573142423130';

const TRIGGER_PALABRA_CLAVE = '1';
// 👉 Si mañana agregas más stickers, solo pon sus SHA aquí:
const STICKERS_RAPIDOS = new Set<string>([
  String(stickerConstants.stickerChad), // sticker oficial actual
]);


// ----- PON ESTO ARRIBA DEL ARCHIVO, JUNTO A TUS OTROS MAPS DE TEMPORIZADORES -----
const temporizadoresOferta = new Map<number, NodeJS.Timeout>(); // controla timeouts de reoferta por pedidoId
const cancelacionesProcesadas = new Map<string, number>();      // idempotencia por número de cliente
const CANCEL_TTL_MS = 60_000;

// 👇 NUEVO: idempotencia por botón (evita doble aceptación por reintentos)
const procesados = new Map<string, number>(); // key `${numero}:${pedidoId}`
const TTL_MS = 60_000;

let LAST_RETRY_AT = 0;
const MIN_GAP_MS = 30_000; // 30s de espacio entre reintentos globales

@Injectable()
export class ChatbotService {


  private readonly logger = new Logger(ChatbotService.name);
  private isRetryRunning = false; // 🔒 candado antisolape
  private readonly numeroNotificaciones = '573108054942'; // 👈 número fijo destino
  private readonly notifsPrecioCache = new Map<string, number>(); // idempotencia
  private readonly NOTIF_PRECIO_TTL_MS = 300_000; // 5 min para evitar duplicados

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


  @Cron('0 4 * * *', { timeZone: 'America/Bogota' })
  async cronReiniciarTurnos(): Promise<void> {
    this.logger.log('🔄 Iniciando reinicio diario de turnos (4:00 AM).');
    try {
      await this.domiciliarioService.reiniciarTurnosACeroYNoDisponibles();
      this.logger.log('✅ Reinicio de turnos completado (turno_orden=0, disponible=false).');

      await this.domiciliosService.vaciarTablaYReiniciarIds(); // <-- método Opción A (Postgres)

      this.logger.log('✅ Reinicio de domicilios');
    } catch (err: any) {
      this.logger.error(`❌ Falló el reinicio de turnos: ${err?.message || err}`);
    }
  }




  @Interval(20000) // cada 20,000 ms = 20 s
  async reintentarAsignacionPendientes(): Promise<void> {

    const now = Date.now();
    if ((now - LAST_RETRY_AT) < MIN_GAP_MS) {
      this.logger.debug('⛳ Cooldown activo; se omite este cron.');
      return;
    }

    if (this.isRetryRunning) {
      this.logger.log('⏳ Reintento ya en ejecución; se omite esta corrida.');
      return;
    }
    this.isRetryRunning = true;

    const MAX_WAIT_MS = 20 * 60 * 1000;


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
              '⏳ Estamos procesando tu domicilio ✨🛵\n\n🙏 Gracias por confiar en *Domicilios W*.',
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
            try { await this.domiciliarioService.liberarDomiciliario(domiciliario.id); } catch { }
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

          // ofertasVigentes.set(pedido.id, { domi: domiciliario.telefono_whatsapp, expira: Date.now() + 120_000 });
          ofertasVigentes.set(pedido.id, {
            expira: Date.now() + OFERTA_TIMEOUT_MS,              // <-- MS, NO segundos
            domi: this.toTelKey(domiciliario.telefono_whatsapp), // <-- normalizado
          });



          // 🧹 Limpia timeout previo de oferta para este pedido (si existía)
          const prev = temporizadoresOferta.get(pedido.id);
          if (prev) { clearTimeout(prev); temporizadoresOferta.delete(pedido.id); }

          // 6) Timeout: si el domi NO responde, vuelve a pendiente de forma ATÓMICA
          const to = setTimeout(async () => {
            try {
              const volvio = await this.domiciliosService.volverAPendienteSiOfertado(pedido.id); // 5 -> 0
              if (volvio) {
                // Avisar al domiciliario que la oferta expiró
                try {
                  const domi = await this.domiciliarioService.getById(domiciliario.id);
                  const tel = domi?.telefono_whatsapp;
                  if (tel) {
                    await this.enviarMensajeTexto(
                      tel,
                      '⏱️ La oferta expiró y fue asignada a otro domiciliario. Por favor no la aceptes ya.'
                    );
                  }
                } catch (e) {
                  this.logger.warn(`No pude notificar al domi ${domiciliario.id}: ${e instanceof Error ? e.message : e}`);
                }

                // (defensivo) liberar domi atado a la oferta
                // ✅ marcar disponible SIN mover turno
                try { await this.domiciliarioService.setDisponibleManteniendoTurnoById(domiciliario.id, true); } catch { }

                this.logger.warn(`⏰ Domi no respondió. Pedido ${pedido.id} vuelve a pendiente.`);
                ofertasVigentes.delete(pedido.id);
              }
              // Si no "volvió", es porque ya NO está en OFERTADO (ej: fue ASIGNADO o CANCELADO)
            } catch (e: any) {
              this.logger.error(`Timeout oferta falló para pedido ${pedido.id}: ${e?.message || e}`);
            } finally {
              // ✅ Siempre limpia el handle del timeout
              temporizadoresOferta.delete(pedido.id);
            }
          }, 120_000);


          // 🗂️ Registra el timeout para poder cancelarlo si el domi acepta o rechaza antes
          temporizadoresOferta.set(pedido.id, to);


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


    if (tipo === 'text') {
      const textoPlano = (texto || '').trim();

      // CANCELAR con ID opcional: "CANCELAR" o "CANCELAR #1234"
      const mCancelar = textoPlano.match(/^cancelar(?:\s*#?\s*(\d+))?$/i);
      if (mCancelar) {
        let pid = Number(mCancelar[1]);
        if (!pid) {
          // si no viene ID escrito, usa el que está en memoria para ese número
          const st = estadoUsuarios.get(numero) || {};
          pid = st.pedidoId;
        }
        if (!pid) {
          await this.enviarMensajeTexto(
            numero,
            '⚠️ No pude identificar el pedido a cancelar. Intenta: CANCELAR #<id>'
          );
          return;
        }

        // Verifica cancelable; si no, avisa
        if (!(await this.puedeCancelarPedido(pid))) {
          await this.enviarMensajeTexto(numero, '🔒 Este pedido ya no puede cancelarse. Esta en proceso...');
          return;
        }

        // Cancela de forma atómica
        await this.cancelarPedidoDesdeCliente(numero);
        return;
      }
    }

    // ── Normaliza a la clave de teléfono (57 + 10 dígitos)
const numeroKey =
  this.toKey ? this.toKey(numero) : (numero || '').replace(/\D/g, '').replace(/^(\d{10})$/, '57$1');

// Detecta temprano si el mensaje actual es un botón de "cancelar" para NO bloquear esa acción
const btnIdEarly =
  mensaje?.interactive?.type === 'button_reply'
    ? mensaje.interactive.button_reply.id
    : '';
const isBtnCancelarEarly =
  btnIdEarly === 'cancelar' ||
  btnIdEarly === 'menu_cancelar' ||
  /^cancelar_pedido_\d+$/.test(btnIdEarly) ||
  /^menu_cancelar_\d+$/.test(btnIdEarly);

// 💡 Rehidratación: si el cliente tiene un pedido en 0 o 5, activa el flag en memoria
try {
  let stMem = estadoUsuarios.get(numeroKey) || {};
  if (!stMem.esperandoAsignacion) {
    const pedido = await this.domiciliosService.getPedidoEnProceso(numeroKey); // 0/5
    if (pedido) {
      stMem.esperandoAsignacion = true;
      stMem.pedidoId = pedido.id; // opcional: te sirve para “cancelar”
      estadoUsuarios.set(numeroKey, stMem);
    }
  }
} catch (e) {
  this.logger.warn(
    `⚠️ Rehidratación de pedido en proceso falló para ${numeroKey}: ${e instanceof Error ? e.message : e}`
  );
}

// 🛡️ Guard: si hay pedido en 0/5, responde “procesando” (pero NO bloquea cancelar)
const stNow = estadoUsuarios.get(numeroKey);
if (stNow?.esperandoAsignacion && !isBtnCancelarEarly && !stNow?.conversacionId) {
  await this.enviarMensajeTexto(
    numero,
    '⏳ Estamos procesando tu domicilio ✨🛵\n\n🙏 Gracias por tu paciencia y confianza.'
  );
  return;
}


    // --- CAPTURA DE PRECIO EN CURSO ---
    {
      const key = this.toKey(numero);
      const stLocal = estadoUsuarios.get(key) || estadoUsuarios.get(numero);

      if (tipo === 'text' && stLocal?.capturandoPrecio && !stLocal?.conversacionFinalizada) {
        const monto = this.parseMonto(texto || '');
        if (monto === null) {
          await this.enviarMensajeTexto(
            numero,
            '❌ No pude leer el valor. Intenta de nuevo, ejemplo: 15000 o 12.500'
          );
          return;
        }

        // ✅ Validación de mínimo
        if (monto < 5000) {
          await this.enviarMensajeTexto(
            numero,
            '⚠️ El precio mínimo del domicilio es *5.000*. Ingresa un valor igual o mayor. Ejemplos: 5000, 5.000, 12.500'
          );
          // seguimos en modo captura (no cambiamos flags) para que el usuario reingrese el valor
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

        // await this.enviarMensajeTexto(
        //   numero,
        //   `⚡ *Pedido rápido activado* (palabra clave: ${TRIGGER_PALABRA_CLAVE}).\nRevisando domiciliarios...`
        // );

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


    // Detectar si viene un button_reply y si es de cancelar
    const btnId =
      mensaje?.interactive?.type === 'button_reply'
        ? mensaje.interactive.button_reply.id
        : '';

    const isBtnCancelar =
      btnId === 'cancelar' ||
      btnId === 'menu_cancelar' ||
      /^cancelar_pedido_\d+$/.test(btnId) ||
      /^menu_cancelar_\d+$/.test(btnId);

    // Guard de "esperando asignación", pero NO bloquea los botones de cancelar
    if (estado?.esperandoAsignacion && !isBtnCancelar) {
      await this.enviarMensajeTexto(
        numero,
        '⏳ Estamos procesando tu domicilio ✨🛵\n\n🙏 Gracias por tu paciencia y confianza.'
      );
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
      // 🚀 Enviar saludo simple en texto
      const saludoSimple = `👋 Hola, ${nombre} Soy Wil-Bot 🤖

👉 Pide fácil en: https://domiciliosw.com
👉 Si ya estás registrado envía el número *1*`;

      await this.enviarMensajeTexto(numero, saludoSimple);


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

      // MATCH de los distintos formatos de botón de cancelar
      const isCancelar =
        id === 'cancelar' ||
        id === 'menu_cancelar' ||
        /^cancelar_pedido_\d+$/.test(id) ||
        /^menu_cancelar_\d+$/.test(id);

      if (isCancelar) {
        const st = estadoUsuarios.get(numero) || {};

        // 1) Resolver pedidoId a partir del ID del botón o del estado en memoria
        let pedidoId: number | null = null;

        // menu_cancelar_223  -> grupo 1 = 223
        let m = id.match(/^menu_cancelar_(\d+)$/);
        if (m) pedidoId = Number(m[1]);

        // cancelar_pedido_223 -> grupo 1 = 223
        if (!pedidoId) {
          m = id.match(/^cancelar_pedido_(\d+)$/);
          if (m) pedidoId = Number(m[1]);
        }

        // Si no vino en el botón, usar el que tengamos en memoria
        if (!pedidoId) {
          pedidoId = st.pedidoId ?? null;
        }

        if (!pedidoId) {
          this.logger.warn(`❗ Cancelar: no encontré pedido activo para ${numero} (id botón: ${id})`);
          await this.enviarMensajeTexto(
            numero,
            'No encuentro un pedido activo para cancelar ahora. Si crees que es un error, escribe "menu".'
          );
          return;
        }

        // 2) Anti-doble cancelación (doble tap o reintento de WhatsApp)
        try {
          const key = `${numero}:${pedidoId}`;
          const now = Date.now();
          const TTL = 60_000; // 60s
          const expira = cancelacionesProcesadas.get(key);

          if (expira && now < expira) {
            this.logger.debug(`(cancel) duplicado ignorado -> ${key}`);
            await this.enviarMensajeTexto(numero, '✅ Ya habíamos registrado tu cancelación.');
            return;
          }
          cancelacionesProcesadas.set(key, now + TTL);
        } catch (e) {
          this.logger.debug(`(cancel) no se pudo usar cancelacionesProcesadas: ${e?.message || e}`);
        }

        // 3) Leer el pedido actual
        const pedido = await this.getPedidoById(pedidoId).catch(() => null);
        if (!pedido) {
          await this.enviarMensajeTexto(numero, 'No encuentro tu pedido, quizá ya fue cancelado.');
          return;
        }

        // Si ya estaba cancelado, confirmar y salir
        if (pedido.estado === 2) {
          await this.enviarMensajeTexto(numero, '✅ Tu pedido ya estaba cancelado.');
          return;
        }

        // 4) Si estaba ofertado (5) con domi, liberar domi
        if (pedido.estado === 5 && pedido.id_domiciliario) {
          try {
            await this.domiciliarioService.liberarDomiciliario(pedido.id_domiciliario);
          } catch (e) {
            this.logger.warn(`No pude liberar domi ${pedido.id_domiciliario} al cancelar: ${e?.message || e}`);
          }
        }

        // 5) Marcar cancelado en BD
        try {
          await this.domiciliosService.update(pedidoId, {
            estado: 2, // cancelado
            id_domiciliario: null,
            motivo_cancelacion: 'Cancelado por el cliente (botón)',
          });
        } catch (e) {
          this.logger.error(`Fallo al marcar cancelado el pedido ${pedidoId}: ${e?.message || e}`);
          await this.enviarMensajeTexto(numero, 'Tuvimos un problema al cancelar. Inténtalo de nuevo.');
          return;
        }

        // 6) Limpiar timers/mapas de oferta si los usas
        try {
          const t = temporizadoresOferta?.get(pedidoId);
          if (t) {
            clearTimeout(t);
            temporizadoresOferta.delete(pedidoId);
          }
        } catch { /* opcional */ }

        try {
          if (ofertasVigentes?.has(pedidoId)) {
            ofertasVigentes.delete(pedidoId);
          }
        } catch { /* opcional */ }

        // 7) Limpiar estado en memoria del usuario
        try {
          st.esperandoAsignacion = false;
          if (st.pedidoId === pedidoId) {
            delete st.pedidoId;
          }
          // opcional: si usas idempotencia en memoria
          // delete st.ultimoIdemKey; delete st.ultimoPedidoTs;
          estadoUsuarios.set(numero, st);
        } catch { /* opcional */ }

        // 8) Confirmar al cliente
        await this.enviarMensajeTexto(
          numero,
          '❌ Tu pedido ha sido *cancelado*. Si necesitas algo más, responde "hola" para empezar de nuevo.'
        );

        return;
      }
      // =========================
      // ACEPTAR / RECHAZAR OFERTA
      // =========================


      const matchAceptar = id.match(/^(?:ACEPTAR|aceptar_pedido)_(\d+)$/);
      if (matchAceptar) {
        const pedidoId = Number(matchAceptar[1]);

        // Idempotencia anti doble-tap / reintentos
        const key = `${numero}:${pedidoId}`;
        const now = Date.now();
        const last = procesados.get(key);
        if (last && (now - last) < TTL_MS) return;

        // 🔎 VALIDACIÓN SOLO POR ESTADO DEL PEDIDO (pre-chequeo rápido)
        const pedidoCheck = await this.getPedidoById(pedidoId);

        if (!pedidoCheck) {
          await this.enviarMensajeTexto(numero, '⚠️ El pedido ya no existe.');
          try {
            await axiosWhatsapp.post('/messages', {
              messaging_product: 'whatsapp',
              to: numero,
              type: 'interactive',
              interactive: {
                type: 'button',
                body: { text: '¿Quieres seguir disponible para nuevos pedidos?' },
                action: {
                  buttons: [
                    { type: 'reply', reply: { id: 'cambiar_a_disponible', title: '✅ Disponible' } },
                    { type: 'reply', reply: { id: 'cambiar_a_no_disponible', title: '🛑 No disponible' } },
                  ],
                },
              },
            });
          } catch (e) {
            this.logger.warn(`⚠️ Falló envío de botones (no existe): ${e?.message || e}`);
          }
          procesados.set(key, now);
          return;
        }

        // ⛔ Guardia "suave" en memoria: NO corta, solo loguea; la BD decide
        const who =
          (this as any).toTelKey
            ? (this as any).toTelKey(numero)
            : (numero || '').replace(/\D/g, '').replace(/^(\d{10})$/, '57$1'); // normaliza 57xxxxxxxxxx
        const vig = ofertasVigentes.get(pedidoId);
        if (!vig || Date.now() > vig.expira || vig.domi !== who) {
          this.logger.warn(
            `⚠️ Guardia oferta p=${pedidoId} vig=${!!vig} ` +
            `expirado=${vig ? Date.now() > vig.expira : 'n/a'} ` +
            `domiOK=${vig ? (vig.domi === who) : 'n/a'}`
          );
          // IMPORTANTE: no hacemos return; seguimos y dejamos que la BD confirme
        }

        if (pedidoCheck.estado === 1) { // ASIGNADO
          await this.enviarMensajeTexto(numero, '⏱️ El pedido ya fue asignado, no puedes aceptarlo.');
          await this.domiciliarioService.setDisponibleManteniendoTurnoByTelefono(numero, true);
          await this.enviarMensajeTexto(numero, '✅ Sigues disponible y conservas tu turno.');
          procesados.set(key, now);
          return;
        }

        if (pedidoCheck.estado === 2) { // CANCELADO
          await this.enviarMensajeTexto(numero, '⏱️ El pedido ya fue cancelado, no está disponible.');
          await this.domiciliarioService.setDisponibleManteniendoTurnoByTelefono(numero, true);
          await this.enviarMensajeTexto(numero, '✅ Sigues disponible y conservas tu turno.');
          procesados.set(key, now);
          return;
        }

        if (pedidoCheck.estado !== 5) { // NO OFERTADO u otro
          await this.enviarMensajeTexto(numero, '⚠️ El pedido ya no está disponible.');
          await this.domiciliarioService.setDisponibleManteniendoTurnoByTelefono(numero, true);
          await this.enviarMensajeTexto(numero, '✅ Sigues disponible y conservas tu turno.');
          procesados.set(key, now);
          return;
        }


        // ✅ Resolver domi (mínimo: que exista)
        const domi = await this.domiciliarioService.getByTelefono(numero);
        if (!domi) {
          await this.enviarMensajeTexto(numero, '⚠️ No pude validar tu cuenta de domiciliario.');
          procesados.set(key, now);
          return;
        }
        const domiId = domi.id;

        // (Opcional) si la oferta es para un domi específico:
        // if (pedidoCheck.id_domiciliario && pedidoCheck.id_domiciliario !== domiId) {
        //   await this.enviarMensajeTexto(numero, '⚠️ Esta oferta no estaba dirigida a ti.');
        //   procesados.set(key, now);
        //   return;
        // }

        // (opcional) limpia timeout de oferta si llevas uno por pedido
        const tLocal = temporizadoresOferta?.get?.(pedidoId);
        if (tLocal) { clearTimeout(tLocal); temporizadoresOferta.delete(pedidoId); }

        // 🧱 Confirmación ATÓMICA en BD (5→1). La BD es la fuente de la verdad.
        let ok = false;
        try {
          ok = await this.domiciliosService.confirmarAsignacionSiOfertado(pedidoId, domiId);
        } catch (e: any) {
          this.logger.error(`Error confirmando asignación ${pedidoId}: ${e?.message || e}`);
        }
        procesados.set(key, now);

        if (!ok) {
          await this.enviarMensajeTexto(numero, '⏱️ La oferta ya expiró o se reasignó.');
          // Fallback: botones de estado (desktop a veces no los dibuja automáticamente)
          try {
            await axiosWhatsapp.post('/messages', {
              messaging_product: 'whatsapp',
              to: numero,
              type: 'interactive',
              interactive: {
                type: 'button',
                body: { text: '¿Quieres seguir disponible para nuevos pedidos?' },
                action: {
                  buttons: [
                    { type: 'reply', reply: { id: 'cambiar_a_disponible', title: '✅ Disponible' } },
                    { type: 'reply', reply: { id: 'cambiar_a_no_disponible', title: '🛑 No disponible' } },
                  ],
                },
              },
            });
          } catch { }
          return;
        }

        // Éxito: limpia vigencia en memoria para ese pedido
        ofertasVigentes.delete(pedidoId);

        // 🔄 Crear conversación (solo tras aceptación exitosa)
        const conversacion = this.conversacionRepo.create({
          numero_domiciliario: numero,
          fecha_inicio: new Date(),
          estado: 'activa',
        });
        const pedidoParaDatos = pedidoCheck ?? await this.getPedidoById(pedidoId);
        if (pedidoParaDatos) conversacion.numero_cliente = pedidoParaDatos.numero_cliente;
        await this.conversacionRepo.save(conversacion);

        estadoUsuarios.set(conversacion.numero_cliente, {
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

        // 👤 Notificar CLIENTE
        const nombreDomi = `${domi.nombre ?? ''} ${domi.apellido ?? ''}`.trim() || numero;
        const chaqueta = domi?.numero_chaqueta ?? '-';
        const telDomi = numero.startsWith('+') ? numero : `+57${numero.replace(/\D/g, '').slice(-10)}`;
        if (pedidoParaDatos?.numero_cliente) {
          await this.enviarMensajeTexto(
            pedidoParaDatos.numero_cliente,
            [
              '✅ ¡Domiciliario asignado!',
              `👤 *${nombreDomi}*`,
              `🧥 Chaqueta: *${chaqueta}*`,
              `📞 Teléfono: *${telDomi}*`,
              '',
              '📲 Ya estás conectado con el domiciliario. Puedes escribirle por este mismo chat. ✅'
            ].join('\n')
          );
        }

        await this.enviarBotonFinalizarAlDomi(numero);
        return;
      }


      // ======================= RECHAZAR PEDIDO =======================
      const matchRechazar = id.match(/^(?:RECHAZAR|rechazar_pedido)_(\d+)$/);
      if (matchRechazar) {
        const pedidoId = Number(matchRechazar[1]);

        // Idempotencia anti doble-tap / reintentos
        const key = `${numero}:RECHAZAR:${pedidoId}`;
        const now = Date.now();
        const last = procesados.get(key);
        if (last && (now - last) < TTL_MS) return;

        // 🔎 Pre-chequeo rápido por estado
        const pedidoCheck = await this.getPedidoById(pedidoId);
        if (!pedidoCheck) {
          await this.enviarMensajeTexto(numero, '⚠️ El pedido ya no existe.');
          try {
            await axiosWhatsapp.post('/messages', {
              messaging_product: 'whatsapp',
              to: numero,
              type: 'interactive',
              interactive: {
                type: 'button',
                body: { text: '¿Quieres seguir disponible para nuevos pedidos?' },
                action: {
                  buttons: [
                    { type: 'reply', reply: { id: 'cambiar_a_disponible', title: '✅ Disponible' } },
                    { type: 'reply', reply: { id: 'cambiar_a_no_disponible', title: '🛑 No disponible' } },
                  ],
                },
              },
            });
          } catch (e) {
            this.logger.warn(`⚠️ Falló envío de botones (no existe): ${e?.message || e}`);
          }
          procesados.set(key, now);
          return;
        }

        // ⛔ Guardia en memoria: ahora solo loguea, no corta
        const who =
          (this as any).toTelKey
            ? (this as any).toTelKey(numero)
            : (numero || '').replace(/\D/g, '').replace(/^(\d{10})$/, '57$1');
        const vig = ofertasVigentes.get(pedidoId);
        if (!vig || Date.now() > vig.expira || vig.domi !== who) {
          this.logger.warn(
            `⚠️ Guardia RECHAZAR p=${pedidoId} vig=${!!vig} ` +
            `expirado=${vig ? Date.now() > vig.expira : 'n/a'} ` +
            `domiOK=${vig ? (vig.domi === who) : 'n/a'}`
          );
          // OJO: no hacemos return, la BD decide
        }

        if (pedidoCheck.estado === 1) { // ASIGNADO
          await this.enviarMensajeTexto(numero, '⏱️ El pedido ya fue asignado, no puedes rechazarlo.');
          try {
            await this.domiciliarioService.setDisponibleManteniendoTurnoByTelefono(numero, true);
          } catch (e) {
            this.logger.warn(`⚠️ Falló al actualizar disponibilidad (asignado): ${e?.message || e}`);
          }
          await this.enviarMensajeTexto(numero, '✅ Sigues disponible y conservas tu turno.');
          procesados.set(key, now);
          return;
        }

        if (pedidoCheck.estado === 2) { // CANCELADO
          await this.enviarMensajeTexto(numero, '⏱️ El pedido ya fue cancelado.');
          try {
            await this.domiciliarioService.setDisponibleManteniendoTurnoByTelefono(numero, true);
          } catch (e) {
            this.logger.warn(`⚠️ Falló al actualizar disponibilidad (cancelado): ${e?.message || e}`);
          }
          await this.enviarMensajeTexto(numero, '✅ Sigues disponible y conservas tu turno.');
          procesados.set(key, now);
          return;
        }

        if (pedidoCheck.estado !== 5) { // NO OFERTADO
          await this.enviarMensajeTexto(numero, '⏱️ Te demoraste en responder. El pedido ya no está disponible.');
          try {
            await this.domiciliarioService.setDisponibleManteniendoTurnoByTelefono(numero, true);
          } catch (e) {
            this.logger.warn(`⚠️ Falló al actualizar disponibilidad (no ofertado): ${e?.message || e}`);
          }
          await this.enviarMensajeTexto(numero, '✅ Sigues disponible y conservas tu turno.');
          procesados.set(key, now);
          return;
        }

        // ⛳️ **GUARDA EL DOMI ANTES DE REVERTIR** (porque luego puede quedar en null)
        const pedidoAntes = await this.getPedidoById(pedidoId);
        const domiIdOriginal = pedidoAntes?.id_domiciliario ?? null;

        // 🚦 Intento atómico: revertir solo si sigue en estado OFERTADO (5)
        const ok = await this.domiciliosService.volverAPendienteSiOfertado(pedidoId);
        procesados.set(key, now);

        if (!ok) {
          await this.enviarMensajeTexto(numero, '⏱️ Te demoraste en responder. El pedido ya no está disponible.');
          return;
        }

        // 🧹 Limpiar timeout de oferta si existía
        const t = temporizadoresOferta?.get?.(pedidoId);
        if (t) { clearTimeout(t); temporizadoresOferta.delete(pedidoId); }

        // ✅ Marcar domi DISPONIBLE manteniendo turno (usando el domi cacheado)
        try {
          if (domiIdOriginal) {
            await this.domiciliarioService.setDisponibleManteniendoTurnoById(domiIdOriginal, true);
            // (opcional) verificar y loguear
            // const check = await this.domiciliarioService.getById(domiIdOriginal);
            // this.logger.log(`Domi ${domiIdOriginal} disponible=${check?.disponible}`);
          } else {
            // Fallback: por si ya estaba null, usa el teléfono del domi que rechazó
            await this.domiciliarioService.setDisponibleManteniendoTurnoByTelefono(numero, true);
          }
        } catch (e) {
          this.logger.warn(`No se pudo marcar disponible (manteniendo turno) tras rechazo en pedido ${pedidoId}: ${e instanceof Error ? e.message : e}`);
        }

        // Mensaje al domiciliario
        await this.enviarMensajeTexto(
          numero,
          '❌ Has rechazado el pedido. Quedaste *DISPONIBLE* y conservas tu *turno*.'
        );

        // Reintentar asignación a otros domis (tu flujo actual)
        return;
      }
      // ===================== FIN RECHAZAR PEDIDO =====================


      // ====== HANDLERS DE BOTONES DEL FLUJO STICKER ======

      /** Anti-doble click: 3s de ventana */
      const CLICK_GUARD_MS = 3000;
      const clickGuard = new Map<string, number>(); // key = `${numeroKey}:${id}`

      // Utilidad local
      const canProceedClick = (numeroKey: string, btnId: string) => {
        const k = `${numeroKey}:${btnId}`;
        const now = Date.now();
        const last = clickGuard.get(k) || 0;
        if (now - last < CLICK_GUARD_MS) return false;
        clickGuard.set(k, now);
        return true;
      };

      // 1) Confirmación previa del sticker (NO crear aún)
      if (id === BTN_STICKER_CONFIRM_SI) {
        const numeroKey = this.toKey(numero);
        if (!canProceedClick(numeroKey, id)) return;

        const st = estadoUsuarios.get(numeroKey) || {};
        const payload = st.stickerConfirmPayload || null;

        // Marca que confirmó
        st.stickerConfirmCreate = true;
        estadoUsuarios.set(numeroKey, st);

        try {
          // Si tenemos snapshot del comercio úsalo; de lo contrario, deja que el método lo resuelva con el número
          const comercioSnap = payload?.comercioSnap ?? undefined;
          const nombreContacto = payload?.nombreContacto ?? undefined;

          await this.crearPedidoDesdeSticker(numeroKey, comercioSnap, nombreContacto);
        } finally {
          // limpieza suave
          const st2 = estadoUsuarios.get(numeroKey) || {};
          delete st2.stickerConfirmPayload;
          estadoUsuarios.set(numeroKey, st2);
        }
        return;
      }

      if (id === BTN_STICKER_CONFIRM_NO) {
        const numeroKey = this.toKey(numero);
        if (!canProceedClick(numeroKey, id)) return;

        const st = estadoUsuarios.get(numeroKey) || {};
        delete st.stickerConfirmCreate;
        delete st.stickerConfirmPayload;
        estadoUsuarios.set(numeroKey, st);

        await this.enviarMensajeTexto(numeroKey, '👍 Operación cancelada.');
        return;
      }

      // 2) Segunda confirmación cuando ya hay un pedido abierto
      if (id === BTN_STICKER_CREAR_SI) {
        const numeroKey = this.toKey(numero);
        if (!canProceedClick(numeroKey, id)) return;

        const st = estadoUsuarios.get(numeroKey) || {};

        // Marcar que el usuario confirmó forzar la creación
        st.stickerForceCreate = true;
        estadoUsuarios.set(numeroKey, st);

        // Recuperar snapshot guardado (puede no estar si se perdió memoria)
        const payload = st.stickerForcePayload || null;
        const comercioSnap = payload?.comercioSnap ?? undefined;
        const nombreContacto = payload?.nombreContacto ?? undefined;

        try {
          await this.crearPedidoDesdeSticker(numeroKey, comercioSnap, nombreContacto);
        } finally {
          // Limpieza y quitar bandera
          const st2 = estadoUsuarios.get(numeroKey) || {};
          st2.stickerForceCreate = false;
          delete st2.stickerForcePayload;
          estadoUsuarios.set(numeroKey, st2);
        }
        return;
      }

      if (id === BTN_STICKER_CREAR_NO) {
        const numeroKey = this.toKey(numero);
        if (!canProceedClick(numeroKey, id)) return;

        const st = estadoUsuarios.get(numeroKey) || {};
        delete st.stickerForceCreate;
        delete st.stickerForcePayload;
        estadoUsuarios.set(numeroKey, st);

        await this.enviarMensajeTexto(
          numeroKey,
          '👍 Operación cancelada. Si necesitas un domicilio, envía el sticker de nuevo cuando quieras.'
        );
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

        // 1) Validaciones básicas de estado
        if (!conversacionId) {
          await this.enviarMensajeTexto(numero, '⚠️ No encontré la conversación para finalizar.');
          return;
        }
        if (typeof s?.precioTmp !== 'number' || !Number.isFinite(s.precioTmp)) {
          await this.enviarMensajeTexto(numero, '⚠️ No encontré un precio válido para finalizar.');
          return;
        }

        // 2) Validar/normalizar precio (2 decimales, > 0 y razonable)
        const monto = Math.round(s.precioTmp * 100) / 100;
        if (monto <= 0) {
          await this.enviarMensajeTexto(numero, '⚠️ El precio debe ser mayor a 0.');
          return;
        }
        if (monto > 10_000_000) {
          await this.enviarMensajeTexto(numero, '⚠️ El precio es demasiado alto. Verifica e intenta de nuevo.');
          return;
        }
        const costoStr = monto.toFixed(2);

        // 3) Validar conversación y que el mismo domiciliario confirme
        const conv = await this.conversacionRepo.findOne({ where: { id: conversacionId } });
        if (!conv) {
          await this.enviarMensajeTexto(numero, '⚠️ No se encontró la conversación en el sistema.');
          return;
        }
        const numeroKey = this.toKey(numero); // normaliza igual que en DB
        const convNumeroKey = this.toKey(conv.numero_domiciliario || '');
        if (numeroKey !== convNumeroKey) {
          await this.enviarMensajeTexto(numero, '⛔ Solo el domiciliario puede finalizar este pedido.');
          return;
        }

        // 4) Idempotencia
        const idemKey = `precio:${conversacionId}:${numeroKey}:${costoStr}`;
        const now = Date.now();
        const last = this.notifsPrecioCache.get(idemKey) || 0;
        if (now - last < this.NOTIF_PRECIO_TTL_MS) {
          this.logger.warn(`🔁 Confirmación de precio duplicada omitida para ${idemKey}`);
          const { ok, msg } = await this.finalizarConversacionPorDomi(conversacionId, monto);
          if (!ok) {
            await this.enviarMensajeTexto(numero, `❌ No fue posible finalizar: ${msg || 'Error desconocido'}`);
          }
          return;
        }

        // 5) Guardar y notificar (con nombre)
        try {
          // 🔎 Obtener el domiciliario por teléfono
          // Asegúrate de que telefono_whatsapp en BD tenga el mismo formato que numeroKey
          const domi = await this.domiciliarioService.getByTelefono(numeroKey);
          const nombreDomi = domi?.nombre || 'N/D';
          const apellidoomi = domi?.apellido || 'N/D';
          const numeroChaq = domi?.numero_chaqueta || 'N/D';

          // Guardar en BD (agrega el campo si existe en tu entidad)
          await this.precioRepo.save({
            numero_domiciliario: numeroKey,
            costo: costoStr,
          });

          // Notificación a tu número fijo
          await axiosWhatsapp.post('/messages', {
            messaging_product: 'whatsapp',
            to: this.numeroNotificaciones,
            type: 'text',
            text: {
              body: `📦 Precio confirmado
👤 Domiciliario: ${nombreDomi} ${apellidoomi ?? ''}
🅽 Chaqueta: ${numeroChaq ?? ''}
📱 Número: ${numeroKey}
💲 Costo: ${costoStr}
`,
            },
          });

          // marcar idempotencia
          this.notifsPrecioCache.set(idemKey, now);

        } catch (e) {
          this.logger.error(`❌ Error guardando/notificando precio: ${e instanceof Error ? e.message : e}`);
          await this.enviarMensajeTexto(numero, '⚠️ No pude guardar o notificar el precio. Intenta confirmar nuevamente.');
          return;
        }

        // 6) Cerrar flags de estado y finalizar conversación
        s.confirmandoPrecio = false;
        s.capturandoPrecio = false;
        s.conversacionFinalizada = true;
        estadoUsuarios.set(numero, s);

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
        const tipo = (st?.tipo || 'servicio').replace('opcion_', '');

        // ===== Idempotencia y anti-doble-tap (solo memoria, sin tocar BD) =====
        const ahora = Date.now();
        const idemKey = [
          numero,
          tipo,
          datos.direccionRecoger ?? '',
          (datos.direccionEntregar ?? datos.direccionEntrega) ?? '',
          datos.telefonoRecoger ?? '',
          (datos.telefonoEntregar ?? datos.telefonoEntrega) ?? '',
          (datos.listaCompras ?? '').trim(),
        ].join('|');

        // Reuso si el mismo pedido ya fue creado en los últimos 5 min
        if (
          st.ultimoIdemKey === idemKey &&
          st.pedidoId &&
          typeof st.ultimoPedidoTs === 'number' &&
          (ahora - st.ultimoPedidoTs) < 5 * 60 * 1000
        ) {
          this.logger.warn(`🛡️ Idempotencia: duplicado evitado (reuso pedidoId=${st.pedidoId})`);
          await this.mostrarMenuPostConfirmacion(
            numero,
            st.pedidoId,
            st.esperandoAsignacion
              ? '⏳ Estamos procesando tu domicilio ✨🛵\n\n🙏 Gracias por confiar en *Domicilios W*.'

              : '⏳ Si ya no lo necesitas, puedes cancelar:',
            st.esperandoAsignacion ? 60 * 1000 : 60 * 1000
          );
          return;
        }

        // Candado 20s para taps muy seguidos
        if (st.creandoPedidoHasta && ahora < st.creandoPedidoHasta) {
          this.logger.warn('🛡️ Candado activo: ignorando confirmación duplicada muy cercana.');
          return;
        }
        st.creandoPedidoHasta = ahora + 20_000;
        estadoUsuarios.set(numero, st);
        // =====================================================================

        try {
          // 1) Intentar asignar un domiciliario disponible
          domiciliario = await this.domiciliarioService.asignarDomiciliarioDisponible();

          // Si NO hay domiciliario disponible → PENDIENTE (0) y aviso
          if (!domiciliario) {
            this.logger.warn('⚠️ No hay domiciliarios disponibles en este momento.');

            st.esperandoAsignacion = true;
            st.avisoNoDomiEnviado = Boolean(st.avisoNoDomiEnviado);

            if (!st.avisoNoDomiEnviado) {
              // await this.enviarMensajeTexto(numero, '🚨');
              // const aviso = [
              //   'Con mucho gusto estamos procesando tu domicilio ✨🛵',
              //   '',
              //   'En breve te avisaremos cuando asignemos el domiciliario ✅',
              //   '',
              //   '🙏 Gracias por tu paciencia y confianza.'
              // ].join('\n');

              // await this.enviarMensajeTexto(numero, aviso);
              st.avisoNoDomiEnviado = true;
            } else {
              this.logger.debug('ℹ️ Aviso de no disponibilidad ya enviado. Se evita duplicar.');
            }
            estadoUsuarios.set(numero, st);

            // Reuso si ya existe pedido reciente con misma firma
            if (st.ultimoIdemKey === idemKey && st.pedidoId) {
              this.logger.warn(`🛡️ Idempotencia (pendiente): reuso pedidoId=${st.pedidoId}`);
              await this.mostrarMenuPostConfirmacion(
                numero,
                st.pedidoId,
                '⏳ Estamos procesando tu domicilio ✨🛵\n\n🙏 Gracias por confiar en *Domicilios W*.'
                ,
                60 * 1000
              );
              return;
            }

            const pedidoPendiente = await this.domiciliosService.create({
              mensaje_confirmacion: 'Confirmado por el cliente vía WhatsApp',
              estado: 0,
              numero_cliente: numero,
              fecha: new Date().toISOString(),
              hora: new Date().toTimeString().slice(0, 5),
              id_cliente: null,
              id_domiciliario: null,
              tipo_servicio: tipo,
              origen_direccion: datos.direccionRecoger ?? '',
              destino_direccion: datos.direccionEntregar ?? datos.direccionEntrega ?? '',
              telefono_contacto_origen: datos.telefonoRecoger ?? '',
              telefono_contacto_destino: datos.telefonoEntregar ?? datos.telefonoEntrega ?? '',
              notas: '',
              detalles_pedido: datos.listaCompras ?? '',
              foto_entrega_url: '',
            });

            if (pedidoPendiente?.id) {
              // Actualiza estado idempotente
              st.ultimoIdemKey = idemKey;
              st.pedidoId = pedidoPendiente.id;
              st.ultimoPedidoTs = Date.now();
              estadoUsuarios.set(numero, st);

              await this.mostrarMenuPostConfirmacion(
                numero,
                pedidoPendiente.id,
                '⏳ Estamos procesando tu domicilio ✨🛵\n\n🙏 Gracias por confiar en *Domicilios W*.'
                ,
                60 * 1000
              );
            }
            return;
          }

          // 2) Sí hay domi: crear pedido como OFERTADO
          // Reuso si ya existe pedido reciente con misma firma
          if (st.ultimoIdemKey === idemKey && st.pedidoId) {
            this.logger.warn(`🛡️ Idempotencia (ofertado): reuso pedidoId=${st.pedidoId}`);
            await this.enviarMensajeTexto(numero, '⏳ Estamos procesando tu domicilio. Gracias por preferirnos.');
            await this.mostrarMenuPostConfirmacion(
              numero,
              st.pedidoId,
              '⏳ Si ya no lo necesitas, puedes cancelar:',
              60 * 1000
            );
            return;
          }

          const pedidoOfertado = await this.domiciliosService.create({
            mensaje_confirmacion: 'Confirmado por el cliente vía WhatsApp',
            estado: 5, // ofertado
            numero_cliente: numero,
            fecha: new Date().toISOString(),
            hora: new Date().toTimeString().slice(0, 5),
            id_cliente: null,
            id_domiciliario: domiciliario.id,
            tipo_servicio: tipo,
            origen_direccion: datos.direccionRecoger ?? '',
            destino_direccion: datos.direccionEntregar ?? datos.direccionEntrega ?? '',
            telefono_contacto_origen: datos.telefonoRecoger ?? '',
            telefono_contacto_destino: datos.telefonoEntregar ?? datos.telefonoEntrega ?? '',
            notas: '',
            detalles_pedido: datos.listaCompras ?? '',
            foto_entrega_url: '',
          });

          // Actualiza estado idempotente
          if (pedidoOfertado?.id) {
            st.ultimoIdemKey = idemKey;
            st.pedidoId = pedidoOfertado.id;
            st.ultimoPedidoTs = Date.now();
            st.esperandoAsignacion = false;
            estadoUsuarios.set(numero, st);
          }

          // ——— construir RESUMEN y OFERTAR con helper
          const partes: string[] = [];
          partes.push('📦 *Nuevo pedido disponible*', '');
          partes.push(`🔁 *Tipo de servicio:*\n${String(tipo || 'servicio')}`);

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
                // ⚠️ Avisar al domiciliario que la oferta expiró / se reasignó
                const domiId = p.id_domiciliario;
                if (domiId) {
                  try {
                    const domi = await this.domiciliarioService.getById(domiId);
                    const tel = domi?.telefono_whatsapp;
                    if (tel) {
                      await this.enviarMensajeTexto(
                        tel,
                        '⏱️ La oferta expiró y fue asignada a otro domiciliario. Por favor no la aceptes ya.'
                      );
                    }
                  } catch (e) {
                    this.logger.warn(`No pude notificar al domi ${domiId}: ${e instanceof Error ? e.message : e}`);
                  }

                  // liberar su estado, si aplica
                  try { await this.domiciliarioService.setDisponibleManteniendoTurnoById(domiId, true); } catch { }

                }

                // Pasar el pedido a pendiente para reofertar
                await this.domiciliosService.update(p.id, {
                  estado: 0,
                  id_domiciliario: null,
                  motivo_cancelacion: 'No respuesta de domiciliario',
                });

                this.logger.warn(`⏰ Domi no respondió. Reofertando pedido id=${p.id}`);
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
            // await this.enviarMensajeTexto(numero, '🚨');
            const aviso = [
              'Con mucho gusto estamos procesando tu domicilio ✨🛵'
            ].join('\n');

            await this.enviarMensajeTexto(numero, aviso);
            st.avisoNoDomiEnviado = true;
          }
          estadoUsuarios.set(numero, st);

          // Evita doble create también en el catch
          if (st.ultimoIdemKey === idemKey && st.pedidoId) {
            this.logger.warn(`🛡️ Idempotencia (catch): reuso pedidoId=${st.pedidoId}`);
            await this.mostrarMenuPostConfirmacion(
              numero,
              st.pedidoId,
              '⏳ Estamos procesando tu domicilio ✨🛵\n\n🙏 Gracias por confiar en *Domicilios W*.'
              ,
              60 * 1000
            );
            return;
          }

          const pedidoPendiente = await this.domiciliosService.create({
            mensaje_confirmacion: 'Confirmado por el cliente vía WhatsApp',
            estado: 0,
            numero_cliente: numero,
            fecha: new Date().toISOString(),
            hora: new Date().toTimeString().slice(0, 5),
            id_cliente: null,
            id_domiciliario: null,
            tipo_servicio: tipo,
            origen_direccion: datos.direccionRecoger ?? '',
            destino_direccion: datos.direccionEntregar ?? datos.direccionEntrega ?? '',
            telefono_contacto_origen: datos.telefonoRecoger ?? '',
            telefono_contacto_destino: datos.telefonoEntregar ?? datos.telefonoEntrega ?? '',
            notas: '',
            detalles_pedido: datos.listaCompras ?? '',
            foto_entrega_url: '',
          });

          if (pedidoPendiente?.id) {
            st.ultimoIdemKey = idemKey;
            st.pedidoId = pedidoPendiente.id;
            st.ultimoPedidoTs = Date.now();
            estadoUsuarios.set(numero, st);

            await this.mostrarMenuPostConfirmacion(
              numero,
              pedidoPendiente.id,
              '⏳ Estamos procesando tu domicilio ✨🛵\n\n🙏 Gracias por confiar en *Domicilios W*.'
              ,
              60 * 1000
            );
          }
          return;
        } finally {
          // Libera candado siempre
          const s = estadoUsuarios.get(numero) || {};
          s.creandoPedidoHasta = undefined;
          estadoUsuarios.set(numero, s);
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
      // 🚀 Saludo simple en texto (sin imagen)
      const saludo = `👋 Hola ${nombre}, soy Wil-Bot 🤖

👉 Pide fácil en: https://domiciliosw.com
👉 Si ya estás registrado envía el número *1*`;

      // Enviar solo mensaje de texto
      await this.enviarMensajeTexto(numero, saludo);


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





  private async enviarMensajeTexto(numero: string, mensaje?: string): Promise<void> {
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
    const trim = (s?: string) => String(s || '').trim();

    /**
     * Extrae el ÚLTIMO teléfono válido de 10 dígitos desde el texto completo.
     * - Acepta cualquier formato: con espacios, guiones, paréntesis, puntos, +57 / 57, o pegado a otros números.
     * - Regla: toma SIEMPRE los últimos 10 dígitos del conjunto total de dígitos del mensaje.
     * - Si el texto no tiene al menos 10 dígitos en total, retorna null.
     */
    const extraerTelefono10 = (txt?: string): string | null => {
      if (!txt) return null;
      const digits = (String(txt).match(/\d/g) || []).join('');
      if (digits.length < 10) return null;
      return digits.slice(-10);
    };

    /**
     * Quita del texto la PRIMERA ocurrencia del teléfono (10 dígitos normalizados) en formatos comunes:
     * - 10 seguidos
     * - 3-3-4, 3-7
     * - 3-3-2-2 (ej: 310 885 73 11) y otras variantes frecuentes
     * - con paréntesis en los 3 primeros
     * - con prefijos 57 / +57 (pegado y con separadores)
     */
    const quitarTelefonoDelTexto = (txt: string, t10: string): string => {
      if (!txt || !t10) return txt;

      const variantes = [
        // 10 seguidos
        t10,

        // 3-3-4
        t10.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3'),
        t10.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3'),

        // 3-7
        t10.replace(/(\d{3})(\d{7})/, '$1 $2'),
        t10.replace(/(\d{3})(\d{7})/, '$1-$2'),

        // 3-3-2-2 (ej: 310 885 73 11)
        t10.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4'),
        t10.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, '$1-$2-$3-$4'),

        // Otras particiones frecuentes de 10
        t10.replace(/(\d{3})(\d{2})(\d{3})(\d{2})/, '$1 $2 $3 $4'),
        t10.replace(/(\d{3})(\d{2})(\d{3})(\d{2})/, '$1-$2-$3-$4'),
        t10.replace(/(\d{3})(\d{2})(\d{2})(\d{3})/, '$1 $2 $3 $4'),
        t10.replace(/(\d{3})(\d{2})(\d{2})(\d{3})/, '$1-$2-$3-$4'),
        t10.replace(/(\d{2})(\d{3})(\d{3})(\d{2})/, '$1 $2 $3 $4'),
        t10.replace(/(\d{2})(\d{3})(\d{3})(\d{2})/, '$1-$2-$3-$4'),
        t10.replace(/(\d{2})(\d{3})(\d{2})(\d{3})/, '$1 $2 $3 $4'),
        t10.replace(/(\d{2})(\d{3})(\d{2})(\d{3})/, '$1-$2-$3-$4'),

        // Paréntesis
        `(${t10.slice(0, 3)}) ${t10.slice(3)}`,

        // Prefijos con 57 / +57 (pegados y con separadores)
        `57${t10}`, `57 ${t10}`, `57-${t10}`,
        `+57${t10}`, `+57 ${t10}`, `+57-${t10}`,
      ];

      const patrones = variantes.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const re = new RegExp(patrones.join('|'), 'i');
      return trim(txt.replace(re, '').replace(/\s{2,}/g, ' '));
    };

    const direccionValida = (txt?: string) => !!trim(txt) && trim(txt).length >= 5;

    // Prompts
    const pedirDireccionRecogida = async () =>
      this.enviarMensajeTexto(
        numero,
        '📍 Ingresa la *dirección de recogida*. (Puedes enviar dirección y teléfono en el mismo mensaje.)'
      );

    const pedirTelefonoRecogida = async () =>
      this.enviarMensajeTexto(
        numero,
        '📞 Ingresa el *teléfono de recogida* (debe tener *10 dígitos*)'
      );

    const enviarResumenYBotones = async () => {
      const { direccionRecoger, telefonoRecoger } = estado.datos;
      await this.enviarMensajeTexto(
        numero,
        '✅ Verifica:\n\n' +
        `📍 Recoger: ${direccionRecoger || '—'}\n` +
        `📞 Tel: ${telefonoRecoger || '—'}`
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
    };

    switch (estado.paso) {
      // 0) Pedir dirección (permitir que envíen dirección+tel juntos)
      case 0: {
        await this.enviarMensajeTexto(numero, '🛵 Tomaremos tus datos de *recogida*.');
        await pedirDireccionRecogida();
        estado.paso = 1;
        break;
      }

      // 1) Guardar dirección y, si viene, teléfono; si falta teléfono, pedirlo
      case 1: {
        const tel10 = extraerTelefono10(mensaje);
        let dir = trim(mensaje);

        if (tel10) dir = quitarTelefonoDelTexto(dir, tel10);

        if (!direccionValida(dir)) {
          if (tel10) {
            // Tengo teléfono válido pero falta dirección
            estado.datos.telefonoRecoger = tel10;
            await this.enviarMensajeTexto(numero, '📞 Teléfono recibido.');
            await this.enviarMensajeTexto(numero, '⚠️ Ahora envía la *dirección de recogida* (mín. 5 caracteres).');
            break; // seguimos en paso 1 hasta que llegue dirección válida
          }
          await this.enviarMensajeTexto(numero, '⚠️ Dirección inválida. Escribe una dirección (mín. 5 caracteres).');
          await pedirDireccionRecogida();
          break;
        }

        estado.datos.direccionRecoger = dir;

        if (tel10) {
          estado.datos.telefonoRecoger = tel10;
          await enviarResumenYBotones();
          estado.confirmacionEnviada = true;
          estado.paso = 3;
          break;
        }

        // Falta teléfono
        await pedirTelefonoRecogida();
        estado.paso = 2;
        break;
      }

      // 2) Guardar teléfono (permitir que reenvíen dirección+tel y actualizamos ambos)
      case 2: {
        const tel10 = extraerTelefono10(mensaje);
        let posibleDir = trim(mensaje);
        if (tel10) posibleDir = quitarTelefonoDelTexto(posibleDir, tel10);

        let huboCambio = false;

        if (tel10) {
          estado.datos.telefonoRecoger = tel10;
          huboCambio = true;
        } else {
          await this.enviarMensajeTexto(
            numero,
            '⚠️ Teléfono inválido. Debe tener *10 dígitos*.'
          );
          await pedirTelefonoRecogida();
          break;
        }

        if (direccionValida(posibleDir)) {
          estado.datos.direccionRecoger = posibleDir;
          huboCambio = true;
        }

        if (!estado.datos.direccionRecoger) {
          await this.enviarMensajeTexto(
            numero,
            '⚠️ Falta la *dirección de recogida*. Escríbela (mín. 5 caracteres).'
          );
          await pedirDireccionRecogida();
          break; // seguimos en paso 2 hasta tener ambos
        }

        if (huboCambio) {
          await enviarResumenYBotones();
          estado.confirmacionEnviada = true;
        }
        estado.paso = 3;
        break;
      }

      // 3) Correcciones: el usuario puede mandar dirección, teléfono o ambos
      case 3: {
        const tel10 = extraerTelefono10(mensaje);
        let dir = trim(mensaje);
        if (tel10) dir = quitarTelefonoDelTexto(dir, tel10);

        let huboCambio = false;

        if (tel10) {
          estado.datos.telefonoRecoger = tel10;
          huboCambio = true;
        }
        if (direccionValida(dir)) {
          estado.datos.direccionRecoger = dir;
          huboCambio = true;
        }

        if (huboCambio) {
          await this.enviarMensajeTexto(
            numero,
            '✍️ Actualizado:\n\n' +
            `📍 Recoger: ${estado.datos.direccionRecoger}\n` +
            `📞 Tel: ${estado.datos.telefonoRecoger}`
          );
          // Reenviar botones (ignorar fallo)
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
                    { type: 'reply', reply: { id: 'confirmar_info', title: '✅ Sí' } },
                    { type: 'reply', reply: { id: 'editar_info', title: '🔁 No, editar' } },
                  ],
                },
              },
            });
          } catch { }
        }
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


  async opcion2PasoAPaso(numero: string, mensaje: string): Promise<void> {
    const estado = estadoUsuarios.get(numero) || {
      paso: 0,
      datos: {},
      tipo: 'opcion_2',
      listaItems: [] as string[],
    };

    // Asegurar array
    if (!Array.isArray(estado.listaItems)) {
      estado.listaItems = [];
    }

    const txt = (mensaje ?? '').trim();

    // Helpers

    /**
     * Extrae el ÚLTIMO teléfono válido de 10 dígitos desde el texto completo.
     * - Acepta cualquier formato: con espacios, guiones, paréntesis, puntos, +57 / 57, o pegado a otros números.
     * - Regla: toma SIEMPRE los últimos 10 dígitos del conjunto total de dígitos del mensaje.
     * - Si el texto no tiene al menos 10 dígitos en total, retorna null.
     */
    const extraerTelefono10 = (t?: string): string | null => {
      if (!t) return null;
      const digits = (String(t).match(/\d/g) || []).join('');
      if (digits.length < 10) return null;
      return digits.slice(-10);
    };

    /**
     * Quita del texto la PRIMERA ocurrencia del teléfono detectado (10 dígitos normalizados)
     * en formatos comunes (con separadores, paréntesis, con/ sin 57/+57).
     */
    const quitarTelefonoDelTexto = (texto: string, t10: string) => {
      if (!texto || !t10) return texto;

      const formats = [
        // 10 seguidos
        t10,

        // 3-3-4
        t10.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3'),
        t10.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3'),

        // 3-7
        t10.replace(/(\d{3})(\d{7})/, '$1 $2'),
        t10.replace(/(\d{3})(\d{7})/, '$1-$2'),

        // 3-3-2-2 (ej: 310 885 73 11)
        t10.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4'),
        t10.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, '$1-$2-$3-$4'),

        // Otras particiones frecuentes de 10
        t10.replace(/(\d{3})(\d{2})(\d{3})(\d{2})/, '$1 $2 $3 $4'),
        t10.replace(/(\d{3})(\d{2})(\d{3})(\d{2})/, '$1-$2-$3-$4'),
        t10.replace(/(\d{3})(\d{2})(\d{2})(\d{3})/, '$1 $2 $3 $4'),
        t10.replace(/(\d{3})(\d{2})(\d{2})(\d{3})/, '$1-$2-$3-$4'),
        t10.replace(/(\d{2})(\d{3})(\d{3})(\d{2})/, '$1 $2 $3 $4'),
        t10.replace(/(\d{2})(\d{3})(\d{3})(\d{2})/, '$1-$2-$3-$4'),
        t10.replace(/(\d{2})(\d{3})(\d{2})(\d{3})/, '$1 $2 $3 $4'),
        t10.replace(/(\d{2})(\d{3})(\d{2})(\d{3})/, '$1-$2-$3-$4'),

        // Paréntesis
        `(${t10.slice(0, 3)}) ${t10.slice(3)}`,

        // con 57 / +57 (pegados y con separadores)
        `57${t10}`, `57 ${t10}`, `57-${t10}`,
        `+57${t10}`, `+57 ${t10}`, `+57-${t10}`,
      ];

      const patrones = formats.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const re = new RegExp(patrones.join('|'), 'i');
      return texto.replace(re, '').replace(/\s{2,}/g, ' ').trim();
    };

    const direccionValida = (t?: string) => !!t && t.trim().length >= 5;
    const esFinLista = (s: string) => /^(listo|fin|ok)$/i.test((s || '').trim());

    switch (estado.paso) {
      // 0) Pedir lista
      case 0: {
        await this.enviarMensajeTexto(
          numero,
          '🛒 Envía la lista completa o escribe uno por uno lo que necesitas.\n\n👉 Escribe *LISTO* cuando termines.'
        );
        estado.paso = 1;
        break;
      }

      // 1) Recibir ítems hasta LISTO
      case 1: {
        if (esFinLista(txt)) {
          if (!estado.listaItems.length) {
            await this.enviarMensajeTexto(numero, '⚠️ Agrega al menos un producto antes de terminar.');
            break;
          }
          estado.datos.listaCompras = estado.listaItems.join('\n');
          estado.paso = 2;
          await this.enviarMensajeTexto(
            numero,
            '✅ Ingresa:\n\n' +
            '📍 Dirección de entrega\n' +
            '📞 Número telefónico 10 dígitos'
          );
          break;
        }

        if (txt.length < 2) {
          await this.enviarMensajeTexto(numero, '⚠️ Envía un ítem válido o escribe *LISTO*.');
          break;
        }

        estado.listaItems.push(txt);
        await this.enviarMensajeTexto(
          numero,
          `➕ Item agregado: *${txt}*\n Escribe *LISTO* para terminar.`
        );
        break;
      }

      // 2) Dirección (cualquier texto válido) y posible teléfono en el mismo mensaje
      case 2: {
        if (!txt) {
          await this.enviarMensajeTexto(numero, '⚠️ Escribe la *dirección de entrega*');
          break;
        }

        // Intentar extraer teléfono del mismo mensaje (10 dígitos ya normalizados)
        const tel10 = extraerTelefono10(txt);
        const direccionCruda = tel10 ? quitarTelefonoDelTexto(txt, tel10) : txt;

        if (!direccionValida(direccionCruda)) {
          await this.enviarMensajeTexto(
            numero,
            '⚠️ Dirección inválida. Escribe una dirección válida (mín. 5 caracteres).'
          );
          break;
        }

        // Guardar dirección
        estado.datos.direccionEntrega = direccionCruda;

        if (tel10) {
          // Si vino teléfono válido junto → guardar y saltar al resumen
          estado.datos.telefonoEntrega = tel10;
          estado.paso = 4;

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
          break;
        }

        // Si no vino teléfono, pedirlo
        estado.paso = 3;
        await this.enviarMensajeTexto(
          numero,
          '📞 Ahora envía el *teléfono de entrega* (debe tener *10 dígitos*)'
        );
        break;
      }

      // 3) Teléfono y resumen
      case 3: {
        const tel10 = extraerTelefono10(txt);
        if (!tel10) {
          await this.enviarMensajeTexto(
            numero,
            '⚠️ Teléfono inválido. Debe tener *10 dígitos*.'
          );
          break;
        }

        estado.datos.telefonoEntrega = tel10;
        estado.paso = 4;

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
        break;
      }

      default: {
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

    // Helpers
    const trim = (s?: string) => String(s || '').trim();

    /**
     * Extrae el ÚLTIMO teléfono válido de 10 dígitos desde el texto completo.
     * - Acepta cualquier formato: con espacios, guiones, paréntesis, puntos, +57 / 57, o pegado a otros números.
     * - Regla: toma SIEMPRE los últimos 10 dígitos del conjunto total de dígitos del mensaje.
     * - Si el texto no tiene al menos 10 dígitos en total, retorna null.
     */
    const extraerTelefono10 = (txt?: string): string | null => {
      if (!txt) return null;
      const digits = (String(txt).match(/\d/g) || []).join('');
      if (digits.length < 10) return null;
      return digits.slice(-10);
    };

    /**
     * Quita del texto la PRIMERA ocurrencia del teléfono (10 dígitos normalizados) en varios formatos:
     * con separadores, paréntesis, y con/sin 57 o +57.
     */
    const quitarTelefonoDelTexto = (txt: string, t10: string): string => {
      if (!txt || !t10) return txt;

      const variantes = [
        // 10 seguidos
        t10,

        // 3-3-4
        t10.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3'),
        t10.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3'),

        // 3-7
        t10.replace(/(\d{3})(\d{7})/, '$1 $2'),
        t10.replace(/(\d{3})(\d{7})/, '$1-$2'),

        // 3-3-2-2 (ej: 310 885 73 11)
        t10.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4'),
        t10.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, '$1-$2-$3-$4'),

        // Otras particiones frecuentes de 10
        t10.replace(/(\d{3})(\d{2})(\d{3})(\d{2})/, '$1 $2 $3 $4'),
        t10.replace(/(\d{3})(\d{2})(\d{3})(\d{2})/, '$1-$2-$3-$4'),
        t10.replace(/(\d{3})(\d{2})(\d{2})(\d{3})/, '$1 $2 $3 $4'),
        t10.replace(/(\d{3})(\d{2})(\d{2})(\d{3})/, '$1-$2-$3-$4'),
        t10.replace(/(\d{2})(\d{3})(\d{3})(\d{2})/, '$1 $2 $3 $4'),
        t10.replace(/(\d{2})(\d{3})(\d{3})(\d{2})/, '$1-$2-$3-$4'),
        t10.replace(/(\d{2})(\d{3})(\d{2})(\d{3})/, '$1 $2 $3 $4'),
        t10.replace(/(\d{2})(\d{3})(\d{2})(\d{3})/, '$1-$2-$3-$4'),

        // Paréntesis
        `(${t10.slice(0, 3)}) ${t10.slice(3)}`,

        // con 57 / +57 (pegados y con separadores)
        `57${t10}`, `57 ${t10}`, `57-${t10}`,
        `+57${t10}`, `+57 ${t10}`, `+57-${t10}`,
      ];

      const patrones = variantes.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const re = new RegExp(patrones.join('|'), 'i');
      return trim(txt.replace(re, '').replace(/\s{2,}/g, ' '));
    };

    const direccionValida = (txt?: string) => !!trim(txt) && trim(txt).length >= 5;

    // Prompts cortos
    const pedirDirRecoger = async () =>
      this.enviarMensajeTexto(
        numero,
        '📍 Ingresa la dirección de *RECOGER* (puedes escribir la dirección y el teléfono en el mismo mensaje).'
      );

    const pedirTelRecoger = async () =>
      this.enviarMensajeTexto(
        numero,
        '📞 Ingresa el *teléfono* de quien *entrega* (debe tener *10 dígitos*).'
      );

    const enviarResumenYBotones = async () => {
      const { direccionRecoger, telefonoRecoger } = estado.datos;
      await this.enviarMensajeTexto(
        numero,
        '✅ Verifica:\n\n' +
        `📍 Recoger: ${direccionRecoger || '—'}\n` +
        `📞 Tel: ${telefonoRecoger || '—'}`
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
    };

    switch (estado.paso) {
      // 0) Pedir dirección (admite dirección + teléfono en el mismo mensaje si el usuario lo manda de una)
      case 0: {
        await this.enviarMensajeTexto(
          numero,
          '💰 Vamos a recoger dinero/facturas.\n' +
          '📍 Envíame la *dirección de RECOGER*.\n' +
          '👉 Si quieres, puedes escribir la dirección y el teléfono *en el mismo mensaje*.\n' +
          '🔐 Si el pago supera 200.000, escribe al 314 242 3130.'
        );
        estado.paso = 1;
        break;
      }

      // 1) Guardar dirección y, si viene, teléfono; si no viene tel, pedirlo
      case 1: {
        const tel10 = extraerTelefono10(mensaje);
        let dir = trim(mensaje);

        if (tel10) {
          dir = quitarTelefonoDelTexto(dir, tel10);
          estado.datos.telefonoRecoger = tel10;
          estado.datos.telefonoRecogida = tel10; // compat
        }

        if (!direccionValida(dir)) {
          // Si no hay dirección pero sí teléfono: guardo tel y pido dirección
          if (tel10) {
            estado.datos.telefonoRecoger = tel10;
            estado.datos.telefonoRecogida = tel10;
            await this.enviarMensajeTexto(numero, '📞 Teléfono recibido.');
            await this.enviarMensajeTexto(numero, '⚠️ Ahora envía la *dirección de RECOGER* (mín. 5 caracteres).');
            break; // seguimos pidiendo dirección en este mismo paso
          }
          await this.enviarMensajeTexto(numero, '⚠️ Dirección inválida. Escribe una *dirección válida* (mín. 5 caracteres).');
          await pedirDirRecoger();
          break;
        }

        estado.datos.direccionRecoger = dir;
        estado.datos.direccionRecogida = dir; // compat

        // Si ya tengo teléfono también, salto directo a resumen
        if (estado.datos.telefonoRecoger) {
          await enviarResumenYBotones();
          estado.confirmacionEnviada = true;
          estado.paso = 3;
          break;
        }

        // Falta teléfono → pedirlo
        await pedirTelRecoger();
        estado.paso = 2;
        break;
      }

      // 2) Guardar teléfono (permite que el usuario vuelva a mandar dirección+tel; actualizamos ambos si aplica)
      case 2: {
        const tel10 = extraerTelefono10(mensaje);
        // Si el usuario mandó dirección de nuevo junto con el teléfono, la tomamos
        let posibleDir = trim(mensaje);
        if (tel10) posibleDir = quitarTelefonoDelTexto(posibleDir, tel10);

        let huboCambio = false;

        if (tel10) {
          estado.datos.telefonoRecoger = tel10;
          estado.datos.telefonoRecogida = tel10;
          huboCambio = true;
        }
        if (direccionValida(posibleDir)) {
          estado.datos.direccionRecoger = posibleDir;
          estado.datos.direccionRecogida = posibleDir;
          huboCambio = true;
        }

        if (!estado.datos.telefonoRecoger) {
          await this.enviarMensajeTexto(
            numero,
            '⚠️ Teléfono inválido. Debe tener *10 dígitos*'
          );
          await pedirTelRecoger();
          break;
        }
        if (!estado.datos.direccionRecoger) {
          await this.enviarMensajeTexto(
            numero,
            '⚠️ Falta la *dirección de RECOGER*. Escríbela (mín. 5 caracteres).'
          );
          await pedirDirRecoger();
          break; // nos quedamos en paso 2 hasta tener ambos
        }

        // Resumen + botones
        await enviarResumenYBotones();
        estado.confirmacionEnviada = true;
        estado.paso = 3;
        break;
      }

      // 3) Correcciones rápidas: permite mandar dirección, teléfono o ambos a la vez
      case 3: {
        if (!trim(mensaje)) break;

        const tel10 = extraerTelefono10(mensaje);
        let dir = trim(mensaje);
        if (tel10) dir = quitarTelefonoDelTexto(dir, tel10);

        let huboCambio = false;

        if (tel10) {
          estado.datos.telefonoRecoger = tel10;
          estado.datos.telefonoRecogida = tel10;
          huboCambio = true;
        }
        if (direccionValida(dir)) {
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

    const botonId = `menu_cancelar_${pedidoId}`;

    // 1) Intento con botón interactivo
    try {
      await axiosWhatsapp.post('/messages', {
        messaging_product: 'whatsapp',
        to: numero,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: `${bodyText}\n\n(Ref: #${pedidoId})` }, // añade la ref también aquí
          action: {
            buttons: [
              { type: 'reply', reply: { id: botonId, title: '❌ Cancelar pedido' } },
            ],
          },
        },
      });
    } catch (e) {
      this.logger.warn(`⚠️ Falló envío de botón cancelar a ${numero} (pedido ${pedidoId}): ${e?.response?.data?.error?.message || e?.message || e}`);
    }

    // 2) Fallback para Web/Desktop (texto plano + keyword)
    try {
      await this.enviarMensajeTexto(
        numero,
        [
          '💡 Si no ves el botón',
          `• Escribe: *CANCELAR*`,
        ].join('\n')
      );
    } catch (e) {
      this.logger.warn(`⚠️ Falló envío de fallback texto a ${numero}: ${e instanceof Error ? e.message : e}`);
    }

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



  // ===== FUNCIÓN COMPLETA AJUSTADA =====
  private async cancelarPedidoDesdeCliente(numero: string): Promise<void> {
    try {
      const st = estadoUsuarios.get(numero) || {};
      const pedidoId: number | undefined = st.pedidoId;
      if (!pedidoId) return;

      // Idempotencia básica
      const last = cancelacionesProcesadas.get(numero);
      const now = Date.now();
      if (last && (now - last) < CANCEL_TTL_MS) return;
      cancelacionesProcesadas.set(numero, now);

      // Trae el pedido (solo para validar y dar buen mensaje)
      const pedido = await this.getPedidoById(pedidoId);
      if (!pedido) {
        await this.enviarMensajeTexto(numero, '⚠️ No pude encontrar tu pedido. Intenta nuevamente.');
        return;
      }

      // 🚫 Bloqueo explícito: si ya está ASIGNADO, no permitir cancelar
      if (pedido.estado === 1 /* ASIGNADO */) {
        await this.enviarMensajeTexto(
          numero,
          '🔒 Este pedido ya fue confirmado con el domiciliario.\n'
        );
        return;
      }

      // 🚦 Cancelación atómica en BD: solo cancela si sigue PENDIENTE (0) u OFERTADO (5)
      const ok = await this.domiciliosService.cancelarPorClienteSiNoAsignado(
        pedidoId,
        'Cancelado por el cliente vía WhatsApp'
      );

      if (!ok) {
        // La transacción detectó que ya NO es cancelable (pudo cambiar entre lectura y la transacción)
        await this.enviarMensajeTexto(
          numero,
          '🔒 Este pedido ya fue confirmado con el domiciliario y no se puede cancelar por este medio.\n' +
          'Si necesitas ayuda, escríbenos por soporte.'
        );
        return;
      }

      // 🧹 Si existía un timeout de oferta/reoferta para este pedido, elimínalo
      const t = temporizadoresOferta.get(pedidoId);
      if (t) { clearTimeout(t); temporizadoresOferta.delete(pedidoId); }

      // 🧹 Cierra puente de conversación y limpia estado/temporizadores de este número
      await this.notificarYFinalizarConversacionDe(numero);
      estadoUsuarios.delete(numero);
      this.clearTimer(temporizadoresInactividad, numero);
      this.clearTimer(temporizadoresEstado, numero);
      this.clearTimer(bloqueoMenu, numero);

      // ✅ Confirmación al cliente
      await this.enviarMensajeTexto(
        numero,
        `🧡 Tu pedido ha sido cancelado. ¡Gracias por confiar en Domiciliosw.com!

Para no dejarte sin servicio, te compartimos opciones adicionales:
📞 3144403062 – Veloz
📞 3137057041 – Rapigo
📞 3142423130 – Enviosw

🚀 Así podrás realizar tu envío de manera rápida y segura.`
      );

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

    const toTelKey = (n: string) => {
      if ((this as any).toTelKey) return (this as any).toTelKey(n);
      const d = (n || '').replace(/\D/g, '');
      return d.length === 10 ? `57${d}` : d; // fallback
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
    const textoSan = sanearBodyMultiline(textoOriginal);
    const idemKey = `${telClienteNorm}|${textoSan}`;
    const now = Date.now();
    const IDEM_TTL_MS = 20_000;         // candado inmediato anti doble tap
    const REUSE_WINDOW_MS = 5 * 60_000; // reuso en 5 min

    // 📌 Estado en memoria por número (reutilizamos el Map global ya existente)
    const st = estadoUsuarios.get(telClienteNorm) || {};

    // 0) Candado inmediato 20s (evita reintentos seguidos de WhatsApp)
    if (typeof st.candadoAuto === 'number' && now < st.candadoAuto) {
      this.logger.warn(`🛡️ Candado activo auto-pedido para ${telClienteNorm}. Ignoro duplicado.`);
      return;
    }
    st.candadoAuto = now + IDEM_TTL_MS;
    estadoUsuarios.set(telClienteNorm, st);

    // 1) Reuso en memoria (últimos 5 min) si el contenido es idéntico
    if (
      st.autoUltimoIdemKey === idemKey &&
      st.autoUltimoPedidoId &&
      typeof st.autoUltimoTs === 'number' &&
      (now - st.autoUltimoTs) < REUSE_WINDOW_MS
    ) {
      this.logger.warn(`♻️ Reuso en memoria pedidoId=${st.autoUltimoPedidoId} por idempotencia.`);
      // Continúa el flujo como si hubiéramos "creado" este id
      await this._continuarFlujoAutoPedido(st.autoUltimoPedidoId, telClienteNorm, textoSan, nombreContacto, toTelKey);
      return;
    }

    // 2) Chequeo previo en BD: ¿ya existe un PENDIENTE reciente con mismo texto?
    //    Nota: ajusta el find si tu service admite filtros más precisos.
    let pedidoExistente: any | null = null;
    try {
      const desdeISO = new Date(now - REUSE_WINDOW_MS).toISOString();
      const candidatos = await this.domiciliosService.find({
        where: {
          estado: 0, // pendiente
          numero_cliente: telClienteNorm,
          // si tu ORM no filtra por fecha aquí, igual acotamos por orden y "take"
          // y filtramos en memoria abajo.
        },
        order: { id: 'DESC' },
        take: 10,
      });

      pedidoExistente = (candidatos || []).find((p: any) => {
        const det = String(p?.detalles_pedido || '').trim();
        return det === textoOriginal.trim() && new Date(p?.fecha).toISOString() >= desdeISO;
      }) || null;
    } catch { /* continuar si falla el pre-chequeo */ }

    if (pedidoExistente?.id) {
      this.logger.warn(`🛡️ Reuso en BD pedidoId=${pedidoExistente.id} (pendiente reciente con mismo texto).`);
      st.autoUltimoIdemKey = idemKey;
      st.autoUltimoPedidoId = pedidoExistente.id;
      st.autoUltimoTs = now;
      estadoUsuarios.set(telClienteNorm, st);
      await this._continuarFlujoAutoPedido(pedidoExistente.id, telClienteNorm, textoSan, nombreContacto, toTelKey);
      return;
    }

    // 3) Crear el pedido PENDIENTE (0) SOLO si no hay reuso
    const pedidoCreado = await this.domiciliosService.create({
      mensaje_confirmacion: 'Auto-ingreso (pedido desde)',
      estado: 0, // pendiente
      numero_cliente: telClienteNorm,
      fecha: new Date().toISOString(),
      hora: new Date().toTimeString().slice(0, 5),
      id_cliente: null,
      tipo_servicio: 'auto',
      origen_direccion: '',
      destino_direccion: '',
      telefono_contacto_origen: '',
      telefono_contacto_destino: '',
      notas: '',
      detalles_pedido: textoOriginal, // guarda BRUTO
      foto_entrega_url: '',
    });

    if (!pedidoCreado?.id) {
      await this.enviarMensajeTexto(telClienteNorm, '⚠️ No pude crear tu pedido. Intenta nuevamente.');
      return;
    }

    // memoriza para próximos reintentos
    st.autoUltimoIdemKey = idemKey;
    st.autoUltimoPedidoId = pedidoCreado.id;
    st.autoUltimoTs = now;
    estadoUsuarios.set(telClienteNorm, st);

    // 4) Continuar el flujo original con el ID final (ya sea reusado o recién creado)
    await this._continuarFlujoAutoPedido(pedidoCreado.id, telClienteNorm, textoSan, nombreContacto, toTelKey);
  }

  // 🔧 Extrae aquí el tramo "después de crear" (es tu mismo código actual desde el punto 2 en adelante)
  //    para evitar duplicación y poder reutilizar tanto en reuso como en creación nueva.
  private async _continuarFlujoAutoPedido(
    pedidoId: number,
    telClienteNorm: string,
    textoSan: string,
    nombreContacto: string,
    toTelKeyFn: (n: string) => string
  ) {
    // 2) Intentar tomar un domiciliario del turno
    let domiciliario: Domiciliario | null = null;
    try {
      domiciliario = await this.domiciliarioService.asignarDomiciliarioDisponible();
    } catch {
      domiciliario = null;
    }

    // 2.a) Si NO hay domi → informar cliente y mostrar menú de cancelar
    if (!domiciliario) {
      await this.mostrarMenuPostConfirmacion(
        telClienteNorm,
        pedidoId,
        '⏳ Estamos procesando tu domicilio ✨🛵\n\n🙏 Gracias por confiar en *Domicilios W*.'
      );

      const st = estadoUsuarios.get(telClienteNorm) || {};
      st.esperandoAsignacion = true;
      estadoUsuarios.set(telClienteNorm, st);
      return;
    }

    // 3) Pasar a OFERTADO (5) solo si sigue pendiente (atómico)
    const ofertado = await this.domiciliosService.marcarOfertadoSiPendiente(
      pedidoId,
      domiciliario.id
    );

    if (!ofertado) {
      try {
        await this.domiciliarioService.liberarDomiciliario(domiciliario.id);

      } catch { }
      await this.enviarMensajeTexto(
        telClienteNorm,
        '⏳ Estamos gestionando tu pedido. Te avisaremos apenas asignemos un domiciliario.'
      );
      await this.mostrarMenuPostConfirmacion(
        telClienteNorm,
        pedidoId,
        '⏳ Estamos procesando tu domicilio ✨🛵\n\n🙏 Gracias por confiar en *Domicilios W*.',
        60 * 1000
      );
      return;
    }

    // 4) Construir resumen y enviar oferta al domi (idéntico a tu código)
    const tipoLinea = '🔁 *Tipo de servicio:* auto';
    const listaODetalles = textoSan ? `📝 *Detalles:*\n${textoSan}` : '';
    const resumenParaDomi = [tipoLinea, listaODetalles].filter(Boolean).join('\n\n');

    const resumenLargo = `${'📦 *Nuevo pedido disponible:*'}\n\n${resumenParaDomi}\n\n` +
      `👤 Cliente: *${nombreContacto || 'Cliente'}*\n` +
      `📞 Teléfono: ${telClienteNorm}`;

    await this.enviarOfertaAceptarRechazarConId({
      telefonoDomi: domiciliario.telefono_whatsapp,
      pedidoId,
      resumenLargo,
      bodyCorto: '¿Deseas tomar este pedido?',
    });

    // 🧠 Registrar oferta vigente en memoria (expira en 2 min)
    const domTelKey = toTelKeyFn(domiciliario.telefono_whatsapp);
    const OFERTA_TIMEOUT_MS = 120_000;
    ofertasVigentes.set(pedidoId, {
      expira: Date.now() + OFERTA_TIMEOUT_MS,
      domi: domTelKey,
    });

    // 🧹 Si ya existía un timer para este pedido, límpialo
    const prevTo = temporizadoresOferta.get(pedidoId);
    if (prevTo) { clearTimeout(prevTo); temporizadoresOferta.delete(pedidoId); }

    // 6) Avisar al cliente (todavía NO hay conversación)
    await this.enviarMensajeTexto(
      telClienteNorm,
      '⏳ Estamos procesando tu domicilio. Gracias por preferirnos.'
    );
    await this.mostrarMenuPostConfirmacion(
      telClienteNorm,
      pedidoId,
      '⏳ Si ya no lo necesitas, puedes cancelar:',
      60 * 1000
    );

    // 7) Timeout de oferta: si el domi NO responde en 2 min
    const domiId = domiciliario.id;
    const to = setTimeout(async () => {
      try {
        const volvio = await this.domiciliosService.volverAPendienteSiOfertado(pedidoId);
        if (volvio) {
          // ✅ marcar disponible SIN mover turno (en vez de liberar)
          try { await this.domiciliarioService.setDisponibleManteniendoTurnoById(domiId, true); } catch { }
          ofertasVigentes.delete(pedidoId);
          temporizadoresOferta.delete(pedidoId);
          this.logger.warn(`⏰ Domi no respondió. Pedido ${pedidoId} vuelve a pendiente.`);
        }
      } catch (e) {
        this.logger.error(`Timeout oferta falló para pedido ${pedidoId}: ${e instanceof Error ? e.message : e}`);
      } finally {
        temporizadoresOferta.delete(pedidoId);
      }
    }, OFERTA_TIMEOUT_MS);


    temporizadoresOferta.set(pedidoId, to);
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

  // 👇 Estados que consideramos "abiertos"

  private async crearPedidoDesdeSticker(numeroWhatsApp: string, comercio: any, nombreContacto?: string) {
    // IDs de botones (solo confirmación previa)
    const BTN_STICKER_CONFIRM_SI = 'sticker_confirmar_si';
    const BTN_STICKER_CONFIRM_NO = 'sticker_confirmar_no';

    // -------------------- Helpers locales --------------------
    const normalizar = (n: string) => {
      const digits = (n || '').replace(/\D/g, '');
      return digits.length === 10 ? `57${digits}` : digits;
    };

    const toTelKeyLocal = (n: string) => {
      if ((this as any).toTelKey) return (this as any).toTelKey(n);
      const d = (n || '').replace(/\D/g, '');
      return d.length === 10 ? `57${d}` : d;
    };

    const firstNonEmpty = (...vals: Array<string | null | undefined>): string | null => {
      for (const v of vals) if (typeof v === 'string' && v.trim().length > 0) return v.trim();
      return null;
    };

    // Snapshot de comercio sin placeholders; intenta completar por id y por teléfono del sticker
    const resolveComercioSnapshot = async (input: any, telSticker: string): Promise<{
      id?: number;
      nombre: string | null;
      telefono: string | null;
      direccion: string | null;
    }> => {
      const init = input ?? {};
      let id: number | undefined = init?.id;
      let nombre: string | null = firstNonEmpty(init?.nombre, init?.name, init?.razon_social);
      let telefono: string | null = firstNonEmpty(init?.telefono, init?.telefono_whatsapp, init?.celular, init?.tel, init?.phone);
      let direccion: string | null = firstNonEmpty(init?.direccion, init?.direccion_principal, init?.address);

      if (telefono) telefono = toTelKeyLocal(telefono);

      if (id && (!nombre || !telefono || !direccion)) {
        try {
          const rec = (await (this.comerciosService as any)?.getById?.(id))
            ?? (await (this.comerciosService as any)?.findOne?.(id));
          if (rec) {
            nombre = nombre ?? firstNonEmpty(rec?.nombre, rec?.name, rec?.razon_social);
            telefono = telefono ?? firstNonEmpty(rec?.telefono, rec?.telefono_whatsapp, rec?.celular, rec?.tel, rec?.phone);
            direccion = direccion ?? firstNonEmpty(rec?.direccion, rec?.direccion_principal, rec?.address);
            if (telefono) telefono = toTelKeyLocal(telefono);
          }
        } catch { }
      }

      if (!nombre || !telefono || !direccion) {
        try {
          const telKeySticker = toTelKeyLocal(telSticker);
          const recByTel =
            (await (this.comerciosService as any)?.getByTelefono?.(telKeySticker)) ??
            (await (this.comerciosService as any)?.findByTelefono?.(telKeySticker)) ??
            (await (this.comerciosService as any)?.getByWhatsapp?.(telKeySticker));
          if (recByTel) {
            id = id ?? recByTel.id;
            nombre = nombre ?? firstNonEmpty(recByTel?.nombre, recByTel?.name, recByTel?.razon_social);
            telefono = telefono ?? firstNonEmpty(recByTel?.telefono, recByTel?.telefono_whatsapp, recByTel?.celular, recByTel?.tel, recByTel?.phone);
            direccion = direccion ?? firstNonEmpty(recByTel?.direccion, recByTel?.direccion_principal, recByTel?.address);
            if (telefono) telefono = toTelKeyLocal(telefono);
          }
        } catch { }
      }

      return { id, nombre: nombre ?? null, telefono: telefono ?? null, direccion: direccion ?? null };
    };
    // ----------------------------------------------------------

    const telClienteNorm = normalizar(numeroWhatsApp); // comercio que envía el sticker
    const cSnap = await resolveComercioSnapshot(comercio, numeroWhatsApp);

    // =========================
    // 🔒 Confirmación previa (NO crear de una)
    // =========================
    const st = estadoUsuarios.get(telClienteNorm) || {};
    const confirmed = Boolean(st?.stickerConfirmCreate);

    if (!confirmed) {
      const preview = [
        '🟢 *Confirmación requerida*',
        '',
        cSnap.nombre ? `🏪 *Comercio:* ${cSnap.nombre}` : '',
        cSnap.direccion ? `📍 *Recoger en:* ${cSnap.direccion}` : '',
        cSnap.telefono ? `📞 *Tel:* ${cSnap.telefono}` : '',
        '',
        '¿Deseas *solicitar ahora* un domiciliario?'
      ].filter(Boolean).join('\n');

      st.stickerConfirmPayload = { telClienteNorm, comercioSnap: cSnap, nombreContacto: nombreContacto || null };
      estadoUsuarios.set(telClienteNorm, st);

      await axiosWhatsapp.post('/messages', {
        messaging_product: 'whatsapp',
        to: telClienteNorm,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: preview },
          action: {
            buttons: [
              { type: 'reply', reply: { id: BTN_STICKER_CONFIRM_SI, title: '✅ Solicitar ahora' } },
              { type: 'reply', reply: { id: BTN_STICKER_CONFIRM_NO, title: '❌ Cancelar' } },
            ],
          },
        },
      });
      return; // esperar confirmación
    }

    // limpiar bandera de confirmación y payload
    st.stickerConfirmCreate = false;
    delete st.stickerConfirmPayload;
    estadoUsuarios.set(telClienteNorm, st);

    // =========================
    // CREACIÓN DEL PEDIDO (ahora sí)
    // =========================
    const origenDireccion = cSnap.direccion ?? '';
    const telOrigen = cSnap.telefono ? normalizar(cSnap.telefono) : '';

    const detalles =
      `Pedido creado por *sticker oficial* del comercio:\n` +
      `🏪 ${cSnap.nombre ?? '-'}\n` +
      `📞 ${cSnap.telefono ?? '-'}\n` +
      `📌 ${cSnap.direccion ?? '-'}`;

    const pedidoCreado = await this.domiciliosService.create({
      mensaje_confirmacion: 'Auto-ingreso (sticker oficial comercio)',
      estado: 0,
      numero_cliente: telClienteNorm,
      fecha: new Date().toISOString(),
      hora: new Date().toTimeString().slice(0, 5),
      id_cliente: null,
      id_domiciliario: null,
      tipo_servicio: 'sticker',
      origen_direccion: origenDireccion,
      destino_direccion: '',
      telefono_contacto_origen: telOrigen,
      telefono_contacto_destino: '',
      notas: '',
      detalles_pedido: detalles,
      foto_entrega_url: '',
    });

    // 2) Intentar asignar domi
    let domiciliario: Domiciliario | null = null;
    try { domiciliario = await this.domiciliarioService.asignarDomiciliarioDisponible(); }
    catch { domiciliario = null; }

    // 2.a) Sin domi → pendiente, avisos
    if (!domiciliario) {
      if (pedidoCreado?.id) {
        await this.mostrarMenuPostConfirmacion(
          telClienteNorm,
          pedidoCreado.id,
          '⏳ Estamos procesando tu domicilio ✨🛵\n\n🙏 Gracias por confiar en *Domicilios W*.'
        );
      }
      const st2 = estadoUsuarios.get(telClienteNorm) || {};
      st2.esperandoAsignacion = true;
      estadoUsuarios.set(telClienteNorm, st2);
      return;
    }

    // 3) OFERTADO (5) si sigue pendiente (ATÓMICO)
    const ofertado = await this.domiciliosService.marcarOfertadoSiPendiente(pedidoCreado.id, domiciliario.id);

    if (!ofertado) {
      // Carrera perdida → conservar turno y volver disponible (uniforme con timeout)
      try { await this.domiciliarioService.setDisponibleManteniendoTurnoById(domiciliario.id, true); } catch { }
      await this.enviarMensajeTexto(
        telClienteNorm,
        '⏳ Estamos gestionando tu pedido. Te avisaremos apenas asignemos un domiciliario.'
      );
      await this.mostrarMenuPostConfirmacion(
        telClienteNorm,
        pedidoCreado.id,
        '⏳ Estamos procesando tu domicilio ✨🛵\n\n🙏 Gracias por confiar en *Domicilios W*.',
        60 * 1000
      );
      return;
    }

    // 4) Aviso al cliente y menú cancelar
    await this.enviarMensajeTexto(telClienteNorm, '⏳ Estamos *procesando* tu pedido. Gracias por preferirnos');
    await this.mostrarMenuPostConfirmacion(
      telClienteNorm,
      pedidoCreado.id,
      '⏳ Si ya no lo necesitas, puedes cancelar:',
      60 * 1000
    );

    // 5) Resumen para el domi (omite líneas vacías)
    const resumenParaDomi = this.sanitizeWaBody(
      [
        '📦 *Nuevo pedido disponible*',
        '',
        cSnap.nombre ? `🏪 *Comercio:* ${cSnap.nombre}` : '',
        origenDireccion ? `📍 *Recoger en:* ${origenDireccion}` : '',
        telOrigen ? `📞 *Tel:* ${telOrigen}` : '',
      ].filter(Boolean).join('\n')
    );

    // 6) Enviar oferta (botones ACEPTAR/RECHAZAR)
    await this.enviarOfertaAceptarRechazarConId({
      telefonoDomi: domiciliario.telefono_whatsapp,
      pedidoId: pedidoCreado.id,
      resumenLargo: resumenParaDomi,
      bodyCorto: '¿Deseas tomar este pedido?',
    });

    // 7) Registrar oferta vigente (timeout)
    const OFERTA_TIMEOUT_MS = 120_000; // 2 min
    const domKey = toTelKeyLocal(domiciliario.telefono_whatsapp);
    ofertasVigentes.set(pedidoCreado.id, { expira: Date.now() + OFERTA_TIMEOUT_MS, domi: domKey });

    const prev = temporizadoresOferta.get(pedidoCreado.id);
    if (prev) { clearTimeout(prev); temporizadoresOferta.delete(pedidoCreado.id); }

    // 8) Timeout si el domi NO responde → volver a pendiente y mantener turno/disponibilidad (sin botones)
    const domiId = domiciliario.id;
    const to = setTimeout(async () => {
      try {
        const volvio = await this.domiciliosService.volverAPendienteSiOfertado(pedidoCreado.id); // 5→0 atómico
        if (volvio) {
          try { await this.domiciliarioService.setDisponibleManteniendoTurnoById(domiId, true); } catch { }
          ofertasVigentes.delete(pedidoCreado.id);
          temporizadoresOferta.delete(pedidoCreado.id);

          this.logger.warn(`⏰ Domi no respondió. Pedido ${pedidoCreado.id} vuelve a pendiente.`);
          // Aviso simple (sin botones)
          try {
            await this.enviarMensajeTexto(
              domKey,
              '⏱️ La oferta expiró.\n YA NO ACEPTES, NI RECHAZES\n\n Quedaste disponible y mantuviste tu turno ✅'
            );
          } catch (e) {
            this.logger.warn(`⚠️ No se pudo notificar al domiciliario tras timeout: ${e instanceof Error ? e.message : e}`);
          }
        } else {
          // Ya no estaba en 5 (aceptado/rechazado antes)
          ofertasVigentes.delete(pedidoCreado.id);
          temporizadoresOferta.delete(pedidoCreado.id);
        }
      } catch (e) {
        this.logger.error(`Timeout oferta falló para pedido ${pedidoCreado.id}: ${e instanceof Error ? e.message : e}`);
        ofertasVigentes.delete(pedidoCreado.id);
        temporizadoresOferta.delete(pedidoCreado.id);
      } finally {
        temporizadoresOferta.delete(pedidoCreado.id);
      }
    }, OFERTA_TIMEOUT_MS);

    temporizadoresOferta.set(pedidoCreado.id, to);

    // ❌ NO crear conversación aquí. Se crea SOLO cuando el domi acepta.
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
          body: { text: '*DOMICILIO ASIGNADO!*, Deseas finalizar el pedido?' },
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
    v.add(ten);         // 10 dígitos
    v.add(`57${ten}`);  // 57 + 10
    v.add(`+57${ten}`); // +57 + 10
    v.add(d);           // tal cual llegó
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
      montoLinea, // 👈 se agrega aquí si aplica
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

  // ✅ NUEVO: cerrar el pedido como ENTREGADO (7) y dejar al domi disponible manteniendo turno
  try {
    // 1) Intentar tomar pedidoId desde estado en memoria
    const pickPedidoId = (num?: string): number | undefined => {
      for (const v of variants(num)) {
        const st = estadoUsuarios.get(v);
        if (st?.pedidoId) return Number(st.pedidoId);
      }
      return undefined;
    };

    let pedidoId = pickPedidoId(cliente) ?? pickPedidoId(domi);

    // 2) Fallback: buscar el último pedido ASIGNADO (1) del cliente (probando variantes)
    if (!pedidoId) {
      for (const variante of variants(cliente)) {
        const lista = await this.domiciliosService.find({
          where: { numero_cliente: variante, estado: 1 }, // 1 = ASIGNADO
          order: { fecha_creacion: 'DESC' },
          take: 1,
        });
        if (lista?.length) { pedidoId = lista[0].id; break; }
      }
    }

    if (pedidoId) {
      // Obtener domiId por teléfono (si existe)
      let domiId: number | undefined = undefined;
      try {
        const domiEntity = await this.domiciliarioService.getByTelefono(domi);
        domiId = domiEntity?.id;
      } catch {}

      // 3) Marcar ENTREGADO (7) de forma atómica (requiere método en DomiciliosService)
      const okEntregado = await this.domiciliosService.marcarEntregadoSiAsignado(pedidoId, domiId);

      // 4) Dejar al domiciliario disponible sin mover su turno
      if (okEntregado && domiId) {
        await this.domiciliarioService.setDisponibleManteniendoTurnoById(domiId, true).catch(() => {});
      }
    } else {
      this.logger.warn(`⚠️ No pude inferir pedidoId a cerrar para conv=${conversacionId} (cliente=${cliente}).`);
    }
  } catch (e: any) {
    this.logger.error(`❌ Falló el cierre (estado=7) para conv=${conversacionId}: ${e?.message || e}`);
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

    // Normaliza: quita espacios y puntos separadores de miles
    const limpio = String(raw).trim().replace(/\./g, "");

    // Debe quedar solo dígitos
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

  private toTelKey(raw?: string): string {
    if (!raw) return '';
    const d = raw.replace(/\D/g, '');     // solo dígitos
    if (d.startsWith('57') && d.length === 12) return d;   // 57 + 10
    if (d.length === 10) return '57' + d;                   // agrega 57
    if (raw.startsWith('+57') && d.length === 12) return d; // +57... -> 57...
    return d;
  }


  // ---------------------------------------------------------
  // Helpers de normalización y coalesce
  // ---------------------------------------------------------
  private toTelKeyLocal(n: string) {
    // Usa tu toKey/toTelKey si ya existe
    if ((this as any).toTelKey) return (this as any).toTelKey(n);
    const d = (n || '').replace(/\D/g, '');
    return d.length === 10 ? `57${d}` : d; // 57 + 10 dígitos
  }

  private firstNonEmpty(...vals: Array<string | null | undefined>): string | null {
    for (const v of vals) {
      if (typeof v === 'string' && v.trim().length > 0) return v.trim();
    }
    return null;
  }

  // ---------------------------------------------------------
  // Carga/resuelve un snapshot del comercio sin placeholders
  // Devuelve { id?, nombre|null, telefono|null, direccion|null }
  // e intenta completar campos faltantes desde BD
  // ---------------------------------------------------------
  private async resolveComercioSnapshot(input: any, numeroWhatsApp: string): Promise<{
    id?: number;
    nombre: string | null;
    telefono: string | null;
    direccion: string | null;
  }> {
    // 1) Arranca con lo que venga en "input"
    const init = input ?? {};
    let id: number | undefined = init?.id;
    let nombre = this.firstNonEmpty(init?.nombre, init?.name, init?.razon_social);
    let telefono = this.firstNonEmpty(init?.telefono, init?.telefono_whatsapp, init?.celular, init?.tel, init?.phone);
    let direccion = this.firstNonEmpty(init?.direccion, init?.direccion_principal, init?.address);

    // Normaliza teléfono si existe
    if (telefono) telefono = this.toTelKeyLocal(telefono);

    // 2) Si faltan campos y hay id, intenta recargar por id
    if (id && (!nombre || !telefono || !direccion)) {
      try {
        const rec = (await (this.comerciosService as any)?.getById?.(id))
          ?? (await (this.comerciosService as any)?.findOne?.(id));
        if (rec) {
          nombre = nombre ?? this.firstNonEmpty(rec?.nombre, rec?.name, rec?.razon_social);
          telefono = telefono ?? this.firstNonEmpty(rec?.telefono, rec?.telefono_whatsapp, rec?.celular, rec?.tel, rec?.phone);
          direccion = direccion ?? this.firstNonEmpty(rec?.direccion, rec?.direccion_principal, rec?.address);
          if (telefono) telefono = this.toTelKeyLocal(telefono);
        }
      } catch { /* no-op */ }
    }

    // 3) Si siguen faltando datos, intenta por el número que envió el sticker
    //    (suele ser el WA del comercio)
    if (!nombre || !telefono || !direccion) {
      try {
        const telKeySticker = this.toTelKeyLocal(numeroWhatsApp);
        const recByTel =
          (await (this.comerciosService as any)?.getByTelefono?.(telKeySticker))
          ?? (await (this.comerciosService as any)?.findByTelefono?.(telKeySticker))
          ?? (await (this.comerciosService as any)?.getByWhatsapp?.(telKeySticker));
        if (recByTel) {
          id = id ?? recByTel.id;
          nombre = nombre ?? this.firstNonEmpty(recByTel?.nombre, recByTel?.name, recByTel?.razon_social);
          telefono = telefono ?? this.firstNonEmpty(recByTel?.telefono, recByTel?.telefono_whatsapp, recByTel?.celular, recByTel?.tel, recByTel?.phone);
          direccion = direccion ?? this.firstNonEmpty(recByTel?.direccion, recByTel?.direccion_principal, recByTel?.address);
          if (telefono) telefono = this.toTelKeyLocal(telefono);
        }
      } catch { /* no-op */ }
    }

    // 4) Devuelve snapshot SIN guiones; el render decide si muestra '-' u omite línea
    return { id, nombre: nombre ?? null, telefono: telefono ?? null, direccion: direccion ?? null };
  }


  
}

