// src/productos/interfaces/producto-query.interface.ts
export interface ProductoQuery {
    page?: number;
    take?: number;
    search?: string;
    estado?: string;
    categoriaId?: number;
    comercioId?: number;
  }
  