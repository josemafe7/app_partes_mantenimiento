/**
 * Datos de ejemplo.
 *
 * Todas las fechas se calculan respecto a HOY, así el panel, la agenda y el
 * tablero tienen siempre contenido con sentido: cosas para hoy, trabajos
 * retrasados, avisos en espera e historial de semanas anteriores.
 *
 * Lo usan `pnpm db:reset` (y su alias `db:seed`), el botón «Cargar datos de
 * ejemplo» que aparece en el panel cuando la base de datos está vacía y las
 * pruebas de consultas, sobre su propia base en memoria.
 */

import { getTableName, sql } from 'drizzle-orm'

import { bd, type Transaccion } from './cliente'
import {
  avisos,
  clientes,
  locales,
  movimientos,
  partes,
  tecnicos,
  type AvisoNuevo,
  type LocalNuevo,
  type MovimientoNuevo,
  type ParteNuevo,
} from './esquema'

import { CANAL, type Canal, type Categoria, type Especialidad, type Estado, type Prioridad } from '@/lib/dominio'
import { hoyISO, sumarDias } from '@/lib/fechas'

/* ------------------------------------------------------------------ Modelos */

type SemillaLocal = {
  nombre: string
  direccion: string
  ciudad: string
  provincia: string
  codigoPostal: string
  telefono: string
  personaContacto: string
  horario: string
  notasAcceso?: string
}

type SemillaCliente = {
  nombre: string
  cif: string
  personaContacto: string
  telefono: string
  email: string
  direccionFacturacion: string
  notas?: string
  locales: SemillaLocal[]
}

type SemillaTecnico = {
  nombre: string
  apellidos: string
  telefono: string
  email: string
  especialidades: Especialidad[]
  zona: string
  notas?: string
  archivado?: boolean
}

type SemillaParte = {
  /** Días respecto a hoy (negativo = pasado). */
  dias: number
  tecnico: number
  horas: number
  trabajo: string
  materiales?: string
  resuelto?: boolean
  observaciones?: string
}

type SemillaAviso = {
  cliente: number
  /** Índice del local dentro de su cliente. */
  local: number
  titulo: string
  descripcion: string
  categoria: Categoria
  prioridad: Prioridad
  estado: Estado
  canal: Canal
  contacto: string
  /** Hace cuántos días entró el aviso. */
  entro: number
  /** Día previsto respecto a hoy; null = sin programar. */
  programada?: number | null
  hora?: string
  tecnico?: number | null
  motivoEspera?: string
  resumen?: string
  partes?: SemillaParte[]
}

/* ----------------------------------------------------------------- Clientes */

