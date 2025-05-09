
export interface ClienteQuery {
    page: number; // Número de página
    search?: string; // Término de búsqueda
    estado?: string; // Filtro por estado ('activo', 'inactivo')
    fechaInicio?: string; // Fecha de inicio para el rango de fechas
    fechaFin?: string; // Fecha de fin para el rango de fechas
  }
  