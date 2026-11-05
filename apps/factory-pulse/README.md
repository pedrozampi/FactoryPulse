# FactoryPulse

Monorepo NestJS de microserviços utilizando **RabbitMQ** e **PostgreSQL + TimescaleDB** para ingestão e persistência de séries temporais de sensores industriais enviados a cada 10 minutos.

## Arquitetura

- **`apps/ingestion-service`**: API HTTP (`POST /ingest`) na porta `3000` que recebe o JSON de leituras dos canais do sensor a cada 10 minutos, valida a estrutura (`time` como `TIMESTAMPTZ` e `stack` numérico) e publica o evento `sensor.pulse.ingested` na fila durável `sensor_pulse_queue` do RabbitMQ.
- **`apps/consumer-worker`**: Worker microserviço NestJS conectado ao RabbitMQ e ao PostgreSQL/TimescaleDB via driver nativo `pg`. Na inicialização, garante a extensão `timescaledb` e a hypertable `sensor_readings` particionada por `time`, e realiza inserção em lote (`UNNEST` batch insert) antes de confirmar (`ack`) a mensagem na fila.
- **`apps/query-service`**: API HTTP (`POST /readings` ou `POST /query`) na porta `3001` (com CORS habilitado) que consulta o TimescaleDB com filtros opcionais (`startTime`, `endTime`, `channels`, `limit`) e retorna as leituras agrupadas por canal para o frontend.
- **`libs/common`**: Biblioteca compartilhada com constantes e tipagens (`SensorPayload`, `SensorReading`, `IngestedPulseEvent`, `QueryReadingsFilter`).

## Formato do Payload do Sensor

```json
{
  "1": [
    {
      "time": "2026-11-05T14:10:00.000Z",
      "stack": 1
    }
  ],
  "0": [
    {
      "time": "2026-11-05T14:10:00.000Z",
      "stack": 0
    }
  ],
  "3": [
    {
      "time": "2026-11-05T14:10:00.000Z",
      "stack": 0
    }
  ],
  "2": [
    {
      "time": "2026-11-05T14:10:00.000Z",
      "stack": 0
    }
  ]
}
```

## Schema TimescaleDB (`sensor_readings`)

Criado automaticamente pelo `TimescaleDbService` ao iniciar o `consumer-worker`:

```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS sensor_readings (
  time TIMESTAMPTZ NOT NULL,
  channel TEXT NOT NULL,
  stack INTEGER NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (time, channel)
);

SELECT create_hypertable('sensor_readings', by_range('time'), if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_sensor_readings_channel_time
  ON sensor_readings (channel, time DESC);
```

## Como Executar

### 1. Subir Todo o Ambiente (RabbitMQ, TimescaleDB, Ingestion Service e Consumer Worker) via Docker Compose

```bash
docker compose up -d --build
```

- **Ingestion Service (HTTP)**: http://localhost:3000 (`POST /ingest` e `GET /health`)
- **Consumer Worker**: Rodando em background consumindo a fila do RabbitMQ e salvando no TimescaleDB
- **RabbitMQ AMQP**: `amqp://guest:guest@localhost:5672` (Management UI: http://localhost:15672)
- **TimescaleDB (PostgreSQL 16)**: `postgresql://postgres:password@localhost:5432/factory_pulse`

### 2. Desenvolvimento Local (Opcional - apenas infra no Docker)

Caso queira rodar apenas o RabbitMQ e o TimescaleDB no Docker (`docker compose up -d rabbitmq timescaledb`) e os serviços localmente:

Em terminais separados (dentro de `apps/factory-pulse`):

```bash
# Terminal 1: Ingestion Service (HTTP na porta 3000)
pnpm run start:ingestion:dev

# Terminal 2: Consumer Worker (RabbitMQ -> TimescaleDB)
pnpm run start:consumer:dev
```

### 3. Testar Envio de Pulso do Sensor

```bash
curl -X POST http://localhost:3000/ingest \
  -H "Content-Type: application/json" \
  -d '{"1":[{"time":"2026-11-05T14:10:00.000Z","stack":1}],"0":[{"time":"2026-11-05T14:10:00.000Z","stack":0}],"3":[{"time":"2026-11-05T14:10:00.000Z","stack":0}],"2":[{"time":"2026-11-05T14:10:00.000Z","stack":0}]}'
```
