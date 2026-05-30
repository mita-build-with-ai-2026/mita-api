@startuml

title Mita - Comparador Inteligente de Propiedades

actor "Usuario" as U
participant "Compare Page" as F
participant "Node.js / Express API" as API
participant "AI Service" as AI
participant "Gemini API" as G
database "PostgreSQL" as DB

U -> F : Selecciona 2 o 3 propiedades
U -> F : Escribe contexto
note right
"¿Cuál me conviene más si quiero abrir
una cafetería pequeña y necesito
buena visibilidad?"
end note

F -> API : [POST] /api/ai/compare
note right
{
  "query": "...",
  "propertyIds": ["uuid1", "uuid2", "uuid3"]
}
end note

API -> API : validar mínimo 2 y máximo 3

alt cantidad inválida
  API --> F : 400
else cantidad válida
  API -> DB : SELECT propiedades por IDs
  DB --> API : propiedades[]

  API -> AI : compararPropiedades(query, propiedades)
  AI -> G : Prompt comparación
  G --> AI : comparación JSON
  AI --> API : CompareResponse

  API --> F : 200 CompareResponse
  F --> U : Mostrar recomendación final
end

@enduml
