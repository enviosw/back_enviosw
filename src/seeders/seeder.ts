import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UsuariosService } from '../usuarios/usuarios.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { ServiciosService } from '../servicios/servicios.service';
import { RolesService } from '../roles/roles.service';

// importa más servicios si necesitas (ej: RoleService)

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const configService = app.get(ConfigService);

  const enableSeeding = configService.get('ENABLE_SEEDING') === 'true';
  if (!enableSeeding) {
    console.log('⛔ Seeding desactivado por configuración.');
    await app.close();
    return;
  }

  console.log('🚀 Ejecutando seeders...');

  await seedUsuarios(app);
  await seedServicios(app);
  await seedRoles(app);
  // await seedRoles(app); // otros seeders aquí

  console.log('✅ Seeders completados.');
  await app.close();
}

async function seedUsuarios(app) {
  const usuarioService = app.get(UsuariosService);

  // Admin
  const adminEmail = 'admin@domi.com';
  const adminExistente = await usuarioService.findOneByEmail(adminEmail);
  if (!adminExistente) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await usuarioService.create({
      nombre: 'Admin',
      email: adminEmail,
      password: hashedPassword,
      rol: 'administrador',
      estado: 'activo',
    });
    console.log('✅ Usuario administrador creado.');
  } else {
    console.log('⚠️ El usuario administrador ya existe.');
  }

  // Aliado
  const aliadoEmail = 'aliado@domi.com';
  const aliadoExistente = await usuarioService.findOneByEmail(aliadoEmail);
  if (!aliadoExistente) {
    const hashedPassword = await bcrypt.hash('aliado123', 10);
    await usuarioService.create({
      nombre: 'Aliado',
      email: aliadoEmail,
      password: hashedPassword,
      rol: 'aliado',
      estado: 'activo',
    });
    console.log('✅ Usuario aliado creado.');
  } else {
    console.log('⚠️ El usuario aliado ya existe.');
  }
}

async function seedServicios(app) {
  const serviciosService = app.get(ServiciosService);

  const serviciosData = [
    { nombre: 'Restaurantes', estado: 'activo', icon: 'FaUtensils', color: '#2B7FFF', foto: 'res.png', orden: 3 },
    { nombre: 'Detalles', estado: 'activo', icon: 'FaGift', color: '#00C950', foto: 'det.png', orden: 8 },
    { nombre: 'Droguerías', estado: 'activo', icon: 'FaPills', color: '#F0B100', foto: 'dro.png', orden: 6 },
    { nombre: 'Almacenes', estado: 'activo', icon: 'FaWarehouse', color: '#AD46FF', foto: 'alm.png', orden: 7 },
    { nombre: 'Licores', estado: 'activo', icon: 'FaGlassCheers', color: '#009966', foto: 'lic.png', orden: 9 },
    { nombre: 'Recogidas', estado: 'inactivo', icon: 'FaTruck', color: '#FB2C36', foto: 'rec.png', orden: 1 },
    { nombre: 'Compras', estado: 'inactivo', icon: 'FaShoppingCart', color: '#FF6900', foto: 'com.png', orden: 2 },
    { nombre: 'Pagos', estado: 'inactivo', icon: 'FaCreditCard', color: '#615FFF', foto: 'pag.png', orden: 4 },
    { nombre: 'Envíos', estado: 'inactivo', icon: 'FaParachuteBox', color: '#00BBA7', foto: 'env.png', orden: 5 },



  // Nuevos
  { nombre: 'Belleza', estado: 'activo', icon: 'Sparkles', color: '#FF6F91', foto: 'bel.png', orden: 10 },
  { nombre: 'Floristería', estado: 'activo', icon: 'Flower2', color: '#FF69B4', foto: 'flo.png', orden: 11 },
  { nombre: 'Tecnología', estado: 'activo', icon: 'Smartphone', color: '#007BFF', foto: 'tec.png', orden: 12 },
  { nombre: 'Mascotas', estado: 'activo', icon: 'PawPrint', color: '#FF8C42', foto: 'mas.png', orden: 13 },
  { nombre: 'Moda', estado: 'activo', icon: 'Shirt', color: '#A52A2A', foto: 'mod.png', orden: 14 },
  { nombre: 'Panadería', estado: 'activo', icon: 'Croissant', color: '#E3A857', foto: 'pan.png', orden: 15 },
  { nombre: 'Pastelería', estado: 'activo', icon: 'Cake', color: '#FFB6C1', foto: 'pas.png', orden: 16 },
  { nombre: 'Sexshop', estado: 'activo', icon: 'Heart', color: '#C71585', foto: 'sex.png', orden: 17 },
  { nombre: 'Heladería', estado: 'activo', icon: 'IceCreamCone', color: '#87CEFA', foto: 'hel.png', orden: 18 },
  { nombre: 'Ferretería', estado: 'activo', icon: 'Hammer', color: '#708090', foto: 'fer.png', orden: 19 },
  { nombre: 'Lavandería', estado: 'activo', icon: 'Shirt', color: '#40E0D0', foto: 'lav.png', orden: 20 },
  { nombre: 'Congelados', estado: 'activo', icon: 'Snowflake', color: '#00CED1', foto: 'con.png', orden: 21 },
  { nombre: 'Aseo', estado: 'activo', icon: 'Soap', color: '#32CD32', foto: 'ase.png', orden: 22 },
  { nombre: 'Salsamentaria', estado: 'activo', icon: 'Drumstick', color: '#CD5C5C', foto: 'sal.png', orden: 23 },
  { nombre: 'Óptica', estado: 'activo', icon: 'Glasses', color: '#8B008B', foto: 'opt.png', orden: 24 },
  ];

  for (const servicio of serviciosData) {
    try {
      const existente = await serviciosService.findAll();
      const servicioExistente = existente.find(
        (existingServicio) => existingServicio.nombre === servicio.nombre,
      );
      if (servicioExistente) {
        console.log(`⚠️ El servicio ${servicio.nombre} ya existe.`);
        continue;
      }

      await serviciosService.create(servicio);
      console.log(`✅ Servicio ${servicio.nombre} creado.`);
    } catch (error) {
      console.error(`❌ Error al crear el servicio ${servicio.nombre}:`, error);
    }
  }

}


async function seedRoles(app) {
  const rolesService = app.get(RolesService);

  const rolesData = [
    { nombre: 'administrador' },
    { nombre: 'aliado' },
  ];

  for (const rol of rolesData) {
    try {
      const existente = await rolesService.findAll();
      const rolExistente = existente.find(
        (existingRol) => existingRol.nombre === rol.nombre,
      );
      if (rolExistente) {
        console.log(`⚠️ El rol ${rol.nombre} ya existe.`);
        continue;
      }

      await rolesService.create(rol);
      console.log(`✅ Rol ${rol.nombre} creado.`);
    } catch (error) {
      console.error(`❌ Error al crear el rol ${rol.nombre}:`, error);
    }
  }
}
// Puedes seguir agregando funciones como esta:
// async function seedRoles(app) { ... }

bootstrap();