const CLIENTES: SemillaCliente[] = [
  {
    nombre: 'Panaderías El Horno de Lucía',
    cif: 'B87451203',
    personaContacto: 'Lucía Serrano',
    telefono: '911 24 55 80',
    email: 'administracion@hornodelucia.es',
    direccionFacturacion: 'Calle Mayor 14, 28013 Madrid',
    notas: 'Facturación mensual agrupada. Avisar siempre antes de ir: abren a las 6:30.',
    locales: [
      {
        nombre: 'El Horno de Lucía — Centro',
        direccion: 'Calle Mayor 14',
        ciudad: 'Madrid',
        provincia: 'Madrid',
        codigoPostal: '28013',
        telefono: '911 24 55 80',
        personaContacto: 'Lucía Serrano',
        horario: 'L-S 6:30-21:00',
        notasAcceso: 'El obrador está en el sótano; se accede por la puerta trasera del patio.',
      },
      {
        nombre: 'El Horno de Lucía — Chamberí',
        direccion: 'Calle Fuencarral 172',
        ciudad: 'Madrid',
        provincia: 'Madrid',
        codigoPostal: '28010',
        telefono: '911 24 55 81',
        personaContacto: 'Tomás Belmonte',
        horario: 'L-S 7:00-20:30',
      },
      {
        nombre: 'El Horno de Lucía — Vallecas',
        direccion: 'Avenida de la Albufera 88',
        ciudad: 'Madrid',
        provincia: 'Madrid',
        codigoPostal: '28038',
        telefono: '911 24 55 82',
        personaContacto: 'Rocío Nieto',
        horario: 'L-D 7:00-21:00',
        notasAcceso: 'Aparcamiento de carga y descarga justo enfrente, 30 minutos.',
      },
    ],
  },
  {
    nombre: 'Cafeterías Grano & Co.',
    cif: 'B65120947',
    personaContacto: 'Diego Vergara',
    telefono: '915 88 21 40',
    email: 'mantenimiento@granoandco.com',
    direccionFacturacion: 'Gran Vía 41, 4º B, 28013 Madrid',
    notas: 'Franquicia con 3 locales. Piden parte firmado de cada intervención.',
    locales: [
      {
        nombre: 'Grano & Co. Gran Vía',
        direccion: 'Gran Vía 41',
        ciudad: 'Madrid',
        provincia: 'Madrid',
        codigoPostal: '28013',
        telefono: '915 88 21 41',
        personaContacto: 'Alba Redondo',
        horario: 'L-D 8:00-23:00',
        notasAcceso: 'Zona peatonal: cargar antes de las 11:00.',
      },
      {
        nombre: 'Grano & Co. Salamanca',
        direccion: 'Calle Velázquez 63',
        ciudad: 'Madrid',
        provincia: 'Madrid',
        codigoPostal: '28001',
        telefono: '915 88 21 42',
        personaContacto: 'Ignacio Bravo',
        horario: 'L-S 8:00-21:00',
      },
      {
        nombre: 'Grano & Co. Atocha',
        direccion: 'Paseo de la Infanta Isabel 9',
        ciudad: 'Madrid',
        provincia: 'Madrid',
        codigoPostal: '28014',
        telefono: '915 88 21 43',
        personaContacto: 'Carmen Ulloa',
        horario: 'L-D 7:30-22:00',
      },
    ],
  },
  {
    nombre: 'Gimnasio Impulso 24h',
    cif: 'B12987334',
    personaContacto: 'Nerea Fuster',
    telefono: '916 55 09 12',
    email: 'instalaciones@impulso24h.es',
    direccionFacturacion: 'Avenida de España 120, 28100 Alcobendas',
    notas: 'Abierto 24 horas: las intervenciones ruidosas, entre las 14:00 y las 17:00.',
    locales: [
      {
        nombre: 'Impulso 24h Alcobendas',
        direccion: 'Avenida de España 120',
        ciudad: 'Alcobendas',
        provincia: 'Madrid',
        codigoPostal: '28100',
        telefono: '916 55 09 12',
        personaContacto: 'Nerea Fuster',
        horario: '24 horas',
        notasAcceso: 'Pedir la llave del cuarto de máquinas en recepción.',
      },
      {
        nombre: 'Impulso 24h Las Rozas',
        direccion: 'Calle Comunidad de Murcia 4',
        ciudad: 'Las Rozas de Madrid',
        provincia: 'Madrid',
        codigoPostal: '28231',
        telefono: '916 55 09 13',
        personaContacto: 'Óscar Piñeiro',
        horario: '24 horas',
      },
    ],
  },
  {
    nombre: 'Clínica Dental Sonrisa Plena',
    cif: 'B44520178',
    personaContacto: 'Dra. Elena Camino',
    telefono: '914 02 76 33',
    email: 'gestion@sonrisaplena.es',
    direccionFacturacion: 'Calle Alcalá 220, 28028 Madrid',
    notas: 'Entrar solo con cita concertada: no se puede interrumpir un tratamiento.',
    locales: [
      {
        nombre: 'Sonrisa Plena Retiro',
        direccion: 'Calle Alcalá 220',
        ciudad: 'Madrid',
        provincia: 'Madrid',
        codigoPostal: '28028',
        telefono: '914 02 76 33',
        personaContacto: 'Marina Pozas',
        horario: 'L-V 9:00-20:00',
        notasAcceso: 'Compresor y equipo de vacío en el cuarto técnico del fondo.',
      },
      {
        nombre: 'Sonrisa Plena Getafe',
        direccion: 'Calle Madrid 31',
        ciudad: 'Getafe',
        provincia: 'Madrid',
        codigoPostal: '28901',
        telefono: '914 02 76 34',
        personaContacto: 'Rubén Estévez',
        horario: 'L-V 9:30-19:00',
      },
    ],
  },
  {
    nombre: 'Moda Aurora',
    cif: 'B70334289',
    personaContacto: 'Patricia Aurora',
    telefono: '913 71 60 05',
    email: 'tiendas@modaaurora.es',
    direccionFacturacion: 'Paseo de la Florida 2, 28008 Madrid',
    locales: [
      {
        nombre: 'Moda Aurora Príncipe Pío',
        direccion: 'CC Príncipe Pío, local 114',
        ciudad: 'Madrid',
        provincia: 'Madrid',
        codigoPostal: '28008',
        telefono: '913 71 60 06',
        personaContacto: 'Sofía Márquez',
        horario: 'L-D 10:00-22:00',
        notasAcceso: 'Los trabajos en el centro comercial requieren permiso previo de su oficina técnica.',
      },
      {
        nombre: 'Moda Aurora Nuevos Ministerios',
        direccion: 'Paseo de la Castellana 79',
        ciudad: 'Madrid',
        provincia: 'Madrid',
        codigoPostal: '28046',
        telefono: '913 71 60 07',
        personaContacto: 'Hugo Lastra',
        horario: 'L-S 10:00-21:00',
      },
    ],
  },
  {
    nombre: 'Restaurante La Brasería del Puerto',
    cif: 'B55910664',
    personaContacto: 'Manuel Olaz',
    telefono: '917 33 88 24',
    email: 'manuel@braseriadelpuerto.es',
    direccionFacturacion: 'Calle Padre Damián 18, 28036 Madrid',
    notas: 'Cocina cerrada de 16:30 a 19:30: es la única franja buena para trabajar.',
    locales: [
      {
        nombre: 'La Brasería del Puerto',
        direccion: 'Calle Padre Damián 18',
        ciudad: 'Madrid',
        provincia: 'Madrid',
        codigoPostal: '28036',
        telefono: '917 33 88 24',
        personaContacto: 'Manuel Olaz',
        horario: 'M-D 13:00-16:30 y 20:00-00:00',
        notasAcceso: 'Cámaras y cuadro eléctrico en el pasillo de servicio.',
      },
    ],
  },
  {
    nombre: 'Supermercados Frescal',
    cif: 'A28774510',
    personaContacto: 'Beatriz Quintana',
    telefono: '912 40 17 70',
    email: 'mantenimiento@frescal.es',
    direccionFacturacion: 'Polígono Industrial El Carralero, nave 7, 28935 Móstoles',
    notas: 'Cliente con contrato de mantenimiento preventivo trimestral.',
    locales: [
      {
        nombre: 'Frescal Leganés',
        direccion: 'Avenida Rey Juan Carlos I 44',
        ciudad: 'Leganés',
        provincia: 'Madrid',
        codigoPostal: '28915',
        telefono: '912 40 17 71',
        personaContacto: 'Jorge Villalba',
        horario: 'L-S 9:00-21:30',
        notasAcceso: 'Entrada de proveedores por el muelle; firmar en el control de acceso.',
      },
      {
        nombre: 'Frescal Móstoles',
        direccion: 'Calle Antonio Hernández 2',
        ciudad: 'Móstoles',
        provincia: 'Madrid',
        codigoPostal: '28934',
        telefono: '912 40 17 72',
        personaContacto: 'Silvia Ramos',
        horario: 'L-S 9:00-21:30',
      },
      {
        nombre: 'Frescal Fuenlabrada',
        direccion: 'Avenida de las Naciones 15',
        ciudad: 'Fuenlabrada',
        provincia: 'Madrid',
        codigoPostal: '28943',
        telefono: '912 40 17 73',
        personaContacto: 'Adrián Coello',
        horario: 'L-S 9:00-21:00',
      },
    ],
  },
  {
    nombre: 'Peluquería Estilo Norte',
    cif: 'B33206845',
    personaContacto: 'Sonia Bermejo',
    telefono: '918 07 31 55',
    email: 'hola@estilonorte.es',
    direccionFacturacion: 'Sector Descubridores 12, 28760 Tres Cantos',
    locales: [
      {
        nombre: 'Estilo Norte Tres Cantos',
        direccion: 'Sector Descubridores 12',
        ciudad: 'Tres Cantos',
        provincia: 'Madrid',
        codigoPostal: '28760',
        telefono: '918 07 31 55',
        personaContacto: 'Sonia Bermejo',
        horario: 'M-S 9:30-20:00',
      },
      {
        nombre: 'Estilo Norte Colmenar',
        direccion: 'Calle Cañada Real 7',
        ciudad: 'Colmenar Viejo',
        provincia: 'Madrid',
        codigoPostal: '28770',
        telefono: '918 07 31 56',
        personaContacto: 'Iván Trujillo',
        horario: 'M-S 10:00-20:00',
      },
    ],
  },
]

/* ----------------------------------------------------------------- Técnicos */

