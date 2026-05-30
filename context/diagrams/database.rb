@startuml

title Mita - Diagrama de Clases Relacionales de Base de Datos

skinparam monochrome true
skinparam shadowing false
skinparam classAttributeIconSize 0
skinparam linetype ortho

hide circle

class UsuarioAdmin {
  id : UUID <<PK>>
  --
  nombre : VARCHAR(150)
  email : VARCHAR(150)
  passwordHash : TEXT
  rol : RolUsuario
  activo : BOOLEAN
  creadoEn : TIMESTAMP
  ultimoAccesoEn : TIMESTAMP
}

class FuentePropiedad {
  id : SERIAL <<PK>>
  --
  nombre : VARCHAR(100)
  urlBase : TEXT
  tipoFuente : TipoFuente
  activo : BOOLEAN
  creadoEn : TIMESTAMP
}

class ImportacionPropiedades {
  id : UUID <<PK>>
  --
  idFuente : INTEGER <<FK>>
  idUsuarioAdmin : UUID <<FK>>
  estado : EstadoImportacion
  urlSolicitada : TEXT
  totalEncontrados : INTEGER
  totalImportados : INTEGER
  totalFallidos : INTEGER
  mensajeError : TEXT
  iniciadaEn : TIMESTAMP
  finalizadaEn : TIMESTAMP
}

class Propiedad {
  id : UUID <<PK>>
  --
  titulo : VARCHAR(255)
  descripcion : TEXT

  tipoPropiedad : TipoPropiedad
  tipoUsoEspacio : TipoUsoEspacio
  ciudad : VARCHAR(100)
  zona : VARCHAR(120)
  direccionTexto : TEXT

  precio : NUMERIC(12,2)
  moneda : Moneda
  precioBs : NUMERIC(12,2)

  cantidadHabitaciones : INTEGER
  cantidadBanos : INTEGER
  areaM2 : NUMERIC(10,2)

  tieneGaraje : BOOLEAN
  estaAmoblada : BOOLEAN
  aceptaMascotas : BOOLEAN
  expensasIncluidas : BOOLEAN
  montoExpensas : NUMERIC(12,2)

  comodidades : JSONB
  aptoPara : JSONB
  caracteristicasOperativas : JSONB
  requisitosFaltantes : JSONB

  nombreContacto : VARCHAR(150)
  telefonoContacto : VARCHAR(50)

  idFuente : INTEGER <<FK>>
  idImportacion : UUID <<FK>>
  urlFuente : TEXT
  idExternoFuente : VARCHAR(255)
  hashFuente : VARCHAR(255)

  urlImagen : TEXT

  latitud : NUMERIC(10,7)
  longitud : NUMERIC(10,7)

  textoCrudo : TEXT
  datosCrudos : JSONB
  datosExtraidosIA : JSONB
  textoBusqueda : TEXT

  confianzaIA : NUMERIC(5,4)
  estadoNormalizacionIA : EstadoNormalizacionIA

  estado : EstadoPropiedad

  creadaEn : TIMESTAMP
  actualizadaEn : TIMESTAMP
  importadaEn : TIMESTAMP
}

class EmbeddingPropiedad {
  idPropiedad : UUID <<PK, FK>>
  --
  embedding : JSONB
  modelo : VARCHAR(100)
  dimension : INTEGER
  creadoEn : TIMESTAMP
}

class EventoBusqueda {
  id : UUID <<PK>>
  --
  consultaCruda : TEXT
  criteriosExtraidos : JSONB
  cantidadResultados : INTEGER

  usoRag : BOOLEAN
  usoIA : BOOLEAN
  modeloIA : VARCHAR(100)
  tiempoRespuestaMs : INTEGER

  creadoEn : TIMESTAMP
}

class ResultadoBusqueda {
  id : UUID <<PK>>
  --
  idEventoBusqueda : UUID <<FK>>
  idPropiedad : UUID <<FK>>

  puntajeCoincidencia : INTEGER
  similitudRag : NUMERIC(10,6)

  resumen : TEXT
  razones : JSONB
  advertencias : JSONB
  informacionFaltante : JSONB
  recomendacion : TEXT
  etiquetaCorta : VARCHAR(100)

  posicionRanking : INTEGER
  creadoEn : TIMESTAMP
}

class LeadContacto {
  id : UUID <<PK>>
  --
  idPropiedad : UUID <<FK>>

  origen : FuenteLead
  nombreUsuario : VARCHAR(150)
  telefonoUsuario : VARCHAR(50)
  mensaje : TEXT
  urlWhatsapp : TEXT
  estado : EstadoLead

  creadoEn : TIMESTAMP
}

enum RolUsuario {
  ADMIN
  OPERADOR
}

enum TipoFuente {
  PORTAL
  FACEBOOK
  MANUAL
  DEMO
  HTML_CACHE
  OTRO
}

enum EstadoImportacion {
  PENDIENTE
  EJECUTANDO
  COMPLETADA
  FALLIDA
  PARCIAL
}

enum TipoPropiedad {
  DEPARTAMENTO
  GARZONIER
  CASA
  HABITACION
  MONOAMBIENTE
  OFICINA
  LOCAL_COMERCIAL
  DEPOSITO
  GALPON
  TALLER
  ESPACIO_LOGISTICO
  TERRENO
  OTRO
}

enum TipoUsoEspacio {
  RESIDENCIAL
  COMERCIAL
  INDUSTRIAL
  LOGISTICO
  OFICINA
  MIXTO
  OTRO
}

enum Moneda {
  USD
  BOB
}

enum EstadoPropiedad {
  ACTIVA
  INACTIVA
  RESERVADA
  ALQUILADA
}

enum EstadoNormalizacionIA {
  PENDIENTE
  COMPLETADA
  FALLIDA
  PARCIAL
}

enum FuenteLead {
  WHATSAPP_CLICK
  FORMULARIO_CONTACTO
  DEMO
}

enum EstadoLead {
  NUEVO
  CONTACTADO
  DESCARTADO
}

UsuarioAdmin "1" --> "0..*" ImportacionPropiedades : idUsuarioAdmin
FuentePropiedad "1" --> "0..*" ImportacionPropiedades : idFuente
FuentePropiedad "1" --> "0..*" Propiedad : idFuente
ImportacionPropiedades "1" --> "0..*" Propiedad : idImportacion

Propiedad "1" --> "0..1" EmbeddingPropiedad : idPropiedad
Propiedad "1" --> "0..*" LeadContacto : idPropiedad

EventoBusqueda "1" --> "0..*" ResultadoBusqueda : idEventoBusqueda
Propiedad "1" --> "0..*" ResultadoBusqueda : idPropiedad

UsuarioAdmin --> RolUsuario
FuentePropiedad --> TipoFuente
ImportacionPropiedades --> EstadoImportacion
Propiedad --> TipoPropiedad
Propiedad --> Moneda
Propiedad --> EstadoPropiedad
Propiedad --> EstadoNormalizacionIA
LeadContacto --> FuenteLead
LeadContacto --> EstadoLead

@enduml
