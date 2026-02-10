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
import { stickerConstants } from '../auth/constants/jwt.constant';
import { PrecioDomicilio } from './entities/precio-domicilio.entity';
import { WelcomeImageService } from './welcome-image.service';
import { PhonesService } from './phones.service';
import { ChatService } from './chat.service';

const estadoUsuarios = new Map<string, any>();
const temporizadoresInactividad = new Map<string, NodeJS.Timeout>(); // ⏰ Temporizadores
const bloqueoMenu = new Map<string, NodeJS.Timeout>(); // Bloqueo temporal del menú

const temporizadoresEstado = new Map<string, NodeJS.Timeout>(); // TTL para solicitar estado a domiciliario
const ESTADO_COOLDOWN_MS = 30 * 1000; // 30 segundos

function isExpired(ts?: number) {
  return !ts || Date.now() >= ts;
}


type VigenciaOferta = { expira: number; domi: string };
const ofertasVigentes = new Map<number, VigenciaOferta>(); // pedidoId -> vigencia
const OFERTA_TIMEOUT_MS = 120_000;

// 👇 IDs de botones que usaremos
// const BTN_STICKER_CONFIRM_SI = 'sticker_confirmar_si';
// const BTN_STICKER_CONFIRM_NO = 'sticker_confirmar_no';

// const BTN_STICKER_CREAR_SI = 'sticker_crear_otro_si';
// const BTN_STICKER_CREAR_NO = 'sticker_crear_otro_no';

const BTN_STICKER_CONFIRM_SI = 'stk_ok';
const BTN_STICKER_CONFIRM_NO = 'stk_cancel';

const BTN_STICKER_CREAR_SI = 'stk_new_ok';
const BTN_STICKER_CREAR_NO = 'stk_new_no';


// const ASESOR_PSQR = '573142423130';

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
const TTL_MS = 4_000; // 4 segundos

let LAST_RETRY_AT = 0;
const MIN_GAP_MS = 30_000; // 30s de espacio entre reintentos globales

@Injectable()
export class ChatbotService {


  private readonly logger = new Logger(ChatbotService.name);
  private isRetryRunning = false; // 🔒 candado antisolape

  private readonly notifsPrecioCache = new Map<string, number>(); // idempotencia
  private readonly NOTIF_PRECIO_TTL_MS = 300_000; // 5 min para evitar duplicados

  constructor(
    private readonly comerciosService: ComerciosService, // 👈 Aquí está la inyección
    private readonly domiciliarioService: DomiciliariosService, // 👈 Aquí está la inyección
    private readonly domiciliosService: DomiciliosService, // 👈 Aquí está la inyección
    private readonly imagenWelcomeService: WelcomeImageService, // 👈 Aquí está la inyección
    private readonly phonesService: PhonesService, // ✅ NUEVO
    private readonly chatService: ChatService, // 👈 INYECTADO

    @InjectRepository(Conversacion)
    private readonly conversacionRepo: Repository<Conversacion>,

    @InjectRepository(Mensaje)
    private readonly mensajeRepo: Repository<Mensaje>,

    @InjectRepository(PrecioDomicilio)
    private readonly precioRepo: Repository<PrecioDomicilio>,

  ) { }





  private waTo(raw: any): string {
    const d = String(raw ?? '').replace(/\D/g, '');
    if (d.length === 10) return `57${d}`;
    return d; // ya viene con 57 normalmente
  }

