// src/precios/application/precio-domicilio.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrecioDomicilio } from '../chatbot/entities/precio-domicilio.entity';

type SumaPorDomiciliario = {
  numero_domiciliario: string;
  total: string; // string para mantener precisión de DECIMAL
};

type SumaPorDia = {
  dia: string;   // 'YYYY-MM-DD'
  total: string; // string para DECIMAL
};

@Injectable()
export class PrecioDomicilioService {
  constructor(
    @InjectRepository(PrecioDomicilio)
    private readonly repo: Repository<PrecioDomicilio>,
  ) {}

  /**
   * Suma de costos agrupada por numero_domiciliario para el DÍA ACTUAL
   * en la zona horaria America/Bogota.
   */
  async sumasDeHoyAgrupadasPorDomiciliario(): Promise<SumaPorDomiciliario[]> {
    // Nota: p.fecha es timestamptz. Convertimos ambas fechas a America/Bogota
    // y comparamos por la parte de "date".
    const qb = this.repo
      .createQueryBuilder('p')
      .select('p.numero_domiciliario', 'numero_domiciliario')
      .addSelect("SUM(p.costo::numeric)", 'total')
      .where(
        "(p.fecha AT TIME ZONE 'America/Bogota')::date = (now() AT TIME ZONE 'America/Bogota')::date",
      )
      .groupBy('p.numero_domiciliario')
      .orderBy('total', 'DESC');

    // getRawMany devuelve strings para los numerics (lo cual queremos)
    return qb.getRawMany<SumaPorDomiciliario>();
  }

  /**
   * Suma diaria de costos (agrupado por día) en America/Bogota.
   * Si no pasas fechas, devuelve sólo el día actual.
   *
   * @param startInclusive ISO date (YYYY-MM-DD) en America/Bogota (opcional)
   * @param endInclusive   ISO date (YYYY-MM-DD) en America/Bogota (opcional)
   */
  async sumasPorDia(
    startInclusive?: string,
    endInclusive?: string,
  ): Promise<SumaPorDia[]> {
    // Construimos el WHERE en función de si hay rango o no.
    // Todo se evalúa en America/Bogota para evitar ambigüedad.
    const whereParts: string[] = [];
    const params: Record<string, any> = {};

    if (startInclusive && endInclusive) {
      // Rango [start, end]
      whereParts.push(
        "(p.fecha AT TIME ZONE 'America/Bogota')::date BETWEEN :dstart AND :dend",
      );
      params.dstart = startInclusive;
      params.dend = endInclusive;
    } else {
      // Solo hoy (por defecto)
      whereParts.push(
        "(p.fecha AT TIME ZONE 'America/Bogota')::date = (now() AT TIME ZONE 'America/Bogota')::date",
      );
    }

    const qb = this.repo
      .createQueryBuilder('p')
      .select("(p.fecha AT TIME ZONE 'America/Bogota')::date", 'dia')
      .addSelect('SUM(p.costo::numeric)', 'total')
      .where(whereParts.join(' AND '), params)
      .groupBy('dia')
      .orderBy('dia', 'ASC');

    return qb.getRawMany<SumaPorDia>();
  }
}
