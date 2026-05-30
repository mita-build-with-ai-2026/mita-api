@startuml

title Mita - Validación de sesión admin

actor "Admin" as A
participant "React App" as F
participant "Node.js / Express API" as API
participant "Auth Middleware" as M
database "PostgreSQL" as DB

A -> F : Entra a /admin

F -> API : [GET] /api/auth/me
note right
Header:
Authorization: Bearer JWT
end note

API -> M : validarToken(JWT)

alt token faltante o inválido
  M --> API : error UNAUTHORIZED
  API --> F : 401
  F --> A : redirigir a /login
else token válido
  M -> DB : buscar UsuarioAdmin por id
  DB --> M : usuarioAdmin
  M --> API : usuario autenticado
  API --> F : 200 AuthMeResponse
  F --> A : mostrar panel admin
end

@enduml
