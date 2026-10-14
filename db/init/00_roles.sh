#!/bin/sh
# Crea el usuario que usa el backend, con permisos mínimos:
# puede leer y escribir filas, pero no crear, alterar ni borrar tablas.
# Corre antes que los .sql (orden alfabético), así que ALTER DEFAULT PRIVILEGES
# le da permisos sobre las tablas que crean los scripts siguientes.
set -e

psql -v ON_ERROR_STOP=1 \
     -v app_user="$APP_DB_USER" \
     -v app_password="$APP_DB_PASSWORD" \
     -v db_name="$POSTGRES_DB" \
     --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'EOSQL'
-- Nadie se conecta ni crea objetos por defecto: solo lo que se otorga explícitamente
REVOKE ALL ON DATABASE :"db_name" FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

CREATE ROLE :"app_user" LOGIN PASSWORD :'app_password';
GRANT CONNECT ON DATABASE :"db_name" TO :"app_user";
GRANT USAGE ON SCHEMA public TO :"app_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO :"app_user";
EOSQL
