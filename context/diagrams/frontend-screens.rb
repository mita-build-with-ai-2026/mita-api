@startuml

title Mita - Pantallas Frontend y llamadas al Backend

actor "Usuario Público" as U
actor "Admin / Equipo Mita" as A

rectangle "React App" {
  rectangle "Home /" as HOME
  rectangle "Resultados /search" as SEARCH
  rectangle "Detalle /properties/:id" as DETAIL
  rectangle "Comparador /compare" as COMPARE
  rectangle "Login /login" as LOGIN
  rectangle "Admin /admin" as ADMIN
  rectangle "Importar Ofertas /admin/imports" as IMPORTS
  rectangle "Leads /admin/leads" as ADMINLEADS
  rectangle "Demo /demo" as DEMO
}

rectangle "Node.js / Express API" {
  rectangle "POST /api/auth/login" as AUTH_LOGIN
  rectangle "GET /api/auth/me" as AUTH_ME
  rectangle "GET /api/metadata/search-examples" as EXAMPLES
  rectangle "GET /api/properties" as GET_PROPS
  rectangle "GET /api/properties/{id}" as GET_PROP
  rectangle "POST /api/properties" as CREATE_PROP
  rectangle "POST /api/imports/run" as RUN_IMPORT
  rectangle "GET /api/imports" as LIST_IMPORTS
  rectangle "POST /api/ai/search" as AI_SEARCH
  rectangle "POST /api/ai/compare" as AI_COMPARE
  rectangle "POST /api/ai/enhance-listing" as AI_ENHANCE
  rectangle "POST /api/leads" as CREATE_LEAD
  rectangle "GET /api/leads" as GET_LEADS
  rectangle "GET /api/demo/scenarios" as DEMO_SCENARIOS
}

U --> HOME : entra a Mita
HOME --> EXAMPLES : cargar ejemplos
HOME --> AI_SEARCH : buscar alquiler

AI_SEARCH --> SEARCH : mostrar resultados

SEARCH --> GET_PROP : ver detalle
SEARCH --> CREATE_LEAD : contacto WhatsApp
SEARCH --> COMPARE : comparar seleccionadas

DETAIL --> GET_PROP : cargar propiedad
DETAIL --> CREATE_LEAD : contacto WhatsApp

COMPARE --> AI_COMPARE : comparar propiedades

A --> LOGIN : iniciar sesión
LOGIN --> AUTH_LOGIN : login admin
ADMIN --> AUTH_ME : validar sesión

A --> ADMIN : panel interno
ADMIN --> AI_ENHANCE : mejorar publicación
ADMIN --> CREATE_PROP : guardar propiedad

A --> IMPORTS : importar ofertas
IMPORTS --> RUN_IMPORT : ejecutar importación/scraper
IMPORTS --> LIST_IMPORTS : ver importaciones

A --> ADMINLEADS : ver leads
ADMINLEADS --> GET_LEADS : listar leads

U --> DEMO : modo presentación
DEMO --> DEMO_SCENARIOS : cargar escenarios
DEMO --> AI_SEARCH : ejecutar búsqueda demo
DEMO --> AI_COMPARE : comparar demo

@enduml
