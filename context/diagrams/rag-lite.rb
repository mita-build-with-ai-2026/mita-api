@startuml

title Mita - Búsqueda Conversacional con IA, RAG-lite y Scoring

actor "Usuario" as U
participant "Home/Search Page" as F
participant "Node.js / Express API" as API
participant "AI Service" as AI
participant "Gemini API" as G
participant "RAG Service" as RAG
participant "Scoring Service" as SCORE
database "PostgreSQL" as DB

U -> F : Escribe búsqueda natural
note right
"Busco un local comercial cerca de una avenida
transitada, máximo 800 dólares, ideal para
abrir una cafetería."
end note

F -> API : [POST] /api/ai/search
note right
{
  "query": "...",
  "limit": 10
}
end note

API -> AI : extraerCriterios(query)
AI -> G : Prompt extracción JSON
G --> AI : criteriosExtraidos
AI --> API : criteriosExtraidos

API -> RAG : buscarSemantico(query, criterios)
RAG -> AI : generarEmbedding(query)
AI -> G : embedding query
G --> AI : vector
AI --> RAG : vector

RAG -> DB : obtener Propiedades + Embeddings
DB --> RAG : propiedadesConEmbeddings[]

RAG -> RAG : calcular similitud coseno
RAG --> API : candidatosSemanticos[]

API -> SCORE : calcularPuntajes(criterios, candidatos)
SCORE --> API : propiedadesRankeadas[]

API -> AI : explicarResultados(criterios, topResultados)
AI -> G : Prompt explicación
G --> AI : razones, advertencias, resumen
AI --> API : resultadosEnriquecidos

API -> DB : INSERT EventoBusqueda
API -> DB : INSERT ResultadoBusqueda[]

API --> F : 200 SearchResponse
F --> U : Mostrar criterios + resultados + match

@enduml