const TECNICOS: SemillaTecnico[] = [
  {
    nombre: 'Marta',
    apellidos: 'Ruiz Alcántara',
    telefono: '600 41 22 87',
    email: 'marta.ruiz@mantenimiento.es',
    especialidades: ['climatizacion', 'electricidad'],
    zona: 'Norte',
    notas: 'Certificado de manipulación de gases fluorados.',
  },
  {
    nombre: 'Javier',
    apellidos: 'Domínguez Sáez',
    telefono: '600 55 19 03',
    email: 'javier.dominguez@mantenimiento.es',
    especialidades: ['fontaneria', 'albanileria'],
    zona: 'Sur',
  },
  {
    nombre: 'Andrés',
    apellidos: 'Pintado Vega',
    telefono: '601 77 34 60',
    email: 'andres.pintado@mantenimiento.es',
    especialidades: ['pintura', 'carpinteria'],
    zona: 'Centro',
    notas: 'Trabaja de tarde: entra a partir de las 14:00.',
  },
  {
    nombre: 'Nuria',
    apellidos: 'Cano Bermúdez',
    telefono: '602 13 90 45',
    email: 'nuria.cano@mantenimiento.es',
    especialidades: ['electricidad'],
    zona: 'Este',
  },
  {
    nombre: 'Sergio',
    apellidos: 'Ibáñez Robles',
    telefono: '603 28 66 71',
    email: 'sergio.ibanez@mantenimiento.es',
    especialidades: ['multiservicio', 'cerrajeria'],
    zona: 'Centro',
    notas: 'Tiene la furgoneta con la escalera de 5 m.',
  },
  {
    nombre: 'Pablo',
    apellidos: 'Ferrer Lozano',
    telefono: '604 90 05 18',
    email: 'pablo.ferrer@mantenimiento.es',
    especialidades: ['cristaleria', 'carpinteria'],
    zona: 'Oeste',
    notas: 'Ya no colabora con la empresa desde el verano.',
    archivado: true,
  },
]

/* ------------------------------------------------------------------- Avisos */

