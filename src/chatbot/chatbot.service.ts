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
import { stickerConstants, urlImagenConstants } from 'src/auth/constants/jwt.constant';


const estadoUsuarios = new Map<string, any>();
const temporizadoresInactividad = new Map<string, NodeJS.Timeout>(); // ⏰ Temporizadores
const temporizadoresEstado = new Map<string, NodeJS.Timeout>(); // TTL para solicitar estado a domiciliario
const bloqueoMenu = new Map<string, NodeJS.Timeout>(); // Bloqueo temporal del menú

const ESTADO_COOLDOWN_MS = 5 * 60 * 1000; // 5 min

function isExpired(ts?: number) {
  return !ts || Date.now() >= ts;
}


const ASESOR_PSQR = '573208729276';




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
if (st?.soporteActivo) return; // ⛔ no cerrar chats PSQR por inactividad

    if (st?.conversacionId) return;          // ya en chat con domiciliario
    if (st?.confirmadoPedido === true) return;     // ya confirmó
    if (st?.esperandoAsignacion === true) return;  // confirmado pero esperando domi

    estadoUsuarios.delete(numero);
    if (temporizadoresInactividad.has(numero)) {
      clearTimeout(temporizadoresInactividad.get(numero)!);
      temporizadoresInactividad.delete(numero);
    }

    await this.enviarMensajeTexto(numero, '🚨');

    const cierre = [
      '📕✨ *El chat se cerró automáticamente por inactividad*',
      '👉 ¡Pero aquí sigo listo para ayudarte!',
      '',
      'Escribe *Hola* y volvemos a empezar un nuevo chat 🚀💬'
    ].join('\n');

    await this.enviarMensajeTexto(numero, cierre);
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
            `✅ Ya estás conectado con el domiciliario desde este chat. ¡Respóndele aquí!`

          );

          // 6) Notificar al domiciliario
          const telefonoDomiciliario = domiciliario.telefono_whatsapp.replace(/\D/g, '');
          await this.enviarMensajeTexto(
            telefonoDomiciliario,
            `📦 *Nuevo pedido asignado*\n\n${resumen}\n\n` +
            `👤 Cliente: *${pedido.numero_cliente || 'Cliente'}*\n` +
            `📞 WhatsApp: ${String(pedido.numero_cliente).startsWith('+')
              ? String(pedido.numero_cliente)
              : '+57' + String(pedido.numero_cliente).slice(-10)
            }\n\n` +
            `✅ Ya estás conectado con el cliente en este chat. ¡Respóndele aquí!`
          );

          await this.enviarBotonFinalizarAlDomi(telefonoDomiciliario);


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

  // 1) Si quien escribe es el ASESOR y manda "salir", cerramos el caso
  if (numero === ASESOR_PSQR && /^salir$/i.test(textoPlano)) {
    await this.finalizarSoportePSQR(ASESOR_PSQR);
    return;
  }

  // 2) Determinar el otro participante
  const esAsesor = numero === ASESOR_PSQR;
  const otro = esAsesor ? st.soporteCliente : st.soporteAsesor;

  // 3) Reenviar el mensaje con un pequeño prefijo de burbuja
  if (tipo === 'text' && texto) {
    const prefijo = esAsesor ? '👩‍💼' : '🙋‍♀️';
    await this.enviarMensajeTexto(otro, `${prefijo} ${texto}`);
  }

  // 4) No cierres por inactividad mientras soporteActivo sea true
  // (Si usas reinicio por inactividad, ya estás protegido si verificas soporteActivo)
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
      const saludo = `👋 Hola *${String(nombre)}*, soy *Wilber*, tu asistente virtual de *DOMICILIOS W*

🛵💨 Pide tu servicio ingresando a nuestra *página web*:
🌐 https://domiciliosw.com`;

      await this.enviarMensajeImagenPorId(numero, urlImagen, saludo);

      // ⏱️ Pequeña pausa para que no se empalmen los mensajes
      await new Promise(resolve => setTimeout(resolve, 300));

      // 🚀 Lista de opciones
      await this.enviarListaOpciones(numero);

      return;
    }


    if (tipo === 'sticker') {
      const sha = mensaje?.sticker?.sha256;
      const STICKER_EMPRESA_SHA = String(stickerConstants.stickerChad);

      this.logger.log(`📎 SHA del sticker recibido: ${sha}`);

      const numeroLimpio = numero.startsWith('57') ? numero.slice(2) : numero;

      if (sha === STICKER_EMPRESA_SHA) {
        try {
          const comercio = await this.comerciosService.findByTelefono(numeroLimpio);

          if (comercio) {
            // ✅ 1) Agradece y confirma detección
            await this.enviarMensajeTexto(
              numero,
              `🎉 *Sticker oficial detectado* de ${comercio.nombre}.\n` +
              `🧾 Crearé tu pedido y revisaré domiciliario disponible...`
            );

            // ✅ 2) Crea pedido e intenta asignar (o lo deja pendiente)
            await this.crearPedidoDesdeSticker(numero, comercio, comercio.nombre);
          } else {
            // Comercio no encontrado, solo mensaje genérico
            await this.enviarMensajeTexto(numero, '🎉 ¡Gracias por usar nuestro *sticker oficial*!');
            this.logger.warn(`⚠️ No se encontró comercio para el número: ${numeroLimpio}`);
          }
        } catch (error) {
          this.logger.error(`❌ Error flujo sticker-oficial: ${error?.message || error}`);
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
🧥 Chaqueta: *${String(domiciliario.numero_chaqueta)}*
📞 WhatsApp: *${String(domiciliario.telefono_whatsapp)}*

🚀 Está en camino. Gracias por usar *Domicilios W* 🛵💨`
          );

          // 4) Avisar al domiciliario
          const resumenPedido = this.generarResumenPedido(datos, tipo, nombre, numero);
          const telefonoDomiciliario = domiciliario.telefono_whatsapp.replace(/\D/g, '');
          await this.enviarMensajeTexto(
            telefonoDomiciliario,
            `📦 *Nuevo pedido asignado*\n\n${resumenPedido}\n\n` +
            `👤 Cliente: *${String(nombre)}*\n` +
            `📞 WhatsApp: ${numero.startsWith('+') ? numero : '+57' + numero.slice(-10)
            }\n\n` +
            `✅ Ya estás conectado con el cliente en este chat. ¡Respóndele aquí!`
          );

          await this.enviarBotonFinalizarAlDomi(telefonoDomiciliario);



          // 5) Registrar pedido como ASIGNADO
          const pedidoCreado = await this.domiciliosService.create({
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

          // 👇 MENÚ INMEDIATO PARA CANCELAR
          if (pedidoCreado?.id) {
            await this.mostrarMenuPostConfirmacion(numero, pedidoCreado.id);
          }


          // 🔐 Mensaje final SOLO si hay conversacion activa
          await this.enviarMensajeTexto(
            numero,
            `🚴‍♂️ ¡ *TU DOMICILIARIO* ya está en línea contigo!
📲 Escríbele si necesitas algo extra.

⚠️ Cada que desees un servicio, por seguridad, mantén siempre contacto con la empresa 📞 *3134089563*`
          );

        } catch (error) {
          // ❌ No hay domiciliarios disponibles
          this.logger.warn('⚠️ No hay domiciliarios disponibles en este momento.');

          // ⚠️ IMPORTANTE: NO crear conversación aquí
          // Guardamos un flag de espera para no mostrar menú ni romper el flujo
          st.esperandoAsignacion = true;

          // Inicializa la bandera anti-duplicado si no existe
          st.avisoNoDomiEnviado = Boolean(st.avisoNoDomiEnviado);

          // --- ENVÍO CONTROLADO (emoji -> mensaje) ---
          if (!st.avisoNoDomiEnviado) {
            // 0) Primero: solo el emoji (como alerta visual)
            await this.enviarMensajeTexto(numero, '🚨');

            // 1) Mensaje claro al cliente (igual a la estructura de la imagen)
            const aviso = [
              '✨ *Aviso importante*',
              'En este momento *NO TENEMOS DOMICILIARIOS DISPONIBLES*',
              '',
              '*Puedes:*',
              '1️⃣ *Esperar* ⏱️ ~10 minutos o menos mientras uno queda libre.',
              '2️⃣ ❌ *Cancelar* el servicio.'
            ].join('\n');

            await this.enviarMensajeTexto(numero, aviso);

            // Marca como enviado para no duplicar en reintentos/errores consecutivos
            st.avisoNoDomiEnviado = true;
          } else {
            this.logger.debug('ℹ️ Aviso de no disponibilidad ya enviado. Se evita duplicar.');
          }

          // Actualiza el estado del usuario
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

          // 👇 MENÚ INMEDIATO PARA CANCELAR
          if (pedidoPendiente?.id) {
            await this.mostrarMenuPostConfirmacion(numero, pedidoPendiente.id);
          }

          // (Opcional) Podrías lanzar un proceso de reintento aquí
          // this.programarReintentoAsignacion(numero);

          // Nota: recuerda resetear `st.avisoNoDomiEnviado = false` cuando:
          // - se asigne un domiciliario o
          // - el cliente cancele / finalice el flujo
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
      const saludo = `👋 Hola ${nombre}, soy *Wilber*, tu asistente virtual de *Domicilios W* 🛵💨

📲 Pide tu servicio ingresando a nuestra página web:
🌐 https://domiciliosw.com/`;

      const urlImagen = `${urlImagenConstants.urlImg}`;

      await this.enviarMensajeImagenPorId(numero, urlImagen, saludo);

      // ⏱️ pausa de 300 ms (usa 3000 si quieres ~3 segundos)
      await new Promise(resolve => setTimeout(resolve, 300));


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

      // 🛡️ Bloqueo: solo cancelar si sigue pendiente
      if (!(await this.puedeCancelarPedido(pedidoId))) {
        await this.enviarMensajeTexto(
          numero,
          '🔒 Este pedido ya fue confirmado con el domiciliario y no se puede cancelar por este medio.\n' +
          'Si necesitas ayuda, escríbenos por soporte.'
        );
        return;
      }

      // ✅ Cancelación permitida (estado=0)
      await this.domiciliosService.update(pedidoId, {
        estado: 2, // cancelado
        motivo_cancelacion: 'Cancelado por el cliente vía WhatsApp',
      });

      // ... (resto de tu lógica de notificación/ cierre de conversación si existía)
      await this.enviarMensajeTexto(
        numero,
        '🧡 Tu pedido ha sido *cancelado*. ¡Gracias por usar Domicilios W!'
      );

      const s = estadoUsuarios.get(numero) || {};
      s.esperandoAsignacion = false;
      estadoUsuarios.set(numero, s);
      if (bloqueoMenu.has(numero)) bloqueoMenu.delete(numero);

    } catch (err) {
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

    const estado = domiciliario ? 1 : 0;
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
        `📞 WhatsApp: *${telDomiNorm}*\n\n` +
        `💬 Ya estás conectado con el domicilario. Escribele desde aquí mismo.`
      );

      // 👉 Domiciliario: TODA la información + resumen completo
      await this.enviarMensajeTexto(
        telDomiNorm,
        `📦 *Nuevo pedido asignado*\n\n${resumen}\n\n` +
        `👤 Cliente: *${nombreContacto || 'Cliente'}*\n` +
        `📞 WhatsApp: ${telClienteNorm}\n\n` +
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
        `👤 *${domiciliario.nombre} ${domiciliario.apellido}*\n` +
        `🧥 Chaqueta: *${domiciliario.numero_chaqueta}*\n` +
        `📞 WhatsApp: *${telDomiNorm}*\n\n` +
        `💬 Ya puedes coordinar con el domiciliario por aquí.`
      );

      // Domiciliario
      await this.enviarMensajeTexto(
        telDomiNorm,
        `📦 *Nuevo pedido` +
        `👤 Comercio: *${String(comercio?.nombre) || String(nombreContacto) || ''}*\n` +
        `📞 WhatsApp: ${comercio?.direccion ?? ''}\n\n` +
        `📞 WhatsApp: ${telClienteNorm}\n\n` +
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
  ].join('\n');

  await this.enviarMensajeTexto(numeroCliente, msgCliente);

  // 2) Aviso al asesor con datos del cliente
  const msgAsesor = [
    '🛎️ *NUEVO CONTACTO PSQR*',
    `👤 Cliente: ${nombreCliente || 'Cliente'}`,
    `📱 WhatsApp: ${numeroCliente}`,
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

// 🧹 Finaliza el puente PSQR cuando el asesor escribe "salir"
private async finalizarSoportePSQR(numeroAsesor: string) {
  const stAsesor = estadoUsuarios.get(numeroAsesor);
  const cliente = stAsesor?.soporteCliente;
  const convId = stAsesor?.soporteConversacionId;
  if (!cliente || !convId) return;

  // 1) Mensaje de gracias al cliente
  const gracias = [
    '🧡 *Gracias por contactarnos*',
    'Tu caso de PSQR ha sido *cerrado*.',
    '',
    'Si necesitas algo más, escribe *Hola* y con gusto te ayudamos. 🛵',
  ].join('\n');
  await this.enviarMensajeTexto(cliente, gracias);

  // 2) Aviso al asesor
  await this.enviarMensajeTexto(numeroAsesor, '✅ Caso cerrado. ¡Gracias!');

  // 3) Limpia estados (y timers si aplica)
  const stCliente = estadoUsuarios.get(cliente) || {};
  delete stCliente.soporteActivo;
  delete stCliente.soporteConversacionId;
  delete stCliente.soporteAsesor;
  estadoUsuarios.set(cliente, stCliente);

  delete stAsesor.soporteActivo;
  delete stAsesor.soporteConversacionId;
  delete stAsesor.soporteCliente;
  estadoUsuarios.set(numeroAsesor, stAsesor);

  // 4) (Opcional) si quieres ELIMINAR un registro de conversación en BD: 
  //    Aquí usamos un ID lógico, así que no hay registro real; 
  //    si decides persistir, borra aquí con conversacionRepo.delete(idReal).
}


}


