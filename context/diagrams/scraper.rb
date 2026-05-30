@startuml

title Mita - Importación de Propiedades con Scraper e IA

actor "Admin" as A
participant "Import Page /admin/imports" as F
participant "Node.js / Express API" as API
participant "Auth Middleware" as AUTH
participant "Import Service" as IMP
participant "Scraper Service" as SCR
participant "AI Service" as AI
participant "Gemini API" as G
participant "Embedding Service" as EMB
database "PostgreSQL" as DB

A -> F : Click "Importar ofertas"

F -> API : [POST] /api/imports/run
note right
Header:
Authorization: Bearer JWT

Body:
{
  "sourceId": 1,
  "url": "https://fuente-demo.com/alquileres",
  "limit": 30
}
end note

API -> AUTH : validar JWT
AUTH --> API : usuarioAdmin

API -> IMP : crearImportacion(sourceId, userId, url)
IMP -> DB : INSERT ImportacionPropiedades estado=EJECUTANDO
DB --> IMP : importacionId

IMP -> SCR : obtenerOfertas(url, limit)
SCR --> IMP : ofertasCrudas[]

loop por cada oferta cruda
  IMP -> AI : normalizarOferta(ofertaCruda)
  AI -> G : Prompt normalización JSON
  G --> AI : propiedadNormalizada

  IMP -> IMP : generar hashFuente
  IMP -> DB : verificar duplicado por hashFuente

  alt propiedad duplicada
    IMP -> DB : saltar importación
  else propiedad nueva
    IMP -> AI : crearTextoBusqueda(propiedad)
    AI --> IMP : textoBusqueda

    IMP -> EMB : generarEmbedding(textoBusqueda)
    EMB -> G : embedding
    G --> EMB : vector

    IMP -> DB : INSERT Propiedad
    IMP -> DB : INSERT EmbeddingPropiedad
  end
end

IMP -> DB : UPDATE ImportacionPropiedades totales y estado

API --> F : 201 ImportacionResponse
note left
{
  "id": "uuid",
  "estado": "COMPLETADA",
  "totalEncontrados": 30,
  "totalImportados": 24,
  "totalFallidos": 6
}
end note

F --> A : Mostrar resumen de importación

@enduml
