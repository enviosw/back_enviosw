import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversacion } from './entities/conversacion.entity';
import { Mensaje } from './entities/mensajes.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Mensaje)
    private readonly mensajeRepository: Repository<Mensaje>,

    @InjectRepository(Conversacion)
    private readonly conversacionRepository: Repository<Conversacion>,
  ) {}

  /**
   * ✅ Lista todos los mensajes entre un domiciliario y un cliente
   */
  async listarMensajesPorDomiciliarioYCliente(
    numeroDomiciliario: string,
    numeroCliente: string,
  ): Promise<Mensaje[]> {

    console.log(numeroCliente, numeroDomiciliario)
const conversacion = await this.conversacionRepository.findOne({
  where: {
    numero_domiciliario: numeroDomiciliario,
    numero_cliente: numeroCliente,
  },
  order: {
    fecha_inicio: 'DESC', // Usa el campo que represente la fecha de creación o actualización
  },
});


    console.log(conversacion)

    

    if (!conversacion) {
      return [];
    }

    const mensajes = await this.mensajeRepository.find({
      where: { conversacion_id: conversacion.id },
      order: { timestamp: 'ASC' },
    });

    console.log(mensajes)

    return mensajes;
  }

async listarMensajesPorConversacionId(idConversacion: string): Promise<Mensaje[]> {
  console.log('Conversación ID:', idConversacion);

  const mensajes = await this.mensajeRepository.find({
    where: { conversacion_id: String(idConversacion) },
    order: { timestamp: 'ASC' },
  });

  console.log('Mensajes:', mensajes);

  return mensajes;
}

  

  /**
   * ✅ Lista todas las conversaciones de un domiciliario
   * mostrando el último mensaje de cada una, estilo WhatsApp
   */
  async obtenerChatsPorDomiciliario(numeroDomiciliario: string) {
    const conversaciones = await this.conversacionRepository.find({
      where: { numero_domiciliario: numeroDomiciliario },
    });

    if (!conversaciones.length) return [];

    const chats = await Promise.all(
      conversaciones.map(async (conversacion) => {
        const ultimoMensaje = await this.mensajeRepository.findOne({
          where: { conversacion_id: conversacion.id },
          order: { timestamp: 'DESC' },
        });

        return {
          conversacionId: conversacion.id,
          cliente: conversacion.numero_cliente,
          estado: conversacion.estado,
          ultimoMensaje: ultimoMensaje?.contenido || null,
          timestamp: ultimoMensaje?.timestamp || conversacion.fecha_inicio,
          tipo: ultimoMensaje?.tipo || 'text',
        };
      }),
    );

    chats.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return chats;
  }
}
