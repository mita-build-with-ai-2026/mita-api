@startuml

title Mita - Contacto por WhatsApp y Registro de Lead

actor "Usuario" as U
participant "Frontend" as F
participant "Node.js / Express API" as API
participant "Lead Service" as LEAD
database "PostgreSQL" as DB
participant "WhatsApp" as W

U -> F : Click "Contactar por WhatsApp"

F -> API : [POST] /api/leads
note right
{
  "propertyId": "uuid",
  "origen": "WHATSAPP_CLICK",
  "mensaje": "Hola, vi esta propiedad en Mita..."
}
end note

API -> DB : buscar Propiedad por id
DB --> API : propiedad

alt propiedad no existe
  API --> F : 404 PROPERTY_NOT_FOUND
else propiedad existe
  API -> LEAD : crearLead(propiedad, body)
  LEAD -> LEAD : construir urlWhatsapp
  LEAD -> DB : INSERT LeadContacto
  DB --> LEAD : lead creado

  LEAD --> API : lead + urlWhatsapp
  API --> F : 201 LeadResponse

  F -> W : abrir urlWhatsapp
end

@enduml