  private async sendButtons(
    toRaw: any,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>
  ) {
    const to = this.waTo(toRaw ?? '');

    if (!/^\d{11,15}$/.test(to)) {
      this.logger.warn(`⚠️ Botones NO enviados: to inválido raw="${toRaw}" to="${to}"`);
      return;
    }

    const safeBody = String(bodyText ?? '').trim().slice(0, 1024);
    if (!safeBody) {
      this.logger.warn(`⚠️ Botones NO enviados: body vacío to="${to}"`);
      return;
    }

    const safeButtons = buttons
      .slice(0, 3)
      .map(b => ({
        type: 'reply' as const,
        reply: {
          id: String(b.id ?? '').slice(0, 256),
          title: String(b.title ?? '')
            .replace(/[^\p{L}\p{N}\s.,!?-]/gu, '')
            .trim()
            .slice(0, 20),
        },
      }))
      .filter(b => b.reply.id && b.reply.title);

    if (safeButtons.length === 0) {
      this.logger.warn(`⚠️ Botones NO enviados: todos inválidos (title vacío) to="${to}"`);
      return;
    }

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: safeBody },
        action: { buttons: safeButtons },
      },
    };

    try {
      this.logger.debug(`📤 WA OUT interactive: ${JSON.stringify(payload)}`);
      const res = await axiosWhatsapp.post('/messages', payload, { timeout: 7000 });
      this.logger.log(`✅ Botones enviados a ${to} id=${res?.data?.messages?.[0]?.id ?? 'n/a'}`);
    } catch (e: any) {
      const data = e?.response?.data;
      this.logger.error('❌ WA ERROR interactive', {
        to,
        fbtrace_id: data?.error?.fbtrace_id,
        details: data?.error?.error_data?.details,
        message: data?.error?.message || e?.message,
        payload,
      });
    }
  }



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

      await this.chatService.vaciarChatsYReiniciarIds();
      this.logger.log('✅ Reinicio de chats (mensajes + conversaciones)');

    } catch (err: any) {
      this.logger.error(`❌ Falló el reinicio de turnos: ${err?.message || err}`);
    }
  }




  @Interval(60000) // cada 50s
  async reintentarAsignacionPendientes(): Promise<void> {
    // --- helpers locales ---
    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
    const PAUSA_BASE_MS = 500;
    const JITTER_MS = 300;
    const pausaSuave = async () => {
      const jitter = Math.floor(Math.random() * JITTER_MS);
      await sleep(PAUSA_BASE_MS + jitter);
    };
    const MAX_POR_CORRIDA = 15;

    const toTelKey = (n: string) => {
      const d = String(n || '').replace(/\D/g, '');
      return d.length === 10 ? `57${d}` : d;
    };
    const telConMas = (raw: string) => {
      const d = String(raw || '').replace(/\D/g, '');
      const with57 = d.length === 10 ? `57${d}` : d;
      return with57.startsWith('+') ? with57 : `+${with57}`;
    };
    const limpiarNombre = (s?: string) =>
      String(s || '').replace(/^\s*[:\-–]\s*/, '').trim();

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
        where: { estado: 0 },
        order: { fecha: 'ASC' },
        take: 25,
      });

      if (!pendientes?.length) {
        this.logger.log('✅ No hay pedidos pendientes para reintentar.');
        return;
      }

      this.logger.log(`🔁 Reintentando asignación para ${pendientes.length} pedido(s) pendiente(s).`);

      let procesados = 0;

      for (const pedido of pendientes) {

        const rechazados = Array.isArray(pedido.domiciliarios_rechazo_ids)
          ? pedido.domiciliarios_rechazo_ids
          : null;


        const numeroClienteFmt = telConMas(toTelKey(pedido.numero_cliente));


        if (procesados >= MAX_POR_CORRIDA) {
          this.logger.log(`⏸️ Límite por corrida alcanzado (${MAX_POR_CORRIDA}).`);
          break;
        }

        try {
          // 1) Cancelar por timeout
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
              this.logger.warn(`❌ Pedido id=${pedido.id} cancelado por timeout de asignación.`);
            }
            await pausaSuave();
            procesados++;
            continue;
          }

          // 3) Detectar tipo
          const tipo = String(pedido?.tipo_servicio || '').trim();
          const esSticker = tipo.toLowerCase() === 'sticker';
          const esCompras = tipo == "2"; // 👈 nuevo flag
          const esAuto = tipo.toLowerCase() === 'auto'; // 👈 NUEVO

          // ⬇️ NUEVO: si es STICKER, primero obtén zona del comercio (si hay id_cliente)
          let zonaIdDeComercio: number | null = null;
          if (esSticker && pedido.id_cliente) {
            try {
              const comercio = await this.comerciosService.getById(Number(pedido.id_cliente));
              // Debes asegurarte que getById expone zona (c.zona_id o join a zona)
              zonaIdDeComercio =
                (typeof (comercio as any)?.zona?.id === 'number' ? (comercio as any).zona.id : undefined) ??
                (typeof (comercio as any)?.zona_id === 'number' ? (comercio as any).zona_id : null);
            } catch {
              zonaIdDeComercio = null;
            }
          }

          // 2) Intentar asignar un domi (con la info de zona si es sticker)
          let domiciliario: Domiciliario | null = null;

          if (esSticker) {
            // ✅ Caso STICKER → asignar por zona si la hay
            if (zonaIdDeComercio) {
              this.logger.log(`Asignando domiciliario en zona ${zonaIdDeComercio}`);
              try {
                domiciliario = await this.domiciliarioService.asignarDomiciliarioDisponible3(
                  Number(zonaIdDeComercio),
                  rechazados,  // 👈 AQUÍ PASAMOS LOS IDS
                );
              } catch (e) {
                this.logger.warn(`⚠️ Sin domiciliarios en zona ${zonaIdDeComercio} para sticker id=${pedido.id}.`);
                domiciliario = null;
              }
            } else {
              this.logger.warn(`⚠️ Pedido ${pedido.id} sin zona de comercio. Se intentará asignar globalmente.`);
              domiciliario = await this.domiciliarioService.asignarDomiciliarioDisponible2(
                rechazados,  // 👈 AQUÍ TAMBIÉN
              );
            }
          } else {
            // ✅ Caso NO-STICKER → asignación global
            domiciliario = await this.domiciliarioService.asignarDomiciliarioDisponible2(
              rechazados,    // 👈 Y AQUÍ
            );
          }

          // ============================
          // 🚗 CASO AUTO: reenviar SOLO los detalles al domi
          // ============================
          if (esAuto) {
            if (!domiciliario) {
              this.logger.warn(`⚠️ Sin domiciliarios para pedido AUTO id=${pedido.id}.`);
              await this.mostrarMenuPostConfirmacion(
                pedido.numero_cliente,
                pedido.id,
                '🚨 En este momento no hay domiciliarios disponibles.\n\n' +
                '⏳ Podemos reintentar en unos minutos, o puedes cancelar tu pedido.',
                5 * 60 * 1000
              );
              await pausaSuave();
              procesados++;
              continue;
            }

            // 0 → 1 (asignado) atómico SIN oferta (igual que aliado)
            const asignado = await this.domiciliosService.asignarSiPendiente(pedido.id, domiciliario.id);
            if (!asignado) {
              try { await this.domiciliarioService.liberarDomiciliario(domiciliario.id); } catch { }
              this.logger.warn(`⛔ Race detectada: AUTO p=${pedido.id} ya no está pendiente.`);
              await pausaSuave();
              procesados++;
              continue;
            }

            try { await this.domiciliarioService.setDisponibleManteniendoTurnoById(domiciliario.id, false); } catch { }

            // Crear conversación inmediata
            const conversacion = this.conversacionRepo.create({
              numero_domiciliario: domiciliario.telefono_whatsapp,
              numero_cliente: pedido.numero_cliente,
              fecha_inicio: new Date(),
              estado: 'activa',
            });
            await this.conversacionRepo.save(conversacion);

            // Guardar estado puente
            estadoUsuarios.set(pedido.numero_cliente, { conversacionId: conversacion.id, inicioMostrado: true, pedidoId: pedido.id });
            estadoUsuarios.set(domiciliario.telefono_whatsapp, { conversacionId: conversacion.id, tipo: 'conversacion_activa', inicioMostrado: true, pedidoId: pedido.id });

            // Notificar DOMI con detalles (sin botones)
            const detallePlano = (pedido.detalles_pedido ?? '').toString().trim();
            const mensajeAuto = this.sanitizeWaBody(
              [
                '📦 *PEDIDO ASIGNADO*',
                '',
                '🧩 *Tipo:* Pedido desde la página (AUTO)',
                `👤 *Número del cliente:* ${numeroClienteFmt}`,
                '',
                '📝 *Detalles:*',
                detallePlano || '(sin detalle)',
                '',
                `🆔 Pedido #${pedido.id}`,
                '💬 Ya estás conectado con el cliente en este chat.',
              ].join('\n')
            ).slice(0, 1024);

            await this.enviarMensajeTexto(domiciliario.telefono_whatsapp, mensajeAuto);

            // Notificar CLIENTE
            const nombreDomi = `${domiciliario.nombre ?? ''} ${domiciliario.apellido ?? ''}`.trim() || domiciliario.telefono_whatsapp;
            const chaqueta = domiciliario?.numero_chaqueta ?? '-';
            await this.enviarMensajeTexto(
              pedido.numero_cliente,
              [
                '✅ ¡Domiciliario asignado!',
                `👤 *${nombreDomi}*`,
                `🧥 Chaqueta: *${chaqueta}*`,
                `📞 Teléfono: *${telConMas(domiciliario.telefono_whatsapp)}*`,
                '',
                '📲 Ya están conectados en este chat. Puedes coordinar la entrega aquí mismo.',
              ].join('\n')
            );

            try { await this.enviarBotonFinalizarAlDomi(domiciliario.telefono_whatsapp); } catch { }

            await pausaSuave();
            procesados++;
            continue; // ⬅️ listo AUTO, siguiente pedido

          }

          // ============================
          // 🛒 CASO COMPRAS (tu flujo actual)
          // ============================
          if (esCompras) {
            if (!domiciliario) {
              this.logger.warn(`⚠️ Sin domiciliarios para compras id=${pedido.id}.`);
              await this.mostrarMenuPostConfirmacion(
                pedido.numero_cliente,
                pedido.id,
                '🚨 En este momento no hay domiciliarios disponibles.\n\n' +
                '⏳ Podemos reintentar en unos minutos, o puedes cancelar tu pedido.',
                5 * 60 * 1000
              );
              await pausaSuave();
              procesados++;
              continue;
            }

            // 0 → 1 (asignado) atómico SIN oferta (igual que aliado)
            const asignado = await this.domiciliosService.asignarSiPendiente(pedido.id, domiciliario.id);
            if (!asignado) {
              try { await this.domiciliarioService.liberarDomiciliario(domiciliario.id); } catch { }
              this.logger.warn(`⛔ Race detectada: compras p=${pedido.id} ya no está pendiente.`);
              await pausaSuave();
              procesados++;
              continue;
            }

            try { await this.domiciliarioService.setDisponibleManteniendoTurnoById(domiciliario.id, false); } catch { }

            // Crear conversación inmediata
            const conversacion = this.conversacionRepo.create({
              numero_domiciliario: domiciliario.telefono_whatsapp,
              numero_cliente: pedido.numero_cliente,
              fecha_inicio: new Date(),
              estado: 'activa',
            });
            await this.conversacionRepo.save(conversacion);

            // Guardar estado puente
            estadoUsuarios.set(pedido.numero_cliente, { conversacionId: conversacion.id, inicioMostrado: true, pedidoId: pedido.id });
            estadoUsuarios.set(domiciliario.telefono_whatsapp, { conversacionId: conversacion.id, tipo: 'conversacion_activa', inicioMostrado: true, pedidoId: pedido.id });

            // Mensaje al DOMI con el detalle del cliente (sin botones)
            const detalleCliente = (pedido.detalles_pedido ?? '').toString().trim() || '(sin detalle)';
            const msgDomi = this.sanitizeWaBody(
              [
                '🛒 *PEDIDO ASIGNADO (COMPRAS)*',
                `👤 *Número del cliente:* ${numeroClienteFmt}`,
                '',
                '📝 *Mensaje del cliente:*',
                detalleCliente,
                '',
                `🆔 Pedido #${pedido.id}`,
                '💬 Ya estás conectado con el cliente en este chat.',
              ].join('\n')
            ).slice(0, 1024);

            await this.enviarMensajeTexto(domiciliario.telefono_whatsapp, msgDomi);

            // Notificar CLIENTE
            const nombreDomi = `${domiciliario.nombre ?? ''} ${domiciliario.apellido ?? ''}`.trim() || domiciliario.telefono_whatsapp;
            const chaqueta = domiciliario?.numero_chaqueta ?? '-';
            await this.enviarMensajeTexto(
              pedido.numero_cliente,
              [
                '✅ ¡Domiciliario asignado!',
                `👤 *${nombreDomi}*`,
                `🧥 Chaqueta: *${chaqueta}*`,
                `📞 Teléfono: *${telConMas(domiciliario.telefono_whatsapp)}*`,
                '',
                '📲 Ya están conectados en este chat. Puedes coordinar la compra aquí mismo.',
              ].join('\n')
            );

            try { await this.enviarBotonFinalizarAlDomi(domiciliario.telefono_whatsapp); } catch { }

            await pausaSuave();
            procesados++;
            continue; // ⬅️ listo compras, siguiente pedido

          }

          // ============================
          // ✅ CASO STICKER (nuevo flujo por zona)
          // ============================
          if (esSticker) {
            // Rehidratación por id_cliente (nombre, origen, tel)
            let nombreComercioParaMostrar = '';
            try {
              if (pedido.id_cliente) {
                const comercio = await this.comerciosService.getById(Number(pedido.id_cliente));
                if (comercio) {
                  nombreComercioParaMostrar =
                    comercio.nombre_comercial ||
                    comercio.razon_social || '';

                  if (!pedido.origen_direccion) {
                    pedido.origen_direccion = comercio.direccion || '';
                  }
                  if (!pedido.telefono_contacto_origen) {
                    const tel = comercio.telefono || comercio.telefono_secundario || '';
                    pedido.telefono_contacto_origen = tel ? toTelKey(tel) : '';
                  }

                  // Persistir si agregamos algo
                  try {
                    await this.domiciliosService.update(pedido.id, {
                      origen_direccion: pedido.origen_direccion,
                      telefono_contacto_origen: pedido.telefono_contacto_origen,
                      detalles_pedido: pedido.detalles_pedido?.includes('🏪') || !nombreComercioParaMostrar
                        ? pedido.detalles_pedido
                        : [pedido.detalles_pedido || '', `🏪 ${nombreComercioParaMostrar}`].filter(Boolean).join('\n'),
                    });
                  } catch { }
                }
              }
            } catch { }

            // 🔒 Anti-vacío: si falta origen o teléfono, NO asignar todavía
            if (!pedido.origen_direccion || !pedido.telefono_contacto_origen) {
              this.logger.warn(`🟡 Sticker p=${pedido.id} sin datos mínimos (origen/tel). Se solicita completar o cancelar.`);
              try {
                await this.enviarMensajeTexto(
                  pedido.numero_cliente,
                  [
                    '⚠️ Para asignar tu pedido necesitamos:',
                    '• 📍 *Dirección de recogida*',
                    '• 📞 *Teléfono del comercio*',
                    '',
                    'Respóndenos con esos datos o escribe *CANCELAR* para anular.'
                  ].join('\n')
                );
              } catch { }
              await pausaSuave();
              procesados++;
              continue;
            }

            // Si NO hay domiciliarios: queda en espera + botón CANCELAR
            if (!domiciliario) {
              this.logger.warn(`⚠️ Sin domiciliarios para sticker id=${pedido.id}.`);
              // const cuerpo =
              //   '🚨 *Sin domiciliarios disponibles en este momento*\n\n' +
              //   'Te mantenemos en espera y lo asignaremos automáticamente cuando haya alguien libre.\n\n' +
              //   'Si *ya no lo necesitas*, puedes cancelarlo con el botón o escribiendo *CANCELAR*.';

              // try {
              //   await axiosWhatsapp.post('/messages', {
              //     messaging_product: 'whatsapp',
              //     to: pedido.numero_cliente,
              //     type: 'interactive',
              //     interactive: {
              //       type: 'button',
              //       body: { text: cuerpo },
              //       action: {
              //         buttons: [
              //           { type: 'reply', reply: { id: `cancelar_pedido_${pedido.id}`, title: '❌ Cancelar pedido' } },
              //         ],
              //       },
              //     },
              //   });
              //   await this.enviarMensajeTexto(
              //     pedido.numero_cliente,
              //     'Si no ves el botón, responde con la palabra *CANCELAR* para anular tu pedido.'
              //   );
              // } catch { }


              await pausaSuave();
              procesados++;
              continue;
            }

            // 0 → 1 (asignado) atómico SIN oferta
            const asignado = await this.domiciliosService.asignarSiPendiente(
              pedido.id,
              domiciliario.id,
              // 👇 pasa la zona si la tienes; tu método la valida condicionalmente
            );
            if (!asignado) {
              try { await this.domiciliarioService.setDisponibleManteniendoTurnoById(domiciliario.id, true); } catch { }
              this.logger.warn(`⛔ Race: sticker p=${pedido.id} ya no está pendiente al asignar.`);
              await pausaSuave();
              procesados++;
              continue;
            }

            // (Opcional) bloquear ofertas mientras tiene pedido
            try { await this.domiciliarioService.setDisponibleManteniendoTurnoById(domiciliario.id, false); } catch { }

            // Crear conversación inmediata
            const conversacion = this.conversacionRepo.create({
              numero_domiciliario: domiciliario.telefono_whatsapp,
              numero_cliente: pedido.numero_cliente,
              fecha_inicio: new Date(),
              estado: 'activa',
            });
            await this.conversacionRepo.save(conversacion);

            estadoUsuarios.set(pedido.numero_cliente, {
              conversacionId: conversacion.id,
              inicioMostrado: true,
            });
            estadoUsuarios.set(domiciliario.telefono_whatsapp, {
              conversacionId: conversacion.id,
              tipo: 'conversacion_activa',
              inicioMostrado: true,
            });

            // Notificar DOMI (URGENTE)
            const nombreComercio = limpiarNombre(
              nombreComercioParaMostrar ||
              (pedido.detalles_pedido?.match(/(?:🏪\s*(.+)|comercio[:\-]?\s*(.+))/i)?.[1] ??
                pedido.detalles_pedido?.match(/comercio[:\-]?\s*(.+)/i)?.[1] ?? '')
            ) || 'Comercio';

            const resumenUrgente = this.sanitizeWaBody(
              [
                '🚨 *PEDIDO ASIGNADO (URGENTE)*',
                '',
                `🏪 *Comercio:* ${nombreComercio}`,
                pedido.origen_direccion ? `📍 *Recoger en:* ${pedido.origen_direccion}` : '',
                pedido.telefono_contacto_origen ? `📞 *Tel:* ${pedido.telefono_contacto_origen}` : '',
                '',
                `🆔 Pedido #${pedido.id}`,
                '💬 Ya estás conectado con el cliente en este chat.',
              ].filter(Boolean).join('\n')
            );
            await this.enviarMensajeTexto(domiciliario.telefono_whatsapp, resumenUrgente);

            // Notificar CLIENTE
            const nombreDomi = `${domiciliario.nombre ?? ''} ${domiciliario.apellido ?? ''}`.trim() || domiciliario.telefono_whatsapp;
            const chaqueta = domiciliario?.numero_chaqueta ?? '-';
            await this.enviarMensajeTexto(
              pedido.numero_cliente,
              [
                '✅ ¡Domiciliario asignado (URGENTE)!',
                `👤 *${nombreDomi}*`,
                `🧥 Chaqueta: *${chaqueta}*`,
                `📞 Teléfono: *${telConMas(domiciliario.telefono_whatsapp)}*`,
                '',
                '📲 Ya están conectados en este chat. Puedes coordinar la entrega aquí mismo.',
              ].join('\n')
            );

            // Botón de finalizar al domi (si lo usas)
            try { await this.enviarBotonFinalizarAlDomi(domiciliario.telefono_whatsapp); } catch { }

            await pausaSuave();
            procesados++;
            continue; // ⬅️ ya terminamos el sticker; siguiente pedido
          }
          // ============================
          // FIN CASO STICKER
          // ============================

          // --------- CASO NO-STICKER: tu flujo de OFERTA se mantiene ---------
          if (!domiciliario) {
            this.logger.warn(`⚠️ Sin domiciliarios para pedido id=${pedido.id}.`);
            await this.mostrarMenuPostConfirmacion(
              pedido.numero_cliente,
              pedido.id,
              '🚨🚨🚨🚨🚨🚨🚨🚨\n' +
              '⚠️ 😔 EN EL MOMENTO NO HAY DISPONIBLES\n\n' +
              '⏳ ¿Deseas esperar entre 1 a 5,10,15 minutos mientras alguien se desocupa y acepta tu pedido?\n' +
              '👉 O cancelar servicio.',
              5 * 60 * 1000
            );
            await pausaSuave();
            procesados++;
            continue;
          }

          // 3) ASIGNACIÓN DIRECTA atómica (solo no-sticker) 0 -> 1
          const asignado = await this.domiciliosService.asignarSiPendiente(
            pedido.id,
            domiciliario.id
          );

          if (!asignado) {
            try { await this.domiciliarioService.liberarDomiciliario(domiciliario.id); } catch { }
            this.logger.warn(`⛔ Race detectada: pedido ${pedido.id} ya no está pendiente.`);

            // Enviar botón de cancelar al cliente
            try {
              await this.mostrarMenuPostConfirmacion(
                pedido.numero_cliente,
                pedido.id,
                '⏳ *ESTAMOS BUSCANDO UN DOMICILIARIO DISPONIBLE.*\n\n*SI YA NO LO NECESITAS, PUEDES CANCELAR:*',
                60 * 1000
              );
            } catch (e) {
              this.logger.warn(`⚠️ No se pudo mostrar botón cancelar tras race: ${e?.message || e}`);
            }

            await pausaSuave();
            procesados++;
            continue;
          }

          // (Opcional) marcar domiciliario ocupado
          try { await this.domiciliarioService.setDisponibleManteniendoTurnoById(domiciliario.id, false); } catch { }

          // —— Rehidratación para mostrar comercio en el resumen (igual que tenías)
          let nombreComercioParaMostrar = '';
          if (pedido.id_cliente) {
            try {
              const comercio = await this.comerciosService.getById(Number(pedido.id_cliente));
              if (comercio) {
                nombreComercioParaMostrar =
                  comercio.nombre_comercial || comercio.razon_social || '';
                if (!pedido.origen_direccion) {
                  pedido.origen_direccion = comercio.direccion || '';
                }
                if (!pedido.telefono_contacto_origen) {
                  const tel = comercio.telefono || comercio.telefono_secundario || '';
                  pedido.telefono_contacto_origen = tel ? toTelKey(tel) : '';
                }
                // persistir si agregamos algo
                try {
                  await this.domiciliosService.update(pedido.id, {
                    origen_direccion: pedido.origen_direccion,
                    telefono_contacto_origen: pedido.telefono_contacto_origen,
                    detalles_pedido: pedido.detalles_pedido?.includes('🏪') || !nombreComercioParaMostrar
                      ? pedido.detalles_pedido
                      : [pedido.detalles_pedido || '', `🏪 ${nombreComercioParaMostrar}`].filter(Boolean).join('\n'),
                  });
                } catch { }
              }
            } catch { }
          }

          const tipoLinea = tipo ? `🔁 *Tipo de servicio:* ${tipo}` : '';
          const recoger = pedido.origen_direccion
            ? `📍 *Recoger en:* ${pedido.origen_direccion}\n📞 *Tel:* ${pedido.telefono_contacto_origen || '-'}`
            : '';
          const entregar = pedido.destino_direccion
            ? `🏠 *Entregar en:* ${pedido.destino_direccion}\n📞 *Tel:* ${pedido.telefono_contacto_destino || '-'}`
            : '';

          const lista = (() => {
            const lineas = String(pedido.detalles_pedido || '').split('\n');
            const lineaComercioTxt = lineas.find(l => /🏪|comercio/i.test(l)) || '';
            const m = lineaComercioTxt.match(/(?:🏪\s*([^\n]+?)\s*$|comercio[:\-]?\s*([^\n]+?)\s*$)/i);
            let nombre = limpiarNombre(m?.[1] || m?.[2]) || limpiarNombre(nombreComercioParaMostrar);
            return nombre && nombre !== '-' ? `🏪 *Comercio:* ${nombre}` : '';
          })();

          const resumenPedido = [tipoLinea, recoger, entregar, lista]
            .filter(Boolean)
            .join('\n\n');

          const bodyTexto = this.sanitizeWaBody(
            `📦 *PEDIDO ASIGNADO:*\n\n` +
            `👤 *Número del cliente:* ${numeroClienteFmt}\n\n` +
            `${resumenPedido}`
          );

          await pausaSuave();

          // ✅ EN VEZ DE OFERTA: crear conversación inmediata + notificar (como aliado)
          const conversacion = this.conversacionRepo.create({
            numero_domiciliario: domiciliario.telefono_whatsapp,
            numero_cliente: pedido.numero_cliente,
            fecha_inicio: new Date(),
            estado: 'activa',
          });
          await this.conversacionRepo.save(conversacion);

          estadoUsuarios.set(pedido.numero_cliente, {
            conversacionId: conversacion.id,
            tipo: 'conversacion_activa',
            inicioMostrado: true,
            pedidoId: pedido.id,
            esperandoAsignacion: false,
          });
          estadoUsuarios.set(domiciliario.telefono_whatsapp, {
            conversacionId: conversacion.id,
            tipo: 'conversacion_activa',
            inicioMostrado: true,
            pedidoId: pedido.id,
          });

          // Notificar DOMI (sin aceptar/rechazar)
          await this.enviarMensajeTexto(
            domiciliario.telefono_whatsapp,
            this.sanitizeWaBody(
              [
                '📦 *PEDIDO ASIGNADO*',
                '',
                bodyTexto,
                '',
                `🆔 Pedido #${pedido.id}`,
                '💬 Ya estás conectado con el cliente en este chat.',
              ].join('\n')
            ).slice(0, 1024)
          );

          // Notificar CLIENTE
          const nombreDomi = `${domiciliario.nombre ?? ''} ${domiciliario.apellido ?? ''}`.trim() || domiciliario.telefono_whatsapp;
          const chaqueta = domiciliario?.numero_chaqueta ?? '-';
          await this.enviarMensajeTexto(
            pedido.numero_cliente,
            [
              '✅ ¡Domiciliario asignado!',
              `👤 *${nombreDomi}*`,
              `🧥 Chaqueta: *${chaqueta}*`,
              `📞 Teléfono: *${telConMas(domiciliario.telefono_whatsapp)}*`,
              '',
              '📲 Ya están conectados en este chat. Puedes coordinar la entrega aquí mismo.',
            ].join('\n')
          );

          // Botón de finalizar al domi (si lo usas)
          try { await this.enviarBotonFinalizarAlDomi(domiciliario.telefono_whatsapp); } catch { }

        } catch (err) {
          this.logger.error(`❌ Error reintentando pedido id=${pedido.id}: ${err?.message || err}`);
        } finally {
          await pausaSuave();
          procesados++;
        }
      }
    } catch (err) {
      this.logger.error(`❌ Error global en reintentos: ${err?.message || err}`);
    } finally {
      this.isRetryRunning = false;
      LAST_RETRY_AT = Date.now();
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

    const numeroCuentas =
      (await this.phonesService.getNumeroByKey('CUENTAS')) ??
      '573108054942'; // fallback seguro





    const numero = mensaje?.from;
    const texto = mensaje?.text?.body;
    const nombre = value?.contacts?.[0]?.profile?.name ?? 'cliente';





    // En la parte superior de procesarMensajeEntrante, justo después de definir const numero = mensaje?.from;
    if (numero === numeroCuentas) {
      await this.enviarMensajeTexto(numero, '👋 Hola Wilber');

      await this.enviarSticker(numero, String(stickerConstants.stickerId))
      // 🔥 Elimina la conversación del mapa en memoria
      estadoUsuarios.delete(numero);
      return; // Detiene aquí el flujo
    }


    // ⏰ Bloque de horario: sin servicio 1:00–4:59 a.m. (hora Bogotá)
    try {
      // Hora actual en zona "America/Bogota"
      const bogotaNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
      const horaBOG = bogotaNow.getHours(); // 0–23

      // (Opcional) Si quieres permitir a los domiciliarios hablar fuera de horario, descomenta:
      // const esDomi = await this.domiciliarioService.esDomiciliario(numero).catch(() => false);
      // if (!esDomi && horaBOG >= 1 && horaBOG < 5) { ... }

      if (horaBOG >= 4 && horaBOG < 5) {
        await this.enviarMensajeTexto(
          numero,
          [
            '🕐 *Fuera de horario de servicio*',
            'Por el momento no tenemos servicio disponible entre *4:00 a. m.* y *5:00 a. m.* (hora 🇨🇴).',
            'Por favor escríbenos a partir de las *5:00 a. m.*. ¡Gracias por tu comprensión! 🙏'
          ].join('\n')
        );

        // 🔑 Normaliza clave
        const numeroKey = this.toKey ? this.toKey(numero) : (numero || '');

        // 🧹 Limpia estados en memoria (no BD)
        try {
          // estado principal
          estadoUsuarios.delete(numero);
          estadoUsuarios.delete(numeroKey);

          // bloqueos/flags auxiliares
          try { bloqueoMenu?.delete?.(numero); } catch { }
          try { bloqueoMenu?.delete?.(numeroKey); } catch { }

          // timers por número (si los usas)
          try {
            if (temporizadoresEstado?.has?.(numero)) {
              clearTimeout(temporizadoresEstado.get(numero)!);
              temporizadoresEstado.delete(numero);
            }
            if (temporizadoresEstado?.has?.(numeroKey)) {
              clearTimeout(temporizadoresEstado.get(numeroKey)!);
              temporizadoresEstado.delete(numeroKey);
            }
          } catch { }

          try {
            if (temporizadoresInactividad?.has?.(numero)) {
              clearTimeout(temporizadoresInactividad.get(numero)!);
              temporizadoresInactividad.delete(numero);
            }
            if (temporizadoresInactividad?.has?.(numeroKey)) {
              clearTimeout(temporizadoresInactividad.get(numeroKey)!);
              temporizadoresInactividad.delete(numeroKey);
            }
          } catch { }

          // cachés anti-doble click / idempotencia con prefijo por número (si existen)
          try {
            for (const k of (cancelacionesProcesadas?.keys?.() ?? [])) {
              if (typeof k === 'string' && k.startsWith(`${numero}:`)) {
                cancelacionesProcesadas.delete(k);
              }
            }
          } catch { }

          try {
            for (const k of (procesados?.keys?.() ?? [])) {
              if (typeof k === 'string' && k.startsWith(`${numero}:`)) {
                procesados.delete(k);
              }
            }
          } catch { }

          // cualquier otra estructura por número que mantengas:
          // try { notifsPrecioCache?.clear?.(); } catch {}
        } catch (e) {
          this.logger.warn(`⚠️ Limpieza fuera de horario falló para ${numero}: ${e instanceof Error ? e.message : e}`);
        }

        return; // 🚫 No procesar nada más del mensaje
      }

    } catch (e) {
      // Si algo falla, no bloquees el flujo por el horario
      this.logger.warn(`⚠️ No se pudo evaluar horario de Bogotá: ${e instanceof Error ? e.message : e}`);
    }


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


      const norm = textoPlano
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // sí -> si
        .replace(/[^\p{L}\p{N}]+/gu, ' ') // limpia símbolos
        .trim();

      const numeroKeyLocal = this.toKey ? this.toKey(numero) : (numero || '');
      const st = estadoUsuarios.get(numeroKeyLocal) || {};

      // Detecta si está en algún flujo de confirmación: sticker o pedido rápido
      const enPreConfirm = !!st.stickerConfirmPayload && !st.stickerConfirmCreate;
      const enForceConfirm = !!st.stickerForcePayload && !st.stickerForceCreate;
      const enConfirmPedidoRapido = !!st.pedidoRapidoPendiente && !st.pedidoRapidoConfirmado;

      if (enPreConfirm || enForceConfirm || enConfirmPedidoRapido) {
        // Si escribió "sí"
        if (norm === 'si') {
          if (enPreConfirm) {
            st.stickerConfirmCreate = true;
            estadoUsuarios.set(numeroKeyLocal, st);

            const payload = st.stickerConfirmPayload || {};
            await this.crearPedidoDesdeSticker(
              numeroKeyLocal,
              payload?.comercioSnap,
              payload?.nombreContacto
            );

            delete st.stickerConfirmPayload;
            estadoUsuarios.set(numeroKeyLocal, st);
            return;
          }

          if (enForceConfirm) {
            st.stickerForceCreate = true;
            estadoUsuarios.set(numeroKeyLocal, st);

            const payload = st.stickerForcePayload || {};
            await this.crearPedidoDesdeSticker(
              numeroKeyLocal,
              payload?.comercioSnap,
              payload?.nombreContacto
            );

            st.stickerForceCreate = false;
            delete st.stickerForcePayload;
            estadoUsuarios.set(numeroKeyLocal, st);
            return;
          }

          if (enConfirmPedidoRapido) {
            st.pedidoRapidoConfirmado = true;
            const comercio = st.pedidoRapidoPendiente?.comercioSnap;
            const nombre = st.pedidoRapidoPendiente?.nombreContacto;
            delete st.pedidoRapidoPendiente;
            estadoUsuarios.set(numeroKeyLocal, st);

            await this.crearPedidoDesdeSticker(numeroKeyLocal, comercio, nombre);
            return;
          }
        }

        // Si escribió "no"
        if (norm === 'no') {
          if (enPreConfirm) {
            delete st.stickerConfirmCreate;
            delete st.stickerConfirmPayload;
            estadoUsuarios.set(numeroKeyLocal, st);
            await this.enviarMensajeTexto(
              numeroKeyLocal,
              '👍 *Operación cancelada.* Cancelaste el domicilio. Puedes escribirme para *comenzar de nuevo*.'
            );
            return;
          }

          if (enForceConfirm) {
            delete st.stickerForceCreate;
            delete st.stickerForcePayload;
            estadoUsuarios.set(numeroKeyLocal, st);
            await this.enviarMensajeTexto(
              numeroKeyLocal,
              '👍 Operación cancelada. Si necesitas un domicilio, envía el numero 1 de nuevo cuando quieras.'
            );
            return;
          }

          if (enConfirmPedidoRapido) {
            delete st.pedidoRapidoPendiente;
            delete st.pedidoRapidoConfirmado;
            estadoUsuarios.set(numeroKeyLocal, st);
            await this.enviarMensajeTexto(numeroKeyLocal, '👍 *Operación cancelada.* Cancelaste el domicilio. Puedes escribirme para *comenzar de nuevo*.'
            );
            return;
          }
        }

        // Si escribió otra cosa diferente a sí/no
        if (norm && norm.length < 25) {
          await this.enviarMensajeTexto(
            numeroKeyLocal,
            '❓ Por favor confirma si deseas el domicilio respondiendo:\n✅ *Sí* o ❌ *No*'
          );
          return;
        }
      }

      // --- Handler "más" (mostrar botones extra) ---
      {
        // Usa tu normalización ya hecha: 'norm' == 'mas' con o sin tilde/mayúsculas
        if (norm === 'mas') {
          // Reglas: solo si NO hay flujo activo, NO hay conversación activa y NO está esperando asignación
          const enFlujo = this.estaEnCualquierFlujo(numero);
          const stMenu = estadoUsuarios.get(numeroKeyLocal) || {};
          const hayConversacionActiva = Boolean(stMenu?.conversacionId);
          const esperando = Boolean(stMenu?.esperandoAsignacion);

          // Evitar interferir si el mensaje actual es de cancelar (por si WhatsApp repite eventos)
          const pidCancelEarly =
            mensaje?.interactive?.type === 'button_reply'
              ? mensaje.interactive.button_reply.id
              : '';
          const esBtnCancelarEarly =
            pidCancelEarly === 'cancelar' ||
            pidCancelEarly === 'menu_cancelar' ||
            /^cancelar_pedido_\d+$/.test(pidCancelEarly) ||
            /^menu_cancelar_\d+$/.test(pidCancelEarly);

          if (!enFlujo && !hayConversacionActiva && !esperando && !esBtnCancelarEarly) {
            try {
              if (!stMenu?.inicioMostrado) {
                // Si aún no mostraste el menú inicial, muéstralo primero
                await this.enviarMasBotones(numero);
                // y sugiere usar "más" para ver más opciones
              } else {
                // Menú ya mostrado → envía los botones extra (opcion_4 y opcion_5)
                await this.enviarMasBotones(numero);
              }
            } catch (e: any) {
              this.logger.warn(`⚠️ Error al procesar "más" para ${numero}: ${e?.message || e}`);
              await this.enviarMensajeTexto(
                numero,
                '❌ No pude mostrar más opciones. Intenta de nuevo escribiendo "más".'
              );
            }
            return; // importante: no sigas con otros handlers de este mensaje
          }
        }
      }
      // --- fin handler "más" ---


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
      // 1) Rehidrata el pedidoId si no está en memoria
      let pid = stNow?.pedidoId ?? null;
      if (!pid) {
        try {
          const p = await this.domiciliosService.getPedidoEnProceso(numeroKey); // estados 0 ó 5
          if (p) {
            pid = p.id;
            stNow.pedidoId = p.id;              // guarda para siguientes mensajes
            estadoUsuarios.set(numeroKey, stNow);
          }
        } catch (e) {
          this.logger.warn(`⚠️ Rehidratación falló para ${numeroKey}: ${e?.message || e}`);
        }
      }

      // 1) Mensaje de "buscando domiciliario..."
      await this.enviarMensajeTexto(
        numero,
        '⏳ *ESTAMOS BUSCANDO UN DOMICILIARIO CERCANO A TU DIRECCIÓN PARA ASIGNAR TU PEDIDO LO ANTES POSIBLE.*\n\n🛵 *DOMICILIOSW, TU MEJOR OPCIÓN* 🙌'
      );

      // 3) Botón CANCELAR con helper (incluye Ref:#, valida cancelable y respeta bloqueoMenu/TTL)
      if (pid) {
        await this.mostrarMenuPostConfirmacion(
          numero,
          pid,
          '⏳ Si ya no lo necesitas, puedes cancelar:',
          60 * 1000
        );
      }

      return;
    }


    // --- Captura de DIRECCIÓN de recogida previo al precio ---
    // (UBICAR justo ANTES de: // --- CAPTURA DE PRECIO EN CURSO ---)
    {
      if (tipo === 'text') {
        const key = this.toKey ? this.toKey(numero) : numero;
        const stLocal = estadoUsuarios.get(key) || estadoUsuarios.get(numero);

        if (stLocal?.capturandoDireccionRecogida && !stLocal?.conversacionFinalizada) {
          const textoPlano = (texto || '').toString().trim();

          if (!textoPlano) {
            await this.enviarMensajeTexto(numero, '✍️ Por favor escribe la *dirección de recogida*.');
            return;
          }

          if (textoPlano.length < 3) {
            await this.enviarMensajeTexto(numero, '⚠️ La dirección es muy corta. Escríbela completa, por favor.');
            return;
          }

          // Guardar dirección y avanzar a captura de precio
          stLocal.direccionRecogidaTmp = textoPlano;
          stLocal.capturandoDireccionRecogida = false;

          stLocal.capturandoPrecio = true;
          stLocal.confirmandoPrecio = false;
          stLocal.precioTmp = undefined;

          // (si no existía, asegura conversacionId)
          if (!stLocal.conversacionId) {
            const stNum = estadoUsuarios.get(numero) || {};
            if (stNum?.conversacionId) stLocal.conversacionId = stNum.conversacionId;
          }

          estadoUsuarios.set(key, stLocal);

          await this.enviarMensajeTexto(
            numero,
            '💰 *Escribe el valor total cobrado al cliente* (ej: 15000, $15.000 o 12.500).\n\n' +
            'Si el domicilio fue *cancelado por el cliente*, escribe **0** como valor.\n' +
            'Recuerda conservar la evidencia de la cancelación (mensaje o soporte del cliente).'
          );

          return; // detenemos para no caer en otros handlers
        }
      }
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
        if (monto !== 0 && monto < 5000) {
          await this.enviarMensajeTexto(
            numero,
            '⚠️ El precio debe ser 0 si fue cancelado o un valor igual o mayor a 5.000. Ejemplos: 0, 5000, 12.500'
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

        await this.sendButtons(
          numero,
          '¿Confirmas este valor?',
          [
            { id: 'confirmar_precio_si', title: 'Si finalizar' },
            { id: 'confirmar_precio_no', title: 'Reingresar' },
          ]
        );


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

        await this.enviarMensajeTexto(
          numero,
          "⏳ Por favor espera 2 minutos antes de intentar cambiar tu estado o zona nuevamente."
        );

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

      let disponible: boolean, turno: number, nombreDomi: string, zonaId: number | null;

      try {
        const res = await this.domiciliarioService.getEstadoPorTelefono(numero);
        disponible = res.disponible;
        turno = res.turno;
        nombreDomi = res.nombre;
        zonaId = res.zona_id; // ✅ coincide el tipo
      } catch (e: any) {
        this.logger.warn(`⚠️ No se pudo obtener estado actual para ${numero}: ${e?.message || e}`);
        await this.enviarMensajeTexto(numero, '❌ No encontré tu perfil como domiciliario.');
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

      // Texto legible de zona
      const zonaTxt =
        zonaId === 1 ? '🏙️ Zona Centro' :
          zonaId === 2 ? '🌄 Zona Solarte' :
            (zonaId == null ? 'Sin zona' : `ID ${zonaId}`);

      try {
        await this.enviarMensajeTexto(
          numero,
          `👋 Hola ${nombreDomi || ''}\n` +
          `Tu *estado actual* es: ${estadoTxt}\n` +
          `🔢 Tu turno actual es: *${turno}*\n\n` +
          `📍 Tu zona actual es: *${zonaTxt}*\n\n` +
          `¿Deseas cambiar tu estado?`
        );

        // 👇 Botones condicionados por disponibilidad
        const buttons = disponible
          ? [
            { type: 'reply', reply: { id: nextId, title: nextLbl } },
            { type: 'reply', reply: { id: 'mantener_estado', title: keepLbl } },
            { type: 'reply', reply: { id: 'cambiar_zona', title: 'Cambiar zona' } }, // solo si DISPONIBLE
          ]
          : [
            { type: 'reply', reply: { id: 'cambiar_a_disponible', title: '✅ Disponible' } },
            { type: 'reply', reply: { id: 'mantener_estado', title: keepLbl } },
          ];

        await this.sendButtons(
          numero,
          'Elige una opción:',
          buttons.map((b: any) => ({
            id: b.reply.id,
            title: b.reply.title,
          }))
        );

      } catch (e: any) {
        this.logger.warn(`⚠️ Falló el envío de botones a ${numero}: ${e?.response?.data?.error?.message || e?.message || e}`);

        // Liberar guardas si falló
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
          await this.enviarSaludoYBotones(numero, nombre);
          await this.enviarMensajeTexto(numero, '✍️ Escribe *más* para ver más opciones.');

          return;
        }

        // (opcional) Mensaje corto de progreso
        // await this.enviarMensajeTexto(numero, '⚡ Procesando tu pedido rápido...');

        // Crea el pedido (este método ya intenta asignar y, si no hay domi, marca esperandoAsignacion)
        await this.crearPedidoDesdeSticker(numero, comercio, comercio.nombre);

        // 👉 Después de crear, intenta mostrar botón de cancelar si seguimos en espera de asignación
        try {
          const numeroKey = this.toKey ? this.toKey(numero) : numero;
          const st = estadoUsuarios.get(numeroKey) || {};

          // Rehidrata si aún no tenemos pedidoId en memoria
          if (!st.pedidoId) {
            const p = await this.domiciliosService.getPedidoEnProceso(numeroKey).catch(() => null); // estados 0/5
            if (p) {
              st.pedidoId = p.id;
              estadoUsuarios.set(numeroKey, st);
            }
          }

          if (st.esperandoAsignacion && st.pedidoId && !st.conversacionId) {

            await this.enviarMensajeTexto(
              numero,
              '⏳ *ESTAMOS BUSCANDO UN DOMICILIARIO CERCANO A TU DIRECCIÓN PARA ASIGNAR TU PEDIDO LO ANTES POSIBLE.*\n\n🛵 *DOMICILIOSW, TU MEJOR OPCIÓN* 🙌'
            );


            await this.mostrarMenuPostConfirmacion(
              numero,
              st.pedidoId,
              '⏳ Si ya no lo necesitas, puedes cancelar:',
              60 * 1000
            );
          }
        } catch (e) {
          this.logger.warn(`⚠️ No se pudo mostrar botón cancelar tras trigger rápido: ${e?.message || e}`);
        }
      } catch (err: any) {
        this.logger.error(`❌ Error en trigger por texto "${TRIGGER_PALABRA_CLAVE}": ${err?.message || err}`);
        await this.enviarMensajeTexto(
          numero,
          '❌ SI NO ESTAS AFILIADO, escribe "mas" para menu de afiliación afiliarte.'
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

    // 🔀 PUENTE AFILIACIONES: reenvía mensajes entre cliente y asesor de aliados


    if (st?.afiliacionActiva && st?.afiliacionConversacionId) {
      const textoPlano = (texto || '').trim();

      // ✅ Permitir que CUALQUIERA (asesor o cliente) cierre con "cerrar"
      if (tipo === 'text' && /^cerrar$/i.test(textoPlano)) {
        await this.finalizarAfiliacionPorCualquiera(numero);
        return;
      }

      // 2) Determinar el otro participante
      const esAsesorAf = !!st.afiliacionCliente; // si existe afiliacionCliente => soy asesor
      const otro = esAsesorAf ? st.afiliacionCliente : st.afiliacionAsesor;

      // 3) Reenviar el mensaje con prefijo
      if (tipo === 'text' && texto && otro) {
        const prefijo = esAsesorAf ? '👩‍💼' : '🙋‍♀️';
        await this.enviarMensajeTexto(otro, `${prefijo} ${texto}`);
      }

      // 4) No cerrar por inactividad mientras esté activo
      return;
    }



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
    // Guard de "esperando asignación", PERO ahora también muestra el botón de cancelar
    if (estado?.esperandoAsignacion && !isBtnCancelar) {
      try {
        const numeroKey = this.toKey ? this.toKey(numero) : numero;

        // Rehidrata pedidoId si aún no está en memoria
        let st = estadoUsuarios.get(numeroKey) || {};
        if (!st.pedidoId) {
          const p = await this.domiciliosService.getPedidoEnProceso(numeroKey).catch(() => null); // estados 0/5
          if (p) {
            st.pedidoId = p.id;
            estadoUsuarios.set(numeroKey, st);
          }
        }

        // Mensaje de “procesando”
        // Mensaje de “procesando”
        await this.enviarMensajeTexto(
          numero,
          '⏳ *ESTAMOS BUSCANDO UN DOMICILIARIO CERCANO A TU DIRECCIÓN PARA ASIGNAR TU PEDIDO LO ANTES POSIBLE.*\n\n🛵 *DOMICILIOSW, TU MEJOR OPCIÓN* 🙌'
        );



        // Muestra botón de cancelar si tenemos pedidoId y no hay conversación activa
        if (st?.pedidoId && !st?.conversacionId) {
          await this.mostrarMenuPostConfirmacion(
            numero,
            st.pedidoId,
            '⏳ Si ya no lo necesitas, puedes cancelar:',
            60 * 1000
          );
        }
      } catch (e) {
        this.logger.warn(
          `⚠️ No se pudo mostrar el botón de cancelar en guard "esperandoAsignacion": ${e?.message || e}`
        );
      }
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

      const conversacionCerrada = !!conversacion.esta_finalizada;

      // ⛔ Si la conversación está cerrada, SOLO bloquea al CLIENTE
      if (conversacionCerrada && esCliente) {
        await this.enviarMensajeTexto(
          numero,
          '⚠️ Este pedido ya fue finalizado. No es posible enviar más mensajes en esta conversación.'
        );
        return;
      }

      // -----------------------
      // Normalizar entrada
      // -----------------------
      const entrada = texto
        ?.trim()
        .toLowerCase()
        .normalize('NFD') // separa acentos
        .replace(/[\u0300-\u036f]/g, ''); // elimina acentos


      // =====================================================
      // 1) CLIENTE escribe "finalizar" → cierra pedido SOLO para él
      // =====================================================
      const finalesCliente = ['finalizar', 'pedido finalizado', 'finalizado'];
      if (entrada && finalesCliente.some(p => entrada.startsWith(p))) {

        // Marcar conversación como finalizada (si no lo estaba)
        conversacion.esta_finalizada = true;
        conversacion.finalizada_por = esCliente ? 'cliente' : (esDomiciliario ? 'domiciliario' : 'desconocido');
        conversacion.fecha_finalizacion = new Date();
        await this.conversacionRepo.save(conversacion);

        // 🔓 LIBERAR AL CLIENTE: quitarle conversacionId para que pueda hacer nuevos pedidos
        const stCliente = estadoUsuarios.get(conversacion.numero_cliente) || {};
        delete stCliente.conversacionId;
        delete stCliente.capturandoPrecio;
        delete stCliente.capturandoDireccionRecogida;
        delete stCliente.conversacionFinalizada;
        estadoUsuarios.set(conversacion.numero_cliente, stCliente);

        // Mantener al DOMI con la conversación para que pueda seguir el flujo (precio, etc.)
        const stDomi = estadoUsuarios.get(conversacion.numero_domiciliario) || {};
        stDomi.clienteFinalizo = true; // bandera informativa por si la quieres usar
        estadoUsuarios.set(conversacion.numero_domiciliario, stDomi);

        if (esCliente) {
          // Mensaje al cliente
          await this.enviarMensajeTexto(
            conversacion.numero_cliente,
            '✅ ¡Tu pedido ha sido finalizado con éxito! Gracias por elegirnos. En Domicilios W siempre es un gusto atenderte.'
          );


          // Aviso al domi (sin bloquearle nada)
          await this.enviarMensajeTexto(
            conversacion.numero_domiciliario,
            'ℹ️ El cliente marcó el pedido como finalizado. Aún puedes cerrar tu flujo y reportar el precio.'
          );
        } else if (esDomiciliario) {
          // Caso raro: si el domi manda "finalizar" como texto
          await this.enviarMensajeTexto(
            conversacion.numero_domiciliario,
            '✅ Has finalizado este pedido y la conversación ha sido cerrada.'
          );
        }

        return; // ⛔ importante: no reenviar más mensajes
      }

      // =====================================================
      // 2) Lógica "fin_domi" / botón del domiciliario
      // =====================================================
      const finales = ['fin_domi', 'fin-domi', 'fin domi'];
      if (entrada && finales.some(p => entrada.startsWith(p))) {
        // Solo permitir que el domiciliario dispare esto
        const conversacionConfirm = await this.conversacionRepo.findOne({ where: { id: estado.conversacionId } });
        if (!conversacionConfirm) return;

        const esDomi = numero === conversacionConfirm.numero_domiciliario;
        if (!esDomi) {
          await this.enviarMensajeTexto(numero, '⛔ Solo el domiciliario puede finalizar este pedido.');
          return;
        }

        await this.sendButtons(
          numero,
          '¿Seguro que deseas finalizar el pedido?',
          [
            { id: 'fin_domi', title: 'Finalizar' },
          ]
        );

        return;
      }

      // =====================================================
      // 3) Guardar mensaje SIEMPRE (aunque esté cerrada)
      // =====================================================
      await this.mensajeRepo.save({
        conversacion_id: String(conversacion.id),
        emisor: numero,
        receptor,
        contenido: texto,
        tipo,
      });

      // =====================================================
      // 4) Reenviar el mensaje al otro participante
      // =====================================================
      if (tipo === 'text' && texto) {

        // Solo reenviamos si NO está cerrada
        if (!conversacionCerrada) {
          await this.enviarMensajeTexto(receptor, `💬 ${texto}`);

          // Si el mensaje lo envía el CLIENTE, mandamos el botón de finalizar al DOMI
          if (esCliente) {
            await this.sendButtons(
              receptor, // DOMICILIARIO
              '¿Deseas finalizar el pedido?',
              [
                { id: 'fin_domi', title: 'Finalizar' },
              ]
            );

          }
        } else {
          // Conversación cerrada:
          //  - Si escribe el domi: avisamos que el cliente ya finalizó, pero no reenviamos nada.
          if (esDomiciliario) {
            await this.enviarMensajeTexto(
              numero,
              'ℹ️ El cliente ya finalizó el pedido. Tus mensajes no se reenviarán, pero aún puedes finalizar el servicio con el botón o confirmando el precio.'
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

      // 🚀 Lista de opciones
      await this.enviarSaludoYBotones(numero, nombre);

      await this.enviarMensajeTexto(numero, '✍️ Escribe *más* para ver más opciones.');

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
            await this.enviarSaludoYBotones(numero, nombre);


            await this.enviarMensajeTexto(numero, '✍️ Escribe *más* para ver más opciones.');

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


      // ===== MENÚ PRINCIPAL (antes era list_reply) =====
      if (/^opcion_[1-6]$/.test(id)) {
        // Reiniciar estado del usuario antes de comenzar nuevo flujo
        estadoUsuarios.set(numero, { paso: 0, datos: {}, tipo: id });

        switch (id) {
          case 'opcion_1':
            await this.opcion1PasoAPaso(numero, '');
            return;

          case 'opcion_2':
            await this.opcion2PasoAPaso(numero, '');
            return;

          case 'opcion_3':
            await this.opcion3PasoAPaso(numero, '');
            return;

          case 'opcion_4': {
            const st4 = estadoUsuarios.get(numero) || { paso: 0, datos: {} };
            st4.flujoActivo = true;
            st4.tipo = 'restaurantes';
            estadoUsuarios.set(numero, st4);
            await this.enviarMensajeTexto(
              numero,
              '🍽️ Mira nuestras cartas de *RESTAURANTES* en: https://domiciliosw.com'
            );
            return;
          }

          case 'opcion_5':
            // Inicia el puente de soporte PSQR (cliente ↔ asesor)
            await this.iniciarSoportePSQR(numero, nombre);
            return;

          case 'opcion_6':
            // Inicia el puente de soporte PSQR (cliente ↔ asesor)
            await this.iniciarAfiliacionAliado(numero, nombre);
            return;


          default:
            await this.enviarMensajeTexto(numero, '❓ Opción no reconocida.');
            return;
        }
      }


      // ===== CAMBIAR ZONA (mostrar 2 botones) =====
      if (id === 'cambiar_zona') {
        await this.sendButtons(
          mensaje.from,
          '¿En qué zona te encuentras?',
          [
            { id: 'set_zona_1', title: 'Zona Centro' },
            { id: 'set_zona_2', title: 'Zona Solarte' },
          ]
        );

        return; // ¡no sigas con otros handlers!
      }

      // ===== SET ZONA (solo cambia la zona, NO toca disponibilidad) =====
      if (id === 'set_zona_1' || id === 'set_zona_2') {
        const zonaId = id === 'set_zona_1' ? 1 : 2;
        try {
          await this.domiciliarioService.actualizarZonaPorTelefono(mensaje.from, zonaId);
          const nombreZona = zonaId === 1 ? '🏙️ Zona Centro' : '🌄 Zona Solarte';
          await axiosWhatsapp.post('/messages', {
            messaging_product: 'whatsapp',
            to: mensaje.from,
            type: 'text',
            text: { body: `✔️ Zona actualizada: ${nombreZona}.` },
          });
        } catch (error: any) {
          this.logger?.warn?.(`⚠️ Error al actualizar zona: ${error?.message || error}`);
          await this.enviarMensajeTexto(mensaje.from, '❌ No se pudo actualizar tu zona. Intenta de nuevo.');
        }
        return; // corta aquí también
      }


      // ——— CANCELACIÓN INMEDIATA (info|compra|pago) ———
      // ⚠️ Pon ESTE bloque ANTES de cualquier otro `return` o de tu `isCancelar`
      if (/^cancelar_(info|compra|pago)$/.test(btnId)) {
        const numeroKey = (this as any).toKey ? (this as any).toKey(mensaje.from) : mensaje.from;

        // (opcional) cancelar en BD si hay pedido en memoria
        try {
          const st = estadoUsuarios.get(numeroKey) || {};
          if (st?.pedidoId) {
            const p = await this.getPedidoById(st.pedidoId).catch(() => null);
            if (p && p.estado !== 2) {
              if (p.estado === 5 && p.id_domiciliario) {
                try { await this.domiciliarioService.liberarDomiciliario(p.id_domiciliario); } catch { }
              }
              await this.domiciliosService.update(st.pedidoId, {
                estado: 2,
                id_domiciliario: null,
                motivo_cancelacion: 'Cancelado por el cliente (botón de paso)',
              });
            }
          }
        } catch (e) {
          this.logger.warn(`cancelar_(info|compra|pago) no pudo cancelar en BD: ${e?.message || e}`);
        }

        // Apaga timers (si los usas)
        try { if (temporizadoresEstado?.has(numeroKey)) { clearTimeout(temporizadoresEstado.get(numeroKey)!); temporizadoresEstado.delete(numeroKey); } } catch { }
        try { if (temporizadoresInactividad?.has?.(numeroKey)) { clearTimeout(temporizadoresInactividad.get(numeroKey)!); temporizadoresInactividad.delete(numeroKey); } } catch { }

        // Limpia estado del flujo
        try {
          estadoUsuarios.delete(numeroKey); // o resetea campos si prefieres
        } catch { }

        await this.enviarMensajeTexto(
          numeroKey,
          '📩 Si cancelas el servicio recibirás este mensaje automático:\n👉 Para la próxima pide por 🌐 domiciliosw.com más fácil y rápido ✅'
        );

        this.logger.debug(`✅ cancelación inmediata por btnId=${btnId} aplicada para ${numeroKey}`);
        return; // MUY IMPORTANTE: no sigas a otros handlers
      }


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


      // ======================= ACEPTAR PEDIDO =======================
      const matchAceptar = id.match(/^(?:ACEPTAR|aceptar_pedido)_(\d+)$/);
      if (matchAceptar) {
        const pedidoId = Number(matchAceptar[1]);

        // Idempotencia anti doble-tap / reintentos
        // CAMBIO: prefijo explícito para evitar colisiones con otras claves
        const key = `${numero}:ACEPTAR:${pedidoId}`; // CAMBIO
        const now = Date.now();
        const last = procesados.get(key);
        if (last && (now - last) < TTL_MS) return;

        // 🔎 VALIDACIÓN SOLO POR ESTADO DEL PEDIDO (pre-chequeo rápido)
        const pedidoCheck = await this.getPedidoById(pedidoId);

        if (!pedidoCheck) {
          await this.enviarMensajeTexto(numero, '⚠️ El pedido ya no existe.');
          await this.sendButtons(
            numero,
            '¿Quieres seguir disponible para nuevos pedidos?',
            [
              { id: 'cambiar_a_disponible', title: 'Disponible' },
              { id: 'cambiar_a_no_disponible', title: 'No disponible' },
            ]
          );

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
          // CAMBIO: proteger disponibilidad con try/catch
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
          await this.enviarMensajeTexto(numero, '⏱️ El pedido ya fue cancelado, no está disponible.');
          // CAMBIO: proteger disponibilidad con try/catch
          try {
            await this.domiciliarioService.setDisponibleManteniendoTurnoByTelefono(numero, true);
          } catch (e) {
            this.logger.warn(`⚠️ Falló al actualizar disponibilidad (cancelado): ${e?.message || e}`);
          }
          await this.enviarMensajeTexto(numero, '✅ Sigues disponible y conservas tu turno.');
          procesados.set(key, now);
          return;
        }

        if (pedidoCheck.estado !== 5) { // NO OFERTADO u otro
          await this.enviarMensajeTexto(numero, '⚠️ El pedido ya no está disponible.');
          // CAMBIO: proteger disponibilidad con try/catch
          try {
            await this.domiciliarioService.setDisponibleManteniendoTurnoByTelefono(numero, true);
          } catch (e) {
            this.logger.warn(`⚠️ Falló al actualizar disponibilidad (no ofertado): ${e?.message || e}`);
          }
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
          await this.sendButtons(
            numero,
            '¿Quieres seguir disponible para nuevos pedidos?',
            [
              { id: 'cambiar_a_disponible', title: 'Disponible' },
              { id: 'cambiar_a_no_disponible', title: 'No disponible' },
            ]
          );

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

        // CAMBIO: re-lee siempre para datos frescos post-confirmación
        const pedidoParaDatos = await this.getPedidoById(pedidoId); // CAMBIO
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

        // (Opcional de negocio) si NO quieres que reciba nuevas ofertas mientras tiene pedido:
        // try {
        //   await this.domiciliarioService.setDisponibleManteniendoTurnoById(domiId, false);
        // } catch (e) {
        //   this.logger.warn(`⚠️ No se pudo marcar NO disponible tras aceptar pedido ${pedidoId}: ${e instanceof Error ? e.message : e}`);
        // }

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
      // ===================== FIN ACEPTAR PEDIDO ======================



      // ======================= RECHAZAR PEDIDO =======================
      // ======================= RECHAZAR PEDIDO =======================
      const matchRechazar = id.match(/^(?:RECHAZAR|rechazar_pedido)_(\d+)$/);
      if (matchRechazar) {
        const pedidoId = Number(matchRechazar[1]);

        // Idempotencia anti doble-tap / reintentos
        const key = `${numero}:RECHAZAR:${pedidoId}`;
        const now = Date.now();
        const last = procesados.get(key);
        if (last && (now - last) < TTL_MS) return;

        // Helper: asegurar disponibilidad manteniendo turno + mensaje uniforme
        const mantenerTurnoYAvisar = async (razonMsg: string) => {
          if (razonMsg) await this.enviarMensajeTexto(numero, razonMsg);
          try {
            await this.domiciliarioService.setDisponibleManteniendoTurnoByTelefono(numero, true);
          } catch (e) {
            this.logger.warn(`⚠️ Falló al actualizar disponibilidad (mantener turno): ${e?.message || e}`);
          }
          await this.enviarMensajeTexto(numero, '✅ Sigues disponible y conservas tu turno.');
        };

        // 🔎 Pre-chequeo rápido por estado
        const pedidoCheck = await this.getPedidoById(pedidoId);
        if (!pedidoCheck) {
          await mantenerTurnoYAvisar('⚠️ El pedido ya no existe.');
          procesados.set(key, now);
          return;
        }

        // ⛔ Guardia en memoria: solo loguea
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
          // No hacemos return; la BD decide
        }

        // ===== ASIGNADO (1): no deja rechazar, pero se mantiene turno igual
        if (pedidoCheck.estado === 1) { // ASIGNADO
          await mantenerTurnoYAvisar('⏱️ El pedido ya fue asignado, no puedes rechazarlo.');
          procesados.set(key, now);
          return;
        }

        // ===== CANCELADO (2): se mantiene turno igual
        if (pedidoCheck.estado === 2) { // CANCELADO
          await mantenerTurnoYAvisar('⏱️ El pedido ya fue cancelado.');
          procesados.set(key, now);
          return;
        }

        // ===== PENDIENTE (0): antes solo botones; ahora SIEMPRE mantener turno
        if (pedidoCheck.estado === 0) { // PENDIENTE
          await mantenerTurnoYAvisar('⏱️ El pedido volvió a la cola y está pendiente. No fue asignado.');
          procesados.set(key, now);
          return;
        }

        // ===== Si NO es OFERTADO (5): antes ya se mantenía; se conserva la conducta
        if (pedidoCheck.estado !== 5) {
          await mantenerTurnoYAvisar('⏱️ Te demoraste en responder. El pedido ya no está disponible.');
          procesados.set(key, now);
          return;
        }

        // ===== OFERTADO (5): revertir a PENDIENTE y TAMBIÉN mantener turno siempre
        const pedidoAntes = await this.getPedidoById(pedidoId);
        const domiIdOriginal = pedidoAntes?.id_domiciliario ?? null; // (se conserva por si lo usas en métricas/auditoría)

        // Intento atómico: revertir solo si sigue en OFERTADO (5)
        const ok = await this.domiciliosService.volverAPendienteSiOfertado(pedidoId);
        procesados.set(key, now);

        if (!ok) {
          await mantenerTurnoYAvisar('⏱️ Te demoraste en responder. El pedido ya no está disponible.');
          return;
        }

        // 🧹 Limpiar timeout de oferta si existía
        const t = temporizadoresOferta?.get?.(pedidoId);
        if (t) { clearTimeout(t); temporizadoresOferta.delete(pedidoId); }

        // Mensaje de rechazo + mantener turno (sin pedir confirmación de disponibilidad)
        await mantenerTurnoYAvisar('❌ Has rechazado el pedido. La oferta se liberó.');

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

        await this.enviarMensajeTexto(numeroKey, '👍 *Operación cancelada.* Cancelaste el domicilio. Puedes escribirme para *comenzar de nuevo*.'
        );
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
        let st = estadoUsuarios.get(numero) || {};
        let conversacionId = st?.conversacionId;

        // Si no hay conversacionId en memoria, intenta buscar la conversación activa en BD
        if (!conversacionId) {
          const conversacionActiva = await this.conversacionRepo.findOne({
            where: { numero_domiciliario: numero, estado: 'activa' }
          });
          if (conversacionActiva) {
            conversacionId = conversacionActiva.id;
            st.conversacionId = conversacionId;
            estadoUsuarios.set(numero, st);
          }
        }

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

        // Paso 1: pedir DIRECCIÓN de recogida (cualquier texto)
        st.capturandoDireccionRecogida = true;
        st.direccionRecogidaTmp = undefined;
        st.capturandoPrecio = false;
        st.confirmandoPrecio = false;
        st.precioTmp = undefined;
        st.conversacionId = conversacionId;
        estadoUsuarios.set(numero, st);

        await this.enviarMensajeTexto(
          numero,
          '📍 Indica el restaurante, local o barrio de *Recogida*.\n\n' +
          'Si el domicilio fue *cancelado*, escribe un mensaje explicando el motivo y coloca **0** en el precio.\n' +
          'Debes contar con un soporte que confirme la cancelación (por ejemplo, un mensaje del cliente).'
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

        const resultado = await this.finalizarConversacionPorDomi(conversacionId);

        // Puede venir undefined, lo manejamos aquí
        if (!resultado) {
          await this.enviarMensajeTexto(
            numero,
            '❌ No fue posible finalizar: Error desconocido'
          );
          return;
        }

        const { ok, msg } = resultado;

        if (!ok) {
          await this.enviarMensajeTexto(
            numero,
            `❌ No fue posible finalizar: ${msg || 'Error desconocido'}`
          );
        }

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

        // 2) Validar/normalizar precio (2 decimales, permitir 0 o >= 5000)
        const monto = Math.round(s.precioTmp * 100) / 100;

        // No se permiten negativos
        if (monto < 0) {
          await this.enviarMensajeTexto(
            numero,
            '⚠️ El precio debe ser 0 o un valor positivo.'
          );
          return;
        }

        // Solo se permite 0 o valores >= 5000
        if (monto !== 0 && monto < 5000) {
          await this.enviarMensajeTexto(
            numero,
            '⚠️ El precio debe ser 0 o un valor igual o mayor a 5.000.'
          );
          return;
        }

        if (monto > 10_000_000) {
          await this.enviarMensajeTexto(
            numero,
            '⚠️ El precio es demasiado alto. Verifica e intenta de nuevo.'
          );
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
        // (si quieres usar last para evitar duplicados, aquí iría la lógica extra)

        // NUEVO: resolver DIRECCIÓN DE RECOGIDA (de memoria o BD como fallback)
        let direccionRecogida = (s?.direccionRecogidaTmp || '').toString().trim();
        if (!direccionRecogida) {
          try {
            const pid = s?.pedidoId;
            if (pid) {
              const p = await this.getPedidoById(pid).catch(() => null);
              if (p?.origen_direccion) direccionRecogida = String(p.origen_direccion).trim();
            }
          } catch { /* noop */ }
        }
        if (!direccionRecogida) direccionRecogida = 'N/D';

        // 5) Guardar y (opcionalmente) notificar
        try {
          // 🔎 Obtener el domiciliario por teléfono
          const domi = await this.domiciliarioService.getByTelefono(numeroKey);
          const nombreDomi = domi?.nombre || 'N/D';
          const apellidoDomi = domi?.apellido || 'N/D';
          const numeroChaq = domi?.numero_chaqueta || 'N/D';

          // Guardar en BD (si falla, sí debemos abortar)
          await this.precioRepo.save({
            numero_domiciliario: numeroKey,
            costo: costoStr,
          });

          // marcamos idempotencia tras guardar, para evitar duplicado de confirmación
          this.notifsPrecioCache.set(idemKey, now);

          // Intentar notificar, pero que NO bloquee el flujo si falla
          const debeNotificar = Boolean(numeroCuentas && String(numeroCuentas).trim());
          if (debeNotificar) {
            try {
              await axiosWhatsapp.post('/messages', {
                messaging_product: 'whatsapp',
                to: numeroCuentas,
                type: 'text',
                text: {
                  body:
                    `📦 Precio confirmado
👤 Domiciliario: ${nombreDomi} ${apellidoDomi ?? ''}
🅽 Chaqueta: ${numeroChaq ?? ''}
📱 Número: ${numeroKey}
📍 Direccion de recogida: ${direccionRecogida}   
💲 Costo: ${costoStr}
`,
                },
              }, { timeout: 7000 });
            } catch (notifErr) {
              this.logger.warn(
                `⚠️ No se pudo enviar notificación a número fijo: ${notifErr instanceof Error ? notifErr.message : notifErr
                }`
              );
            }
          } else {
            this.logger.warn('ℹ️ No hay numeroNotificaciones configurado. Se omite notificación.');
          }

        } catch (e) {
          this.logger.error(`❌ Error guardando precio: ${e instanceof Error ? e.message : e}`);
          await this.enviarMensajeTexto(
            numero,
            '⚠️ No pude guardar el precio. Intenta confirmar nuevamente.'
          );
          return;
        }

        // 6) Cerrar flags de estado y finalizar conversación (siempre llegar aquí, notifique o no)
        s.confirmandoPrecio = false;
        s.capturandoPrecio = false;
        s.conversacionFinalizada = true;

        try { delete s.direccionRecogidaTmp; } catch { }

        estadoUsuarios.set(numero, s);

        const resultado = await this.finalizarConversacionPorDomi(conversacionId, monto);

        if (!resultado) {
          await this.enviarMensajeTexto(
            numero,
            '❌ No fue posible finalizar: Error desFconocido'
          );
          return;
        }

        const { ok, msg } = resultado;

        if (!ok) {
          await this.enviarMensajeTexto(
            numero,
            `❌ No fue posible finalizar: ${msg || 'Error desconocido'}`
          );
        }
        return;
      }




      if (id === 'cambiar_a_disponible' || id === 'cambiar_a_no_disponible') {
        const disponible = id === 'cambiar_a_disponible';

        if (!disponible) {
          // 🛑 Si es NO DISPONIBLE, actualizar de una vez
          try {
            await this.domiciliarioService.cambiarDisponibilidadPorTelefono(numero, false);

            await this.enviarMensajeTexto(numero, '✅ Estado actualizado. Ahora estás *NO DISPONIBLE*.');
            await this.enviarMensajeTexto(numero, '👋 Escríbeme cuando quieras volver a estar disponible.');
          } catch (error) {
            this.logger.warn(`⚠️ Error al cambiar a NO DISPONIBLE: ${error?.message || error}`);
            await this.enviarMensajeTexto(numero, '❌ No se pudo actualizar tu estado. Intenta de nuevo.');
          }
          return;
        }

        // ✅ Si es DISPONIBLE, pedir zona con botones manuales (axiosWhatsapp)
        await this.sendButtons(
          numero,
          '¿En qué zona te encuentras?',
          [
            { id: 'set_zona_1_disponible', title: 'Zona Centro' },
            { id: 'set_zona_2_disponible', title: 'Zona Solarte' },
          ]
        );


        return;
      }


      const numeroCliente =
        (this as any).toTelKey ? (this as any).toTelKey(numero) : String(numero);


      // =========================
      // Confirmaciones de pedido del cliente
      // =========================
      if (id === 'confirmar_info' || id === 'confirmar_pago' || id === 'confirmar_compra') {
        let domiciliario: Domiciliario | null = null;

        const st = estadoUsuarios.get(numero) || {};
        const datos = st?.datos || {};
        const tipo = (st?.tipo || 'servicio').replace('opcion_', '');

        // helper local para no repetir
        const showCancelar = async (pid: number, body: string) => {
          try {
            await this.mostrarMenuPostConfirmacion(numero, pid, body, 60 * 1000);
          } catch (e) {
            this.logger.warn(`⚠️ No se pudo mostrar el botón de cancelar (#${pid}): ${e?.message || e}`);
          }
        };

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
          await showCancelar(
            st.pedidoId,
            st.esperandoAsignacion
              ? '⏳ *ESTAMOS BUSCANDO UN DOMICILIARIO CERCANO A TU DIRECCIÓN PARA ASIGNAR TU PEDIDO LO ANTES POSIBLE.*\n\n🛵 *DOMICILIOSW, TU MEJOR OPCIÓN* 🙌'
              : '⏳ *SI YA NO LO NECESITAS, PUEDES CANCELAR:*'
          );

          return;
        }

        // Candado 20s para taps muy seguidos
        if (st.creandoPedidoHasta && ahora < st.creandoPedidoHasta) {
          this.logger.warn('🛡️ Candado activo: ignorando confirmación duplicada muy cercana.');
          if (st.pedidoId) {
            await showCancelar(
              st.pedidoId,
              st.esperandoAsignacion
                ? '⏳ *ESTAMOS BUSCANDO UN DOMICILIARIO CERCANO A TU DIRECCIÓN PARA ASIGNAR TU PEDIDO LO ANTES POSIBLE.*\n\n🛵 *DOMICILIOSW, TU MEJOR OPCIÓN* 🙌'
                : '⏳ *SI YA NO LO NECESITAS, PUEDES CANCELAR:*'
            );

          }
          return;
        }
        st.creandoPedidoHasta = ahora + 20_000;
        estadoUsuarios.set(numero, st);
        // =====================================================================

        try {
          // 0) 👉 Crear SIEMPRE el pedido base en PENDIENTE (0) y MOSTRAR el botón de cancelar "apenas confirmó"
          const pedidoBase = await this.domiciliosService.create({
            mensaje_confirmacion: 'Confirmado por el cliente vía WhatsApp',
            estado: 0, // PENDIENTE primero
            numero_cliente: numero,
            fecha: new Date().toISOString(),
            hora: new Date().toTimeString().slice(0, 5),
            cliente: null,
            id_domiciliario: null,
            tipo_servicio: tipo,
            origen_direccion: datos.direccionRecoger ?? '',
            destino_direccion: (datos.direccionEntregar ?? datos.direccionEntrega) ?? '',
            telefono_contacto_origen: datos.telefonoRecoger ?? '',
            telefono_contacto_destino: (datos.telefonoEntregar ?? datos.telefonoEntrega) ?? '',
            notas: '',
            detalles_pedido: datos.listaCompras ?? '',
            foto_entrega_url: '',
          });

          if (!pedidoBase?.id) {
            throw new Error('No se pudo crear el pedido base.');
          }

          // Actualiza estado idempotente + flag de “esperando asignación”
          st.ultimoIdemKey = idemKey;
          st.pedidoId = pedidoBase.id;
          st.ultimoPedidoTs = Date.now();
          st.esperandoAsignacion = true;
          estadoUsuarios.set(numero, st);




          // 1) Intentar asignar un domiciliario disponible (sin mover turno + cooldown)
          try {
            domiciliario = await this.domiciliarioService.asignarDomiciliarioDisponible2();
          } catch {
            domiciliario = null;
          }

          if (!domiciliario) {
            await showCancelar(
              pedidoBase.id,
              '🚫❌ *EN ESTE MOMENTO NO HAY DOMICILIARIOS DISPONIBLES.*\n\n' +
              '⏳ 👉 *SI DESEAS, PUEDES ESPERAR UNOS MINUTOS MIENTRAS UNO SE DESOCUPA Y ASÍ ASIGNAR TU PEDIDO.*\n\n' +
              '🛵 *domiciliosw.com, tu mejor opción*'
            );


            // aquí puedes cortar el flujo si no quieres seguir intentando
            return;
          }

          // 2) Si HAY domi → pasar a OFERTADO (5) sobre el MISMO pedido
          if (domiciliario) {
            // ⛳️ Mostrar botón de cancelar INMEDIATO (apenas confirmó)
            await showCancelar(
              pedidoBase.id,
              '⏳ *ESTAMOS BUSCANDO UN DOMICILIARIO CERCANO A TU DIRECCIÓN PARA ASIGNAR TU PEDIDO LO ANTES POSIBLE.*\n\n🛵 *DOMICILIOSW, TU MEJOR OPCIÓN* 🙌'
            );

            // ✅ ASIGNACIÓN DIRECTA (0 -> 1) atómica (sin oferta)
            const asignado = await this.domiciliosService.asignarSiPendiente(pedidoBase.id, domiciliario.id);
            if (!asignado) {
              // Carrera perdida → conservar turno y volver disponible
              try { await this.domiciliarioService.setDisponibleManteniendoTurnoById(domiciliario.id, true); } catch { }
              // Ya dejamos el pedido en 0 y el botón de cancelar está mostrado.
              return;
            }

            // (Opcional) marcar domi ocupado
            try { await this.domiciliarioService.setDisponibleManteniendoTurnoById(domiciliario.id, false); } catch { }

            // ✅ Crear conversación inmediata cliente <-> domi
            const conversacion = this.conversacionRepo.create({
              numero_domiciliario: domiciliario.telefono_whatsapp,
              numero_cliente: numero,
              fecha_inicio: new Date(),
              estado: 'activa',
            });
            await this.conversacionRepo.save(conversacion);

            // ✅ Guardar estado puente
            const stNow = estadoUsuarios.get(numero) || {};
            stNow.conversacionId = conversacion.id;
            stNow.tipo = 'conversacion_activa';
            stNow.inicioMostrado = true;
            stNow.pedidoId = pedidoBase.id;
            stNow.esperandoAsignacion = false;
            estadoUsuarios.set(numero, stNow);

            estadoUsuarios.set(domiciliario.telefono_whatsapp, {
              conversacionId: conversacion.id,
              tipo: 'conversacion_activa',
              inicioMostrado: true,
              pedidoId: pedidoBase.id,
            });

            // Notificar al cliente (opcional) y mantener botón cancelar ya enviado
            // await this.enviarMensajeTexto(numero, '⏳ Estamos *procesando* tu pedido. Gracias por preferirnos');

            // ——— construir y ENVIAR el mensaje al domi (sin botones) ———
            if (id === 'confirmar_compra' || tipo === '2') {
              // 🛒 CASO COMPRAS: enviar el MENSAJE TAL CUAL al domiciliario
              const detalleCliente = (datos.listaCompras ?? '').toString().trim() || '(sin detalle)';
              const resumenLargo = this.sanitizeWaBody(
                [
                  '📦 *PEDIDO ASIGNADO:*',
                  '',
                  `🔁 *Tipo de servicio:* ${String(tipo || 'servicio')}`,
                  `👤 *Número del cliente:* ${numeroCliente}`,  // 👈 AÑADIDO AQUÍ
                  '',
                  '📝 *Detalle del cliente:*',
                  detalleCliente,
                  '',
                  `🆔 Pedido #${pedidoBase.id}`,
                  '💬 Ya estás conectado con el cliente en este chat.',
                ].join('\n')
              ).slice(0, 1024); // Body máx. 1024 chars

              await this.enviarMensajeTexto(
                domiciliario.telefono_whatsapp,
                resumenLargo
              );

            } else {
              // 🧾 SERVICIOS 1 y 3: se mantiene tu resumen original (sin botones)
              const partes: string[] = [];
              partes.push('📦 *PEDIDO ASIGNADO*', '');
              partes.push(`🔁 *Tipo de servicio:*\n${String(tipo || 'servicio')}`);
              partes.push(`👤 *Número del cliente:* ${numeroCliente}`); // 👈 AÑADIDO AQUÍ
              partes.push(''); // línea en blanco

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

              partes.push(`🆔 Pedido #${pedidoBase.id}`);
              partes.push('💬 Ya estás conectado con el cliente en este chat.');

              const resumenLargo = this.sanitizeWaBody(partes.join('\n')).slice(0, 1024);

              await this.enviarMensajeTexto(
                domiciliario.telefono_whatsapp,
                resumenLargo
              );
            }
            // ——— fin armado mensaje al domi ———

            // ✅ Notificar CLIENTE (ya quedó asignado)
            const nombreDomi = `${domiciliario.nombre ?? ''} ${domiciliario.apellido ?? ''}`.trim() || domiciliario.telefono_whatsapp;
            const chaqueta = domiciliario?.numero_chaqueta ?? '-';
            await this.enviarMensajeTexto(
              numero,
              [
                '✅ ¡Domiciliario asignado!',
                `👤 *${nombreDomi}*`,
                `🧥 Chaqueta: *${chaqueta}*`,
                `📞 Teléfono: *${this.waTo(domiciliario.telefono_whatsapp)}*`,
                '',
                '📲 Ya están conectados en este chat. Puedes coordinar la entrega aquí mismo.',
              ].join('\n')
            );

            // Botón finalizar al domi (si lo usas)
            try { await this.enviarBotonFinalizarAlDomi(domiciliario.telefono_whatsapp); } catch { }

            // Listo, no continues
            return;
          }


          // 3) Si NO hay domi: ya está en 0 y ya mostramos botón cancelar
          st.esperandoAsignacion = true;
          estadoUsuarios.set(numero, st);
          return;

        } catch (error) {
          this.logger.warn(`⚠️ Error al confirmar pedido: ${error?.message || error}`);

          // Si no existe pedidoId en memoria, intenta crear uno mínimo para que el botón funcione
          try {
            if (!st.pedidoId) {
              const pedidoPendiente = await this.domiciliosService.create({
                mensaje_confirmacion: 'Confirmado por el cliente vía WhatsApp',
                estado: 0,
                numero_cliente: numero,
                fecha: new Date().toISOString(),
                hora: new Date().toTimeString().slice(0, 5),
                cliente: null,
                id_domiciliario: null,
                tipo_servicio: tipo,
                origen_direccion: datos.direccionRecoger ?? '',
                destino_direccion: (datos.direccionEntregar ?? datos.direccionEntrega) ?? '',
                telefono_contacto_origen: datos.telefonoRecoger ?? '',
                telefono_contacto_destino: (datos.telefonoEntregar ?? datos.telefonoEntrega) ?? '',
                notas: '',
                detalles_pedido: datos.listaCompras ?? '',
                foto_entrega_url: '',
              });
              if (pedidoPendiente?.id) {
                st.ultimoIdemKey = idemKey;
                st.pedidoId = pedidoPendiente.id;
                st.ultimoPedidoTs = Date.now();
                estadoUsuarios.set(numero, st);
                await showCancelar(
                  pedidoPendiente.id,
                  '⏳ *ESTAMOS BUSCANDO UN DOMICILIARIO CERCANO A TU DIRECCIÓN PARA ASIGNAR TU PEDIDO LO ANTES POSIBLE.*\n\n🛵 *DOMICILIOSW, TU MEJOR OPCIÓN* 🙌'
                );

              }
            } else {
              await showCancelar(
                st.pedidoId,
                '⏳ *ESTAMOS BUSCANDO UN DOMICILIARIO CERCANO A TU DIRECCIÓN PARA ASIGNAR TU PEDIDO LO ANTES POSIBLE.*\n\n🛵 *DOMICILIOSW, TU MEJOR OPCIÓN* 🙌'
              );

            }
          } catch (e) {
            this.logger.warn(`⚠️ Fallback crear/mostrar cancelar falló: ${e?.message || e}`);
          }
          return;

        } finally {
          // Libera candado siempre
          const s = estadoUsuarios.get(numero) || {};
          s.creandoPedidoHasta = undefined;
          estadoUsuarios.set(numero, s);
        }
      }



      if (id === 'set_zona_1_disponible' || id === 'set_zona_2_disponible') {
        // ✅ Determina zona según el id del botón
        const zonaId = id === 'set_zona_1_disponible' ? 1 : 2;

        try {
          // ✅ Llamada al servicio con el nuevo parámetro zonaId
          await this.domiciliarioService.cambiarDisponibilidadPorTelefono(
            numero,   // teléfono del domiciliario
            true,     // disponible = true
            zonaId,   // 🔹 pasa el ID de la zona (1 o 2)
          );

          // ✅ Mensajes de confirmación
          await this.enviarMensajeTexto(
            numero,
            `✅ Estado actualizado. Ahora estás *DISPONIBLE* en *${zonaId === 1 ? 'Zona Centro' : 'Zona Solarte'}*.`
          );
          await this.enviarMensajeTexto(
            numero,
            '👋 Si necesitas, vuelve a consultar o actualizar tu estado.'
          );
        } catch (error) {
          this.logger.warn(`⚠️ Error al actualizar disponibilidad/zona: ${error?.message || error}`);
          await this.enviarMensajeTexto(
            numero,
            '❌ No se pudo actualizar tu estado/zona. Intenta de nuevo.'
          );
        }

        return;
      }



      if (id === 'editar_info') {
        await this.enviarMensajeTexto(numero, '🔁 Vamos a corregir la información. Empecemos de nuevo...');
        estadoUsuarios.set(numero, { paso: 0, datos: {}, tipo: 'opcion_1' });
        await this.opcion1PasoAPaso(numero, '');
        return;
      }

      if (id === 'editar_compra') {
        await this.enviarMensajeTexto(numero, '🔁 Vamos a actualizar tu lista de compras...');
        estadoUsuarios.set(numero, { paso: 0, datos: {}, tipo: 'opcion_2' });
        await this.opcion2PasoAPaso(numero, '');
        return;
      }

      if (id === 'editar_pago') {
        await this.enviarMensajeTexto(numero, '🔁 Vamos a corregir la información del pago...');
        estadoUsuarios.set(numero, { paso: 0, datos: {}, tipo: 'opcion_3' });
        await this.opcion3PasoAPaso(numero, '');
        return;
      }


    }





    // ✅ 1. Procesar selección de lista interactiva
    // if (tipo === 'interactive' && mensaje?.interactive?.type === 'list_reply') {
    //   const opcionSeleccionada = mensaje.interactive.list_reply.id;

    //   // Reiniciar estado del usuario antes de comenzar nuevo flujo
    //   estadoUsuarios.set(numero, { paso: 0, datos: {}, tipo: opcionSeleccionada });

    //   switch (opcionSeleccionada) {
    //     case 'opcion_1':
    //       await this.opcion1PasoAPaso(numero, '');
    //       return;
    //     case 'opcion_2':
    //       await this.opcion2PasoAPaso(numero, '');
    //       return;
    //     case 'opcion_3':
    //       await this.opcion3PasoAPaso(numero, '');
    //       return;
    //     case 'opcion_4':
    //       const st4 = estadoUsuarios.get(numero) || { paso: 0, datos: {} };
    //       st4.flujoActivo = true;
    //       st4.tipo = 'restaurantes';
    //       estadoUsuarios.set(numero, st4);
    //       await this.enviarMensajeTexto(
    //         numero,
    //         '🍽️ Mira nuestras cartas de *RESTAURANTES* en: https://domiciliosw.com'
    //       );
    //       return;

    //     case 'opcion_5': {
    //       // Inicia el puente de soporte PSQR (cliente ↔ asesor)
    //       await this.iniciarSoportePSQR(numero, nombre);
    //       return;
    //     }



    //     default:
    //       await this.enviarMensajeTexto(numero, '❓ Opción no reconocida.');
    //       return;
    //   }
    // }


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
      //       const saludo = `👋Hola ${nombre} soy Wil-Bot 🤖
      // Tu asistente virtual pide rápido y fácil por
      // 🌐https://domiciliosw.com`;

      //       // Enviar solo mensaje de texto
      //       await this.enviarMensajeTexto(numero, saludo);




      await this.enviarSaludoYBotones(numero, nombre);


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




  private async enviarMensajeTexto(numero: any, mensaje?: string): Promise<void> {
    const to = this.toTelKey(String(numero ?? ''));

    const body = String(mensaje ?? '').trim();
    const safeBody = body.slice(0, 4096);

    if (!to || !/^\d{11,15}$/.test(to)) {
      this.logger.warn(`⚠️ No se envía: número inválido. raw="${numero}" to="${to}"`);
      return;
    }
    if (!safeBody) {
      this.logger.warn(`⚠️ No se envía: mensaje vacío. to="${to}"`);
      return;
    }

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: safeBody },
    };

    try {
      this.logger.debug(`📤 WA payload text: ${JSON.stringify(payload)}`);
      const response = await axiosWhatsapp.post('/messages', payload, { timeout: 7000 });
      const msgId = response?.data?.messages?.[0]?.id;
      this.logger.log(`✅ Mensaje enviado a ${to}${msgId ? ` id=${msgId}` : ''}`);
    } catch (error: any) {
      const data = error?.response?.data;
      this.logger.error('❌ Error WhatsApp al enviar texto', {
        to,
        bodyLen: safeBody.length,
        fbtrace_id: data?.error?.fbtrace_id,
        details: data?.error?.error_data?.details,
        message: data?.error?.message || error?.message,
        payload,
      });
    }
  }



  // private async enviarListaOpciones(numero: string): Promise<void> {
  //   try {
  //     await axiosWhatsapp.post('/messages', {
  //       messaging_product: 'whatsapp',
  //       to: numero,
  //       type: 'interactive',
  //       interactive: {
  //         type: 'list',
  //         // header: {
  //         //     type: 'text',
  //         //     text: '¡Hola, soy Wilber!',
  //         // },
  //         body: {
  //           text: `*O selecciona el servicio que deseas:* 👇`,
  //         },
  //         // footer: {
  //         //   text: 'Estamos para servirte 🧡',
  //         // },
  //         action: {
  //           button: 'Pedir servicio 🛵',
  //           sections: [
  //             {
  //               title: 'Servicios disponibles',
  //               rows: [
  //                 {
  //                   id: 'opcion_1',
  //                   title: '1. Recoger y entregar',
  //                   description: 'Envíos puerta a puerta',
  //                 },
  //                 {
  //                   id: 'opcion_2',
  //                   title: '2. Realizar una compra',
  //                   description: 'Compramos lo que necesites',
  //                 },
  //                 {
  //                   id: 'opcion_3',
  //                   title: '3. Hacer un pago',
  //                   description: 'Pagamos por ti y entregamos el recibo',
  //                 },
  //                 {
  //                   id: 'opcion_4',
  //                   title: '4. Ver Restaurantes',
  //                   description: 'Explora nuestros aliados gastronómicos',
  //                 },
  //                 {
  //                   id: 'opcion_5',
  //                   title: '5. PSQR',
  //                   description: 'Peticiones, sugerencias, quejas o reclamos',
  //                 },
  //               ],
  //             },
  //           ],
  //         },
  //       },
  //     });

  //     this.logger.log(`✅ Lista de opciones enviada a ${numero}`);
  //   } catch (error) {
  //     this.logger.error('❌ Error al enviar lista:', error.response?.data || error.message);
  //   }
  // }

  // Envía los 2 botones restantes cuando el usuario escribe "más"
  private async enviarMasBotones(numero: string): Promise<void> {
    await this.sendButtons(
      numero,
      'Aquí tienes más opciones',
      [
        { id: 'opcion_4', title: 'Restaurantes' },
        { id: 'opcion_5', title: 'PSQR' },
      ]
    );

    this.logger.log(`✅ Botones "más" enviados a ${numero}`);
  }




  private async enviarSaludoYBotones(numero: string, nombre: string): Promise<void> {
    const bodyTexto = `👋 Hola ${nombre}, elige tu\n servicio o pide rápido y fácil en\n domiciliosw.com`;

    // 1️⃣ Intentar enviar imagen (si falla NO rompe el flujo)
    try {
      const img = await this.imagenWelcomeService.getImage2();

      const rawPath = (img?.path ?? '').trim();
      const cleanPath = rawPath.replace(/^undefined\//, '');
      const imageLink = cleanPath ? `https://domiciliosw.com/api/${cleanPath}` : null;

      if (imageLink) {
        await axiosWhatsapp.post('/messages', {
          messaging_product: 'whatsapp',
          to: numero,
          type: 'image',
          image: { link: imageLink },
        });

        this.logger.log(`✅ Imagen enviada a ${numero}`);

        // pequeña pausa para que WhatsApp procese la imagen
        await new Promise((r) => setTimeout(r, 1200));
      }
    } catch (error) {
      this.logger.warn('⚠️ Falló el envío de imagen, se continúa con botones');
    }

    // 2️⃣ SIEMPRE enviar botones (pase lo que pase arriba)
    await this.sendButtons(
      numero,
      bodyTexto,
      [
        { id: 'opcion_1', title: 'Recoger-Entregar' },
        { id: 'opcion_2', title: 'Hacer compra' },
        { id: 'opcion_3', title: 'Hacer pago' },
      ]
    );

    this.logger.log(`✅ Botones enviados a ${numero}`);

  }



  async opcion1PasoAPaso(numero: string, mensaje: string): Promise<void> {
    const estado = estadoUsuarios.get(numero) || { paso: 0, datos: {}, tipo: 'opcion_1' };

    // Helpers
    const trim = (s?: string) => String(s || '').trim();
    const direccionValida = (txt?: string) => !!trim(txt) && trim(txt).length >= 5;

    // 👉 Teléfono SIEMPRE será el que escribe (WhatsApp)
    const telefonoFromWa = this.toKey ? this.toKey(numero) : numero;

    // Prompts
    const pedirDireccionRecogida = async () =>
      this.enviarMensajeTexto(
        numero,
        '🤖 Por favor escribe todo en un solo mensaje⬇️\n\n' +
        '📍 Dirección de *recogida* y *entrega*'
      );

    const enviarResumenYBotones = async () => {
      const { direccionRecoger } = estado.datos;
      const telefonoRecoger = estado.datos.telefonoRecoger || telefonoFromWa;

      await this.enviarMensajeTexto(
        numero,
        '✅ Verifica:\n\n' +
        `📍 Recoger: ${direccionRecoger || '—'}\n` +
        `📞 Tel: ${telefonoRecoger}`
      );

      await this.sendButtons(
        numero,
        '¿Confirmas el pedido? Recuerda: una vez asignado el domiciliario no podrás cancelarlo',
        [
          { id: 'confirmar_info', title: 'Confirmar' },
          { id: 'editar_info', title: 'Editar' },
          { id: 'cancelar_info', title: 'Cancelar' },
        ]
      );


    };

    switch (estado.paso) {
      // 0) Iniciar: pedir dirección (tel se toma del número de WhatsApp)
      case 0: {
        // Guardamos ya el teléfono desde el número que escribe
        estado.datos.telefonoRecoger = telefonoFromWa;

        await this.enviarMensajeTexto(numero, '🛵 Tomaremos tus datos de *recogida*.');
        await pedirDireccionRecogida();
        estado.paso = 1;
        break;
      }

      // 1) Guardar dirección
      case 1: {
        const dir = trim(mensaje);

        if (!direccionValida(dir)) {
          await this.enviarMensajeTexto(
            numero,
            '⚠️ Dirección inválida. Escribe la dirección de recogida (mín. 5 caracteres).'
          );
          await pedirDireccionRecogida();
          break;
        }

        estado.datos.direccionRecoger = dir;
        // Teléfono ya viene del número de WhatsApp
        estado.datos.telefonoRecoger = estado.datos.telefonoRecoger || telefonoFromWa;

        await enviarResumenYBotones();
        estado.confirmacionEnviada = true;
        estado.paso = 3;
        break;
      }

      // 3) Correcciones: ahora solo se corrige la dirección, el teléfono siempre es el del chat
      case 3: {
        const dir = trim(mensaje);
        let huboCambio = false;

        if (direccionValida(dir)) {
          estado.datos.direccionRecoger = dir;
          huboCambio = true;
        }

        // El teléfono SIEMPRE se mantiene como el de WhatsApp
        estado.datos.telefonoRecoger = telefonoFromWa;

        if (huboCambio) {
          await this.enviarMensajeTexto(
            numero,
            '✍️ Actualizado:\n\n' +
            `📍 Recoger: ${estado.datos.direccionRecoger}\n` +
            `📞 Tel: ${estado.datos.telefonoRecoger}`
          );

          await this.sendButtons(
            numero,
            '¿Deseas confirmar ahora? Recuerda: una vez asignado el domiciliario no podrás cancelarlo',
            [
              { id: 'confirmar_info', title: 'Confirmar' },
              { id: 'editar_info', title: 'Editar' },
              { id: 'cancelar_info', title: 'Cancelar' },
            ]
          );

        } else {
          await this.enviarMensajeTexto(
            numero,
            '⚠️ No pude detectar cambios válidos en la dirección. Escribe la nueva dirección de recogida.'
          );
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



  // 🛒 COMPRA ULTRA SIMPLE con botones válidos y guard contra duplicados
  // - Toma el mensaje TAL CUAL y lo guarda en listaCompras (incluye lista, dirección y teléfono)
  // - Envia botones con títulos <= 20 chars (requisito WhatsApp)
  // - Evita reenvíos duplicados del resumen en una ventana corta (30s)

  async opcion2PasoAPaso(numero: string, mensaje: string): Promise<void> {
    // 👉 Teléfono SIEMPRE será el del WhatsApp que escribe
    const telefonoFromWa = this.toKey ? this.toKey(numero) : numero;

    const estado = estadoUsuarios.get(numero) || {
      paso: 0,
      datos: {} as any,
      tipo: 'opcion_2',
    };

    const txt = (mensaje ?? '').toString().trim();

    // Ventana anti-duplicados (30s)
    const RESUMEN_GUARD_MS = 30_000;

    switch (estado.paso) {
      case 0: {
        // Guardamos ya el teléfono desde el número que escribe
        estado.datos.telefonoEntrega = telefonoFromWa;

        await this.enviarMensajeTexto(
          numero,
          [
            '🛒 *Para tu compra envíame todo en un solo ✍ mensaje:*',
            '',
            '✅ Lista y cantidad de productos',
            '✅ Lugar de preferencia (tienda, supermercado, etc.)',
            '',
            '📍 Dirección de entrega',
          ].join('\n')
        );
        estado.paso = 1;
        break;
      }

      case 1: {
        const detalle = txt || '(sin detalle)';

        // 🛡️ Idempotencia: si ya mostramos resumen para el mismo detalle hace <30s, no repitas
        if (
          estado._ultimoResumen === detalle &&
          typeof estado._ultimoResumenTs === 'number' &&
          Date.now() - estado._ultimoResumenTs < RESUMEN_GUARD_MS
        ) {
          break;
        }

        // Guardar TAL CUAL el mensaje en listaCompras
        estado.datos.listaCompras = detalle;

        // Dirección opcional; si luego la quieres parsear, lo haces en otra parte
        estado.datos.direccionEntrega = 'Incluida en el detalle';
        // Teléfono SIEMPRE el del WhatsApp
        estado.datos.telefonoEntrega = telefonoFromWa;

        // Resumen
        await this.enviarMensajeTexto(
          numero,
          [
            '✅ *Revisa tu pedido:*',
            '',
            '🛒 *Detalle completo (lista + dirección):*',
            detalle,
            '',
            `📞 Teléfono de contacto: ${estado.datos.telefonoEntrega}`,
          ].join('\n')
        );

        await this.sendButtons(
          numero,
          '¿Confirmas el pedido?',
          [
            { id: 'confirmar_compra', title: 'Confirmar' },
            { id: 'editar_compra', title: 'Editar' },
            { id: 'cancelar_compra', title: 'Cancelar' },
          ]
        );

        // Marca anti-duplicados
        estado._ultimoResumen = detalle;
        estado._ultimoResumenTs = Date.now();

        break;
      }

      default: {
        // Reinicio suave si algo se desordenó
        estadoUsuarios.delete(numero);
        await this.opcion2PasoAPaso(numero, '');
        return;
      }
    }

    estadoUsuarios.set(numero, estado);
  }






  async opcion3PasoAPaso(numero: string, mensaje: string): Promise<void> {
    const estado = estadoUsuarios.get(numero) || { paso: 0, datos: {}, tipo: 'opcion_3' };

    // 👉 Teléfono SIEMPRE será el del WhatsApp que escribe
    const telefonoFromWa = this.toKey ? this.toKey(numero) : numero;

    // Helpers
    const trim = (s?: string) => String(s || '').trim();
    const direccionValida = (txt?: string) => !!trim(txt) && trim(txt).length >= 5;

    // Prompts
    const pedirDirRecoger = async () =>
      this.enviarMensajeTexto(
        numero,
        '📍 Ingresa la dirección de *RECOGER*.\n\n' +
        '👉 Puedes escribir referencia o detalles adicionales en el mismo mensaje.\n\n'
      );

    const enviarResumenYBotones = async () => {
      const { direccionRecoger } = estado.datos;
      const telefonoRecoger = estado.datos.telefonoRecoger || telefonoFromWa;

      await this.enviarMensajeTexto(
        numero,
        '✅ Verifica:\n\n' +
        `📍 Recoger: ${direccionRecoger || '—'}\n` +
        `📞 Tel: ${telefonoRecoger}`
      );

      await this.sendButtons(
        numero,
        '¿Es correcto? Recuerda: una vez asignado el domiciliario no podrás cancelarlo',
        [
          { id: 'confirmar_pago', title: 'Confirmar' },
          { id: 'editar_pago', title: 'Editar' },
          { id: 'cancelar_pago', title: 'Cancelar' },
        ]
      );

    };

    switch (estado.paso) {
      // 0) Inicio: explicamos y pedimos dirección. Tel se toma del WhatsApp.
      case 0: {
        // Guardamos teléfono desde el número del chat
        estado.datos.telefonoRecoger = telefonoFromWa;
        estado.datos.telefonoRecogida = telefonoFromWa; // compat, por si en otro lado usas este campo

        await this.enviarMensajeTexto(
          numero,
          '💰 Vamos a recoger dinero/facturas.\n' +
          '📍 Envíame la *dirección de RECOGER*.\n\n' +
          '👉 Puedes escribir en un solo mensaje la dirección y alguna referencia.\n\n' +
          '🔐 Si el pago supera 200.000, escribe al 314 242 3130.'
        );
        estado.paso = 1;
        break;
      }

      // 1) Guardar dirección y mostrar resumen
      case 1: {
        const dir = trim(mensaje);

        if (!direccionValida(dir)) {
          await this.enviarMensajeTexto(
            numero,
            '⚠️ Dirección inválida. Escribe una *dirección válida* (mín. 5 caracteres).'
          );
          await pedirDirRecoger();
          break;
        }

        estado.datos.direccionRecoger = dir;
        estado.datos.direccionRecogida = dir;

        // Aseguramos teléfono desde WhatsApp por si acaso
        estado.datos.telefonoRecoger = estado.datos.telefonoRecoger || telefonoFromWa;
        estado.datos.telefonoRecogida = estado.datos.telefonoRecogida || telefonoFromWa;

        await enviarResumenYBotones();
        estado.confirmacionEnviada = true;
        estado.paso = 3;
        break;
      }

      // 2) (por compatibilidad) si alguien deja al estado en 2, lo tratamos igual que el 1
      case 2: {
        const dir = trim(mensaje);

        if (!direccionValida(dir)) {
          await this.enviarMensajeTexto(
            numero,
            '⚠️ Dirección inválida. Escribe una *dirección válida* (mín. 5 caracteres).'
          );
          await pedirDirRecoger();
          break;
        }

        estado.datos.direccionRecoger = dir;
        estado.datos.direccionRecogida = dir;
        estado.datos.telefonoRecoger = telefonoFromWa;
        estado.datos.telefonoRecogida = telefonoFromWa;

        await enviarResumenYBotones();
        estado.confirmacionEnviada = true;
        estado.paso = 3;
        break;
      }

      // 3) Correcciones rápidas: solo se corrige dirección; el teléfono siempre es el del chat
      case 3: {
        if (!trim(mensaje)) break;

        const dir = trim(mensaje);
        let huboCambio = false;

        if (direccionValida(dir)) {
          estado.datos.direccionRecoger = dir;
          estado.datos.direccionRecogida = dir;
          huboCambio = true;
        }

        // Tel SIEMPRE el de WhatsApp
        estado.datos.telefonoRecoger = telefonoFromWa;
        estado.datos.telefonoRecogida = telefonoFromWa;

        if (huboCambio) {
          await this.enviarMensajeTexto(
            numero,
            '✍️ Actualizado:\n\n' +
            `📍 Recoger: ${estado.datos.direccionRecoger}\n` +
            `📞 Tel: ${estado.datos.telefonoRecoger}`
          );

          // Reenviar botones por comodidad
          await this.sendButtons(
            numero,
            '¿Es correcto ahora? Recuerda: una vez asignado el domiciliario no podrás cancelarlo',
            [
              { id: 'confirmar_pago', title: 'Confirmar' },
              { id: 'editar_pago', title: 'Editar' },
              { id: 'cancelar_pago', title: 'Cancelar' },
            ]
          );

        } else {
          await this.enviarMensajeTexto(
            numero,
            '⚠️ No detecté cambios válidos. Escribe la nueva *dirección de RECOGER*.'
          );
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
    await this.sendButtons(
      numero,
      `${bodyText}\n\n(Ref: #${pedidoId})`,
      [
        { id: botonId, title: 'Cancelar pedido' },
      ]
    );

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

    const numeroQuejas =
      (await this.phonesService.getNumeroByKey('QUEJAS')) ??
      '573228689914'; // fallback seguro

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
📞 ${numeroQuejas.slice(2)} – Enviosw

🚀 Así podrás realizar tu envío de manera rápida y segura.`,
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
      cliente: null,
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
      domiciliario = await this.domiciliarioService.asignarDomiciliarioDisponible2();
    } catch {
      domiciliario = null;
    }

    // 2.a) Si NO hay domi → informar cliente y mostrar menú de cancelar
    if (!domiciliario) {
      await this.mostrarMenuPostConfirmacion(
        telClienteNorm,
        pedidoId,
        '🚨🚨🚨🚨🚨🚨🚨🚨\n' +
        '⚠️ 😔 EN EL MOMENTO NO HAY DISPONIBLES\n\n' +
        '⏳ ¿Deseas esperar entre 1 a 5,10,15 minutos mientras alguien se desocupa?\n' +
        '👉 O cancelar servicio.'
      );

      const st = estadoUsuarios.get(telClienteNorm) || {};
      st.esperandoAsignacion = true;
      estadoUsuarios.set(telClienteNorm, st);
      return;
    }

    // ✅ 3) ASIGNACIÓN DIRECTA (0 -> 1) solo si sigue pendiente (atómico)
    const asignado = await this.domiciliosService.asignarSiPendiente(
      pedidoId,
      domiciliario.id
    );

    if (!asignado) {
      // liberar domi y avisar cliente (igual que antes)
      try {
        await this.domiciliarioService.cambiarDisponibilidadPorTelefono(domiciliario.telefono_whatsapp, true);
      } catch { }

      await this.enviarMensajeTexto(
        telClienteNorm,
        '⏳ Estamos gestionando tu pedido. Te avisaremos apenas asignemos un domiciliiliario.'
      );

      await this.mostrarMenuPostConfirmacion(
        telClienteNorm,
        pedidoId,
        '⏳ *ESTAMOS BUSCANDO UN DOMICILIARIO CERCANO A TU DIRECCIÓN PARA ASIGNAR TU PEDIDO LO ANTES POSIBLE.*\n\n🛵 *DOMICILIOSW, TU MEJOR OPCIÓN* 🙌',
        60 * 1000
      );

      await this.sendButtons(
        telClienteNorm,
        'Si ya no lo necesitas, puedes cancelar:',
        [{ id: `cancelar_pedido_${pedidoId}`, title: 'Cancelar' }]
      );

      return;
    }

    // (Opcional) marcar domi ocupado
    try { await this.domiciliarioService.setDisponibleManteniendoTurnoById(domiciliario.id, false); } catch { }

    // ✅ 4) Crear conversación inmediata (como aliado/sticker)
    const conversacion = this.conversacionRepo.create({
      numero_domiciliario: domiciliario.telefono_whatsapp,
      numero_cliente: telClienteNorm,
      fecha_inicio: new Date(),
      estado: 'activa',
    });
    await this.conversacionRepo.save(conversacion);

    // Guardar estados para puente
    estadoUsuarios.set(telClienteNorm, {
      conversacionId: conversacion.id,
      tipo: 'conversacion_activa',
      inicioMostrado: true,
      pedidoId,
      esperandoAsignacion: false,
    });
    estadoUsuarios.set(domiciliario.telefono_whatsapp, {
      conversacionId: conversacion.id,
      tipo: 'conversacion_activa',
      inicioMostrado: true,
      pedidoId,
    });

    // ✅ 5) Notificar DOMI con detalles (SIN botones)
    const tipoLinea = '🔁 *Tipo de servicio:* auto';
    const listaODetalles = textoSan ? `📝 *Detalles:*\n${textoSan}` : '';
    const resumenParaDomi = [tipoLinea, listaODetalles].filter(Boolean).join('\n\n');

    const msgDomi = this.sanitizeWaBody(
      [
        '📦 *PEDIDO ASIGNADO*',
        '',
        resumenParaDomi,
        '',
        `👤 Cliente: *${nombreContacto || 'Cliente'}*`,
        `📞 Teléfono: ${telClienteNorm}`,
        '',
        `🆔 Pedido #${pedidoId}`,
        '💬 Ya estás conectado con el cliente en este chat.',
      ].join('\n')
    ).slice(0, 1024);

    await this.enviarMensajeTexto(domiciliario.telefono_whatsapp, msgDomi);

    // ✅ 6) Notificar CLIENTE (ya está asignado)
    const nombreDomi = `${domiciliario.nombre ?? ''} ${domiciliario.apellido ?? ''}`.trim() || domiciliario.telefono_whatsapp;
    const chaqueta = domiciliario?.numero_chaqueta ?? '-';

    await this.enviarMensajeTexto(
      telClienteNorm,
      [
        '✅ ¡Domiciliario asignado!',
        `👤 *${nombreDomi}*`,
        `🧥 Chaqueta: *${chaqueta}*`,
        `📞 Teléfono: *${this.waTo(domiciliario.telefono_whatsapp)}*`,
        '',
        '📲 Ya están conectados en este chat. Puedes coordinar la entrega aquí mismo.',
      ].join('\n')
    );

    // Botón finalizar al domi (si lo usas)
    try { await this.enviarBotonFinalizarAlDomi(domiciliario.telefono_whatsapp); } catch { }
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
    }, 30 * 60 * 1000); // 30 minutos

    temporizadoresInactividad.set(numero, t);
  }

  // 👇 Estados que consideramos "abiertos"

  private async crearPedidoDesdeSticker(numeroWhatsApp: string, comercio: any, nombreContacto?: string) {
    // IDs de botones (solo confirmación previa del cliente)
    const BTN_STICKER_CONFIRM_SI = 'stk_ok';
    const BTN_STICKER_CONFIRM_NO = 'stk_cancel';

    console.log('-------------------------------------------------');
    console.log('📌 Crear pedido desde sticker', comercio);
    console.log('-------------------------------------------------');

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

    const telConMas = (raw: string) => {
      const d = String(raw || '').replace(/\D/g, '');
      const with57 = d.length === 10 ? `57${d}` : d;
      return with57.startsWith('+') ? with57 : `+${with57}`;
    };

    // Snapshot de comercio sin placeholders; intenta completar por id y por teléfono del sticker
    // cambia la firma para incluir zonaId
    const resolveComercioSnapshot = async (input: any, telSticker: string): Promise<{
      id?: number;
      nombre: string | null;
      telefono: string | null;
      direccion: string | null;
      zonaId?: number | null;  // 👈 nuevo
    }> => {
      const init = input ?? {};

      // lee zona tanto si viene relación como si viene columna simple
      const zonaIdInit: number | null | undefined =
        (typeof init?.zona?.id === 'number' ? init.zona.id : undefined) ??
        (typeof init?.zona_id === 'number' ? init.zona_id : undefined) ??
        (typeof init?.zonaId === 'number' ? init.zonaId : undefined); // por si vino plana

      let id: number | undefined = init?.id;
      let nombre: string | null = firstNonEmpty(init?.nombre, init?.nombre_comercial, init?.name, init?.razon_social);
      let telefono: string | null = firstNonEmpty(init?.telefono, init?.telefono_whatsapp, init?.celular, init?.tel, init?.phone);
      let direccion: string | null = firstNonEmpty(init?.direccion, init?.direccion_principal, init?.address);
      let zonaId: number | null | undefined = zonaIdInit;

      if (telefono) telefono = toTelKeyLocal(telefono);

      // completa por ID si vino incompleto
      if (id && (!nombre || !telefono || !direccion || zonaId === undefined)) {
        try {
          const rec =
            (await (this.comerciosService as any)?.getById?.(id)) ??
            (await (this.comerciosService as any)?.findOne?.(id));
          if (rec) {
            nombre = nombre ?? firstNonEmpty(rec?.nombre, rec?.nombre_comercial, rec?.name, rec?.razon_social);
            telefono = telefono ?? firstNonEmpty(rec?.telefono, rec?.telefono_whatsapp, rec?.celular, rec?.tel, rec?.phone);
            direccion = direccion ?? firstNonEmpty(rec?.direccion, rec?.direccion_principal, rec?.address);
            // 👇 toma zona desde relación o columna simple, según tu modelo
            if (zonaId === undefined) {
              zonaId =
                (typeof rec?.zona?.id === 'number' ? rec.zona.id : undefined) ??
                (typeof rec?.zona_id === 'number' ? rec.zona_id : null);
            }
            if (telefono) telefono = toTelKeyLocal(telefono);
          }
        } catch { }
      }

      // completa por teléfono si aún falta algo
      if (!nombre || !telefono || !direccion || zonaId === undefined) {
        try {
          const telKeySticker = toTelKeyLocal(telSticker);
          const recByTel =
            (await (this.comerciosService as any)?.getByTelefono?.(telKeySticker)) ??
            (await (this.comerciosService as any)?.findByTelefono?.(telKeySticker)) ??
            (await (this.comerciosService as any)?.getByWhatsapp?.(telKeySticker));

          if (recByTel) {
            id = id ?? recByTel.id;
            nombre = nombre ?? firstNonEmpty(recByTel?.nombre, recByTel?.nombre_comercial, recByTel?.name, recByTel?.razon_social);
            telefono = telefono ?? firstNonEmpty(recByTel?.telefono, recByTel?.telefono_whatsapp, recByTel?.celular, recByTel?.tel, recByTel?.phone);
            direccion = direccion ?? firstNonEmpty(recByTel?.direccion, recByTel?.direccion_principal, recByTel?.address);
            if (zonaId === undefined) {
              zonaId =
                (typeof recByTel?.zona?.id === 'number' ? recByTel.zona.id : undefined) ??
                (typeof recByTel?.zona_id === 'number' ? recByTel.zona_id : null);
            }
            if (telefono) telefono = toTelKeyLocal(telefono);
          }
        } catch { }
      }

      return {
        id,
        nombre: nombre ?? null,
        telefono: telefono ?? null,
        direccion: direccion ?? null,
        zonaId: typeof zonaId === 'number' ? zonaId : (zonaId === null ? null : undefined),
      };
    };

    // ----------------------------------------------------------

    const telClienteNorm = normalizar(numeroWhatsApp); // comercio que envía el sticker
    const cSnap = await resolveComercioSnapshot(comercio, numeroWhatsApp);

    // ✅ ANTI-VACÍO: si faltan datos mínimos del comercio NO crear
    if (!cSnap?.direccion || !cSnap?.telefono) {
      await this.enviarMensajeTexto(
        telClienteNorm,
        '⚠️ No pude leer datos suficientes del sticker. Asegúrate de que incluya *dirección* y *teléfono* del comercio.'
      );
      return;
    }

    // ✅ ANTI-DUPLICADO: si ya hay un sticker pendiente para este número, no dupliques
    try {
      const yaPend = await this.domiciliosService.find({
        where: { numero_cliente: telClienteNorm, tipo_servicio: 'sticker', estado: 0 },
        order: { id: 'DESC' },
        take: 1,
      });
      if (yaPend?.[0]) {
        const stDup = estadoUsuarios.get(telClienteNorm) || {};
        stDup.esperandoAsignacion = true;
        stDup.pedidoPendienteId = yaPend[0].id;
        estadoUsuarios.set(telClienteNorm, stDup);

        await this.enviarMensajeTexto(
          telClienteNorm,
          `⏳ Ya tienes un pedido en curso (#${yaPend[0].id}). En cuanto haya domiciliario, se asignará automáticamente.\nSi no lo necesitas, escribe *CANCELAR* o usa el botón que te envié.`
        );
        return;
      }
    } catch { }

    // =========================
    // 🔒 Confirmación previa (NO crear de una)
    // (se mantiene: confirmación del CLIENTE; no del domiciliario)
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
        '¿Deseas *solicitar ahora* un domiciliario? \n',
        'SI NO FUNCIONAN LOS BOTONES, ESCRIBE **SÍ** PARA *CONFIRMAR* O **NO** PARA *CANCELAR*.'
      ].filter(Boolean).join('\n');

      st.stickerConfirmPayload = { telClienteNorm, comercioSnap: cSnap, nombreContacto: nombreContacto || null };
      estadoUsuarios.set(telClienteNorm, st);
      await this.sendButtons(
        telClienteNorm,
        preview,
        [
          { id: BTN_STICKER_CONFIRM_SI, title: 'Confirmar' },
          { id: BTN_STICKER_CONFIRM_NO, title: 'Cancelar' },
        ]
      );

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

    const partes: string[] = [
      'Pedido creado por *sticker oficial* del comercio:'
    ];
    if (cSnap?.nombre) partes.push(`🏪 ${cSnap.nombre}`);
    if (cSnap?.telefono) partes.push(`📞 ${cSnap.telefono}`);
    if (cSnap?.direccion) partes.push(`📌 ${cSnap.direccion}`);
    const detalles = partes.join('\n'); // <- esto ya lo estás usando en create()

    const pedidoCreado = await this.domiciliosService.create({
      mensaje_confirmacion: 'Auto-ingreso (sticker oficial comercio)',
      estado: 0,
      numero_cliente: telClienteNorm,
      fecha: new Date().toISOString(),
      hora: new Date().toTimeString().slice(0, 5),
      cliente: Number(cSnap.id ?? comercio?.id) || null, // 👈 guarda id del comercio si está
      id_domiciliario: null,
      tipo_servicio: 'sticker',
      origen_direccion: origenDireccion,
      destino_direccion: '',
      telefono_contacto_origen: telOrigen,
      telefono_contacto_destino: '',
      notas: '',
      detalles_pedido: detalles, // <-- usa la variable de arriba
      foto_entrega_url: '',
    });

    // =========================
    // ASIGNACIÓN DIRECTA (sticker) + CONVERSACIÓN
    // =========================
    let domiciliario: Domiciliario | null = null;

    const zonaIdDeComercio: number | null | undefined =
      (typeof cSnap?.zonaId === 'number' ? cSnap.zonaId : undefined) ??
      (typeof comercio?.zona?.id === 'number' ? comercio.zona.id : undefined) ??
      (typeof comercio?.zona_id === 'number' ? comercio.zona_id : undefined) ??
      (typeof comercio?.zonaId === 'number' ? comercio.zonaId : undefined) ??
      null;

    console.log('📌 Pedido creado desde sticker, id:', comercio);
    try { domiciliario = await this.domiciliarioService.asignarDomiciliarioDisponible3(Number(zonaIdDeComercio)); }
    catch { domiciliario = null; }

    // 2.a) Sin domi → queda pendiente + botón CANCELAR (y palabra)
    if (!domiciliario) {
      const st2 = estadoUsuarios.get(telClienteNorm) || {};
      st2.esperandoAsignacion = true;
      st2.pedidoPendienteId = pedidoCreado.id;
      estadoUsuarios.set(telClienteNorm, st2);

      const cuerpo =
        '🚫❌ *EN ESTE MOMENTO NO HAY DOMICILIARIOS DISPONIBLES.*\n\n' +
        '⏳ 👉 *SI DESEAS, PUEDES ESPERAR UNOS MINUTOS MIENTRAS UNO SE DESOCUPA Y ASÍ ASIGNAR TU PEDIDO.*\n\n' +
        '🛵 *domiciliosw.com, tu mejor opción*';


      try {
        await this.sendButtons(
          telClienteNorm,
          cuerpo,
          [
            { id: `cancelar_pedido_${pedidoCreado.id}`, title: 'Cancelar pedido' },
          ]
        );

        await this.enviarMensajeTexto(
          telClienteNorm,
          'Si no ves el botón, responde con la palabra *CANCELAR* para anular tu pedido.'
        );
      } catch (e) {
        this.logger.warn(`⚠️ No se pudo enviar botón cancelar: ${e instanceof Error ? e.message : e}`);
        await this.enviarMensajeTexto(
          telClienteNorm,
          cuerpo + '\n\nResponde con *CANCELAR* si deseas anular tu pedido.'
        );
      }
      return;
    }

    // 0 -> 1 (asignado) ATÓMICO
    const asignado = await this.domiciliosService.asignarSiPendiente(pedidoCreado.id, domiciliario.id);
    if (!asignado) {
      try { await this.domiciliarioService.setDisponibleManteniendoTurnoById(domiciliario.id, true); } catch { }
      await this.enviarMensajeTexto(
        telClienteNorm,
        '⏳ Tu pedido está siendo procesado. Te avisaremos cuando esté en ruta.'
      );
      return;
    }

    // (opcional) bloquear nuevas ofertas para el domi mientras tiene este pedido
    try { await this.domiciliarioService.setDisponibleManteniendoTurnoById(domiciliario.id, false); } catch { }

    // ✅ Crear conversación inmediata (sticker no requiere aceptación del domi)
    const conversacion = this.conversacionRepo.create({
      numero_domiciliario: domiciliario.telefono_whatsapp,
      numero_cliente: pedidoCreado.numero_cliente,
      fecha_inicio: new Date(),
      estado: 'activa',
    });
    await this.conversacionRepo.save(conversacion);

    estadoUsuarios.set(pedidoCreado.numero_cliente, {
      conversacionId: conversacion.id,
      inicioMostrado: true,
    });
    estadoUsuarios.set(domiciliario.telefono_whatsapp, {
      conversacionId: conversacion.id,
      tipo: 'conversacion_activa',
      inicioMostrado: true,
    });

    //  Notificaciones
    const nombreComercio = (cSnap?.nombre || 'Comercio').trim();
    const resumenUrgente = this.sanitizeWaBody(
      [
        '🚨 *PEDIDO ASIGNADO (URGENTE)*',
        '',
        `🏪 *Comercio:* ${nombreComercio}`,
        origenDireccion ? `📍 *Recoger en:* ${origenDireccion}` : '',
        telOrigen ? `📞 *Tel:* ${telOrigen}` : '',
        '',
        `🆔 Pedido #${pedidoCreado.id}`,
        '💬 Ya estás conectado con el cliente en este chat.',
      ].filter(Boolean).join('\n')
    );
    await this.enviarMensajeTexto(domiciliario.telefono_whatsapp, resumenUrgente);

    const nombreDomi = `${domiciliario.nombre ?? ''} ${domiciliario.apellido ?? ''}`.trim() || domiciliario.telefono_whatsapp;
    const chaqueta = domiciliario?.numero_chaqueta ?? '-';
    await this.enviarMensajeTexto(
      pedidoCreado.numero_cliente,
      [
        '✅ ¡Domiciliario asignado (URGENTE)!',
        `👤 *${nombreDomi}*`,
        `🧥 Chaqueta: *${chaqueta}*`,
        `📞 Teléfono: *${telConMas(domiciliario.telefono_whatsapp)}*`,
        '',
        '📲 Ya están conectados en este chat. Puedes coordinar la entrega aquí mismo.',
      ].join('\n')
    );

    // Botón/acción finalización al domi (si lo usas en tu flujo)
    try { await this.enviarBotonFinalizarAlDomi(domiciliario.telefono_whatsapp); } catch { }

    // ❌ NO usar flujo de oferta/ACEPTAR para stickers.
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
    await this.sendButtons(
      to,
      'DOMICILIO ASIGNADO. ¿Deseas finalizar el pedido?',
      [
        { id: 'fin_domi', title: 'Finalizar' },
      ]
    );
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

    const cliente = conv.numero_cliente;
    const domi = conv.numero_domiciliario;

    // 👉 Saber si YA estaba finalizada (por el cliente, por ejemplo)
    const yaFinalizadaAntes = conv.estado === 'finalizada';

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

    // ================================
    // 1) Mensajes al DOMI (siempre)
    // ================================
    try {
      await this.enviarMensajeTexto(
        domi,
        `✅ *¡SERVICIO FINALIZADO CON ÉXITO!* 🚀
Gracias por tu entrega y compromiso 👏

👉 *Ahora elige tu estado:*`
      );
      await this.sendButtons(
        domi,
        'Cambia tu disponibilidad: es obligatorio',
        [
          { id: 'cambiar_a_disponible', title: 'Disponible' },
          { id: 'cambiar_a_no_disponible', title: 'No disponible' },
        ]
      );

    } catch (e: any) {
      this.logger.warn(
        `⚠️ Botones de estado al domi fallaron: ${e?.response?.data?.error?.message || e?.message || e
        }`
      );
    }

    // ================================
    // 2) Mensajes al CLIENTE
    //    SOLO si NO había finalizado antes
    // ================================
    const numeroQuejas =
      (await this.phonesService.getNumeroByKey('QUEJAS')) ??
      '573228689914'; // fallback seguro

    if (!yaFinalizadaAntes) {
      try {
        if (typeof monto === 'number' && Number.isFinite(monto) && monto === 0) {
          // Caso especial: pedido cancelado
          const mensajeCancelacion = [
            '🤖 *GRACIAS POR PREFERIRNOS* 🛵',
            '*¿TIENES UN RECLAMO, SUGERENCIA, AFILIACIÓN O ALGÚN COBRO EXCESIVO?*',
            `📲 *ESCRÍBENOS AL ${numeroQuejas.slice(2)} Y CON GUSTO TE ATENDEMOS.*`
          ].join('\n');

          await this.enviarMensajeTexto(cliente, mensajeCancelacion);

        } else {
          // Caso normal: domicilio con costo
          const costoFormateado =
            (typeof monto === 'number' && Number.isFinite(monto))
              ? monto.toLocaleString('es-CO', {
                style: 'currency',
                currency: 'COP',
                minimumFractionDigits: 0
              })
              : '$5.000';

          const mensajeCliente = [
            '🤖 *GRACIAS POR PREFERIRNOS* 🛵',
            '*¿TIENES UN RECLAMO, SUGERENCIA, AFILIACIÓN O ALGÚN COBRO EXCESIVO?*',
            `📲 *ESCRÍBENOS AL ${numeroQuejas.slice(2)} Y CON GUSTO TE ATENDEMOS.*`
          ].join('\n');

          await this.enviarMensajeTexto(cliente, mensajeCliente);
        }

      } catch (e: any) {
        this.logger.warn(
          `⚠️ Mensaje de cierre a cliente falló: ${e?.response?.data?.error?.message || e?.message || e
          }`
        );
      }
    }


    // ================================
    // 3) Cierre del pedido / estado 7
    // ================================
    try {
      const pickPedidoId = (num?: string): number | undefined => {
        for (const v of variants(num)) {
          const st = estadoUsuarios.get(v);
          if (st?.pedidoId) return Number(st.pedidoId);
        }
        return undefined;
      };

      let pedidoId = pickPedidoId(cliente) ?? pickPedidoId(domi);

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
        let domiId: number | undefined = undefined;
        try {
          const domiEntity = await this.domiciliarioService.getByTelefono(domi);
          domiId = domiEntity?.id;
        } catch { }

        await this.domiciliosService.marcarEntregadoSiAsignado(pedidoId, domiId);
      } else {
        this.logger.warn(`⚠️ No pude inferir pedidoId a cerrar para conv=${conversacionId} (cliente=${cliente}).`);
      }
    } catch (e: any) {
      this.logger.error(`❌ Falló el cierre (estado=7) para conv=${conversacionId}: ${e?.message || e}`);
    }

    // ================================
    // 4) Marcar conversación como finalizada
    //    (aunque el cliente ya lo hubiera hecho, esto la deja coherente)
    // ================================
    conv.estado = 'finalizada';
    conv.fecha_fin = new Date();
    try {
      await this.conversacionRepo.save(conv);
    } catch (e: any) {
      this.logger.error(`❌ No se pudo guardar el cierre de la conversación ${conversacionId}: ${e?.message || e}`);
    }

    // ================================
    // 5) Limpiar estados de cliente y domi
    // ================================
    clearAllFor(cliente);
    clearAllFor(domi);

    // 🔚 Siempre devolvemos un objeto, nunca undefined
    return { ok: true };
  }




  // ⚙️ Crear/activar puente de soporte con asesor PSQR
  private async iniciarSoportePSQR(numeroCliente: string, nombreCliente?: string) {

    const numeroQuejas =
      (await this.phonesService.getNumeroByKey('QUEJAS')) ??
      '573228689914'; // fallback seguro

    // 1) Saludo bonito al cliente
    const msgCliente = [
      '🛟 *Soporte DomiciliosW (PSQR)*',
      '✅ Ya un asesor de *DomiciliosW* está en contacto contigo.',
      '',
      '👩‍💼 *Asesor asignado:*',
      `📞 ${numeroQuejas}`,
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

    await this.enviarMensajeTexto(numeroQuejas, msgAsesor);

    // 3) Registra el "puente" en memoria para rutear mensajes
    const convId = `psqr-${Date.now()}-${numeroCliente}`; // id lógico para el puente
    const stCliente = estadoUsuarios.get(numeroCliente) || {};
    stCliente.soporteActivo = true;
    stCliente.soporteConversacionId = convId;
    stCliente.soporteAsesor = numeroQuejas;
    estadoUsuarios.set(numeroCliente, stCliente);

    const stAsesor = estadoUsuarios.get(numeroQuejas) || {};
    stAsesor.soporteActivo = true;
    stAsesor.soporteConversacionId = convId;
    stAsesor.soporteCliente = numeroCliente;
    estadoUsuarios.set(numeroQuejas, stAsesor);
  }

  // ⚙️ Crear/activar puente de afiliación con el mismo asesor PSQR
  private async iniciarAfiliacionAliado(numeroCliente: string, nombreCliente?: string) {

    const numeroQuejas =
      (await this.phonesService.getNumeroByKey('QUEJAS')) ??
      '573228689914'; // fallback seguro

    // 1️⃣ Mensaje al cliente
    const msgCliente = [
      '🤝 *AFILIACIONES DOMICILIOSW*',
      '¡Gracias por tu interés en ser *Aliado de Pedidos Rápidos*! 🚀',
      '',
      'Por favor, escribe (en un solo mensaje):',
      '• 🏪 *Nombre del comercio*',
      '• 👤 *Responsable*',
      '• 📞 *Teléfono*',
      '• 🏠 *Dirección* (o barrio/ciudad)',
      '',
      '✍️ Escribe aquí la información y un asesor te atenderá en este chat.',
      '❌ Escribe *cerrar* para terminar la conversación.'
    ].join('\n');

    await this.enviarMensajeTexto(numeroCliente, msgCliente);

    // 2️⃣ Aviso al asesor (usa el mismo del PSQR)
    const msgAsesor = [
      '🛎️ *NUEVA SOLICITUD DE AFILIACIÓN*',
      `👤 Prospecto: ${nombreCliente || 'Comercio'}`,
      `📱 Teléfono: ${numeroCliente}`,
      '',
      '💬 Responde aquí para iniciar el chat de afiliación.',
      '🧷 Escribe *cerrar* cuando cierres el caso.'
    ].join('\n');

    await this.enviarMensajeTexto(numeroQuejas, msgAsesor);

    // 3️⃣ Registrar el puente en memoria (igual que PSQR)
    const convId = `afiliacion-${Date.now()}-${numeroCliente}`;

    const stCliente = estadoUsuarios.get(numeroCliente) || {};
    stCliente.afiliacionActiva = true;
    stCliente.afiliacionConversacionId = convId;
    stCliente.afiliacionAsesor = numeroQuejas;
    estadoUsuarios.set(numeroCliente, stCliente);

    const stAsesor = estadoUsuarios.get(numeroQuejas) || {};
    stAsesor.afiliacionActiva = true;
    stAsesor.afiliacionConversacionId = convId;
    stAsesor.afiliacionCliente = numeroCliente;
    estadoUsuarios.set(numeroQuejas, stAsesor);
  }


  // 🧹 Finaliza el puente PSQR sin importar quién envía "salir"
  private async finalizarSoportePSQRPorCualquiera(quienEscribe: string) {
    const numeroQuejas =
      (await this.phonesService.getNumeroByKey('QUEJAS')) ??
      '573228689914'; // fallback seguro

    const st = estadoUsuarios.get(quienEscribe);
    const convId = st?.soporteConversacionId;

    // Detectar roles y contrapartes a partir del estado en memoria
    let cliente = st?.soporteCliente ? st.soporteCliente : (st?.soporteAsesor ? quienEscribe : null);
    let asesor = st?.soporteAsesor ? st.soporteAsesor : (st?.soporteCliente ? quienEscribe : null);

    // Fallback por si el asesor es el fijo ASESOR_PSQR
    if (!asesor && st?.soporteConversacionId) asesor = numeroQuejas;

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

  // 🧹 Finaliza el puente de AFILIACIONES sin importar quién envía "salir"
  private async finalizarAfiliacionPorCualquiera(quienEscribe: string) {

    const numeroQuejas =
      (await this.phonesService.getNumeroByKey('QUEJAS')) ??
      '573228689914'; // fallback seguro

    const st = estadoUsuarios.get(quienEscribe);
    const convId = st?.afiliacionConversacionId;

    // Detectar roles y contrapartes
    let cliente = st?.afiliacionCliente ? st.afiliacionCliente : (st?.afiliacionAsesor ? quienEscribe : null);
    let asesor = st?.afiliacionAsesor ? st.afiliacionAsesor : (st?.afiliacionCliente ? quienEscribe : null);

    // Fallback por si el asesor es el fijo ASESOR_PSQR
    if (!asesor && st?.afiliacionConversacionId) asesor = numeroQuejas;

    if (!convId || !cliente || !asesor) {
      // Nada que cerrar
      return;
    }

    // 1️⃣ Mensaje de cierre al cliente
    const gracias = [
      '🧡 *Gracias por tu interés en ser parte de DomiciliosW*',
      'Tu solicitud de *afiliación* ha sido *cerrada*. 🤝',
      '',
      'Si deseas continuar más adelante, solo escribe *Afiliar*. 🚀'
    ].join('\n');
    await this.enviarMensajeTexto(cliente, gracias);

    // 2️⃣ Aviso al asesor
    await this.enviarMensajeTexto(asesor, '✅ Afiliación cerrada correctamente.');

    // 3️⃣ Limpiar estados en memoria
    const stCliente = estadoUsuarios.get(cliente) || {};
    delete stCliente.afiliacionActiva;
    delete stCliente.afiliacionConversacionId;
    delete stCliente.afiliacionAsesor;
    estadoUsuarios.set(cliente, stCliente);

    const stAsesor = estadoUsuarios.get(asesor) || {};
    delete stAsesor.afiliacionActiva;
    delete stAsesor.afiliacionConversacionId;
    delete stAsesor.afiliacionCliente;
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

    // Convertir a número
    const n = Number(limpio);

    // ⬅️ NUEVO: permitir explícitamente el 0
    if (n === 0) return 0;

    // Para todo lo demás, exigir al menos 1000
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
        await this.sendButtons(
          to,
          body,
          [
            { id: `aceptar_pedido_${pedidoId}`, title: 'Aceptar' },
            { id: `rechazar_pedido_${pedidoId}`, title: 'Rechazar' },
          ]
        );

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
      await this.sendButtons(
        to,
        'Tomar pedido:',
        [
          { id: `aceptar_pedido_${pedidoId}`, title: 'Aceptar' },
          { id: `rechazar_pedido_${pedidoId}`, title: 'Rechazar' },
        ]
      );

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