const AVISOS: SemillaAviso[] = [
  /* --- Sin asignar ---------------------------------------------------- */
  {
    cliente: 6,
    local: 0,
    titulo: 'La cámara de carnicería no baja de 8 grados',
    descripcion:
      'Desde ayer por la tarde la cámara de carnicería marca 8 grados. Han pasado el género a la cámara de pescadería, pero no caben todas las bandejas.',
    categoria: 'climatizacion',
    prioridad: 'urgente',
    estado: 'pendiente',
    canal: 'telefono',
    contacto: 'Jorge Villalba',
    entro: 0,
    programada: null,
  },
  {
    cliente: 1,
    local: 0,
    titulo: 'El grifo del office no cierra bien y gotea',
    descripcion: 'Gotea de forma continua. Han puesto un cubo debajo para no mojar el suelo.',
    categoria: 'fontaneria',
    prioridad: 'normal',
    estado: 'pendiente',
    canal: 'whatsapp',
    contacto: 'Alba Redondo',
    entro: 1,
    programada: null,
  },
  {
    cliente: 4,
    local: 0,
    titulo: 'Escaparate con una grieta en la esquina inferior',
    descripcion:
      'Grieta de unos 20 cm que va creciendo. El centro comercial pide que se proteja hasta la sustitución.',
    categoria: 'cristaleria',
    prioridad: 'alta',
    estado: 'pendiente',
    canal: 'email',
    contacto: 'Sofía Márquez',
    entro: 1,
    programada: null,
  },
  {
    cliente: 7,
    local: 1,
    titulo: 'Dos focos del techo fundidos en la zona de lavado',
    descripcion: 'Se quedan sin luz sobre dos lavacabezas. Son focos empotrados de led.',
    categoria: 'electricidad',
    prioridad: 'normal',
    estado: 'pendiente',
    canal: 'whatsapp',
    contacto: 'Iván Trujillo',
    entro: 2,
    programada: null,
  },
  {
    cliente: 0,
    local: 2,
    titulo: 'Repasar la pintura del pasillo tras la humedad',
    descripcion:
      'Ya se arregló la fuga del piso de arriba. Queda repasar el techo y la pared del pasillo de acceso al obrador.',
    categoria: 'pintura',
    prioridad: 'baja',
    estado: 'pendiente',
    canal: 'presencial',
    contacto: 'Rocío Nieto',
    entro: 4,
    programada: null,
  },
  {
    cliente: 2,
    local: 1,
    titulo: 'La puerta de la sala de spinning roza y no cierra',
    descripcion: 'Roza contra el marco por abajo. Con la humedad de estos días ha empeorado.',
    categoria: 'carpinteria',
    prioridad: 'baja',
    estado: 'pendiente',
    canal: 'telefono',
    contacto: 'Óscar Piñeiro',
    entro: 5,
    programada: null,
  },
  {
    cliente: 3,
    local: 1,
    titulo: 'Baldosas levantadas en la entrada de pacientes',
    descripcion: 'Tres baldosas sueltas justo en la entrada. Riesgo de tropiezo con los pacientes mayores.',
    categoria: 'albanileria',
    prioridad: 'alta',
    estado: 'pendiente',
    canal: 'telefono',
    contacto: 'Rubén Estévez',
    entro: 3,
    programada: null,
  },

  /* --- Asignados y programados --------------------------------------- */
  {
    cliente: 5,
    local: 0,
    titulo: 'La campana extractora de la cocina hace mucho ruido',
    descripcion: 'Ruido metálico al arrancar. Sospechan del motor o de las correas.',
    categoria: 'climatizacion',
    prioridad: 'alta',
    estado: 'asignado',
    canal: 'telefono',
    contacto: 'Manuel Olaz',
    entro: 2,
    programada: 0,
    hora: '17:00',
    tecnico: 0,
  },
  {
    cliente: 1,
    local: 2,
    titulo: 'El aseo de señoras desagua muy despacio',
    descripcion: 'El lavabo tarda en vaciarse y empieza a oler. Probablemente sea el sifón.',
    categoria: 'fontaneria',
    prioridad: 'normal',
    estado: 'asignado',
    canal: 'whatsapp',
    contacto: 'Carmen Ulloa',
    entro: 1,
    programada: 0,
    hora: '10:30',
    tecnico: 1,
  },
  {
    cliente: 6,
    local: 1,
    titulo: 'Revisión trimestral de la instalación eléctrica',
    descripcion: 'Preventivo de contrato: cuadro general, diferenciales y alumbrado de emergencia.',
    categoria: 'electricidad',
    prioridad: 'normal',
    estado: 'asignado',
    canal: 'email',
    contacto: 'Silvia Ramos',
    entro: 9,
    programada: 0,
    hora: '09:00',
    tecnico: 3,
  },
  {
    cliente: 0,
    local: 1,
    titulo: 'Cambiar la cerradura de la puerta de personal',
    descripcion: 'Una empleada ha dejado la empresa y quieren cambiar el bombín por seguridad.',
    categoria: 'cerrajeria',
    prioridad: 'normal',
    estado: 'asignado',
    canal: 'telefono',
    contacto: 'Tomás Belmonte',
    entro: 2,
    programada: 1,
    hora: '08:00',
    tecnico: 4,
  },
  {
    cliente: 2,
    local: 0,
    titulo: 'Fuga en la ducha 3 del vestuario masculino',
    descripcion: 'Pierde agua por la base del grifo termostático. Han cerrado la ducha al público.',
    categoria: 'fontaneria',
    prioridad: 'alta',
    estado: 'asignado',
    canal: 'telefono',
    contacto: 'Nerea Fuster',
    entro: 1,
    programada: 1,
    hora: '15:00',
    tecnico: 1,
  },
  {
    cliente: 4,
    local: 1,
    titulo: 'El aire acondicionado gotea sobre los probadores',
    descripcion: 'Gotea del split del fondo. Han puesto una toalla, pero mancha el techo.',
    categoria: 'climatizacion',
    prioridad: 'alta',
    estado: 'asignado',
    canal: 'whatsapp',
    contacto: 'Hugo Lastra',
    entro: 3,
    programada: 2,
    hora: '11:00',
    tecnico: 0,
  },
  {
    cliente: 7,
    local: 0,
    titulo: 'Montar dos estantes nuevos en la zona de tintes',
    descripcion: 'Aportan ellos los estantes. Pared de pladur, hay que poner tacos adecuados.',
    categoria: 'carpinteria',
    prioridad: 'baja',
    estado: 'asignado',
    canal: 'whatsapp',
    contacto: 'Sonia Bermejo',
    entro: 6,
    programada: 3,
    hora: '16:00',
    tecnico: 2,
  },
  {
    cliente: 3,
    local: 0,
    titulo: 'Ruido fuerte en el compresor del gabinete 2',
    descripcion: 'El compresor vibra mucho y se oye desde la sala de espera.',
    categoria: 'climatizacion',
    prioridad: 'normal',
    estado: 'asignado',
    canal: 'telefono',
    contacto: 'Marina Pozas',
    entro: 4,
    programada: 4,
    hora: '09:30',
    tecnico: 0,
  },
  {
    cliente: 6,
    local: 2,
    titulo: 'Sustituir el cristal de la puerta de acceso al almacén',
    descripcion: 'Un transpalé golpeó el cristal y ha quedado astillado por un lado.',
    categoria: 'cristaleria',
    prioridad: 'normal',
    estado: 'asignado',
    canal: 'email',
    contacto: 'Adrián Coello',
    entro: 5,
    programada: 5,
    hora: '12:00',
    tecnico: 4,
  },

  /* --- Retrasados (fecha pasada y aún sin cerrar) --------------------- */
  {
    cliente: 1,
    local: 1,
    titulo: 'Salta el diferencial al encender la tostadora',
    descripcion:
      'Cada vez que encienden la tostadora grande salta el diferencial del cuadro de barra. Están usando solo la pequeña.',
    categoria: 'electricidad',
    prioridad: 'alta',
    estado: 'asignado',
    canal: 'telefono',
    contacto: 'Ignacio Bravo',
    entro: 8,
    programada: -3,
    hora: '10:00',
    tecnico: 3,
  },
  {
    cliente: 0,
    local: 0,
    titulo: 'La persiana metálica se queda a medio bajar',
    descripcion: 'Hay que ayudarla a mano cada noche. El motor suena como si patinara.',
    categoria: 'cerrajeria',
    prioridad: 'alta',
    estado: 'en_curso',
    canal: 'telefono',
    contacto: 'Lucía Serrano',
    entro: 11,
    programada: -2,
    hora: '07:00',
    tecnico: 4,
    partes: [
      {
        dias: -2,
        tecnico: 4,
        horas: 1.5,
        trabajo:
          'Revisión del motor de la persiana. El eje está desalineado y el freno patina. Se ha engrasado la guía y se ha dejado operativa a mano.',
        materiales: 'Grasa de guías',
        observaciones: 'Hace falta cambiar el motor: pedido a proveedor.',
      },
    ],
  },
  {
    cliente: 2,
    local: 1,
    titulo: 'Sin agua caliente en el vestuario femenino',
    descripcion: 'El termo no calienta desde el viernes. Las socias se están quejando.',
    categoria: 'fontaneria',
    prioridad: 'urgente',
    estado: 'en_curso',
    canal: 'telefono',
    contacto: 'Óscar Piñeiro',
    entro: 6,
    programada: -1,
    hora: '14:00',
    tecnico: 1,
    partes: [
      {
        dias: -1,
        tecnico: 1,
        horas: 2,
        trabajo:
          'Desmontada la resistencia del termo: está totalmente calcificada. Limpieza del depósito y prueba de estanqueidad correcta.',
        materiales: 'Junta de brida, desincrustante',
        observaciones: 'Falta la resistencia nueva de 2000 W, llega mañana.',
      },
    ],
  },
  {
    cliente: 5,
    local: 0,
    titulo: 'Grieta en la pared del pasillo de servicio',
    descripcion: 'Grieta en diagonal de casi un metro. Quieren saber si es estructural antes de pintar.',
    categoria: 'albanileria',
    prioridad: 'normal',
    estado: 'asignado',
    canal: 'presencial',
    contacto: 'Manuel Olaz',
    entro: 14,
    programada: -5,
    hora: '17:30',
    tecnico: 1,
  },

  /* --- En curso ------------------------------------------------------- */
  {
    cliente: 6,
    local: 0,
    titulo: 'Cambiar el alumbrado del pasillo de cajas a led',
    descripcion: 'Sustituir 14 pantallas fluorescentes por led. Trabajo por fases para no cerrar cajas.',
    categoria: 'electricidad',
    prioridad: 'normal',
    estado: 'en_curso',
    canal: 'email',
    contacto: 'Beatriz Quintana',
    entro: 12,
    programada: 1,
    hora: '09:00',
    tecnico: 3,
    partes: [
      {
        dias: -4,
        tecnico: 3,
        horas: 4,
        trabajo: 'Sustituidas 8 de las 14 pantallas del pasillo de cajas. Comprobada la instalación.',
        materiales: '8 pantallas led 40 W',
      },
    ],
  },
  {
    cliente: 3,
    local: 0,
    titulo: 'Pintar la sala de espera después del cambio de mobiliario',
    descripcion: 'Dos capas en paredes y techo. Color a juego con el catálogo que envían.',
    categoria: 'pintura',
    prioridad: 'baja',
    estado: 'en_curso',
    canal: 'email',
    contacto: 'Dra. Elena Camino',
    entro: 10,
    programada: 2,
    hora: '14:30',
    tecnico: 2,
    partes: [
      {
        dias: -1,
        tecnico: 2,
        horas: 3.5,
        trabajo: 'Protegido el mobiliario, lijado de paredes y primera capa de imprimación.',
        materiales: 'Imprimación 5 L, cinta de carrocero, plásticos',
      },
    ],
  },

  /* --- En espera ------------------------------------------------------ */
  {
    cliente: 6,
    local: 1,
    titulo: 'El arcón de congelados hace escarcha por la tapa',
    descripcion: 'La goma de la tapa está dada y se forma hielo en el borde.',
    categoria: 'climatizacion',
    prioridad: 'normal',
    estado: 'en_espera',
    canal: 'telefono',
    contacto: 'Silvia Ramos',
    entro: 9,
    programada: 6,
    tecnico: 0,
    motivoEspera: 'Pendiente de recibir la goma perimetral del fabricante: la dan para dentro de 10 días.',
    partes: [
      {
        dias: -6,
        tecnico: 0,
        horas: 1,
        trabajo: 'Diagnóstico: goma perimetral deformada. Descongelado el borde y ajustadas las bisagras.',
        observaciones: 'Hay que sustituir la goma; se pide al fabricante.',
      },
    ],
  },
  {
    cliente: 4,
    local: 0,
    titulo: 'Renovar la iluminación del escaparate',
    descripcion: 'Quieren cambiar los focos halógenos por carril led regulable.',
    categoria: 'electricidad',
    prioridad: 'baja',
    estado: 'en_espera',
    canal: 'email',
    contacto: 'Patricia Aurora',
    entro: 18,
    programada: null,
    tecnico: 3,
    motivoEspera: 'Presupuesto enviado el día 3: esperando la aprobación de la central.',
  },
  {
    cliente: 0,
    local: 2,
    titulo: 'Revisar la bomba de desagüe del obrador',
    descripcion: 'La bomba se para sola de vez en cuando. Hay que revisar el flotador.',
    categoria: 'fontaneria',
    prioridad: 'alta',
    estado: 'en_espera',
    canal: 'whatsapp',
    contacto: 'Rocío Nieto',
    entro: 7,
    programada: 2,
    tecnico: 1,
    motivoEspera: 'El obrador no se puede parar hasta el lunes: lo dejan libre a partir de las 15:00.',
  },
  {
    cliente: 2,
    local: 0,
    titulo: 'Cambiar el suelo técnico de la sala de peso libre',
    descripcion: 'Losetas de caucho descuadradas y levantadas en varias zonas.',
    categoria: 'albanileria',
    prioridad: 'normal',
    estado: 'en_espera',
    canal: 'presencial',
    contacto: 'Nerea Fuster',
    entro: 21,
    programada: null,
    tecnico: 1,
    motivoEspera: 'Falta que el cliente confirme la marca de loseta y el color.',
  },

  /* --- Finalizados ---------------------------------------------------- */
  {
    cliente: 1,
    local: 0,
    titulo: 'La máquina de café pierde agua por debajo',
    descripcion: 'Charco bajo la máquina cada mañana al arrancar.',
    categoria: 'fontaneria',
    prioridad: 'alta',
    estado: 'finalizado',
    canal: 'telefono',
    contacto: 'Alba Redondo',
    entro: 12,
    programada: -10,
    tecnico: 1,
    resumen: 'Sustituido el latiguillo de entrada y la junta del filtro. Sin pérdidas tras 30 minutos de prueba.',
    partes: [
      {
        dias: -10,
        tecnico: 1,
        horas: 1.5,
        trabajo:
          'Localizada la fuga en el latiguillo de entrada de la máquina. Sustituido el latiguillo y la junta del filtro. Prueba de 30 minutos sin pérdidas.',
        materiales: 'Latiguillo flexible 1/2", junta de filtro',
        resuelto: true,
      },
    ],
  },
  {
    cliente: 6,
    local: 2,
    titulo: 'Cortocircuito en el enchufe de la báscula de frutería',
    descripcion: 'Olor a quemado y el enchufe negro. Han desconectado la báscula.',
    categoria: 'electricidad',
    prioridad: 'urgente',
    estado: 'finalizado',
    canal: 'telefono',
    contacto: 'Adrián Coello',
    entro: 15,
    programada: -14,
    tecnico: 3,
    resumen: 'Sustituida la base de enchufe y revisado el circuito. Medidas correctas y báscula funcionando.',
    partes: [
      {
        dias: -14,
        tecnico: 3,
        horas: 2,
        trabajo:
          'Base de enchufe quemada por mal contacto. Sustituida por una base estanca, reapretado el embornado del cuadro y medida la instalación: correcta.',
        materiales: 'Base de enchufe estanca 16 A',
        resuelto: true,
      },
    ],
  },
  {
    cliente: 5,
    local: 0,
    titulo: 'La cámara de pescado no mantiene la temperatura',
    descripcion: 'Sube a 5 grados en las horas de servicio.',
    categoria: 'climatizacion',
    prioridad: 'urgente',
    estado: 'finalizado',
    canal: 'telefono',
    contacto: 'Manuel Olaz',
    entro: 20,
    programada: -17,
    tecnico: 0,
    resumen:
      'Recargado el circuito de gas tras reparar una microfuga en la conexión del evaporador. Mantiene 1 grado de forma estable.',
    partes: [
      {
        dias: -18,
        tecnico: 0,
        horas: 2.5,
        trabajo: 'Detección de fuga con buscafugas. Microfuga en la conexión del evaporador.',
        materiales: 'Nitrógeno para prueba de presión',
      },
      {
        dias: -17,
        tecnico: 0,
        horas: 3,
        trabajo:
          'Reparada la conexión, vacío de la instalación y recarga de gas. Tras 2 horas de funcionamiento mantiene 1 grado.',
        materiales: 'Gas R-449A 1,8 kg, soldadura de plata',
        resuelto: true,
      },
    ],
  },
  {
    cliente: 0,
    local: 1,
    titulo: 'El horno de la tienda no llega a temperatura',
    descripcion: 'Tarda el doble en calentar y el pan sale pálido.',
    categoria: 'electricidad',
    prioridad: 'alta',
    estado: 'finalizado',
    canal: 'whatsapp',
    contacto: 'Tomás Belmonte',
    entro: 16,
    programada: -13,
    tecnico: 3,
    resumen: 'Sustituida una de las tres resistencias, que estaba abierta. Horno alcanzando 250 grados.',
    partes: [
      {
        dias: -13,
        tecnico: 3,
        horas: 2,
        trabajo:
          'Medidas las tres resistencias: una abierta. Sustituida y comprobado el termostato. Alcanza 250 grados en 18 minutos.',
        materiales: 'Resistencia de horno 3000 W',
        resuelto: true,
      },
    ],
  },
  {
    cliente: 3,
    local: 1,
    titulo: 'La puerta automática de entrada no cierra del todo',
    descripcion: 'Queda un hueco de 5 cm y entra frío a la sala de espera.',
    categoria: 'cerrajeria',
    prioridad: 'normal',
    estado: 'finalizado',
    canal: 'telefono',
    contacto: 'Rubén Estévez',
    entro: 22,
    programada: -19,
    tecnico: 4,
    resumen: 'Ajustados los finales de carrera y limpiada la guía inferior. Cierre completo comprobado.',
    partes: [
      {
        dias: -19,
        tecnico: 4,
        horas: 1.5,
        trabajo:
          'Limpiada la guía inferior, que tenía suciedad compactada, y reajustados los finales de carrera del operador. 20 ciclos de prueba correctos.',
        resuelto: true,
      },
    ],
  },
  {
    cliente: 7,
    local: 0,
    titulo: 'Atasco en el lavacabezas 2',
    descripcion: 'Se queda el agua en la pila y baja muy despacio.',
    categoria: 'fontaneria',
    prioridad: 'normal',
    estado: 'finalizado',
    canal: 'whatsapp',
    contacto: 'Sonia Bermejo',
    entro: 11,
    programada: -8,
    tecnico: 1,
    resumen: 'Desatascado el sifón, con mucho pelo acumulado. Se recomienda poner filtro de rejilla.',
    partes: [
      {
        dias: -8,
        tecnico: 1,
        horas: 1,
        trabajo: 'Desmontado y limpiado el sifón del lavacabezas 2. Prueba de desagüe correcta.',
        materiales: 'Junta de sifón',
        resuelto: true,
        observaciones: 'Recomendado colocar filtro de rejilla para evitar que se repita.',
      },
    ],
  },
  {
    cliente: 4,
    local: 1,
    titulo: 'Dos probadores sin luz',
    descripcion: 'Los apliques de los probadores 4 y 5 no encienden.',
    categoria: 'electricidad',
    prioridad: 'normal',
    estado: 'finalizado',
    canal: 'telefono',
    contacto: 'Hugo Lastra',
    entro: 9,
    programada: -7,
    tecnico: 3,
    resumen: 'Sustituidos los dos drivers led averiados. Ambos probadores funcionando.',
    partes: [
      {
        dias: -7,
        tecnico: 3,
        horas: 1.5,
        trabajo: 'Comprobada la línea: correcta. Los dos drivers led de los apliques estaban averiados. Sustituidos.',
        materiales: '2 drivers led 24 V',
        resuelto: true,
      },
    ],
  },
  {
    cliente: 2,
    local: 0,
    titulo: 'La puerta del cuarto de máquinas no se puede cerrar con llave',
    descripcion: 'El bombín gira en vacío. Es una zona que debe quedar cerrada.',
    categoria: 'cerrajeria',
    prioridad: 'alta',
    estado: 'finalizado',
    canal: 'telefono',
    contacto: 'Nerea Fuster',
    entro: 25,
    programada: -23,
    tecnico: 4,
    resumen: 'Sustituido el bombín y entregadas tres llaves nuevas a recepción.',
    partes: [
      {
        dias: -23,
        tecnico: 4,
        horas: 1,
        trabajo: 'Sustituido el bombín de seguridad de la puerta del cuarto de máquinas. Entregadas 3 llaves.',
        materiales: 'Bombín de seguridad europerfil',
        resuelto: true,
      },
    ],
  },
  {
    cliente: 6,
    local: 1,
    titulo: 'Humedad en el techo del almacén',
    descripcion: 'Mancha que va creciendo bajo el aseo de la planta superior.',
    categoria: 'fontaneria',
    prioridad: 'alta',
    estado: 'finalizado',
    canal: 'email',
    contacto: 'Silvia Ramos',
    entro: 30,
    programada: -26,
    tecnico: 1,
    resumen:
      'Reparada la fuga de la bajante del aseo superior y sellada la zona. Pintura del techo repasada por Andrés.',
    partes: [
      {
        dias: -27,
        tecnico: 1,
        horas: 3,
        trabajo: 'Abierto el falso techo y localizada la fuga en la unión de la bajante. Sustituido el manguito.',
        materiales: 'Manguito 110 mm, masilla',
      },
      {
        dias: -26,
        tecnico: 2,
        horas: 2,
        trabajo: 'Secado, sellado y repasada la pintura del techo del almacén con dos capas.',
        materiales: 'Pintura antimoho 5 L',
        resuelto: true,
      },
    ],
  },
  {
    cliente: 1,
    local: 2,
    titulo: 'El molinillo de café salta el magnetotérmico',
    descripcion: 'Salta el térmico dos o tres veces al día.',
    categoria: 'electricidad',
    prioridad: 'alta',
    estado: 'finalizado',
    canal: 'whatsapp',
    contacto: 'Carmen Ulloa',
    entro: 19,
    programada: -16,
    tecnico: 0,
    resumen: 'El magnetotérmico estaba subdimensionado. Sustituido por uno de 16 A con cable adecuado.',
    partes: [
      {
        dias: -16,
        tecnico: 0,
        horas: 2,
        trabajo:
          'Medido el consumo del molinillo: 12 A en arranque. El magnetotérmico era de 10 A. Sustituido por 16 A y repasada la sección del cable.',
        materiales: 'Magnetotérmico 16 A, 6 m de cable 2,5 mm²',
        resuelto: true,
      },
    ],
  },
  {
    cliente: 0,
    local: 0,
    titulo: 'Cambiar la luminaria del escaparate de bollería',
    descripcion: 'Quieren luz más cálida para que la bollería se vea mejor.',
    categoria: 'electricidad',
    prioridad: 'baja',
    estado: 'finalizado',
    canal: 'presencial',
    contacto: 'Lucía Serrano',
    entro: 28,
    programada: -24,
    tecnico: 3,
    resumen: 'Instalado carril led de 3000 K con cuatro focos orientables.',
    partes: [
      {
        dias: -24,
        tecnico: 3,
        horas: 2.5,
        trabajo: 'Retirada la luminaria antigua e instalado carril led 3000 K con 4 focos orientables.',
        materiales: 'Carril 2 m, 4 focos led 12 W 3000 K',
        resuelto: true,
      },
    ],
  },
  {
    cliente: 5,
    local: 0,
    titulo: 'Pintar la fachada de la entrada',
    descripcion: 'Aspecto deteriorado por la lluvia. Dos capas con pintura exterior.',
    categoria: 'pintura',
    prioridad: 'baja',
    estado: 'finalizado',
    canal: 'email',
    contacto: 'Manuel Olaz',
    entro: 40,
    programada: -33,
    tecnico: 2,
    resumen: 'Fachada lijada, imprimada y pintada con dos capas de pintura exterior.',
    partes: [
      {
        dias: -34,
        tecnico: 2,
        horas: 5,
        trabajo: 'Lijado, reparación de desconchones e imprimación de la fachada.',
        materiales: 'Imprimación exterior 10 L, masilla',
      },
      {
        dias: -33,
        tecnico: 2,
        horas: 5,
        trabajo: 'Dos capas de pintura exterior y repaso de cantos. Retirada de protecciones.',
        materiales: 'Pintura exterior 15 L',
        resuelto: true,
      },
    ],
  },
  {
    cliente: 3,
    local: 0,
    titulo: 'Fuga en el equipo de vacío del gabinete 1',
    descripcion: 'Pierde agua por la conexión de desagüe.',
    categoria: 'fontaneria',
    prioridad: 'urgente',
    estado: 'finalizado',
    canal: 'telefono',
    contacto: 'Marina Pozas',
    entro: 34,
    programada: -32,
    tecnico: 1,
    resumen: 'Sustituida la conexión de desagüe del equipo de vacío. Sin pérdidas.',
    partes: [
      {
        dias: -32,
        tecnico: 1,
        horas: 1.5,
        trabajo: 'Sustituida la conexión flexible de desagüe y reapretadas las abrazaderas. Prueba correcta.',
        materiales: 'Flexible de desagüe, abrazaderas',
        resuelto: true,
      },
    ],
  },
  {
    cliente: 7,
    local: 1,
    titulo: 'El secador de pie no funciona',
    descripcion: 'No enciende. Han probado en otro enchufe y tampoco.',
    categoria: 'electricidad',
    prioridad: 'normal',
    estado: 'finalizado',
    canal: 'whatsapp',
    contacto: 'Iván Trujillo',
    entro: 13,
    programada: -11,
    tecnico: 3,
    resumen: 'Avería en el propio aparato, no en la instalación. Se recomienda sustituirlo.',
    partes: [
      {
        dias: -11,
        tecnico: 3,
        horas: 0.5,
        trabajo:
          'Comprobada la toma: 230 V correctos. El aparato tiene la resistencia y el motor abiertos: no compensa repararlo.',
        resuelto: true,
        observaciones: 'Se informa al cliente de que le sale mejor un secador nuevo.',
      },
    ],
  },

  /* --- Cancelados ----------------------------------------------------- */
  {
    cliente: 4,
    local: 0,
    titulo: 'Cambiar el rótulo luminoso de la fachada',
    descripcion: 'Pedían presupuesto para un rótulo nuevo con led.',
    categoria: 'electricidad',
    prioridad: 'baja',
    estado: 'cancelado',
    canal: 'email',
    contacto: 'Patricia Aurora',
    entro: 26,
    programada: null,
    tecnico: null,
    resumen: 'El cliente lo deja para el año que viene con la reforma del local.',
  },
  {
    cliente: 2,
    local: 1,
    titulo: 'Instalar una fuente de agua en la sala de ciclo',
    descripcion: 'Querían una fuente conectada a la red.',
    categoria: 'fontaneria',
    prioridad: 'baja',
    estado: 'cancelado',
    canal: 'telefono',
    contacto: 'Óscar Piñeiro',
    entro: 23,
    programada: null,
    tecnico: null,
    resumen: 'Finalmente han optado por alquilar una máquina al proveedor de agua.',
  },
]

