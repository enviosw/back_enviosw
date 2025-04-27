import { Module, Global } from '@nestjs/common';
import { FileUploadService } from './file-upload.service';  // Importamos el servicio

@Global()  // Esto hace que el servicio sea global y esté disponible en toda la aplicación
@Module({
  providers: [FileUploadService],  // Proveedor del servicio
  exports: [FileUploadService],  // Exportamos el servicio para que sea accesible en otros módulos
})
export class FileUploadModule {}
