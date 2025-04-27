import { Injectable } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Injectable()
export class FileUploadService {
  // Configuración de multer para la carga de archivos
  static storage = diskStorage({
    destination: './uploads', // Directorio donde se almacenarán las imágenes
    filename: (req, file, cb) => {
      const filename = `${Date.now()}${extname(file.originalname)}`;
      cb(null, filename); // Generar un nombre único para el archivo
    },
  });
}