/* ------------------------------------------------------------------ Siembra */

function fechaConHora(diasDesdeHoy: number, hora: number, minuto = 0): Date {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + diasDesdeHoy)
  fecha.setHours(hora, minuto, 0, 0)
  return fecha
}

/** Las tablas en el orden en que se pueden borrar: primero lo que cuelga de otras. */
const TABLAS = [movimientos, partes, avisos, locales, tecnicos, clientes]

/** Borra todo el contenido respetando el orden de las claves ajenas. */
export async function vaciarDatos(tx: Transaccion): Promise<void> {
  for (const tabla of TABLAS) await tx.delete(tabla)
  // Para que los ids vuelvan a empezar en 1.
  const reinicios = TABLAS.map(
    (tabla) => sql`setval(pg_get_serial_sequence(${getTableName(tabla)}, 'id'), 1, false)`,
  )
  await tx.execute(sql`select ${sql.join(reinicios, sql`, `)}`)
}

export type ResumenSiembra = {
  clientes: number
  locales: number
  tecnicos: number
  avisos: number
  partes: number
}

/**
 * Carga los datos de ejemplo. Si `limpiar`, borra antes lo que hubiera.
 *
 * Va todo en una transacción: si algo falla a mitad no quedan datos a medio
 * cargar ni se pierde lo que hubiera antes. Cada tabla se inserta de una vez,
 * porque con la base en Supabase cada consulta es un viaje de ida y vuelta.
 */
