@startuml

title Mita - Login Admin

actor "Admin" as A
participant "Login Page /login" as F
participant "Node.js / Express API" as API
participant "Auth Service" as AUTH
database "PostgreSQL" as DB

A -> F : Ingresa email y password

F -> API : [POST] /api/auth/login
note right
{
  "email": "admin@mita.ai",
  "password": "********"
}
end note

API -> AUTH : validarCredenciales(email, password)

AUTH -> DB : Buscar UsuarioAdmin por email
DB --> AUTH : usuarioAdmin

alt usuario no existe o está inactivo
  AUTH --> API : error AUTH_INVALID_CREDENTIALS
  API --> F : 401 Unauthorized
else usuario existe
  AUTH -> AUTH : comparar password con passwordHash

  alt password incorrecto
    AUTH --> API : error AUTH_INVALID_CREDENTIALS
    API --> F : 401 Unauthorized
  else password correcto
    AUTH -> AUTH : generar JWT
    AUTH -> DB : actualizar ultimoAccesoEn
    AUTH --> API : accessToken + user
    API --> F : 200 LoginResponse
    F -> F : guardar token en localStorage
    F --> A : redirigir a /admin
  end
end

@enduml
