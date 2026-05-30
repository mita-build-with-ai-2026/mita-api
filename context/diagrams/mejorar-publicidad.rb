@startuml

title Mita - Mejorar Publicación Inmobiliaria con IA

actor "Admin" as A
participant "Admin Page" as F
participant "Node.js / Express API" as API
participant "Auth Middleware" as AUTH
participant "AI Service" as AI
participant "Gemini API" as G
database "PostgreSQL" as DB

A -> F : Pega publicación desordenada
note right
"alquilo local zona norte 800$
ideal negocio avenida transitada"
end note

F -> API : [POST] /api/ai/enhance-listing
note right
Authorization: Bearer JWT

{
  "rawText": "alquilo local zona norte..."
}
end note

API -> AUTH : validar JWT
AUTH --> API : OK

API -> AI : mejorarPublicacion(rawText)
AI -> G : Prompt normalización + copy
G --> AI : EnhancedListingResponse
AI --> API : respuesta

API --> F : 200 EnhancedListingResponse

F --> A : Mostrar propuesta editable

A -> F : Confirma guardar

F -> API : [POST] /api/properties
API -> AUTH : validar JWT
API -> DB : INSERT Propiedad
DB --> API : propiedad creada
API --> F : 201 PropertyResponse

@enduml