export async function sembrar({ limpiar = true }: { limpiar?: boolean } = {}): Promise<ResumenSiembra> {
  return bd.transaction((tx) => cargarEjemplos(tx, limpiar))
}

/**
 * Id de una fila recién insertada, buscado por un dato único de la semilla.
 * Se casa así y no por la posición porque Postgres no promete devolver las
 * filas de RETURNING en el orden en que iban en el INSERT.
 */
function idDe(ids: Map<string, number>, clave: string): number {
  const id = ids.get(clave)
  if (id === undefined) throw new Error(`Datos de ejemplo: no se encuentra «${clave}»`)
  return id
}

async function cargarEjemplos(tx: Transaccion, limpiar: boolean): Promise<ResumenSiembra> {
  if (limpiar) await vaciarDatos(tx)

  const hoy = hoyISO()

  /* Clientes y locales */
  const clientesCreados = await tx
    .insert(clientes)
    .values(
      CLIENTES.map((semilla) => ({
        nombre: semilla.nombre,
        cif: semilla.cif,
        personaContacto: semilla.personaContacto,
        telefono: semilla.telefono,
        email: semilla.email,
        direccionFacturacion: semilla.direccionFacturacion,
        notas: semilla.notas ?? null,
      })),
    )
    .returning({ id: clientes.id, nombre: clientes.nombre })
  const idPorCliente = new Map(clientesCreados.map((fila) => [fila.nombre, fila.id]))
  const idsClientes = CLIENTES.map((semilla) => idDe(idPorCliente, semilla.nombre))

  const filasLocales: LocalNuevo[] = CLIENTES.flatMap((semilla, i) =>
    semilla.locales.map((local) => ({
      clienteId: idsClientes[i],
      nombre: local.nombre,
      direccion: local.direccion,
      ciudad: local.ciudad,
      provincia: local.provincia,
      codigoPostal: local.codigoPostal,
      telefono: local.telefono,
      personaContacto: local.personaContacto,
      horario: local.horario,
      notasAcceso: local.notasAcceso ?? null,
    })),
  )
  const localesCreados = await tx
    .insert(locales)
    .values(filasLocales)
    .returning({ id: locales.id, clienteId: locales.clienteId, nombre: locales.nombre })
  const idPorLocal = new Map(localesCreados.map((fila) => [`${fila.clienteId}·${fila.nombre}`, fila.id]))
  const idsLocales = CLIENTES.map((semilla, i) =>
    semilla.locales.map((local) => idDe(idPorLocal, `${idsClientes[i]}·${local.nombre}`)),
  )

  /* Técnicos */
  const tecnicosCreados = await tx
    .insert(tecnicos)
    .values(
      TECNICOS.map((semilla) => ({
        nombre: semilla.nombre,
        apellidos: semilla.apellidos,
        telefono: semilla.telefono,
        email: semilla.email,
        especialidades: semilla.especialidades,
        zona: semilla.zona,
        notas: semilla.notas ?? null,
        archivado: semilla.archivado ?? false,
      })),
    )
    .returning({ id: tecnicos.id, email: tecnicos.email })
  const idPorTecnico = new Map(tecnicosCreados.map((fila) => [fila.email ?? '', fila.id]))
  const idsTecnicos = TECNICOS.map((semilla) => idDe(idPorTecnico, semilla.email))

  /* Avisos */
  const anio = new Date().getFullYear()

  const preparados = AVISOS.map((semilla, i) => {
    const numero = i + 1
    const tecnicoId =
      semilla.tecnico === null || semilla.tecnico === undefined ? null : idsTecnicos[semilla.tecnico]

    const fechaAviso = fechaConHora(-semilla.entro, 9 + (numero % 8), (numero * 7) % 60)
    const programada =
      semilla.programada === null || semilla.programada === undefined
        ? null
        : sumarDias(hoy, semilla.programada)

    const ultimoParte = semilla.partes?.[semilla.partes.length - 1]
    const fechaCierre =
      semilla.estado === 'finalizado'
        ? fechaConHora(ultimoParte ? ultimoParte.dias : -semilla.entro + 1, 18, 30)
        : null

    const fila: AvisoNuevo = {
      referencia: `AV-${anio}-${String(numero).padStart(4, '0')}`,
      clienteId: idsClientes[semilla.cliente],
      localId: idsLocales[semilla.cliente][semilla.local],
      tecnicoId,
      titulo: semilla.titulo,
      descripcion: semilla.descripcion,
      categoria: semilla.categoria,
      prioridad: semilla.prioridad,
      estado: semilla.estado,
      canalEntrada: semilla.canal,
      contactoAviso: semilla.contacto,
      fechaAviso,
      fechaProgramada: programada,
      horaProgramada: semilla.hora ?? null,
      fechaCierre,
      motivoEspera: semilla.estado === 'en_espera' ? (semilla.motivoEspera ?? null) : null,
      resumenCierre:
        semilla.estado === 'finalizado' || semilla.estado === 'cancelado'
          ? (semilla.resumen ?? null)
          : null,
      creadoEn: fechaAviso,
      actualizadoEn: fechaCierre ?? fechaAviso,
    }
    return { semilla, fila, fechaAviso, fechaCierre, ultimoParte }
  })

  const avisosCreados = await tx
    .insert(avisos)
    .values(preparados.map((preparado) => preparado.fila))
    .returning({ id: avisos.id, referencia: avisos.referencia })
  const idPorReferencia = new Map(avisosCreados.map((fila) => [fila.referencia, fila.id]))

  /* Partes de trabajo y cronología */
  const filasPartes: ParteNuevo[] = []
  const filasMovimientos: MovimientoNuevo[] = []

  for (const { semilla, fila, fechaAviso, fechaCierre, ultimoParte } of preparados) {
    const avisoId = idDe(idPorReferencia, fila.referencia)

    // Entrada del aviso
    filasMovimientos.push({
      avisoId,
      estadoAnterior: null,
      estadoNuevo: 'pendiente',
      nota: `Aviso recibido · ${CANAL[semilla.canal].etiqueta}`,
      fecha: fechaAviso,
    })

    if (fila.tecnicoId) {
      const tecnico = TECNICOS[semilla.tecnico as number]
      filasMovimientos.push({
        avisoId,
        estadoAnterior: 'pendiente',
        estadoNuevo: 'asignado',
        nota: `Asignado a ${tecnico.nombre} ${tecnico.apellidos}`,
        fecha: fechaConHora(-semilla.entro + 1, 8, 15),
      })
    }

    for (const parte of semilla.partes ?? []) {
      filasPartes.push({
        avisoId,
        tecnicoId: idsTecnicos[parte.tecnico],
        fecha: sumarDias(hoy, parte.dias),
        horas: parte.horas,
        trabajoRealizado: parte.trabajo,
        materiales: parte.materiales ?? null,
        resuelto: parte.resuelto ?? false,
        observaciones: parte.observaciones ?? null,
        creadoEn: fechaConHora(parte.dias, 18, 0),
        actualizadoEn: fechaConHora(parte.dias, 18, 0),
      })
    }

    // Estado final
    if (semilla.estado === 'en_curso') {
      filasMovimientos.push({
        avisoId,
        estadoAnterior: 'asignado',
        estadoNuevo: 'en_curso',
        nota: 'Trabajo iniciado',
        fecha: fechaConHora(ultimoParte ? ultimoParte.dias : -1, 12, 0),
      })
    }
    if (semilla.estado === 'en_espera') {
      filasMovimientos.push({
        avisoId,
        estadoAnterior: ultimoParte ? 'en_curso' : 'asignado',
        estadoNuevo: 'en_espera',
        nota: semilla.motivoEspera ?? null,
        fecha: fechaConHora(ultimoParte ? ultimoParte.dias : -semilla.entro + 2, 13, 30),
      })
    }
    if (semilla.estado === 'finalizado') {
      filasMovimientos.push({
        avisoId,
        estadoAnterior: 'en_curso',
        estadoNuevo: 'finalizado',
        nota: semilla.resumen ?? null,
        fecha: fechaCierre ?? fechaConHora(-1, 18, 30),
      })
    }
    if (semilla.estado === 'cancelado') {
      filasMovimientos.push({
        avisoId,
        estadoAnterior: 'pendiente',
        estadoNuevo: 'cancelado',
        nota: semilla.resumen ?? null,
        fecha: fechaConHora(-semilla.entro + 3, 11, 0),
      })
    }
  }

  if (filasPartes.length > 0) await tx.insert(partes).values(filasPartes)
  await tx.insert(movimientos).values(filasMovimientos)

  return {
    clientes: CLIENTES.length,
    locales: filasLocales.length,
    tecnicos: TECNICOS.length,
    avisos: AVISOS.length,
    partes: filasPartes.length,
  }
}
